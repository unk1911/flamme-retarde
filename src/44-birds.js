// -----------------------------------------------------------------------------
// Birds.
//
// Four species, because on this coast in August there are four and they could
// not be less alike. Yellow-legged gulls (Larus michahellis) own the channel and
// the harbour: they soar, they wheel, and a fit one will go the best part of a
// minute between wingbeats. Pallid swifts scream around the roofs of the old
// town at chimney height, all flicker and no glide worth the name. Hooded crows
// work the karst inland, beating steadily, going somewhere. And bee-eaters hunt
// high over the scrub in loose parties, three beats and a long glide, calling
// the whole time.
//
// The fourth arrived, and the second was renamed, on 25 Aug, when Misha listed
// what he had heard at the vikendica that morning: eight species, four of them
// already in this file or newly wanted here. What each of the four sounds like
// now lives in VOICE in 80-audio.js — a recording apiece, in place of the
// oscillator that used to answer. Nothing about how they FLY changed; that was
// already the valuable part and it was already right.
//
// Making those three *move* differently is most of the value here, so they are
// one integrator with three sets of numbers, and the numbers that differ are the
// ones you would notice from a boat: how often it flaps, how hard it banks, and
// how far off the deck it lives.
//
// They also react, which is the rest of the value. A Canadair at ninety metres a
// second puts everything within two hundred up off the water, and nothing stays
// over a cell that is alight. A bird that ignored both would be wallpaper.
//
// Cost: two instanced draws for the lot, at any count. A bird is one body
// instance and two wing instances, and the wings hinge because the per-instance
// rotation is a full quaternion — so a wingbeat is a couple of quaternion
// multiplies on the CPU and nothing whatever on the GPU.
// -----------------------------------------------------------------------------

const BIRDS = {
  // Birds exist in a ring this far around the camera and nowhere else. 750 m is
  // where a gull stops being a bird and becomes one white pixel, and the whole
  // population is recycled through that ring as you fly.
  radius: 750,
  rehome: 4,             // relocations per frame, at most — a hard cost ceiling
  // Beyond this you would not hear one over two 2 380 hp turboprops anyway.
  callDist: 430,
  // How close the aeroplane has to come. Two hundred metres is about right for
  // a low pass: the birds under the flight path go up, the rest carry on.
  flush: 210,
};

/**
 * Model axes are the aeroplane's, so nothing in this file has to think twice:
 * -Z is the bill, +X is the right wingtip, +Y is up. Lengths in metres.
 */
