// -----------------------------------------------------------------------------
// Riding one.
//
// 46-kite.js put seven of them in the channel and said plainly that nobody
// rides one yet. This is the other half: the same wind, the same water, the
// same twelve-metre kite, with you underneath it.
//
// The thing that makes kiting kiting — and the thing a game gets wrong the
// moment it treats a kite as a throttle — is that you are not driving. You are
// being pulled by something that is downwind of you, and everything you can do
// is about the *angle* between where you want to go and where the pull is
// coming from. Point too close to the wind and there is nothing there; point
// dead downwind and you can never go faster than the air that is pushing you;
// and in the wide band between those two you go a great deal faster than the
// wind, which is the whole trick and the reason anybody does it.
//
// So the speed here comes out of a polar and not out of a key. Holding the
// power in on a beam reach is thirty knots. Holding exactly the same power
// pointed forty degrees off the eye of the wind is nothing at all, and the
// only thing that changed was the heading. Learning that by feel in ten
// seconds of steering is the mode.
//
// Three notes on what is here.
//
// The wind is `U.uWind`, the same lebić that is pushing the fire up the
// peninsula, and it is not a separate number. That matters: the direction you
// can go fastest is a fact about the day, and the day was chosen for the fire.
// Turning to look at where the smoke is going tells you which way you can ride.
//
// You launch from the sand, which is where kites launch from. Not from the
// water — a kite on the water is a kite you are relaunching, and that is a
// skill and a minute of your life, neither of which belongs in a key press.
//
// And letting go puts you in the sea rather than back on the beach, because
// that is what letting go does. The swim mode is already the whole of what
// happens to a person in this water, so it is the one door out.
// -----------------------------------------------------------------------------

