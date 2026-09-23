// -----------------------------------------------------------------------------
// The people on the boat.
//
// She was rebuilt to carry sixty to eighty because the owner asked for exactly
// that, and the long note over `BROD.decks` argues at length that seats are how
// a hull says how many people it takes: an upper deck, four benches, 58 m of
// plank, about a hundred and sixteen places. All of which was true and none of
// which anybody could see, because you boarded her, crossed 3 850 m of channel
// on a sixty-passenger ferry, and were the only person aboard. A boat with a
// hundred and sixteen empty seats does not read as a boat that carries a
// hundred and sixteen people. It reads as a boat nobody takes.
//
// So: twenty-two of them, and twenty-two and not a hundred on purpose. The
// Jadrija boat in August is half full — people going into town for the evening,
// a few families, somebody's shopping on the seat beside them — and a full one
// would be both wrong and four times the cost. Fifteen to twenty-five is the
// number that reads as "this is a service that runs"; past that it reads as an
// event.
//
// ── the whole of the problem, which is that she moves ────────────────────────
//
// Everything on the Brod is a child of `boat`, a group `place()` sits on the
// real Gerstner surface every frame — four samples of the sea for the height,
// the trim and the heel, chased rather than snapped. A passenger placed in
// world metres would be a person standing on the water in the spot the boat
// happened to be in when they were built, and she would sail out from under
// them at eight knots. If she rolls and they do not, the whole thing collapses.
//
// The crowd in 42-crowd.js poses a scratch skeleton per figure and reads its
// joints' world matrices into instance buffers. That machinery had exactly one
// assumption standing between it and this: the root of the scratch skeleton has
// no parent, so its local matrix *is* its world matrix. `flush(t, cam, frame)`
// is the whole change — one optional matrix, composed on the outside of the
// figure's own, which is the four lines `updateMatrixWorld` would have done for
// free if the skeleton could have been a child of the boat. It cannot: the
// skeleton is shared by everybody the crowd draws, so re-parenting it would tie
// the whole crowd to one place.
//
// What that buys is that everything below is written in HER frame — +x forward,
// +z to starboard, y off `deckAt` — and none of it knows the sea exists. The
// heel comes free and it is exact: the same matrix that leans her rail into the
// swell leans the twenty-two people on it by the same angle in the same frame.
// Checked rather than asserted: at 2 400 m run, with her heeled 0.6° and 460 m
// from the origin, every drawn pelvis is within 3 cm of `boat.localToWorld` of
// the same figure's own local root, and the residual is the pelvis drop the
// standing pose puts in on its own.
//
// NOT SHADOW CASTERS, and that is not an oversight. Nothing on the Brod is —
// 90-app.js registers the aerodrome, the shore, the town's cars and both
// crowds ashore, and not one part of this boat. Twenty-two people throwing
// shadows off a hull that throws none would land them on the water beside her.
//
// ── what putting people on the benches found ─────────────────────────────────
//
// `BROD_BENCH` in 59-brod.js is the two runs, in built metres, off the same
// table `brodProto` draws them from. Both planks stand 0.49 m over their own
// sole, which is a real bench — and both were 0.91 m and 0.70 m DEEP, which is
// not, because the depth never went through `BROD_P` when the hull was scaled
// by 1.75 and so grew with her. Nobody could tell while the benches were empty.
//
// Twenty-two people is what tells you: on a 0.91 m plank there is no place to
// put somebody that is both far enough back to have their back against
// something and far enough forward for their shins to miss the plank on the way
// to the deck. Perching them on the front third was built and photographed
// first — it works, and it looks like twenty-two people who have all just sat
// down on the edge of a bench. The plank is 0.52 m and 0.44 m now, which is a
// bench, and the note over `BROD_BENCH` is the argument.
// -----------------------------------------------------------------------------

/**
 * THE SEATED POSE IS A PROPERTY OF THE SEAT, and these are the two numbers
 * that make it one.
 *
 * `sit` in 42-crowd.js is measured for the lip of the lowest platform at
 * Jadrija: hip 0.14 m over the slab, thighs level, shins plumb, soles 0.318 m
 * below it hanging over water where there is nothing to stand on. Off the rig
 * itself — tools/blender/bather.py, and dumped rather than remembered — the
 * pelvis pivot is 0.86 of a 1.696 m stature, the thigh is 0.41 and the knee is
 * 0.45 over the sole.
 *
 * Put that on a 0.49 m bench and the feet stop 0.17 m short of the deck, which
 * from anywhere in the cockpit is a row of people sitting in mid-air. So the
 * thigh drops instead, and the shin takes the same delta back so the shank
 * stays plumb and the sole comes down under the knee rather than swinging
 * forward:
 *
 *     0.41·cos(1.55 + d) + 0.45·cos(0.05) = 0.14 + H
 *
 * H is the seat height. Solved at H = 0.49 that gives d = −0.435 and the feet
 * land dead on the deck — and it also drops the knee 4 cm BELOW the plank's top
 * face, so the thigh cuts 7 cm into the front lip on its way there. −0.38 is
 * the number that came back off the built page: 2 cm of thigh in the lip, which
 * is a leg that starts at the edge of a bench, and 2 cm of daylight under the
 * heels, which is nothing. The exact solve was tried first and rejected for the
 * knee, not for the feet.
 *
 * `PAX_TOE` is where the soles end up, 0.41·sin(1.17) + 0.45·sin(0.05) forward
 * of the figure's own origin, and it is the number that decides how far in from
 * the plank's edge somebody may sit: any less and a pair of shins comes down
 * through the bench.
 */
const PAX_THIGH = -0.38;
const PAX_TOE = 0.40;

/**
 * How far outboard of the plank's inboard edge a backside goes.
 *
 * `PAX_TOE` less a hand's clearance, so the soles come down 0.18 m clear of the
 * bench. On the 0.44 m upper-deck plank that also puts the back of them 0.34 m
 * out, which is against the backrest to a centimetre — the two constraints
 * meet, which is what a bench the right depth for a person means. It does not
 * scale with the figure: a short passenger's feet land nearer the bench and a
 * tall one's further out, which is what happens.
 */
const PAX_SEAT_Z = 0.22;

/**
 * Where they are, in her frame, in BUILT metres.
 *
 * Built and not authored, which is the opposite of the rest of 59-brod.js and
 * is the right way round for this one table. Everything in that file is
 * authored because it is the boat, and the boat scales; a passenger is a
 * person, and where two people sit relative to each other is a shoulder's width
 * apart whatever the hull is. `deckAt` speaks built metres for the same reason
 * and it is what checks every one of these.
 *
 * CLUSTERED AND NOT SPREAD. Nine metres of bench and four people on it, laid
 * out evenly, is a waiting room; the same four in two pairs is a couple, a
 * family and some space between them. The pairs below are 0.6 to 0.8 m apart,
 * which is shoulder to shoulder, and the gaps between the groups are two to
 * three metres.
 *
 * NOBODY IN THE GANGWAY AND NOBODY ON THE STAIR. The companionway is 0.875 m
 * either side of the centreline and the whole 4 m width between the cockpit
 * benches is what you walk from the boarding gate to the foot of it. A figure
 * standing in either is a figure the player has to walk through on the way to
 * the one thing there is to do aboard.
 *
 *   `at`    'well' or 'roof' — which bench, for a sitter
 *   `x, z`  her frame; z is signed, and the sign is which side they are on
 *   `yaw`   `rotation.y` for a rig whose forward is +X: see `yawOfX`. π/2 faces
 *           −z (to port), −π/2 faces +z (to starboard), 0 faces the bow.
 */
