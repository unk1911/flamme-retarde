// -----------------------------------------------------------------------------
// The Bucketeers of America, fly division.
//
// Misha, 14 Sep 2026: *"it would be hilarious if after a few seconds the fly
// started twitching a bit, then came back to life ... started flying around
// again, this time carrying two tiny blue buckets of water. the zombie fly has
// essentially joined the "Bucketeers of America" movement and is actively
// helping baye deliver the tiny blue buckets to the front yard to empty them
// and then fly back up through the upper terrace and into the bathroom to load
// up more water."*
//
// The resurrection itself is a shot, and it is in src/44-corpse.js with the
// corpse it resurrects. This file is what the fly does afterwards, in the
// room, at its own size — the live housefly out of src/44-vikendica.js, cloned
// and given two buckets, flying under the house's `root` in the house's own
// metres exactly as the live one does.
//
// WHAT IT DOES, keyed off HER beat rather than a clock of its own, so that it
// is helping with the trip she is actually on:
//
//   fill            over her pail at the basin, dipping its buckets in it
//   lift, down      beside her pail, all the way down the flight
//   tip             still beside it, and it pours when she pours
//   right onwards   it does not walk back up with her. It flies: out from under
//                   the terrace, up its face and over the rail, across it, over
//                   the east rail, north above the flight to the landing, in at
//                   the front door and across the big room to the bathroom
//   up, set         waiting for her over the basin when she gets there
//   roam, dwell     at her shoulder while she wanders the flat
//
// THROUGH THE TERRACE, AND NOT THROUGH THE TERRACE DOORS. The ask was "up
// through the upper terrace and into the bathroom", and the terrace doors are
// two glazed leaves drawn shut across the opening — see the note over
// BUCK_ROAM in src/45-bucketeer.js, where she stands at them for the same
// reason. A fly does not go through glass either. So it crosses the terrace and
// goes round the corner to the front door, which is open, because she walks
// through it with ten litres every trip.
//
// AND IT IS SEVEN MILLIMETRES LONG. The joke you can see is in the cuts: the
// swat's own close-up, and an insert in her pour cut every trip, both drawn by
// src/44-corpse.js on a lens that can see a fly. Out here it is the real
// animal at the real size with 2.6 mm buckets, which is exactly as visible as
// the fly it was — and there for anybody who goes looking with the long lens.
// -----------------------------------------------------------------------------