const RIDE = {
  eye: 1.52,             // m — standing on a board, eyes above the water
  line: 24,              // same lines as everybody else's

  // Speed. 21 m/s is 41 knots, which is a properly quick reach and still an
  // honest one — a kitesurfer goes roughly twice the wind speed across it,
  // which surprises people who have only sailed, and the outright records are
  // past fifty. It was 17 and the report on it was that the speed never gets
  // high enough to really take off, which was true of the whole chain: the top
  // was low, the board took two seconds to find it, and it fell off it faster
  // than it found it, so an approach into a jump arrived slow.
  top: 21.0,
  accel: 1.55,           // how fast the board comes up to what the polar allows
  slow: 1.60,            // and how fast it falls off it, which is still quicker

  // The no-go. Forty-three degrees either side of the eye of the wind, which
  // is about right for a twin-tip: a race board points higher, a beginner
  // points a great deal lower, and neither of those is who this is.
  noGo: 0.75,            // rad in from straight upwind

  turn: 1.55,            // rad/s of yaw at a standstill
  turnFast: 0.42,        // and what is left of it at full speed
  edgeRate: 3.2,         // how fast the board comes on to its edge

  // The kite in its window. It sits downwind of you by definition — that is
  // what a kite is — and the elevation is the one thing you hold: low and
  // forward for drive, high overhead for a jump.
  elev: [0.30, 1.45],    // rad above the horizon
  elevRest: 0.52,
  elevRate: 1.05,        // rad/s the kite can be moved through the window
  // How far round the window the kite is flown, from dead downwind toward the
  // way you are going.
  //
  // This is the number the first pass had badly wrong, and getting it wrong
  // put the kite behind the rider where it could not be seen and could not
  // have pulled them anywhere. A kite lives in the hemisphere downwind of you
  // — the window — and dead downwind, at the middle of it, is where it has the
  // most raw pull and does nothing at all except drag you backwards. What a
  // rider actually does is fly it out to the *edge* of the window, ninety
  // degrees off the wind axis, where there is much less pull and nearly all of
  // what is left points along the way you want to go. 1.05 rad is a shade
  // inside that edge, which is where the useful compromise is and is where
  // everybody parks it.
  window: 1.05,

  // Where the bar is, off the eye: out in front and down, which is where your
  // hands are. It matters more than it sounds — lines drawn from the eye
  // itself come out of the camera as two white wedges filling a third of the
  // frame, which is what the first pass did.
  // Out in front and down, and the same two numbers 60-arms.js hangs the
  // drawn bar off — see ARMS.barAt. The world half of the rig and the view
  // model half have to agree about where your hands are or the lines leave
  // from somewhere your hands are not.
  bar: [0.46, -0.23],
  barW: 0.52,            // m across, which is a small bar and the common one

  // ── the jump ────────────────────────────────────────────────────────────
  //
  // A kite jump is not a leap. Nothing pushes off anything: you edge hard
  // against the pull, send the kite up through the top of the window, and the
  // kite takes you with it — and then it holds you there, which is why the
  // hang time is absurd compared to anything else a person does. Ten seconds
  // is a real number for a big one.
  //
  // So the two halves of it are both about the kite and neither is about a
  // key. It goes up because the kite went up and you were going fast enough to
  // have something to convert; it comes down slowly while the kite is still
  // overhead and quickly the moment you fly it forward again. Holding it up is
  // float; diving it is coming down with speed to ride away on. Both of those
  // are things you actually do, and they are the whole of the control.
  sendAt: 1.12,          // rad — how high the kite must be to take you up
  sendSp: 5.0,           // m/s — and how fast you must be going to matter
  // Base lift, plus this much per m/s of board speed. At twenty metres a
  // second with the bar in, that is eleven and a half up, which floats to
  // about ten metres with the kite overhead — big air, and the number a
  // competition boosts. It was 2.6/0.44 against a top of 17, which came out
  // at five metres and read, correctly, as never quite leaving the water.
  //
  // 3.0/0.48 was a thirteen-metre-a-second send off a twenty-one-metre-a-second
  // reach, which apexes at about fourteen metres. That is a real big-air jump
  // and it is not what this mode is for: this is the one place in the game
  // where you leave the ground under your own steam and the report on it was
  // that it should go *higher*. 4.2/0.80 is twenty-one metres a second off the
  // same reach, which is forty metres up and four seconds of getting there.
  pop: [4.2, 0.80],
  gFloat: 5.4,           // m/s² with the kite overhead holding you
  gDive: 11.5,           // and with it flown forward, which is how you come down
  // And how fast you may fall on each, which is the half of it that was
  // missing and had to be once the jump got big.
  //
  // A kite overhead is a canopy: it does not merely slow you down, it settles
  // you at a rate and holds you there, which is why a floated landing off
  // fifteen metres is soft and why a floated landing off forty is *also*
  // soft. Left as a plain acceleration, forty metres came down at twenty-nine
  // metres a second and every big one you landed was a wipeout — the mode
  // punishing you for doing the thing it just asked you to do.
  vFloat: 7.5,
  vDive: 18.0,
  // Vertical speed at which a landing costs you / ends you. Raised with the
  // jump: coming down off ten metres on a floated kite is eleven metres a
  // second, and a jump that is punished for being the jump you were asked to
  // do is a jump nobody does twice. Dive the kite on the way down and it is
  // fifteen, and that still hurts — which is the skill, and is the same one it
  // is on the water.
  land: [12.5, 20.0],
  reload: 0.9,           // s before the kite will take you up again

  bob: 0.055,            // m of chop under a board doing thirty knots
  // How far the whole picture leans on to the edge. 0.30 was seventeen degrees
  // and it looked like thirty, because the eye reads a tilted *horizon* and
  // this one is tilted against a sea that is itself moving. A kitesurfer's head
  // does not stay square to the board either — you counter-lean, and what is
  // left over at the eye is much less than what the board is doing.
  heel: 0.16,

  // Where you may be. Kiting happens on flat water inside the headland; run it
  // up a beach and you are off.
  minDepth: 0.9,
};

/**
 * The polar: how much of the top speed this heading is worth.
 *
 * `off` is the angle between where you are pointing and where the wind is
 * going — 0 is dead downwind, π is straight into it.
 *
 * Dead downwind is slow, because you cannot outrun the thing pushing you.
 * Everything from a broad reach to close-hauled is fast. Inside the no-go
 * there is nothing, and the fall into it is quick rather than gradual, because
 * that is what it feels like: the power does not fade, it goes.
 */