const PAX_SIT = [
  // The cockpit, under the awning, backs to the bulwark and knees inboard.
  // Two pairs a side and daylight between them.
  { at: 'well', x: -11.42, s: -1 },
  { at: 'well', x: -10.79, s: -1 },
  { at: 'well', x: -7.95, s: -1 },
  { at: 'well', x: -4.88, s: -1 },
  { at: 'well', x: -11.05, s: 1 },
  { at: 'well', x: -8.62, s: 1 },
  { at: 'well', x: -8.01, s: 1 },
  { at: 'well', x: -3.90, s: 1 },
  // And the upper deck, which is the whole reason it exists: the note over
  // `BROD.decks` says a boat this size puts seats on top of the house because
  // it is the one place they can be COUNTED from the shore. Six heads over the
  // rail is what that claim looks like when it is true.
  //
  // Forward of 5.985 is the funnel casing and aft of −2.52 is the rail across
  // the head of the stair, so the run is between those.
  { at: 'roof', x: -1.90, s: -1 },
  { at: 'roof', x: 0.75, s: -1 },
  { at: 'roof', x: 3.95, s: -1 },
  { at: 'roof', x: -1.35, s: 1 },
  { at: 'roof', x: 2.40, s: 1 },
  { at: 'roof', x: 3.02, s: 1 },
];

/**
 * And the ones on their feet. `y` comes off `deckAt` rather than being written
 * here, which is what makes this table checkable: a station that answers null
 * is a station over the side, and `build` says so rather than standing somebody
 * on the water.
 */
const PAX_STAND = [
  // At the rail on the side decks, looking out — which is what everybody on
  // this crossing is aboard for.
  //
  // AND HARD OUT AGAINST THE BULWARK, WHICH IS NOT A STYLE CHOICE. The side
  // deck is the deckhouse at |z| 2.03 and the hull outside it, and the hull
  // narrows: 1.10 m of walkway amidships and 0.69 at x 6.20. A figure standing
  // in the middle of that with a 0.36 m berth round them leaves a slot 0.06 m
  // wide at the forward end, which is not a passenger, it is a locked door
  // between the cockpit and the foredeck. Walked into on the built page,
  // twice: `x 6.20, z 2.45` was one of these and the walk test stopped dead
  // there with the bow six metres away.
  //
  // So the rule is |z| ≥ 2.48 + the berth, which is 0.45 m of clear deck
  // inboard of anybody, and it only holds where the sheer is wide enough to
  // stand somebody that far out — which is x −9.5 to 4.55 and nowhere forward
  // of it. Standing at the rail is what these people would do anyway; the
  // constraint and the pose want the same thing.
  { x: 3.60, z: -2.82, yaw: Math.PI / 2 },
  { x: -1.70, z: 2.88, yaw: -Math.PI / 2 },
  // A pair together at the starboard rail. Two people 0.65 m apart looking at
  // the same thing is the cheapest thing in this file that reads as company.
  { x: 1.20, z: 2.86, yaw: -Math.PI / 2 },
  { x: 1.85, z: 2.86, yaw: -Math.PI / 2 },
  // Two forward on the foredeck, which has no deckhouse in the middle of it
  // and so no width problem at all. Clear of the mast, which stands at x 7.77
  // on the centreline and is 0.25 across.
  { x: 8.20, z: -1.30, yaw: 0 },
  { x: 8.70, z: 1.05, yaw: 0.35 },
  // And two up top between the benches, where the deck is walkable to 5.985 and
  // the rail is at |z| 1.925.
  { x: 4.60, z: -0.55, yaw: 0 },
  { x: 3.60, z: 0.62, yaw: -0.60 },
];

/**
 * The hash, and RULE 4 is why there is one.
 *
 * Not one draw off `rng` anywhere in here. The beach layout is downstream of a
 * single stream and `buildBrod` is called from the same load as `buildJadrija`,
 * so one draw taken here would move every parasol, bather and hut on the shore
 * — `__fr.stats().jadrija.census` is the proof and it reads
 * `{seen: 446, thin: 333, plain: 86, rich: 27}` on either side of this file.
 *
 * The same two lines as `jit` in the shore build and `laneJit` in 46-backlane,
 * and copied a third time rather than imported for the reason that file gives:
 * a hash is pure, two callers landing on the same (i, k) costs nothing, and
 * what a shared one would cost is a dependency on a file that belongs to
 * somebody else's evening.
 */
function paxJit(i, k) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * What passengers are wearing, which is not what bathers are wearing.
 *
 * The instanced rig asks three questions of every instance — skin, swimwear,
 * hair — and `fg.shirt` answers the first of them differently for the trunk
 * layer only, which is how one pair of meshes puts a t-shirt on somebody. See
 * the note in `flush`.
 *
 * Two thirds of this boat is dressed and a third of it is not, and that is the
 * one thing that separates these people from the beach fifty metres behind
 * them: you swim at Jadrija in a swimsuit and you go into Šibenik in a shirt,
 * and the ones who did not bother are the ones going home.
 */
const PAX_SKIN = [
  [0.760, 0.585, 0.450], [0.690, 0.505, 0.375],
  [0.845, 0.680, 0.560], [0.520, 0.370, 0.270],
];
const PAX_SWIM = [
  [0.780, 0.220, 0.240], [0.140, 0.300, 0.560], [0.930, 0.870, 0.300],
  [0.900, 0.900, 0.910], [0.180, 0.480, 0.420], [0.850, 0.470, 0.620],
];
const PAX_HAIR = [[0.120, 0.095, 0.080], [0.300, 0.200, 0.110],
  [0.560, 0.470, 0.360]];
// Linen, faded cotton, a striped top, a navy polo, a sun dress. Nothing
// saturated: everything on this coast in August has had a fortnight of sun on
// it, and a pure red shirt in a frame of limestone and sea reads as a traffic
// cone.
const PAX_SHIRT = [
  [0.880, 0.870, 0.840], [0.760, 0.780, 0.800], [0.300, 0.360, 0.470],
  [0.820, 0.620, 0.420], [0.560, 0.640, 0.560], [0.900, 0.840, 0.700],
];

/**
 * ── AND EIGHT OF THEM ARE REAL PEOPLE ──────────────────────────────────────
 *
 * Misha, 19 Sep 2026: *"replace all those marionettes that are now on the
 * boat with more realistic people and animals"*.
 *
 * They are not marionettes, they are the INSTANCED tier — the same two rigs
 * the beach draws a hundred and twenty people with, at 3 036 triangles a
 * head. That tier is right for a promenade seen from forty metres and it is
 * the wrong tier for a bench you are sitting next to: the shore has known
 * this since the terraces were built, which is why the eight blobs in
 * `wheelBlobs` exist and why the people you can walk up to at Jadrija are
 * drawn with them.
 *
 * The boat never had that second tier. It has one now, and it is eight of
 * them, and it is the EIGHT WHO ARE STANDING — the pair at the starboard
 * rail, the two on the foredeck, the two up top, the ones at the side decks.
 * Standing is where the tier change pays: they are at your eye height, on the
 * side deck you squeeze past, and the walk from the boarding gate to the
 * stair goes within a metre of three of them. The fourteen sitters stay
 * instanced for now — a seated blob wants the thigh solve at the top of this
 * file done a second time in bone deltas, and that is its own evening.
 *
 * PARENTED TO THE HULL, which is the whole reason this is eight lines and not
 * a machine. The long note above explains that the instanced tier could not
 * be a child of the boat — the scratch skeleton is shared by the whole crowd
 * — and had to have her matrix composed on the outside of every figure's own
 * instead. A skinned figure is an ordinary Object3D with its own mesh, so it
 * simply goes in the group: `boat.add(mesh)`, place it in her frame once, and
 * the heel, the trim, the pitch in a swell and the four and a half kilometres
 * of channel all come free and exact.
 */
