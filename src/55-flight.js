// -----------------------------------------------------------------------------
// Flying the thing.
//
// Arcade-forgiving, as asked: the airframe holds the heading it is pointed in,
// bank turns you, and you cannot spin it. What is *not* softened is the part
// that matters — a full tank is six tonnes of water, and it makes the aeroplane
// feel like a different aeroplane. Heavy on the climb out of a scoop, light and
// eager the moment the doors open.
// -----------------------------------------------------------------------------

const FLIGHT = {
  maxThrust: 10.5,        // m/s² at full power, empty
  dragK: 0.00042,
  vStall: 46,             // m/s where lift stops being enough
  vNever: 175,            // m/s the airframe will not go past, however hard you push
  overboost: 0.6,         // extra fraction of maxThrust with the gate fully open
  rollRate: 1.15,         // rad/s at full deflection
  pitchRate: 0.52,
  yawRate: 0.42,
  gearDownSpeed: 62,
  // Where the wheels put the hull when it is standing on them, and how hard it
  // stops and steers once it is.
  gearHeight: 2.05,
  rollDrag: 1.6,           // m/s per second, free rolling
  brakeDecel: 5.4,         // added while the brakes are on
  steerRate: 0.55,         // rad/s of nosewheel authority at walking pace
  span: 28.6,              // metres, wingtip to wingtip — a CL-415
  // Below this you scrape a building and stop; above it you have hit one.
  // Ending a mission because a taxi turn was two metres out is not a lesson,
  // it is a reload; arriving at a hangar at ninety knots is a different act.
  scrapeSpeed: 22,
  scrapeDrag: 6.0,         // m/s per second lost while still leaning on it

  // ── the assists ─────────────────────────────────────────────────────────
  // The stick is virtual: mouse motion pushes it, and it springs back on its
  // own. Without the spring, any deflection you make is permanent until you
  // wind the mouse back exactly as far, which is the whole reason this thing
  // was unflyable.
  selfCentre: 1.8,        // 1/s — how fast the stick returns to neutral
  handsOffAt: 0.30,       // stick magnitude below which the assists take over
  autoLevel: 1.5,         // hands-off roll-to-wings-level authority
  autoPitch: 0.9,         // hands-off pitch-to-level authority
};

