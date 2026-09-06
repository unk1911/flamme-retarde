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

/**
 * A dimension A PERSON USES, written in real metres.
 *
 * THE HULL SCALES AND THE ACCOMMODATION DOES NOT, and getting that wrong is
 * what "it's all messed up in there in that boat" was. Everything in this file
 * is authored at 1/`BROD_K` of built and multiplied on the way out, which is
 * right for the hull — it is a shape, it is read by its shading, and a
 * uniform scale leaves every normal in the loft alone. It is wrong for
 * everything above the sheer, because a deckhouse is not a shape, it is a
 * ROOM, and a room is the size of the people in it whatever the boat is.
 *
 * Measured on her at 1.75 before this went in:
 *
 *   deckhouse headroom   3.40 m
 *   bench seat height    0.74 m
 *   saloon door          3.01 m
 *   foredeck guardrail   1.40 m
 *   cockpit sole to roof 4.16 m, up eight treads of 0.52
 *
 * A boat for giants. So every height above the sheer goes through this, which
 * divides by the same constant the builder is about to multiply by and leaves
 * a real metre a real metre. Horizontal extents are NOT put through it: the
 * length of the house and the width of the awning are proportions of the hull
 * and they should grow with her.
 */
const BROD_P = (m) => m / BROD_K;

// The three levels, authored, so `BROD.decks` and `brodProto` cannot drift.
// They were two hand-matched sets of numbers and the upper deck was the first
// thing that needed them to agree.
const BROD_DK = 1.06;                                 // the side deck
const BROD_HT = BROD_P(2.10);                         // deckhouse headroom
const BROD_ROOF = BROD_DK + BROD_HT + BROD_P(0.10);   // the upper deck's sole
const BROD_WELL = 0.72;                               // the cockpit sole

/**
 * The two runs of bench, out here for the reason the three levels above are.
 *
 * They were four `b.box` calls inside `brodProto` and nothing else in the game
 * knew a bench existed, which was fine for as long as nobody sat on one. It is
 * not fine now: 60-pax.js puts twenty-two people on this boat and most of them
 * are on these planks, and a seat height written down twice is a seat height
 * that ends up level with somebody's knees the first time the hull is scaled.
 *
 * Authored, like everything else in this file. `x` and `len` do not go through
 * `BROD_P`: a run of bench is as long as the deck it is on and it should grow
 * with her, and its length is the whole of what says she takes eighty people.
 *
 * `BROD_SEAT`, `BROD_SEATT` AND `d` DO, and the last of those is a correction.
 * A seat's height and its DEPTH are both the size of the person on it — 0.45 m
 * off the sole and about half a metre front to back, on a twelve-metre boat or
 * a thirty-metre one — and only the height ever went through `BROD_P`. So the
 * cockpit plank was 0.91 m deep and the upper deck's 0.70, which is not a bench,
 * it is a daybed, and nobody noticed for as long as they were empty.
 *
 * Twenty-two people made it impossible to miss. A figure far enough back on a
 * 0.91 m plank to have their back against something has both shins coming down
 * *through* the plank; far enough forward for their feet to reach the deck and
 * they are perched on the front third of it with half a metre of empty bench
 * behind them. Perching was tried first and photographed, and it is what put
 * this note here.
 *
 * The OUTBOARD edge is what holds still — `z` moves in by half the depth that
 * came off — because that is the edge the riser stands under and the backrest
 * stands on, and it is the edge you see. What the change actually looks like is
 * a wider gangway: 4.06 m between the cockpit benches becomes 4.84.
 */
const BROD_SEAT = BROD_P(0.45);        // the plank's middle over its own sole
const BROD_SEATT = BROD_P(0.08);       // and how thick the plank is
const BROD_BENCH = {
  well: { y: BROD_WELL, x: -4.20, len: 5.30, z: 1.68 - BROD_P(0.52) * 0.5,
    d: BROD_P(0.52) },
  roof: { y: BROD_ROOF, x: 1.475, len: 5.95, z: 1.14 - BROD_P(0.44) * 0.5,
    d: BROD_P(0.44) },
};

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

  /**
   * B, ON HER DECK. Misha: *"why cant I roam around freely with my regular
   * navigation controls, press 'B', press 'Z', and all that good stuff?"*
   *
   * `third` is the pull-back and it is **3.10 m, the same as the promenade's**
   * — not copied, arrived at from the same arithmetic, because it is the same
   * camera and the same body. At `back` behind an eye 1.62 m over the deck her
   * boots fall atan(1.66 / back) below the middle of the screen and half the
   * vertical field is 29 degrees: 3.10 puts them at 28.2, just inside, and she
   * reads whole. Anything shorter and her feet are off the bottom.
   *
   * Everything else here is HER number and not the promenade's, because a
   * 27.3 m boat is not a resort:
   *
   *   `camLow`   how near the sea it may get. Her local y = 0 IS the designed
   *              waterline — `place` puts her on the surface — so this is
   *              metres of air under the lens. It is reached: looking down
   *              40 degrees from the cockpit spends 1.99 m of the 2.88 the eye
   *              has there.
   *   `camHead`  how far it must clear a sole to be OUTSIDE the boat rather
   *              than in the middle of a deck.
   *   `camRoof`  and how far it may rise over the COCKPIT sole, which is the
   *              only deck on her with a roof: the awning is a solid panel
   *              2.15 m over that sole, and a camera that has gone up through
   *              it is a camera looking at a sheet of canvas. Tested against
   *              the sole rather than against a box, so the awning may be
   *              moved and this still knows where it is.
   *   `camMin`   under which the third person gives up and hands the frame
   *              back to the first — the promenade's argument, unchanged:
   *              under a metre it is a face full of neck.
   */
  third: 3.10,               // m the camera falls back when B is on
  camStep: 0.15,             // m a probe — the march, as 47-ground.js marches
  camMin: 1.00,
  camLow: 1.00,
  camHead: 0.35,
  camRoof: 2.05,
  camEase: 6.0,              // m/s the pull-back is allowed to LENGTHEN at

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
  //
  // FOUR BANDS NOW, AND TWO LEVELS. Misha, 4 Sep 2026: *"once i board it, i
  // should be able to walk around it freely, go up and down, instead it's all
  // messed up in there"*. She had one level and three bands and no way on to
  // the upper deck at all, which had just been built as scenery.
  //
  // `ramp` makes a band a STAIR: the sole runs from `y` at `x0` to `y + ramp`
  // at `x1`, so walking forward up the companionway carries you up it with no
  // mode, no key and no state to get wrong. It is first in the list because it
  // stands inside the cockpit's own x range and first match wins.
  //
  // `lim` is the athwart limit where a band is bounded by something that is
  // not the hull — on the upper deck that is the rail. It is also what makes
  // two levels work without the walker tracking which one it is on: the upper
  // deck exists only at |z| < 1.10 and the side decks only at |z| >= 1.16, so
  // the two bands are DISJOINT and no (x, z) is ever on both. That 60 mm is
  // the deckhouse wall, and it is why this needs no `you.level`.
  decks: [
    // The companionway, up the middle of the cockpit against the after face of
    // the house. 2.38 m of rise over 2.70 of run is 41 degrees, which is a
    // steep stair and is exactly what a boat this size has aft.
    { x0: -4.20, x1: -1.50, y: BROD_WELL, hole: 0, lim: 0.50,
      ramp: BROD_ROOF - BROD_WELL },
    // THE LANDING AT THE HEAD OF IT, and without it the stair went nowhere.
    // The flight stops at x -1.50 and the roof begins at -1.55, but the COCKPIT
    // band ran on to -1.20 and is tested first — so the last stride off the top
    // tread matched the cockpit and put you back on its sole, 2.79 m below,
    // with no fall and no sound. Fifteen centimetres of flat at roof level,
    // the width of the flight, closes it.
    { x0: -1.50, x1: -1.35, y: BROD_ROOF, hole: 0, lim: 0.50 },
    // The cockpit, full width — and it stops at the house's after face rather
    // than 0.15 past it. `soleAt` draws the sole to -1.35 and this band claimed
    // to -1.20, so there were fifteen centimetres of cockpit you could stand on
    // where the floor had already ended.
    { x0: -7.50, x1: -1.35, y: BROD_WELL, hole: 0 },
    { x0: -1.35, x1: 4.40, y: BROD_DK, hole: 1.16 },  // the side decks
    { x0: 4.30, x1: 6.60, y: 1.22, hole: 0 },         // the foredeck
    // The upper deck, between the rails. Its after end is the stair head and
    // its forward end is the wheelhouse roof, which nobody stands on.
    // x1 3.42 and not 4.30: the funnel casing stands at 3.86 and is 0.88 long,
    // so its after face is at 3.42. A walkable band that ran to 4.30 walked you
    // into the middle of it. See the casing in `brodProto`.
    { x0: -1.55, x1: 3.42, y: BROD_ROOF, hole: 0, lim: 1.10 },
  ],
  edge: 0.06,                // how far in from the bulwark you may stand — a
                             // person's clearance, so it does NOT scale
  // And how far up or down one stride may take you. A person's, so these do
  // NOT scale with `BROD_K` — but they have to clear the largest step she
  // actually has, which is the 0.595 m from the cockpit sole up on to the side
  // deck (`BROD_DK - BROD_WELL`, built). Set under that and the player is shut
  // in the cockpit, which is a worse bug than the one being fixed. Set at 0.66
  // they clear it with a hand's width and still refuse the 2.795 m the roof is
  // above the sole by a factor of four.
  stepUp: 0.66,
  stepDown: 0.85,
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
  // `lim` and `ramp` are both lengths on the boat and scale with her. `edge`
  // below does not, because it is a person's clearance and a person is the
  // same size whatever the boat is.
  if (d.lim != null) d.lim *= BROD_K;
  if (d.ramp != null) d.ramp *= BROD_K;
}
// The bulwark, which `deckAt` subtracts off the sheer to get the inboard face
// of it. Structure, not clearance, so it scales.
const BROD_BULK = 0.24 * BROD_K;

// And the benches, in BUILT metres, on the same table the builder reads in
// authored ones. Added fields rather than a second object, so there is exactly
// one place a bench is described and no way to update half of it: `brodProto`
// takes `x`, `len`, `z`, `d` and goes through `scaledBuilder`, and 60-pax.js
// takes the five below and does not have to know that scale exists.
//
//   top   the plank's top face — where somebody's backside goes
//   zIn   its inboard edge, which is what a pair of shins has to clear
//   zOut  its outboard edge, against the bulwark or the backrest
//   x0/x1 the run of it fore and aft
//
// Measured out of this on the built page: both planks stand 0.49 m over their
// own sole, the cockpit's is 0.52 m deep and the upper deck's 0.44.
for (const B of [BROD_BENCH.well, BROD_BENCH.roof]) {
  B.top = (B.y + BROD_SEAT + BROD_SEATT * 0.5) * BROD_K;
  B.zIn = (B.z - B.d * 0.5) * BROD_K;
  B.zOut = (B.z + B.d * 0.5) * BROD_K;
  B.x0 = (B.x - B.len * 0.5) * BROD_K;
  B.x1 = (B.x + B.len * 0.5) * BROD_K;
}

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

/**
 * The sheer height and half-beam at any x, interpolated between stations.
 *
 * **CLAMPED FIRST, AND THAT IS NOT TIDYING.** The loop only finds a pair when
 * x lies *between* two stations; for anything outside the table it fell
 * through with `a` and `c` still on the first pair and `u` saturated at 1, so
 * every x aft of the transom answered with the **stem's** station — sheer 2.05
 * where it should be 1.62, half-beam 0.72 where it should be 1.82.
 *
 * That was not a rounding error, it was the loudest thing on the boat. The
 * deck loop in `brodProto` runs to x −8.2 authored, which is 0.4 aft of the
 * last station, so its final bulwark segment was drawn from the transom to a
 * point 0.7 m abaft it, pinched to the stem's beam and lifted 0.75 m: a pair
 * of blades, navy on the outside face and white on the inside, sticking three
 * metres out of her counter and down through the waterline. From the quay
 * astern of her — which is where you stand waiting for her — it was most of
 * her silhouette. Photographed from the mole at 22 m before the fix.
 *
 * Both loops in `brodProto` now stop on the hull as well, which is the other
 * half of it: a clamp alone would have left a metre of flat cap projecting
 * aft of the transom instead of a blade.
 */
function brodSheer(x) {
  const q = clamp(x, BROD_ST[BROD_ST.length - 1][0], BROD_ST[0][0]);
  let a = BROD_ST[0], c = BROD_ST[1];
  for (let i = 0; i < BROD_ST.length - 1; i++) {
    if (q <= BROD_ST[i][0] && q >= BROD_ST[i + 1][0]) {
      a = BROD_ST[i]; c = BROD_ST[i + 1]; break;
    }
  }
  const u = clamp((a[0] - q) / ((a[0] - c[0]) || 1), 0, 1);
  return [a[4] + (c[4] - a[4]) * u, a[5] + (c[5] - a[5]) * u];
}

/**
 * The whole station row at an AUTHORED x, and the half-beam at a height on it.
 *
 * Up here rather than inside `brodProto`, where both of these lived, because
 * `moor` has to answer a question the loft is the only thing that knows: how
 * far off the pier's centreline she has to lie for her fenders to touch it and
 * her plating not to. That number was typed — `A.w + 2.35` — and it was wrong
 * by more than a metre in the direction nobody checks, which is *into* the
 * masonry. See the note over the berth in `moor`.
 *
 * Clamped for the reason `brodSheer` is clamped, and it is the same bug: this
 * is the copy that drew the blades off her counter.
 *
 * `brodBeam` inverts the loft `pt` in `brodProto` analytically rather than
 * approximating it: `pt` puts the topside at `y = cy + (sy − cy) u^0.94` and
 * `w = cw + (sw − cw) u^0.58`, so u comes back off the first and goes into the
 * second. Anything hung on her SIDE needs it — she carries 0.35 m of flare
 * between chine and sheer amidships, so a fender placed off the sheer's
 * half-beam floats a third of a metre clear of the paint and one placed off
 * the chine's is buried.
 */
function brodStation(x) {
  const q = clamp(x, BROD_ST0[BROD_ST0.length - 1][0], BROD_ST0[0][0]);
  let a = BROD_ST0[0], c = BROD_ST0[1];
  for (let i = 0; i < BROD_ST0.length - 1; i++) {
    if (q <= BROD_ST0[i][0] && q >= BROD_ST0[i + 1][0]) {
      a = BROD_ST0[i]; c = BROD_ST0[i + 1]; break;
    }
  }
  const u = clamp((a[0] - q) / ((a[0] - c[0]) || 1), 0, 1);
  return a.map((v, k) => v + (c[k] - v) * u);
}
function brodBeam(x, y) {
  const [, , cy, cw, sy, sw] = brodStation(x);
  if (sy <= cy) return sw;
  const u = Math.pow(clamp((y - cy) / (sy - cy), 0, 1), 1 / 0.94);
  return cw + (sw - cw) * Math.pow(u, 0.58);
}

/**
 * Her tyre fenders — where they hang, and how far out they reach.
 *
 * The stations and the sizes were inside `brodProto` and the note explaining
 * them still is; what is up here is only what somebody outside the builder has
 * to be able to ask. `brodFendOut` is that question: **the outermost point of
 * anything on her side, in BUILT metres off her centreline**, which is the one
 * number the berth is a function of.
 *
 * It comes out at the tyre and not at the bulwark, and only just: the bulwark's
 * outer face stands at (2.10 + 0.030) x 1.75 = 3.727 and the widest tyre
 * reaches 3.779, so the tyres are 52 mm proud of her topsides — which is what
 * makes them fenders rather than decoration, and is why the berth is measured
 * off them.
 */
const BROD_FEND = [-6.14, -3.86, -1.63, 2.30, 4.40];   // authored stations
const BROD_FEND_RR = BROD_P(0.38);      // ring centreline radius
const BROD_FEND_RR2 = BROD_P(0.11);     // and half the tread's thickness
const BROD_FEND_DROP = BROD_P(1.42);    // below the deck edge
const BROD_FEND_OFF = 0.030;            // and how far the lanyard holds it off
function brodFendOut() {
  let out = 0;
  for (const fx of BROD_FEND) {
    const cy = brodStation(fx)[4] - BROD_FEND_DROP;
    const zc = brodBeam(fx, cy + BROD_FEND_RR + BROD_FEND_RR2)
      + BROD_FEND_RR2 + BROD_FEND_OFF;
    out = Math.max(out, zc + BROD_FEND_RR2);
  }
  return out * BROD_K;
}

/**
 * Her mooring cleats, and where the rope comes off one.
 *
 * `1000150377` is a photograph of the mole's bitt with three turns of white
 * rope on it and the tail flaked out on the concrete, and — this is the part
 * worth being exact about — **there is no boat in the frame**. So the rope
 * leading nowhere is not a mistake in the model, it is the survey: he
 * photographed a bollard on an empty quay. The mistake is only that the game
 * puts a twenty-seven metre boat against that quay and left her lying to
 * nothing at all.
 *
 * A boat alongside is made fast, and she had nothing to make fast *to*: not
 * one cleat, one bitt or one samson post anywhere on her. So: two a side, on
 * the capping, where the rope can come straight off them and down to the
 * stone without a fairlead. Both sides for the reason the tyres are both
 * sides — she has been photographed to starboard and she berths port-to.
 *
 * Returned in her AUTHORED frame so `brodProto` can draw it and `moor` can
 * multiply by `BROD_K`, which is the same contract `BROD_FEND` has. `z` comes
 * back positive; the port copy is the same numbers negated.
 */
const BROD_CLEAT = [3.80, -6.30];        // authored stations, fore and aft
const BROD_CLEAT_Y = BROD_P(0.17);       // the horn, over the capping
function brodCleatAt(x) {
  const s = brodStation(x);
  return [x, s[4] + BROD_CLEAT_Y, s[5] - BROD_P(0.10)];
}