const PAX_SKIN_N = 8;
/**
 * And the cockpit's eight, seated.
 *
 * THE SEAT HEIGHT IS THE CLIP'S PROBLEM AND NOT THIS FILE'S, which is the
 * whole reason these can be done at all and the instanced ones needed the
 * thigh solve at the top of this file. The instanced `sit` is a hand-posed
 * scratch skeleton authored for the lip of the lowest platform at Jadrija —
 * hip 0.14 m up, feet hanging over water — so on a 0.49 m plank its feet stop
 * 0.17 m short of the deck and `PAX_THIGH` has to drop the knee to reach it.
 * A blob's seated clips are BAKED, off the café chairs on the terrace at
 * Jadrija, and they are placed by putting the figure's origin on the FLOOR
 * and letting the clip put the backside on the seat — which is what the
 * terrace does, and a café chair and a boat's bench are the same height to
 * four centimetres.
 *
 * So the sole under the plank is the whole of the placement, and the four
 * clips below are what people on a ferry are doing: hands in the lap, sitting
 * up, talking to whoever is beside them, leaning forward on their knees.
 *
 * BOTH BENCHES, which the first cut of this held back from on a budget: the
 * cockpit's eight went on blobs and the upper deck's six stayed instanced,
 * on the argument that the roof is seen from the top of the stair and no
 * nearer. That is true of the stair and not of the upper deck, which is a
 * place you go and sit — it is the whole reason it was built, see the note
 * over `BROD.decks` — and a bench you are sitting ON is the closest anybody
 * gets to any of these people. Measured at 2560 by 1440 with the whole
 * channel in frame: 61 fps either way, which is the vsync cap, so the six
 * cost nothing anybody can see.
 *
 * The one who stays an instance is the child. A blob is an adult and a
 * 0.68-scale adult is not a child, it is a small adult.
 */
const PAX_SKIN_SIT = 14;
const PAX_SIT_CLIPS = ['sitlap', 'sit', 'sittalk', 'sitfwd'];

/**
 * ── AND SOMEBODY'S DOG ─────────────────────────────────────────────────────
 *
 * Misha, 19 Sep 2026: *"replace all those marionettes that are now on the boat
 * with more realistic people and animals"* — and the animal is a dog, because
 * on this coast it is always a dog. Every boat that runs between a beach and a
 * town in August has one aboard, standing where it can see over the side, and
 * it belongs to whoever is sitting nearest.
 *
 * THE PUG OFF THE PROMENADE, which is the same trick the passengers are: he is
 * `dog.fr3d` out of the payload, the 24-bone quadruped `skinnedFigure` already
 * takes, and the shore has been drawing him since the beach was built. A
 * second copy is one inflate and 3 000-odd triangles.
 *
 * He has TWO CLIPS and that decided the pose: the bake has `idle`, `trot` and
 * `shake` and nothing else, so a dog lying under a bench was never on the
 * table. Standing is what the clip gives and it is also what a dog on a boat
 * does — they do not settle while the engine is running.
 *
 * In the cockpit, off the port bench, looking out over the side at the water
 * going past. Clear of the gangway — the walk from the boarding gate to the
 * stair is 4 m across and he is 1.9 out of the middle of it — and he goes in
 * `solid` with the people, so you walk round him rather than through him.
 */
const PAX_DOG = { x: -6.40, z: -1.90, yaw: Math.PI / 2, r: 0.30 };

/**
 * Build the passengers and hand back something `59-brod.js` can flush.
 *
 * `deckAt` comes in as a callback rather than being re-derived here, because
 * it is the walkable model and there is only supposed to be one of those. It
 * is the same function the player's own feet are on.
 *
 * `boat` is the group everything on her is a child of — see PAX_SKIN_N.
 */
