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
    const f = skinnedFigure(blobs.parsed[k % blobs.parsed.length], blobs.opt);
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