function ridePolar(off) {
  const edge = Math.PI - RIDE.noGo;
  if (off >= edge) {
    return Math.max(0, 1 - (off - edge) / 0.30) * 0.22;
  }
  const t = off / edge;
  // Peak on a beam reach — about seventy-five degrees off dead downwind,
  // which is where a twin-tip is quickest and is not where a boat is.
  return 0.30 + 0.70 * Math.sin(Math.PI * Math.pow(t, 1.15));
}

function buildRide(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const cloth = new THREE.Color(0.93, 0.30, 0.10);
  const canopy = new THREE.Mesh(kiteCanopy(),
    solidMaterial(cloth, { spec: 0.20, specPower: 22, vcol: false,
      side: THREE.DoubleSide }));
  const board = new THREE.Mesh(kiteBoard(),
    solidMaterial(new THREE.Color(0.92, 0.90, 0.86),
      { spec: 0.42, specPower: 60, vcol: false }));
  const lineMat = solidMaterial(new THREE.Color(0.82, 0.84, 0.86),
    { spec: 0.10, vcol: false });
  // Four, not two, because that is how many a kite has and because from
  // underneath it is the only place you ever see that. And 6 mm rather than
  // the 3 cm the scenery kites use: that number was chosen so a line would
  // survive being two hundred metres away, and the same number three quarters
  // of a metre from your own eye is a mooring rope. What is far away here is
  // the *far* end.
  const lines = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0040, 0.0040, 1, 3, 1, true), lineMat);
    m.geometry.translate(0, -0.5, 0);
    lines.push(m);
    group.add(m);
  }
  // The wake, the same tapered ribbon the AI riders leave, because from your
  // own board it is the thing that tells you you are moving at all — flat
  // water gives the eye nothing else.
  const wake = new THREE.Mesh((() => {
    const g = new THREE.PlaneGeometry(1, 1, 1, 8);
    g.rotateX(-Math.PI / 2);
    return g;
  })(), solidMaterial(new THREE.Color(0.94, 0.97, 0.98),
    { spec: 0, emissive: 0.35, vcol: false, transparent: true,
      opacity: 0.55, depthWrite: false }));
  wake.renderOrder = 2;
  group.add(canopy, board, wake);
  for (const m of [group, canopy, board, wake, ...lines]) m.frustumCulled = false;

  const you = {
    x: 0, z: 0, y: 0,
    yaw: 0,              // where the board points
    look: 0, pitch: 0,   // and where you are looking, which is not the same
    sp: 0,
    edge: 0,             // which way the board is on its edge, -1..1
    steer: 0,
    elev: RIDE.elevRest, // the kite, in its window
    side: 1,             // which side of the wind you are on
    // How hard the bar is held in, 0..1. Read by 60-arms.js as well, because
    // the arms have to pull it to the same place the lines leave from.
    pull: 0,
    air: 0,              // m above the water — 0 is on it
    vy: 0,
    since: 0,            // s since the last landing
    best: 0,             // and the highest you have been, which is the score
    t: 0,
  };
  let active = false;

  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _up = new THREE.Vector3(0, 1, 0);

  /** Which way the true wind is going, as a unit vector on the water. */
  function windDir() {
    const w = U.uWind.value;
    const l = Math.hypot(w.x, w.y) || 1;
    return [w.x / l, w.y / l];
  }

  /**
   * The apparent wind, which is the one the kite is actually in.
   *
   * This is not a refinement, it is the reason a kitesurfer's kite is in front
   * of them. Standing still, the kite sits straight downwind and you can only
   * see it by turning your head. Doing twenty-five knots across nineteen knots
   * of breeze, the air you are flying in comes from a long way forward of where
   * the weather says it does — so the kite swings forward with it and ends up
   * roughly where you are looking. Modelling it puts the kite in the picture
   * for free and by the right mechanism, rather than by nudging an angle until
   * the kite happened to be on screen.
   *
   * Wind minus your own velocity, normalised. The same subtraction a sailmaker
   * draws and a cyclist feels.
   */
  function appDir() {
    const [wx, wz] = windDir();
    const sp = U.uWindSpeed ? U.uWindSpeed.value : 9.0;
    const [hx, hz] = head(you.yaw);
    const ax = wx * sp - hx * you.sp;
    const az = wz * sp - hz * you.sp;
    const l = Math.hypot(ax, az) || 1;
    return [ax / l, az / l];
  }

  /** Where you are pointing. Same sign convention as the swim and the walk. */
  function head(yaw) { return [-Math.sin(yaw), -Math.cos(yaw)]; }

  function waterOk(x, z) {
    return isSea(x, z) && -groundAt(x, z) > RIDE.minDepth;
  }

  /**
   * Take one out.
   *
   * Pointed across the wind rather than wherever you happened to be facing,
   * because that is what a launch is: you get the kite up, you put the board
   * on, and the first thing that happens is that you go sideways. Starting a
   * rider pointed into the eye of the wind would be starting them stopped, and
   * a mode that begins by not working is a mode nobody finds out works.
   */
  function enter(x, z) {
    if (!waterOk(x, z)) return false;
    const [wx, wz] = windDir();
    // Across the wind, on whichever tack keeps more water in front of you.
    let best = null;
    for (const s of [1, -1]) {
      const ax = -wz * s, az = wx * s;
      let run = 0;
      for (; run < 300; run += 15) {
        if (!waterOk(x + ax * (run + 15), z + az * (run + 15))) break;
      }
      if (!best || run > best.run) best = { run, s, ax, az };
    }
    if (!best || best.run < 45) return false;
    you.x = x; you.z = z;
    you.yaw = Math.atan2(-best.ax, -best.az);
    you.look = 0;
    // A touch down rather than a touch up. Looking up is where the kite is and
    // looking down is where the water is, and the water is what you are
    // actually reading at thirty knots — and it is also what puts your own
    // hands in the bottom of the frame, which is most of what tells you you
    // are holding something.
    you.pitch = -0.17;
    you.sp = 3.0;
    you.edge = 0; you.steer = 0;
    you.elev = RIDE.elevRest;
    you.side = best.s;
    you.air = 0; you.vy = 0; you.since = 9; you.best = 0;
    you.t = 0;
    active = true;
    group.visible = true;
    return true;
  }

  function leave() { active = false; group.visible = false; }

  /**
   * Looking about, which on a board is a separate thing from steering.
   *
   * On foot and in the water the mouse is the whole of where you are going.
   * Here it is not: the board goes where the board is edged, and your head
   * goes where you want it. That is not a concession to the controls, it is
   * the position — you spend a lot of a reach looking up and behind at a kite
   * that is not where you are pointing, and a camera welded to the board makes
   * that impossible.
   */
  function look(dx, dy) {
    if (!active) return;
    you.look = clamp(you.look - dx, -2.2, 2.2);
    you.pitch = clamp(you.pitch - dy, -1.2, 1.35);
  }

  /** `ctl` is { fwd, side, sprint, up, down } — the same shape as the rest. */
  function update(dt, ctl = {}) {
    if (!active) return;
    you.t += dt;
    const [wx, wz] = windDir();

    // ── the kite, in its window ──────────────────────────────────────────────
    // Up with the up key and down with the down key, and it does not snap: a
    // kite is a slow object on twenty-four metres of line and the lag is most
    // of why sending one is a skill.
    const want = ctl.up ? RIDE.elev[1] : ctl.down ? RIDE.elev[0] : RIDE.elevRest;
    you.elev += clamp(want - you.elev, -RIDE.elevRate * dt, RIDE.elevRate * dt);

    // ── up, and down again ──────────────────────────────────────────────────
    you.since += dt;
    if (you.air <= 0 && you.vy <= 0) {
      // On the water. The kite going through the top of the window with speed
      // under you is the send, and it is the only way off the surface — there
      // is no jump key, because there is no jump.
      if (you.elev > RIDE.sendAt && you.sp > RIDE.sendSp
        && you.since > RIDE.reload && ctl.up) {
        you.vy = RIDE.pop[0] + RIDE.pop[1] * you.sp * (0.55 + 0.45 * you.pull);
        you.air = 0.001;
        you.since = 0;
      } else {
        you.air = 0; you.vy = 0;
      }
    }
    if (you.air > 0) {
      // Overhead holds you; flown forward it lets you go. Nothing else in the
      // mode has this much authority over how it feels.
      const fl = clamp((you.elev - 0.62) / 0.33, 0, 1);
      const g = lerp(RIDE.gDive, RIDE.gFloat, fl);
      const vMax = lerp(RIDE.vDive, RIDE.vFloat, fl);
      you.vy -= g * dt;
      if (you.vy < -vMax) you.vy = -vMax;
      you.air += you.vy * dt;
      you.best = Math.max(you.best, you.air);
      if (you.air <= 0) {
        const hit = -you.vy;
        you.air = 0; you.vy = 0; you.since = 0;
        // Coming down flat and fast is the one way this mode hurts you, and it
        // is the right one: everything about a kite jump is easy except the
        // last two metres, and the fix for it is the same in the game as on the
        // water — keep the kite up until you are down.
        if (hit > RIDE.land[1]) return 'wipeout';
        if (hit > RIDE.land[0]) you.sp *= 0.42;
      }
    }

    // ── steering ────────────────────────────────────────────────────────────
    // The board turns hard when it is slow and barely at all when it is not,
    // which is true of everything that planes and is why a fast kitesurfer
    // makes long turns and a slow one spins on the spot.
    const s = clamp(ctl.side || 0, -1, 1);
    you.steer += (s - you.steer) * Math.min(1, dt * 6);
    const spN = Math.min(1, you.sp / RIDE.top);
    // Minus, and it was plus, which is why D went left.
    //
    // Every heading in this game is written forward = (-sin yaw, -cos yaw), and
    // the derivative of that in yaw points at -x — so a *rising* yaw is a turn
    // to the left. The swim has had the minus since it was written; this was
    // the one steering model in the game that did not, and both the arrows and
    // A/D came out mirrored because of it.
    you.yaw -= you.steer * dt
      * (RIDE.turn + (RIDE.turnFast - RIDE.turn) * spN);

    // ── the polar ───────────────────────────────────────────────────────────
    const [hx, hz] = head(you.yaw);
    const dot = clamp(hx * wx + hz * wz, -1, 1);
    const off = Math.acos(dot);
    // Which side of the wind you are on. The sign of the cross product of the
    // wind with your heading, and it is what puts the kite to one side of you
    // and the board on the matching edge.
    you.side = (wx * hz - wz * hx) >= 0 ? 1 : -1;

    // The bar. Held in is full power; let it out and the kite depowers, which
    // is what you do when it is too much and what a beginner does all day.
    const power = ctl.fwd < 0 ? 0.34 : (ctl.sprint ? 1.0 : (ctl.fwd > 0 ? 0.86 : 0.62));
    // A kite parked overhead pulls you up and not along, which is the whole
    // reason sending it is how you jump — and here it is why holding it up
    // costs you speed.
    // A kite parked overhead pulls you up and not along — but the penalty has
    // to start *above* the send, not at the resting angle, or the half second
    // it takes to fly the kite to the top is a half second of braking and you
    // arrive at your own jump slow. Which is exactly what used to happen.
    const drive = ridePolar(off) * power
      * (0.35 + 0.65 * Math.cos(Math.max(0, you.elev - 1.15)));
    // Nothing drives you while you are off the water: you carry what you had.
    const target = you.air > 0 ? you.sp : RIDE.top * drive;
    const k = 1 - Math.exp(-(target > you.sp ? RIDE.accel : RIDE.slow) * dt);
    you.sp += (target - you.sp) * k;

    // ── along the water ─────────────────────────────────────────────────────
    const nx = you.x + hx * you.sp * dt;
    const nz = you.z + hz * you.sp * dt;
    if (waterOk(nx, nz) || you.air > 0.4) {
      you.x = nx; you.z = nz;
    } else {
      // Run out of water and you stop, hard, and the mode hands you to the
      // sea. Nothing here pretends to be a beach landing.
      you.sp *= 0.2;
      if (you.sp < 1.2) return 'aground';
    }
    you.y = seaHeightAt(you.x, you.z);

    you.pull = Math.min(1, you.sp / 15.0);
    // The edge follows the tack, and how hard depends on how hard you are
    // being pulled: a rider on a rope stands *against* it.
    const wantEdge = -you.side * Math.min(1, you.sp / (RIDE.top * 0.55));
    you.edge += clamp(wantEdge - you.edge, -RIDE.edgeRate * dt, RIDE.edgeRate * dt);
    return null;
  }

  /** Where the kite is, in world space. */
  function kitePos(out) {
    const [wx, wz] = appDir();
    const [hx, hz] = head(you.yaw);
    // Out toward the edge of the window, measured off the *apparent* wind
    // rather than the true one. See `appDir` and the note on `window`.
    const sw = RIDE.window;
    const dx = wx * Math.cos(sw) + hx * Math.sin(sw);
    const dz = wz * Math.cos(sw) + hz * Math.sin(sw);
    const l = Math.hypot(dx, dz) || 1;
    const flat = Math.cos(you.elev) * RIDE.line;
    return out.set(
      you.x + (dx / l) * flat,
      // `air` as well as `y`: the lines are twenty-four metres of Dyneema and
      // they do not get longer because you left the water. Without it the kite
      // stayed where it was while you rose toward it, and eleven metres of air
      // ate a third of the line — which draws as four slack ropes going
      // nowhere at the exact moment you are looking at them.
      you.y + you.air + Math.sin(you.elev) * RIDE.line + 1.1,
      you.z + (dz / l) * flat,
    );
  }

  const _c = new THREE.Vector3();
  const _d = new THREE.Vector3();
  const _dn = new THREE.Vector3(0, -1, 0);

  /** Where the bar is in the world: out in front of the eye and below it. */
  function barPos(out, eyeY) {
    const [hx, hz] = head(you.yaw);
    // Sheeting in brings the bar to you — the same 16 cm the arms travel in
    // 60-arms.js. It used to be 26, and 26 put the bar at 42 cm from the eye
    // at full power, which is inside the front clip: the lines came out of
    // nothing and stopped in mid-air a third of the way up the frame, which
    // looked like a rendering fault and was one.
    const f = RIDE.bar[0] - 0.12 * you.pull;
    return out.set(
      you.x + hx * f,
      eyeY + RIDE.bar[1] + 0.055 * you.pull,
      you.z + hz * f,
    );
  }

  /** Draw the rig. Called after pose(), because it hangs off where you are. */
  function draw() {
    if (!active) return;
    const eyeY = you.y + RIDE.eye + you.air;
    barPos(_b, eyeY);
    kitePos(_a);
    canopy.position.copy(_a);
    _up.set(0, 1, 0);
    _m.lookAt(_c.copy(_a).sub(_b).normalize(), _d.set(0, 0, 0), _up);
    canopy.quaternion.setFromRotationMatrix(_m);
    canopy.rotateX(-Math.PI / 2);

    // Across the bar, so the four lines leave four different places rather
    // than all leaving one — which is the only thing that tells you there is a
    // bar there at all when the bar itself is inside the front clip.
    const [hx, hz] = head(you.yaw);
    const bx = -hz, bz = hx;
    for (let i = 0; i < 4; i++) {
      // Outer pair to the tips, inner pair a little in from them: the front
      // lines and the back lines do not land in the same place on a kite.
      const sg = i < 2 ? -1 : 1;
      const tipX = sg * (i % 2 ? 3.5 : 2.6);
      const tip = _c.set(tipX, 0, i % 2 ? 0 : -0.35)
        .applyQuaternion(canopy.quaternion).add(canopy.position);
      const off = (i % 2 ? 0.5 : -0.5) * RIDE.barW * sg;
      _up.set(_b.x + bx * off, _b.y, _b.z + bz * off);
      _d.copy(tip).sub(_up);
      const len = _d.length() || 1;
      _d.divideScalar(len);
      // Started half a metre up the line rather than at the bar itself.
      //
      // The bar is 46 cm from your eye because that is as far as an arm
      // reaches, and the front clip cannot come in that far without spending
      // the depth precision the far shore needs. So the world draws the line
      // from where it can, and the view model — which has a five-centimetre
      // near plane and is drawn over the top — draws the bar and the two hands
      // that hide the join. Nothing is missing; the seam is behind your own
      // knuckles.
      const skip = Math.min(0.55, len * 0.5);
      _up.addScaledVector(_d, skip);
      lines[i].position.copy(_up);
      lines[i].scale.set(1, len - skip, 1);
      lines[i].quaternion.setFromUnitVectors(_dn, _d);
    }
    _up.set(0, 1, 0);

    board.position.set(you.x, you.y + 0.04 + you.air, you.z);
    // Off the water the board comes up under you and the edge means nothing,
    // so it flattens — which is also what a rider does, because you have to
    // land it flat.
    board.rotation.set(you.air > 0 ? -0.22 : 0, you.yaw,
      you.edge * 0.62 * (you.air > 0 ? 0.35 : 1), 'YXZ');

    const wk = you.air > 0.15 ? 0 : Math.min(1, you.sp / (RIDE.top * 0.5));
    wake.visible = wk > 0.12;
    wake.position.set(you.x - hx * 7.5 * wk, you.y + 0.06, you.z - hz * 7.5 * wk);
    wake.rotation.set(0, you.yaw, 0);
    wake.scale.set(1.4 + 1.2 * wk, 1, 15 * wk + 0.5);
  }

  /**
   * The camera. Your eyes, over the board, leaning with it.
   *
   * The roll is the one number that makes this mode feel like anything. A
   * kitesurfer on a hard edge has the whole world tipped fifteen or twenty
   * degrees, and taking that out — which is what a camera bolted upright does
   * — leaves a first-person mode that reads as a drone at head height.
   */
  function pose(camera) {
    if (!active) return;
    camera.up.set(0, 1, 0);
    const chop = Math.sin(you.t * 7.3) * RIDE.bob
      * Math.min(1, you.sp / (RIDE.top * 0.4));
    const ey = you.y + RIDE.eye + you.air + chop * (you.air > 0 ? 0 : 1);
    camera.position.set(you.x, ey, you.z);
    const yaw = you.yaw + you.look;
    const cp = Math.cos(you.pitch);
    camera.lookAt(
      you.x - Math.sin(yaw) * cp,
      ey + Math.sin(you.pitch),
      you.z - Math.cos(yaw) * cp,
    );
    camera.rotateZ(-you.edge * RIDE.heel);
  }

  return {
    you,
    get active() { return active; },
    get speed() { return you.sp; },
    get air() { return you.air; },
    enter, leave, look, update, pose, draw,
    /** For the HUD: where this heading sits against the wind. */
    point: () => {
      const [wx, wz] = windDir();
      const [hx, hz] = head(you.yaw);
      const off = Math.acos(clamp(hx * wx + hz * wz, -1, 1));
      const edge = Math.PI - RIDE.noGo;
      if (off >= edge) return 'noGo';
      if (off > edge * 0.72) return 'upwind';
      if (off > edge * 0.38) return 'reach';
      return 'downwind';
    },
    stats: () => ({
      on: active ? 1 : 0,
      at: [Math.round(you.x), Math.round(you.z)],
      kt: +(you.sp * 1.94384).toFixed(1),
      sp: +you.sp.toFixed(2),
      yawDeg: Math.round(you.yaw * 180 / Math.PI),
      elev: +you.elev.toFixed(2),
      edge: +you.edge.toFixed(2),
      side: you.side,
      air: +you.air.toFixed(2),
      // Where the two ends of the rig actually are. Both of them are computed
      // from the same yaw the board has and neither is where you are looking,
      // so when the lines come out wrong these are the only two numbers that
      // say which end is at fault.
      bar: (() => { const v = new THREE.Vector3();
        barPos(v, you.y + RIDE.eye + you.air);
        return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; })(),
      kite: (() => { const v = new THREE.Vector3(); kitePos(v);
        return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; })(),
      len: +(lines[0] ? lines[0].scale.y : 0).toFixed(2),
      best: +you.best.toFixed(2),
      point: null,
    }),
  };
}