async function buildBrodPax(scene, deckAt, boat) {
  const rigs = {};
  for (const [sex, key] of [['m', 'bather_m_fr3d'], ['f', 'bather_f_fr3d']]) {
    // Re-inflated rather than borrowed off the beach's crowds, which live in
    // `buildJadrija`'s closure. 25 KB of payload and one more copy of a 3 036
    // triangle rig is cheaper than an accessor reaching down the concatenation
    // into somebody else's scope, and it means the boat's people do not care
    // whether the shore has finished building.
    rigs[sex] = await loadRig(key);
  }
  if (!rigs.m && !rigs.f) return null;

  // Everybody, resolved out of the two tables above, before any crowd is made:
  // the cap a crowd is built with is the number of people of that sex and
  // `flush` stops dead at it, so the count has to be known first.
  const cast = [];
  const skipped = [];
  const W = BROD_BENCH.well, R = BROD_BENCH.roof;

  const paint = (i, fg) => {
    // Every one of these is a hash of the figure's index. Same shape as the
    // beach's `pick`, without the stream.
    const p = (a, k) => a[(paxJit(i, k) * a.length) | 0] || a[0];
    fg.skin = p(PAX_SKIN, 11);
    fg.suit = p(PAX_SWIM, 12);
    fg.hair = p(PAX_HAIR, 13);
    fg.shirt = paxJit(i, 14) < 0.66 ? p(PAX_SHIRT, 15) : null;
    fg.seed = paxJit(i, 16);
    // A child every seventh person or so, at 0.72 of the rig's 1.696 m, which
    // is 1.22 m — a seven-year-old. Their feet do not reach the deck off the
    // bench and that is not a defect: on a 0.49 m plank a child's feet swing,
    // and the seated solve above scales with the figure, so they do.
    const kid = paxJit(i, 17) < 0.15;
    fg.scale = kid ? 0.68 + paxJit(i, 18) * 0.08
      : 0.92 + paxJit(i, 18) * 0.16;
    fg.amp = 0.40 + paxJit(i, 19) * 0.13;
    fg.gait = paxJit(i, 20) * TAU;
    fg.hidden = false;
    return fg;
  };

  let i = 0;
  for (const p of PAX_SIT) {
    const B = p.at === 'well' ? W : R;
    const z = p.s * (B.zIn + PAX_SEAT_Z);
    // The sole under the bench, which is the check that matters: a bench
    // station whose deck has run out is a bench station over the water.
    if (deckAt(p.x, p.s * (B.zIn - 0.30)) == null) { skipped.push(p.x); continue; }
    cast.push(paint(i++, {
      mode: 'sit',
      x: p.x, y: B.top, z,
      // Knees inboard: a figure on the starboard bench faces −z, which for a
      // rig whose forward is local +X is a yaw of +π/2. See `yawOfX`.
      yaw: p.s > 0 ? Math.PI / 2 : -Math.PI / 2,
      thigh: PAX_THIGH,
      bench: B,
    }));
  }
  for (const p of PAX_STAND) {
    const y = deckAt(p.x, p.z);
    if (y == null) { skipped.push(p.x); continue; }
    cast.push(paint(i++, { mode: 'stand', x: p.x, y, z: p.z, yaw: p.yaw }));
  }

  // Which rig each of them is on. Drawn off the hash like everything else, and
  // resolved after the cast is closed so a crowd is never built with a cap it
  // can overrun.
  const by = { m: [], f: [] };
  for (let k = 0; k < cast.length; k++) {
    const want = paxJit(k, 21) < 0.48 ? 'f' : 'm';
    by[rigs[want] ? want : (rigs.m ? 'm' : 'f')].push(cast[k]);
  }

  const crowds = [];
  for (const sex of ['m', 'f']) {
    if (!rigs[sex] || !by[sex].length) continue;
    const c = makeCrowd(scene, rigs[sex], by[sex].length);
    for (const fg of by[sex]) c.figures.push(fg);
    crowds.push(c);
  }
  if (!crowds.length) return null;

  /**
   * How wide a berth to give somebody, in her frame.
   *
   * A person is not scenery: the deck is 4 m across between the benches and if
   * the twenty-two of them can be walked through then what is aboard is a
   * hologram. `59-brod.js` asks this before every step, which is 22 distance
   * tests a frame and is nothing.
   *
   * A sitter's radius is centred on their KNEES and not on their hips — the
   * hips are on a bench nobody can stand on anyway, and what actually sticks
   * out into the gangway is a pair of legs. `PAX_TOE` is where the toes are, so
   * two thirds of the way out is the shin.
   */
  const solid = [];
  // The dog first, so that a passenger's ring can never quietly replace him if
  // somebody puts one on the same spot: both are in the list and both refuse.
  solid.push({ x: PAX_DOG.x, z: PAX_DOG.z, r: PAX_DOG.r });
  for (const fg of cast) {
    if (fg.mode === 'sit') {
      const out = PAX_TOE * fg.scale * 0.62;
      solid.push({ x: fg.x, z: fg.z - Math.sign(fg.z) * out, r: 0.34 });
    } else {
      solid.push({ x: fg.x, z: fg.z, r: 0.36 });
    }
  }

  // ── the eight who are real ────────────────────────────────────────────
  //
  // Taken off `wheelBlobs`, which is where the shore parks the eight parsed
  // bather blobs and the material options they are built with. Borrowed and
  // not re-inflated: unlike the two instanced rigs at the top of this
  // function, these are 150 KB apiece and the shore has already paid for
  // them. If the shore has not finished building yet there are none, and the
  // boat is exactly what it was before this existed.
  const real = [];
  // `wheelBlobs` is block-scoped inside the shore's own build, so this comes
  // through the one accessor on the module — see `blobs` in 43-jadrija.js.
  const blobs = (typeof jadrija !== 'undefined' && jadrija && jadrija.blobs)
    ? jadrija.blobs() : null;
  /** One blob, placed in her frame once and told what it is doing. */
  const upgrade = (fg, k, y, clip) => {
    const f = blobs.make ? blobs.make(k % blobs.parsed.length)
      : skinnedFigure(blobs.parsed[k % blobs.parsed.length], blobs.opt);
    f.mesh.position.set(fg.x, y, fg.z);
    f.mesh.rotation.y = fg.yaw;
    // A hull that is 22 m long and 460 m from the origin puts a figure well
    // outside anything three.js can cull it by from its own geometry, and a
    // passenger that vanishes when the bow swings is worse than no passenger.
    // Everything else on this boat is drawn unconditionally.
    f.mesh.frustumCulled = false;
    f.play(clip);
    boat.add(f.mesh);
    // And the instance they were standing in for stands down. `fg.hidden` is
    // the flag `makeCrowd`'s own flush reads — see 42-crowd.js — so this is
    // the whole of the swap and there is never a moment with both.
    fg.hidden = true;
    real.push({ f, fg });
  };
  if (boat && blobs && blobs.parsed && blobs.parsed.length) {
    // Nothing moves them again — they are people standing at a rail and
    // sitting on a bench — so the only per-frame cost is the clip. The
    // standing ones first, then the cockpit's benches.
    let k = 0;
    for (const fg of cast) {
      if (k >= PAX_SKIN_N) break;
      // Not the children: the blobs are eight adults, and a 0.68-scale adult
      // is not a child, it is a small adult.
      if (fg.mode !== 'stand' || fg.scale < 0.85) continue;
      upgrade(fg, k++, fg.y, 'idle');
    }
    // AND A PHONE GETS THE STANDERS AND NOT THE SITTERS. 21 blobs is 161 323
    // triangles and 21 draw calls against the instanced tier's 22 calls for
    // everybody, which is free on a laptop and is not free on the device this
    // is most often played on — `IS_SMALL` is the game's own name for that
    // device and every other tier in this file answers to it. The seven who
    // are standing are the ones at your eye height on the side deck, so they
    // are the seven worth paying for.
    const sitN = typeof IS_SMALL !== 'undefined' && IS_SMALL ? 0 : PAX_SKIN_SIT;
    let j = 0;
    for (const fg of cast) {
      if (j >= sitN) break;
      if (fg.mode !== 'sit' || fg.scale < 0.85) continue;
      // The SOLE and not the plank — see PAX_SKIN_SIT. `B.y` is authored and
      // `B.top` is built, which is the one trap in this table.
      upgrade(fg, k + j, fg.bench.y * BROD_K,
        PAX_SIT_CLIPS[j % PAX_SIT_CLIPS.length]);
      j++;
    }
  }

  // ── the dog ───────────────────────────────────────────────────────────
  //
  // Loaded here rather than borrowed off the shore for the two rigs' own
  // reason at the top of this function: 25 KB of payload against an accessor
  // reaching into somebody else's closure for an object that is being posed
  // by a state machine on the promenade. This one is standing still.
  let dog = null;
  if (boat && typeof PAYLOAD !== 'undefined' && PAYLOAD.dog_fr3d) {
    try {
      dog = await loadSkin('dog_fr3d',
        { spec: 0.05, specPower: 20, body: 'base *= vVCol;' });
    } catch (e) { dog = null; }
  }
  if (dog) {
    const dy = deckAt(PAX_DOG.x, PAX_DOG.z);
    if (dy == null) { dog = null; } else {
      dog.play('idle', { fade: 0 });
      dog.mesh.position.set(PAX_DOG.x, dy, PAX_DOG.z);
      dog.mesh.rotation.y = PAX_DOG.yaw;
      dog.mesh.frustumCulled = false;
      boat.add(dog.mesh);
    }
  }

  let drawn = 0;
  let lastT = -1;
  return {
    /** Everybody, posed in her frame and composed with her world matrix. */
    flush: (t, cam, frame) => {
      drawn = 0;
      for (const c of crowds) { c.flush(t, cam, frame); drawn += c.drawn; }
      // And the eight, which need nothing but their own clock: they are
      // children of the hull and she has already been posed this frame.
      const dt = lastT < 0 ? 0 : Math.max(0, Math.min(0.1, t - lastT));
      lastT = t;
      for (const r of real) {
        r.f.mesh.visible = true;
        r.f.update(dt);
      }
      drawn += real.length;
      if (dog) { dog.mesh.visible = true; dog.update(dt); drawn += 1; }
    },
    /** Off the screen the instant she is: the layers live in the scene, not
     *  under `group`, so nothing else takes them down with her. */
    hide: () => {
      for (const r of real) r.f.mesh.visible = false;
      if (dog) dog.mesh.visible = false;
      if (!drawn) return;
      for (const c of crowds) for (const L of c.layers) L.geo.instanceCount = 0;
      drawn = 0;
    },
    /** True if (x, z) in her frame is inside somebody. */
    solid: (x, z) => {
      for (const s of solid) {
        const dx = x - s.x, dz = z - s.z;
        if (dx * dx + dz * dz < s.r * s.r) return true;
      }
      return false;
    },
    stats: () => ({
      n: cast.length,
      sit: cast.filter((f) => f.mode === 'sit').length,
      stand: cast.filter((f) => f.mode === 'stand').length,
      well: cast.filter((f) => f.bench === W).length,
      roof: cast.filter((f) => f.bench === R).length,
      kids: cast.filter((f) => f.scale < 0.85).length,
      shirts: cast.filter((f) => f.shirt).length,
      rigs: crowds.length,
      // How many of them are drawn with a blob rather than an instance, and
      // what those cost. See PAX_SKIN_N.
      real: real.length,
      realTris: real.reduce((a, r) => a + r.f.tris, 0),
      dog: dog ? dog.tris : 0,
      // What she costs, and both halves of it matter. `layers` is the draw
      // calls — one instanced mesh per rig part per rig — and it is the number
      // that does NOT go down when the crowd is small, which is why there are
      // two rigs and not eight. `tris` is the whole ship's company.
      layers: crowds.reduce((a, c) => a + c.layers.length, 0),
      tris: crowds.reduce((a, c) => a + c.figures.length * c.tris, 0),
      drawn,
      skipped,
    }),
    /**
     * The crowds and the cast as they were resolved, for a probe and nothing
     * else.
     *
     * Being on a moving deck is the one claim in this file that cannot be
     * checked from a screenshot: a passenger drawn in world metres at the
     * berth is in exactly the right place at the berth, and the failure only
     * shows up as a row of people standing on the water a kilometre astern.
     * With these a probe can read the instance buffer straight — layer 0 is
     * the pelvis — and compare it against `where()`, which is `localToWorld`
     * on the same matrix. See the note over `frame` in 42-crowd.js.
     */
    crowds, cast,
    /** And the eight on blobs, for the same probe — see PAX_SKIN_N. */
    real,
    /** And the dog, likewise — see PAX_DOG. */
    get dog() { return dog; },
  };
}