const ZOMBIE = {
  // How big the movement may get. Three members and then the fourth swatted fly
  // stays dead, which keeps the insert readable and the bathroom un-crowded.
  max: 3,
  // A fly's flight, off FLY in src/44-vikendica.js: straight segments with a
  // 30 ms snap between them. Faster at the top end than the room's fly, because
  // this one has somewhere to be.
  seg: [0.10, 0.30],
  snap: 0.030,
  speed: [0.30, 1.90],
  // How far off the bearing to its target a segment may point, in radians, far
  // from it and close to it. Close, it has to be nearly straight or it orbits a
  // pail it is supposed to be beside.
  jitter: [0.55, 0.20],
  near: 0.14,               // m — a waypoint within this is reached
  // Where it hovers relative to her pail's ear line, per member: metres to her
  // right, metres up. Alternate sides so two members are not one speck.
  pail: [[0.18, 0.16], [-0.20, 0.24], [0.14, 0.36]],
  // And at her shoulder: right, up off her feet, forward.
  shoulder: [[0.30, 1.66, 0.10], [-0.32, 1.78, 0.06], [0.22, 1.95, 0.18]],
  // The pour, on her clock in `tip`: over, and back.
  pour: [0.42, 0.40, 1.45, 0.50],
  tilt: 1.9,
  // The way home, in house metres [x, y, z]. See the note at the top of the
  // file; every height was checked against what it crosses. The terrace is
  // floor 2.90 at z 3.865…6.065 with a 1.04 m stainless rail round it, so the
  // top of the rail is 3.94 and both crossings of it are over 4.10. The flight
  // is under x 4.0 from the landing at 2.90 down to the made ground at z 3.62,
  // so 4.35 along x 4.25 is over the whole of it and its rail. The front door
  // is the terrace detail again with a 2.10 m head, so 5.00, and it goes in at
  // 4.30.
  home: [
    [0.95, 1.10, 6.45],     // out from under the terrace, past its edge
    [0.95, 4.35, 6.45],     // up its face, clear of the rail
    [1.60, 3.80, 5.05],     // over the terrace, a metre off its floor
    [3.00, 4.10, 5.00],
    [3.75, 4.35, 4.60],     // over the east rail
    [4.25, 4.40, 2.60],     // north, above the flight
    [4.25, 4.40, 0.20],     // the landing
    [3.30, 4.30, 0.20],     // in at the front door
    [2.44, 4.25, 0.20],
    [1.45, 4.20, 0.16],     // the middle of the big room — BUCK_WAY 4
    [0.15, 4.05, 0.02],     // past the sofa
    [-0.79, 3.95, -0.05],   // the bathroom door
    [-1.15, 3.70, 0.16],
  ],
  // The fly's own pieces, off LEG_AIR in src/44-vikendica.js: [sweep, droop].
  legAir: [[-0.60, 0.42], [-1.60, -1.20], [-2.80, -0.45]],
  // Where on the animal each bucket hangs from, metres in the rig — the tips of
  // the middle pair, reaching down.
  hangAt: [-0.0002, -0.0031, 0.0021],
  hear: 60,                 // m — past this nobody is watching and it holds
  // ── and it hums. `zombieHum` in src/80-audio.js is the voice; this is when.
  //
  // Misha, 14 Sep 2026: *"maybe the zombie-fly with the buckets can also hum
  // some zombiefied-version of the same melody HAHAH"*. Three occasions, all
  // rare, because the same request cut HER humming to a tenth:
  //
  //   ANSWERING HER. When she starts a phrase you can hear, the movement hums
  //   it back once she has finished — 1.93 s of hers and then a beat. Once per
  //   burst of hers, not once per phrase.
  //   WHEN SHE POURS, 1.35 s into the tip, so inside the pour cut and over the
  //   insert, which is the one place the joke is on screen as well.
  //   AND ON ITS OWN, every two to four minutes.
  //
  // Each member at its own rate and a fifth of a second behind the last, which
  // is what three flies humming one tune sounds like.
  hum: { answer: [2.6, 3.4], answerEvery: 25, own: [120, 240],
    rates: [0.66, 0.56, 0.76], stagger: 0.22, pourAt: 1.35 },
};

/**
 * One 2.6 mm pail for the room, hung from the apex of its bail like the one in
 * the close-up (see `miniBucket` in src/44-corpse.js), and in the same colours
 * as hers.
 */
function zombieBucket(mats) {
  const B = MINIB;
  const hang = new THREE.Group();
  const bailG = new THREE.TorusGeometry(mm(B.rRim + 0.05), mm(0.12), 3, 8, Math.PI);
  bailG.scale(1, B.bail / (B.rRim + 0.05), 1);
  bailG.translate(0, -mm(B.bail), 0);
  hang.add(new THREE.Mesh(bailG, mats.wire));
  const pin = new THREE.Group();
  pin.position.y = -mm(B.bail);
  hang.add(pin);
  const g = new THREE.CylinderGeometry(mm(B.rRim), mm(B.rBase), mm(B.h), 10, 1, false);
  g.translate(0, mm(B.h / 2 - B.ear), 0);
  pin.add(new THREE.Mesh(g, mats.out));
  const w = new THREE.CircleGeometry(mm(B.rRim - 0.12), 10);
  w.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(w, mats.water);
  water.position.y = mm(B.h - B.ear - 0.35);
  pin.add(water);
  for (const m of [...hang.children, ...pin.children]) {
    m.castShadow = false; m.receiveShadow = false;
  }
  return { hang, pin, water };
}

/**
 * The movement. `vik` is the house (its fly, its root, its plan) and `buck` is
 * the Bucketeer, whose beat everything here is keyed off.
 */
