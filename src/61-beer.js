// -----------------------------------------------------------------------------
// The beer, in your hand.
//
// Misha, 16 Sep 2026: *"yeah let's make the beer drinkable"*, after buying one
// at MINI and finding it only counted.
//
// A BOTTLE AND NO ARM, which is the whole design decision and it is not
// laziness. The rig this game has for a first-person limb is `60-arms.js`, and
// that is three rigid pieces a side authored for a front crawl — its own note
// says the shape of a crawl is a cycle and not a target, and it is driven by
// angles for that reason. Nothing in it holds anything. Modelling a forearm
// and a hand to wrap round a bottle is a second rig, a second set of weights
// and a hand that will be wrong at exactly the distance you look at it.
//
// What you actually see when you drink from a bottle is the BOTTLE. It comes up
// from the bottom of your view, the base swings out, the neck comes to you, and
// the label goes out of shot as it tips. So that is what is drawn: one bottle,
// coming up into frame and going back down. The hand is where a hand is in
// every photograph of somebody drinking — out of shot, behind the bottle.
//
// IT IS ITS OWN PASS, drawn over the frame that is already there, and that is
// not a stylistic choice either: THE WORLD'S NEAR PLANE IS 1.2 m. A bottle you
// are drinking from is half a metre from your eye, which is inside it — the
// first cut parented one to the main camera and it was clipped away entirely,
// invisible in every frame. The near plane is not negotiable (it is what keeps
// a depth buffer honest over a hundred and sixty-nine square kilometres), so
// the bottle gets a scene and a camera of its own with a 2 cm near, copies the
// world camera's field of view and aspect, and is composited on top with the
// depth cleared. That is exactly how `60-arms.js` draws your arms in the
// water, for exactly this reason.
//
// FOUR SWIGS AND IT IS GONE. A 0.5 l bottle is not a sip and it is not one
// gulp either. Each swig is its own little arc — up, tip, hold, down — and the
// level in the glass goes with it, which is the only thing that says this is
// the same bottle you drank from a minute ago.
// -----------------------------------------------------------------------------

const BEER = {
  /**
   * Where it rides when it is just being carried: right, and LOW.
   *
   * Measured off the picture rather than guessed at. At 0.52 m with this lens
   * the frame is 0.58 m tall, so a 0.24 m bottle standing at y −0.255 has its
   * neck at the middle of your view — which is a bottle held up in front of
   * your face, not a bottle in your hand. Your hand is at your hip and what
   * you see of it is the top third.
   */
  rest: [0.275, -0.375, -0.55],
  /** And where the mouth of it goes for a swig — in, up and across. */
  sip: [0.105, -0.115, -0.315],
  /** Radians it tips back on a swig. A bottle you drink from goes a long way. */
  tilt: 1.12,
  /** Seconds: coming up, held there while you swallow, and going back down. */
  up: 0.42,
  hold: 0.72,
  down: 0.50,
  swigs: 4,
  /** Metres. A 0.5 l bottle is 0.24 m tall and 66 mm across the body. */
  h: 0.240,
  r: 0.033,
  neck: 0.0125,
};

function buildBeer() {
  const stage = new THREE.Scene();
  // 2 cm of near, which is what a held object needs and what the world cannot
  // have. The fov and aspect are taken off the world camera every frame so the
  // bottle sits in the same lens as everything behind it.
  const cam = new THREE.PerspectiveCamera(58, 1.78, 0.02, 4);
  // AND IT STANDS WHERE YOU STAND. The bottle hangs off `root`, which is put
  // at the camera's own world position and orientation every frame, and only
  // then is it offset into view space. That is not tidiness: every material in
  // this game runs `applyWater` and `applyHaze` on the fragment's WORLD
  // position, and a bottle sitting at its own scene's origin is a bottle at
  // y = −0.25, which is under the sea. The first cut of this drew a
  // turquoise bottle in full underwater fog on a bar stool in the sun.
  const root = new THREE.Group();
  const g = new THREE.Group();
  // Brown glass, and the glass is the only thing on it. NO LABEL WITH ANYTHING
  // ON IT: every brand at Jadrija that carries a name was supplied by Misha off
  // a photograph or out loud — see the parasols — and the one thing rule 12
  // will not have is a wordmark that came from me. A plain gold band is what a
  // bottle looks like from two feet away anyway.
  const glass = solidMaterial(new THREE.Color(0.255, 0.115, 0.045),
    { spec: 0.85, specPower: 90, vcol: false });
  const band = solidMaterial(new THREE.Color(0.735, 0.600, 0.235),
    { spec: 0.55, specPower: 60, vcol: false });
  const foam = solidMaterial(new THREE.Color(0.930, 0.900, 0.820),
    { spec: 0.35, specPower: 40, vcol: false });
  const B = BEER;
  // The profile of a beer bottle, bottom to top: a base with a heel, the
  // straight of the body, the shoulder, and a neck with a lip on it.
  const prof = [
    [0.000, 0.000], [B.r * 0.92, 0.000], [B.r, 0.012], [B.r, B.h * 0.56],
    [B.r * 0.93, B.h * 0.62], [B.neck * 1.35, B.h * 0.76],
    [B.neck, B.h * 0.80], [B.neck, B.h - 0.012],
    [B.neck * 1.22, B.h - 0.006], [B.neck * 1.22, B.h], [0.000, B.h],
  ];
  const pts = prof.map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), glass);
  g.add(body);
  // The band where a label would be, and it is a band and not a label.
  const bandG = new THREE.CylinderGeometry(B.r * 1.004, B.r * 1.004,
    B.h * 0.22, 18, 1, true);
  bandG.translate(0, B.h * 0.30, 0);
  g.add(new THREE.Mesh(bandG, band));
  // What is left in it, seen down the neck: a disc that drops as it empties.
  const fillG = new THREE.CircleGeometry(B.r * 0.90, 16);
  fillG.rotateX(-Math.PI / 2);
  const fill = new THREE.Mesh(fillG, foam);
  fill.position.y = B.h * 0.52;
  g.add(fill);
  for (const m of g.children) { m.castShadow = false; m.receiveShadow = false; }
  g.visible = false;
  root.add(g);
  stage.add(root);
  return { stage, cam, root, group: g, fill, mat: { glass, band, foam } };
}

