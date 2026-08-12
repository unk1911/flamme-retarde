// -----------------------------------------------------------------------------
// Getting out.
//
// A CL-415 has no ejection seat, and the crews who fly these fires have nothing
// of the kind — this is the one place the game leaves the record behind on
// purpose, because what it replaces is worse. What it does keep honest is the
// cost. The aeroplane goes on without you, drops her nose, and goes in. Six
// tonnes of water and a serviceable aircraft, to save one person, and the fire
// does not care either way.
//
// The sequence is the real one. You leave with the aeroplane's velocity and a
// kick up the rails; you are a falling body for the best part of a second; the
// canopy streams and inflates against whatever airspeed you brought with you,
// which is the part that hurts; and then it is suddenly very quiet and you have
// about a minute to choose somewhere to put your feet.
//
// The one number that decides whether this is a survival option or a second way
// of dying is height. Nothing here forbids a low ejection — it just does not
// have time to work, and you arrive at whatever rate the arithmetic gives you.
// -----------------------------------------------------------------------------

const EJECT = {
  seatKick: 13,          // m/s along the aeroplane's own up, off the rails
  tumble: 0.85,          // s of being a falling body before the canopy streams
  deploy: 1.15,          // s from streaming to fully inflated

  // Drag over mass. A body face down settles at about 55 m/s, a canopy this
  // size at about 5.5 — a hundredfold change in the space of a second, which is
  // the whole reason a parachute works and the whole reason it hurts.
  kBody: 0.0032,
  kCanopy: 0.33,
  // And the ceiling on it. Unclamped, opening at 90 m/s would pull twenty g and
  // put the arithmetic somewhere no human goes. Six is a hard opening you feel
  // and walk away from, which is the one this game is telling.
  maxOpen: 62,           // m/s²

  // Forward speed, hands off. This used to be 6.5, and 6.5 was the reason the
  // canopy felt like it had no controls at all: the wind gradient below hands
  // you 6.84 m/s at six hundred metres, so upwind your *ground* track was minus
  // a third of a metre a second. Not "limited authority" — none, and pointing
  // the thing anywhere made no difference to where it went. A steerable square
  // of this size really does fly at nine or ten, so this is the more honest
  // number as well as the playable one, and the gradient still does the work:
  // upwind you make 2.7 m/s up high and 7 down low, which is the same story
  // about choosing your field late, told with the choice actually in it.
  drive: 9.5,            // m/s the canopy flies forward at, full glide
  turn: 0.80,            // rad/s hauling on a riser
  turnSink: 0.28,        // extra sink, as a fraction, in a full turn
  sink: 5.6,             // m/s down, hands off

  // Front risers. Pull the leading edge down and the canopy stops gliding and
  // starts descending at something: you go faster over the ground and you pay
  // for every metre of it in height. Hands off she glides 1.70; diving she
  // glides 1.25 — worse, and that is the point. Into a headwind the *ground*
  // glide goes the other way, 0.48 to 0.67, which is precisely why anyone ever
  // does this. Downwind it is the wrong tool and the arithmetic says so.
  diveDrive: 1.55,       // what the risers multiply forward speed by
  diveSink: 2.10,        // and what they multiply the sink by
  flareSink: 0.42,       // what a held flare multiplies the sink by
  flareDrive: 0.35,      // and the forward speed — a flare trades one for other
  flareFor: 2.4,         // s of flare in the canopy before it gives up
  flareBack: 0.4,        // and how fast that comes back, per second
  stallSink: 1.75,       // and what holding it past that costs you

  eye: 1.62,             // where your eyes are above your boots
  radius: 5.6,           // canopy radius
  riser: 6.4,            // eyes to the centre of the canopy
  gores: 14,

  // Where the toast stops congratulating you and starts telling you that was
  // close. Measured, not guessed: straight and level she survives from twenty
  // metres, because the seat throws you up before it lets you fall. Going down
  // at forty she needs fifty, which is what the rate term is for.
  minSafe: 60,           // m AGL, plus 1.6 s of whatever rate you brought
};