function buildZombies(vik, buck) {
  const root = vik.root;
  const mats = {
    out: solidMaterial(new THREE.Color(0.140, 0.300, 0.650),
      { spec: 0.35, specPower: 50, emissive: VIK.glow * 1.5, vcol: false }),
    wire: solidMaterial(new THREE.Color(0.560, 0.575, 0.590),
      { spec: 0.6, specPower: 80, emissive: VIK.glow * 1.5, vcol: false }),
    water: solidMaterial(new THREE.Color(0.105, 0.180, 0.215),
      { spec: 0.8, specPower: 90, emissive: VIK.glow, vcol: false }),
  };
  const flock = [];
  // A swat whose resurrection played, waiting for its corpse to be on the
  // floor. Usually already is — the close-up only starts once it lands — but a
  // cut skipped in the spiral ends before the fly does.
  let pending = 0;
  let lastPhase = null;
  // The humming's clocks — see ZOMBIE.hum.
  let clockS = 0;
  let humAt = 60;
  let answerAt = -1;
  let lastAnswer = -1e9;
  let herFired = -1;
  let lastBeatT = 0;
  const _w = new THREE.Vector3();
  const _r = new THREE.Vector3();
  const rnd = (a, b) => a + Math.random() * (b - a);
  const _p = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _inv = new THREE.Matrix4();
  const wrap = (a) => {
    let v = a;
    while (v > Math.PI) v -= TAU;
    while (v < -Math.PI) v += TAU;
    return v;
  };

  function spawn(at) {
    const k = vik.fly.kit();
    const rig = k.rig;
    rig.rotation.order = 'YXZ';
    // Wings out and legs up, which is the live animal's air pose — and the
    // middle pair down, because that is what the buckets hang off.
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      k.wings[i].rotation.set(0, s * 0.42, -0.12);
    }
    for (let i = 0; i < 6; i++) {
      const s = i & 1 ? 1 : -1;
      const [sweep, droop] = ZOMBIE.legAir[i >> 1];
      k.legs[i].rotation.set(0, s * sweep, droop);
    }
    root.add(rig);
    const buckets = [zombieBucket(mats), zombieBucket(mats)];
    for (const b of buckets) root.add(b.hang);
    const z = {
      i: flock.length, rig, buckets,
      p: new THREE.Vector3(at[0], at[1] + 0.004, at[2]),
      head: rnd(-Math.PI, Math.PI), head0: 0, headD: 0, turn: 0,
      speed: 0.2, speed0: 0.2, speedD: 0,
      seg: 0, wake: 0.9, home: -1, fill: 0, tilt: 0, want: 'wake',
      swing: rnd(0, TAU),
      humStart: -1,
    };
    flock.push(z);
    return z;
  }

  /** Her pail's ear line, in house metres. */
  function pailHouse(out) {
    buck.pail.getWorldPosition(out);
    return root.worldToLocal(out);
  }

  /**
   * Where this member wants to be this frame, in house metres, and what it is
   * doing there. Written into `z.target`.
   */
  function aim(z, ph, t) {
    const T = z.target || (z.target = new THREE.Vector3());
    if (z.home >= 0) {
      T.set(...ZOMBIE.home[z.home]);
      z.want = 'home';
      return T;
    }
    // Her frame, off the yaw the pour rig uses: forward (cos, −sin), right
    // (sin, cos) in the world — and the house is turned by its own yaw.
    // Her yaw is a world bearing and the house is turned by its own, so the
    // bearing in house metres is the difference.
    const ry = (buck.yawNow ? buck.yawNow() : 0) - vik.yaw;
    const rx = Math.sin(ry), rz = Math.cos(ry);
    const fx = Math.cos(ry), fz = -Math.sin(ry);
    if (ph === 'fill' || ph === 'lift' || ph === 'down' || ph === 'tip') {
      pailHouse(T);
      const o = ZOMBIE.pail[z.i % ZOMBIE.pail.length];
      T.x += rx * o[0]; T.z += rz * o[0]; T.y += o[1];
      z.want = ph === 'fill' ? 'load' : (ph === 'tip' ? 'pour' : 'carry');
      return T;
    }
    if (ph === 'up' || ph === 'set' || ph === 'right' || ph === 'rest' || ph === 'take') {
      // Waiting for her at the basin — which on `right` to `take` it only is
      // if it has already been home, because those are the beats it leaves on.
      T.set(BUCK_TAP[0] + 0.10 - z.i * 0.12, 3.30 + z.i * 0.08, BUCK_TAP[1] + z.i * 0.10);
      z.want = 'wait';
      return T;
    }
    const w = buck.where();
    T.set(w[0], w[1], w[2]);
    root.worldToLocal(T);
    const o = ZOMBIE.shoulder[z.i % ZOMBIE.shoulder.length];
    T.x += rx * o[0] + fx * o[2]; T.z += rz * o[0] + fz * o[2]; T.y += o[1];
    z.want = 'escort';
    return T;
  }

  function stepOne(z, dt, ph, t) {
    const T = aim(z, ph, t);
    // Home is a string of waypoints, and a reached one is the next one.
    if (z.home >= 0 && z.p.distanceTo(T) < ZOMBIE.near) {
      z.home += 1;
      if (z.home >= ZOMBIE.home.length) z.home = -1;
    }
    // Getting up off the tile: straight up, slowly, for most of a second.
    if (z.wake > 0) {
      z.wake -= dt;
      z.p.y += 0.12 * dt;
      z.speed = 0;
    } else {
      z.seg -= dt;
      const dx = T.x - z.p.x, dy = T.y - z.p.y, dz = T.z - z.p.z;
      const dist = Math.hypot(dx, dy, dz);
      if (z.seg <= 0) {
        const close = sat(dist / 0.8);
        const j = lerp(ZOMBIE.jitter[1], ZOMBIE.jitter[0], close);
        // The heading is the bearing plus a draw, and the speed closes on the
        // target — and never stops, because a fly does not hover still.
        const want = Math.atan2(dz, dx) + rnd(-j, j);
        z.head0 = z.head; z.headD = wrap(want - z.head);
        z.speed0 = z.speed;
        z.speedD = clamp(dist * 3.2, ZOMBIE.speed[0], ZOMBIE.speed[1]) - z.speed;
        z.climb = clamp(dy / Math.max(0.05, dist), -0.9, 0.9);
        z.turn = ZOMBIE.snap;
        z.seg = rnd(ZOMBIE.seg[0], ZOMBIE.seg[1]) * (0.5 + 0.5 * close);
      }
      if (z.turn > 0) {
        z.turn -= dt;
        const u = sat(1 - Math.max(0, z.turn) / ZOMBIE.snap);
        z.head = wrap(z.head0 + z.headD * u);
        z.speed = z.speed0 + z.speedD * u;
      }
      const c = Math.sqrt(1 - (z.climb || 0) * (z.climb || 0));
      z.p.x += Math.cos(z.head) * c * z.speed * dt;
      z.p.z += Math.sin(z.head) * c * z.speed * dt;
      z.p.y += (z.climb || 0) * z.speed * dt;
      // Never through a floor.
      z.p.y = Math.max(z.p.y, 0.14);
    }

    // The pour, on her clock, and the buckets filling at the basin.
    if (z.want === 'pour') {
      z.tilt = ZOMBIE.tilt * (smooth01((t - ZOMBIE.pour[0]) / ZOMBIE.pour[1])
        - smooth01((t - ZOMBIE.pour[2]) / ZOMBIE.pour[3]));
      if (t > ZOMBIE.pour[0] + 0.2) z.fill = Math.max(0, z.fill - dt * 1.4);
    } else {
      z.tilt = 0;
      if (z.want === 'load') z.fill = Math.min(1, z.fill + dt * 0.25);
    }

    // ── the pose ───────────────────────────────────────────────────────────
    // Facing the way it is going, nose up in the air as the live one is.
    const r = z.rig;
    r.position.copy(z.p);
    r.rotation.set(0, -z.head, 0.30);
    r.updateMatrix();
    z.swing += dt * 6.5;
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1;
      const b = z.buckets[k];
      _p.set(ZOMBIE.hangAt[0], ZOMBIE.hangAt[1], ZOMBIE.hangAt[2] * s);
      _p.applyMatrix4(r.matrix);
      b.hang.position.copy(_p);
      const sw = (0.10 + 0.12 * sat(z.speed / 1.5)) * Math.sin(z.swing + s);
      b.hang.rotation.set(sw * 0.5, -z.head, sw);
      b.pin.rotation.set(s * z.tilt, 0, 0);
      b.water.visible = z.fill > 0.05;
    }
  }

  /** Everybody in, a fifth of a second apart. */
  function choir() {
    for (const z of flock) {
      if (z.humStart < 0) z.humStart = clockS + z.i * ZOMBIE.hum.stagger;
    }
  }

  function humTick(dt, who, ph, t) {
    if (!audio || !audio.zombieHum) return;
    const H = ZOMBIE.hum;
    clockS += dt;
    // Answering: a phrase of hers that actually sounded — `probe` counts only
    // the ones that were played, so a burst out of earshot is not answered.
    const her = audio.hum(0, { probe: true });
    if (herFired < 0) herFired = her;
    if (her > herFired) {
      herFired = her;
      if (answerAt < 0 && clockS - lastAnswer > H.answerEvery) {
        answerAt = clockS + rnd(H.answer[0], H.answer[1]);
      }
    }
    if (answerAt >= 0 && clockS >= answerAt) { answerAt = -1; lastAnswer = clockS; choir(); }
    humAt -= dt;
    if (humAt <= 0) { humAt = rnd(H.own[0], H.own[1]); choir(); }
    if (ph === 'tip' && lastBeatT < H.pourAt && t >= H.pourAt) choir();
    lastBeatT = ph === 'tip' ? t : 0;

    // Where each one is heard from: the cut's camera while there is a cut —
    // `BUCK.ear`, the same live reference her own voice uses — and you
    // otherwise.
    const ear = BUCK.ear || who;
    if (!ear) return;
    if (camera && camera.matrixWorld) _r.setFromMatrixColumn(camera.matrixWorld, 0);
    for (const z of flock) {
      _w.copy(z.p);
      root.localToWorld(_w);
      const ex = _w.x - ear.x, ey = _w.y - ear.y, ez = _w.z - ear.z;
      const dist = Math.hypot(ex, ey, ez);
      const pan = clamp((_r.x * ex + _r.z * ez) / Math.max(0.3, dist), -1, 1) * 0.8;
      if (z.humStart >= 0 && clockS >= z.humStart) {
        z.humStart = -1;
        audio.zombieHum(dist, { start: true, id: z.i, pan,
          rate: H.rates[z.i % H.rates.length] });
      } else {
        audio.zombieHum(dist, { id: z.i, pan });
      }
    }
  }

  return {
    /** Everybody hum, now. Debug, and what a probe of the voice wants. */
    hum: () => { choir(); return flock.length; },
    /** Can another one join? The swat asks before it plays the resurrection. */
    room: () => flock.length + pending < ZOMBIE.max,
    /** One is coming: the corpse on the floor gets up as soon as it is there. */
    expect: () => { pending += 1; },
    count: () => flock.length,
    tick(dt, who) {
      if (!dt) return;
      if (pending > 0 && vik.fly.mode() === 'dead') {
        const at = vik.fly.raise();
        pending -= 1;
        if (at) spawn(at);
      }
      if (!flock.length) return;
      const w = root.position;
      const far = !who || Math.hypot(who.x - w.x, who.z - w.z) > ZOMBIE.hear;
      for (const z of flock) {
        z.rig.visible = !far;
        for (const b of z.buckets) b.hang.visible = !far;
      }
      if (far) return;
      const k = buck ? buck.beat() : { phase: 'roam', t: 0 };
      const ph = k.phase;
      // Leaving: the first frame of `right`, which is the pail coming upright
      // off the pour. Only the members that were down there for it.
      if (ph === 'right' && lastPhase === 'tip') {
        for (const z of flock) {
          if (z.home < 0 && z.p.distanceTo(_p.set(...ZOMBIE.home[0])) < 4.0) z.home = 0;
        }
      }
      lastPhase = ph;
      const d = Math.min(dt, 0.05);
      for (const z of flock) stepOne(z, d, ph, k.t);
      humTick(dt, who, ph, k.t);
    },
    stats: () => ({
      count: flock.length, pending,
      flock: flock.map((z) => ({
        at: [+z.p.x.toFixed(3), +z.p.y.toFixed(3), +z.p.z.toFixed(3)],
        want: z.want, home: z.home, fill: +z.fill.toFixed(2), tilt: +z.tilt.toFixed(2),
        speed: +z.speed.toFixed(2),
        gap: z.target ? +z.p.distanceTo(z.target).toFixed(2) : null,
      })),
    }),
    /** Debug: one joins now, out of nowhere, at a house-metre point. */
    spawn: (x = 1.4, y = 4.4, zz = 1.0) => { spawn([x, y, zz]); return flock.length; },
  };
}