/**
 * HER PAINT, MEASURED OFF THE MURAL.
 *
 * She was one flat white from the cove to the boot-top down all 27.3 m of her,
 * one flat navy above it and one flat gold between, and the mural is none of
 * those things. `murals/brod-mural.jpg` rectified along her own gold cove — the
 * line fits to 2.1 px rms with a quartic, which straightens the whole sheer and
 * turns "0.4 m below the cove" into a row of the image — at her 96.2 px a metre
 * gives, over 946 columns of hull with no rope, tyre or planter in them and
 * every column normalised by its own median so the wall's lighting drops out:
 *
 *   depth below the cove   0.21    0.42    0.62    0.83
 *   P10 / median           0.795   0.738   0.642   0.507
 *   P90 / median           1.260   1.137   1.160   1.169
 *   sd(ln) from the IQR    0.109   0.109   0.155   0.262
 *
 * Four things come straight off that table and all four are built below.
 *
 * **IT IS NOT A VERTICAL STREAK, and that was the assumption to kill first.**
 * A hull weeps down and this one does not: over 35 clean 88 px squares of her
 * topside the angular power in the 0.04–0.4 m band splits 37 % into gradients
 * that run down her (streaks lying ALONG the hull) against 35 % into gradients
 * that run along her (streaks lying down it). That is isotropic with a hair of
 * along-hull bias, and where there is coherent structure at all — one 80 px
 * box of clean paint where the wall's own roughcast does not swamp it — the
 * correlation runs 15 px along her against 6 px down: **elongated ALONG the
 * hull, 2.5 to 1**. Which is what a chalked, scrubbed, repainted topside looks
 * like and not what a rust weep looks like. Building vertical streaks would
 * have been a regular pattern that is not there, which is worse than nothing.
 *
 * So: a plain fbm in a cell 2.8 m along her by 0.55 m down. The base cell is
 * 5:1 rather than the measured 2.5:1 for a reason that has nothing to do with
 * anisotropy — the topside is only 0.99 m tall, so a cell as deep as the
 * measurement wants gives every column ONE value and the field cannot vary
 * down her at all. Four octaves of `fbm2` rotate as they go, so what comes out
 * is nearer 2:1 than 5:1, and the fleck on the end of it is isotropic.
 *
 * **THE VARIATION IS ONE-SIDED.** Look at the two tails: at 0.42 m the bright
 * end is +0.128 in log and the dark end is −0.304, and by 0.83 m it is +0.156
 * against −0.679. Paint does not brighten; dirt darkens it. So the field goes
 * through `exp(up·s⁺ − dn·(s⁻)^1.5)` — the 1.5 keeps the core tight, which is
 * the other half of the table: the IQR is only 0.109 while the tenth percentile
 * is 20 % down. Most of her is clean and some of her is filthy.
 *
 * **IT GETS WORSE DOWNWARD.** `dn` runs 0.55 at the cove to 3.10 at the
 * boot-top. On top of that the median itself falls: fitting ln L over the
 * clean 0.20–0.80 m band gives **−0.119 per metre**, so 0.888 a metre and
 * ×0.87 over the 1.20 m from the cove to the stripe. That is the whole of the
 * tone term.
 *
 * WHAT CAME BACK OUT OF THE RENDER, measured with the same statistic on 2 481
 * columns of her own topside in three broadside frames — and on a BEFORE frame
 * to say what the renderer already supplies without any of this:
 *
 *   depth below the cove   0.21    0.42    0.62    0.83
 *   mural   P10            0.795   0.738   0.642   0.507
 *   render  P10            0.853   0.675   0.658   0.588
 *   mural   P90            1.260   1.137   1.160   1.169
 *   render  P90            1.590   1.175   1.128   1.166
 *   mural   sd(ln)         0.109   0.109   0.155   0.262
 *   render  sd(ln)         0.192   0.144   0.131   0.214
 *   BEFORE  sd(ln)         0.000   0.000   0.000   0.013
 *
 * The one row that does not land is the top, and it is the statistic and not
 * the paint: every column is divided by its OWN median before the percentiles
 * are taken, so a column whose bottom third is heavily dirtied has its median
 * dragged down and its clean top reads high. Turning that P90 down means
 * turning the dark ramp off, which is the thing the other three rows are made
 * of.
 *
 * Zero to three places on the flat hull, which is both the size of the defect
 * and the answer to the obvious objection: the renderer's own shading puts
 * NOTHING into this statistic, so there is nothing here being counted twice.
 *
 * **VALUE AND HUE MOVE TOGETHER.** Inside the topside paint the bright four
 * fifths sit at R/L 1.008, G/L 1.009, B/L 0.874 — the same cream at every
 * level — and the darkest fifth swings to 0.858, 1.036, 1.059. The dirt is
 * blue-grey and the chalk is not. Their ratio, normalised back to luminance 1,
 * is (0.851, 1.027, 1.212), and that is `BROD_COOL` below.
 *
 * WHAT WAS *NOT* CHANGED, AND WHY. The same sampling says her white is
 * B/L 0.874 where the mural's white pipe rails are 0.962 — a hull 9 % short of
 * neutral in blue, which would mean warming `HULL` and `HOUSE`. It is not
 * built, because the white balance will not hold still: three white witnesses
 * in the same photograph give 1.010, 0.962 and 0.912, and the bare cream render
 * ABOVE the mural comes back at 0.874 — exactly the hull's number, which is
 * what a global warm cast in the photograph looks like. A between-image
 * measurement that cannot survive its own control does not get built. The hue
 * term above is a *within*-image one — bright paint against dark paint in the
 * same square inch — and the cast cancels out of it, which is why that one is
 * here and the base colour is not.
 *
 * The three materials do not weather alike, and that is measured too:
 *
 *   - the ONE DARK TIN — bulwark strake and boot-top — taking only the dark
 *     population of the band so the white rails crossing it are not in the
 *     sample, swings +0.770 up against −0.566 down: a dark paint chalks PALE,
 *     the opposite sign to the topsides. A QUARTER of it goes on — +0.180 and
 *     −0.144 built against the measured +0.770 and −0.566 — because ours is
 *     already 7.5x lighter than the mural's near-black, and because sd(ln)
 *     measured on near-black JPEG pixels is mostly the codec. The boot-top
 *     gets more of it than the strake, +0.289 against −0.302: sd(ln) 1.27 in
 *     the mural against the strake's 0.444, and it is the band that lives in
 *     the water.
 *   - the GOLD COVE is a broken line, not a dirty one. Its half-correlation
 *     along her is 0.03–0.07 m against the topside's 1.55 m, and after a 4.2 m
 *     box mean only 0.06 of its sd(ln) 0.556 is left — it flickers hard at a
 *     hand's width and drifts not at all. So: a fine cell, a hard dark bias
 *     (gold wears through to what is under it) and no depth ramp.
 *   - the DECKHOUSE is the same paint as the hull — the mural's top fifth of
 *     both is rgb (0.701, 0.701, 0.604), to three places — but it is out of the
 *     splash, so it gets the field with no waterline ramp and at 0.7 of it.
 *
 * AND IT MUST NOT REPEAT ALONG HER. The coarsest cell is 3.0 m by 1.5 m and
 * `vnoise2` wraps at 512, so there is no repeat inside her 27.3 m and none
 * inside the 512 m she would have to be to find one. The field is keyed on
 * `vLocal` and not on `vWorld` for the reason every other position-driven term
 * in this game is: she SAILS. Keyed on the world she would swim 3 850 m
 * through her own paint on the way to Šibenik.
 *
 * Half-beam goes into the second axis as well as depth, so the two sides of
 * her never carry the same paint — smoothly, so the stem, where the two sides
 * meet and z passes through zero, has no seam in it.
 */
const BROD_COOL = 'vec3(0.851, 1.027, 1.212)';
const BROD_PAINT_GLSL = /* glsl */ `
  base *= vVCol;
  // vUv is not a texture coordinate on this mesh. x carries which paint the
  // vertex was given, y how far under the sheer it sits — both stamped on by
  // brodPaint() off the finished geometry. Anything else drawn with this
  // material has no uv at all, reads (0, 0), and falls straight through.
  if (vUv.x > 0.5) {
    float dep = vUv.y;                       // metres below the sheer, at her
    float dist = length(vWorld - uCamPos);
    // HOW BIG A PIXEL IS ON THIS SURFACE, and not how far away it is. The two
    // are the same thing only when you are square on to something, and the
    // third person on her deck is never square on to anything: from the
    // foredeck the inside of her port bulwark runs away from the lens at four
    // degrees, and a fade written on distance alone left the whole of it
    // ALIASING — the field's own 0.35 m octave, compressed by the grazing
    // angle into three-pixel bars, read as a striped fence at two metres.
    // Footprint goes as dist / cos(angle to the normal), which is this to
    // within the constant that both smoothsteps below absorb. Floored at 0.06
    // so a face exactly edge-on is fifteen times its distance and not
    // infinity.
    float foot = dist / max(abs(dot(normalize(vWorld - uCamPos), n)), 0.06);
    // The finest term inside the exponent is a 0.40 by 0.08 m cell, and it is
    // gone by the time a pixel covers a fair fraction of it.
    float near = 1.0 - smoothstep(30.0, 90.0, foot);
    vec2 hp = vec2(vLocal.x, dep + vLocal.z * 0.9);
    vec2 cell = vec2(2.8, 0.55);
    float up = 0.26, dn = 1.00, tone = 1.0, cool = 1.0;

    if (vUv.x < 1.5) {                       // 1 - the white topsides
      float t = clamp((dep - 0.875) / 0.99, 0.0, 1.0);
      tone = exp(-0.119 * max(dep - 0.875, 0.0));
      dn = mix(0.55, 3.10, t);
    } else if (vUv.x < 2.5) {                // 2 - her one dark tin
      float w = smoothstep(1.30, 1.85, dep); // strake above, boot-top below
      cell = vec2(4.0, 1.6);
      up = mix(0.45, 0.72, w);
      dn = mix(0.55, 1.15, w);
      cool = 0.0;
    } else if (vUv.x < 3.5) {                // 3 - the gold cove
      cell = vec2(0.45, 0.45);
      up = 0.18; dn = 0.60; cool = 0.0;
    } else if (vUv.x < 4.5) {                // 4 - the deckhouse and the
      // painted-out inside of the bulwark. Off her own height rather than off
      // the sheer, because everything in this class is ABOVE the sheer, where
      // the depth channel has run out - and in a cell of its own, because the
      // topside's is 5:1 along her, which is right for a hull and on a flat
      // white wall reads as clapboard. The mural's house is blotchy at
      // sd(ln) 0.142 with no grain in it.
      hp = vec2(vLocal.x, vLocal.y * 1.3 + vLocal.z * 0.9);
      cell = vec2(1.7, 0.95);
      up = 0.22; dn = 0.80;
    } else {                                 // 5 - antifouling
      cell = vec2(4.0, 2.0);
      up = 0.22; dn = 0.60; cool = 0.0;
    }

    vec2 q = hp / cell + 17.3;
    float s = fbm2(q, 4) * 2.0 - 1.0;
    s += (vnoise2(q * 7.0) - 0.5) * 0.62 * near;
    float d = max(-s, 0.0);
    float f = exp(up * max(s, 0.0) - dn * d * sqrt(d)) * tone;
    // A floor, because the dark tail of an exponential has no bottom and a
    // hole in her side is not weathering.
    base *= max(f, 0.32);
    base *= mix(vec3(1.0), ${BROD_COOL}, cool * clamp(d * 2.4, 0.0, 1.0));
    // THE FLECK, and it goes on OUTSIDE the exponent on purpose. The dark
    // side above is d^1.5, whose slope at d = 0 is zero, so every fine wobble
    // on the clean four fifths of her was flattened to nothing and from three
    // metres off she was a set of soft grey washes with no grain in them. The
    // mural at that range is not smooth anywhere: the band from 0.04 to
    // 0.17 m carries sd(ln) 0.16 and 0.13, of which some is the wall's own
    // roughcast and the rest is set by what the whole band has to add up to:
    // 0.20 is what puts the render's sd(ln) back on the mural's at the depths
    // where the two already agreed. Isotropic, unlike everything above -
    // at a hand's width the angular power in the mural has no direction in it
    // at all. And gone by forty-five metres of FOOTPRINT - see foot above -
    // where its 0.17 m cell is down to four pixels and a fleck is on its way
    // to being a shimmer.
    float grain = 1.0 - smoothstep(12.0, 45.0, foot);
    base *= 1.0 + (vnoise2(hp * 6.0 + 41.7) - 0.5) * 0.20 * grain;
  }
`;

/**
 * Stamp the paint class and the depth under the sheer on to a finished hull.
 *
 * OFF THE GEOMETRY AND NOT OFF THE CALL SITES, which is the whole trick. The
 * builder is handed a colour at every one of a hundred call sites in
 * `brodProto`, and threading a class through all of them is a hundred chances
 * to miss one; the colours themselves are five distinct `const` arrays and the
 * builder has already written them into `aVCol`, one triple a vertex. So this
 * reads them back out and recognises them. `2e-4` because a float64 literal
 * comes back as its float32 rounding and the palette entries are 6e-3 apart at
 * the closest — `HULL` against `HOUSE`, which are meant to be the same paint.
 *
 * `uv` and not a new attribute, and that is not laziness either. `solidVertex`
 * already declares `attribute vec2 uv`, already carries it to `vUv`, and
 * three.js supplies (0, 0) for every geometry that has not got one — so the
 * quay, the mole fittings and the mooring lines, which share this material,
 * come out of the branch above without a line of code. A new attribute would
 * have to be declared through `opts.decl`, and `decl` is spliced into the
 * FRAGMENT shader as well, where `attribute` does not exist.
 *
 * The depth is `brodSheer` at the vertex's own x, which is the same clamped
 * interpolation the loft, the fenders and the mooring all read, in built
 * metres — so the field lies along her sheer, and the paint under the bow is
 * the paint under the bow and not the paint at some horizontal height.
 */