// The other half of the same event: what the aeroplane does once there is
// nobody in her. Flown in 90-app.js, kept here because it is the same story.
const DERELICT = {
  bank: 1.15,            // rad she rolls away to, and stays at — 66°
  nose: 0.44,            // rad she puts the nose down to — 25°
};

/**
 * The canopy: gores, a vent at the apex, and the lines. Built in a frame whose
 * origin is the jumper's eyes, so the whole thing can be parked on the camera
 * and swung about it like the pendulum it actually is.
 */
function chuteMesh() {
  const G = EJECT.gores, R = 7, S = 4, rad = EJECT.radius;
  const A0 = 0.17, A1 = 1.76;         // polar angle: apex vent to skirt
  const pos = [], col = [], idx = [];
  // Rescue orange and white, which is what a canopy you want found from the air
  // is made of. Both pulled well down, because the sun is directly on the other
  // side of the cloth and anything near full value clips to a flat sheet.
  const white = new THREE.Color(0xcbd4da), orange = new THREE.Color(0xa8551e);

  for (let g = 0; g < G; g++) {
    const c = g % 2 ? orange : white;
    const base = pos.length / 3;
    for (let r = 0; r <= R; r++) {
      const pol = A0 + (r / R) * (A1 - A0);
      const y = Math.cos(pol) * rad * 0.84 + EJECT.riser;
      for (let s = 0; s <= S; s++) {
        const u = s / S;
        // Fabric belled out between the seams, which is what makes a canopy
        // read as cloth under load rather than as a bowl.
        const rr = Math.sin(pol) * rad * (1 + 0.05 * Math.sin(Math.PI * u));
        const a = (g + u) / G * TAU;
        pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let r = 0; r < R; r++) {
      for (let s = 0; s < S; s++) {
        const i = base + r * (S + 1) + s;
        idx.push(i, i + 1, i + S + 2, i, i + S + 2, i + S + 1);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aVCol', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();

  const group = new THREE.Group();
  // Both sides, and the normals deliberately *not* flipped for the back face.
  // From underneath you are looking at the inside of a single layer of nylon
  // with the August sun on the other side of it, so the face you can see is lit
  // by a light that is behind it — which is exactly what leaving the outward
  // normals alone gives you, and it is the whole look of the thing.
  group.add(new THREE.Mesh(g, solidMaterial(0xffffff, {
    side: THREE.DoubleSide, spec: 0.04, specPower: 8, emissive: 0.05,
    body: 'base *= vVCol;',
  })));

  // The lines. One per seam, down to a confluence just above your head — a
  // single pixel each, which is exactly what seven metres of cord looks like.
  const lp = [];
  const skirtR = Math.sin(A1) * rad, skirtY = Math.cos(A1) * rad * 0.84 + EJECT.riser;
  for (let i = 0; i < G; i++) {
    const a = i / G * TAU;
    lp.push(Math.cos(a) * skirtR, skirtY, Math.sin(a) * skirtR, 0, 0.55, 0);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
    color: 0x2a2724, transparent: true, opacity: 0.85, depthWrite: false,
  })));

  group.visible = false;
  return group;
}

const _ejV = new THREE.Vector3();
const _ejRel = new THREE.Vector3();
const _ejEul = new THREE.Euler(0, 0, 0, 'ZYX');
const _ejQ = new THREE.Quaternion();

/**
 * @param scene   to hang the canopy on
 * @param flight  the aeroplane you are leaving
 * @param onDown  called once with 'land' | 'sea' | 'hard' when you arrive
 */
function buildEject(scene, flight, onDown) {
  const canopy = chuteMesh();
  scene.add(canopy);

  const you = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,              // canopy and view together — see look() for why
    pitch: 0,
    flare: EJECT.flareFor,
    dive: 0,             // how much front riser is in, 0..1
    stalled: false,      // held the toggles past the end of the flare
    swing: 0,            // pendulum roll, radians
    swingV: 0,
    inflation: 0,
    vs: 0,               // rate of descent at the moment you touched
  };

  let phase = 'stowed';  // stowed | out | deploy | flying | down
  let t = 0;             // seconds since the seat fired
  let spin = 0;          // how much tumble is left in the picture
  let spinT = 0;
  let peakG = 0;

  const airborne = () => {
    const p = flight.p;
    return !p.crashed && !p.onGround && !p.onWater;
  };

  /** Can you get out right now? */
  const canFire = () => phase === 'stowed' && state.phase === 'fly' && airborne();

  function fire() {
    if (!canFire()) return false;
    const p = flight.p;
    const { up } = flight.axes();
    you.pos.copy(p.pos).addScaledVector(up, 1.4);
    you.vel.copy(p.vel).addScaledVector(up, EJECT.seatKick);
    you.yaw = Math.atan2(-p.vel.x, -p.vel.z);
    you.pitch = 0;
    you.flare = EJECT.flareFor;
    you.stalled = false;
    you.swing = you.swingV = 0;
    you.inflation = 0;
    you.vs = 0;
    phase = 'out';
    t = 0;
    spin = 1;
    spinT = 0;
    peakG = 0;

    // And the aeroplane is on her own. No stabiliser, no autopilot, no hands:
    // whatever attitude she was in when you left is the attitude she keeps
    // until the drag and the weight of six tonnes of water settle the argument.
    p.assist = 0;
    p.autopilot = false;
    p.levelling = false;
    p.stick.set(0, 0);
    p.kb.set(0, 0);
    p.tch.set(0, 0);
    p.rudder = 0;
    state.phase = 'chute';
    return true;
  }

  /**
   * The other way to end up under the canopy: straight up off your own feet.
   *
   * Deliberately not fire(). That one reads an aeroplane — her position, her
   * velocity, her up axis — and then takes her controls away, and there is no
   * aeroplane in this. There is a person standing on concrete who has just had
   * something go off underneath them.
   *
   * Everything after the first frame is the same physics as a bale-out, which
   * is the whole reason for doing it this way: the tumble, the canopy filling,
   * the toggles, the wind, the flare, the landing and the hand-off back to the
   * ground mode are all code that already works and has already been flown.
   * This only has to supply a position and a very large upward velocity.
   */
  function launch(x, y, z, yaw, up, hang = 0) {
    // Boots to eyes, plus a metre of clearance, and measured against the
    // *terrain* as well as against whatever you were standing on. The arrival
    // test at the bottom of update() is `pos.y - eye <= groundAt()`, so if you
    // have somehow ended up below the terrain — which is the situation this
    // whole key exists to answer — starting from where you were would land you
    // again on the first frame and the charge would do nothing at all.
    you.pos.set(x, Math.max(y, groundAt(x, z)) + EJECT.eye + 1.0, z);
    // Purely vertical. A person going up off a standing start has no forward
    // component worth modelling, and giving them one means the escape hatch
    // quietly moves you somewhere while you are still working out what
    // happened.
    you.vel.set(0, up, 0);
    you.yaw = yaw;
    you.pitch = 0;
    you.flare = EJECT.flareFor;
    you.stalled = false;
    you.swing = you.swingV = 0;
    you.inflation = 0;
    you.dive = 0;
    you.vs = 0;
    phase = 'out';
    // Negative, and this is the whole trick for getting the canopy to open at
    // the top rather than a second off the ground. `update()` streams the cloth
    // at `t >= tumble` and has it full `deploy` seconds later; starting the
    // clock `hang` seconds in the past moves both of those back by `hang`
    // without touching a line of the sequence that already works. Set it to the
    // climb and the canopy takes air just as you stop going up.
    t = -hang;
    spin = 1;
    spinT = 0;
    peakG = 0;
    state.phase = 'chute';
    return true;
  }

  /**
   * Mouse or thumb. Where you look is where the canopy goes.
   *
   * This started out as a head that turned independently of the canopy, the way
   * a head actually does under a parachute, and it made the thing unflyable. You
   * spend the whole descent looking around for somewhere to land, so the mouse
   * is never still; the moment it moves, your view stops pointing along the
   * heading the canopy is flying, and A and D are then steering a direction you
   * have no way of seeing. Not a difficult control — an invisible one.
   *
   * So: yaw is one number. The lag that makes it feel like cloth rather than a
   * spaceship is in the velocity, which takes about half a second to follow the
   * heading round, not in hiding the heading from you.
   */
  function look(dx, dy) {
    you.yaw -= dx;
    you.pitch = clamp(you.pitch - dy, -1.30, 1.30);
  }

  // ── the descent ────────────────────────────────────────────────────────────
  /**
   * The wind gradient, and it is the whole shape of the descent.
   *
   * `state.windSpeed` is the surface gust the flame front is being fanned by,
   * and a canopy does not see that number anywhere. High up it sees most of it
   * and you are a passenger — six and a half metres a second of canopy against
   * seven of wind, so you go where the wind is going and you may pick which
   * part of downwind. Low down it is in the friction layer, the wind is a third
   * of what it was, and the canopy is suddenly the faster of the two. Which is
   * to say: you do not choose your field from six hundred metres. You choose it
   * from two hundred, and until then you spend the height getting near it.
   */
  function windAt(agl, out) {
    const f = (0.26 + 0.46 * sat(agl / 420)) * state.windSpeed;
    out.set(Math.cos(state.windDir) * f, 0, Math.sin(state.windDir) * f);
  }

  function update(dt, ctl) {
    if (phase === 'stowed' || phase === 'down') return;
    t += dt;
    spinT += dt;

    const surface = isSea(you.pos.x, you.pos.z) ? 0 : groundAt(you.pos.x, you.pos.z);
    const agl = you.pos.y - EJECT.eye - surface;
    windAt(agl, _ejV);

    if (phase === 'flying') {
      // Under a canopy you are not integrating forces any more, you are riding
      // a wing that has already found its trim. Steer it and it goes there.
      // `steer` is +1 for right, and yaw *decreases* to the right — forward is
      // (−sin y, −cos y) and right is (cos y, −sin y), so raising the angle
      // swings the nose to the left. This had a plus sign in it, which is the
      // whole of "the arrows are backwards under the canopy": the mouse, the
      // walk on foot and the aeroplane all take the same convention two lines
      // apart (`look` does `yaw -= dx` immediately above), and the one control
      // that did not was the one you cannot check against anything, because a
      // canopy has no other heading to compare itself to.
      const steer = clamp(ctl.turn || 0, -1, 1);
      you.yaw -= steer * EJECT.turn * dt;

      // The toggles. There are about two seconds of lift in a canopy and not
      // one more: hold them down past that and you have flown it into a stall,
      // which on a parachute means the sink rate goes *up* and stays up until
      // you let go and it has flown itself out again. Without that it is a free
      // thirty per cent off the whole descent, held down from the top.
      const pull = !!ctl.flare && !you.stalled;
      you.flare = clamp(you.flare + (pull ? -dt : dt * EJECT.flareBack), 0, EJECT.flareFor);
      if (pull && you.flare <= 0) you.stalled = true;
      else if (you.stalled && !ctl.flare && you.flare > EJECT.flareFor * 0.6) you.stalled = false;
      const fl = pull ? 1 : 0;

      // The other end of the same axis. Brakes and risers are opposite hands and
      // cannot both be on, so the flare wins — you are about to land.
      //
      // And the risers let go on their own in the last sixty metres, whatever
      // your thumb is doing. Partly because that is what happens — you are not
      // holding a front riser down through the flare, your hands are needed and
      // the canopy is planing out anyway — and partly because without it the
      // dive is a free lunch: quicker, further upwind, and arriving at twelve
      // metres a second with nothing to pay, since an inflated canopy always
      // puts you down alive. Take it away at the bottom and the dive goes back
      // to being what it is, a way of spending height to reach something.
      const dv = pull ? 0 : sat(ctl.dive || 0) * sat((agl - 25) / 35);
      you.dive = dv;

      const sink = EJECT.sink * (1 - fl * (1 - EJECT.flareSink))
        * (1 + dv * (EJECT.diveSink - 1))
        * (you.stalled ? EJECT.stallSink : 1)
        * (1 + EJECT.turnSink * Math.abs(steer));
      const drive = EJECT.drive * (1 - fl * (1 - EJECT.flareDrive))
        * (1 + dv * (EJECT.diveDrive - 1));
      _ejV.x += -Math.sin(you.yaw) * drive;
      _ejV.z += -Math.cos(you.yaw) * drive;
      _ejV.y = -sink;
      // Not instantly: a canopy has mass hanging under it and it swings into a
      // new heading over a second or so rather than snapping to it.
      you.vel.lerp(_ejV, 1 - Math.exp(-2.4 * dt));

      // The pendulum. Driven by the turn, and it rings a little on its own.
      // And the pendulum goes with it, or you would bank out of the turn.
      you.swingV += (-you.swing * 9.0 - you.swingV * 2.6 - steer * 3.4) * dt;
      you.swing = clamp(you.swing + you.swingV * dt, -0.30, 0.30);
    } else {
      // Ballistic, with the drag ramping from a body to a canopy as the cloth
      // takes air. Squared, because drag goes with area and area goes with the
      // square of how far the mouth has opened.
      const inf = phase === 'deploy' ? sat((t - EJECT.tumble) / EJECT.deploy) : 0;
      you.inflation = inf;
      you.vel.y -= 9.81 * dt;
      _ejRel.copy(you.vel).sub(_ejV);
      const sp = _ejRel.length();
      if (sp > 0.01) {
        const k = EJECT.kBody + (EJECT.kCanopy - EJECT.kBody) * inf * inf;
        const a = Math.min(k * sp * sp, EJECT.maxOpen);
        peakG = Math.max(peakG, a / 9.81);
        you.vel.addScaledVector(_ejRel, -(a * dt) / sp);
      }
      if (phase === 'out' && t >= EJECT.tumble) phase = 'deploy';
      if (phase === 'deploy' && inf >= 1) {
        phase = 'flying';
        you.inflation = 1;
        // Facing where you were already going, so the canopy does not appear to
        // snap round the instant it takes the load.
        you.yaw = Math.atan2(-you.vel.x, -you.vel.z);
        you.swingV = 0.9;
      }
      // The tumble bleeds out as the cloth takes hold, not on a timer.
      spin = phase === 'out' ? 1 : Math.max(0, 1 - you.inflation * 1.25);
    }

    you.pos.addScaledVector(you.vel, dt);

    // Arrival. Boots, not eyes — the eye height is what the camera rides at and
    // what you land on is a metre and a half below it.
    const gy = isSea(you.pos.x, you.pos.z) ? 0 : groundAt(you.pos.x, you.pos.z);
    if (you.pos.y - EJECT.eye <= gy) {
      you.pos.y = gy + EJECT.eye;
      you.vs = -you.vel.y;
      you.vel.set(0, 0, 0);
      phase = 'down';
      canopy.visible = false;
      // Under an open canopy you live. Full stop, and it is not a concession:
      // a canopy that has taken air puts you down at five and a half metres a
      // second, which is a heavy step off a wall, and the water is the August
      // Adriatic four hundred metres off a beach with three other aircraft and
      // a lookout who all watched you go — you are in a lifejacket and there is
      // a boat. The only thing that can still kill you is leaving too low for
      // the cloth to open at all, and the game says so before you press it.
      const wet = isSea(you.pos.x, you.pos.z);
      if (onDown) onDown(you.inflation < 1 ? 'low' : wet ? 'sea' : 'land');
    }
  }

  // ── the picture ────────────────────────────────────────────────────────────
  function pose(camera) {
    if (phase === 'stowed') return;
    camera.position.copy(you.pos);
    camera.up.set(0, 1, 0);
    const cp = Math.cos(you.pitch), hy = you.yaw;
    camera.lookAt(
      you.pos.x - Math.sin(hy) * cp,
      you.pos.y + Math.sin(you.pitch),
      you.pos.z - Math.cos(hy) * cp,
    );
    if (spin > 0.001) {
      // Thrown about rather than spun: three incommensurate rates, all of them
      // fading with the same envelope, so it settles instead of stopping.
      _ejEul.set(
        Math.sin(spinT * 3.1) * 1.35 * spin,
        Math.sin(spinT * 1.7 + 0.9) * 0.75 * spin,
        Math.sin(spinT * 2.2 + 2.3) * 2.40 * spin,
      );
      camera.quaternion.multiply(_ejQ.setFromEuler(_ejEul));
    }

    canopy.visible = phase === 'deploy' || phase === 'flying';
    if (!canopy.visible) return;
    // The canopy hangs off your risers, so it lives in your frame and swings
    // about your shoulders — which is why it is parked on the eye point and
    // rolled, rather than being placed in the world and chased.
    canopy.position.copy(you.pos);
    // Streaming first: a long thin thing that blossoms. One scale does both
    // because a canopy really does grow out of its own diameter.
    const s = phase === 'flying' ? 1 : 0.10 + 0.90 * you.inflation;
    canopy.scale.set(s, phase === 'flying' ? 1 : 0.35 + 0.65 * you.inflation, s);
    // Front risers pull the nose of the canopy down and swing you out behind it,
    // which is the only way you can see that you are diving — the ground is a
    // long way off and does not visibly hurry.
    _ejEul.set(you.swing * 0.35 - you.dive * 0.26, you.yaw, -you.swing);
    canopy.quaternion.setFromEuler(_ejEul);
  }

  return {
    get phase() { return phase; },
    get active() { return phase !== 'stowed'; },
    get flying() { return phase === 'flying'; },
    get pos() { return you.pos; },
    get since() { return t; },
    you,
    canFire, fire, launch, look, update, pose,
    /** Back in the seat. Only a test ever runs the sequence twice. */
    reset() {
      phase = 'stowed';
      canopy.visible = false;
      spin = 0; t = 0; peakG = 0;
      you.vel.set(0, 0, 0);
      you.inflation = 0;
      you.stalled = false;
      you.dive = 0;
      you.vs = 0;
    },
    /** m AGL, for the HUD and for deciding whether the canopy has a chance. */
    agl: () => you.pos.y - EJECT.eye
      - (isSea(you.pos.x, you.pos.z) ? 0 : groundAt(you.pos.x, you.pos.z)),
    stats: () => ({
      phase,
      t: +t.toFixed(2),
      inflation: +you.inflation.toFixed(2),
      alt: +(you.pos.y - EJECT.eye
        - (isSea(you.pos.x, you.pos.z) ? 0 : groundAt(you.pos.x, you.pos.z))).toFixed(1),
      vs: +you.vel.y.toFixed(2),
      spd: +you.vel.length().toFixed(1),
      peakG: +peakG.toFixed(1),
      flare: +you.flare.toFixed(2),
      dive: +you.dive.toFixed(2),
      stalled: you.stalled ? 1 : 0,
      yaw: +you.yaw.toFixed(3),
      at: [Math.round(you.pos.x), Math.round(you.pos.z)],
      sea: isSea(you.pos.x, you.pos.z) ? 1 : 0,
      touchVs: +you.vs.toFixed(2),
    }),
  };
}