/**
 * One bottle, and the clock of the swig you are taking.
 *
 * `left` counts swigs and not bottles: a beer in your pocket becomes a bottle
 * in your hand the first time you drink from it, and the pocket is not touched
 * again until the bottle is empty.
 */
const beer = {
  kit: null,
  out: false,          // a bottle is in your hand
  left: 0,             // swigs remaining in it
  t: -1,               // seconds into a swig, or −1 between them
  said: false,
};

/** Make it once, the first time anybody drinks. */
function beerKit() {
  if (!beer.kit) beer.kit = buildBeer();
  return beer.kit;
}

/**
 * Draw it over the frame that has already been drawn — see the note at the
 * top. Depth cleared and colour kept, and `autoClear` put back, because a
 * renderer left with it off would wipe nothing on the NEXT frame either.
 */
function beerRender(renderer) {
  if (!beer.out || !beer.kit) return;
  const K = beer.kit;
  K.cam.fov = camera.fov;
  K.cam.aspect = camera.aspect;
  K.cam.position.copy(camera.position);
  K.cam.quaternion.copy(camera.quaternion);
  K.cam.updateProjectionMatrix();
  // The root rides the camera, so `g`'s offsets below are view space and its
  // world position is yours — see the note over `root`.
  K.root.position.copy(camera.position);
  K.root.quaternion.copy(camera.quaternion);
  const auto = renderer.autoClear;
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(K.stage, K.cam);
  renderer.autoClear = auto;
}

/**
 * Y: take a swig. Answers a word for what happened, because the ears panel
 * and the toast both want to say it and "nothing" is not usable.
 *
 * The bottle comes out of the pocket on the first swig and the pocket is
 * charged then — not per swig — because what you bought was a beer and not a
 * mouthful of one.
 */
function drinkBeer() {
  // On foot and nowhere else. Swimming is the one place this would fight
  // something: `60-arms.js` is drawing your arms in the same overlay and a
  // bottle through a forearm mid-crawl is worse than no bottle.
  if (state.phase !== 'ground') return 'not now';
  if (beer.t >= 0) return 'mid swig';
  if (!beer.out) {
    const have = POCKET.bought['a beer'] || 0;
    if (have <= 0) return 'no beer';
    POCKET.bought['a beer'] = have - 1;
    if (!POCKET.bought['a beer']) delete POCKET.bought['a beer'];
    beer.out = true;
    beer.left = BEER.swigs;
  }
  beer.t = 0;
  if (audio && audio.swig) audio.swig();
  return 'swig';
}

/** Put the bottle down without finishing it — walking off with it is fine. */
function beerStow() {
  if (!beer.out) return false;
  beer.out = false;
  beer.left = 0;
  beer.t = -1;
  if (beer.kit) beer.kit.group.visible = false;
  return true;
}

/**
 * Where the bottle is this frame. Called from the frame loop.
 *
 * The arc is a pure function of the swig's own clock for the same reason every
 * shot in 44-corpse.js is: a held object that integrates is a held object that
 * drifts, and this one is 40 cm from the lens where a centimetre shows.
 */
function beerTick(dt) {
  // And it goes away if you leave the beach with it — a bottle held in the
  // cockpit is a bottle nobody asked for.
  if (beer.out && state.phase !== 'ground') beerStow();
  if (!beer.out) {
    if (beer.kit) beer.kit.group.visible = false;
    return;
  }
  const K = beerKit();
  K.group.visible = true;
  const B = BEER;
  let u = 0;                     // 0 carried, 1 at your mouth
  if (beer.t >= 0) {
    beer.t += dt;
    const total = B.up + B.hold + B.down;
    u = beer.t < B.up ? beer.t / B.up
      : beer.t < B.up + B.hold ? 1
        : 1 - (beer.t - B.up - B.hold) / B.down;
    if (beer.t >= total) {
      beer.t = -1;
      u = 0;
      beer.left -= 1;
      // Empty: the bottle is gone and so is the beer. Nothing to put down.
      if (beer.left <= 0) {
        beer.out = false;
        K.group.visible = false;
        toast(T('beer.done'));
        return;
      }
    }
  }
  const e = u * u * (3 - 2 * u);
  K.group.position.set(
    lerp(B.rest[0], B.sip[0], e),
    lerp(B.rest[1], B.sip[1], e),
    lerp(B.rest[2], B.sip[2], e));
  // Tipped back toward you, and canted a little across the view the whole
  // time: a bottle held dead upright in front of your face is a bottle in a
  // photograph of a bottle.
  K.group.rotation.set(-B.tilt * e, 0, -0.16 - 0.10 * e);
  // And what is left in it, which drops a quarter with every swig. Measured
  // down the neck, so it only shows while the bottle is tipped — which is
  // exactly when you would see it.
  const part = Math.max(0, beer.left - (beer.t >= 0 ? 1 - u : 0)) / BEER.swigs;
  K.fill.position.y = B.h * (0.10 + 0.44 * part);
  K.fill.visible = part > 0.02;
}