function brodPaint(g, pal) {
  const pos = g.getAttribute('position').array;
  const col = g.getAttribute('aVCol').array;
  const n = pos.length / 3;
  const uv = new Float32Array(n * 2);
  const KEY = [[pal.HULL, 1], [pal.SHEER, 2], [pal.COVE, 3],
    [pal.HOUSE, 4], [pal.BOOT, 5]];
  for (let i = 0; i < n; i++) {
    const r = col[i * 3], gr = col[i * 3 + 1], bl = col[i * 3 + 2];
    let k = 0;
    for (let j = 0; j < KEY.length; j++) {
      const c = KEY[j][0];
      if (Math.abs(r - c[0]) < 2e-4 && Math.abs(gr - c[1]) < 2e-4
        && Math.abs(bl - c[2]) < 2e-4) { k = KEY[j][1]; break; }
    }
    uv[i * 2] = k;
    uv[i * 2 + 1] = k ? brodSheer(pos[i * 3])[0] - pos[i * 3 + 1] : 0;
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/**
 * Hand the game's own body to the boat, past the name that is in the way.
 *
 * `you` inside `buildBrod` is HER passenger — a local `{ x, z, yaw, pitch,
 * deck }` in the boat's frame, and it has been called that since the mode was
 * written. `you` at module scope is 49-you.js's figure, the one B has been
 * showing you on the promenade and in the water since 1.29x. They are two
 * different objects with one name and the inner one wins everywhere inside
 * that closure, so the boat cannot reach the figure at all.
 *
 * Three lines out here rather than renaming thirty references in there. It is
 * also the honest shape: this is the ONE thing about the third person on her
 * deck that is not the boat's business, and it is the only line in this file
 * that knows 49-you.js exists.
 *
 * Safe to call before boot for the same reason every other deferred reader of
 * a module-scope `let` is: the binding is initialised when 90-app.js's top
 * level runs, and nothing here runs before a frame.
 */
function brodDriveYou(o) {
  if (you) you.drive(o);
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
  // The face of a step in the sole, which never sees the sky. 0.78 of `DECK`,
  // written out rather than shaded: `shade` is 43-jadrija.js's and is a
  // closure-local helper there, so every tone step in this file is inline —
  // the funnel casing's four values are the same thing at more length.
  const RISER = [0.437, 0.367, 0.275];
  // The boot-top's drop under the deck edge and its half-depth, up here rather
  // than beside the loop that draws it because the transom carries the same
  // stripe round the stern and is built four hundred lines earlier. A `const`
  // below its reader is BUILD DID NOT FINISH at some percentage, not an
  // exception — this file has been bitten by it. Measured off the mural; see
  // the note over the strip itself.
  const BTY = BROD_P(2.014), BTH = BROD_P(0.15);
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
  /**
   * TWO BANDS, AND THE THIRD ONE WAS A TRAP.
   *
   * This read `max(t0,t1) < 0.62 ? BOOT : (min(t0,t1) > 0.90 ? SHEER : HULL)`,
   * over a comment promising "the last strake before the gunwale in the dark
   * colour", and the second test **can never be true**. `tAt(j)` is
   * `|j − 6| / 6` at `NS = 7`, so the topmost band a side runs from t 1.0 to
   * t 0.8333 and its `min` is 0.8333. Both ends of the row, every station,
   * every scale she has ever been built at. The dark band you can see at her
   * gunwale is the BULWARK's outer face, three hundred lines down, which is
   * why nothing ever looked wrong.
   *
   * DELETED RATHER THAN REPAIRED, and that is a measurement and not a taste.
   * `murals/brod-mural.jpg` settles it: sampling the paint along her own gold
   * cove line, at 96 px a metre, the median luminance runs
   *
   *     0.90 m above the cove   0.113      0.20 m below   0.779
   *     0.50 m above            0.118      0.40 m below   0.756
   *     0.10 m above            0.248      0.80 m below   0.647
   *                                        1.20 m below   0.340  (the boot-top)
   *
   * — dark above the gold, white below it for eight hundred millimetres, then
   * the boot-top. Her one dark tin goes on the bulwark and on the stripe, and
   * the plating between them is white. Repairing the test would have painted
   * the top band of the loft dark, and at the widest station that band is
   * **1.58 m deep**: a metre and a half of navy hung under the cove, on a boat
   * whose reference photograph has none.
   *
   * So: antifouling under the chine, white above it, and nothing else. `SHEER`
   * is still the bulwark's and the boot-top's colour and stays declared.
   */
  for (let i = 0; i < G.length - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const A = G[i][j], B = G[i][j + 1], C = G[i + 1][j + 1], D = G[i + 1][j];
      const na = GN[i][j], nb = GN[i][j + 1], nc = GN[i + 1][j + 1], nd = GN[i + 1][j];
      const col = Math.max(tAt(j), tAt(j + 1)) < 0.62 ? BOOT : HULL;
      b.smooth(A, B, C, na, nb, nc, col, col, col);
      b.smooth(A, C, D, na, nc, nd, col, col, col);
    }
  }
  /**
   * The transom.
   *
   * **IT WAS WOUND FORWARD, so she had no stern at all.** Rule 8, and the
   * whole panel rather than one cap: the old fan ran
   * `tri(row[j + 1], row[j], c)` from the last station's thirteen points to a
   * centreline apex, and its normal works out at (+1.26, 0, 0) at BOTH ends of
   * the row — dead forward, into the boat. `G`'s rows run bow to stern, so the
   * row's order is the mirror of what a fan closing an after end wants;
   * `propBuilder.tri` takes the face off the winding and three.js culls the
   * back one.
   *
   * From anywhere astern of her you were therefore looking through a
   * six-metre hole into the boat, and what came through it — her far topside
   * seen from inboard, carrying the cove and the boot-top — read as a grey
   * blade hanging off her counter down into the water. It survived the fix to
   * `brodSheer` and that is how it got noticed: the two blades went and this
   * one did not. Found by painting the fan green and getting a frame back with
   * no green anywhere in it, which is the only symptom a culled face has.
   *
   * AND BANDS, NOT A FAN, now that it can be seen. The apex sat at y −0.10
   * with the keel at −0.62, so every triangle radiated from a point half a
   * metre above the bottom of the outline and the colour rule — one `tAt(j)`
   * per triangle — painted her stern in pie slices: a 1.5 m navy wedge from
   * the port sheer to the middle, nothing matching it to starboard, and the
   * antifouling as six spokes. A transom's paint runs in HORIZONTAL bands
   * because a waterline is horizontal.
   *
   * Six quads between the seven levels of the loft instead, port point to
   * starboard point across the whole width, with the keel closed by one
   * triangle. Same polygon, same seam with the plating — the colour rule is
   * the plating's own, `max(t) < 0.62`, so the boundary lands on the chine
   * exactly where the sides put it.
   *
   * With her two lines carried round it, which is the other half of what makes
   * a stern read as the same boat as the sides: the dark strake down from the
   * sheer and the boot-top, both standing 0.030 aft of the panel — 52 mm, the
   * bulwark's own standoff, well past rule 5's 3 mm — and both cut to the
   * outline by `tw` so neither hangs over the edge.
   */
  {
    const row = G[G.length - 1];
    const tX = row[0][0];
    // The half-beam of the transom outline at a height, off the outline's own
    // points rather than off `beamAt`: `beamAt` is a `const` declared three
    // hundred lines below this and reading it here is a temporal dead zone,
    // and chording the same polyline the panel is drawn from is what keeps a
    // stripe from overhanging the edge it is painted on.
    const tw = (y) => {
      for (let k = 0; k < NS - 1; k++) {
        const a = row[k], c = row[k + 1];
        if (y <= a[1] && y >= c[1]) {
          const u = (a[1] - y) / ((a[1] - c[1]) || 1);
          return Math.abs(a[2]) + (Math.abs(c[2]) - Math.abs(a[2])) * u;
        }
      }
      return Math.abs(row[0][2]);
    };
    // A band across her, port to starboard, wound aft. Checked rather than
    // guessed: with A and B the two ends of the LOW edge and C the starboard
    // end of the high one, (B−A) is 2w along +z and (C−A) climbs in y, so the
    // cross comes out along −x, which is astern.
    for (let k = 0; k < NS - 2; k++) {
      const col = Math.max(tAt(k), tAt(k + 1)) < 0.62 ? BOOT : HULL;
      b.quad(row[k + 1], row[N - 2 - k], row[N - 1 - k], row[k], col);
    }
    b.tri(row[NS - 2], row[NS - 1], row[NS], BOOT);
    // The strake and the boot-top, round the stern.
    const aft = tX - 0.030;
    const [, , , , tsy] = ST[ST.length - 1];
    const strip = (ylo, yhi, col) => {
      const wl = tw(ylo), wh = tw(yhi);
      b.quad([aft, ylo, -wl], [aft, ylo, wl], [aft, yhi, wh], [aft, yhi, -wh], col);
    };
    strip(tsy - 0.40, tsy, SHEER);
    strip(tsy - 0.50, tsy - 0.43, COVE);
    strip(tsy - BTY - BTH, tsy - BTY + BTH, SHEER);
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

  // AUTHORED, off `BROD_ST0`, for the same reason `ST` is: `brodSheer` answers
  // in built metres, which is what the deck logic wants and is exactly what
  // must not come in here. `brodStation` and `brodBeam` are the module-scope
  // pair — clamped, and clamped for the reason `brodSheer` is: an unclamped
  // copy of this is what DREW the blades off her counter.
  const sheerAt = (x) => { const s = brodStation(x); return [s[4], s[5]]; };
  const beamAt = brodBeam;

  /**
   * A four-sided bar between two arbitrary points — a rope, a lanyard, a stay.
   *
   * `frustum` cannot do this and `b.box` cannot either: both stack or span
   * axis-aligned boxes, so anything running mostly along the deck or mostly
   * athwart comes out as a slab a few millimetres tall and disappears. Built
   * off an arbitrary perpendicular basis instead, which is the only
   * construction that does not care which way the run points.
   *
   * BOTH WINDINGS, and for the reason the foredeck's guardrail wires give a
   * few lines further down: a 24 mm lanyard is nothing at all, you are as
   * often inboard of one as outboard, and on a closed tube a reversed winding
   * does not announce itself — the silhouette is identical and only the
   * shading is wrong. Eight quads a segment against four is not a price worth
   * arguing about for a member this thin.
   *
   * Coordinates go through `scaledBuilder` like everything else here, so `r`
   * is authored: put real millimetres through `BROD_P`.
   */
  const seg3 = (A, B, r, col, solid) => {
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2];
    const Ln = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / Ln, uy = dy / Ln, uz = dz / Ln;
    // Any vector not parallel to the run, then two crosses for the basis.
    const px = Math.abs(uy) > 0.9 ? 1 : 0, py = Math.abs(uy) > 0.9 ? 0 : 1;
    let ex = -uz * py, ey = uz * px, ez = ux * py - uy * px;
    const me = Math.hypot(ex, ey, ez) || 1;
    ex /= me; ey /= me; ez /= me;
    const fx2 = uy * ez - uz * ey, fy2 = uz * ex - ux * ez, fz2 = ux * ey - uy * ex;
    const o = (a, Q) => [Q[0] + (Math.cos(a) * ex + Math.sin(a) * fx2) * r,
      Q[1] + (Math.cos(a) * ey + Math.sin(a) * fy2) * r,
      Q[2] + (Math.cos(a) * ez + Math.sin(a) * fz2) * r];
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * TAU, a1 = ((i + 1) / 4) * TAU;
      const P0 = o(a0, A), P1 = o(a0, B), P2 = o(a1, B), P3 = o(a1, A);
      b.quad(P0, P3, P2, P1, col);
      // `solid` is for a member you can never be inside — an 88 mm pipe. A
      // lanyard is 36 mm and gets both, for the reason above.
      if (!solid) b.quad(P1, P2, P3, P0, col);
    }
  };

  // ── the deck and the bulwark ─────────────────────────────────────────────
  // The sheer curves and the sole does not; that is the whole difference
  // between a gunwale you look over and a floor you stand on. The sole steps up
  // twice going forward — cockpit, side deck, foredeck — which is what the
  // engine under the house and the chain locker under the foredeck do to it.
  const soleAt = (x) => (x > 4.30 ? 1.22 : (x > -1.35 ? 1.06 : 0.72));
  // ON THE HULL AND NOT PAST IT, both ends, and forty segments and not
  // twenty-six.
  //
  // The old range was 7.6 down to −8.2 while the loft runs 7.80 to −7.80: it
  // stopped 0.35 m short of the stem at one end and overshot the transom by
  // 0.70 m at the other, and the overshoot is what `brodSheer`'s note is
  // about. Ending ON the last station instead — a hair inside it at each end
  // so the cap never skims the transom fan, per rule 5.
  //
  // Twenty-six segments over 15.5 is 1.04 m of bulwark a segment, and her
  // sheer lifts 0.33 m in the last 1.2 m of the bow: the forward end of the
  // dark strake came out as a visible flight of four steps against the sky in
  // every bow-on frame. At forty it is 0.68 m a segment and the steps are
  // inside the width of the strake itself.
  //
  // AND THE BULWARK PLANKING STANDS OUTSIDE THE TOPSIDE PLANKING, which is
  // both true of a wooden boat and the fix for the thing that made the strake
  // look chewed. The outer face was drawn at z = `w0` — the sheer's own
  // half-beam, which is exactly where the loft puts its topmost row of
  // plating. The two shared that edge to the millimetre, and just under it the
  // hull falls away on its flare so slowly that the plating and the flat face
  // stay within a centimetre of each other for the top fifth of the strake.
  // What came off the render was a row of clean pale wedges bitten out of the
  // top of the dark band, four of them in every bow-on frame, worst where the
  // sheer rises fastest — and they moved when `NX` changed, which is what said
  // it was a coincidence and not geometry. 0.030 authored is 52 mm built,
  // which is a bulwark plank, and the wedges are gone.
  //
  // The cove three blocks down had this problem solved in its own comment —
  // "standing 12 mm off the topside so it never z-fights the hull it is
  // painted on" — and the bulwark, which is not painted on the hull but bolted
  // to it, never got the same treatment.
  const BSTAND = 0.030;
  {
    const NX = 40;
    const XF = 7.76, XA = -7.78;
    let pSy = null;                         // the sole one segment aft, for the steps
    for (let i = 0; i < NX; i++) {
      const x0 = XF + (XA - XF) * (i / NX);
      const x1 = XF + (XA - XF) * ((i + 1) / NX);
      const [y0, w0] = sheerAt(x0), [y1, w1] = sheerAt(x1);
      const o0 = w0 + BSTAND, o1 = w1 + BSTAND;
      const i0 = Math.max(0.02, w0 - 0.24), i1 = Math.max(0.02, w1 - 0.24);
      const sy = soleAt((x0 + x1) * 0.5);
      for (const s of [1, -1]) {
        // cap
        sideQuad(s, [x0, y0, s * o0], [x1, y1, s * o1],
          [x1, y1, s * i1], [x0, y0, s * i0], TRIM);
        // outer face, in the dark strake colour
        sideQuad(s, [x0, y0 - 0.40, s * o0], [x1, y1 - 0.40, s * o1],
          [x1, y1, s * o1], [x0, y0, s * o0], SHEER);
        // Inner face, painted out white like the rest of the inside — and
        // carried all the way down to the sole rather than a fixed 0.40, which
        // is what left a gap you could see the sea through once the sheer went
        // up and the sole did not follow it the same distance.
        sideQuad(s, [x1, y1, s * i1], [x1, sy, s * i1],
          [x0, sy, s * i0], [x0, y0, s * i0], HOUSE);
      }
      b.quad([x0, sy, -i0], [x1, sy, -i1], [x1, sy, i1], [x0, sy, i0], DECK);
      // ── AND A RISER AT EACH STEP IN THE SOLE ───────────────────────────────
      //
      // `soleAt` steps 0.34 authored at x 4.30 and again at −1.35 and NOTHING
      // CLOSED EITHER OF THEM. Every sole quad is horizontal, so where the
      // height changed between one segment and the next there was a 0.6 m
      // slot straight across her full beam with no face in it: standing in the
      // cockpit and looking forward past the companionway you saw a bright
      // cyan band of open sea running across her deck from bulwark to bulwark,
      // twice. It is the only hole in the boat and it is at eye level from the
      // one place every passenger stands.
      //
      // At the boundary and not at the midpoint: `sy` is sampled at the
      // segment's middle, so the height changes on the shared edge between
      // two segments and that edge is `x0`.
      //
      // Both windings. You are on the low side of a riser looking at its face
      // and on the high side looking down past its nose, and at 1.8 km from
      // the origin a step you can see under is the same failure as a step you
      // can see through. Two quads.
      if (pSy != null && sy !== pSy) {
        const lo = Math.min(sy, pSy), hi = Math.max(sy, pSy);
        const A = [x0, lo, -i0], B = [x0, lo, i0];
        const C = [x0, hi, i0], D = [x0, hi, -i0];
        b.quad(A, B, C, D, RISER);
        b.quad(D, C, B, A, RISER);
      }
      pSy = sy;
    }
    // The gold cove line: one 70 mm strip a side, standing 12 mm off the
    // topside so it never z-fights the hull it is painted on.
    //
    // TO THE STEM AND TO THE TRANSOM. It ran 7.3 to −7.9 — 0.9 m short of the
    // stemhead forward and 0.2 m past the transom aft — and both ends showed.
    // In `murals/brod-mural.jpg` the gold is the one line that carries the
    // whole sheer: it sweeps up and dies into the stemhead, and it is the last
    // thing still legible on her at the far end of the mole. Ours stopped in
    // the middle of the bow with nothing at its end, which reads as a stripe
    // somebody gave up painting.
    for (let i = 0; i < NX; i++) {
      const x0 = XF + (XA - XF) * (i / NX);
      const x1 = XF + (XA - XF) * ((i + 1) / NX);
      const [y0, w0] = sheerAt(x0), [y1, w1] = sheerAt(x1);
      for (const s of [1, -1]) {
        sideQuad(s, [x0, y0 - 0.50, s * (w0 + 0.012)], [x1, y1 - 0.50, s * (w1 + 0.012)],
          [x1, y1 - 0.43, s * (w1 + 0.012)], [x0, y0 - 0.43, s * (w0 + 0.012)], COVE);
      }
    }

    // ── AND THE BOOT-TOP, WHICH IS THE OTHER LINE ON HER ────────────────────
    //
    // Under the gold, the whole of her topside was one flat white plane from
    // the cove down through the water, and it read as a hull that had been
    // undercoated and never finished. Every hull in `1000150357` has a stripe
    // at the waterline and `murals/brod-mural.jpg` has a heavy one.
    //
    // Measured off the mural by running a vertical cut through the paint at
    // x 1600 and reading it band by band: white 1290 to 1375, dark 1378 to
    // 1397, and the gold's warm band centred on 1280. That is 107 px of
    // separation, and her hull is 2625 px stem to transom for 27.3 m of built
    // length, so 96 px a metre: the stripe's centre is **1.11 m below the
    // cove's** and it is 0.21 m deep. A second cut further aft gives 1.32 and
    // 0.43 — the mural is painted at an angle and the stripe converges on the
    // gold going aft — so 1.20 and 0.30 is the middle of it and that is what
    // is built.
    //
    // OFF THE SHEER AND NOT OFF THE WATERLINE. A boot-top follows the water,
    // but this one plainly does not: in the mural it runs parallel to the gold
    // and sweeps up with it into the bow, well clear of the sea. It is a
    // painted stripe on the topsides, so it goes on where the painter's eye
    // put it, which is a fixed drop under the cove.
    //
    // `SHEER` and not a third dark. She has one dark tin and it went on the
    // strake and on this, which is what these boats do and is why the two
    // read as the same boat rather than as two decisions.
    //
    // Standing off the hull on `beamAt` and NOT on the sheer's half-beam the
    // way the cove does. The cove sits 0.81 m under the deck edge where the
    // flare has barely started; this is 2.0 m under it, where she is 0.24 m
    // narrower, and hanging it off `w0` would have left a fin standing a
    // quarter of a metre off her side down her whole length.
    // `BTY` and `BTH` are declared with the colours at the top of this
    // function: the transom carries the same stripe round the stern and is
    // built long before this loop runs.
    for (let i = 0; i < NX; i++) {
      const x0 = XF + (XA - XF) * (i / NX);
      const x1 = XF + (XA - XF) * ((i + 1) / NX);
      const [y0] = sheerAt(x0), [y1] = sheerAt(x1);
      const a0 = y0 - BTY - BTH, a1 = y1 - BTY - BTH;
      const c0 = y0 - BTY + BTH, c1 = y1 - BTY + BTH;
      // Both edges sampled at their own height, so the strip lies along the
      // section instead of chording it. Over 0.30 m of depth the chord error
      // is 1.2 mm, which is inside the 21 mm it stands proud by anyway — but
      // the top edge and the bottom edge are 0.05 m apart in beam here and
      // that much a flat quad would show.
      // 0.030 and not the cove's 0.012, for the reason the bulwark's own
      // standoff is 0.030: `beamAt` inverts the loft ANALYTICALLY and the
      // plating chords it, in both directions at once — across the section
      // between two of the seven points a side, and along her between two of
      // the nine stations. The two disagree by up to 11 mm authored, so a
      // 12 mm standoff leaves one segment in ten of this strip inside the
      // plating and bitten out. Measured, once the strake was fixed and one
      // notch was left: 52 mm built clears it everywhere.
      for (const s of [1, -1]) {
        sideQuad(s,
          [x0, a0, s * (beamAt(x0, a0) + 0.030)], [x1, a1, s * (beamAt(x1, a1) + 0.030)],
          [x1, c1, s * (beamAt(x1, c1) + 0.030)], [x0, c0, s * (beamAt(x0, c0) + 0.030)],
          SHEER);
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
  // 2.10 m of headroom and not 3.40. See `BROD_P`: the length and the width of
  // this box are proportions of the hull and grow with her, and its HEIGHT is
  // a room's and does not.
  b.box(1.475, BROD_DK + BROD_HT * 0.5, 0, 5.65, BROD_HT, 2.20, HOUSE, HOUSE);
  b.box(3.75, BROD_DK + BROD_HT - BROD_P(1.60) * 0.5, 0, 1.10, BROD_P(1.60),
    1.90, HOUSE, HOUSE);
  {
    // A saloon light 0.75 m deep with its sill at chest height, which is what
    // the mural has and what you can see out of sitting down.
    const y = BROD_DK + BROD_P(1.30);
    for (let i = 0; i < 7; i++) {
      const x = -0.85 + i * 0.79;
      for (const s of [1, -1]) {
        b.box(x, y, s * 1.115, 0.52, BROD_P(0.75), 0.03, GLASS);
      }
    }
    for (let i = -1; i <= 1; i++) {
      b.box(4.31, BROD_DK + BROD_P(1.42), i * 0.60, 0.03, BROD_P(0.80), 0.52,
        GLASS);
    }
    // The door into the house, on the port side aft, standing open. Two metres,
    // not the three the uniform scale had made of it.
    b.box(-1.37, BROD_DK + BROD_P(1.00), -0.56, 0.04, BROD_P(2.00), 0.70, DARK);
  }
  // The roof: a flat deck with a coaming, and the boat's one piece of shade.
  // Everybody on every boat in the survey sits under this.
  b.box(1.475, BROD_ROOF - BROD_P(0.05), 0, 5.95, BROD_P(0.10), 2.46,
    HOUSE, HOUSE);
  b.box(3.75, BROD_ROOF - BROD_P(0.05), 0, 1.20, BROD_P(0.10), 2.10,
    HOUSE, HOUSE);

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
    const y0 = BROD_ROOF;                    // the roof's top face
    const X0 = -1.44, X1 = 4.39, Z = 1.19;   // just inboard of the roof edge
    const NS2 = 9;
    for (let i = 0; i <= NS2; i++) {
      const x = X0 + (X1 - X0) * (i / NS2);
      for (const s of [1, -1]) {
        b.box(x, y0 + BROD_P(0.50), s * Z, 0.05, BROD_P(1.00), 0.05, RAIL);
      }
    }
    // The two rails, and the transverse pair that closes the after end. The
    // forward end is open on to the wheelhouse roof, which is where the
    // skipper's ladder comes up and where nobody stands.
    for (const h of [BROD_P(0.42), BROD_P(0.90)]) {
      for (const s of [1, -1]) {
        b.box((X0 + X1) * 0.5, y0 + h, s * Z, X1 - X0, 0.045, 0.045, RAIL);
      }
      b.box(X0, y0 + h, 0, 0.045, 0.045, Z * 2, RAIL);
    }
    // A bench down each side, backs to the rail, which is how they are on
    // every one of these. The seat is 0.45 m off the deck and 0.44 across, so
    // a person on it sits with their knees inboard and their back to the sea —
    // see `BROD_BENCH`, which is where both of those numbers now live.
    const RB = BROD_BENCH.roof;
    for (const s of [1, -1]) {
      // A bench: seat 0.45 m up, back to 0.90. At the uniform scale these came
      // out at 0.74 and 1.45 and from the upper deck they read as two brown
      // walls with the sea behind them.
      b.box(RB.x, y0 + BROD_SEAT, s * RB.z, RB.len, BROD_SEATT, RB.d, TRIM);
      b.box(RB.x, y0 + BROD_P(0.22), s * 1.12, RB.len, BROD_P(0.45), 0.06, TRIM);
      b.box(RB.x, y0 + BROD_P(0.68), s * 1.13, RB.len, BROD_P(0.45), 0.05, TRIM);
    }
  }

  // ── the companionway ─────────────────────────────────────────────────────
  // The way up, and the reason the upper deck is a place rather than scenery.
  // Misha: *"once i board it, i should be able to walk around it freely, go up
  // and down"*. It stands up the middle of the cockpit against the after face
  // of the house, and it matches `BROD.decks`' stair band exactly — 0.72 to
  // 3.10 over x -4.20 to -1.50, which is 2.38 m of rise on 2.70 of run.
  //
  // A LADDER FIRST, and it was wrong for a reason worth keeping. Five rungs
  // against the house is what a crew uses and it is what the first cut of the
  // upper deck had; a boat that carries eighty people in swimwear has a STAIR,
  // because eighty people includes somebody's grandmother. It is also the only
  // shape the deck model can carry without a second level: a stair is a band
  // whose sole runs, and a ladder is a teleport.
  {
    const X0 = -4.20, X1 = -1.50, Y0 = BROD_WELL, Y1 = BROD_ROOF;
    // Fifteen treads and not eight. The rise is 2.80 m built over 4.72 of run,
    // which is 31 degrees — a stair somebody's grandmother goes up. At the
    // uniform scale the same flight was a 4.16 m climb in eight treads of
    // 0.52 each, which is not a stair, it is a wall with notches in it.
    const N = Math.max(4, Math.round((Y1 - Y0) * BROD_K / 0.19));
    const go = (X1 - X0) / N, rise = (Y1 - Y0) / N;
    for (let i = 0; i < N; i++) {
      // The tread's top face is the sole `deckAt` hands you at its middle, so
      // your feet are on the tread and not in it.
      const x = X0 + (i + 0.5) * go;
      b.box(x, Y0 + (i + 0.5) * rise - BROD_P(0.025), 0, go * 1.02,
        BROD_P(0.05), 1.00, TRIM);
    }
    // The stringers, as quads because a raked plate is not a box. Both
    // windings, like the foredeck's wires and for the same reason: you are as
    // often inboard of one of these as outboard.
    for (const sg of [1, -1]) {
      const z = sg * 0.52;
      const A = [X0, Y0 - BROD_P(0.06), z], B = [X1, Y1 - BROD_P(0.06), z];
      const C = [X1, Y1 - BROD_P(0.34), z], D = [X0, Y0 - BROD_P(0.34), z];
      b.quad(A, B, C, D, TRIM);
      b.quad(D, C, B, A, TRIM);
      // And the handrail over it, 0.95 m above the nosings, on four posts.
      for (let i = 0; i <= 3; i++) {
        const u = i / 3;
        const x = X0 + (X1 - X0) * u, y = Y0 + (Y1 - Y0) * u;
        b.box(x, y + BROD_P(0.48), z, 0.06, BROD_P(0.95), 0.06, RAIL);
      }
      const P0 = [X0, Y0 + BROD_P(0.95), z], Q = [X1, Y1 + BROD_P(0.95), z];
      const R = [X1, Y1 + BROD_P(0.905), z], S2 = [X0, Y0 + BROD_P(0.905), z];
      b.quad(P0, Q, R, S2, RAIL);
      b.quad(S2, R, Q, P0, RAIL);
    }
  }


  // ── the rails ────────────────────────────────────────────────────────────
  // Pipe stanchions and two rails round the foredeck only. Aft the bulwark is
  // the rail, which is why you can sit on it.
  //
  // AND IT CLOSES AT THE STEMHEAD, which it did not. The run ended at x 7.3
  // with the stem at 7.80, so the last stanchion stood three quarters of a
  // metre short of the bow and the two rails simply stopped in the air with
  // nothing at their ends and a gap between them you could have walked out of.
  //
  // `murals/brod-mural.jpg` is unambiguous about what belongs there and it is
  // the one part of her the mural shows square-on: the rail runs forward, ends
  // in a **vertical post at the stemhead**, and a **diagonal stay** comes back
  // off the head of that post down to the deck edge. Measured on the frame —
  // the crop at +2950+1020, at the mural's 96 px a metre — the stay's head is
  // 0.25 m abaft the stem and its foot 1.96 m abaft it, which is authored 7.66
  // and 6.68. The rail height reads 0.94 m over the gold two metres aft of the
  // stem, so `BROD_P(1.00)` was already right and is unchanged.
  //
  // Rails as `seg3` and PER SPAN. They were one straight quad from 4.7 to 7.3
  // while her sheer lifts 0.37 authored over that run, so the rail was a chord
  // and the middle stanchions did not reach it — there was daylight between a
  // stanchion top and the rail it was supposed to be holding up. Per span it
  // follows the sheer through every stanchion. `solid`, because an 88 mm pipe
  // is a thing you are never inside.
  {
    const NST = 8;
    const X0 = 4.7, X1 = 7.62;                 // last stanchion, just off the stem
    const XS = 7.74;                           // and the stemhead post itself
    const RH = [BROD_P(0.36), BROD_P(0.72)];
    const RR = 0.025;                          // 88 mm pipe, as the stanchions are
    const at = (x) => { const [y, w] = sheerAt(x); return [y, w - 0.12]; };
    for (let i = 0; i <= NST; i++) {
      const x = X0 + (X1 - X0) * (i / NST);
      const [y, w] = at(x);
      // A guardrail is 1.00 m over the deck, not 1.40. `BROD_P` again.
      for (const s of [1, -1]) {
        b.box(x, y + BROD_P(0.50), s * w, 0.05, BROD_P(1.00), 0.05, RAIL);
      }
    }
    const [ysm] = at(XS);
    b.box(XS, ysm + BROD_P(0.50), 0, 0.05, BROD_P(1.00), 0.05, RAIL);
    for (const h of RH) {
      for (const s of [1, -1]) {
        for (let i = 0; i < NST; i++) {
          const xa = X0 + (X1 - X0) * (i / NST);
          const xb = X0 + (X1 - X0) * ((i + 1) / NST);
          const [ya, wa] = at(xa), [yb, wb] = at(xb);
          seg3([xa, ya + h, s * wa], [xb, yb + h, s * wb], RR, RAIL, true);
        }
        // In to the post. Both sides meet on the centreline at the stem, which
        // is what makes it a rail rather than two rails.
        const [ye, we] = at(X1);
        seg3([X1, ye + h, s * we], [XS, ysm + h, 0], RR, RAIL, true);
      }
    }
    // The stay. `seg3` and not `frustum` per rule 9: this member falls 0.76
    // authored while running 1.06 aft and 0.67 outboard, and a stack of
    // axis-aligned rectangles is three flat slabs a few millimetres tall.
    {
      const [yf, wf] = at(6.68);
      for (const s of [1, -1]) {
        seg3([XS, ysm + BROD_P(1.00), 0], [6.68, yf + 0.04, s * wf], RR, RAIL, true);
      }
    }
  }

  // ── the fittings ─────────────────────────────────────────────────────────
  // A mast forward of the house with the ensign at its head, a stub exhaust out
  // of the port quarter of the roof, and benches down both sides of the
  // cockpit. The ensign is a flat panel and not cloth, because the only thing
  // that reads from the far side of a fifteen-metre deck is red-white-blue.
  b.box(4.44, 1.06 + 2.90, 0, 0.14, 3.90, 0.14, TRIM);

  // ── the funnel casing, and what was there instead ────────────────────────
  //
  // A 0.28 by 0.28 black post 1.16 m tall, standing in the middle of the
  // passenger deck with nothing at its base and no cap on it. Ridden the whole
  // nine and a half minutes to Sibenik and photographed at four points along
  // it, that post is a black slab hanging in the same place in every frame — it
  // silhouettes against the sky and it is the loudest thing on her.
  //
  // `1000150392` says what belongs there. The mural on the kabine end wall is
  // still the best picture of this boat in the whole survey and it has, plainly
  // and at the aft end of her upper deck, a **dark oxblood casing** with the
  // lifebuoys hung on its face. Sampled off the frame at three points the paint
  // runs R:G:B 1.59 : 1.00 : 1.04 against a hull white of 84 in the same light,
  // which is oxblood and not brown and not black.
  //
  // Forward rather than aft, and that is the one departure. In the mural she
  // carries it over the engine, which on her is amidships; on this hull the
  // stair comes up at the after end of the roof and a casing there would be a
  // wall across the head of the flight. So it stands at the forward end where
  // the wheelhouse roof begins, and `BROD.decks`' upper band is shortened to
  // meet it — see the note there. You walk up to it, not through it.
  // `shade` is 43-jadrija's, not this file's — these are its three steps
  // written out. Caught by a probe and not by the build: `node --check` passes
  // an undefined identifier happily and what you get is BUILD DID NOT FINISH
  // at 70 %, which is the same silent shape as a temporal dead zone.
  const CASE = [0.430, 0.270, 0.281];
  const CASE_LIT = [0.482, 0.302, 0.315];
  const CASE_MID = [0.370, 0.232, 0.242];
  const CASE_DK = [0.310, 0.194, 0.202];
  {
    const y0c = BROD_ROOF;
    b.box(3.86, y0c + 0.46, 0, 0.88, 0.92, 1.16, CASE, CASE_LIT);
    // The lip round the top of it, which is what stops a painted box reading
    // as a painted box: every casing on every one of these has a rolled edge.
    b.box(3.86, y0c + 0.94, 0, 0.98, 0.08, 1.26, CASE_DK, CASE_MID);
    // And the exhaust out of the top of it — round, capped, and standing to
    // port of centre the way the old stub did, because that part was right.
    // Eight sides: a pipe 0.26 m across is four pixels at the distance anybody
    // on this deck is from it, and the cap is the only part with a silhouette.
    {
      const ex = 3.60, ez = -0.34;
      const ring = (y, r) => {
        const o = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          o.push([ex + Math.cos(a) * r, y, ez + Math.sin(a) * r]);
        }
        return o;
      };
      const P = [ring(y0c + 0.96, 0.075), ring(y0c + 1.56, 0.075),
        ring(y0c + 1.58, 0.115), ring(y0c + 1.64, 0.104)];
      for (let k = 0; k < 3; k++) {
        for (let i = 0; i < 8; i++) {
          const j = (i + 1) % 8;
          b.quad(P[k][i], P[k][j], P[k + 1][j], P[k + 1][i],
            k === 1 ? [0.225, 0.231, 0.244] : DARK);
        }
      }
      const top = P[3];
      for (let i = 1; i < 7; i++) b.tri(top[0], top[i], top[i + 1], [0.05, 0.05, 0.055]);
    }
  }
  // TWO benches in the cockpit, outboard against the bulwark, and the middle
  // of the well left clear. 1.232.0 put an inboard pair down the centre of it
  // and they had to come out again the moment the upper deck became somewhere
  // you could go: the companionway stands exactly there, and a stair through a
  // bench is worse than a bench short. The places the inboard pair was worth
  // are on the roof now, where they can be seen from the pier anyway.
  {
    const WB = BROD_BENCH.well;
    for (const s of [1, -1]) {
      b.box(WB.x, WB.y + BROD_SEAT, s * WB.z, WB.len, BROD_SEATT, WB.d, TRIM);
      b.box(WB.x, WB.y + BROD_P(0.22), s * 1.66, WB.len, BROD_P(0.45),
        0.06, TRIM);
    }
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

  // ── the mooring cleats ────────────────────────────────────────────────────
  //
  // See `brodCleatAt`. Four of them, two a side, standing on the capping: a
  // bedplate, two feet and a horn bar across the top, which is the whole of a
  // cleat at the size a 0.40 m one is on a boat you are two metres from.
  //
  // GALVANISED AND NOT VARNISHED. Every fitting on her that is not structure
  // is `TRIM`, which is mahogany, and a mahogany cleat on a working ferry is a
  // yacht's fitting: what is on these boats is hot-dip galvanised steel that
  // has gone the colour of the sky. Same value as the raft's mooring irons in
  // `moor`, deliberately — they are the same ironmongery from the same yard.
  {
    const GALV = [0.430, 0.438, 0.446];
    const GDK = [0.352, 0.360, 0.368];
    for (const cx of BROD_CLEAT) {
      const [, cy, cz] = brodCleatAt(cx);
      for (const s of [1, -1]) {
        const z = s * cz;
        // The bedplate, and it is SUNK 15 mm rather than laid on. `cy` is the
        // top of the horn and `brodCleatAt` puts it BROD_P(0.17) over the cap,
        // so a 40 mm plate under it lands its own underside exactly on the
        // cap's top quad — two coplanar faces, which is rule 5 and which on a
        // pale grey plate over a brown capping is a flicker you see from the
        // whole length of the mole. 60 mm thick with its bottom bedded into
        // the timber: the plate is a plate, and nothing is coincident.
        b.box(cx, cy - BROD_P(0.155), z, BROD_P(0.34), BROD_P(0.06),
          BROD_P(0.13), GDK, GALV);
        for (const dx of [-BROD_P(0.11), BROD_P(0.11)]) {
          b.box(cx + dx, cy - BROD_P(0.085), z, BROD_P(0.07), BROD_P(0.09),
            BROD_P(0.08), GALV, GALV);
        }
        b.box(cx, cy - BROD_P(0.025), z, BROD_P(0.42), BROD_P(0.05),
          BROD_P(0.075), GALV, GALV);
      }
    }
  }

  // ── the tyre fenders ──────────────────────────────────────────────────────
  //
  // The loudest thing `murals/brod-mural.jpg` has that she did not, and the
  // one you are nearest to: she lies port-to against a mole that carries a
  // squared rubbing baulk, a mushroom bollard, a stainless bitt with rope on
  // it and a fender of its own — and her side, a metre and a half off it, was
  // one unbroken plane of white paint with nothing hanging on it at all. Every
  // working boat on this coast wears old lorry tyres lashed along the topsides
  // and leaves them there under way, because the next quay is never the one
  // you planned for.
  //
  // MEASURED, not assumed. In the mural her hull runs 2625 px stem to transom,
  // which against 27.3 m of built length is 96 px a metre, and three tyres are
  // plain on her starboard side at 2.9, 6.9 and 10.8 m forward of the transom.
  // Those are the three aft ones below, converted straight through: authored
  // x −6.14, −3.86, −1.63.
  //
  // The plants in front of the wall hide her forward half, so the two forward
  // of those are NOT read off the frame and are not a continuation of a
  // pattern either — rule 10. They are at the shoulder, which is where a hull
  // this shape bears on a straight quay when the stern is already fended, and
  // they are placed to clear the boarding gate (authored x −0.19 to 1.39)
  // rather than to fall on a spacing. The five gaps come out 4.0, 3.9, 6.9 and
  // 3.7 m, which is what a boat's fenders look like.
  //
  // BOTH SIDES. The mural shows her starboard side — bow to the right means
  // the near side is starboard — and she berths port-to here; a boat that has
  // been photographed with them to starboard and moors with her port side to
  // the coping carries them both sides, which is also what the marina in
  // `1000150357` shows on every hull in it.
  //
  // 0.98 m across the tyre and 0.22 through the tread, which is a lorry tyre
  // and not a car's, and both go through `BROD_P`: a tyre is a real object
  // that does not know how big the boat is. In the mural one measures 89 px,
  // which is 0.93 m — right at the top of the range, and these are the big
  // ones off a truck.
  //
  // Colour off the frame as a ratio, per rule 11, because the mural is flat
  // overcast light and nothing in it can be read as an absolute: the tyre body
  // samples (136, 141, 137) against hull white (183, 188, 180) 60 px above it
  // in the same paint, which is 0.74 : 0.75 : 0.76 — flat, neutral, and
  // nothing like black. A tyre that has spent fifteen years in Dalmatian sun
  // and been painted over with the topside white more than once goes exactly
  // that pale grey. 0.74 of `HULL`.
  const TYRE = [0.669, 0.666, 0.650];
  const LASH = [0.640, 0.618, 0.560];       // sun-bleached three-strand
  //
  // THE STATIONS AND THE SIZES ARE MODULE SCOPE NOW — `BROD_FEND` and the
  // three constants beside it. `moor` has to know how far out these reach to
  // know where she lies, and a berth measured off a copy of this table is a
  // berth that goes wrong the day somebody moves one fender.
  {
    const RR = BROD_FEND_RR;                // ring centreline radius
    const rr = BROD_FEND_RR2;               // and half the tread's thickness
    // 1.42 m below the deck edge, which is set by two things at once. The
    // mural hangs them 1.20 m down; the mole's rubbing baulk lies at built y
    // 1.12 to 1.32 and a fender that does not cover the baulk is decoration.
    // At 1.42 the tyre spans built 0.68 to 1.66 and covers it with a third of
    // itself either side. It also puts the top of the tyre 55 mm under the
    // gold cove rather than through it — rule 5's neighbourhood, though a
    // torus crossing a 70 mm strip would be an interpenetration and not a
    // skim.
    const DROP = BROD_FEND_DROP;
    for (const fx of BROD_FEND) {
      const [sy, sw] = sheerAt(fx);
      const cy = sy - DROP;
      // Off the beam at the tyre's TOP and not at the sheer. She carries 0.35 m
      // of flare here, so the sheer's half-beam would hang the whole tyre a
      // third of a metre clear of the paint; the chine's would bury it. Taking
      // the widest point the tyre spans and standing 52 mm off that leaves the
      // top just touching and the bottom 0.23 m out, which is how a fender on
      // one lanyard actually hangs against a flared topside.
      const zc = beamAt(fx, cy + RR + rr) + rr + BROD_FEND_OFF;
      for (const s of [1, -1]) {
        const cz = s * zc;
        const NM = 12, NN = 6;
        // A torus in her fore-and-aft plane, so the ring's axis is athwart and
        // no arbitrary basis is needed: the major circle lies in x/y and the
        // minor sweep is the only thing that touches z.
        const pt2 = (i, j) => {
          const th = (i % NM) / NM * TAU, ph = (j % NN) / NN * TAU;
          const cr = RR + rr * Math.cos(ph);
          return [fx + cr * Math.cos(th), cy + cr * Math.sin(th),
            cz + s * rr * Math.sin(ph)];
        };
        // Exact, because a torus knows its own normal: radially out in the
        // ring's plane, rolled by the minor angle. `smooth` takes them, so a
        // twelve-by-six ring shades round instead of faceted at the two metres
        // you stand from it on the coping.
        const nm2 = (i, j) => {
          const th = (i % NM) / NM * TAU, ph = (j % NN) / NN * TAU;
          return [Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th),
            s * Math.sin(ph)];
        };
        for (let i = 0; i < NM; i++) {
          for (let j = 0; j < NN; j++) {
            const A = pt2(i, j), B = pt2(i + 1, j);
            const C = pt2(i + 1, j + 1), D = pt2(i, j + 1);
            const na = nm2(i, j), nb = nm2(i + 1, j);
            const nc = nm2(i + 1, j + 1), nd = nm2(i, j + 1);
            // The starboard winding puts (∂θ × ∂φ) outwards, which is what
            // `propBuilder.tri` reads the face off. The port copy is that
            // mirrored in z and **a mirror reverses winding** — the same trap
            // `sideQuad` above exists for, and on a closed ring it does not
            // announce itself: an inside-out torus has an identical
            // silhouette and only its shading is wrong, lit from the far side.
            if (s > 0) {
              b.smooth(A, B, C, na, nb, nc, TYRE, TYRE, TYRE);
              b.smooth(A, C, D, na, nc, nd, TYRE, TYRE, TYRE);
            } else {
              b.smooth(C, B, A, nc, nb, na, TYRE, TYRE, TYRE);
              b.smooth(D, C, A, nd, nc, na, TYRE, TYRE, TYRE);
            }
          }
        }
        // The lanyard, up over the cap rail. In the mural these lean forward
        // about 30 degrees from the vertical, which is what a rope made off at
        // the rail and a tyre that has swung aft under way looks like: 0.53 m
        // of run over 0.93 of rise, and that is the angle.
        //
        // 36 mm and not 24. At 24 the first cut came back off the render as a
        // hairline you had to be told was there — in the mural the lanyard is
        // as legible as the tyre it holds, because it is a doubled line and
        // because it crosses the white where the tyre does not. A fender
        // pendant on a boat this size is 18 mm doubled, which is this.
        seg3([fx, cy + RR + rr - 0.02, cz],
          [fx + 0.30, sy + 0.05, s * (sw - 0.02)], BROD_P(0.018), LASH);
      }
    }
  }

  // ── the ship's boat, in davits off the starboard quarter ─────────────────
  //
  // `1000150392` again, and at the stern end of the mural it is unmistakable:
  // a white clinker boat sitting up above the rail with a pair of thin curved
  // posts either side of it. That is a tender in davits and it is the one thing
  // on her silhouette that says WORKING BOAT rather than pleasure craft — every
  // Dalmatian passenger boat of this size carries one and none of them carries
  // it anywhere you can walk.
  //
  // Which is also why it goes here rather than on the roof where the mural has
  // it. Slung outboard over the water it costs no deck at all: the upper deck's
  // limit is 1.10 and her sheer is well outside that, so nothing about
  // `deckAt` has to know this exists.
  //
  // Starboard, because port is the side she lies alongside and a boat in davits
  // over the pier is a boat nobody could have got off.
  {
    const TX = -2.40;                       // her middle, on the quarter
    const [ys, ws] = sheerAt(TX);
    const TZ = ws + 0.62;                   // hung clear of the topsides
    const KEEL = ys + 0.28;                 // and up above the rail
    // 1.85 and not 1.05. A ship's boat on a twenty-seven-metre passenger boat
    // is three and a half metres, which is 1.85 authored — the first cut was
    // half that and photographed from above it read as a white sliver under the
    // davits rather than as a boat somebody could get into.
    const L = 1.85, BW = 0.52;
    // The hull: five stations of a half-section, mirrored, so she has a stem, a
    // sheer and some deadrise rather than being a slipper.
    const ST2 = [[-L, 0.10, 0.12], [-L * 0.55, -0.10, 0.42],
      [0, -0.15, 0.52], [L * 0.58, -0.10, 0.41], [L, 0.13, 0.10]];
    const WH = [0.865, 0.858, 0.836];
    const WD = [0.700, 0.688, 0.658];
    for (let i = 0; i < ST2.length - 1; i++) {
      const [x0, k0, w0] = ST2[i], [x1, k1, w1] = ST2[i + 1];
      for (const sg of [1, -1]) {
        // topside
        b.quad([TX + x0, KEEL + 0.34, TZ + sg * w0],
          [TX + x1, KEEL + 0.34, TZ + sg * w1],
          [TX + x1, KEEL + k1, TZ + sg * w1 * 0.42],
          [TX + x0, KEEL + k0, TZ + sg * w0 * 0.42], WH);
        // and the bottom, which you see because she is hanging over your head
        b.quad([TX + x0, KEEL + k0, TZ + sg * w0 * 0.42],
          [TX + x1, KEEL + k1, TZ + sg * w1 * 0.42],
          [TX + x1, KEEL + k1 - 0.03, TZ],
          [TX + x0, KEEL + k0 - 0.03, TZ], WD);
      }
    }
    // The gunwale, one strip a side, and two thwarts across her.
    for (const sg of [1, -1]) {
      for (let i = 0; i < ST2.length - 1; i++) {
        const [x0, , w0] = ST2[i], [x1, , w1] = ST2[i + 1];
        b.quad([TX + x0, KEEL + 0.34, TZ + sg * w0],
          [TX + x1, KEEL + 0.34, TZ + sg * w1],
          [TX + x1, KEEL + 0.30, TZ + sg * w1 * 0.97],
          [TX + x0, KEEL + 0.30, TZ + sg * w0 * 0.97], TRIM);
      }
    }
    for (const dx of [-0.34, 0.36]) {
      b.box(TX + dx, KEEL + 0.28, TZ, 0.10, 0.045, BW * 1.7, TRIM);
    }
    // The davits. Two, raked out over the water, with the fall from each head
    // down to her stem and stern — which is the detail that says she is HUNG
    // and not sitting on a shelf.
    for (const dx of [-L * 0.66, L * 0.68]) {
      const bx = TX + dx;
      b.box(bx, ys + 0.30, ws - 0.10, 0.11, 1.28, 0.11, RAIL);
      b.box(bx, ys + 0.92, (ws + TZ) * 0.5 - 0.05, 0.11, 0.11,
        TZ - ws + 0.34, RAIL);
      b.box(bx, ys + 0.70, TZ, 0.05, 0.44, 0.05, [0.780, 0.770, 0.730]);
    }
  }

  // Two lifebuoys, lashed to the after rail of the upper deck where they can
  // be reached. 0.42 across and not 0.62: a lifebuoy is 0.75 m outside and
  // this table is authored at 1/1.75 of built, so the first cut put two
  // metre-and-a-bit rings on the roof and they read as deck cargo.
  //
  // ON THE CASING, and that is `murals/brod-mural.jpg` rather than a
  // preference. That file is a square-on photograph of the whole mural in flat
  // light — the pan frame this boat was read from is a hand-held pass at an
  // angle in a low sun — and it settles three things at once: the casing is
  // oxblood, there is a ship's boat in davits at the stern, and **the two
  // lifebuoys hang on the casing's face**, side by side, not on a rail.
  //
  // Which is also where they belong. A lifebuoy goes where somebody can reach
  // it without leaving the deck, and the casing is the one vertical surface on
  // the upper deck that everybody walks past.
  for (const s of [1, -1]) {
    b.box(3.37, BROD_ROOF + 0.50, s * 0.30, 0.06, BROD_P(0.75),
      BROD_P(0.75), [0.760, 0.180, 0.090]);
    b.box(3.34, BROD_ROOF + 0.50, s * 0.30, 0.06, BROD_P(0.40),
      BROD_P(0.40), CASE);
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
    // 2.15 m of headroom under the canvas, which is a person plus a hat.
    const yS = BROD_WELL, yT = BROD_WELL + BROD_P(2.15);
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
    // TWO PANELS AND A SLOT UP THE MIDDLE, which is not a flourish — the
    // companionway comes up through here. The stair's sole passes 2.86 m at
    // x -1.77 and a person on it wants two metres over their head, so an
    // unbroken canvas would have to stop at x -4.04 to clear them, which is
    // the whole awning. A stairwell in the shade deck is what a boat with a
    // centre companionway actually has, and it costs no seats.
    //
    // Cream and not white. At 0.88 it came back off the render as a lit
    // rectangle with no shading in it at all — canvas in full Dalmatian sun is
    // bright, but a face that clips is a face with no form, and from overhead
    // the awning is most of what you see of her.
    const SLOT = 0.66;                       // half the opening, clear of the
                                             // stair's own 0.52 stringers
    const cx = (XS[0] + XS[1]) * 0.5, cl = XS[1] - XS[0] + 0.40;
    for (const sg of [1, -1]) {
      const zi = SLOT, zo = wm;
      b.box(cx, yT, sg * (zi + zo) * 0.5, cl, 0.06, zo - zi,
        [0.735, 0.722, 0.688], [0.775, 0.762, 0.726]);
      // The edge beam along the slot, which is what the stairwell is framed
      // in and what stops the canvas reading as a torn sheet.
      b.box(cx, yT - 0.07, sg * (zi + 0.035), cl, 0.14, 0.07,
        [0.600, 0.560, 0.470]);
    }
    // The centreline batten that used to run under the canvas is gone: it sat
    // at z 0, which is now the middle of the stairwell, and a beam down the
    // middle of an opening is a beam you walk your head into.
  }
  for (let i = 0; i < 3; i++) {
    const col = [[0.78, 0.16, 0.16], [0.94, 0.94, 0.94], [0.10, 0.20, 0.52]][i];
    b.box(4.90, 1.06 + 4.40 - i * 0.18, 0, 0.80, 0.18, 0.02, col);
  }
  // Her paint, last, off the finished triangle soup — see `brodPaint`.
  return brodPaint(b.geo(), { HULL, SHEER, COVE, HOUSE, BOOT });
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
  // A sine hash, shared by the rim and the deck so a bay and the coping beside
  // it are not independent draws — they were poured on the same day.
  const hash = (i) => {
    const x = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
    return x - Math.floor(x);
  };
  // ── AND THE RIM IS WALKED IN SEGMENTS, NOT IN FOUR LONG QUADS ─────────────
  //
  // The waterline is the one line on this structure that is never clean.
  // `1000150357` and `_378` are both taken from a metre above it and both show
  // the same thing: the outer hand's breadth of the coping is dark, green-black
  // and uneven — weed that dries out between tides and never quite goes — and
  // the wall under it is two colours, a wet band a half metre deep under the
  // lip and dry stone below that. Drawn as one 46 m quad a side, none of that
  // can exist, and what you get is a pier with a clean edge, which is a pier
  // nobody has ever moored anything to.
  const WET = [0.318, 0.286, 0.244];        // the splash band under the lip
  const WEED = [0.212, 0.238, 0.170];       // and what grows on the very edge
  for (let i = 0; i < rim.length - 1; i++) {
    const [a0, b0] = rim[i], [a1, b1] = rim[i + 1];
    // Outward from this side, so the batter leans the right way on each face
    // without anything having to know which face it is on.
    const ex = a1 - a0, ev = b1 - b0;
    const el = Math.hypot(ex, ev) || 1;
    const ou = ev / el, ov = -ex / el;
    const O = (u, v, d, y) => P(u + ou * d, v + ov * d, y);
    const nSeg = Math.max(1, Math.round(el / 2.2));
    for (let j = 0; j < nSeg; j++) {
      const t0 = j / nSeg, t1 = (j + 1) / nSeg;
      const u0 = a0 + ex * t0, v0 = b0 + ev * t0;
      const u1 = a0 + ex * t1, v1 = b0 + ev * t1;
      const k = (hash(i * 97 + j * 13 + 5) - 0.5) * 0.070;
      const w = hash(i * 41 + j * 29 + 11);              // how weedy this one is
      const fc = [FACE[0] + k, FACE[1] + k * 0.94, FACE[2] + k * 0.86];
      const cc = [COPE[0] + k, COPE[1] + k * 0.94, COPE[2] + k * 0.86];
      // The wall, in two courses: dry stone, then the wet band under the lip.
      // The band is 0.55 m and not the whole face, because that is the depth
      // the sea actually reaches on a mole with 1.15 m of freeboard.
      const wetTop = TOP - COPE_H;
      const wetLo = wetTop - 0.55;
      const dLo = BAT + (LIP - BAT) * ((wetLo - BASE) / (wetTop - BASE));
      b.quad(O(u0, v0, BAT, BASE), O(u1, v1, BAT, BASE),
        O(u1, v1, dLo, wetLo), O(u0, v0, dLo, wetLo), fc);
      const wm = 0.55 + w * 0.45;
      b.quad(O(u0, v0, dLo, wetLo), O(u1, v1, dLo, wetLo),
        O(u1, v1, LIP, wetTop), O(u0, v0, LIP, wetTop),
        [fc[0] + (WET[0] - fc[0]) * wm, fc[1] + (WET[1] - fc[1]) * wm,
          fc[2] + (WET[2] - fc[2]) * wm]);
      // The shadow line under the coping, which is what says "pier" at two
      // hundred metres and at two.
      b.quad(O(u0, v0, LIP, wetTop), O(u1, v1, LIP, wetTop),
        O(u1, v1, LIP, TOP), O(u0, v0, LIP, TOP), cc);
      // And the top of the lip: half of it the coping's own stone, the outer
      // half whatever is growing on it this month.
      const wd = 0.35 + w * 0.55;
      const wc = [cc[0] + (WEED[0] - cc[0]) * wd * 0.85,
        cc[1] + (WEED[1] - cc[1]) * wd * 0.85,
        cc[2] + (WEED[2] - cc[2]) * wd * 0.85];
      b.quad(O(u0, v0, LIP, TOP), O(u1, v1, LIP, TOP),
        O(u1, v1, LIP * 0.42, TOP), O(u0, v0, LIP * 0.42, TOP), wc);
      b.quad(O(u0, v0, LIP * 0.42, TOP), O(u1, v1, LIP * 0.42, TOP),
        O(u1, v1, 0, TOP), O(u0, v0, 0, TOP), cc);
    }
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
  // ── AND ACROSS THE WIDTH AS WELL AS ALONG IT ─────────────────────────────
  //
  // Bays alone were half the job. Six metres of quay is not poured in one
  // piece and is not walked on evenly either, and `1000150357` shows both:
  // there is an edge strip about a metre wide down each side in its own tone,
  // a joint between it and the field, and the field between them is scuffed
  // pale down the middle where forty years of feet have polished the aggregate
  // up. The two edges are where the bollards, the ropes and the weed are and
  // nobody walks on them, so they stay dark. That contrast — a light lane
  // between two dark ones — is most of what makes a photograph of a quay read
  // as a route rather than as a surface, and it is the thing you are looking
  // at for the whole forty-six metres out to the boat.
  //
  // The tone step went from 0.055 to 0.075 at the same time. At 0.055 on a
  // 0.507 deck the bays differ by five per cent, which is under what this
  // renderer's ambient will show on a horizontal surface in full sun: the
  // joints were doing all the work and the slabs between them were one colour.
  const BAY = 2.2, JW = 0.06;
  const nBay = Math.max(1, Math.round(L / BAY));
  const EDGE = 0.95;                       // how wide the edge strip is
  const LANE = [[-W, -W + EDGE], [-W + EDGE + JW, W - EDGE - JW], [W - EDGE, W]];
  for (let i = 0; i < nBay; i++) {
    const u0 = (i / nBay) * L, u1 = ((i + 1) / nBay) * L;
    const kb = (hash(i) - 0.5) * 0.075;
    for (let n = 0; n < 3; n++) {
      const [v0, v1] = LANE[n];
      const ks = (hash(i * 7 + n * 131 + 3) - 0.5) * 0.045;
      const k = kb + ks + (n === 1 ? 0.052 : -0.030);
      // And the edges are greyer, not just darker. Wet stone loses its warmth
      // before it loses its value, which is why a dry quay photographs yellow
      // and its own edge photographs grey in the same frame.
      const g = n === 1 ? 1 : 0.962;
      const cl = [DECK[0] + k, (DECK[1] + k * 0.94) * g,
        (DECK[2] + k * 0.86) * g * g];
      b.quad(P(u0, v0, TOP), P(u0, v1, TOP),
        P(u1 - JW, v1, TOP), P(u1 - JW, v0, TOP), cl);
    }
    // The two joints down the length. Adjacent and never overlapping, which is
    // the rule the transverse joint below was already written to.
    for (const vj of [-W + EDGE, W - EDGE - JW]) {
      b.quad(P(u0, vj, TOP), P(u0, vj + JW, TOP),
        P(u1 - JW, vj + JW, TOP), P(u1 - JW, vj, TOP), JOINT);
    }
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
  // AND IT WAS ONE QUAD A SEGMENT IN ONE COLOUR, thirty metres of it.
  //
  // The deck twenty lines up is laid in 2.2 m bays, three lanes across, with
  // joints down the length and a transverse joint between bays, tone stepped
  // per bay and per lane, and the edge strips pulled grey — all of it written
  // because "the joints were doing all the work and the slabs between them
  // were one colour". The causeway got none of it, and the causeway is the
  // half of this structure you WALK: the note above says the confirmed
  // coordinate is 15 m along it and that this is where a photograph of the
  // pier gets taken from. Photographed from 26 m out it is a flat grey ribbon
  // running over the water — a painted plank, which is the same failure its
  // own flanks were added to fix, one surface up.
  //
  // The same construction as the deck, with two differences that are the
  // causeway rather than the pier.
  //
  //   IT IS POURED IN SITU OVER A WET SHELF, not dressed, so the tone step per
  //   bay is wider — 0.105 against the deck's 0.075. A causeway is patched
  //   where the sea has taken it and the patches do not match.
  //
  //   AND THE MARGINS ARE WET. The deck's edges are greyer than its middle
  //   because "wet stone loses its warmth before it loses its value"; this
  //   runs at 0.10 to 1.15 m over a shelf the DEM puts at 0.01, so its edges
  //   are not merely greyer, they are within a hand of standing water for the
  //   first twenty metres. The outer lane darkens toward the low end.
  const CBAY = 2.2, CJW = 0.06;
  const nCw = Math.max(2, Math.round(A / CBAY));
  const CEDGE = 0.85;
  const CLANE = [[-W, -W + CEDGE], [-W + CEDGE + CJW, W - CEDGE - CJW],
    [W - CEDGE, W]];
  for (let i = 0; i < nCw; i++) {
    const u0 = -A + (i / nCw) * A, u1 = -A + ((i + 1) / nCw) * A;
    const y0 = ry(u0), y1 = ry(u1 - CJW), yj = ry(u1);
    // 0 at the shore end, 1 at the pier — how far up out of the water it is.
    const wet = 1 - (i + 0.5) / nCw;
    const kb = (hash(i * 5 + 71) - 0.5) * 0.105;
    for (let n = 0; n < 3; n++) {
      const [v0, v1] = CLANE[n];
      const ks = (hash(i * 11 + n * 137 + 17) - 0.5) * 0.055;
      const k = kb + ks + (n === 1 ? 0.048 : -0.034);
      const g = n === 1 ? 1 : 0.948 - 0.055 * wet;
      const cl = [(RUB[0] + k) * (n === 1 ? 1 : 1 - 0.10 * wet),
        (RUB[1] + k * 0.94) * g, (RUB[2] + k * 0.86) * g * g];
      b.quad(P(u0, v0, y0), P(u0, v1, y0),
        P(u1 - CJW, v1, y1), P(u1 - CJW, v0, y1), cl);
    }
    for (const vj of [-W + CEDGE, W - CEDGE - CJW]) {
      b.quad(P(u0, vj, y0), P(u0, vj + CJW, y0),
        P(u1 - CJW, vj + CJW, y1), P(u1 - CJW, vj, y1), JOINT);
    }
    b.quad(P(u1 - CJW, -W, y1), P(u1 - CJW, W, y1),
      P(u1, W, yj), P(u1, -W, yj), JOINT);
  }
  // The flanks, down to whatever the shelf is doing under them. Still one
  // piece a segment: nobody sees the side of a causeway they are standing on,
  // and from the boat it is a 0.25 m band at forty metres.
  for (let i = 0; i < NSEG; i++) {
    const u0 = -A + (i / NSEG) * A, u1 = -A + ((i + 1) / NSEG) * A;
    const y0 = ry(u0), y1 = ry(u1);
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
    /**
     * Standing on the pier, a refused step is an EDGE and not a shoreline.
     *
     * See the note in 47-ground.js where this is read. `standable` above
     * already refuses the step off the side — correctly — but a refused step
     * with water a metre and a half beyond it is the shoreline handover, so
     * the barrier that exists to keep you on the mole was the thing putting
     * you in the sea. On 4.5 m of deck with 1.15 m of freeboard, that is most
     * of the walk out to the boat.
     *
     * Only while you are ON it, and the margin is deliberately tight. A metre
     * outside the coping you are in the water and the swim is right; the shore
     * either side of the root is a beach and is unaffected.
     */
    brink: (wx, wz) => {
      const [u, v] = M.local(wx, wz);
      return v > -M.w - 0.6 && v < M.w + 0.6 && u > -A && u < M.out + 0.6;
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
    body: BROD_PAINT_GLSL });

  const hull = new THREE.Mesh(brodProto(), mat);
  const boat = new THREE.Group();
  boat.add(hull);
  group.add(boat);

  let fitting = null;            // the pier furniture, once we know where it goes
  let lines = null;              // her mooring lines — see `moorLines` below
  let moorRun = null;            // [{ cleat, post, sag }], her end in HER frame
  let pax = null;                // the passengers, once their rigs have loaded
  let paxT = 0;                  // their clock — see `draw`
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
  let third = 0;                 // m the camera has actually got behind you
  let bodyOn = false;            // is 49-you.js's figure ours this frame
  let wasX = 0, wasZ = 0;        // where you stood last step, for the walk clip

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
  /**
   * The two registrations that can actually be read, and a plate to put them on.
   *
   * Hoisted here rather than left in `moor` because of the temporal dead zone
   * this file has been bitten by before: a `const` declared below its reader
   * gives BUILD DID NOT FINISH at some percentage, not an exception.
   *
   * `paintedWord` in 43-jadrija.js does this job already and cannot be used —
   * it is a closure-local helper, and 37-props.js and this file both sort
   * outside that closure. Eighteen lines is cheaper than moving it.
   */
  const BOAT_REG = [
    { num: 'ŠB 6051', ink: '#173a86' },
    { num: 'ŠB 208', ink: '#14161c' },
  ];
  const regCache = {};
  function regPlate(text, ink) {
    if (regCache[text]) return regCache[text];
    const C = document.createElement('canvas');
    C.width = 512; C.height = 112;
    const g = C.getContext('2d');
    g.textAlign = 'center';
    g.fillStyle = ink;
    // Georgia rather than Helvetica: the digits in `_357` have serifs and a
    // flagged 1, which is the face half the boats on this coast are lettered
    // in and is not what a sans gives.
    g.font = '600 82px Georgia, "Times New Roman", serif';
    const w = g.measureText(text).width || 1;
    if (w > C.width * 0.94) {
      g.font = '600 ' + Math.round(82 * C.width * 0.94 / w) + 'px Georgia, serif';
    }
    g.fillText(text, C.width * 0.5, C.height * 0.80);
    const tex = new THREE.CanvasTexture(C);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    regCache[text] = tex;
    return tex;
  }

  /**
   * A mooring line, as a tube that is rewritten every frame.
   *
   * Ten segments and four sides — 80 quads for both lines together. A rope is
   * a thing you can be on either side of, so the material is `DoubleSide`
   * rather than the geometry carrying both windings: it is the same picture
   * for half the triangles, and on a member this thin the shading comes off
   * the per-vertex normal, which is exact here because a tube knows its own.
   *
   * 44 mm and not 24. A mooring warp for a boat of twenty-odd tonnes is 22 mm
   * three-strand and at 22 mm it is a hairline you have to be told is there —
   * the same finding as the fender lanyards four hundred lines up, from the
   * same distance. Drawn at twice its rope size it reads as a rope.
   */
  const MOOR_N = 10, MOOR_S = 4, MOOR_R = 0.022;
  const mA = new THREE.Vector3(), mB = new THREE.Vector3();
  const mD = new THREE.Vector3(), mE = new THREE.Vector3(), mF = new THREE.Vector3();
  const mP = [];
  for (let i = 0; i <= MOOR_N; i++) mP.push(new THREE.Vector3());

  function moorGeo(n) {
    const tris = n * MOOR_N * MOOR_S * 2;
    const g = new THREE.BufferGeometry();
    for (const name of ['position', 'normal']) {
      const a = new THREE.BufferAttribute(new Float32Array(tris * 9), 3);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(name, a);
    }
    return g;
  }

  /**
   * Lay both of them out for where she is lying THIS frame.
   *
   * Her end goes through `boat.localToWorld`, so the rope follows her roll and
   * her trim; the mole's end is a world constant. The dip is a half sine and
   * not a catenary: over eleven metres with 0.4 m of sag the two differ by
   * about a centimetre, and the sine costs one call.
   */
  function drawMoor() {
    if (!lines || !moorRun) return;
    const pos = lines.geometry.attributes.position.array;
    const nor = lines.geometry.attributes.normal.array;
    let k = 0;
    const put = (P, ex, ey, ez) => {
      pos[k] = P.x + ex * MOOR_R; nor[k++] = ex;
      pos[k] = P.y + ey * MOOR_R; nor[k++] = ey;
      pos[k] = P.z + ez * MOOR_R; nor[k++] = ez;
    };
    for (const L of moorRun) {
      mA.copy(L.cleat);
      boat.localToWorld(mA);
      mB.copy(L.post);
      for (let i = 0; i <= MOOR_N; i++) {
        const t = i / MOOR_N;
        mP[i].lerpVectors(mA, mB, t);
        mP[i].y -= Math.sin(t * Math.PI) * L.sag;
      }
      for (let i = 0; i < MOOR_N; i++) {
        const P = mP[i], Q = mP[i + 1];
        mD.subVectors(Q, P).normalize();
        // Athwart the run. A mooring line at this berth is never within forty
        // degrees of vertical, so there is no basis to get degenerate.
        mE.set(-mD.z, 0, mD.x).normalize();
        mF.crossVectors(mD, mE);
        for (let s = 0; s < MOOR_S; s++) {
          const a0 = (s / MOOR_S) * TAU, a1 = ((s + 1) / MOOR_S) * TAU;
          const c0 = Math.cos(a0), s0 = Math.sin(a0);
          const c1 = Math.cos(a1), s1 = Math.sin(a1);
          const x0 = mE.x * c0 + mF.x * s0, y0 = mE.y * c0 + mF.y * s0,
            z0 = mE.z * c0 + mF.z * s0;
          const x1 = mE.x * c1 + mF.x * s1, y1 = mE.y * c1 + mF.y * s1,
            z1 = mE.z * c1 + mF.z * s1;
          put(P, x0, y0, z0); put(Q, x0, y0, z0); put(Q, x1, y1, z1);
          put(P, x0, y0, z0); put(Q, x1, y1, z1); put(P, x1, y1, z1);
        }
      }
    }
    lines.geometry.attributes.position.needsUpdate = true;
    lines.geometry.attributes.normal.needsUpdate = true;
  }

  function moor() {
    const A = brodAnchor();
    const BERTH_IN = 8.0;
    const hx = A.head[0], hz = A.head[1];
    const rx = A.root[0], rz = A.root[1];
    const ox = A.along[0], oz = A.along[1];
    const sgn = A.side;
    const px = A.athw[0] * sgn, pz = A.athw[1] * sgn;
    /**
     * HOW FAR OFF THE PIER SHE LIES, AND SHE WAS INSIDE IT.
     *
     * This was `A.w + 2.35`, and the note it was carrying said she lay 2.35 m
     * off the coping. She did not. `A.w + 2.35` is the offset of her
     * CENTRELINE from the pier's, and the pier is six metres wide — so 2.35
     * was measured off the middle of the masonry and there is another three
     * metres of it between there and the water.
     *
     * Measured on the built page rather than argued, by walking every vertex
     * of both meshes into the pier's own (u, v) frame:
     *
     *     u        her port extreme      the pier's face
     *     24 m     v 1.82                v 3.00
     *     28 m     v 1.66                v 3.00
     *     32 m     v 1.59                v 3.00
     *     36 m     v 1.65                v 3.00
     *     40 m     v 1.74                v 3.00
     *
     * She was through the wall by 1.2 to 1.4 m for twenty metres of her
     * length: her plating inside the masonry from the keel up, her port tyres
     * buried in it to the axle, and her bulwark hanging a metre and a third
     * over the coping. It is not visible from most angles only because she
     * occludes the thing she is standing in; from the coping looking aft it
     * is the pier ending in her topsides.
     *
     * SO THE OFFSET IS DERIVED NOW AND NOT TYPED. `brodFendOut()` is the
     * outermost point of anything on her side — the widest tyre, at 3.779 m
     * off her centreline, 52 mm proud of her own bulwark. The mole's rubbing
     * baulk is a 0.24 m timber bedded on the coping at `w − 0.10`, so its
     * outer face stands 0.02 m proud of the stone: that is what she bears on
     * and that is what the clearance is measured to.
     *
     * 0.03 m of daylight and not zero. Rule 5 wants 3 mm between parallel
     * faces; a torus tangent to a wall is not that, but a tyre that is exactly
     * touching is a tyre one wave away from being inside — and 30 mm at 27 m
     * of boat is a tyre bearing on a baulk, which is what it has to look like.
     *
     * What comes out is `A.w + 3.83`, and the geometry that follows from it:
     * her bulwark 0.10 m outboard of the coping edge instead of 1.33 m over
     * it, her boarding gate 0.31 m off the stone, and 0.15 m of air between
     * her topside and the mole's own hanging fender.
     */
    const BAULK = 0.02;                      // the timber, proud of the coping
    const BEAR = 0.03;                       // and what is left between them
    const OFF = A.w + BAULK + BEAR + brodFendOut();
    const bx = hx - ox * BERTH_IN + px * OFF;
    const bz = hz - oz * BERTH_IN + pz * OFF;
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
        // THE NEAR PROTO, and it should always have been. `boatProto` is four
        // flat stations and a box for an engine, and its own note says so: it
        // is "the right answer two hundred times over at a kilometre" and the
        // wrong one from the water. This fleet is not at a kilometre. It is
        // the thing you walk the length of on the way to the boat, at arm's
        // length, and `1000150357` is a photograph taken from that walkway —
        // so what was drawn was a row of white wedges where the frame has
        // cabins, screens, pulpits and covers.
        //
        // It costs what the note over `boatNearProto` says it costs and no
        // more: twelve hulls, once, at the one place on this shore anybody
        // stands next to one.
        const shells = [boatNearProto(true), boatNearProto(false)];
        // Bow a metre off the coping: the hull is six metres and its origin is
        // amidships, so the centre sits four metres out from the edge.
        //
        // 3.9 and not 4.6. Measured off the render rather than off the
        // arithmetic: at 4.6 the row stood a clear two metres off the stone
        // with daylight under every bow, and `1000150357` has them close
        // enough that the pulpits overhang the walkway. The near proto's stem
        // reaches x 3.00 against the far one's 3.00 as well, so the change is
        // the gap and not the hull.
        const v = -sgn * (A.w + 3.9);
        // FRACT, not `% 1`. JavaScript's remainder keeps the sign of the
        // dividend, so a sine hash taken with `% 1` lands in (-1, 1) — which
        // put half the row on a scale of 0.54 and picked the open boat for
        // every negative draw. What came out was a line of flat little skiffs
        // with three cabin boats in it, and the fleet in `1000150357` is the
        // other way round.
        const fr = (n) => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
        // Sixteen, and no longer on 2.30 m fixed centres.
        //
        // That number was written against a 2.20 m beam, and the scale here is
        // 0.88 to 1.22 — so the widest pair in the row was 2.68 m of boat in a
        // 2.30 m berth. They interpenetrated, and what a walk down the coping
        // showed was not sixteen boats but one continuous white lozenge with
        // cabins standing on it. Pitch off the two beams either side of each
        // gap instead and the gap is a gap: 0.10 to 0.20 m of water, which is
        // what a marina in August has and is close enough that the fenders are
        // doing work.
        const HALF = 1.10;                       // sheer half-beam, at scale 1
        const at = [];
        let u = 4.0, prev = 0;
        for (let k = 0; k < 16; k++) {
          const h = fr(k * 12.9898);
          const j = fr(k * 78.233 + 2.1);
          const sc = 0.88 + h * 0.34;
          const hb = HALF * sc;
          u += prev + hb + 0.10 + j * 0.10;
          prev = hb;
          const m = new THREE.Mesh(shells[h > 0.28 ? 0 : 1], mat);
          m.position.set(u, 0, v);
          // ── her number, on two of the sixteen ──
          //
          // `1000150357` is a photograph taken from this walkway, and the
          // loudest readable thing in it is the registrations on the bows.
          // Opened at the source 4000 x 2252 — not the 1100 a contact sheet
          // gives — two of them come up clean:
          //
          //   ŠB 6051   blue serif digits on a cream hull
          //   ŠB 208    dark bold digits on a white one
          //
          // TWO, AND THE OTHER FOURTEEN GO BARE. A third in the frame reads
          // "ŠB 5" and then disappears behind the boat in front of it, and
          // inventing the rest of it would be inventing a boat registration —
          // which is what rule 12 exists to keep off this shore. It is also
          // what the photograph looks like: bows overlap, and you can read two
          // of them.
          //
          // ŠB is Šibenik. Both bows carry it, as they do in life, and here
          // that matters for a second reason: these lie bow-to with their
          // sides against each other, so the number you actually read is on a
          // boat further down the row, seen at a slant.
          //
          // THE TWO ON THE ENDS OF THE ROW, and that is not a taste. These lie
          // bow-to with 0.10 to 0.20 m of water between them, so every topside
          // in the middle of the row is behind the next boat's hull — lettering
          // k 3 and k 9 was the first cut and both numbers were occluded from
          // every camera on the walkway. It is also why you can read exactly
          // two of them in `_357`: the row has two outboard sides and the rest
          // are hull against hull. k 0's faces back down the walkway toward
          // anybody coming out to the ferry, and k 15's faces the head.
          const reg = k === 0 ? 0 : k === 15 ? 1 : -1;
          if (reg >= 0) {
            const R = BOAT_REG[reg];
            // x 1.75 is a third of the way aft of the stem, where the frame
            // has them. The topside flares 19 degrees there — sheer half-beam
            // 0.735 against 0.501 at the chine — so 0.66 is the hull at plate
            // height and 0.695 stands it 35 mm proud, which is clear of the
            // flare at both edges without reading as a sticker.
            for (const sd of [-1, 1]) {
              const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.135),
                new THREE.MeshBasicMaterial({ map: regPlate(R.num, R.ink),
                  side: THREE.DoubleSide, transparent: true,
                  depthWrite: false }));
              pl.position.set(1.75, 0.28, sd * 0.695);
              pl.rotation.y = sd > 0 ? 0 : Math.PI;
              pl.name = 'reg:' + R.num;
              m.add(pl);
            }
          }
          // Her bow points at the quay, which on this face is +z when the
          // ferry is on -z. A child whose local +X must land on the group's
          // ±z takes a quarter turn the matching way round.
          const th = -sgn * Math.PI / 2 + (j - 0.5) * 0.12;
          m.rotation.y = th;
          m.scale.setScalar(sc);
          raft.add(m);
          at.push({ u, sc, th });
        }

        // ── and what holds them there ──
        //
        // A row of boats lying a metre off a wall with nothing between them and
        // it is a row of boats about to be somewhere else. `1000150377` has two
        // bow lines off every hull in the frame, running up on to the coping —
        // white, sagging, and the only thing in the photograph that crosses the
        // gap. The render had none of them, and that gap was the reason the
        // fleet read as parked rather than moored.
        //
        // Iron every other boat rather than one apiece: a quay carries bollards
        // every five metres or so and a berth here is two and a half, so half
        // the row lies to its neighbour's. That is why the lines in the frame
        // run slantwise, and it is worth reproducing rather than tidying away.
        {
          const lb = propBuilder();
          const IRON = [0.258, 0.242, 0.224];
          const LINE = [0.860, 0.848, 0.808];
          const zq = -sgn * (A.w - 0.45);        // where the iron stands
          const yq = A.top;
          for (let k = 0; k < 16; k += 2) {
            const bx = at[k].u;
            propTube(lb, [[bx, yq, zq], [bx, yq + 0.34, zq]], 0.105, IRON, 8);
            propTube(lb, [[bx, yq + 0.34, zq], [bx, yq + 0.40, zq]], 0.128, IRON, 8);
          }
          for (let k = 0; k < 16; k++) {
            const { u: bu, sc, th } = at[k];
            const c = Math.cos(th), sn = Math.sin(th);
            const bx = at[k - (k % 2)].u;
            for (const side of [-1, 1]) {
              // The cleat, put back into the raft's frame. The proto's bow pair
              // is at x 2.30, z ±0.26, on a deck whose sheer there is 0.673 —
              // and three.js maps a child's local +X to (cos θ, −sin θ) and its
              // +Z to (sin θ, cos θ), which is the whole of the transform.
              const lx = 2.30, ly = 0.745, lz = side * 0.26;
              const cx = bu + sc * (lx * c + lz * sn);
              const cy = sc * ly;
              const cz = v + sc * (-lx * sn + lz * c);
              const pts = [];
              for (let i = 0; i <= 6; i++) {
                const t = i / 6;
                pts.push([cx + (bx - cx) * t,
                  cy + (yq + 0.30 - cy) * t - Math.sin(t * Math.PI) * 0.17,
                  cz + (zq - cz) * t]);
              }
              propTube(lb, pts, 0.019, LINE, 4);
            }
          }
          // ── AND THE TWO THINGS `1000150357` HAS ON THE COPING ─────────────
          //
          // Cropped at full size, that frame is mostly quay rather than boat,
          // and there are two objects on it that nothing in this file had.
          //
          // THE STEP STANDS. Two of them in the one frame, standing on the
          // coping between the bows: a little galvanised frame about knee high
          // with a weathered plank across the top, which is what you put your
          // foot on to get over a bow pulpit and on to a boat moored bow-to.
          // They are the reason a Mediterranean mooring is climbable at all,
          // and they are unmistakable — a pale horizontal plank at 0.55 m with
          // daylight under it, against a quay that is otherwise flat.
          // 0.42 high and not 0.52, and the plank 0.80 long and not 0.88.
          // Photographed at the first size it read as a card table: a 0.88 m
          // top on 0.52 m legs is furniture proportions, and the thing in the
          // frame is squat — the plank is about twice its own height off the
          // ground, which is what makes it a step rather than a table.
          const STEP = [0.560, 0.540, 0.498];    // the plank, sun-bleached
          const GALV = [0.430, 0.438, 0.446];    // and the frame under it
          for (let k = 3; k < 16; k += 6) {
            const bx = at[k].u + 1.05;
            const bz = -sgn * (A.w - 0.78);
            propTube(lb, [[bx, yq, bz], [bx, yq + 0.42, bz]], 0.026, GALV, 4);
            for (const dz of [-0.19, 0.19]) {
              for (const dx of [-0.36, 0.36]) {
                propTube(lb, [[bx + dx, yq, bz + dz],
                  [bx + dx * 0.78, yq + 0.42, bz + dz * 0.78]], 0.023, GALV, 4);
              }
            }
            // The top face barely lifted off the sides. It was 0.612 against
            // the plank's 0.560 and against a quay deck of 0.507, and a plank
            // ten per cent brighter than the concrete it stands on reads as
            // white furniture from ten metres. In the frame the two are within
            // a shade of each other.
            lb.box(bx, yq + 0.452, bz, 0.80, 0.052, 0.38, STEP,
              [0.578, 0.556, 0.512]);
          }
          // THE CHAIN. This is the correction, not an addition: the bow lines
          // above run to bollards, and in the frame the heavy stuff does not.
          // A boat lying bow-to is held off the quay by a laid mooring, and
          // what you see from the coping is chain — black, thick, and going
          // over the edge and straight down into the water, with a red-and-
          // white line beside it. The bollards and the white nylon are right
          // and they are the light half of it; without the chain the row reads
          // as tied up rather than as moored.
          //
          // Under the surface for a metre, because that is where it goes and
          // the sea is clear enough here to see it.
          const CHAIN = [0.098, 0.094, 0.090];
          for (let k = 1; k < 16; k += 3) {
            const bx = at[k].u - 0.55;
            const ze = -sgn * A.w;
            const pts = [];
            for (let i = 0; i <= 5; i++) {
              const t2 = i / 5;
              pts.push([bx + t2 * 0.10,
                yq - 0.10 - t2 * t2 * 1.35,
                ze - sgn * (0.05 + t2 * 0.62)]);
            }
            propTube(lb, [[bx, yq + 0.04, ze + sgn * 0.30],
              [bx + 0.02, yq - 0.06, ze - sgn * 0.04]], 0.030, CHAIN, 4);
            propTube(lb, pts, 0.030, CHAIN, 4);
          }
          raft.add(new THREE.Mesh(lb.geo(), mat));
        }
        raft.updateMatrixWorld();
        scene.add(raft);
      }

      // ── AND HER OWN LINES, WHICH ARE THE THING THAT WAS MISSING ───────────
      //
      // The pier's rope is photographed and correct: `1000150377` has three
      // turns on the bitt and the tail flaked on the slab, with no boat in the
      // frame. What the model was short of is HER lines, and a scheduled ferry
      // lying alongside with her engine on has them.
      //
      // TWO CROSSED SPRINGS, and the arrangement is forced rather than chosen.
      // The mole carries exactly two things you can put a rope on — the
      // mushroom 6.4 m in from the head and the bitt 12.8 m in — and both of
      // them lie under her waist: she spans u 24 to 52 on a pier that ends at
      // 46. There is nothing ahead of her stem and nothing abaft her transom,
      // so a head rope and a stern rope are not available and would not hold
      // her if they were. What holds a boat between two bollards under her
      // waist is a pair of springs that cross: her bow cleat leading AFT to
      // the bitt, her quarter cleat leading FORWARD to the mushroom. That is
      // also what `1000150378` shows of the fleet on the other face — the
      // lines in it run slantwise, not square.
      //
      // THEY ARE REDRAWN EVERY FRAME, and that is not gold plating. She lies
      // to the real Gerstner surface and `place` chases it: measured at the
      // berth over five and a half seconds she rolls through 2.9 degrees and
      // trims through 3.0, which at the fore cleat is 0.24 m of vertical
      // travel. A rope baked into the mole's frame would spend half its life
      // hanging off her rail with daylight under it. Two lines of ten segments
      // is 160 triangles rewritten a frame, which is nothing.
      lines = new THREE.Mesh(moorGeo(2), new THREE.MeshBasicMaterial());
      lines.material.dispose();
      lines.material = solidMaterial(new THREE.Color(0.855, 0.836, 0.786), {
        vcol: false, spec: 0.05, specPower: 18, side: THREE.DoubleSide });
      lines.frustumCulled = false;
      lines.visible = false;
      scene.add(lines);
      {
        // Her cleats, in her own frame and in BUILT metres — `brodCleatAt`
        // answers authored, like everything the builder eats.
        const cl = (x) => {
          const [cx, cy, cz] = brodCleatAt(x);
          return new THREE.Vector3(cx * BROD_K, cy * BROD_K, -cz * BROD_K);
        };
        // And the mole's, in the world. The mushroom's swelling and the bitt's
        // shank are both about 0.30 m over the coping, which is where a turn
        // sits on either of them.
        const post = (u, vin) => {
          const w = A.toW(u, sgn * (A.w - vin));
          return new THREE.Vector3(w[0], A.top + 0.30, w[1]);
        };
        moorRun = [
          // Bow cleat to the bitt: 11.7 m, leading aft.
          { cleat: cl(BROD_CLEAT[0]), post: post(A.out - 12.8, 0.66), sag: 0.40 },
          // Quarter cleat to the mushroom: 12.7 m, leading forward.
          { cleat: cl(BROD_CLEAT[1]), post: post(A.out - 6.4, 0.62), sag: 0.35 },
        ];
      }
    }
    reset();
    // The passengers, which is the one thing aboard her that cannot be built
    // synchronously: the instanced rigs are two payload blobs that have to be
    // inflated. Kicked off from here rather than from `buildBrod` because
    // `moor` is where she becomes a boat that exists in the world, and dropped
    // on the floor if it fails — a ferry with nobody on it is what she was
    // yesterday and it is not worth a broken load.
    //
    // `deckAt` goes in as a callback. It is the walkable model and there is
    // supposed to be exactly one of those; a passenger standing on a deck the
    // player cannot reach is a passenger standing on a deck that is not there.
    if (!pax) {
      buildBrodPax(scene, deckAt).then((p) => { pax = p; })
        .catch((e) => console.warn('brod passengers failed:', e.message));
    }
    return true;
  }

  /** Put her back alongside at Jadrija with her engine ticking over. */
  function reset() {
    phase = 'moored'; s = 0; sp = 0; tmr = 0; said = -1;
    // Built metres here too, and the same fault: -4.4 with z 0 is halfway up
    // the companionway and 0.72 is the cockpit sole's AUTHORED height, so she
    // came back alongside with her passenger standing on the stair at a deck
    // level half a metre under his own feet. In the cockpit, off the flight,
    // and the sole read rather than typed.
    you.x = -6.0; you.z = 1.60; you.yaw = 0; you.pitch = -0.02;
    you.deck = deckAt(you.x, you.z) ?? BROD_WELL * BROD_K;
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
      if (lx <= d.x0 || lx >= d.x1) continue;
      if (a < d.hole) continue;
      if (a >= (d.lim != null ? Math.min(d.lim, out) : out)) continue;
      // A stair is a band whose sole runs. Linear in x, which is what a flight
      // of even treads is.
      return d.ramp ? d.y + (lx - d.x0) / (d.x1 - d.x0) * d.ramp : d.y;
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
      // NOT ON A BAND THAT HAS ITS OWN LIMIT. `out` is the hull, and sliding
      // somebody in against the hull is right on a side deck and wrong on the
      // upper deck, where the thing that stops you is a rail two metres inside
      // it — the clamp would have walked you straight through the rail and
      // left you standing on the roof coaming over the water.
      if (d.lim != null) continue;
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
   * centreline by the width of the pier plus her own fenders, on the side the
   * pier's fittings are on — see the berth in `moor` — so the
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
    // Let go fore and aft. `idle` is what maintains the lines and it stops
    // running the moment she is `active`, so without this the two springs
    // would stay where they were and follow her up the channel.
    if (lines) lines.visible = false;
    phase = 'letgo';
    s = 0; sp = 0; tmr = 0; said = -1;
    // IN BUILT METRES, WHICH THESE WERE NOT. `you.z = -1.30` was written when
    // she was 15.6 m long and it never went through `BROD_K` when she grew:
    // the deckhouse's half-width is 2.03 m now, so 1.30 is INSIDE the house,
    // and the only band that answers there is the upper deck. Boarding put you
    // on the roof, looking down at the awning you were supposed to be under.
    // 2.45 is between the house at 2.03 and the bulwark at about 3.19, which
    // is the port side deck and is where the note below says you land.
    you.x = 1.20; you.z = -2.45; you.yaw = 0; you.pitch = -0.02;
    you.deck = deckAt(you.x, you.z) ?? BROD_DK * BROD_K;
    return true;
  }

  /**
   * Off her.
   *
   * The body goes back with the same call `leaveGround` makes, and it has to
   * be here rather than left to 90-app.js: `poseSwimBody` only ever hands back
   * a figure IT is driving, so a third person walked over the side would leave
   * a body standing on the water astern of her.
   */
  function leave() {
    active = false;
    third = 0;
    if (bodyOn) { brodDriveYou(null); bodyOn = false; }
  }

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
      // ONE LONG BLAST BEFORE SHE MOVES, and a short one as she comes
      // alongside at the far end — which is not decoration, it is the rule:
      // a vessel leaving a berth sounds one prolonged blast. Misha asked for
      // "those long whistles" and this is where a boat actually uses them.
      //
      // Hung off `tmr` crossing a mark rather than off entering the phase,
      // because `enter` is called from a debug hook as well as from the mole
      // and a horn on `enter` would sound every time a probe teleported
      // aboard. Half a second in, so it lands after the deck has settled.
      if (tmr > 0.5 && tmr - dt <= 0.5) audio.horn(3.4);
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
      // The single short blast that says she is going astern on to the quay.
      // At 60 m out, which is about twenty seconds off at this speed.
      if (d < 60 && d + sp * dt >= 60) audio.horn(1.1, 0.85);
      if (d < 0.5) { phase = 'alongside'; sp = 0; s = total; out = 'alongside'; }
    }

    const P = atS(s);
    place(P.x, P.z,
      (phase === 'moored' || phase === 'letgo') ? berth.yaw : P.yaw, dt);

    // Walking her deck. Everything is in her frame, so the deck moves under you
    // and you are never integrated in world metres at all — which is the whole
    // reason a passenger is cheap where a driver is not.
    //
    // Where you stood before it, for `driveBody`: the walk is refused by the
    // house, by a passenger and by a rise over 0.66 m, so what the legs should
    // be doing is what the DECK says happened and not what the keys asked for.
    wasX = you.x; wasZ = you.z;
    const step = (ctl.sprint ? BROD.run : BROD.walk) * dt;
    const f = clamp(ctl.fwd || 0, -1, 1), r = clamp(ctl.side || 0, -1, 1);
    if (f || r) {
      const c = Math.cos(you.yaw), sn = Math.sin(you.yaw);
      const nx = you.x + (c * f - sn * r) * step;
      const nz = you.z + (sn * f + c * r) * step;
      // A STEP IS A STEP, and until now it was not.
      //
      // `deckAt` answers with a height and this took any height at all: from
      // the cockpit sole you could walk forward into the deckhouse's footprint,
      // where the only band that answers is the upper deck, and rise 2.79 m in
      // one 4 cm stride — standing on the roof having walked through the house.
      // The same thing worked in reverse off the stair head. It is the whole of
      // *"it's all messed up in there"* and it is not a geometry bug at all: it
      // is a walk model with no rise limit in it, which is the one thing every
      // walk model has.
      //
      // 0.45 up and 0.65 down, and they do not scale with `BROD_K` for the same
      // reason `edge` does not: a step is a person's, and a person is the same
      // size whatever the boat is. Up is the shorter of the two because
      // stepping up is a lift and stepping down is a drop, and 0.45 clears the
      // 0.24 m tread this stair actually has with most of a tread to spare.
      // SOMEBODY IS STANDING THERE. Twenty-two people on a deck four metres
      // across are only aboard if they cannot be walked through, and the test
      // is the cheapest possible one — 22 squared distances in her own frame,
      // which is the frame both they and you are already in. It goes in front
      // of the deck test rather than behind it so that a refusal falls through
      // to the same two axis slides the deckhouse does: you brush past a
      // passenger rather than stopping dead in front of them.
      const who = (x2, z2) => !(pax && pax.solid(x2, z2));
      const dy = who(nx, nz) ? deckAt(nx, nz) : null;
      const rise = dy == null ? 0 : dy - you.deck;
      if (dy != null && rise <= BROD.stepUp && rise >= -BROD.stepDown) {
        you.x = nx; you.z = nz; you.deck = dy;
      } else {
        // And the hull's clamp obeys the limit too. This was the leak the
        // walk test found: `deckAt` answers 2.135 for the foredeck and the
        // rise check refuses it, so the code falls through to here — and here
        // took any height at all. Walking forward off the upper deck you were
        // refused the 1.92 m drop and then handed it anyway, and ended up at
        // the stem having stepped down two metres through the wheelhouse roof.
        const sl = who(nx, nz) ? slideIn(nx, nz) : null;
        const slr = sl ? sl.y - you.deck : 0;
        if (sl && slr <= BROD.stepUp && slr >= -BROD.stepDown) {
          you.x = nx; you.z = sl.z; you.deck = sl.y;
        }
        else {
          // And then, only if the hull could not take it, slide along whichever
          // axis still lands on a deck — so the side of the house is something
          // you brush past rather than stop dead against. Same rule the walk
          // model uses ashore.
          // Both of these obey the same limit. A wall you cannot walk into
          // head-on is not a wall if you can get through it sideways.
          const ok = (v) => v != null && v - you.deck <= BROD.stepUp
            && v - you.deck >= -BROD.stepDown;
          const ax = who(nx, you.z) ? deckAt(nx, you.z) : null;
          if (ok(ax)) { you.x = nx; you.deck = ax; }
          const az = who(you.x, nz) ? deckAt(you.x, nz) : null;
          if (ok(az)) { you.z = nz; you.deck = az; }
        }
      }
    }

    for (let i = 0; i < BROD.calls.length; i++) {
      if (i > said && s >= BROD.calls[i].at) { said = i; out = out || 'call'; }
    }
    return out;
  }

  /**
   * May the camera stand at this point in her frame?
   *
   * HER OWN FLOOR PLAN IS THE COLLIDER, which is 47-ground.js's rule — the
   * march there tests `confine`, the same function that decides where your
   * body may go — read on to a boat. `deckAt` answers "there is a walkable
   * sole here, at this height", and a camera under `sole + camHead` is
   * therefore inside a deck rather than over one. That one test covers the
   * deckhouse (the upper-deck band answers 4.055 across its whole footprint,
   * so everything under 4.4 inside the house is refused), the roof slab, the
   * companionway, the foredeck and both side decks, and it cannot disagree
   * with the walk about where the walls are because it IS the walk.
   *
   * Off the plan there are two cases and they are opposite: outboard of her,
   * which is open water and fine, and inside her plating, which is not.
   * `brodBeam` inverts the loft analytically — it is what the fenders and the
   * mooring hang off — so the second is the hull itself and not a box round
   * it. Above the sheer neither applies: over the bow, over the transom and
   * over the awning are all sky.
   */
  function camClear(lx, ly, lz) {
    // y = 0 in her frame is the designed waterline, so this is air under the
    // lens and not an arbitrary floor.
    if (ly < BROD.camLow) return false;
    const sole = deckAt(lx, lz);
    if (sole == null) {
      return ly >= brodSheer(lx)[0] || Math.abs(lz) > brodBeam(lx, ly) + 0.15;
    }
    if (ly < sole + BROD.camHead) return false;
    // Her one roof. See `camRoof`: the cockpit is the only sole she has an
    // awning over, and it is the sole itself that says which one that is.
    return !(sole < BROD_WELL * BROD_K + 0.05 && ly > sole + BROD.camRoof);
  }

  /**
   * IS SOMEBODY STANDING WHERE THE LENS IS?
   *
   * The same 0.35 m disc the WALK refuses — `pax.solid`, unchanged, in the
   * frame both they and the camera are already in. Found by pressing W in the
   * third person on her starboard side deck: the march put the lens 1.2 m back
   * and 1.2 m back was the inside of a passenger's head, which filled the
   * frame with a jaw.
   *
   * IN THE MARCH AND NOT AT THE STOPPING POINT, and that was measured both
   * ways because it is not obvious. Testing only where the lens comes to rest
   * is cheaper by every number — 8.0 % of her deck falls back to the first
   * person against 16.2 %, and the mean pull-back is 2.63 m against 2.31 — and
   * it is the wrong answer, because it stops the camera being INSIDE somebody
   * and does nothing about somebody being between the camera and you. That is
   * not a theoretical case on this boat: photographed at 1.2 m of pull-back on
   * her starboard side deck, the shot was a passenger's jaw across a third of
   * the frame with the body it was supposed to be behind nowhere in it. The
   * promenade can ignore this because you can walk away from a stranger on a
   * promenade; her side deck is 1.27 m wide with twenty-two people on it.
   *
   * So the eight points go, and what is bought with them is that the first
   * person — which is a shot, and a good one — is what you get instead of a
   * shot of the back of somebody's head.
   *
   * Only within a person's height of the sole they are standing on: `solid` is
   * a disc and knows nothing about how tall anybody is, so without the height
   * test the camera 4.4 m over the cockpit — which is where it goes when you
   * are on the upper deck — would be refused by somebody sitting under it.
   */
  function camInPax(lx, ly, lz) {
    if (!pax) return false;
    const sole = deckAt(lx, lz);
    return sole != null && ly < sole + 2.0 && pax.solid(lx, lz);
  }

  /**
   * Put the camera where your head is — or, with `back`, behind you.
   *
   * The head is composed **on top of her attitude** rather than beside it —
   * `qBoat * qHead` — so her heel rolls the horizon under you and her trim
   * lifts it. That roll is the only thing on the screen that says you are on
   * water rather than on a moving platform, and adding it afterwards as a
   * `rotateZ` gets it wrong the moment you are not looking over the bow.
   *
   * `-π/2 - you.yaw` is the quarter turn between a camera, which looks down its
   * own -Z, and a hull, whose forward is +X. See `yawOfX`.
   *
   * ── AND THE THIRD PERSON ────────────────────────────────────────────────
   *
   * `back` is metres and 0 is the first person, which is exactly the code that
   * was here: at `d = 0` the two branches below compute the same point and the
   * same quaternion, so B off is not a mode, it is a zero.
   *
   * IT IS THE SAME ORIENTATION, and that is the whole reason this is eleven
   * lines rather than 47-ground.js's ninety. The promenade's third person has
   * to `lookAt`, because its camera swings round her and the aim has to follow;
   * hers is a straight slide down the view line, so the direction from the
   * camera to what it is looking at is the direction it was already looking in.
   * Which means the quaternion above is still right — and that matters more
   * here than anywhere else in the game, because `lookAt` would throw away
   * `qBoat` and with it the roll. A third person on a boat with no roll in it
   * is a third person standing on a car park.
   *
   * MARCHED AND NOT SOLVED, again as the promenade marches: a hand's breadth
   * at a time down the line, stopping at the last point `camClear` allows.
   * Twenty-one probes a frame and only while B is on. Her deck is 1.27 m wide
   * between the deckhouse and the bulwark, so the march is doing real work —
   * see `thirdD` for what it actually finds, which is measured and not guessed.
   *
   * NO ORBIT. The promenade walks the camera round you when you stand still,
   * and it is deliberately not here: the reason it can is that the ground is
   * flat and open in every direction, and this deck is a corridor with a house
   * down the middle of it. A lap round somebody on her side deck spends half
   * of itself inside the deckhouse, which the march would refuse — so the
   * camera would collapse into her head and pop out again twice a lap, which
   * reads as the camera breaking rather than as a camera meeting a wall.
   */
  function pose(camera, back = 0, dt = 0) {
    if (!active) return;
    const ex = you.x, ey = you.deck + BROD.eye, ez = you.z;
    // Her view line, in her frame. The walk uses (cos yaw, sin yaw) for
    // forward, so this is that with the pitch on it.
    const cp = Math.cos(you.pitch);
    const lx = cp * Math.cos(you.yaw), ly = Math.sin(you.pitch),
      lz = cp * Math.sin(you.yaw);
    let d = 0;
    if (back > 0) {
      // MARCHED AT EYE HEIGHT, which is 47-ground.js's rule and here it is
      // load-bearing rather than tidy. She has 2.15 m of awning over the
      // cockpit sole and you are 1.62 m of it, so there is half a metre of air
      // over your eyes down there — and a march that took the height off the
      // view line lost the whole shot the moment you glanced at your own feet:
      // measured over her deck, looking down 26 degrees in the cockpit found
      // 0.99 m, under `camMin`, and handed the frame back to the first person.
      // How far BACK the camera can get is a question about walls; how high it
      // ends up is a separate one and is settled below.
      for (let k = BROD.camStep; k <= back + 1e-6; k += BROD.camStep) {
        if (!camClear(ex - lx * k, ey, ez - lz * k)) break;
        if (camInPax(ex - lx * k, ey, ez - lz * k)) break;
        d = k;
      }
      if (d < BROD.camMin) d = 0;
    }
    // OUT SLOWLY, IN AT ONCE. What the march finds is not continuous along her
    // deck — walk aft off the side deck and the awning takes 3.10 m down to
    // whatever is left before the cockpit, in one stride — and a camera that
    // eases INTO a wall is a camera inside it. Lengthening is the only
    // direction with any slack in it, so it is the only one that gets an ease.
    if (d < third || third <= 0 || dt <= 0) third = d;
    else third = Math.min(d, third + BROD.camEase * dt);
    d = third;
    let cx = ex, cy = ey, cz = ez;
    if (d > 0) {
      cx = ex - lx * d; cz = ez - lz * d;
      // And now the height, CLAMPED and not refused — the promenade's argument
      // and its method: the test is monotone in height inside a deck, so five
      // halvings put the lens within 3 cm of whatever stopped it for five
      // calls instead of the twenty a second march would cost. `ey` is known
      // good because the march above tested exactly that point at exactly that
      // height. Both directions, unlike the promenade's, because looking UP
      // drops the camera towards the sea rather than lifting it into a
      // ceiling, and out here the sea is the thing it hits.
      const want = ey - ly * d;
      if (camClear(cx, want, cz)) cy = want;
      else {
        let lo = ey, hi = want;
        for (let i = 0; i < 5; i++) {
          const mid = (lo + hi) * 0.5;
          if (camClear(cx, mid, cz)) lo = mid; else hi = mid;
        }
        cy = lo;
      }
    }
    tmpV.set(cx, cy, cz);
    boat.localToWorld(tmpV);
    camera.position.copy(tmpV);
    boat.getWorldQuaternion(qBoat);
    if (d > 0 && cy !== ey - ly * d) {
      // The clamp has taken the lens off the view line, so aim it at the point
      // the view line was going to rather than along it — 6 m ahead of YOU,
      // which is what keeps you in the frame and not the deck at your feet.
      // Rebuilt as a yaw and a pitch and NOT as a `lookAt`, because `lookAt`
      // writes the whole quaternion and would throw away `qBoat` with it. A
      // third person on a boat with no roll in it is a third person standing
      // on a car park.
      const gx = ex + lx * BROD.camAhead - cx;
      const gy = ey + ly * BROD.camAhead - cy;
      const gz = ez + lz * BROD.camAhead - cz;
      const gl = Math.hypot(gx, gy, gz) || 1;
      eHead.set(Math.asin(clamp(gy / gl, -1, 1)),
        -Math.PI / 2 - Math.atan2(gz, gx), 0, 'YXZ');
    } else {
      // Untouched, and literally so: at `back` 0 this is the only branch that
      // runs and it is the line that was here before the third person existed.
      eHead.set(you.pitch, -Math.PI / 2 - you.yaw, 0, 'YXZ');
    }
    qHead.setFromEuler(eHead);
    camera.quaternion.copy(qBoat).multiply(qHead);
  }

  /**
   * And the body the camera is now behind.
   *
   * 49-you.js's figure, the one B has always shown — not a twenty-third
   * passenger. `buildBrodPax` was read first, because it is a crowd and a
   * crowd is the cheap answer to twenty-two people; it is the wrong answer to
   * one. Its people are instanced, posed off a shared clock, dressed from
   * `crowdLayer`'s palettes and hidden by `pax.hide()` as a block — so putting
   * you in it would put a stranger on the deck wearing somebody else's
   * swimsuit, and the one body in this game that is yours would be the one
   * body not on the boat. `you.drive` is what the promenade and the swim both
   * use and it costs nothing here that it does not cost there.
   *
   * IN THE WORLD AND NOT IN HER FRAME, because `drive` is world-space: the
   * position goes through `boat.localToWorld`, so it rides her exactly, and
   * the heading is her local forward pushed through the same matrix and read
   * off as the yaw the rig wants. `atan2(-fz, fx)` and not a constant offset:
   * `tick` in 49-you.js points the rig's +X at (cos y, 0, -sin y), so that
   * expression is the inverse of the thing that draws her, and it does not
   * care what convention any other mode uses.
   *
   * NO HEEL AND NO TRIM ON THE BODY, and that is measured rather than skipped.
   * `stats` reports her attitude alongside as heel -1.5 degrees and trim -1.8:
   * on a 1.7 m figure that is 5 cm at the crown, which is a third of what her
   * own walk cycle moves the same point. Her FEET are exact either way — the
   * position goes through the boat's matrix — and it is the feet that would
   * show.
   *
   * DRIVEN FROM `draw` AND NOT FROM `pose`, which is an ordering and not a
   * preference. 90-app.js runs `poseSwimBody` between the two, and that
   * function ends by handing the figure BACK whenever it is not the one
   * driving her — so a body driven in `pose` is a body released in the same
   * frame. `draw` is after it, and `you.tick`, which is where the drive is
   * actually consumed, is after that.
   */
  function driveBody(dt) {
    if (!active || third <= 0) {
      if (bodyOn) { brodDriveYou(null); bodyOn = false; }
      return;
    }
    tmpW.set(you.x, you.deck, you.z);
    boat.localToWorld(tmpW);
    tmpV.set(Math.cos(you.yaw), 0, Math.sin(you.yaw));
    boat.localToWorld(tmpV).sub(boat.position);
    // What she is actually doing, off the deck and not off the keys: the walk
    // is refused by the deckhouse, by a passenger and by every rise over
    // 0.66 m, and a body walking on the spot against a wall she is not moving
    // along is the one thing you can see from back here and cannot see from
    // inside your own head.
    const sp2 = dt > 0 ? Math.hypot(you.x - wasX, you.z - wasZ) / dt : 0;
    const moving = sp2 > 0.35;
    brodDriveYou({
      at: [tmpW.x, tmpW.y, tmpW.z],
      yaw: Math.atan2(-tmpV.z, tmpV.x),
      pitch: 0,
      clip: moving ? 'walk' : 'idle',
      // The clip is authored at about 0.92 m/s — 42-crowd.js measures it and
      // says so — and her deck runs at 1.55 and 2.6, which is inside the range
      // the promenade already clamps for a mode that reaches 9.4.
      speed: moving ? clamp(sp2 / 0.92, 0.6, 2.4) : 1,
      seen: true,
      wet: false,
    });
    bodyOn = true;
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
    // She is scenery again, so nothing on her deck is yours. Idempotent, and
    // it runs every frame you are ashore rather than once on the way out,
    // because `reset` is not the only door off her.
    if (bodyOn) { brodDriveYou(null); bodyOn = false; }
    const d = Math.hypot(cam.x - berth.x, cam.z - berth.z);
    group.visible = d < 1000;
    if (group.visible) place(berth.x, berth.z, berth.yaw, dt);
    // Her lines, after `place` and not before it: they hang off her cleats
    // through `boat.localToWorld`, so laying them out against last frame's
    // matrix is a rope that lags her roll by a frame.
    //
    // Redrawn inside 300 m and not inside 1000. She is scenery out to a
    // kilometre and a 44 mm rope is under a pixel past a couple of hundred
    // metres, so beyond that the two lines are eighty quads of nothing.
    if (lines) {
      lines.visible = group.visible && d < 300;
      if (lines.visible) drawMoor();
    }
    // And the people on her, who are the whole point of walking out to the
    // Brod: what tells you from the road that there is a boat to catch is that
    // there are people already sitting on it. `place` has just left
    // `boat.matrixWorld` current, which is the frame they are posed in.
    drawPax(dt, cam, group.visible);
  }

  /**
   * Her passengers, every frame she is on the screen.
   *
   * `paxT` and not wall time. The crowd's idle motion is a function of a clock,
   * and `__fr.filmDt` exists to pin the world's step to a fixed number of
   * seconds a frame so that a film comes out evenly timed — a crowd off
   * `performance.now()` would be the one thing in the frame still running at
   * real speed.
   *
   * The instanced layers are added to the SCENE by `crowdLayer`, not to
   * `group`, and the instance transforms are absolute. So `group.visible` does
   * not take them down with her and this has to: `hide` is what stops
   * twenty-two people hanging in the air over the channel once she is more than
   * a kilometre off.
   */
  function drawPax(dt, cam, on) {
    if (!pax) return;
    if (!on) { pax.hide(); return; }
    paxT += dt;
    pax.flush(paxT, cam, boat.matrixWorld);
  }

  /** Her passengers, and you, while you are aboard. See `drawPax`. */
  function draw(dt, cam) {
    if (cam) drawPax(dt, cam, group.visible);
    driveBody(dt);
  }

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
     * How far behind you the camera actually got, in metres, or 0 for the
     * first person. Read by a probe rather than by the game — 90-app.js does
     * not have to know, because unlike the promenade this file drives its own
     * body and can answer the question for itself.
     */
    thirdD: () => third,
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
    /**
     * The sole at a point in her own frame, or null — `deckAt`, exposed.
     *
     * Same reason `seek` is: *"once i board it, i should be able to walk around
     * it freely, go up and down, instead it's all messed up in there"* is a
     * complaint about a FLOOR PLAN, and a floor plan cannot be checked from a
     * screenshot. A probe can walk a grid over her in a tenth of a second and
     * say where the holes are, which is what this is for.
     */
    deckAt,
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
      pax: pax ? pax.stats() : null,
    }),
    /** The passengers, for a probe. Null until their rigs have inflated. */
    get pax() { return pax; },
  };
}