// -----------------------------------------------------------------------------
// ── AND THE GULLS ────────────────────────────────────────────────────────────
//
// Misha, 19 Sep 2026: *"replace all those marionettes that are now on the boat
// with more realistic people and animals"*. The people are above, the first
// animal was the dog, and *animals* is a plural. On this coast the second one
// is not a choice: a boat that runs between a beach and a town in August has
// gulls on it and gulls behind it, and a ferry crossing 3 850 m of channel
// with an empty sky over her wake is the one thing in this game nobody who has
// taken that boat would believe.
//
// There are gulls here already — 44-birds.js keeps a ring of four species
// round the camera, and a probe counts 72 of them live off the channel — so
// this is not a second bird. It is `GULL`, `birdRig` and `beatShape` out of
// that file, which is the model, the colours and the wingbeat, with a
// different question asked of them.
//
// ── the question, which is that they hold station on a moving hull ───────────
//
// Everything on the Brod is written in HER frame and the long note at the top
// of this file explains why: she is 460 m from the origin, she heels, she
// trims, and anything placed in world metres sails out from under itself at
// eight knots. The gulls are that problem twice over, and the two halves want
// DIFFERENT frames:
//
//   - the ones on her rails are furniture. They get her full matrix, heel and
//     trim with it, exactly as a passenger does, so a bird on the capping
//     leans with the rail it is standing on.
//   - the ones astern are not on her at all. They fly in a LEVELLED copy of
//     her frame — her position and her heading, and none of her roll. A gull
//     hanging over the wake that banked 3° every time the hull took a wave
//     would be a gull nailed to the transom.
//
// Both come off one `boat.matrixWorld.decompose` a frame, and that is the
// whole of the machinery.
//
// ── what a gull behind a ferry actually does ─────────────────────────────────
//
// Almost nothing, and that is the observation the following flock is built on.
// It does not fly along behind the boat; it hangs in the air she has already
// pushed, holds a spot ten to thirty metres astern, and slides sideways across
// the others without a wingbeat for half a minute at a time. So a follower is
// NOT a flight integrator with a waypoint — it is a critically damped spring
// on to a station that wanders, which is what holding station means and which
// converges instead of circling. Measured at 1 600 m run, at cruise: twelve of
// them in the air, the mean **16.7 m abaft the transom** and the furthest
// 26.8, which is the shape of it.
//
// The heading falls out of that for free and it is the one piece of real
// physics in here: a bird's velocity through the AIR is its velocity in her
// frame plus her own speed, so `headingTo(vx + speed, vz)` points a
// station-keeping bird at the bow while she is making way and points it where
// it is going when she is stopped. One formula, no blend, and it is why they
// face forward over the wake without being told to.
//
// ── and fast mode ────────────────────────────────────────────────────────────
//
// `brodFast` steps her integrator eight times on one frame, so the coast goes
// by at ×8 and you still cross her deck at your own pace. The gulls come with
// her and do not notice, because every one of them is a position in her frame
// and her frame is what moved. That is the defensible answer and the other one
// was thought through and thrown out: integrated in world metres they would
// fall eight times too slowly and be a kilometre astern four seconds after the
// button.
//
// ── cost ─────────────────────────────────────────────────────────────────────
//
// Two instanced draws for the lot, whatever the count — `birdRig` again — and
// a bird is a measured 105 triangles: 85 for the spindle and the tail fan, 10
// for each wing. `IS_SMALL` gets six of them rather than none, which is the
// opposite call to the one the blobs above make and is made on the same
// grounds: the twenty-one who are drawn as blobs cost 161 323 triangles and 21
// draw calls, and fourteen gulls cost 1 470 and two. There is nothing on a
// phone to save here, and what a phone would lose is the only thing moving in
// the sky over her wake.
// -----------------------------------------------------------------------------

const BROD_GULL = {
  n: 14,                     // on a laptop
  small: 6,                  // and on a phone — see the note above
  // How far a bird's middle stands over the thing it is standing on. There are
  // no legs on this model and there is no need for any: 0.11 m puts a gull's
  // body clear of the rail, and at that height the toes nobody drew are
  // exactly where the eye puts them.
  stand: 0.11,
  // The stance of a standing gull, nose up. `pitch` is positive bill-up in the
  // flight model — see the beat in 44-birds.js.
  stance: 0.21,
  // How close you get before it goes. 3.2 m is a stride and a half, which is
  // about what a harbour gull that sees people all day will allow, and it is
  // wide enough that the flush reads as a reaction to YOU rather than as a
  // bird that happened to leave.
  flush: 3.2,
  // The speed she counts as under way at, for the birds' purposes. She works
  // up to 8.0 m/s at 0.26 m/s², so 2.5 is about ten seconds after let-go —
  // which is when the rail empties, and it empties as she gathers way rather
  // than on the horn.
  way: 2.5,
  // The spring, in rad/s. 0.55 is a time constant of 1.8 s and a bird that
  // takes about six seconds to slide 20 m across the wake; at 1.2 they dart
  // between stations like flies and the whole flock reads as insects.
  chase: 0.55,
  turn: 1.1,                 // rad/s the heading may chase the airflow at
  // Nothing may sit lower than this over the hull herself. Her masthead is
  // 10.34 m over the waterline in her own frame and the ensign is under that,
  // so a station that crosses her plan is lifted clear of both.
  clear: 12.5,
};

