// -----------------------------------------------------------------------------
// Rokići, on foot.
//
// The aeroplane is the game. This is the twenty minutes at the other end of it,
// and it is a different game on purpose: you have a branch instead of six tonnes,
// a jet that reaches twenty metres instead of a drop that covers two hundred, and
// four hundred litres at a time instead of six thousand. From the air a burning
// fuel drum is not visible. From four metres away it is the only thing there is.
//
// Three decisions carry the whole mode:
//
//  1. **It is a set-piece, not an open world.** The mission is inside the wire.
//     There are thirteen thousand buildings out there and not one of them has an
//     interior, a door or a floor; walking to them would be walking to a facade.
//     The fence is the edge of the mission and it is a real fence, drawn.
//
//  2. **The fire here is the same fire.** Nothing is scripted alight. The
//     automaton that has been chasing you all game throws embers downwind, and
//     an airfield chosen for being clear of the ignition point is not clear of
//     spotting — a crown fire in Mediterranean maquis puts burning material a
//     kilometre and more ahead of the front, which is precisely how these fires
//     get around the people fighting them.
//
//  3. **The people are the point, and they are rescued, not shot.** Somebody
//     whose clothing has caught runs, because that is what people do and it is
//     the worst possible thing to do. You put them out. If you are slow they go
//     down, and if you are slower than that you lose them, and the radio says so.
//     There is nothing here you can aim at that you should not be aiming at.
// -----------------------------------------------------------------------------

const GROUND = {
  eye: 1.66,
  walk: 3.4,               // m/s — a fast walk in kit
  // Shift. 6.1 m/s was a real sprint in real kit and it was the wrong number:
  // the places you are asked to cross on foot are four hundred metres of
  // promenade and a kilometre of aerodrome, and a minute of holding a key in a
  // straight line is not a game, it is a commute. 9.4 is frankly superhuman —
  // it is world-record pace, in boots, carrying a pump — and it is what makes
  // the distances read the way they are meant to.
  run: 9.4,
  // Divided by the top speed below, so the ramp is a fixed *fraction* of it per
  // second rather than a fixed m/s²; raised with `run` to keep the time to
  // speed at about a fifth of a second, which is the difference between a
  // sprint that starts when you press the key and one that has to be argued
  // into moving.
  accel: 46,
  drag: 13,
  girth: 0.55,             // how far you are pushed back out of a wall
  // And out of a person. The rig is 0.40 m across the shoulders with the arms
  // hanging outside that, so 0.30 is honestly what one of them occupies and two
  // of them keep 0.60 m between centres: close enough to hand something over,
  // not close enough to stand inside each other. Deliberately less than `girth`,
  // because a wall is a surface you must never be able to see through whereas a
  // colleague is somebody you are allowed to be shoulder to shoulder with — and
  // because it has to stay well inside the branch or being solid would stop you
  // putting anybody out. The jet leaves the nozzle 0.55 m in front of you and
  // catches anything within 0.62 m of its axis, so 0.60 is still point blank.
  body: 0.30,
  turn: 2.1,               // rad/s on the arrow keys — about 120 degrees a second

  // The walk itself. Stride is one boot to the next, not heel to heel of the
  // same boot: 0.78 m is an adult covering ground in kit, which at the 3.4 m/s
  // above works out at about four and a half steps a second — brisk, which is
  // what somebody walking towards a fire is.
  stride: 0.78,
  bobY: 0.055,             // m the head drops as each boot lands
  bobX: 0.038,             // m it goes side to side, once per pair of steps

  // The trolley pump you drag off the aeroplane. Four hundred litres at nine a
  // second is forty-three seconds of water, and then you are running back to the
  // hull while everything you were winning against carries on burning. That
  // round trip *is* the mode: an aeroplane carries six thousand litres and a
  // person carries what a person can carry.
  pack: 400,
  flow: 9.2,               // litres per second out of the branch
  refillRate: 300,
  // Both mean "at the aeroplane", and both have to be larger than the distance
  // you step out to — seventeen metres to port to clear a 28.6 m wing, plus
  // seven aft to clear the propellers. Smaller, and getting out left you unable
  // to turn round and get straight back in.
  refillDist: 21,
  boardDist: 21,

  jetV: 23,                // m/s at the nozzle
  jetSteps: 26,
  jetDt: 0.045,

  // Thirty litres puts a person out — about four seconds of the branch held on
  // them. It is a small number next to a drum of avgas because a person is a
  // small fire, and being generous here is right: the difficulty is reaching
  // somebody who is running, not soaking them once you have.
  crewSoak: 30,
  crewDry: 0.05,           // wetness lost per second while still alight
  crewBurn: 34,            // seconds alight before they go down
  crewDown: 24,            // seconds down before it is too late

  spotRange: 2600,         // how close the front comes before embers reach here
  spotDelay: 9,            // seconds between the tower's call and the first flame
};

// The figure is Blender-authored — tools/blender/firefighter.py — and arrives as
// eleven rigid parts on a tree of joints. What matters at this end is the sign
// convention, because every line of the animation depends on it:
//
//   forward is +X, up is +Y, the figure's own left is -Z
//   a joint's rotation.z swings its far end toward +X, i.e. forward
//   a joint's rotation.x swings its far end toward the figure's left
//
// So a hip that strides forward is positive z, a knee (which only flexes one
// way) is negative z, an elbow is positive z, and arms thrown out sideways are
// ±x. Getting this wrong is not subtle and it is what the boxes did: they swung
// their legs about the *forward* axis, so the whole crew scissored sideways
// instead of walking, which is most of why they looked like boxes.

/** Same eleven joints, boxes instead of geometry — for a missing payload. */
function boxRig() {
  const box = (d, h, w, y) => {
    const g = new THREE.BoxGeometry(d, h, w);
    g.translate(0, y, 0);
    return g;
  };
  const P = (name, parent, pivot, geo) => ({ name, parent, pivot, geo });
  return {
    tris: 132,
    parts: [
      P('pelvis', -1, [0, 0.90, 0], box(0.28, 0.24, 0.34, 0.02)),
      P('torso', 0, [0, 0.10, 0], box(0.30, 0.46, 0.40, 0.25)),
      P('head', 1, [0, 0.50, 0], box(0.22, 0.27, 0.22, 0.14)),
      P('armLU', 1, [0, 0.44, -0.205], box(0.13, 0.32, 0.13, -0.16)),
      P('armLL', 3, [0, -0.32, 0.010], box(0.12, 0.34, 0.12, -0.17)),
      P('armRU', 1, [0, 0.44, 0.205], box(0.13, 0.32, 0.13, -0.16)),
      P('armRL', 5, [0, -0.32, -0.010], box(0.12, 0.34, 0.12, -0.17)),
      P('legLU', 0, [0, 0, -0.105], box(0.18, 0.43, 0.19, -0.215)),
      P('legLL', 7, [0, -0.43, 0.005], box(0.20, 0.47, 0.17, -0.235)),
      P('legRU', 0, [0, 0, 0.105], box(0.18, 0.43, 0.19, -0.215)),
      P('legRL', 9, [0, -0.43, -0.005], box(0.20, 0.47, 0.17, -0.235)),
    ],
  };
}

/**
 * Hang one figure off a rig, sharing the rig's geometry with every other figure
 * and giving each its own material. Seven materials is one shader program —
 * three.js caches on source — and it buys a per-person wetness and char that a
 * shared vertex attribute could not express.
 */
function makeFigure(rig, scene) {
  const mat = solidMaterial(0xffffff, {
    spec: 0.07,
    specPower: 22,
    uniforms: { uWet: { value: 0 }, uChar: { value: 0 } },
    decl: 'uniform float uWet;\nuniform float uChar;',
    body: `
      base *= vVCol;
      // Soaked kit goes dark and glossy. Not decoration: it is the only thing
      // that tells you, at four metres and in one glance, that the water is
      // landing on the person rather than a metre past them.
      base *= mix(1.0, 0.52, uWet);
      spec = mix(spec, 0.60, uWet);
      // Scorched, not carbonised. Toward a sooty version of whatever the kit
      // already was rather than toward black: mixing all the way to black takes
      // the helmet and the face with it, and somebody you have just put out
      // should still read as a person in orange and not as a silhouette.
      base = mix(base, base * 0.30 + vec3(0.048, 0.042, 0.040), uChar);
    `,
  });
  const root = new THREE.Group();
  // YXZ on the root, so that going down and rolling is a roll about the body's
  // own long axis rather than about whichever way the world happens to point.
  // Standing, the order changes nothing; face down, it is the difference
  // between stop-drop-and-roll and a corkscrew.
  root.rotation.order = 'YXZ';
  const fig = { root, mat, joints: [] };
  for (const p of rig.parts) {
    const g = new THREE.Group();
    g.position.set(p.pivot[0], p.pivot[1], p.pivot[2]);
    g.add(new THREE.Mesh(p.geo, mat));
    (p.parent < 0 ? root : fig.joints[p.parent]).add(g);
    fig.joints.push(g);
    fig[p.name] = g;
  }
  // The pelvis rides up and down over the gait, so its rest height has to be
  // read off the rig rather than written down twice.
  fig.restY = fig.pelvis.position.y;
  scene.add(root);
  return fig;
}