function buildFlight(plane, fire) {
  const p = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    throttle: 0.78,
    boost: 0,                        // 0..1 — how far into the overboost gate
    stick: new THREE.Vector2(),      // x roll, y pitch — mouse, self-centring
    kb: new THREE.Vector2(),         // the same, from the arrow keys — held
    tch: new THREE.Vector2(),        // and from a thumb on the glass — held
    rudder: 0,
    water: 0,
    flaps: 0,
    gearOut: 0,
    doors: 0,
    probes: 0,
    propRpm: 0,
    crashed: false,
    onWater: false,
    onGround: false,       // wheels on a runway
    groundSteer: 0,
    scoopValid: false,
    scoopReason: '',      // an i18n key, not a sentence — see 02-i18n.js
    aoa: 0,
    gLoad: 1,
    lastDropDist: 0,
    slam: 0,              // vertical speed of the last hull contact, one-shot
    scraping: false,      // in contact with a building *since last frame*
    crashSpeed: 0,
    crashOnWater: false,

    assist: 1,            // 0..1 strength of the hands-off stabiliser
    levelling: false,     // Z held — snap to wings level right now
    autopilot: false,     // T — fly the objective on its own
    navTarget: null,      // [x, z, alt] the autopilot is steering to
    apNote: '',           // what the autopilot thinks it is doing
    sens: 1,              // mouse sensitivity multiplier
  };

  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3();
  const right = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _yUp = new THREE.Vector3(0, 1, 0);
  const _lvl = new THREE.Quaternion();
  const _fwd2 = new THREE.Vector3();
  const _eul = new THREE.Euler(0, 0, 0, 'YXZ');

  function axes() {
    fwd.set(0, 0, -1).applyQuaternion(p.quat);
    up.set(0, 1, 0).applyQuaternion(p.quat);
    right.set(1, 0, 0).applyQuaternion(p.quat);
  }

  function reset(x, z, heading, alt) {
    p.pos.set(x, alt, z);
    p.quat.setFromEuler(new THREE.Euler(0, heading, 0, 'YXZ'));
    axes();
    p.vel.copy(fwd).multiplyScalar(86);
    p.water = 0;
    p.crashed = false;
    p.throttle = 0.8;
    p.boost = 0;
    p.stick.set(0, 0);
    p.kb.set(0, 0);
    p.tch.set(0, 0);
    p.slam = 0;
    p.scraping = false;
    p.autopilot = false;
    p.levelling = false;
    p.apNote = '';
  }

  const massOf = () => CONFIG.emptyMass + p.water;      // litres ≈ kg

  // ── autopilot ──────────────────────────────────────────────────────────────
  // Not an autopilot in the aviation sense — it is a "fly me to the job"
  // button. It holds heading and altitude toward p.navTarget, keeps the bank
  // inside 32°, and refuses to fly you into a hill. Scooping and dropping are
  // still yours: it lines the aeroplane up and you press the button.

  function terrainAhead(reach) {
    let hi = 0;
    for (let d = 120; d <= reach; d += 120) {
      const x = p.pos.x + fwd.x * d, z = p.pos.z + fwd.z * d;
      if (!isSea(x, z)) hi = Math.max(hi, groundAt(x, z));
    }
    return hi;
  }

  function autopilotStick(dt, speed, bank, nose) {
    const t = p.navTarget;
    if (!t) return null;

    const dx = t.x - p.pos.x, dz = t.z - p.pos.z;
    const dist = Math.hypot(dx, dz) || 1;

    // Signed bearing error: positive means the target is off to the right.
    const fl = Math.hypot(fwd.x, fwd.z) || 1;
    const err = Math.atan2(
      (fwd.x / fl) * (dz / dist) - (fwd.z / fl) * (dx / dist),
      (fwd.x / fl) * (dx / dist) + (fwd.z / fl) * (dz / dist));

    // Bank commanded by the bearing error, eased off as the target gets close
    // so it settles on the line instead of weaving across it.
    // Sign: bank_dot = -roll * rollRate, so closing on a wanted bank means
    // rolling by +(bank - wantBank). Get this backwards and it is positive
    // feedback — it winds all the way round and flies up on its wingtip.
    // On the run the scoop itself demands wings level (see the check below), so
    // the autopilot may not use the bank it would otherwise want.
    const capa = t.mode === 'scoop' ? 0.15 : 0.62 * sat(dist / 250);
    const wantBank = -clamp(err * 1.15, -capa, capa);       // bank<0 turns right
    const x = clamp((bank - wantBank) * 2.4, -1, 1);

    // Altitude. The stick loop is on *attitude*, not on vertical speed: a
    // direct vertical-speed-to-stick loop is bang-bang, and the first thing it
    // did was porpoise the aeroplane into the Adriatic.
    // Terrain floor. 1600 m of lookahead is 23 seconds at this speed and it
    // held the aeroplane 300 m over the fire, too high to drop; 900 m is still
    // more than the climb needs.
    // Terrain floor — over *terrain*. Adding the clearance to sea level too put
    // a hard 60 m floor under the aeroplane over open water, which is below
    // the height at which it is allowed to start a scoop run: a deadlock, and
    // the reason it circled the channel for ever without ever touching down.
    const gy = isSea(p.pos.x, p.pos.z) ? 0 : groundAt(p.pos.x, p.pos.z);
    const hi = Math.max(gy, terrainAhead(900));
    const clear = t.mode === 'scoop' ? 5 : t.mode === 'fire' ? 40 : 60;
    const floor = hi > 2 ? hi + clear : 4;
    const wantY = Math.max(t.alt, floor);
    // Let her come down properly when she is a long way high; a flat -9 m/s
    // means a descent from cruise takes more sea than the run is long.
    const vsDown = -clamp(6 + (p.pos.y - wantY) * 0.05, 6, 16);
    const vs = clamp((wantY - p.pos.y) * 0.26, vsDown, 8.5);
    // The +0.035 is roughly the cruise angle of attack; the second term trims
    // out whatever the first one gets wrong, so the descent actually descends.
    const wantNose = clamp(
      Math.asin(clamp(vs / Math.max(speed, 30), -1, 1)) + 0.035
      + clamp((vs - p.vel.y) * 0.010, -0.07, 0.07), -0.28, 0.26);
    let y = clamp((wantNose - nose) * 4.0, -1, 1);
    // Past about 50° of bank the elevator swings the nose sideways rather than
    // up, so stop asking it to. Roll out first, then climb.
    y *= Math.max(0, Math.cos(bank)) ** 0.7;
    if (speed < FLIGHT.vStall * 1.12) y = Math.min(y, 0.1);

    // Throttle flies itself too, or the assist is only half an assist.
    // Slower than a hand-flown cruise on purpose: the turn radius goes as v²,
    // and at 96 m/s she cannot get round onto anything.
    const wantSpd = t.mode === 'scoop' ? 66 : 70;
    p.throttle = clamp(p.throttle + clamp((wantSpd - speed) * 0.05, -1, 1) * 0.9 * dt, 0.15, 1);

    p.apNote = t.label || '';
    return { x, y };
  }

  function update(dt, input) {
    if (p.crashed) return;
    axes();

    const speed = p.vel.length();
    const massRatio = CONFIG.emptyMass / massOf();

    // ── controls ──────────────────────────────────────────────────────────
    // Control authority falls away with airspeed, which is what makes a heavy
    // low-speed scoop run feel like walking a tightrope.
    const q = sat((speed / 62) ** 1.4);

    // Attitude read off the axes rather than an Euler triple, so it stays sane
    // wherever the nose is pointing. bank < 0 is right wing down.
    let bank = Math.atan2(right.y, up.y);
    const nose = Math.asin(clamp(fwd.y, -1, 1));

    // Three sticks summed: the mouse one springs back to neutral on its own
    // (see 90-app.js), the keyboard one is held for as long as the key is, and
    // the touch one is held for as long as the thumb is on the glass.
    let sx = clamp(p.stick.x + p.kb.x + p.tch.x, -1, 1);
    let sy = clamp(p.stick.y + p.kb.y + p.tch.y, -1, 1);

    if (p.autopilot && Math.hypot(sx, sy) > 0.25) { p.autopilot = false; p.apNote = ''; }
    // If the autopilot has nothing to steer to it stays engaged but hands over
    // to the ordinary stabiliser, rather than dropping the aeroplane on the
    // floor mid-descent with the throttle back.
    const auto = p.autopilot ? autopilotStick(dt, speed, bank, nose) : null;
    if (auto) { sx = auto.x; sy = auto.y; }

    // Squared response: fine round centre, still full authority at the stop.
    let roll = Math.sign(sx) * sx * sx;
    let pitch = Math.sign(sy) * sy * sy;

    // Hands-off she flies herself — wings level, nose on the horizon, vertical
    // speed washed out. Faded in as the stick nears neutral so it never argues
    // with a deliberate input. Not realistic; the right call for a game whose
    // subject is the fire rather than the aeroplane.
    const off = 1 - Math.min(1, Math.hypot(sx, sy) / FLIGHT.handsOffAt);
    const hands = auto ? 0 : Math.max(off * p.assist, p.levelling ? 1 : 0);
    if (hands > 0.001) {
      roll += clamp(bank * 1.8, -1, 1) * FLIGHT.autoLevel * hands;
      let ph = clamp(-nose * 1.9 - p.vel.y * 0.055, -1, 1);
      // Never let the stabiliser hold the nose up into a stall: below the
      // number it commands the nose *down* until the speed comes back.
      if (speed < FLIGHT.vStall * 1.06) {
        ph = Math.min(ph, clamp((speed - FLIGHT.vStall * 1.06) * 0.06, -0.7, 0));
      }
      pitch += ph * FLIGHT.autoPitch * hands;
      // Hands off she should not be allowed to run out of speed either.
      if (speed < FLIGHT.vStall * 1.25) {
        p.throttle = Math.min(1, p.throttle + 0.5 * hands * dt);
      }
    }
    // Attitude limiter. Rate control with a held input walks you all the way
    // round — three seconds on the arrow key used to leave you inverted. The
    // assist fades the command out past the limit and pushes back toward it.
    if (p.assist > 0.01 && !p.autopilot) {
      const bl = lerp(2.2, 1.15, p.assist);                  // 126° .. 66°
      const bx = clamp((Math.abs(bank) - bl) / 0.35, 0, 1);
      if (bx > 0) {
        if (Math.sign(roll) === -Math.sign(bank)) roll *= 1 - bx;
        roll += clamp(bank * 2.0, -1, 1) * bx;
      }
      const pl = lerp(1.25, 0.80, p.assist);                 // 72° .. 46°
      const px = clamp((Math.abs(nose) - pl) / 0.30, 0, 1);
      if (px > 0) {
        if (Math.sign(pitch) === Math.sign(nose)) pitch *= 1 - px;
        pitch -= Math.sign(nose) * px * 0.9;
      }
    }

    roll = clamp(roll, -1.4, 1.4);
    pitch = clamp(pitch, -1.2, 1.2);

    const dRoll = -roll * FLIGHT.rollRate * q * dt;
    const dPitch = pitch * FLIGHT.pitchRate * q * dt * lerp(1, 0.72, 1 - massRatio);
    const dYaw = p.rudder * FLIGHT.yawRate * q * dt;

    _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), dRoll); p.quat.multiply(_q);
    _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), dPitch); p.quat.multiply(_q);
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), dYaw); p.quat.multiply(_q);

    // Bank-to-turn: the horizontal component of lift swings the nose round.
    // The sign matters and was wrong for a long time — bank < 0 is right wing
    // down, and a right wing down has to yaw the nose to the right.
    axes();
    bank = Math.atan2(right.y, up.y);
    if (speed > 12) {
      const turn = Math.sin(bank) * 9.81 / Math.max(speed, 20) * dt * 1.25;
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn);
      p.quat.premultiply(_q);
      axes();
    }
    p.quat.normalize();

    // ── forces ────────────────────────────────────────────────────────────
    const thrust = FLIGHT.maxThrust * (p.throttle + p.boost * FLIGHT.overboost) * massRatio;
    // Water in the tank is drag as well as weight; so are the probes.
    const dragArea = 1 + p.flaps * 0.55 + p.gearOut * 0.35 + p.probes * 0.9 + p.doors * 0.4;
    // vNever was a number nobody read for a long time. It is the ceiling now:
    // past it drag climbs off the quadratic, so the boost runs into a wall a
    // few metres per second the far side of it instead of running away. You can
    // lean on VNE, you cannot sail through it.
    const over = Math.max(0, speed - FLIGHT.vNever);
    const drag = FLIGHT.dragK * speed * speed * dragArea + over * over * 0.02;

    p.vel.addScaledVector(fwd, (thrust - drag) * dt);
    p.vel.y -= 9.81 * dt;

    // Lift: enough to hold level flight above the stall, falling off sharply
    // below it. Flaps buy about 18% more.
    const lf = sat(speed / FLIGHT.vStall);
    const lift = 9.81 * lf * lf * (1 + p.flaps * 0.18);
    p.vel.addScaledVector(up, lift * dt);
    p.gLoad = lift / 9.81 / Math.max(0.2, up.y);

    // The airframe steers the airflow: velocity is pulled toward where the
    // nose points. This one line is most of what makes it feel like flying.
    const grip = 1 - Math.exp(-sat(speed / 42) * 2.6 * dt);
    const along = fwd.clone().multiplyScalar(speed);
    p.vel.lerp(along, grip * 0.9);

    p.pos.addScaledVector(p.vel, dt);
    p.aoa = Math.asin(clamp(-p.vel.clone().normalize().dot(up), -1, 1));

    // ── the aerodrome structures ──────────────────────────────────────────
    // The only solid objects in the game. Not an oversight that the rest are
    // not: the town is thirteen thousand extruded OSM footprints and making
    // those solid would turn every low pass over Šibenik into a crash, on a
    // building whose height was guessed from its footprint. The hangars are
    // thirty metres from where you park, and taxiing through the terminal is
    // the one collision every player is going to try.
    if (typeof airfield !== 'undefined' && airfield && airfield.hitStructure) {
      // An aeroplane is not a point. Nose, tail and both wingtips, because
      // clipping a hangar with a wingtip is a real way to lose a Canadair and
      // should not go unnoticed just because the fuselage went past.
      const hs = FLIGHT.span * 0.5;
      let worst = null;
      for (const [ax, az] of [
        [fwd.x * 9.5, fwd.z * 9.5], [-fwd.x * 10.5, -fwd.z * 10.5],
        [right.x * hs, right.z * hs], [-right.x * hs, -right.z * hs],
      ]) {
        const h = airfield.hitStructure(
          p.pos.x + ax, p.pos.z + az, p.pos.y - 1.6, 1.0);
        if (h && (!worst || h.depth > worst.depth)) worst = h;
      }
      if (worst) {
        if (speed > FLIGHT.scrapeSpeed) {
          p.crashed = true;
          p.crashSpeed = speed;
          p.crashOnWater = false;
        } else {
          // Slow enough to be a scrape. Out along the shortest way out, and
          // kill the part of the velocity going *into* the wall — which on its
          // own is what stops you, and leaves the part running along it alone
          // so you can still steer off the thing you are leaning on.
          p.pos.x += worst.nx;
          p.pos.z += worst.nz;
          const n = Math.hypot(worst.nx, worst.nz) || 1;
          const into = (p.vel.x * worst.nx + p.vel.z * worst.nz) / n;
          if (into < 0) {
            p.vel.x -= (worst.nx / n) * into;
            p.vel.z -= (worst.nz / n) * into;
          }
          // Contact is a state, not an event, and the two want different
          // things. Resting against a wall costs a little speed per second, so
          // dragging a wingtip down a hangar is slow. Arriving at one is a
          // bang, and it fires on the *transition* — scaled by how hard you
          // came in, once. Doing either every frame is what glues an aeroplane
          // to a building: half the velocity thirty times a second is nothing
          // left, and the same thump thirty times a second is a drone.
          if (!p.scraping) {
            p.vel.multiplyScalar(0.5);
            const bang = -Math.max(0.9, Math.abs(into) * 0.6);
            if (p.slam > bang) p.slam = bang;
          } else {
            const sp = Math.hypot(p.vel.x, p.vel.z);
            if (sp > 0.05) {
              const k = Math.max(0, sp - FLIGHT.scrapeDrag * dt) / sp;
              p.vel.x *= k; p.vel.z *= k;
            }
          }
          p.scraping = true;
        }
      } else {
        p.scraping = false;
      }
    } else {
      p.scraping = false;
    }

    // ── the ground, and the sea ───────────────────────────────────────────
    const gy = groundAt(p.pos.x, p.pos.z);
    const overSea = isSea(p.pos.x, p.pos.z);
    const surface = overSea ? 0 : gy;
    const agl = p.pos.y - surface;
    state.altAgl = agl;
    state.speed = speed;
    p.onWater = overSea && agl < 2.2;

    // A runway is the one piece of land this aeroplane is allowed to touch, and
    // only with the gear actually down. `onRunway` answers in runway-local
    // coordinates, including how far off the centreline you are, because
    // arriving in the grass beside it is not a landing.
    let rw = null;
    if (!overSea && p.gearOut > 0.85 && typeof airfield !== 'undefined'
      && airfield && airfield.onRunway) {
      rw = airfield.onRunway(p.pos.x, p.pos.z);
      // Once you are down and rolling, the taxiway and the apron count too. A
      // *landing* has to be on the runway and nothing here changes that — this
      // needs the wheels already on the ground, which on an approach they are
      // not. Without it, the wheels came off the world the instant you turned
      // off the runway, and every reason to be on the ground at all is parked
      // on the apron.
      //
      // Being *off the centreline* has to go the same way, and that one was
      // fatal. The box onRunway() answers to is eight metres wider than the
      // runway on each side, and anything past off = 0.92 is treated below as
      // arriving in the grass, i.e. as an accident. Rolling out of the taxiway
      // you cross that margin every single time — so the one manoeuvre the
      // whole aerodrome exists for, taxi out and line up, was a guaranteed
      // crash at walking pace. You could not leave the apron.
      if (p.onGround && speed < 60 && (!rw || rw.off >= 0.92)) {
        const py = airfield.onPaved(p.pos.x, p.pos.z);
        if (py != null) rw = { t: 0, s: 0, y: py, off: 0, taxi: true };
      }
      // And running off the concrete altogether is a bumpy roll across the
      // field, not a fireball. Putting a wheel on the grass beside the taxiway
      // ended the mission on the spot, which for an aeroplane doing twenty
      // knots is not a thing that happens to it. Only inside the aerodrome:
      // everywhere else, touching the ground is still what it was.
      //
      // Deliberately *not* conditioned on already being on the ground. The
      // concrete stands a metre or so proud of the field it was graded into, so
      // rolling off the edge drops you — for one frame the wheels are on
      // nothing, p.onGround goes false, and the fall that follows arrives with
      // more than the 4.2 m/s the branch below is willing to call a landing. So
      // the aeroplane blew up from driving slowly off a kerb. Below the stall
      // speed and within three metres of the dirt you are not flying, whatever
      // last frame thought.
      // The pad is generous on purpose. The taxiway is sixty metres long and
      // this aeroplane accelerates, so arriving at the runway faster than you
      // meant to and needing another eighty metres to stop is the ordinary
      // mistake, not an exotic one — and running out of aerodrome in the middle
      // of it should leave you sitting in a field, not dead.
      if (!rw && speed < 45 && agl < 3.0 && airfield.inField
        && airfield.inField(p.pos.x, p.pos.z, 150)) {
        rw = { t: 0, s: 0, y: gy, off: 0, taxi: true, rough: true };
      }
    }

    // Cleared every frame and set again only by the runway branch below, so
    // lifting off cannot leave the aeroplane believing it is still rolling.
    p.onGround = false;
    if (agl < 1.4 || (rw && p.pos.y - rw.y < FLIGHT.gearHeight + 0.15)) {
      const vv = p.vel.y;
      const wingsLevel = Math.abs(bank) < 0.35;
      // A drop off the edge of the concrete onto the field beside it is worth
      // about 6 m/s by the time the wheels find the dirt, so a rough arrival is
      // allowed to be rougher than a landing before it counts as one.
      const vvOk = rw && rw.rough ? -7.5 : -4.2;
      if (rw && vv > vvOk && wingsLevel && speed < 108 && rw.off < 0.92) {
        // Touchdown and roll. Anything with real vertical speed in it still
        // gets felt — 56-alerts.js turns p.slam into a bang and a shake.
        if (!p.onGround && vv < -1.0 && p.slam > vv) p.slam = vv;
        p.onGround = true;
        p.pos.y = rw.y + FLIGHT.gearHeight;
        p.vel.y = 0;
        // The undercarriage holds her level, so on the ground the roll and the
        // pitch are washed out and only the heading is kept. Without it, the
        // yaw-roll coupling that makes her fly leans her a degree at a time
        // while you steer, and at twenty degrees `wingsLevel` above goes false
        // and the aeroplane is written off — taxiing, at walking pace, wings
        // nowhere near anything. Two tenths of a second, so a landing with a
        // wing down straightens up rather than snapping.
        _fwd2.set(0, 0, -1).applyQuaternion(p.quat);
        _eul.set(0, Math.atan2(-_fwd2.x, -_fwd2.z), 0);
        _lvl.setFromEuler(_eul);
        p.quat.slerp(_lvl, Math.min(1, dt * 5));
        // Rolling resistance, plus the wheel brakes. SPACE is the scoop in the
        // air and has nothing to do on a runway, so on the ground it is the
        // brake — one fewer key to learn at the only moment you need it.
        const brake = (input.scoop ? FLIGHT.brakeDecel : 0)
          + (input.thrDown ? FLIGHT.brakeDecel * 0.4 : 0);
        // Grass costs you: about three times the rolling drag of concrete, which
        // is what makes running off it a thing you want to correct rather than a
        // free second runway.
        const decel = FLIGHT.rollDrag * (rw.rough ? 3.2 : 1) + brake;
        const sp = p.vel.length();
        if (sp > 0.05) p.vel.multiplyScalar(Math.max(0, sp - decel * dt) / sp);
        // Nosewheel steering: the rudder turns the aeroplane on the ground, and
        // the authority falls off with speed the way a real one does.
        //
        // It turns the *aeroplane*. What it did before was rotate the velocity
        // vector and put the rate in p.groundSteer, which nothing anywhere ever
        // read — so the nose went on pointing exactly where it had been, thrust
        // kept hauling her back onto the heading she started with, and she
        // could not be turned on the ground at all. About a degree a second of
        // crab, and that only because the sideslip eventually told on her.
        //
        // Which means that from a stand parked square to the taxiway there was
        // no way to line up on the runway and therefore no way to take off, and
        // that is the whole of the bug: not the throttle, not the stand, not
        // pulling up too early. You could not steer.
        const steer = p.rudder * FLIGHT.steerRate * sat(1 - sp / 55) * (sp > 0.4 ? 1 : 0);
        _q.setFromAxisAngle(_yUp, steer * dt);
        p.quat.multiply(_q);
        // And the wheels take the velocity round with her, or she tracks off in
        // the old direction while pointing somewhere new. Same sense as the yaw
        // above, so the pedals mean on the concrete what they mean in the air.
        const c = Math.cos(steer * dt), sn = Math.sin(steer * dt);
        const vx = p.vel.x * c + p.vel.z * sn;
        const vz = -p.vel.x * sn + p.vel.z * c;
        p.vel.x = vx; p.vel.z = vz;
        p.groundSteer = steer;
      } else if (overSea && vv > -5.5 && wingsLevel && speed < 125) {
        // A controlled touch on the water: skim, don't sink. Anything with
        // real vertical speed in it still wants to be *felt* — see
        // 56-alerts.js, which turns this into a bang and a shake.
        if (vv < -1.6 && p.slam > vv) p.slam = vv;
        p.pos.y = surface + 1.4;
        p.vel.y = Math.max(p.vel.y, 0);
        // Hull drag — this is what makes you firewall the throttle to get off.
        p.vel.multiplyScalar(1 - 0.55 * dt);
      } else {
        p.crashed = true;
        p.crashSpeed = speed;
        p.crashOnWater = overSea;
      }
    }
    if (Math.abs(p.pos.x) > HALF - 200 || Math.abs(p.pos.z) > HALF - 200) {
      // Turn you round rather than let you leave — no invisible wall message.
      // Pushed straight inward it also acts as an airbrake, and an aeroplane
      // pointed out to sea just decelerates into the water; take only the part
      // across the flight path, which turns without slowing.
      const inward = new THREE.Vector3(-p.pos.x, 0, -p.pos.z).normalize();
      const lat = inward.clone().addScaledVector(fwd, -inward.dot(fwd));
      if (lat.lengthSq() < 0.04) lat.copy(right).multiplyScalar(right.dot(inward) < 0 ? -1 : 1);
      p.vel.addScaledVector(lat.normalize(), 30 * dt);
    }

    // ── scooping ──────────────────────────────────────────────────────────
    const runAhead = waterRunClear(p.pos.x, p.pos.z, fwd.x, fwd.z, 900);
    p.scoopValid = false;
    p.scoopReason = '';
    if (p.water >= CONFIG.tankCapacity - 1) {
      p.scoopReason = 'scoop.full';
    } else if (!overSea) {
      p.scoopReason = 'scoop.notWater';
    } else if (agl > CONFIG.scoopMaxAlt) {
      p.scoopReason = 'scoop.tooHigh';
    } else if (speed < CONFIG.scoopSpeed[0]) {
      p.scoopReason = 'scoop.tooSlow';
    } else if (speed > CONFIG.scoopSpeed[1]) {
      p.scoopReason = 'scoop.tooFast';
    } else if (Math.abs(bank) > 0.20) {
      p.scoopReason = 'scoop.bank';
    } else if (!runAhead) {
      p.scoopReason = 'scoop.noRun';
    } else {
      p.scoopValid = true;
    }

    const wantScoop = input.scoop && p.scoopValid;
    p.probes = damp(p.probes, wantScoop ? 1 : 0, 6, dt);
    if (wantScoop) {
      p.water = Math.min(CONFIG.tankCapacity, p.water + CONFIG.scoopRate * dt);
      // Scooping is a brake — six tonnes of water has to be accelerated. It
      // must not out-brake the engines though: at 0.16 the deceleration beat
      // full thrust and the run could never be completed.
      p.vel.multiplyScalar(1 - 0.07 * dt);
    }
    state.scooping = wantScoop;

    // ── dropping ──────────────────────────────────────────────────────────
    const wantDrop = input.drop && p.water > 0 && agl > 3;
    p.doors = damp(p.doors, wantDrop ? 1 : 0, 9, dt);
    state.dropping = wantDrop;
    if (wantDrop) {
      const out = Math.min(p.water, CONFIG.dropRate * dt);
      p.water -= out;
      // Where it lands: forward of the aircraft by the time it takes to fall,
      // which is why you have to lead the fire.
      const fall = Math.sqrt(Math.max(0, 2 * Math.max(0, agl) / 9.81));
      const lx = p.pos.x + p.vel.x * fall;
      const lz = p.pos.z + p.vel.z * fall;
      p.lastDropDist = Math.hypot(p.vel.x, p.vel.z) * fall;
      const d = Math.hypot(fwd.x, fwd.z) || 1;
      const r = fire.drop(lx, lz, fwd.x / d, fwd.z / d, out);
      state.litresDropped += out;
      state.litresOnTarget += r.onTarget;
      dropSplashes.emit(lx, lz, out, fwd);
    }
    state.water = p.water;

    // ── configuration ─────────────────────────────────────────────────────
    p.flaps = damp(p.flaps, input.flaps ? 1 : (wantScoop ? 0.55 : 0), 2.2, dt);
    p.gearOut = damp(p.gearOut, input.gear ? 1 : 0, 1.2, dt);
    p.propRpm = damp(p.propRpm, 0.35 + (p.throttle + p.boost * 0.5) * 0.65, 2.5, dt);

    // Throttle, and past the stop, the overboost gate.
    //
    // W used to run out of travel: a second and three quarters from idle to the
    // stop, and then nothing, however long you held it. Which is a plateau you
    // can feel — the aeroplane stops answering a key that is still down. So the
    // lever has somewhere left to go. Holding W at the stop walks the gate open
    // over two seconds for half as much thrust again; letting go closes it in
    // one and a quarter, so it costs a held key rather than being free cruise,
    // and nothing that sets the throttle on its own — the autopilot, the
    // hands-off stall guard — ever touches it.
    if (input.thrUp) {
      p.throttle = Math.min(1, p.throttle + dt * 0.55);
      if (p.throttle >= 1) p.boost = Math.min(1, p.boost + dt * 0.5);
    } else {
      if (input.thrDown) p.throttle = Math.max(0, p.throttle - dt * 0.55);
      p.boost = Math.max(0, p.boost - dt * 0.8);
    }
  }

  /** Push the visual model to match the physics. */
  function pose(model, dt) {
    model.root.position.copy(p.pos);
    model.root.quaternion.copy(p.quat);

    const pr = model.parts;
    const defl = (m, ax, a) => { if (m) m.rotation[ax] = a; };
    defl(pr.aileronL, 'x', p.stick.x * 0.42);
    defl(pr.aileronR, 'x', -p.stick.x * 0.42);
    defl(pr.elevator, 'x', -p.stick.y * 0.36);
    defl(pr.rudder, 'y', -p.rudder * 0.42);
    defl(pr.flapL, 'x', p.flaps * 0.62);
    defl(pr.flapR, 'x', p.flaps * 0.62);

    for (const h of pr.props) h.rotation.z += dt * p.propRpm * 96;
    const discA = sat((p.propRpm - 0.45) * 2.4);
    if (pr.discL) { pr.discL.material.opacity = discA * 0.30; pr.discL.material.transparent = true; }
    if (pr.discR) { pr.discR.material.opacity = discA * 0.30; pr.discR.material.transparent = true; }

    for (const d of pr.doors) d.mesh.rotation.z = d.side * p.doors * 1.15;
    for (const pb of pr.probes) pb.position.y = -1.12 - p.probes * 0.55;

    pr.gear.visible = p.gearOut > 0.02;
    pr.gear.scale.setScalar(Math.max(0.02, p.gearOut));
  }

  return { p, update, pose, reset, axes: () => ({ fwd, up, right }) };
}