const FLOCK = [
  {
    key: 'gull',
    n: 20,
    // 1.4 m across and 60 cm long: the biggest thing in this sky that is not an
    // aeroplane, and the only bird here you will ever get a proper look at.
    span: 1.40, len: 0.60, girth: 1.00, chord: 1.00,
    body: [0.93, 0.93, 0.91],       // white, and it stays white
    wing: [0.62, 0.65, 0.69],       // grey mantle; the black primaries are baked in
    cruise: 11, flee: 19, climb: 3.0,
    // It soars four times as long as it flaps, and that ratio *is* the species.
    beat: 2.7, amp: 0.80, dihedral: 0.15,
    burst: 1.7, glide: 6.5,
    turn: 0.36, bank: 1.60,
    wheel: 0.85, wheelRate: 0.06,   // the long slow arc a gull's track actually is
    band: [8, 75], calm: 3.4,
    ring: 1.00,                     // a gull is big enough to be worth drawing at 750 m
    call: [11, 26],
    rafts: 0.30,                    // this fraction of them are sitting on the water
    where: (x, z) => isSea(x, z) || shoreAt(x, z) < 150,
  },
  {
    key: 'swift',
    n: 26,
    // 42 cm across and 17 grams. Apus does everything on the wing, which is why
    // there is no rafting here and no perching anywhere in this file — its feet
    // cling to a vertical wall and will not close round a branch.
    //
    // `pallidus` and not `apus`, which was what this said until Misha named it.
    // Rule 12 settles it on its own — he was standing under them — but the two
    // are also a fortnight apart in the calendar and the calendar agrees with
    // him. Common swifts clear out of the Mediterranean by the start of August;
    // pallid swifts are often on a second brood and stay into the autumn. So on
    // a Dalmatian morning at the end of August the birds still screaming round
    // the roofs are overwhelmingly the pallid ones, and the recording in the
    // payload is one of those, from Spain.
    span: 0.42, len: 0.17, girth: 0.86, chord: 0.52,
    body: [0.21, 0.19, 0.18],
    wing: [0.17, 0.16, 0.15],
    cruise: 21, flee: 30, climb: 6.0,
    // Eight beats a second, in bursts of half of one, and the pause between
    // bursts is as much a part of the shape as the beat.
    beat: 8.2, amp: 0.60, dihedral: -0.06,
    burst: 0.5, glide: 0.7,
    turn: 2.4, bank: 0.55,
    wheel: 1.5, wheelRate: 0.55,
    band: [12, 46], calm: 1.6,
    // 42 cm of bird at 700 m is not a bird, it is a wasted instance. Keeping
    // them in close is also honest: swifts scream *past* you.
    ring: 0.42,
    call: [6, 13],
    rafts: 0,
    where: (x, z) => !isSea(x, z) && urbanAt(x, z) > 0.32,
  },
  {
    key: 'crow',
    n: 12,
    // Corvus cornix: ash-grey body, black hood and wings, and the only one of
    // the three that flies in a straight line, because it is going somewhere.
    span: 0.98, len: 0.47, girth: 1.12, chord: 1.25,
    body: [0.53, 0.52, 0.51],
    wing: [0.12, 0.12, 0.13],
    cruise: 10, flee: 15, climb: 2.4,
    beat: 3.4, amp: 0.95, dihedral: 0.02,
    burst: 14, glide: 0.7,           // near enough continuous, and it looks like work
    turn: 0.5, bank: 0.5,
    wheel: 0.25, wheelRate: 0.09,
    band: [14, 60], calm: 2.6,
    ring: 0.75,
    call: [14, 34],
    rafts: 0,
    where: (x, z) => !isSea(x, z) && urbanAt(x, z) < 0.5,
  },
  {
    key: 'beeeater',
    n: 14,
    // Merops apiaster: 46 cm across and 28 of that is bird, the last few being
    // the two tail pins. Loose parties rather than a flock — fourteen spread
    // over the sky, not fourteen in a ball.
    span: 0.46, len: 0.28, girth: 0.85, chord: 0.62,
    // The colours are the ones you actually get, which is to say from below and
    // against the sky. All the chestnut and gold is on the BACK of this bird and
    // you will not see a scrap of it from the ground: what is underneath is a
    // blue-green breast and belly, and wings that are warm copper underneath
    // with a dark trailing edge baked into the strip shading like the gull's
    // primaries. Painting the famous topside here would be painting a bird
    // nobody in this game is ever positioned to see.
    body: [0.42, 0.62, 0.66],
    wing: [0.62, 0.48, 0.30],
    cruise: 12, flee: 20, climb: 4.0,
    // The signature, and the reason this is worth being a fourth species rather
    // than a recoloured crow: three or four quick beats and then a long flat
    // glide on stiff triangular wings. `glide` at 2.4 against `burst` at 0.9 is
    // that ratio, and it is nothing like the gull's soaring — a gull's glide is
    // a bird resting, a bee-eater's is part of the stroke.
    beat: 5.5, amp: 0.55, dihedral: 0.05,
    burst: 0.9, glide: 2.4,
    turn: 1.0, bank: 0.9,
    wheel: 1.1, wheelRate: 0.22,
    // High. They hawk for dragonflies and bees well up, and a party will drift
    // across at a hundred metres calling the whole way, which is usually how
    // you know they are there at all.
    band: [25, 110], calm: 2.2,
    ring: 0.46,
    // The most vocal thing in this sky by a distance. A bee-eater in flight
    // calls almost continuously, so the gap between calls is the shortest here.
    call: [4, 9],
    rafts: 0,
    // Open country: over the karst and the scrub, not out over the channel and
    // not down among the roofs of the old town, which are the swift's.
    where: (x, z) => !isSea(x, z) && urbanAt(x, z) < 0.6,
  },
];