async function buildGround(scene, field) {
  // No site, no mode. The airfield search can fail on a world this rocky and the
  // rest of the game has to carry on without noticing.
  if (!field || !field.site) {
    // Every method the frame loop and the debug hooks reach for, because they
    // reach for some of them unconditionally: `ground.hose()` is read on every
    // frame to mix the audio, and a stub that is missing it turns a failed
    // airfield search into a TypeError sixty times a second.
    return {
      ok: false, active: false, armed: false,
      update() {}, enter() {}, leave() {}, pose() {}, look() {}, reset() {},
      canEnter: () => false, canBoard: () => false,
      hud: () => null, stats: () => null, hose: () => 0,
      you: {}, crew: [], force() {}, setSpray() {}, put() {}, bail: () => false,
      aimAt: () => false,
    };
  }

  const rng = mulberry32(CONFIG.seed ^ 0x6f00d1);
  let objects = field.objects;
  const flames = buildFlames(scene, 220);
  const jetSpray = buildSprayPool(scene, 900, 7.5, 1.1);
  // Negative gravity, so it climbs. Steam off a person you have just hit is the
  // single clearest signal in the mode that the branch is on target — more
  // legible than the flame shrinking, because it happens on the first frame.
  const steam = buildSprayPool(scene, 380, -1.7, 2.3);

  // ── the crew ───────────────────────────────────────────────────────────────
  const rig = (await loadRig('firefighter_fr3d')) || boxRig();

  // Where anybody not on fire walks to: in front of the terminal, off the apron
  // and away from the fuel farm, which is where a muster point goes.
  const MUSTER = (() => {
    const [t, s] = field.local(field.apron[0], field.apron[2]);
    return field.toWorld(t - 60, s - 34);
  })();

  const allCrew = field.crewSpots.map((p, i) => {
    const fig = makeFigure(rig, scene);
    fig.root.position.set(p[0], p[1], p[2]);
    fig.root.visible = false;                 // nobody is out there until it starts
    // Everybody stands somewhere slightly different in the muster, or seven
    // people converge on one point and stand inside each other.
    const a = (i / field.crewSpots.length) * TAU + rng();
    return {
      fig, x: p[0], y: p[1], z: p[2],
      hx: 1, hz: 0, vx: 0, vz: 0,
      mode: 'idle',              // idle | walk | alight | down | safe | thanks | lost
      burn: 0, wet: 0, timer: 0, gait: rng() * 6.28, seed: rng(), id: i,
      shouted: false,
      // Where this one is heading and how long before they think of somewhere
      // else. `pace` is how fast they get there; `look` is what their head is
      // doing, which is the difference between standing and standing still.
      dest: null, wait: 1 + rng() * 4, pace: 1.5, look: 0, lookT: 0,
      roll: 0, char: 0, spot: [Math.cos(a) * 4.4, Math.sin(a) * 4.4],
    };
  });
  // Who is actually out there. The figures are built once, against the
  // aerodrome, because that is the only place in the world with a crew in it —
  // walking a hillside you came down on by parachute, this is empty and they
  // are all hidden.
  let crew = allCrew;

  // ── the player ─────────────────────────────────────────────────────────────
  const you = {
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0,
    pack: GROUND.pack, spraying: false, jet: 0, refilling: false,
    aim: [0, 0, 0], aimKind: null, aimSoak: -1, aimHot: false,
    gait: 0, bob: 0,                 // where you are in the stride, and how much of it shows
  };

  let active = false;
  let stranded = false;              // walked in under a canopy, not out of a door
  let armed = false;                 // has the spot fire been called
  let seeded = false;                // have the first flames appeared
  let armTimer = 0;
  const tally = { saved: 0, lost: 0, rescued: 0, down: 0, litres: 0 };

  // ── where you may stand ────────────────────────────────────────────────────
  /**
   * Push a point out of the buildings and back inside the wire. Runway-local
   * throughout, because every structure on this field was laid out in those axes
   * and converting each one to a world-space box would be inventing a second
   * source of truth for the same rectangle.
   */
  /** Is this locale point inside any structure? */
  function inside(t, s) {
    for (const b of field.blockers) {
      const c = b.rot ? Math.cos(b.rot) : 1, sn = b.rot ? Math.sin(b.rot) : 0;
      const dt0 = t - b.t, ds0 = s - b.s;
      const dt = dt0 * c + ds0 * sn, ds = -dt0 * sn + ds0 * c;
      if (Math.abs(dt) < b.a + GROUND.girth && Math.abs(ds) < b.c + GROUND.girth) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clamp a world point into the locale and out of its structures.
   *
   * Returns `[x, z, hit]`, and the third element is not a convenience — it is
   * the only honest answer to "did this move me?". The obvious test is to
   * compare what came back against what went in, and that is what walk() used
   * to do; it works on an aerodrome, whose local/toWorld pair is one rigid
   * rotation and exact to a part in 10^12, and it is quietly catastrophic at
   * Jadrija, whose frame is a *traced shoreline*: `local()` projects on to a
   * polyline and `toWorld()` walks back along it, and the round trip lands
   * 15 mm away. Every frame. So every frame the comparison said "you hit
   * something", velocity was reset to zero, and the fastest anybody could
   * cross the promenade was one frame's worth of acceleration — 1.4 m/s, on a
   * key that promises 6, with no wall anywhere near them.
   */
  function confine(x, z) {
    const B = field.bounds;
    let [t, s] = field.local(x, z);
    let hit = false;
    const tc = clamp(t, B.t0, B.t1), sc = clamp(s, B.s0, B.s1);
    if (tc !== t || sc !== s) hit = true;
    t = tc; s = sc;
    // Several passes, because being pushed out of one blocker can push you into
    // the next. On an aerodrome that never happened — ten structures, none of
    // them within a wingspan of another — but a village is a hundred and seventy
    // houses four metres apart, and one pass leaves you standing in a front room.
    // It stops early the moment a pass touches nothing, which is the usual case:
    // somebody walking into a wall overlaps exactly one box.
    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      for (const b of field.blockers) {
        // A blocker may carry its own rotation within the locale frame. The
        // aerodrome never needs one — everything on it was laid out in runway
        // axes — but a village was laid out to its lanes, and a house at 40° to
        // the shore reduced to an axis-aligned box grows by half its width in
        // each direction, which is enough to seal the alley beside it. Rotate
        // in, clamp, rotate the correction back out.
        const c = b.rot ? Math.cos(b.rot) : 1, sn = b.rot ? Math.sin(b.rot) : 0;
        const dt0 = t - b.t, ds0 = s - b.s;
        const dt = dt0 * c + ds0 * sn, ds = -dt0 * sn + ds0 * c;
        const ea = b.a + GROUND.girth, ec = b.c + GROUND.girth;
        if (Math.abs(dt) >= ea || Math.abs(ds) >= ec) continue;
        // Inside: leave by whichever face is nearest, which is what a wall does.
        let ot = dt, os = ds;
        if (ea - Math.abs(dt) < ec - Math.abs(ds)) ot = Math.sign(dt || 1) * ea;
        else os = Math.sign(ds || 1) * ec;
        t = b.t + ot * c - os * sn;
        s = b.s + ot * sn + os * c;
        moved = true;
      }
      if (!moved) break;
      hit = true;
      t = clamp(t, B.t0, B.t1);
      s = clamp(s, B.s0, B.s1);
    }
    // Last resort. Two boxes can be arranged so that leaving one by its nearest
    // face always enters the other, and no number of passes gets you out — it is
    // rare, it needs a parachute to land you inside a wall to reach it at all,
    // and being stuck inside a house with no way out is the one failure here
    // that is not survivable. So: if anything still contains you, walk out
    // across the locale until nothing does. In a village laid out along a shore
    // that direction is the street, and past the street the beach, which is
    // empty by construction — so this always terminates somewhere you can stand.
    if (inside(t, s)) {
      hit = true;
      const dir = s > (B.s0 + B.s1) * 0.5 ? -1 : 1;
      for (let k = 0; k < 80 && inside(t, s); k++) s = clamp(s + dir, B.s0, B.s1);
    }
    const w = field.toWorld(t, s);
    return [w[0], w[2], hit];
  }

  /**
   * Somebody prone is not an obstacle. A body on the ground is 0.35 m at the
   * shoulder — that is knee height, you step over it — and making it solid would
   * be wrong twice over: it would hold you off the one person you have to stand
   * over to put out, and a body that went down against a hangar would become a
   * wedge you could be pinned behind. Anybody on their feet, or on one knee
   * getting their breath, is a metre of person and you go round.
   */
  const upright = (c) => c.mode !== 'down' && c.mode !== 'lost';

  /**
   * Push a point out of everybody who is upright. World space and recomputed
   * every frame, because these are not buildings: a person walks, so they cannot
   * live in `field.blockers`, which is a static list of axis-aligned boxes in the
   * runway's own axes. A person is a circle rather than a box, so it is the
   * radius that ejects you and not the nearest face — but it is the same idea and
   * the same one pass that confine() makes over the buildings.
   */
  function unbody(x, z) {
    const r = GROUND.body * 2;
    for (const c of crew) {
      if (!upright(c)) continue;
      const dx = x - c.x, dz = z - c.z;
      const d = Math.hypot(dx, dz);
      if (d >= r) continue;
      // Dead centre does happen — somebody alight runs at you and gets there —
      // so leave the way you came in rather than dividing by zero.
      const ux = d > 1e-3 ? dx / d : Math.sin(you.yaw);
      const uz = d > 1e-3 ? dz / d : Math.cos(you.yaw);
      x = c.x + ux * r; z = c.z + uz * r;
    }
    return [x, z];
  }

  // ── the spot fire ──────────────────────────────────────────────────────────
  /**
   * Embers land. Two or three cells of grass just upwind of the apron go up, and
   * one object catches directly — which is what actually happens, because an
   * ember does not care that it landed on a drum rather than on scrub.
   */
  function seedSpotFire() {
    seeded = true;
    const [ax, , az] = field.apron;
    // Upwind of the apron: the wind blows *toward* windDir, so back along it.
    const wx = Math.cos(state.windDir), wz = Math.sin(state.windDir);
    for (let i = 0; i < 3; i++) {
      const d = 70 + i * 55;
      fire.igniteNear(ax - wx * d + (rng() - 0.5) * 90, az - wz * d + (rng() - 0.5) * 90, 0.75);
    }
    // Two objects, of two different kinds and at opposite ends. Seeding the two
    // farthest picked two drums out of the same row, which meant the fuel farm
    // was always the fire and the rest of the apron was never in it.
    const far = objects.slice().sort((a, b) =>
      Math.hypot(b.x - ax, b.z - az) - Math.hypot(a.x - ax, a.z - az));
    const first = far[0];
    const second = far.find((o) => o.kind !== first.kind
      && Math.hypot(o.x - first.x, o.z - first.z) > 40) || far[1];
    first.heat = 1.05;
    second.heat = 1.05;
    // And two of the crew, who were closest to it.
    const near = crew.slice().sort((a, b) =>
      Math.hypot(a.x - ax + wx * 90, a.z - az + wz * 90)
      - Math.hypot(b.x - ax + wx * 90, b.z - az + wz * 90));
    for (const c of near.slice(0, 2)) if (c.mode === 'walk' || c.mode === 'idle') light(c);
    radio('call.rokici', 'radio.rokiciBurning');
  }

  function light(c) {
    if (c.mode === 'alight' || c.mode === 'down' || c.mode === 'lost') return;
    c.mode = 'alight';
    c.burn = 0;
    c.wet = 0;
    if (!c.shouted) { c.shouted = true; radio('call.rokici', 'radio.crewAlight'); }
  }

  /** The front is close enough to be throwing burning material this far. */
  function frontDistance() {
    const [ax, , az] = field.apron;
    const nf = fire.nearestFire(ax, az);
    return nf ? Math.hypot(nf[0] - ax, nf[1] - az) : Infinity;
  }

  // ── objects ────────────────────────────────────────────────────────────────
  function updateObjects(dt) {
    for (const o of objects) {
      const wasBurning = o.burning > 0;
      let dirty = false;

      if (!o.out && o.spent < 1) {
        // Heat arrives from the ground fire under it and from anything already
        // alight within a few metres. The rates are deliberately slow. Radiant
        // ignition is a minute-scale process, not a second-scale one: the first
        // pass used numbers an order of magnitude too big and the entire apron —
        // thirty objects and every one of the crew — went up in six seconds,
        // which is not a mission, it is a cutscene.
        let h = fire.intensityAt(o.x, o.z) * 0.10;
        for (const n of objects) {
          if (n === o || n.burning <= 0) continue;
          const d = Math.hypot(n.x - o.x, n.z - o.z);
          if (d < 6) h += n.burning * (1 - d / 6) * 0.030;
        }
        // The subtraction is the thing that cools: something warmed once and
        // then left alone has to come back down, or the whole apron eventually
        // ignites from a fire that went out ten minutes ago.
        o.heat = clamp(o.heat + (h - 0.012) * dt, 0, 1.5);
        if (o.heat > 1 && o.burning <= 0) o.burning = 0.35;
      }

      if (o.burning > 0) {
        o.burning = Math.min(1, o.burning + dt * 0.5 * o.fuel);
        const before = o.spent;
        o.spent = Math.min(1, o.spent + dt / o.life);
        if (Math.abs(o.spent - before) > 0.01) dirty = true;
        // Water is losing while it is on, so the jet has to out-pace the flame —
        // but only just. This has to stay well under flow/soak for every kind in
        // BURNABLE, or that kind cannot be extinguished at all.
        o.wet = Math.max(0, o.wet - dt * 0.030);
        if (o.wet >= 1) {
          o.burning = 0; o.heat = 0; o.out = true; dirty = true;
          if (o.spent < 1) tally.saved++;
        }
        if (o.spent >= 1) { o.burning = 0; o.out = true; tally.lost++; dirty = true; }
      } else {
        o.wet = Math.max(0, o.wet - dt * 0.10);
      }

      if (dirty || (wasBurning !== o.burning > 0)) field.tint(o);
    }
    field.flushTint();
  }

  // ── crew ───────────────────────────────────────────────────────────────────
  /** Everybody's own spot in the muster, or seven people stand inside each other. */
  const musterFor = (c) => [MUSTER[0] + c.spot[0], MUSTER[2] + c.spot[1]];

  /** The nearest thing actually alight: an object if one is close, the ground
   *  fire otherwise. What somebody standing about is looking at, and what they
   *  back away from. */
  function nearestBurn(x, z) {
    let best = null, bd = 900;
    for (const o of objects) {
      if (o.burning <= 0) continue;
      const d = (o.x - x) ** 2 + (o.z - z) ** 2;
      if (d < bd) { bd = d; best = [o.x, o.z]; }
    }
    return best || fire.nearestFire(x, z);
  }

  /** How bad it is to be standing exactly here. */
  function threatAt(x, z) {
    let t = fire.intensityAt(x, z) * 3;
    for (const o of objects) {
      if (o.burning <= 0) continue;
      const d = Math.hypot(o.x - x, o.z - z);
      if (d < 15) t += o.burning * (1 - d / 15);
    }
    return t;
  }

  /** Move `c` out of a circle of radius `r` about (ox, oz), taking `k` of the
   *  overlap, and keep them out of the walls while doing it. */
  function shove(c, ox, oz, r, k) {
    const dx = c.x - ox, dz = c.z - oz;
    const d = Math.hypot(dx, dz);
    if (d >= r) return;
    // Two of them handed the same start would divide by zero, so break the tie
    // off the seed: stable across reloads, and different for each of them.
    const a = d > 1e-3 ? Math.atan2(dz, dx) : c.seed * TAU;
    const push = (r - d) * k;
    const [nx, nz] = confine(c.x + Math.cos(a) * push, c.z + Math.sin(a) * push);
    c.x = nx; c.z = nz;
  }

  /**
   * Nobody stands inside anybody else. The muster gives each of them their own
   * offset to walk to, which spreads the destinations but does nothing about the
   * walk there, and two figures interpenetrating is the fastest way for a crowd
   * to stop reading as people.
   *
   * This is also the *only* thing that resolves a person against the player, and
   * that asymmetry is the point. Being solid has to be able to block: cornering
   * somebody whose kit is alight and standing in their way is a real rescue and
   * it should work. But it must never shove the player into a wall or hold them
   * there, and the cheapest guarantee of that is that the player's position is
   * only ever changed by the player's own input. So you stop them; they do not
   * move you.
   *
   * One pass over each other. Pushing A off B can leave A touching C, and at
   * 0.6 m and thirty frames a second the next pass has it long before anybody
   * could see it. The player is a second pass and comes last, because a pair
   * settling between themselves can put one of them back inside you and there is
   * nothing after this to take it out again.
   */
  function jostle() {
    const r = GROUND.body * 2;
    for (let i = 0; i < crew.length; i++) {
      const a = crew[i];
      if (!upright(a)) continue;
      for (let k = i + 1; k < crew.length; k++) {
        const b = crew[k];
        if (!upright(b)) continue;
        // Half the overlap each, both measured from where the other one was, or
        // whichever of them is earlier in the array gets to keep its ground.
        const ax = a.x, az = a.z;
        shove(a, b.x, b.z, r, 0.5);
        shove(b, ax, az, r, 0.5);
      }
    }
    if (active) for (const c of crew) if (upright(c)) shove(c, you.x, you.z, r, 1);
  }

  function updateCrew(dt) {
    for (const c of crew) {
      c.speed = 0;
      if (c.mode === 'lost') continue;

      // Catching. You have to be genuinely in it — standing in a burning cell,
      // or within about three metres of something alight. Anything looser and
      // the whole crew catches at once simply because the apron is small.
      if (c.mode === 'idle' || c.mode === 'walk') {
        let risk = fire.intensityAt(c.x, c.z) * 0.30;
        for (const o of objects) {
          if (o.burning <= 0) continue;
          const d = Math.hypot(o.x - c.x, o.z - c.z);
          if (d < 3.2) risk += o.burning * (1 - d / 3.2) * 0.22;
        }
        if (risk > 0.02 && rng() < risk * dt) light(c);
      }

      let speed = 0;
      if (c.mode === 'alight') {
        c.burn += dt / GROUND.crewBurn;
        c.wet = Math.max(0, c.wet - dt * GROUND.crewDry);
        // Tied to how far through burning they are rather than to wall time, so
        // somebody you reach quickly is singed and somebody who nearly went
        // down is black — and neither ends up so dark you cannot see the kit.
        c.char = Math.max(c.char, Math.min(0.5, c.burn * 0.62));
        // Running. It is the wrong thing to do and it is what happens: fanned
        // flames burn harder, so the panic makes it worse, which is the whole
        // reason somebody has to physically stop them.
        // Slower than a sprint and constantly turning. Somebody whose clothes
        // are alight is not running *to* anywhere, and if they simply outpaced
        // you in a straight line there would be no rescue to make.
        //
        // Water slows them, and that is deliberate on both counts: soaked kit
        // really is heavy, and the first litres you land have to *visibly* buy
        // you something or there is no reason to believe the rest are working.
        speed = (3.3 + Math.sin(c.gait * 0.7 + c.seed * 6) * 1.1) * (1 - c.wet * 0.5);
        const nf = fire.nearestFire(c.x, c.z);
        let ax = -Math.sin(c.seed * 12 + state.t * 1.5);
        let az = -Math.cos(c.seed * 12 + state.t * 1.5);
        if (nf) {
          const dx2 = c.x - nf[0], dz2 = c.z - nf[1];
          const d = Math.hypot(dx2, dz2) || 1;
          ax = ax * 0.45 + (dx2 / d) * 0.55;
          az = az * 0.45 + (dz2 / d) * 0.55;
        }
        const m = Math.hypot(ax, az) || 1;
        c.hx = ax / m; c.hz = az / m;
        if (c.burn >= 1) { c.mode = 'down'; c.timer = 0; c.roll = 0; tally.down++; }
      } else if (c.mode === 'down') {
        c.timer += dt;
        // Rolling — irregularly, and it slows as they weaken.
        c.roll += dt * (2.6 + Math.sin(c.timer * 2.1 + c.seed * 5) * 1.5)
          * clamp(1.4 - c.timer / GROUND.crewDown, 0.15, 1);
        if (c.timer > GROUND.crewDown) {
          c.mode = 'lost';
          tally.lost++;
          radio('call.rokici', 'radio.crewLost');
        }
      } else if (c.mode === 'safe') {
        c.timer += dt;
        c.wet = Math.max(0, c.wet - dt * 0.045);
        if (c.timer > 4.5) { c.mode = 'thanks'; c.timer = 0; }
      } else if (c.mode === 'thanks') {
        // On their feet, turned to whoever put them out, one arm up.
        //
        // Being alive again is the entire payoff of the mode and it was being
        // thrown away: they knelt motionless for nine seconds, which from four
        // metres away reads as a body and not as somebody getting their breath
        // back. You want to see that it worked.
        c.timer += dt;
        c.wet = Math.max(0, c.wet - dt * 0.03);
        const dx2 = you.x - c.x, dz2 = you.z - c.z;
        const d = Math.hypot(dx2, dz2) || 1;
        c.hx = dx2 / d; c.hz = dz2 / d;
        c.look = 0;
        if (c.timer > 3.0) {
          c.mode = 'walk';
          c.dest = musterFor(c);
          c.pace = 2.7;              // and off at a jog, not a stroll
          c.wait = 14;
        }
      } else {
        // Not alight, so: get clear, stay clear, and keep having somewhere to
        // be. This used to walk them to a single muster point and then drop
        // them into an `idle` with no behaviour and no animation attached to
        // it, so seven people arrived, stopped dead mid-stride, and stood like
        // that for the rest of the mission. Standing about is a behaviour and
        // it has to be written down like any other.
        const [mx, mz] = musterFor(c);
        const threat = threatAt(c.x, c.z);
        c.wait -= dt;
        // Kit dries. Somebody you soaked half an hour ago should not still be
        // walking around black — the scorching stays, the water does not.
        c.wet = Math.max(0, c.wet - dt * 0.022);
        // Re-plan when the clock says so — *not* when `dest` is null, which is
        // what standing still looks like and which therefore cancelled every
        // rest the instant it began: they arrived, cleared the destination,
        // and re-picked one on the very next frame. Threat is the one thing
        // that interrupts a rest, and only if they are not already running.
        if (c.wait <= 0 || (threat > 0.25 && c.pace < 2.5)) {
          if (threat > 0.25) {
            // Something has caught close enough to move away from. Away from
            // *it*, not toward the muster — the muster might be what is alight.
            const b = nearestBurn(c.x, c.z);
            const ax = b ? c.x - b[0] : mx - c.x;
            const az = b ? c.z - b[1] : mz - c.z;
            const d = Math.hypot(ax, az) || 1;
            c.dest = [c.x + (ax / d) * 28, c.z + (az / d) * 28];
            c.pace = 3.0;
            c.wait = 2.5;
          } else if (Math.hypot(mx - c.x, mz - c.z) > 7) {
            c.dest = [mx, mz];
            c.pace = 1.7;
            c.wait = 5;
          } else {
            // At the muster with nothing near. Mill about: a few paces
            // somewhere, then stand for a while. Nobody stands still for
            // twenty minutes, and a figure that does reads as broken.
            c.dest = rng() < 0.55
              ? [mx + (rng() - 0.5) * 9, mz + (rng() - 0.5) * 9] : null;
            c.pace = 1.05 + rng() * 0.5;
            c.wait = 2.5 + rng() * 6;
          }
        }
        if (c.dest) {
          const dx2 = c.dest[0] - c.x, dz2 = c.dest[1] - c.z;
          const d = Math.hypot(dx2, dz2);
          // Assignment, not `Math.min` with what is left: arriving late — which
          // is most arrivals, since the walk to the muster is a minute and the
          // budget is five seconds — left `wait` deeply negative, so they
          // re-picked a destination on the very next frame and never once stood
          // still. Getting somewhere buys you a rest regardless of how long it
          // took to get there.
          if (d < 1.1) { c.dest = null; c.mode = 'idle'; c.wait = 2.5 + rng() * 6; }
          else { c.hx = dx2 / d; c.hz = dz2 / d; speed = c.pace; c.mode = 'walk'; }
        } else {
          c.mode = 'idle';
        }

        // What they are looking at. Somebody who has just been driven off an
        // apron by a fire watches the fire; a head that tracks it is most of
        // the difference between standing and being switched off.
        c.lookT -= dt;
        if (c.lookT <= 0) {
          const t = nearestBurn(c.x, c.z);
          const face = Math.atan2(-c.hz, c.hx);
          c.look = t
            ? clamp(angleDelta(face, Math.atan2(-(t[1] - c.z), t[0] - c.x)), -1.15, 1.15)
            : (rng() - 0.5) * 0.9;
          c.lookT = 0.7 + rng() * 1.8;
        }
      }

      if (speed > 0) {
        const nx = c.x + c.hx * speed * dt;
        const nz = c.z + c.hz * speed * dt;
        const [px2, pz2] = confine(nx, nz);
        // A wall turns them rather than stopping them dead — a person who has
        // run into something keeps going along it.
        if (Math.hypot(px2 - nx, pz2 - nz) > 0.05) {
          const a = Math.atan2(c.hz, c.hx) + 1.1;
          c.hx = Math.cos(a); c.hz = Math.sin(a);
          c.dest = null;
        }
        c.x = px2; c.z = pz2;
        c.gait += speed * dt * 2.9;
      }
      c.speed = speed;
    }
    // Everybody has moved; now nobody is standing in anybody. Posing is a
    // separate pass because it reads the final position — pose in the same loop
    // and whoever is jostled afterwards is drawn a frame behind where they are.
    jostle();
    for (const c of crew) {
      c.y = field.walkY(c.x, c.z);
      poseFigure(c);
    }
  }

  // ── posing ─────────────────────────────────────────────────────────────────
  // Every joint is written every frame, from rest. Touching only what changes
  // means a pose left over from `alight` bleeds into `safe` two seconds later,
  // and eleven assignments are cheaper than reasoning about which of them are
  // stale.
  //
  // `SPLAY`, `restPose` and `stride` used to live here, and now live in
  // src/42-crowd.js, because the Jadrija bathers are the same eleven joints
  // under the same names and there is no version of "two gaits, maintained
  // separately" that ends well. The poses below are still this file's: they are
  // about kit and fire and nobody on a beach needs them.

  function poseDown(c, f) {
    // Stop, drop and roll — the correct thing, and the thing almost nobody
    // manages. The rolling is the point twice over: it is what actually puts
    // clothing out, and it is what makes a figure on the ground read as a
    // person in trouble rather than as a prop that has fallen over.
    const alive = c.mode === 'down';
    const r = alive ? Math.sin(c.roll) * 1.15 : 0.28;
    const t = alive ? Math.sin(c.roll * 1.7) : 0;
    f.root.rotation.set(r, Math.atan2(-c.hz, c.hx), -Math.PI / 2 + 0.06);
    f.root.position.y = c.y + 0.22;
    f.armLU.rotation.set(0.55 + t * 0.40, 0, -1.35 - t * 0.45);
    f.armRU.rotation.set(-0.55 - t * 0.40, 0, -1.35 + t * 0.45);
    f.armLL.rotation.z = 1.05 + t * 0.3;
    f.armRL.rotation.z = 1.05 - t * 0.3;
    f.legLU.rotation.z = 0.45 + t * 0.35;
    f.legRU.rotation.z = 0.08 - t * 0.35;
    f.legLL.rotation.z = -0.90;
    f.legRL.rotation.z = -0.42;
    f.torso.rotation.z = 0.14;
    f.head.rotation.z = 0.24;
  }

  function poseSafe(c, f) {
    // Down on one knee getting their breath, which is what somebody does about
    // four seconds after you have put them out. They are fine; they are not
    // fine yet.
    const b = 0.5 + 0.5 * Math.sin(c.timer * 2.7);
    // One knee down, the other foot flat in front, forearms on the raised knee.
    // The two legs have to disagree — a symmetrical crouch reads as a sprinter
    // on the blocks, which is the opposite of what has just happened to them.
    f.pelvis.position.y = f.restY - 0.44;
    f.pelvis.rotation.z = -0.16;
    // Front leg: thigh horizontal, shin vertical, foot flat on the ground.
    // Kneeling leg: thigh vertical so the knee lands *on* the ground under the
    // hip, shin folded back behind it. Angling the kneeling thigh back instead
    // hangs the knee thirty centimetres up and turns the whole thing into a
    // lunge.
    f.legLU.rotation.z = 1.45; f.legLL.rotation.z = -1.45;
    f.legRU.rotation.z = -0.14; f.legRL.rotation.z = -1.44;
    f.torso.rotation.z = -0.40 - b * 0.09;
    f.head.rotation.z = 0.36 + b * 0.12;
    f.armLU.rotation.set(0.20, 0, 0.92); f.armLL.rotation.z = 0.62;
    f.armRU.rotation.set(-0.20, 0, 0.86); f.armRL.rotation.z = 0.70;
  }

  function poseThanks(c, f) {
    // Standing up out of the kneel over the first beat, then an arm raised to
    // whoever put them out. Not a salute — an acknowledgement, which is the
    // thing people actually do, and the only moment in the mode where anybody
    // looks at you.
    const t = c.timer;
    const rise = clamp(t / 0.7, 0, 1);
    const up = rise * rise;
    const back = 1 - rise;
    const wave = Math.sin(t * 7.5);
    const breath = 0.5 + 0.5 * Math.sin(t * 3.4);

    f.pelvis.position.y = f.restY - back * 0.42;
    f.legLU.rotation.z = back * 1.45 + 0.05;
    f.legLL.rotation.z = -back * 1.42 - 0.09;
    f.legRU.rotation.z = -back * 0.14 - 0.05;
    f.legRL.rotation.z = -back * 1.42 - 0.07;
    f.torso.rotation.set(breath * 0.05, 0, -0.40 * back - 0.02);

    f.armRU.rotation.set(-SPLAY - 0.26 * up, 0, (2.45 + wave * 0.20) * up);
    f.armRL.rotation.z = 0.30 + (0.35 + wave * 0.30) * up;
    f.armLU.rotation.set(SPLAY + 0.30 * up, 0, 0.34 * up);
    f.armLL.rotation.z = 0.24 + 0.80 * up;
    f.head.rotation.set(0, 0, 0.12 - 0.24 * up);
  }

  function poseAlight(c, f) {
    // Running with your clothing alight is not a run cycle. The arms come up
    // and stay up, the stride is short and uneven, the head goes back, and none
    // of it is any help — which is precisely why somebody else has to stop you.
    const g = c.gait;
    const a = Math.sin(g * 2.3 + c.seed * 9);
    const b = Math.cos(g * 1.7 + c.seed * 4);
    stride(f, g, clamp(c.speed * 0.19, 0.30, 0.85), 0);
    f.armLU.rotation.set(0.80 + a * 0.45, 0, 2.05 + b * 0.42);
    f.armRU.rotation.set(-0.80 - b * 0.45, 0, 2.05 - a * 0.42);
    f.armLL.rotation.z = 1.15 + a * 0.35;
    f.armRL.rotation.z = 1.15 - b * 0.35;
    f.torso.rotation.set(b * 0.24, a * 0.18, -0.18 + a * 0.12);
    f.head.rotation.set(-a * 0.22, b * 0.30, -0.32);
    f.pelvis.position.y = f.restY - 0.03 + Math.abs(Math.sin(g)) * 0.05;
  }

  function poseAfoot(c, f) {
    if (c.speed > 0.05) {
      const amp = clamp(c.speed * 0.21, 0.16, 0.95);
      stride(f, c.gait, amp, 0.85);
      f.torso.rotation.z = -0.05 - amp * 0.17;
      f.torso.rotation.y = -Math.sin(c.gait) * 0.13;
      f.pelvis.rotation.y = Math.sin(c.gait) * 0.11;
      // Down twice a cycle, at each footfall.
      f.pelvis.position.y = f.restY
        - amp * 0.06 * (0.5 - 0.5 * Math.cos(c.gait * 2));
    } else {
      // Standing about — off wall-clock rather than off the gait, because the
      // gait stops when they do and a frozen sway is exactly the thing being
      // fixed. Weight shifts, breathing, a bit of drift.
      const t = state.t + c.seed * 11;
      const a = Math.sin(t * 0.62);
      const b = Math.sin(t * 0.31 + 1.7);
      f.torso.rotation.set(b * 0.05, a * 0.07, -0.03 + a * 0.022);
      f.pelvis.rotation.set(-b * 0.03, -a * 0.05, 0);
      f.pelvis.position.y = f.restY - 0.008 + a * 0.009;
      f.armLU.rotation.set(SPLAY + b * 0.06, 0, a * 0.055);
      f.armRU.rotation.set(-SPLAY - b * 0.06, 0, -a * 0.055);
      f.armLL.rotation.z = 0.22 + a * 0.05;
      f.armRL.rotation.z = 0.22 - a * 0.05;
      f.legLU.rotation.z = 0.03 + b * 0.03;
      f.legRU.rotation.z = -0.03 - b * 0.03;
    }
    // The head is not part of the gait. It holds still while the body moves
    // under it, and it turns to look at things — which together are most of
    // what separates a person from a mannequin on rails.
    f.head.rotation.y = clamp(c.look, -1.2, 1.2);
    f.head.rotation.z = -f.torso.rotation.z * 0.55;
  }

  function poseFigure(c) {
    const f = c.fig;
    f.root.visible = armed;
    if (!armed) return;
    f.root.position.set(c.x, c.y, c.z);
    f.root.rotation.set(0, Math.atan2(-c.hz, c.hx), 0);
    restPose(f);

    const u = f.mat.uniforms;
    u.uWet.value = clamp(c.wet, 0, 1);
    u.uChar.value = clamp(c.char, 0, 1);
    u.uEmissive.value = c.mode === 'alight' ? 0.34 * (1 - c.wet * 0.75)
      : (c.mode === 'down' && c.burn > 0 ? 0.16 : 0);

    if (c.mode === 'down' || c.mode === 'lost') poseDown(c, f);
    else if (c.mode === 'safe') poseSafe(c, f);
    else if (c.mode === 'thanks') poseThanks(c, f);
    else if (c.mode === 'alight') poseAlight(c, f);
    else poseAfoot(c, f);
  }

  // ── the jet ────────────────────────────────────────────────────────────────
  /** Nozzle position and direction, in the flight model's yaw convention. */
  function nozzle() {
    const cp = Math.cos(you.pitch);
    const dir = [-Math.sin(you.yaw) * cp, Math.sin(you.pitch), -Math.cos(you.yaw) * cp];
    const right = [Math.cos(you.yaw), 0, -Math.sin(you.yaw)];
    return {
      dir,
      p: [
        you.x + dir[0] * 0.55 + right[0] * 0.22,
        you.y + GROUND.eye - 0.22 + dir[1] * 0.55,
        you.z + dir[2] * 0.55 + right[2] * 0.22,
      ],
    };
  }

  /**
   * Walk the jet out under gravity and return what it lands on. A hose is not a
   * ray: the whole skill in using one is knowing how much it droops, and a
   * straight raycast would remove the only aiming problem the mode has.
   */
  /**
   * Where along a step does it pass within `r` of a vertical axis at (cx, cz)?
   *
   * This has to be a *swept* test, not a point test at the end of the step. The
   * jet advances 23 m/s × 45 ms ≈ one metre per step and a fuel drum is 0.6 m
   * across: sampling only the step endpoints walks straight through it, which is
   * exactly what happened — four hundred litres poured over a burning drum with
   * the trace reporting a clean miss every frame and nothing ever going out.
   */
  function sweep(x0, z0, x1, z1, cx, cz, r) {
    const dx = x1 - x0, dz = z1 - z0;
    const L2 = dx * dx + dz * dz;
    const t = L2 > 1e-9 ? clamp(((cx - x0) * dx + (cz - z0) * dz) / L2, 0, 1) : 0;
    const px = x0 + dx * t, pz = z0 + dz * t;
    return Math.hypot(px - cx, pz - cz) < r ? t : -1;
  }

  // ── guests ─────────────────────────────────────────────────────────────────
  /**
   * Somebody the jet can land on who is not on the strength.
   *
   * The crew are modelled in this file because putting them out is what the
   * mode is *for*. The girl on the promenade at Jadrija is not: she belongs to
   * 43-jadrija.js, which knows nothing about hoses, and the ground mode knows
   * nothing about her. Something had to give, and the alternative to a hook
   * here was that file re-walking this same parabola every frame to find out
   * whether it had been pointed at her — the trace duplicated, and duplicated
   * against a moving target, which is the version that goes quietly out of
   * step and stays that way.
   *
   * A probe rather than a position: she moves, and a registration that has to
   * be kept up to date is a registration that is one frame stale by design.
   */
  const guests = [];
  /**
   * @param probe  () => {x, y, z, r, h} | null — where she is now, or nothing
   *               if she is not in the world / not near enough to care about
   * @param onWet  (litres, hit) => void
   */
  function addGuest(probe, onWet) { guests.push({ probe, onWet }); }

  function traceJet() {
    const { p, dir } = nozzle();
    let x = p[0], y = p[1], z = p[2];
    let vx = dir[0] * GROUND.jetV, vy = dir[1] * GROUND.jetV, vz = dir[2] * GROUND.jetV;
    const dt = GROUND.jetDt;
    // Snapshotted once, not per step: a probe is a live read and there are
    // thirty-odd steps in a trace.
    const gs = [];
    for (const g of guests) {
      const q = g.probe();
      if (q) gs.push([g, q]);
    }
    for (let i = 0; i < GROUND.jetSteps; i++) {
      const x0 = x, y0 = y, z0 = z;
      vy -= 9.81 * dt;
      x += vx * dt; y += vy * dt; z += vz * dt;

      // Nearest hit *along the step*, so a jet grazing two things soaks the
      // near one rather than whichever happened to be first in the array.
      // A branch throws a stream at the nozzle and a fan at twenty metres, so
      // the catch radius grows down the trace. A hairline ray that had to
      // intersect a running person exactly was the difference between water
      // that worked and water that "didn't seem to do much".
      const fan = 0.62 + i * 0.031;

      let bt = 2, hit = null;
      for (const c of crew) {
        if (c.mode === 'lost') continue;
        const t = sweep(x0, z0, x, z, c.x, c.z, fan);
        if (t < 0 || t >= bt) continue;
        const yy = y0 + (y - y0) * t;
        const h = c.mode === 'down' || c.mode === 'safe' ? 1.0 : 1.9;
        if (yy > c.y + h || yy < c.y - 0.25) continue;
        bt = t; hit = { crew: c };
      }
      for (const o of objects) {
        const t = sweep(x0, z0, x, z, o.x, o.z, o.w * 0.55 + fan * 0.55);
        if (t < 0 || t >= bt) continue;
        const yy = y0 + (y - y0) * t;
        if (yy > o.y + o.h + 0.4 || yy < o.y - 0.3) continue;
        bt = t; hit = { obj: o };
      }
      for (const [g, q] of gs) {
        const t = sweep(x0, z0, x, z, q.x, q.z, q.r + fan);
        if (t < 0 || t >= bt) continue;
        const yy = y0 + (y - y0) * t;
        if (yy > q.y + q.h || yy < q.y - 0.25) continue;
        bt = t; hit = { guest: g };
      }
      if (hit) {
        return { x: x0 + (x - x0) * bt, y: y0 + (y - y0) * bt, z: z0 + (z - z0) * bt, ...hit };
      }

      const gy = field.walkY(x, z);
      if (y <= gy) return { x, y: gy, z };
    }
    return { x, y, z, far: true };
  }

  function spray(dt, hit) {
    const litres = Math.min(you.pack, GROUND.flow * dt);
    you.pack -= litres;
    tally.litres += litres;
    if (litres <= 0) return;

    if (hit.crew) {
      const c = hit.crew;
      c.wet += litres / GROUND.crewSoak;
      if (c.wet >= 1 && (c.mode === 'alight' || c.mode === 'down')) {
        c.mode = 'safe'; c.timer = 0; c.burn = 0;
        tally.rescued++;
        radio('call.rokici', 'radio.crewSafe');
        toast(T('toast.crewSafe'), 'good');
      }
    } else if (hit.obj) {
      hit.obj.wet += litres / hit.obj.soak;
      hit.obj.heat = Math.max(0, hit.obj.heat - litres / hit.obj.soak * 0.8);
    } else if (hit.guest) {
      hit.guest.onWet(litres, hit);
    }
    // Whatever the jet hit, the water still lands on the ground under it.
    fire.hose(hit.x, hit.z,
      litres * (hit.crew || hit.obj || hit.guest ? 0.35 : 1));

    // Steam, off anything hot enough to make it. This is the fastest feedback
    // in the mode — it appears on the first frame the jet lands, well before a
    // flame has visibly shrunk — and it is the thing that answers the only
    // question the player is actually asking: am I hitting them or not?
    const hot = hit.crew ? (hit.crew.mode === 'alight' || hit.crew.burn > 0)
      : hit.obj ? hit.obj.burning > 0 : fire.intensityAt(hit.x, hit.z) > 0.05;
    if (hot) {
      const n = Math.max(1, Math.round(24 * dt));
      for (let i = 0; i < n; i++) {
        steam.spawn(
          hit.x + (rng() - 0.5) * 0.55, hit.y + 0.20 + rng() * 0.45,
          hit.z + (rng() - 0.5) * 0.55,
          (rng() - 0.5) * 1.5, 1.1 + rng() * 1.7, (rng() - 0.5) * 1.5,
          0.32 + rng() * 0.30, 0.85 + rng() * 0.6, 2.7);
      }
    }

    // Droplets: a cone off the nozzle, thrown along the same vector the trace
    // used, so what you see is what the trace computed and not a second opinion.
    const { p, dir } = nozzle();
    const n = Math.max(1, Math.round(60 * dt));
    for (let i = 0; i < n; i++) {
      const s = rng();
      jetSpray.spawn(
        p[0], p[1], p[2],
        dir[0] * GROUND.jetV + (rng() - 0.5) * 2.6,
        dir[1] * GROUND.jetV + (rng() - 0.5) * 2.0,
        dir[2] * GROUND.jetV + (rng() - 0.5) * 2.6,
        0.22 + s * 0.24, 0.80 + s * 0.45, 0.85,
      );
    }
  }

  // ── flames ─────────────────────────────────────────────────────────────────
  const flameList = [];
  function paintFlames() {
    flameList.length = 0;
    for (const o of objects) {
      if (o.burning <= 0.02) continue;
      // Scaled to the object, not to a fifty-metre cell of maquis. A burning
      // light aircraft throws a flame two or three metres tall; the first pass
      // borrowed the wildfire sizing and gave it ten.
      // Knocked back by however wet it is, so pouring water on something is
      // visible in the flame as well as in the numbers.
      const q = 1 - clamp(o.wet, 0, 1) * 0.7;
      flameList.push({
        x: o.x, y: o.y + o.h * 0.30, z: o.z,
        size: (0.9 + o.h * 0.8) * (0.72 + o.burning * 0.5) * (0.4 + 0.6 * q),
        v: o.burning * q,
      });
    }
    for (const c of crew) {
      if (c.mode !== 'alight' && !(c.mode === 'down' && c.burn > 0)) continue;
      const q = 1 - clamp(c.wet, 0, 1) * 0.72;
      const v = (c.mode === 'down' ? 0.5 : 0.75) * q;
      flameList.push({
        x: c.x, y: c.y + 0.62, z: c.z, size: 1.55 * (0.42 + 0.58 * q), v,
      });
    }
    // And anything the locale wants drawn that is neither an object nor a
    // member of the crew. Jadrija uses it for a fireball still in the air and
    // for the girl who threw it, both of which move every frame and so cannot
    // be `objects` — those are fixed to a spot by everything that reads them.
    if (field.flames) for (const f of field.flames()) flameList.push(f);
    flames.paint(flameList);
  }

  // ── movement ───────────────────────────────────────────────────────────────
  function walk(dt) {
    // The left and right arrows *turn*. They used to strafe, which is the wrong
    // contract for the one control anybody reaches for without a mouse: an arrow
    // labelled left should point you left, not slide you sideways while you
    // carry on staring at whatever you were staring at.
    //
    // `look()` subtracts, because moving the mouse right decreases yaw, so
    // turning right subtracts too.
    const turn = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    if (turn) you.yaw -= turn * GROUND.turn * dt;

    const fx = -Math.sin(you.yaw), fz = -Math.cos(you.yaw);
    // Right is forward rotated a quarter turn clockwise about the vertical:
    // forward (-sin, -cos) -> right (cos, -sin). This was the negative of that,
    // which is the *left* vector — so D strafed left, A strafed right, and every
    // sideways control in the mode was mirrored.
    const rx = Math.cos(you.yaw), rz = -Math.sin(you.yaw);
    let ix = 0, iz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
    if (keys.has('KeyD')) ix += 1;
    if (keys.has('KeyA')) ix -= 1;
    ix += TOUCH.gx || 0; iz += TOUCH.gy || 0;
    const m = Math.hypot(ix, iz);
    if (m > 1) { ix /= m; iz /= m; }

    // Shift, where it has always been and where a hand expects it. It briefly
    // was not: when the escape charge arrived it took Shift and pushed the run
    // onto Q, which was the wrong way round — the charge fires once in a
    // session and the run is held down for four hundred metres of promenade,
    // so the one that should have moved was the rare one. It did, to U.
    //
    // Q still runs. Nobody has to unlearn a key that costs a boolean to keep.
    const top = (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyQ')
      || TOUCH.grun) ? GROUND.run : GROUND.walk;
    const wx = (fx * iz + rx * ix) * top;
    const wz = (fz * iz + rz * ix) * top;
    you.vx = damp(you.vx, wx, m > 0.01 ? GROUND.accel / top : GROUND.drag, dt);
    you.vz = damp(you.vz, wz, m > 0.01 ? GROUND.accel / top : GROUND.drag, dt);

    const tx = you.x + you.vx * dt, tz = you.z + you.vz * dt;
    // People first, walls second, so that the wall has the last word. Somebody
    // standing against a hangar can then hold you against it but never push you
    // through it, and a hold is something you can always walk sideways out of.
    const [bx, bz] = unbody(tx, tz);
    let [nx, nz, hit] = confine(bx, bz);
    // The waterline, where the locale has one. Tried as two independent axes
    // before being refused outright, so walking into the sea at an angle slides
    // you along the beach instead of gluing you to the spot — the shoreline is
    // a ragged thing and a hard stop on it feels like a bug even when it is
    // doing exactly what it was asked to.
    if (field.standable && !field.standable(nx, nz)) {
      if (field.standable(nx, you.z)) nz = you.z;
      else if (field.standable(you.x, nz)) nx = you.x;
      else { nx = you.x; nz = you.z; }
      hit = true;
    }
    // Kill the velocity only if confine() actually clamped something — on its
    // own say-so, never by comparing coordinates (see confine). It is measured
    // against what confine() was *given*, not against where the step wanted to
    // go, or a person would stop you dead as well: the push out of somebody is
    // purely radial, so whatever part of your speed runs along them survives
    // and you slide round rather than grinding to a halt on a shoulder.
    //
    // And only the component *into* the obstruction goes. Zeroing the whole
    // vector makes a wall flypaper — you stop dead and have to back off and
    // re-approach to get past it — whereas taking out the normal component
    // leaves the tangent, which is a shoulder along a hangar wall.
    if (hit) {
      const cx = nx - bx, cz = nz - bz;
      const cl = Math.hypot(cx, cz);
      if (cl > 1e-6) {
        const ux = cx / cl, uz = cz / cl;
        const into = you.vx * ux + you.vz * uz;
        if (into < 0) { you.vx -= ux * into; you.vz -= uz * into; }
      } else { you.vx = 0; you.vz = 0; }
    }
    const moved = Math.hypot(nx - you.x, nz - you.z);
    you.x = nx; you.z = nz;
    you.y = field.walkY(you.x, you.z);
    gait(moved, dt);
  }

  /**
   * That you are walking.
   *
   * Without this the mode is a camera on rails: the view slides through the
   * world at a constant height in total silence, which is the one thing that
   * reads as *not being there* however good the scenery is. It is also the
   * cheapest fix in the game — a phase, two sines and a noise burst.
   *
   * Driven by **distance, not time**. A gait belongs to the ground: walk into a
   * wall and you stop taking steps, because you have stopped covering ground,
   * and a clock-driven bob goes on trudging on the spot. It also means the pace
   * follows the speed for nothing — running is the same stride taken oftener.
   *
   * The phase advances π per footfall, so `sin(gait)` is one cycle per *stride*
   * (the weight going side to side, which happens once per pair of steps) and
   * `sin(2·gait)` is one per *step* (the head dropping as each boot lands).
   * Getting those two the same period is the classic mistake and it produces a
   * hopping motion nobody walks with.
   */
  function gait(moved, dt) {
    if (moved > 1e-4) {
      const before = you.gait;
      you.gait += (moved / GROUND.stride) * Math.PI;
      // A footfall every time the phase crosses a multiple of π. Compared
      // this way rather than by accumulating a counter, so a single enormous dt
      // cannot silently swallow a step or fire fifty of them.
      if (Math.floor(you.gait / Math.PI) !== Math.floor(before / Math.PI)) {
        const sp = Math.hypot(you.vx, you.vz);
        // The apron is the only paved thing you can stand on; everywhere else
        // is limestone, scrub and pine needles.
        const hard = field.onPaved && field.onPaved(you.x, you.z) ? 1 : 0.18;
        audio.footstep(hard, 0.7 + sat(sp / GROUND.run) * 0.5);
      }
    }
    // Amplitude follows the speed, so a slow shuffle is not the same picture as
    // a run, and settles to nothing when you stop — the phase is left where it
    // is rather than being wound back, so setting off again continues the
    // stride you were in the middle of.
    const sp = Math.hypot(you.vx, you.vz);
    you.bob = damp(you.bob, sat(sp / GROUND.walk), 7, dt);
  }

  const distToPlane = () =>
    Math.hypot(you.x - flight.p.pos.x, you.z - flight.p.pos.z);

  /**
   * The nearest thing that is on fire, people first — the 0.4 bias means a
   * person forty metres away outranks a crate ten metres away, which is the
   * right priority and is not a judgement the player should have to make while
   * one of them is screaming.
   */
  function nearestTrouble(only) {
    let best = null, bd = Infinity;
    const take = (x, y, z, d, bias) => {
      if (d * bias < bd) { bd = d * bias; best = [x, y, z]; }
    };
    if (only !== 'obj') {
      for (const c of crew) {
        if (c.mode !== 'alight' && c.mode !== 'down') continue;
        take(c.x, c.y + 1, c.z, Math.hypot(c.x - you.x, c.z - you.z), 0.4);
      }
    }
    if (only !== 'crew') {
      for (const o of objects) {
        if (o.burning <= 0) continue;
        take(o.x, o.y + o.h, o.z, Math.hypot(o.x - you.x, o.z - you.z), 1);
      }
    }
    return best;
  }

  function refill(dt) {
    if (you.pack >= GROUND.pack) return;
    const take = Math.min(
      GROUND.refillRate * dt, GROUND.pack - you.pack, flight.p.water);
    you.pack += take;
    flight.p.water -= take;
    you.refilling = take > 0;
  }

  // ── the loop ───────────────────────────────────────────────────────────────
  function update(dt) {
    // The field burns whether or not anybody is standing in it. Leaving this
    // gated on the ground phase would mean an airfield that only ever caught
    // fire while you were watching, which is the kind of thing you can feel.
    //
    // Stranded skips the whole question: there is no field, nothing is going to
    // catch, and this early return is what would otherwise stop your legs
    // working on a hillside you have just parachuted on to.
    if (!armed && !stranded) {
      if (state.phase === 'fly' && state.t > 60 && frontDistance() < GROUND.spotRange) {
        armed = true;
        armTimer = 0;
        for (const c of crew) { c.mode = 'walk'; c.fig.root.visible = true; }
        radio('call.rokici', 'radio.rokiciSpot');
        toast(T('toast.rokici'), 'bad');
      }
      return;
    }
    if (armed && !seeded) {
      armTimer += dt;
      if (armTimer > GROUND.spotDelay) seedSpotFire();
    }

    updateObjects(dt);
    updateCrew(dt);

    you.refilling = false;
    if (active) {
      walk(dt);
      const wants = you.spraying && you.pack > 0;
      // Trace whether or not the branch is open. The reticle has to be able to
      // say what you are pointed at *before* you spend four hundred litres
      // finding out — which is what "spraying them didn't do much" actually
      // was. The water was never weak; nothing on screen ever said whether the
      // jet was landing on the person or a metre behind them.
      const hit = traceJet();
      you.aim = [hit.x, hit.y, hit.z];
      you.aimKind = hit.crew ? 'crew' : hit.obj ? 'obj' : hit.far ? null : 'ground';
      you.aimSoak = hit.crew ? clamp(hit.crew.wet, 0, 1)
        : hit.obj ? clamp(hit.obj.wet, 0, 1) : -1;
      you.aimHot = hit.crew ? (hit.crew.mode === 'alight' || hit.crew.burn > 0)
        : hit.obj ? hit.obj.burning > 0 : false;
      if (wants) spray(dt, hit);
      you.jet = damp(you.jet, wants ? 1 : 0, 14, dt);
      if (!stranded && distToPlane() < GROUND.refillDist && !wants) refill(dt);
    } else {
      you.jet = 0;
      you.aimKind = null;
      you.aimSoak = -1;
    }

    paintFlames();
    jetSpray.update(dt);
    steam.update(dt);
  }

  // ── in and out ─────────────────────────────────────────────────────────────
  /** Stopped, on the paved surface, with the wheels down. */
  function canEnter() {
    if (!armed || state.phase !== 'fly') return false;
    if (!flight.p.onGround) return false;
    return flight.p.vel.length() < 1.6;
  }
  // Not into a wreck. If you came down under a canopy the aeroplane is a
  // column of smoke somewhere else, and being offered the door back into it —
  // or a refill from its tank — is the game contradicting its own end screen.
  const canBoard = () => active && !stranded && distToPlane() < GROUND.boardDist;

  function enter() {
    if (!canEnter()) return false;
    stranded = false;
    const { fwd, right } = flight.axes();
    // Off the port side and well aft: the wing is fourteen metres of half-span
    // and the propellers are on the leading edge of it. Stepping out any closer
    // puts the camera inside the aeroplane rather than beside it.
    const sx = flight.p.pos.x - right.x * 17 - fwd.x * 7;
    const sz = flight.p.pos.z - right.z * 17 - fwd.z * 7;
    // And not on top of whoever happened to be standing on that patch of apron.
    const [bx, bz] = unbody(sx, sz);
    const [px2, pz2] = confine(bx, bz);
    you.x = px2; you.z = pz2;
    you.y = field.walkY(you.x, you.z);
    you.vx = you.vz = 0;
    you.pitch = 0;
    // Facing the problem, not the aeroplane. You have just spent thirty seconds
    // landing on a burning airfield; the first frame on foot should be of the
    // fire, and there is no version of this where you get out and look at a
    // fuselage.
    const look = nearestTrouble() || field.apron;
    you.yaw = Math.atan2(-(look[0] - you.x), -(look[2] - you.z));
    you.spraying = false;
    active = true;
    state.phase = 'ground';
    return true;
  }

  /**
   * Point the whole mode at somewhere else and keep every bit of it — the
   * movement, the branch, the camera, the collision. This is the trick the
   * locale interface was for: `buildGround` never knew anything about an
   * aerodrome except through these eleven members, so handing it eleven
   * different ones puts you on a hillside instead, and nothing downstream
   * notices.
   */
  function retarget(next) {
    if (!next || !next.site) return false;
    field = next;
    objects = next.objects || [];
    // Nobody is out here. The aerodrome's seven are built against the
    // aerodrome's spots and cannot be relocated meaningfully, so they go away
    // and come back if you are ever pointed at the field again.
    const home = next.crewSpots && next.crewSpots.length;
    crew = home ? allCrew : [];
    if (!home) for (const c of allCrew) c.fig.root.visible = false;
    return true;
  }

  /**
   * Arrive on foot from under a canopy, wherever that turned out to be.
   *
   * Deliberately not enter(): that one is the door of a parked aeroplane and
   * every number in it — seventeen metres to port to clear the wing, seven aft
   * to clear the propellers, the way back in afterwards — assumes there is an
   * aeroplane to step out of and back into. There is not. There is a hillside.
   */
  function dropIn(x, z, yaw, lost = true) {
    const [px, pz] = confine(x, z);
    you.x = px; you.z = pz;
    you.y = field.walkY(px, pz);
    you.vx = you.vz = 0;
    you.yaw = yaw;
    you.pitch = 0;
    you.spraying = false;
    // Every original caller of this arrived because the aeroplane was gone, so
    // the default is still that you are on your own out here. The exception is
    // the escape charge: it puts you under a canopy and back down again without
    // anything happening to an aircraft that may well still be parked eighty
    // metres away, and stranding you for having used it would make the way out
    // of a hole more expensive than the hole.
    if (lost) stranded = true;
    active = true;
    state.phase = 'ground';
    return true;
  }

  /**
   * Out of the mode, but not into an aeroplane.
   *
   * `leave()` is the door of a parked Canadair and refuses unless there is one
   * to climb into. This is the other exit — straight up, off a charge — so it
   * asks nothing and sets no phase: 57-eject.js takes it from here and the
   * canopy owns you until it puts you back down.
   */
  function bail() {
    if (!active) return false;
    active = false;
    you.spraying = false;
    you.vx = you.vz = 0;
    you.jet = 0;
    return true;
  }

  function leave() {
    if (!canBoard()) return false;
    active = false;
    you.spraying = false;
    state.phase = 'fly';
    return true;
  }

  /** Mouse or thumb, in radians. Pitch is clamped so you cannot invert. */
  function look(dx, dy) {
    you.yaw -= dx;
    you.pitch = clamp(you.pitch - dy, -1.35, 1.05);
  }

  function pose(camera) {
    // The head, not the boots. Down as each boot lands, side to side once per
    // pair of them — see gait(). The sway is applied along your own right, so
    // it stays a weight shift however you are facing rather than drifting the
    // view about in world axes.
    const dy = -GROUND.bobY * you.bob * (1 - Math.cos(you.gait * 2)) * 0.5;
    const sway = GROUND.bobX * you.bob * Math.sin(you.gait);
    const rx = Math.cos(you.yaw), rz = -Math.sin(you.yaw);
    const ex = you.x + rx * sway;
    const ey = you.y + GROUND.eye + dy;
    const ez = you.z + rz * sway;
    camera.position.set(ex, ey, ez);
    const cp = Math.cos(you.pitch);
    // Aimed from where the head actually is, or the bob would swing the whole
    // world about a fixed look-at point and you would be looking round a room
    // rather than walking through one.
    camera.lookAt(
      ex - Math.sin(you.yaw) * cp,
      ey + Math.sin(you.pitch),
      ez - Math.cos(you.yaw) * cp,
    );
  }

  const alight = () => {
    let n = 0;
    for (const o of objects) if (o.burning > 0) n++;
    for (const c of crew) if (c.mode === 'alight' || c.mode === 'down') n++;
    return n;
  };

  return {
    ok: true,
    get active() { return active; },
    get armed() { return armed; },
    update, enter, leave, bail, canEnter, canBoard, look, pose, you,
    retarget, dropIn, addGuest,
    /** Whichever locale currently owns you — for a test, and read-only. */
    get field() { return field; },
    get stranded() { return stranded; },
    get crew() { return crew; },
    hose: () => you.jet,
    hud: () => ({
      pack: you.pack, packMax: GROUND.pack,
      reserve: flight.p.water,
      alight: alight(),
      crewLeft: crew.filter((c) => c.mode === 'alight' || c.mode === 'down').length,
      rescued: tally.rescued,
      refilling: you.refilling,
      nearPlane: distToPlane() < GROUND.refillDist,
      canBoard: canBoard(),
      aimKind: you.aimKind,
      aimSoak: you.aimSoak,
      aimHot: you.aimHot,
    }),
    stats: () => ({
      armed, seeded, active,
      alight: alight(),
      objSaved: tally.saved, objLost: tally.lost,
      rescued: tally.rescued, crewLost: crew.filter((c) => c.mode === 'lost').length,
      crewOk: crew.filter((c) => c.mode === 'safe' || c.mode === 'thanks'
        || c.mode === 'walk' || c.mode === 'idle').length,
      pack: Math.round(you.pack), litres: Math.round(tally.litres),
      at: [Math.round(you.x), Math.round(you.z)],
      // The walk, which is invisible from outside and is the whole of whether
      // the mode feels like being somewhere.
      gait: +you.gait.toFixed(2), bob: +you.bob.toFixed(3),
      sp: +Math.hypot(you.vx, you.vz).toFixed(2),
    }),
    /** For the screenshot tool: stand somewhere specific and look somewhere specific. */
    put(x, z, yaw, pitch = 0) {
      const [px2, pz2] = confine(x, z);
      you.x = px2; you.z = pz2; you.y = field.walkY(px2, pz2);
      you.yaw = yaw; you.pitch = pitch;
    },
    /**
     * For the screenshot tool: the nearest person, and the separation being
     * enforced against them. `d` below `min` means you are standing inside
     * somebody, which is the whole thing this is here to catch; `min` of zero is
     * somebody prone, whom you are supposed to be able to stand over.
     */
    nearestBody() {
      let best = null;
      for (const c of crew) {
        const d = Math.hypot(c.x - you.x, c.z - you.z);
        if (best && d >= best.d) continue;
        best = { i: c.id, mode: c.mode, d: +d.toFixed(3),
          min: upright(c) ? +(GROUND.body * 2).toFixed(3) : 0 };
      }
      return best;
    },
    /** Stand eight metres off the nearest fire and point the branch at it. */
    aimAt(kind) {
      const t = nearestTrouble(kind);
      if (!t) return false;
      const a = Math.atan2(t[2] - you.z, t[0] - you.x);
      const [px2, pz2] = confine(t[0] - Math.cos(a) * 8, t[2] - Math.sin(a) * 8);
      you.x = px2; you.z = pz2; you.y = field.walkY(px2, pz2);
      you.yaw = Math.atan2(-(t[0] - you.x), -(t[2] - you.z));
      const d = Math.hypot(t[0] - you.x, t[2] - you.z);
      // Aim a little high: the jet droops, and that is the point of it.
      you.pitch = clamp(Math.atan2(t[1] - (you.y + GROUND.eye), d) + 0.10, -1.3, 1.0);
      return true;
    },
    force() {
      armed = true;
      for (const c of crew) { c.mode = 'walk'; c.fig.root.visible = true; }
      if (!seeded) seedSpotFire();
    },
    setSpray(on) { you.spraying = on; },
  };
}
