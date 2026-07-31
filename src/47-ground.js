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
  run: 6.1,
  accel: 30,
  drag: 13,
  girth: 0.55,             // how far you are pushed back out of a wall

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

/** One box, scaled per part. Forty geometries for seven people is forty too many. */
let UNIT_BOX = null;

/**
 * A ground crew figure: torso, head, helmet, two arms and two legs, the limbs on
 * pivots at the joint so a gait is four rotations rather than four translations.
 * Local forward is +X; width runs along Z.
 */
function makeFigure(mats) {
  const root = new THREE.Group();
  const part = (mat, d, h, w, x, y, z) => {
    const m = new THREE.Mesh(UNIT_BOX, mat);
    m.scale.set(d, h, w);
    m.position.set(x, y, z);
    return m;
  };
  const joint = (mat, d, h, w, y, z) => {
    const g = new THREE.Group();
    g.position.set(0, y, z);
    g.add(part(mat, d, h, w, 0, -h / 2, 0));
    root.add(g);
    return g;
  };
  root.add(part(mats.tunic, 0.26, 0.58, 0.44, 0, 1.16, 0));
  root.add(part(mats.trews, 0.26, 0.14, 0.36, 0, 0.85, 0));
  root.add(part(mats.skin, 0.20, 0.22, 0.19, 0.01, 1.56, 0));
  root.add(part(mats.helmet, 0.27, 0.12, 0.26, 0.01, 1.70, 0));
  return {
    root,
    armL: joint(mats.tunic, 0.13, 0.56, 0.13, 1.38, -0.28),
    armR: joint(mats.tunic, 0.13, 0.56, 0.13, 1.38, 0.28),
    legL: joint(mats.trews, 0.16, 0.84, 0.17, 0.86, -0.11),
    legR: joint(mats.trews, 0.16, 0.84, 0.17, 0.86, 0.11),
  };
}