/**
 * A wingbeat is not a sine. The downstroke is the work and the upstroke is a
 * recovery, so the waveform is skewed: the bird spends longer coming up than it
 * does going down, and the flick at the bottom is what the eye actually reads.
 */
const beatShape = (ph) => Math.sin(ph) - 0.26 * Math.sin(ph * 2);

/** The yaw that flies you along (dx, dz), in the flight model's convention. */
const headingTo = (dx, dz) => Math.atan2(-dx, -dz);

/**
 * The body: a six-sided spindle with a head bump and a tail fan, one unit long,
 * so the per-instance scale is simply the bird's length. Vertex colour darkens
 * the back and leaves the belly pale, which is the only marking visible from
 * underneath and therefore the only one worth having.
 */
function birdBodyProto() {
  const b = propBuilder();
  const N = 6;
  //          z     radius
  const S = [
    [-0.50, 0.015], [-0.43, 0.070], [-0.34, 0.082], [-0.24, 0.068],
    [-0.04, 0.145], [0.20, 0.115], [0.40, 0.050], [0.50, 0.012],
  ];
  const P = (s, i) => {
    const a = (i / N) * TAU + Math.PI / N;
    return [Math.cos(a) * S[s][1], Math.sin(a) * S[s][1] * 0.85, S[s][0]];
  };
  // One colour per longitudinal strip: 1 underneath, 0 along the spine.
  const strip = (i) => {
    const a = ((i + 0.5) / N) * TAU + Math.PI / N;
    const t = sat(0.5 - Math.sin(a) * 0.8);
    return [lerp(0.40, 1.0, t), lerp(0.42, 1.0, t), lerp(0.46, 1.0, t)];
  };
  for (let s = 0; s < S.length - 1; s++) {
    for (let i = 0; i < N; i++) {
      b.quad(P(s, i), P(s, i + 1), P(s + 1, i + 1), P(s + 1, i), strip(i));
    }
  }
  // The tail, flat and spread. A gull fans it and a swift forks it; at the size
  // these are seen, one triangle is both.
  b.tri([0, 0, 0.28], [-0.11, 0.004, 0.60], [0.11, 0.004, 0.60], [0.52, 0.53, 0.55]);
  return b.geo();
}

/**
 * One wing, root at the origin, tip at x = 1, chord along Z with the leading
 * edge forward. A flat plate: the hinge supplies the dihedral and the camber
 * would be mirrored the wrong way on the left wing anyway (see the pairing in
 * update() — the left wing is the right one turned through π about the fore-aft
 * axis, which is free, and only a flat plate survives it unnoticed).
 *
 * The last column is how black the feathers are. A yellow-legged gull's hand is
 * jet, and that dark tip on a white wing is the single most recognisable thing
 * about it from a distance.
 */
function birdWingProto() {
  const b = propBuilder();
  //      x      LE z    TE z   black
  const W = [
    [0.00, -0.10, 0.18, 0.00],
    [0.32, -0.15, 0.13, 0.02],
    [0.60, -0.13, 0.06, 0.10],
    [0.80, -0.07, 0.01, 0.42],
    [0.93, 0.01, -0.02, 0.80],
    [1.00, 0.10, 0.07, 1.00],
  ];
  for (let i = 0; i < W.length - 1; i++) {
    const a = W[i], c = W[i + 1];
    const k = 1 - 0.84 * (a[3] + c[3]) * 0.5;
    b.quad([a[0], 0, a[1]], [a[0], 0, a[2]], [c[0], 0, c[2]], [c[0], 0, c[1]],
      [k, k, k * 1.02]);
  }
  return b.geo();
}