/**
 * Where a gull will stand on her, in HER frame and in built metres.
 *
 * Every one of these is resolved off the geometry the boat is drawn from
 * rather than typed — `brodSheer` for the capping, `BROD_ROOF` for the upper
 * deck's rail, the casing's own lip — for the reason `deckAt` is a callback
 * further up this file: a perch written down is a perch that is in the air the
 * next time the hull is scaled.
 *
 *   `cap`   the bulwark capping, which is 0.42 m of flat plank running her
 *           whole length and is the best gull perch on the boat
 *   `stem`  the stemhead post, where the two pulpit rails meet on the
 *           centreline
 *   `rail`  the upper deck's top rail, 0.90 m over the roof
 *   `case`  the rolled lip round the top of the funnel casing
 *
 * ORDERED, because `IS_SMALL` takes the front of this list and not a sample of
 * it: the first three are the one you walk up to in the cockpit, the one on
 * the stem that is a silhouette from anywhere on the boat, and the one that
 * rides across.
 *
 * Two of them are marked `stay`, and that is not a shortcut either. Most of a
 * rail empties as a boat gathers way and one or two do not — they turn, face
 * the wind and ride the whole crossing — and if every last one went up at
 * let-go the deck would be conspicuously empty for nine and a half minutes.
 */
const BROD_PERCH = [
  // The port quarter, right aft. The awning's canvas ends at x −12.51 so this
  // is in the open, and at 2.91 m in her frame it stands at the eye height of
  // somebody on the cockpit sole, which is 2.86. You meet it on the way to the
  // stair.
  { at: 'cap', x: -12.70, s: -1 },
  // The stemhead. The rails converge on this post and there is nothing within
  // 0.40 m of it, which is the only place on her a 0.66 m bird fits without
  // arranging the geometry round it — every other gap in the pulpit is 0.64 m
  // between stanchions and the tail fan would be inside one.
  { at: 'stem', x: 13.545, s: 1 },
  // The casing lip, to starboard of the exhaust, which stands out of the top
  // of it at z −0.60 and goes on up another metre. It is one of the two that
  // ride across, and it is the first of them because `IS_SMALL` gets three
  // perches and a rail with nobody left on it is not the picture.
  { at: 'case', x: 7.00, s: 1, stay: true },
  { at: 'cap', x: -13.15, s: 1 },
  // The second rider, and STARBOARD, which is not where it was. `enter` puts
  // you on the PORT side deck at x 1.20 — the port rail perch is 2.09 m from
  // your head the instant you board, inside the 3.2 m flush — so the bird
  // meant to ride the whole crossing went up every single time in the moment
  // you got on, and the stat that said so read `perched: 1` where it should
  // have read 2. Over here it is 8 m from the boarding mark. The starboard
  // bench has sitters at x −1.35, 2.40 and 3.02, so 5.20 is 2.18 m clear of
  // the nearest head.
  { at: 'rail', x: 5.20, s: 1, stay: true },
  // And the port one, which stays where it was for exactly the reason the
  // note above moved the other one: a gull clattering off the rail over your
  // head as you step aboard is the best thing on this boat. The port bench
  // has people at x −1.90, 0.75 and 3.95, so 2.40 is a clear 1.55 m from the
  // nearest of them.
  { at: 'rail', x: 2.40, s: -1 },
];

/**
 * The gulls on and behind her.
 *
 * Separate from `buildBrodPax` and synchronous, which is deliberate: the
 * passengers are two payload rigs and eight borrowed blobs, any of which can
 * fail to arrive, and a boat with nobody on her should still have her gulls.
 * `scene` for the two instanced layers, `boat` for the frame, and `helm` for
 * the two things 59-brod.js knows and this file cannot see — how fast she is
 * going, and where your feet are on her deck.
 *
 * RULE 4: `mulberry32` and not `rng`, for the reason `paxJit` gives at length.
 * This is its own stream and it moves nothing on the beach.
 */