function buildGround(scene, field) {
  // No site, no mode. The airfield search can fail on a world this rocky and the
  // rest of the game has to carry on without noticing.
  if (!field || !field.site) {
    return {
      ok: false, active: false, armed: false,
      update() {}, enter() {}, leave() {}, pose() {},
      canEnter: () => false, canBoard: () => false,
      hud: () => null, stats: () => null, look() {}, reset() {},
    };
  }

  UNIT_BOX = UNIT_BOX || new THREE.BoxGeometry(1, 1, 1);

  const rng = mulberry32(CONFIG.seed ^ 0x6f00d1);
  const objects = field.objects;
  const flames = buildFlames(scene, 220);
  const jetSpray = buildSprayPool(scene, 900, 7.5, 1.1);

  // ── the crew ───────────────────────────────────────────────────────────────
  const mats = {
    tunic: solidMaterial(0xd87a1c, { spec: 0.05, specPower: 16 }),
    trews: solidMaterial(0x2b3550, { spec: 0.05, specPower: 16 }),
    skin: solidMaterial(0xc79a74, { spec: 0.06, specPower: 20 }),
    helmet: solidMaterial(0xe8e6df, { spec: 0.22, specPower: 40 }),
  };

  // Where anybody not on fire walks to: in front of the terminal, off the apron
  // and away from the fuel farm, which is where a muster point goes.
  const MUSTER = (() => {
    const [t, s] = field.local(field.apron[0], field.apron[2]);
    return field.toWorld(t - 60, s - 34);
  })();

  const crew = field.crewSpots.map((p, i) => {
    const fig = makeFigure(mats);
    fig.root.position.set(p[0], p[1], p[2]);
    fig.root.visible = false;                 // nobody is out there until it starts
    scene.add(fig.root);
    return {
      fig, x: p[0], y: p[1], z: p[2],
      hx: 1, hz: 0, vx: 0, vz: 0,
      mode: 'idle',              // idle | walk | alight | down | safe | lost
      burn: 0, wet: 0, timer: 0, gait: rng() * 6.28, seed: rng(), id: i,
      shouted: false,
    };
  });

  // ── the player ─────────────────────────────────────────────────────────────
  const you = {
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0,
    pack: GROUND.pack, spraying: false, jet: 0, refilling: false,
    aim: [0, 0, 0], aimKind: null,
  };

  let active = false;
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
  function confine(x, z) {
    const B = field.bounds;
    let [t, s] = field.local(x, z);
    t = clamp(t, B.t0, B.t1);
    s = clamp(s, B.s0, B.s1);
    for (const b of field.blockers) {
      const dt = t - b.t, ds = s - b.s;
      const ea = b.a + GROUND.girth, ec = b.c + GROUND.girth;
      if (Math.abs(dt) >= ea || Math.abs(ds) >= ec) continue;
      // Inside: leave by whichever face is nearest, which is what a wall does.
      if (ea - Math.abs(dt) < ec - Math.abs(ds)) t = b.t + Math.sign(dt || 1) * ea;
      else s = b.s + Math.sign(ds || 1) * ec;
    }
    const w = field.toWorld(t, s);
    return [w[0], w[2]];
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
  function updateCrew(dt) {
    for (const c of crew) {
      if (c.mode === 'lost') { poseFigure(c, dt); continue; }

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
        // Running. It is the wrong thing to do and it is what happens: fanned
        // flames burn harder, so the panic makes it worse, which is the whole
        // reason somebody has to physically stop them.
        // Slower than a sprint and constantly turning. Somebody whose clothes
        // are alight is not running *to* anywhere, and if they simply outpaced
        // you in a straight line there would be no rescue to make.
        speed = 3.3 + Math.sin(c.gait * 0.7 + c.seed * 6) * 1.1;
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
        if (c.burn >= 1) { c.mode = 'down'; c.timer = 0; tally.down++; }
      } else if (c.mode === 'down') {
        c.timer += dt;
        if (c.timer > GROUND.crewDown) {
          c.mode = 'lost';
          tally.lost++;
          radio('call.rokici', 'radio.crewLost');
        }
      } else if (c.mode === 'walk') {
        const dx2 = MUSTER[0] - c.x, dz2 = MUSTER[2] - c.z;
        const d = Math.hypot(dx2, dz2);
        if (d < 3) { c.mode = 'idle'; } else {
          c.hx = dx2 / d; c.hz = dz2 / d;
          speed = 1.6;
        }
      } else if (c.mode === 'safe') {
        c.timer += dt;
        if (c.timer > 7) { c.mode = 'walk'; }
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
        }
        c.x = px2; c.z = pz2;
        c.gait += speed * dt * 2.6;
      }
      c.y = field.walkY(c.x, c.z);
      poseFigure(c, dt);
    }
  }

  function poseFigure(c, dt) {
    const f = c.fig;
    f.root.visible = armed;
    f.root.position.set(c.x, c.y, c.z);
    f.root.rotation.set(0, Math.atan2(-c.hz, c.hx), 0);

    if (c.mode === 'down' || c.mode === 'lost') {
      // Face down, which is what "stop, drop and roll" ends as. Rolled onto the
      // side rather than flat, so the silhouette still reads as a person.
      f.root.rotation.z = -Math.PI / 2 + 0.12;
      f.root.position.y = c.y + 0.34;
      f.armL.rotation.z = 0.5; f.armR.rotation.z = -0.5;
      f.armL.rotation.x = 0.2; f.armR.rotation.x = -0.2;
      f.legL.rotation.x = 0.35; f.legR.rotation.x = -0.15;
      return;
    }
    f.root.rotation.z = 0;

    if (c.mode === 'safe') {
      // Down on one knee, head in hands. They are fine; they are not fine yet.
      f.root.position.y = c.y - 0.36;
      f.legL.rotation.x = 1.5; f.legR.rotation.x = -0.4;
      f.armL.rotation.x = -1.5; f.armR.rotation.x = -1.5;
      f.armL.rotation.z = 0.3; f.armR.rotation.z = -0.3;
      return;
    }

    const swing = c.mode === 'alight' ? 1.25 : 0.55;
    const s = Math.sin(c.gait), s2 = Math.cos(c.gait);
    f.legL.rotation.x = s * swing;
    f.legR.rotation.x = -s * swing;
    if (c.mode === 'alight') {
      // Arms up and flailing. Nothing about this is a run cycle.
      f.armL.rotation.x = -2.3 + s2 * 0.5;
      f.armR.rotation.x = -2.3 - s2 * 0.5;
      f.armL.rotation.z = 0.6 + s * 0.3; f.armR.rotation.z = -0.6 - s * 0.3;
      f.root.position.y = c.y + Math.abs(s) * 0.06;
    } else {
      f.armL.rotation.x = -s * swing * 0.8;
      f.armR.rotation.x = s * swing * 0.8;
      f.armL.rotation.z = 0.06; f.armR.rotation.z = -0.06;
    }
  }

  // ── the jet ────────────────────────────────────────────────────────────────
  /** Nozzle position and direction, in the flight model's yaw convention. */
  function nozzle() {
    const cp = Math.cos(you.pitch);
    const dir = [-Math.sin(you.yaw) * cp, Math.sin(you.pitch), -Math.cos(you.yaw) * cp];
    const right = [-Math.cos(you.yaw), 0, Math.sin(you.yaw)];
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

  function traceJet() {
    const { p, dir } = nozzle();
    let x = p[0], y = p[1], z = p[2];
    let vx = dir[0] * GROUND.jetV, vy = dir[1] * GROUND.jetV, vz = dir[2] * GROUND.jetV;
    const dt = GROUND.jetDt;
    for (let i = 0; i < GROUND.jetSteps; i++) {
      const x0 = x, y0 = y, z0 = z;
      vy -= 9.81 * dt;
      x += vx * dt; y += vy * dt; z += vz * dt;

      // Nearest hit *along the step*, so a jet grazing two things soaks the
      // near one rather than whichever happened to be first in the array.
      let bt = 2, hit = null;
      for (const c of crew) {
        if (c.mode === 'lost') continue;
        const t = sweep(x0, z0, x, z, c.x, c.z, 0.85);
        if (t < 0 || t >= bt) continue;
        const yy = y0 + (y - y0) * t;
        const h = c.mode === 'down' || c.mode === 'safe' ? 1.0 : 1.9;
        if (yy > c.y + h || yy < c.y - 0.25) continue;
        bt = t; hit = { crew: c };
      }
      for (const o of objects) {
        const t = sweep(x0, z0, x, z, o.x, o.z, o.w * 0.55 + 0.45);
        if (t < 0 || t >= bt) continue;
        const yy = y0 + (y - y0) * t;
        if (yy > o.y + o.h + 0.4 || yy < o.y - 0.3) continue;
        bt = t; hit = { obj: o };
      }
      if (hit) {
        return { x: x0 + (x - x0) * bt, y: y0 + (y - y0) * bt, z: z0 + (z - z0) * bt, ...hit };
      }

      const gy = field.walkY(x, z);
      if (y <= gy) return { x, y: gy, z };
    }
    return { x, y, z, far: true };
  }

  function spray(dt) {
    const hit = traceJet();
    you.aim = [hit.x, hit.y, hit.z];
    you.aimKind = hit.crew ? 'crew' : hit.obj ? 'obj' : hit.far ? null : 'ground';

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
    }
    // Whatever the jet hit, the water still lands on the ground under it.
    fire.hose(hit.x, hit.z, litres * (hit.crew || hit.obj ? 0.35 : 1));

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
      flameList.push({
        x: o.x, y: o.y + o.h * 0.30, z: o.z,
        size: (0.9 + o.h * 0.8) * (0.72 + o.burning * 0.5), v: o.burning,
      });
    }
    for (const c of crew) {
      if (c.mode !== 'alight' && !(c.mode === 'down' && c.burn > 0)) continue;
      const v = c.mode === 'down' ? 0.5 : 0.75;
      flameList.push({ x: c.x, y: c.y + 0.62, z: c.z, size: 1.55, v });
    }
    flames.paint(flameList);
  }

  // ── movement ───────────────────────────────────────────────────────────────
  function walk(dt) {
    const fx = -Math.sin(you.yaw), fz = -Math.cos(you.yaw);
    const rx = -Math.cos(you.yaw), rz = Math.sin(you.yaw);
    let ix = 0, iz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    ix += TOUCH.gx || 0; iz += TOUCH.gy || 0;
    const m = Math.hypot(ix, iz);
    if (m > 1) { ix /= m; iz /= m; }

    const top = (keys.has('ShiftLeft') || keys.has('ShiftRight') || TOUCH.grun)
      ? GROUND.run : GROUND.walk;
    const wx = (fx * iz + rx * ix) * top;
    const wz = (fz * iz + rz * ix) * top;
    you.vx = damp(you.vx, wx, m > 0.01 ? GROUND.accel / top : GROUND.drag, dt);
    you.vz = damp(you.vz, wz, m > 0.01 ? GROUND.accel / top : GROUND.drag, dt);

    const tx = you.x + you.vx * dt, tz = you.z + you.vz * dt;
    const [nx, nz] = confine(tx, tz);
    // Kill the velocity only if confine() actually moved us. The tolerance is
    // for the world -> runway-local -> world round trip inside it, which is
    // exact in theory and a few parts in 10^12 in practice.
    if (Math.abs(nx - tx) > 1e-4) you.vx = 0;
    if (Math.abs(nz - tz) > 1e-4) you.vz = 0;
    you.x = nx; you.z = nz;
    you.y = field.walkY(you.x, you.z);
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
    if (!armed) {
      if (state.phase === 'fly' && state.t > 60 && frontDistance() < GROUND.spotRange) {
        armed = true;
        armTimer = 0;
        for (const c of crew) { c.mode = 'walk'; c.fig.root.visible = true; }
        radio('call.rokici', 'radio.rokiciSpot');
        toast(T('toast.rokici'), 'bad');
      }
      return;
    }
    if (!seeded) {
      armTimer += dt;
      if (armTimer > GROUND.spotDelay) seedSpotFire();
    }

    updateObjects(dt);
    updateCrew(dt);

    you.refilling = false;
    if (active) {
      walk(dt);
      const wants = you.spraying && you.pack > 0;
      if (wants) spray(dt); else { you.aimKind = null; you.aim = [0, 0, 0]; }
      you.jet = damp(you.jet, wants ? 1 : 0, 14, dt);
      if (distToPlane() < GROUND.refillDist && !wants) refill(dt);
    } else {
      you.jet = 0;
    }

    paintFlames();
    jetSpray.update(dt);
  }

  // ── in and out ─────────────────────────────────────────────────────────────
  /** Stopped, on the paved surface, with the wheels down. */
  function canEnter() {
    if (!armed || state.phase !== 'fly') return false;
    if (!flight.p.onGround) return false;
    return flight.p.vel.length() < 1.6;
  }
  const canBoard = () => active && distToPlane() < GROUND.boardDist;

  function enter() {
    if (!canEnter()) return false;
    const { fwd, right } = flight.axes();
    // Off the port side and well aft: the wing is fourteen metres of half-span
    // and the propellers are on the leading edge of it. Stepping out any closer
    // puts the camera inside the aeroplane rather than beside it.
    const sx = flight.p.pos.x - right.x * 17 - fwd.x * 7;
    const sz = flight.p.pos.z - right.z * 17 - fwd.z * 7;
    const [px2, pz2] = confine(sx, sz);
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
    camera.position.set(you.x, you.y + GROUND.eye, you.z);
    const cp = Math.cos(you.pitch);
    camera.lookAt(
      you.x - Math.sin(you.yaw) * cp,
      you.y + GROUND.eye + Math.sin(you.pitch),
      you.z - Math.cos(you.yaw) * cp,
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
    update, enter, leave, canEnter, canBoard, look, pose, you, crew,
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
    }),
    stats: () => ({
      armed, seeded, active,
      alight: alight(),
      objSaved: tally.saved, objLost: tally.lost,
      rescued: tally.rescued, crewLost: crew.filter((c) => c.mode === 'lost').length,
      crewOk: crew.filter((c) => c.mode === 'safe' || c.mode === 'walk'
        || c.mode === 'idle').length,
      pack: Math.round(you.pack), litres: Math.round(tally.litres),
      at: [Math.round(you.x), Math.round(you.z)],
    }),
    /** For the screenshot tool: stand somewhere specific and look somewhere specific. */
    put(x, z, yaw, pitch = 0) {
      const [px2, pz2] = confine(x, z);
      you.x = px2; you.z = pz2; you.y = field.walkY(px2, pz2);
      you.yaw = yaw; you.pitch = pitch;
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