function buildBirds(scene, fire) {
  const rnd = mulberry32(CONFIG.seed ^ 0x0b19d5);
  const bodyL = propLayer(scene, birdBodyProto(),
    FLOCK.reduce((a, s) => a + s.n, 0), { spec: 0.05, specPower: 14 });
  const wingL = propLayer(scene, birdWingProto(),
    FLOCK.reduce((a, s) => a + s.n, 0) * 2, { spec: 0.05, specPower: 14 });

  const _e = new THREE.Euler();
  const _qb = new THREE.Quaternion();
  const _qw = new THREE.Quaternion();
  const _qh = new THREE.Quaternion();
  const _qt = new THREE.Quaternion();
  const _v = new THREE.Vector3();
  const _zA = new THREE.Vector3(0, 0, 1);
  const _xA = new THREE.Vector3(1, 0, 0);
  const camPos = new THREE.Vector3();
  const camRight = new THREE.Vector3(1, 0, 0);

  const put = (L, i, x, y, z, q, sx, sy, sz, col, tint) => {
    L.aPos.array[i * 3] = x; L.aPos.array[i * 3 + 1] = y; L.aPos.array[i * 3 + 2] = z;
    L.aRot.array[i * 4] = q.x; L.aRot.array[i * 4 + 1] = q.y;
    L.aRot.array[i * 4 + 2] = q.z; L.aRot.array[i * 4 + 3] = q.w;
    L.aScale.array[i * 3] = sx; L.aScale.array[i * 3 + 1] = sy;
    L.aScale.array[i * 3 + 2] = sz;
    L.aColor.array[i * 3] = col[0] * tint;
    L.aColor.array[i * 3 + 1] = col[1] * tint;
    L.aColor.array[i * 3 + 2] = col[2] * tint;
  };

  const flock = [];
  for (let si = 0; si < FLOCK.length; si++) {
    for (let i = 0; i < FLOCK[si].n; i++) {
      flock.push({
        sp: si, live: true, placed: false, wait: 0,
        x: 0, y: 0, z: 0, yaw: rnd() * TAU, pitch: 0, roll: 0,
        spd: FLOCK[si].cruise, alt: 0, sit: false,
        // Individual size and tint. Fourteen identical gulls in a row is a
        // texture; the same fourteen with a tenth either way is a flock.
        s: 0.86 + rnd() * 0.30, tint: 0.88 + rnd() * 0.22,
        ph: rnd() * TAU, flap: 0, on: false, duty: rnd() * 2,
        base: rnd() * TAU, wp: rnd() * TAU, wr: 0.7 + rnd() * 0.6,
        alarm: 0, callT: rnd() * 20, mute: 0,
      });
    }
  }

  let density = 1, tAcc = 0, live = 0, calls = 0, callBudget = 3;

  function setLive() {
    let i = 0;
    for (let si = 0; si < FLOCK.length; si++) {
      const keep = Math.round(FLOCK[si].n * sat(density));
      for (let k = 0; k < FLOCK[si].n; k++) flock[i++].live = k < keep;
    }
  }

  // ── where a bird would actually be ─────────────────────────────────────────

  /**
   * Drop a bird somewhere near the camera that its species would tolerate. Eight
   * darts and then give up for a second or two — over the open karst there is no
   * sea within a kilometre and the gulls simply have nowhere to go, which is the
   * correct answer rather than a failure.
   */
  function rehome(b) {
    const sp = FLOCK[b.sp];
    for (let k = 0; k < 8; k++) {
      const a = rnd() * TAU;
      const r = BIRDS.radius * sp.ring * (0.45 + rnd() * 0.5);
      const x = camPos.x + Math.cos(a) * r, z = camPos.z + Math.sin(a) * r;
      if (Math.abs(x) > HALF - 60 || Math.abs(z) > HALF - 60) continue;
      if (!sp.where(x, z)) continue;
      // Nothing puts down over a cell that is alight, and nothing is respawned
      // into one either — the fleeing is meant to be seen, not faked.
      if (fire && fire.intensityAt(x, z) > 0.04) continue;

      const sea = isSea(x, z);
      const surf = sea ? 0 : groundAt(x, z);
      b.x = x; b.z = z;
      b.alt = sp.band[0] + rnd() * (sp.band[1] - sp.band[0]);
      b.sit = sea && rnd() < sp.rafts;
      b.y = b.sit ? 0 : surf + b.alt;
      b.yaw = rnd() * TAU;
      b.base = b.yaw;
      b.spd = b.sit ? 0 : sp.cruise;
      b.alarm = 0;
      b.wait = 0;
      b.placed = true;
      return true;
    }
    b.wait = 1.5 + rnd() * 2.5;
    b.placed = false;
    return false;
  }

  // ── calling ────────────────────────────────────────────────────────────────

  /**
   * One call, if there is anyone near enough to hear it. Panned by where the
   * bird actually is, and rate-limited twice over: a bird that has just shouted
   * shuts up for a few seconds, and no more than a couple of calls a second get
   * out at all. Twenty gulls all deciding at once is one gull played twenty
   * times, and it sounds exactly like that.
   */
  function cry(b, alarm) {
    if (!audio || state.phase === 'intro' || callBudget < 1 || b.mute > 0) return;
    const dx = b.x - camPos.x, dy = b.y - camPos.y, dz = b.z - camPos.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > BIRDS.callDist) return;
    callBudget -= 1;
    b.mute = 2.5 + rnd() * 2.5;
    calls++;
    const near = 1 - d / BIRDS.callDist;
    const pan = (dx * camRight.x + dy * camRight.y + dz * camRight.z) / Math.max(d, 1);
    audio.birdCall(FLOCK[b.sp].key, clamp(pan, -1, 1),
      near * near * (alarm ? 1 : 0.7), alarm);
  }

  // ── one bird ───────────────────────────────────────────────────────────────

  function step(b, dt, flushers, nFlush) {
    const sp = FLOCK[b.sp];
    const sea = isSea(b.x, b.z);
    const surf = sea ? 0 : groundAt(b.x, b.z);
    const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);

    // Where it is, and where it will be in ten seconds. Sampling only the cell
    // underneath is already too late by the time the answer comes back hot.
    let heat = 0, hx = b.x, hz = b.z;
    if (fire) {
      heat = fire.intensityAt(b.x, b.z);
      const ax = b.x + fx * 120, az = b.z + fz * 120;
      const ahead = fire.intensityAt(ax, az);
      if (ahead > heat) { heat = ahead; hx = ax; hz = az; }
    }

    // The aeroplanes. A parked or taxiing Canadair puts nothing up — it is the
    // noise and the closing speed that does it, not the shape.
    //
    // All four of them count, not just yours. A wingman coming off a scooping
    // run puts the channel up exactly as you do, and seeing that happen to
    // somebody else's aeroplane is what stops the reaction reading as a trick
    // the world does for the player. The *strongest* threat wins rather than
    // the nearest, because that is the one worth turning away from, and its
    // bearing is what the flee heading below is taken from.
    let px = 0, pz = 0, pd = Infinity, roar = 0, worst = 0;
    for (let i = 0; i < nFlush; i++) {
      const f = flushers[i];
      const ax = b.x - f.pos.x, ay = b.y - f.pos.y, az = b.z - f.pos.z;
      const d = Math.hypot(ax, ay, az);
      if (d >= BIRDS.flush) continue;
      const a = f.roar * (1 - d / BIRDS.flush);
      if (a <= worst) continue;
      worst = a; px = ax; pz = az; pd = d; roar = f.roar;
    }
    const was = b.alarm;
    if (worst > 0) b.alarm = Math.max(b.alarm, worst);
    if (heat > 0.03) b.alarm = Math.max(b.alarm, sat(heat * 2.5));
    // Whatever it was, it says so once, on the way up.
    if (was < 0.25 && b.alarm >= 0.25) cry(b, true);
    if (b.alarm > 0) b.alarm = Math.max(0, b.alarm - dt / sp.calm);
    if (b.mute > 0) b.mute -= dt;

    if (b.sit) {
      // Rafted on the swell, in the same fiction the boats use: sea level is
      // zero here, so a gull sits on it and rocks.
      b.y = Math.sin(tAcc * 0.9 + b.wp) * 0.13;
      b.yaw += Math.sin(tAcc * 0.21 + b.wp) * dt * 0.3;
      b.roll = Math.sin(tAcc * 0.7 + b.wp) * 0.05;
      b.pitch = 0;
      b.flap = damp(b.flap, 0, 8, dt);
      // Up they go, shouting. This is the moment the sea stops being scenery.
      if (b.alarm > 0.10 || heat > 0.02) {
        b.sit = false;
        b.spd = sp.cruise * 0.6;
        b.on = true; b.duty = 2.5;
        cry(b, true);
      }
      return;
    }

    // ── steering ─────────────────────────────────────────────────────────────
    // The wander is a slow sine on the heading, which for a gull is a wheel and
    // for a swift is a jink; alarm overrides it with somewhere to actually be.
    let want = b.base + Math.sin(tAcc * sp.wheelRate * TAU * b.wr + b.wp) * sp.wheel;
    // The height it is trying to hold, wandering slowly. A gull on a thermal off
    // the karst gains and loses a third of its altitude without doing anything
    // about it, and a bird pinned to one contour looks like it is on a wire.
    let climb = (surf + b.alt * (1 + 0.35 * Math.sin(tAcc * 0.09 + b.wp)) - b.y) * 0.35;
    if (heat > 0.03) {
      want = headingTo(b.x - hx, b.z - hz);
      climb = Math.max(climb, 3.5);
    }
    if (roar > 0.05 && pd < BIRDS.flush && pd > 1) {
      want = headingTo(px, pz);
      climb = Math.max(climb, sp.climb * 2.2);
    }

    const rate = sp.turn * (1 + b.alarm * 1.8);
    const dyaw = clamp(angleDelta(b.yaw, want), -rate * dt, rate * dt);
    b.yaw += dyaw;
    b.base += dyaw * 0.25;              // the wander follows, slowly, rather than snapping back
    // Birds bank *into* a turn, and a gull banks a great deal: the bank is how
    // it turns, not decoration on top of the turn. Increasing yaw swings the
    // nose to port and positive roll lifts the starboard wing, so the two have
    // the same sign.
    b.roll = damp(b.roll, clamp(dyaw / Math.max(dt, 1e-3) * sp.bank, -1.2, 1.2), 5, dt);

    const vs = clamp(climb, -sp.climb, sp.climb * (1 + b.alarm * 1.5));
    b.spd = damp(b.spd, lerp(sp.cruise, sp.flee, b.alarm), 1.6, dt);
    // After the turn, not before it: a swift at 2.4 rad/s covers a noticeable
    // arc in a frame and flying the old heading shows as a stutter.
    b.x += -Math.sin(b.yaw) * b.spd * dt;
    b.z += -Math.cos(b.yaw) * b.spd * dt;
    b.y = clamp(b.y + vs * dt, surf + 1.5, surf + sp.band[1] * 1.6);
    b.pitch = damp(b.pitch, clamp(vs / Math.max(b.spd, 2), -0.45, 0.45), 5, dt);

    // ── the beat ─────────────────────────────────────────────────────────────
    // Bursts, not a duty cycle you could set a watch by: a swift beats for half
    // a second and glides for one, and never the same half-second twice.
    b.duty -= dt;
    if (b.duty <= 0) {
      b.on = !b.on;
      b.duty = (b.on ? sp.burst : sp.glide) * (0.55 + rnd() * 0.9);
    }
    b.flap = damp(b.flap, (b.on || b.alarm > 0.15) ? 1 : 0, 7, dt);
    b.ph += sp.beat * TAU * dt * (1 + b.alarm * 0.45);

    b.callT -= dt;
    if (b.callT <= 0) {
      b.callT = sp.call[0] + rnd() * sp.call[1];
      cry(b, false);
    }
  }

  // ── the frame ──────────────────────────────────────────────────────────────

  // Reused between frames: one entry per aeroplane loud enough to matter, so
  // the per-frame cost of caring about four of them instead of one is nothing.
  const flushers = [];

  function update(dt, camera, aircraft) {
    if (density <= 0.001) {
      bodyL.geo.instanceCount = 0;
      wingL.geo.instanceCount = 0;
      live = 0;
      return;
    }
    tAcc += dt;
    callBudget = Math.min(3, callBudget + dt * 1.6);
    camPos.copy(camera.position);
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    // How alarming each aeroplane currently is. Below about 90 km/h it is taxiing
    // and the gulls on the apron at Rokići are famously unimpressed.
    let nFlush = 0;
    for (const a of aircraft) {
      const r = sat((a.speed - 25) / 45);
      if (r <= 0.05) continue;
      const f = flushers[nFlush] || (flushers[nFlush] = { pos: null, roar: 0 });
      f.pos = a.pos;
      f.roar = r;
      nFlush++;
    }

    let nb = 0, nw = 0, moved = 0;
    for (const b of flock) {
      if (!b.live) continue;
      const R = BIRDS.radius * FLOCK[b.sp].ring;
      const dx = b.x - camPos.x, dz = b.z - camPos.z;
      if (!b.placed || dx * dx + dz * dz > R * R) {
        b.wait -= dt;
        if (b.wait > 0 || moved >= BIRDS.rehome) continue;
        moved++;
        if (!rehome(b)) continue;
      }
      step(b, dt, flushers, nFlush);

      const sp = FLOCK[b.sp];
      const len = sp.len * b.s;
      _e.set(b.pitch, b.yaw, b.roll, 'YXZ');
      _qb.setFromEuler(_e);
      put(bodyL, nb++, b.x, b.y, b.z, _qb,
        len * sp.girth, len * sp.girth, len, sp.body, b.tint);

      // A sitting bird has its wings folded, which with one hinge means short
      // and drooped. It is a cheat and it reads perfectly at fifty metres.
      const amp = sp.amp * b.flap;
      const fold = b.sit ? 0.32 : 1;
      const hinge = b.sit ? -0.12 : sp.dihedral + amp * beatShape(b.ph);
      // Feathering: the wing twists against the stroke, which is what turns a
      // flapping board into something that is actually holding the bird up.
      const twist = -0.42 * amp * Math.cos(b.ph);
      const semi = sp.span * 0.5 * b.s * fold;
      _v.set(0, len * 0.10, -len * 0.05).applyQuaternion(_qb);
      for (const side of [1, -1]) {
        // The left wing is the right one turned through π about the fore-aft
        // axis: Rz(π - hinge) takes the prototype's +X tip out to port with the
        // same dihedral, for the cost of one quaternion and no second geometry.
        _qh.setFromAxisAngle(_zA, side > 0 ? hinge : Math.PI - hinge);
        _qt.setFromAxisAngle(_xA, side * twist);
        _qw.copy(_qb).multiply(_qh).multiply(_qt);
        put(wingL, nw++, b.x + _v.x, b.y + _v.y, b.z + _v.z, _qw,
          semi, 1, semi * sp.chord, sp.wing, b.tint);
      }
    }

    live = nb;
    bodyL.geo.instanceCount = nb;
    wingL.geo.instanceCount = nw;
    for (const L of [bodyL, wingL]) {
      L.aPos.needsUpdate = true;
      L.aRot.needsUpdate = true;
      L.aScale.needsUpdate = true;
      L.aColor.needsUpdate = true;
    }
  }

  return {
    update,
    getDensity: () => density,
    setDensity(v) { density = sat(v); setLive(); },
    // `alarmed` is the only way from outside to tell a flock that is reacting
    // from one that is merely being drawn, which is the whole claim this module
    // makes and so the one thing a test has to be able to check.
    stats: () => ({
      live, calls, of: flock.length,
      alarmed: flock.reduce((n, b) => n + (b.live && b.alarm > 0.05 ? 1 : 0), 0),
      sitting: flock.reduce((n, b) => n + (b.live && b.sit ? 1 : 0), 0),
    }),
  };
}