function buildBrodGulls(scene, boat, helm) {
  if (!boat || typeof GULL === 'undefined' || !GULL) return null;
  const small = typeof IS_SMALL !== 'undefined' && IS_SMALL;
  const N = small ? BROD_GULL.small : BROD_GULL.n;
  const rnd = mulberry32(CONFIG.seed ^ 0x6b17d1);
  const rig = birdRig(scene, N);

  // Her transom, off the loft's last station rather than typed: every distance
  // astern in this file is measured from it.
  const STERN = BROD_ST[BROD_ST.length - 1][0];

  // ── the perches, resolved ──────────────────────────────────────────────────
  // THREE PERCHES ON A PHONE AND NOT SIX, which is the one place `IS_SMALL`
  // changes the shape of this and not just the count. Six birds with six
  // perches is a boat with nothing in the air over it while she is alongside,
  // and the wheeling is half of what says the gulls are hers.
  const perches = [];
  const nP = Math.min(BROD_PERCH.length, small ? 3 : N);
  for (let i = 0; i < nP; i++) {
    const p = BROD_PERCH[i];
    const [sy, hw] = brodSheer(p.x);
    const o = { x: p.x, stay: !!p.stay };
    if (p.at === 'cap') {
      // The middle of the capping: `deckAt` takes `BROD_BULK` off the sheer's
      // half-beam to find its inboard face, so half of that back out again is
      // the middle of the plank.
      o.y = sy; o.z = p.s * (hw - BROD_BULK * 0.5);
    } else if (p.at === 'stem') {
      // The pulpit rail's own height over the sheer — see the guardrail in
      // `brodProto`, where the top wire runs at BROD_P(0.72) and comes in to
      // this post on the centreline.
      o.y = sy + 0.72; o.z = 0;
    } else if (p.at === 'rail') {
      o.y = BROD_ROOF * BROD_K + 0.90; o.z = p.s * 1.19 * BROD_K;
    } else {
      o.y = (BROD_ROOF + 0.98) * BROD_K; o.z = p.s * 0.55;
    }
    o.y += BROD_GULL.stand;
    // Facing out over the water, which is what a bird on a rail does — except
    // on the stem, where out over the water is over the bow.
    o.yaw = p.at === 'stem' ? headingTo(1, 0) : headingTo(0, p.s);
    perches.push(o);
  }

  // ── the birds ──────────────────────────────────────────────────────────────
  const flock = [];
  for (let i = 0; i < N; i++) {
    const p = i < perches.length ? perches[i] : null;
    // The ones with nowhere to stand start ON their ring and not at the
    // origin, which in her frame is the middle of the engine room. They are
    // built at the berth and she is moored there, so the ring is where they
    // would be — and a flock that starts inside the hull and springs out of it
    // is the first thing on the screen the moment she is built.
    const a = rnd() * TAU, R = 19 + rnd() * 24;
    flock.push({
      p, on: !!p, land: false,
      x: p ? p.x : Math.cos(a) * R,
      y: p ? p.y : 9 + rnd() * 10,
      z: p ? p.z : Math.sin(a) * R,
      yaw: p ? p.yaw : a, pitch: 0, roll: 0,
      vx: 0, vy: 0, vz: 0,
      // A tenth either way on the size and the tint, for the reason
      // 44-birds.js gives: fourteen identical gulls is a texture.
      s: 0.88 + rnd() * 0.26, tint: 0.90 + rnd() * 0.18,
      ph: rnd() * TAU, flap: 0, fold: p ? 0.32 : 1,
      // How a folded wing sits on THIS bird, which is the one thing about the
      // model that had to change to put a gull a metre from your face — see
      // `draw` in 44-birds.js. The rafting birds out in the channel keep the
      // two flat plates sticking out sideways that they have always had, at
      // fifty metres, where nobody can tell; these fold back over the tail,
      // because at a metre and a half everybody can.
      droop: -0.14, sweep: 0.62,
      beat: false, duty: rnd() * 3,
      // Its station astern: how far back it likes to sit, how far out on the
      // quarter, and how high. Three slow sines on top of that, at three rates
      // it shares with nobody, which is what makes the flock slide across
      // itself instead of translating as a lump.
      //
      // 5 to 25 m and 3.5 to 12 m up, and both were wider on the first cut —
      // 4 to 30 astern and up to 13.5 high. Photographed from off her quarter
      // that put half the flock in the top corner of the frame with the boat
      // in the bottom one, which is a sky with birds in it rather than a boat
      // being followed. What settled it is that the mean came down from 19.5 m
      // to 16.7 and every bird stayed inside the same frame as her wake.
      d0: 5 + rnd() * 20, z0: (rnd() - 0.5) * 22, y0: 3.5 + rnd() * 8.5,
      w1: 0.045 + rnd() * 0.050, q1: rnd() * TAU,
      w2: 0.030 + rnd() * 0.045, q2: rnd() * TAU,
      w3: 0.025 + rnd() * 0.035, q3: rnd() * TAU,
      // And the ring it wheels in while she is not going anywhere.
      orb: a, orbR: R, orbY: 9 + rnd() * 10,
      orbW: (rnd() < 0.5 ? -1 : 1) * (0.030 + rnd() * 0.030),
      // The fidget. `shuffle` is the next time it turns on the spot, `stretch`
      // the next time it opens a wing, `st` the stretch itself running.
      shuffle: rnd() * 4, want: p ? p.yaw : 0,
      stretch: 5 + rnd() * 18, st: 0,
      rest: 25 + rnd() * 70,
      mute: 0, callT: 3 + rnd() * 18,
    });
  }

  // ── scratch ────────────────────────────────────────────────────────────────
  const org = new THREE.Vector3();
  const qFull = new THREE.Quaternion();
  const qLevel = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _f = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _yA = new THREE.Vector3(0, 1, 0);
  const camRight = new THREE.Vector3(1, 0, 0);
  const tgt = { x: 0, y: 0, z: 0 };

  let t = 0, spd = 0, way = 0, stopped = 99;
  let drawn = 0, calls = 0, budget = 2;
  let astern = 0, far = 0;

  /** Where a bird is in the world, in whichever of her frames it lives in. */
  function worldOf(b, out) {
    out.set(b.x, b.y, b.z).applyQuaternion(b.on ? qFull : qLevel).add(org);
    return out;
  }

  /**
   * One call, if anybody is near enough to hear it.
   *
   * The same two rate limits 44-birds.js uses and for the same reason — a bird
   * that has just shouted shuts up, and no more than a couple get out a second
   * — with the budget deliberately meaner, because these fourteen are all
   * inside fifty metres of you and that flock's twenty are spread over a ring
   * 750 m across.
   *
   * The pan wants the camera's right vector and this file is handed the camera
   * POSITION, so it reads the one off the global. Guarded, because the boat is
   * built before 90-app.js has finished and a missing pan is a centred call
   * rather than an exception.
   */
  function cry(b, alarm, cam) {
    if (!audio || !cam || b.mute > 0 || budget < 1) return;
    if (typeof state !== 'undefined' && state && state.phase === 'intro') return;
    worldOf(b, _t);
    const dx = _t.x - cam.x, dy = _t.y - cam.y, dz = _t.z - cam.z;
    const d = Math.hypot(dx, dy, dz);
    // `NOT WITHIN` and not `BEYOND`, which is 44-birds.js's NaN closed the same
    // way: every comparison against NaN is false, and this one is negated.
    if (!(d <= 260)) return;
    budget -= 1;
    b.mute = 3 + rnd() * 4;
    calls++;
    if (typeof camera !== 'undefined' && camera && camera.matrixWorld) {
      camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    }
    const near = 1 - d / 260;
    const pan = (dx * camRight.x + dy * camRight.y + dz * camRight.z)
      / Math.max(d, 1);
    audio.birdCall('gull', clamp(pan, -1, 1),
      near * near * (alarm ? 1 : 0.7), alarm);
  }

  /**
   * Where a bird wants to be, in the levelled frame.
   *
   * Two shapes and a lerp on `way`: a loose cloud astern when she is making
   * way, and a wide slow ring round her when she is not. The migration between
   * them takes as long as she takes to gather way, which is half a minute, and
   * the spring flies the whole of it — which is the thing you actually watch
   * from the mole, the gulls peeling off her rails and settling in behind her.
   */
  function station(b, out) {
    if (b.land && b.p) {
      // Coming in: a metre over the perch until it is nearly there, then the
      // perch itself. Her heel is ignored here rather than corrected for — at
      // the berth she lies inside 1.5°, which at the outermost perch is 0.08 m,
      // and the bird is drawn on the rail in her full frame the moment it is
      // down.
      const d = Math.hypot(b.x - b.p.x, b.y - b.p.y, b.z - b.p.z);
      out.x = b.p.x; out.z = b.p.z;
      out.y = b.p.y + sat((d - 0.8) / 2.5) * 1.1;
      return;
    }
    const ax = STERN - b.d0 - 4.5 * Math.sin(t * b.w1 * TAU + b.q1);
    const az = b.z0 + 6.0 * Math.sin(t * b.w2 * TAU + b.q2);
    const ay = b.y0 + 2.2 * Math.sin(t * b.w3 * TAU + b.q3);
    const a = b.orb + t * b.orbW * TAU;
    out.x = lerp(Math.cos(a) * b.orbR, ax, way);
    out.z = lerp(Math.sin(a) * b.orbR, az, way);
    out.y = lerp(b.orbY + 2.5 * Math.sin(t * b.w3 * TAU + b.q3), ay, way);
    // And over the boat herself, high enough to clear the mast. Without this
    // the ring alongside runs a bird through the ensign twice a minute.
    if (out.x > STERN - 1.5 && out.x < 15 && Math.abs(out.z) < 5.5) {
      out.y = Math.max(out.y, BROD_GULL.clear);
    }
  }

  /** Off the rail. */
  function up(b, cam) {
    b.on = false;
    b.land = false;
    b.fold = 1;
    b.flap = 1;
    b.beat = true; b.duty = 2.4;
    // It keeps her speed — it was standing on her — so in her frame it starts
    // from rest and falls astern on its own. What it adds is the hop: up, and
    // a shove outboard away from whatever moved.
    b.vx = 0.6; b.vy = 2.6; b.vz = Math.sign(b.z || 1) * 1.4;
    b.rest = 25 + rnd() * 70;
    cry(b, true, cam);
  }

  /** On the rail, and doing something about it. */
  function perched(b, dt, near, cam) {
    const p = b.p;
    b.x = p.x; b.y = p.y; b.z = p.z;
    b.roll = 0;
    b.pitch = damp(b.pitch, BROD_GULL.stance, 6, dt);

    b.shuffle -= dt;
    if (b.shuffle <= 0) {
      b.shuffle = 2.5 + rnd() * 5.5;
      b.want = p.yaw + (rnd() - 0.5) * 1.7;
    }
    // The two that ride across turn and face the wind, which is what they are
    // riding it for. Everybody else looks wherever they were looking.
    const want = way > 0.4 ? headingTo(1, 0) : b.want;
    b.yaw += clamp(angleDelta(b.yaw, want), -1.7 * dt, 1.7 * dt);

    // The wing-stretch, which is the whole difference between a perched bird
    // and a bollard: one wing out and half up, held for a beat, folded again.
    // `fold` does it — there is one hinge in this model and no second pose.
    b.stretch -= dt;
    if (b.stretch <= 0 && b.st <= 0) { b.st = 1.5; b.stretch = 8 + rnd() * 17; }
    if (b.st > 0) {
      b.st -= dt;
      const u = Math.sin(sat(1 - b.st / 1.5) * Math.PI);
      b.fold = 0.32 + 0.60 * u;
      b.flap = 0.22 * u;
      b.ph += GULL.beat * 0.30 * TAU * dt;
    } else {
      b.fold = damp(b.fold, 0.30, 8, dt);
      b.flap = damp(b.flap, 0, 8, dt);
    }

    b.rest -= dt;
    if (b.mute > 0) b.mute -= dt;
    // Three ways off a rail: she gathers way, you walk up to it, or it simply
    // decides to go — and the last of those only counts alongside, because a
    // bird that lifts off mid-channel has nothing to come back to until
    // Šibenik.
    if ((way > 0.45 && !p.stay) || near < BROD_GULL.flush
      || (way < 0.25 && b.rest <= 0)) up(b, cam);
  }

  /** In the air, holding a station. */
  function flying(b, dt, cam) {
    station(b, tgt);
    const W = BROD_GULL.chase;
    b.vx += (W * W * (tgt.x - b.x) - 2 * W * b.vx) * dt;
    b.vy += (W * W * (tgt.y - b.y) - 2 * W * b.vy) * dt;
    b.vz += (W * W * (tgt.z - b.z) - 2 * W * b.vz) * dt;
    // A gull does 19 m/s fleeing and nothing on this boat is worth more than
    // that. The clamp is here for the frame `seek` teleports her three
    // kilometres, where the spring would otherwise hand the integrator a
    // four-figure velocity.
    const v = Math.hypot(b.vx, b.vy, b.vz);
    if (v > GULL.flee) {
      const k = GULL.flee / v;
      b.vx *= k; b.vy *= k; b.vz *= k;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    // Never into the water. Her frame's y is the sea under her, so this is the
    // surface plus a wave either way.
    if (b.y < 1.2) { b.y = 1.2; b.vy = Math.max(b.vy, 0); }

    // Through the AIR, which is her speed plus its own — see the header.
    const wx = b.vx + spd, wz = b.vz;
    const air = Math.hypot(wx, wz);
    const dyaw = air > 0.8
      ? clamp(angleDelta(b.yaw, headingTo(wx, wz)),
        -BROD_GULL.turn * dt, BROD_GULL.turn * dt)
      : 0;
    b.yaw += dyaw;
    // Banking into the turn, at the gull's own number. Increasing yaw swings
    // the nose to port and positive roll lifts the starboard wing, so the two
    // have the same sign.
    b.roll = damp(b.roll,
      clamp(dyaw / Math.max(dt, 1e-3) * GULL.bank, -1.2, 1.2), 5, dt);
    b.pitch = damp(b.pitch, clamp(b.vy / Math.max(air, 3), -0.45, 0.45), 5, dt);

    // It beats when it has lost its place and glides when it has it, which
    // behind a ferry is most of the time: `glide` is 6.5 s against `burst` at
    // 1.7 in the species' own row, and the work term is what takes it off that
    // clock when the station has moved out from under it.
    b.duty -= dt;
    if (b.duty <= 0) {
      b.beat = !b.beat;
      b.duty = (b.beat ? GULL.burst : GULL.glide) * (0.55 + rnd() * 0.9);
    }
    const miss = Math.hypot(tgt.x - b.x, tgt.y - b.y, tgt.z - b.z);
    const work = sat((miss - 3) / 9) + sat(b.vy * 0.6);
    b.flap = damp(b.flap, (b.beat || work > 0.35) ? 1 : 0, 7, dt);
    b.fold = damp(b.fold, 1, 6, dt);
    b.ph += GULL.beat * TAU * dt;

    // Down again, and only on its OWN perch: ownership is one to one, because
    // two birds converging on the same rail is a queue and a queue is a
    // machine. She has to have been stopped for a moment first — coming
    // alongside at Šibenik takes her through 2.5 m/s a long way out, and
    // without the hold they would start landing on a boat still doing four
    // knots.
    if (b.p) b.land = way < 0.15 && stopped > 2.5;
    if (b.land) {
      const d = Math.hypot(b.x - b.p.x, b.y - b.p.y, b.z - b.p.z);
      if (d < 0.45 && Math.hypot(b.vx, b.vy, b.vz) < 2.2) {
        b.on = true;
        b.land = false;
        b.vx = b.vy = b.vz = 0;
        b.want = b.p.yaw;
        b.shuffle = 1 + rnd() * 3;
        b.rest = 25 + rnd() * 70;
      }
    }

    if (b.mute > 0) b.mute -= dt;
    b.callT -= dt;
    if (b.callT <= 0) {
      b.callT = GULL.call[0] + rnd() * GULL.call[1];
      cry(b, false, cam);
    }
  }

  /**
   * One frame. `on` is `group.visible` — she is drawn out to a kilometre and
   * her gulls stop with her, which is the gate `hide` is for the crowd.
   */
  function update(dt, cam, on) {
    if (!on) { rig.hide(); drawn = 0; return; }
    dt = clamp(dt, 0, 0.1);
    t += dt;
    budget = Math.min(2, budget + dt * 0.8);
    spd = helm && Number.isFinite(helm.sp) ? helm.sp : 0;
    way = sat(spd / BROD_GULL.way);
    stopped = way < 0.15 ? stopped + dt : 0;

    // Her two frames, off one decompose. `place` has already run this frame —
    // see the call site in `drawPax` — so this is her attitude now and not
    // last frame's.
    boat.matrixWorld.decompose(org, qFull, _s);
    _f.set(1, 0, 0).applyQuaternion(qFull);
    qLevel.setFromAxisAngle(_yA, yawOfX(_f.x, _f.z));

    // Where you are, in her frame. Your FEET and not the camera whenever you
    // are aboard: in third person the camera is two metres behind you, and a
    // gull that flushed off it would flush after you had walked past it.
    // Ashore there is nothing else to use, and the camera on the mole is close
    // enough to your feet for a 3.2 m radius.
    let px = 1e6, py = 0, pz = 0;
    if (helm && helm.on) {
      px = helm.you.x; py = helm.you.deck + 1.55; pz = helm.you.z;
    } else if (cam) {
      _t.set(cam.x, cam.y, cam.z);
      boat.worldToLocal(_t);
      px = _t.x; py = _t.y; pz = _t.z;
    }

    rig.open();
    let nAir = 0, sum = 0;
    far = 0;
    for (const b of flock) {
      if (b.on) {
        perched(b, dt, Math.hypot(b.x - px, b.y - py, b.z - pz), cam);
      } else {
        flying(b, dt, cam);
        const d = STERN - b.x;
        if (d > 0) { nAir++; sum += d; far = Math.max(far, d); }
      }
      rig.draw(GULL, b, org, b.on ? qFull : qLevel);
    }
    astern = nAir ? sum / nAir : 0;
    drawn = rig.close();
  }

  return {
    update,
    hide: () => { rig.hide(); drawn = 0; },
    stats: () => ({
      n: flock.length,
      perched: flock.reduce((a, b) => a + (b.on ? 1 : 0), 0),
      air: flock.reduce((a, b) => a + (b.on ? 0 : 1), 0),
      landing: flock.reduce((a, b) => a + (b.land ? 1 : 0), 0),
      // How far abaft the transom the followers actually sit, which is the one
      // claim in here a screenshot cannot check and is the number the station
      // was tuned against.
      astern: +astern.toFixed(1),
      far: +far.toFixed(1),
      way: +way.toFixed(2),
      calls,
      drawn,
      tris: drawn * rig.tris,
    }),
    /** The flock and the stations, for a probe. */
    flock, perches,
  };
}
