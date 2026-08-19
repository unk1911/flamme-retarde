// -----------------------------------------------------------------------------
// The water.
//
// A canopy that put you in the sea used to end the run, and the note that did
// it said exactly why it should not have: you are in a lifejacket four hundred
// metres off a beach, in the August Adriatic, with three other aircraft and a
// lookout who all watched you go. Nothing about that is dying. It is a swim.
//
// So this is the swim, and it is its own place rather than a variation on being
// on foot. The walking model in 47-ground.js lives in a locale's (t, s) frame —
// the aerodrome, the resort, the town — because everything it has to answer
// about is inside one of them: which storey, which blocker, which hut. Out here
// there is no locale and there are no walls. There is a surface at zero that
// moves, a seabed that comes up out of the height map, and a shoreline you can
// see from the water, which is the one thing you can never see from the land.
//
// Three things it has to get right, and they are all about the waterline.
//
// The first is that the waterline is a *place*. Your eyes sit eleven
// centimetres over it and the chop is a third of a metre, so the horizon comes
// and goes: half the time you are looking at the far islands and half the time
// you are looking at the back of the next wave. That is what being in the sea
// looks like and it is free — it falls out of riding the same Gerstner sum the
// sea shader displaces its lattice with, on the CPU, at one point.
//
// The second is that going under is a different world and not a filter. Down
// there the light comes from one direction, the far islands are gone, and the
// surface is a bright ceiling with the sun smeared across it. The cheap half of
// that is the tint; the half that actually sells it is that the sea mesh has to
// be drawn from both sides, because from underneath a single-sided sea is a
// hole with the sky through it.
//
// The third is breath, which is the only clock out here. Twenty-two seconds is
// a fit person who is not panicking, and running it out does not kill you — it
// takes the controls off you and floats you up, which is what a lifejacket is
// for and is a great deal more frightening than a number going red.
// -----------------------------------------------------------------------------

const SWIM = {
  eye: 0.11,           // eyes over the waterline, treading it
  under: 0.03,         // and how far under the surface before the world changes

  cruise: 1.15,        // m/s — a steady crawl in a jacket, which is slow
  sprint: 2.00,
  accel: 2.4,
  drag: 1.7,

  // Buoyancy. A jacket is not neutral and is not meant to be: let go of
  // everything and it takes you up at over a metre a second and holds you
  // there. Diving is swimming *against* that, which is why you cannot go deep
  // and why coming up is never the problem.
  rise: 1.30,
  dive: 1.60,

  // And what a deliberate kick down is worth, which is emphatically not the
  // same number.
  //
  // It used to be the dive figure for both, and that made holding the down key
  // an argument the key lost. The jacket's lift saturates at 1.30 m/s, the
  // kick was worth 1.36, and the difference between them is six centimetres a
  // second — so you sank to about three metres over ten seconds and then, to
  // anyone actually playing, simply stopped, hung there, and got floated back
  // up when the breath ran out. Every part of that was working as written and
  // the writing was wrong: a person kicking down beats a buoyancy aid, that is
  // what kicking is for, and the thing that should stop you is the bottom or
  // your own lungs and never a stalemate you cannot see.
  //
  // 2.55 against a lift of 1.30 is a net 1.25 m/s down and it stays 1.25 m/s
  // down for as long as you hold it.
  kick: 2.55,

  // How far down it is allowed to go at all. Not a physical limit — the bed
  // stops you long before this nearly everywhere — but the channel proper is
  // forty metres in places and a cap of 24 was a lid you could feel.
  maxDepth: 38,

  breath: 22,          // s under water before the jacket wins
  recover: 7,          // s on the surface to get all of it back

  // Where the bed is close enough to stand on. A metre and a bit: chest deep,
  // which is where anybody stops swimming and starts walking whether they
  // meant to or not.
  wade: 1.15,
  // And how close to the bed you may get before it stops you. 45 cm was less
  // than the world's own near plane, which is the whole of "I can see through
  // the seabed": look down from there and every triangle of bottom is inside
  // the front clip and thrown away, leaving you staring at the far side of
  // nothing. The near plane comes in underwater now — see `clearance` — and
  // this went up as well, because a face 45 cm off the sand has most of a
  // swimmer already buried in it.
  bedClear: 0.80,

  // The stroke. One cycle is a reach, a pull and a glide, and what you see of
  // it is the roll and the rise — the head goes up on the catch and down on
  // the glide, and the horizon tips with the shoulder that is under.
  strokeHz: 0.62,
  strokeRise: 0.055,
  strokeRoll: 0.045,
};

// SEA_VERT's `gerstner`, on the CPU and to the same numbers — which is now a
// harder promise to keep than it was, and worth keeping.
//
// It used to be four sines and height only, because the lattice was displaced
// in y alone: ask for the height at (x, z) and you got it. The surface is a
// real Gerstner sum now, so the vertex that ends up over (x, z) started
// somewhere else, and "the height at (x, z)" is the solution of an equation
// rather than a sum. Two fixed-point steps solve it to well inside a
// centimetre at these steepnesses — walk back along the horizontal
// displacement, sample again, repeat — and a centimetre is a tenth of what the
// eye sits above the waterline, so nobody is going to ride the wrong sea.
const SWIM_LEN = [78.0, 46.0, 27.0, 15.0, 8.5, 4.6];
const SWIM_AMP = [0.78, 1.0, 0.60, 0.34, 0.19, 0.105];
const SWIM_Q = [0.35, 0.55, 0.72, 0.85, 0.90, 0.90];
const SWIM_SPREAD = [0.10, 0.0, 0.42, -0.58, 0.86, null];

/** The six directions, rebuilt from the wind. Shared by both passes below. */
function seaDirs() {
  const w = U.uWind.value;
  const L = Math.hypot(w.x, w.y) || 1;
  const wx = w.x / L, wy = w.y / L;
  const px = -wy, py = wx;                       // the across-wind unit
  const out = [];
  for (let i = 0; i < 6; i++) {
    let dx, dy;
    if (SWIM_SPREAD[i] === null) { dx = px + wx * 0.25; dy = py + wy * 0.25; }
    else { dx = wx + px * SWIM_SPREAD[i]; dy = wy + py * SWIM_SPREAD[i]; }
    const l = Math.hypot(dx, dy) || 1;
    out.push([dx / l, dy / l]);
  }
  return out;
}

/**
 * The sea surface at a world point, in metres about zero.
 *
 * Called two or three times a frame — once for where your head is, once for
 * where you are about to put it — so it re-derives the wind basis every call
 * rather than caching a state that would then have to be invalidated when the
 * gust changes. Eighteen sines is not worth a cache either.
 */
function seaHeightAt(x, z) {
  const dirs = seaDirs();
  const amp = 0.34 * SEA.waveScale * (0.45 + 0.055 * U.uWindSpeed.value);
  const t = U.uTime.value;
  // Invert the horizontal map: find the undisplaced point whose displacement
  // lands on (x, z), then take that point's height.
  let ux = x, uz = z;
  for (let it = 0; it < 2; it++) {
    let dx = 0, dz = 0;
    for (let i = 0; i < 6; i++) {
      const d = dirs[i];
      const k = (Math.PI * 2) / SWIM_LEN[i];
      const c = Math.sqrt(9.81 / k);
      const a = amp * SWIM_AMP[i];
      const q = Math.min(SWIM_Q[i], 0.92 / Math.max(k * a, 1e-4));
      const cs = Math.cos((d[0] * ux + d[1] * uz) * k + t * c * k * 0.42);
      dx += d[0] * q * a * cs;
      dz += d[1] * q * a * cs;
    }
    ux = x - dx; uz = z - dz;
  }
  let h = 0;
  for (let i = 0; i < 6; i++) {
    const d = dirs[i];
    const k = (Math.PI * 2) / SWIM_LEN[i];
    const c = Math.sqrt(9.81 / k);
    const a = amp * SWIM_AMP[i];
    h += a * Math.sin((d[0] * ux + d[1] * uz) * k + t * c * k * 0.42);
  }
  return h;
}

/**
 * In the water.
 *
 * `sea` is the sea object from 25-sea.js — this mode is the only thing in the
 * game that ever looks at the underside of it, and turning that on and off is
 * the whole of what it wants from it.
 */
function buildSwim(sea) {
  const you = {
    x: 0, y: 0, z: 0,
    yaw: 0, pitch: 0,
    vx: 0, vy: 0, vz: 0,
    // Depth is carried rather than derived, because the surface moves: y minus
    // the wave height at your own position is a number that jitters by a third
    // of a metre with the chop, and every threshold in here would chatter on it.
    depth: 0,
    breath: 1,
    stroke: 0,
    spent: false,      // out of air: the jacket has the controls until you surface
  };
  let active = false;
  let deepest = 0;
  let sinceIn = 0;
  let auto = false;
  let apNote = '';
  let apAim = 0;              // the heading the autopilot has settled on
  let apT = 0;                // and how long since it last went looking

  const bedAt = (x, z) => Math.min(groundAt(x, z), -0.6);

  /** Drop into the water at a world point, facing a heading. */
  function enter(x, z, yaw, hard = 0) {
    active = true;
    you.x = x; you.z = z;
    you.yaw = yaw;
    you.pitch = -0.04;
    you.depth = Math.min(1.6, 0.45 + hard * 0.12);   // you go under, briefly
    you.y = seaHeightAt(x, z) - you.depth;
    you.vx = 0; you.vy = 0; you.vz = 0;
    you.breath = 1;
    you.spent = false;
    you.stroke = 0;
    deepest = you.depth;
    sinceIn = 0;
    auto = false; apNote = '';
    if (sea) sea.mat.side = THREE.DoubleSide;
    return true;
  }

  function leave() {
    active = false;
    auto = false; apNote = '';
    if (sea) sea.mat.side = THREE.FrontSide;
  }

  function look(dx, dy) {
    you.yaw -= dx;
    // Less than on foot. Under water you are looking through a mask at a body
    // that is lying down, and straight up is a real direction you want — the
    // surface is up there and it is the way out.
    you.pitch = clamp(you.pitch - dy, -1.45, 1.45);
  }


  /**
   * The autopilot, which does the one thing there is to do in the water.
   *
   * In the aeroplane the autopilot has a job list — a tank to fill, a fire to
   * drop on, a runway to find — and picking which one is most of the code. In
   * the sea there is exactly one job and it is get out of the sea, so this is
   * the whole of it: face the nearest shore, swim at it, and give the controls
   * back the moment you can stand up.
   *
   * It steers down the shore distance field rather than at a point, because a
   * point is wrong twice over here. The channel bends, so the nearest land as
   * the crow flies is regularly across a headland you would have to swim
   * through; and `shoreAt` is the same field the fire and the crowd already
   * use, sampled on the same grid, so a heading that reduces it is a heading
   * that actually reaches water's edge. Sixteen of them, thirty metres out,
   * and the best one wins — which is gradient descent with enough of a look
   * ahead not to walk into the one shoal that happens to point the wrong way.
   *
   * Re-picked every second and not every frame. A field sampled off a 255-step
   * texture has steps in it, and a swimmer who re-solves on every frame sits on
   * a step boundary and shakes his head at it for as long as you leave him.
   */
  const AP_LOOK = 30;
  function apPick() {
    const here = shoreAt(you.x, you.z);
    let best = null, bestD = here;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const px = you.x - Math.sin(a) * AP_LOOK, pz = you.z - Math.cos(a) * AP_LOOK;
      // Straight through a headland is not a swim. The mid point is enough of
      // a check at thirty metres: a spit narrow enough to slip past both
      // samples is narrow enough to swim round without noticing.
      if (!isSea((you.x + px) * 0.5, (you.z + pz) * 0.5)) continue;
      const d = shoreAt(px, pz);
      if (d < bestD) { bestD = d; best = a; }
    }
    // Nothing improves: either you are already on the beach or the field has
    // saturated, which at 400 m means there is no shore in it to steer at.
    if (best === null) return here > 380 ? null : you.yaw;
    return best;
  }

  function toggleAuto() {
    if (!active) return false;
    auto = !auto;
    if (!auto) { apNote = ''; return false; }
    // Already standing on it. Engaging here would engage and disengage on the
    // same frame, and a light that blinks once is a control that looks broken.
    if (canWade()) { auto = false; apNote = 'there'; return false; }
    const a = apPick();
    if (a === null) { auto = false; apNote = 'far'; return false; }
    apAim = a; apT = 0; apNote = 'on';
    return true;
  }

  /**
   * What the autopilot is holding this frame, in place of your hands.
   *
   * It surfaces first. Everything below the waterline is on a clock — the
   * breath bar — and an autopilot that swam you to the beach two metres under
   * would be an autopilot that drowned you politely.
   */
  function apCtl(dt) {
    apT += dt;
    if (apT > 1.0) { apT = 0; const a = apPick(); if (a !== null) apAim = a; }
    // Head round to the heading, at about the rate a person in a jacket turns.
    let d = apAim - you.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    you.yaw += clamp(d, -1.3 * dt, 1.3 * dt);
    // And level the head, which is what makes it read as somebody else driving.
    you.pitch += clamp(-you.pitch, -1.1 * dt, 1.1 * dt);
    const deep = you.depth > 0.35;
    apNote = deep ? 'up' : 'on';
    return { fwd: deep ? 0.35 : 1, side: 0, sprint: false, down: false, up: deep };
  }

  /**
   * One frame in the water.
   *
   * `ctl` is { fwd, side, sprint, down, up } — the same shape the walking model
   * takes, plus the two vertical ones, because down here they are controls and
   * not a jump.
   */
  function update(dt, ctl) {
    if (!active) return;
    sinceIn += dt;
    // Out of air the jacket has the controls, and so does the autopilot: it is
    // already doing the only thing that helps, which is going up.
    if (auto) {
      ctl = apCtl(dt);
      if (canWade()) { auto = false; apNote = 'there'; }
    }
    const submerged = you.depth > SWIM.under;

    // ── breath ───────────────────────────────────────────────────────────────
    if (submerged) {
      you.breath = Math.max(0, you.breath - dt / SWIM.breath);
      if (you.breath <= 0) you.spent = true;
    } else {
      you.breath = Math.min(1, you.breath + dt / SWIM.recover);
      if (you.breath > 0.25) you.spent = false;
    }

    // ── along the surface, or through the water ──────────────────────────────
    // Swimming is aimed where you are looking, but only once you are under it.
    // On the surface your face is in the water and your body is flat on it: you
    // go where you point and pitch has nothing to do with it, which is also
    // what stops "looking at the sky while you swim" from lifting you out.
    const f = clamp(ctl.fwd || 0, -1, 1);
    const sd = clamp(ctl.side || 0, -1, 1);
    const drive = you.spent ? 0
      : (ctl.sprint ? SWIM.sprint : SWIM.cruise) * (f < 0 ? 0.55 : 1);
    const cp = submerged ? Math.cos(you.pitch) : 1;
    const fx = -Math.sin(you.yaw) * cp, fz = -Math.cos(you.yaw) * cp;
    const sx = Math.cos(you.yaw), sz = -Math.sin(you.yaw);
    let wx = fx * f + sx * sd, wz = fz * f + sz * sd;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const tx = wx * drive, tz = wz * drive;
    const k = 1 - Math.exp(-SWIM.accel * dt);
    you.vx += (tx - you.vx) * k;
    you.vz += (tz - you.vz) * k;
    you.vx -= you.vx * SWIM.drag * dt * 0.25;
    you.vz -= you.vz * SWIM.drag * dt * 0.25;

    // ── up and down ──────────────────────────────────────────────────────────
    // The jacket is always pulling. Duck-diving is holding the key *and*
    // pointing down when you are under — the pitch is where most of it comes
    // from, which is why looking at your own feet is how you get deep.
    let vy = SWIM.rise * (1 - Math.exp(-Math.max(0, you.depth) * 1.6));
    if (!you.spent) {
      const aim = submerged ? -Math.sin(you.pitch) * Math.max(0, f) : 0;
      // Held down is a flat kick and not a nudge against the lift — see the
      // note on `kick`. Pointing down still adds to it, so looking at your own
      // feet and swimming is still the fast way to the bottom.
      if (ctl.down) vy -= SWIM.kick;
      if (ctl.up) vy += SWIM.dive * 0.85 + SWIM.rise * 0.55;
      vy -= SWIM.dive * Math.max(0, -aim) * 0.9;
    }
    you.vy += (vy - you.vy) * (1 - Math.exp(-3.0 * dt));

    // ── move, and then find out where the surface is now ─────────────────────
    you.x += you.vx * dt;
    you.z += you.vz * dt;
    you.y += you.vy * dt;

    const surf = seaHeightAt(you.x, you.z);
    // The cap on the top is the surface, plus the eleven centimetres a head has
    // out of it. Without it the jacket serves you up into the air on every
    // crest; and because the cap is taken at your *own* position, you ride the
    // swell exactly rather than being washed over by it every second wave.
    if (you.y > surf + SWIM.eye) { you.y = surf + SWIM.eye; if (you.vy > 0) you.vy = 0; }
    const bed = bedAt(you.x, you.z);
    if (you.y < bed + SWIM.bedClear) {
      you.y = bed + SWIM.bedClear;
      if (you.vy < 0) you.vy = 0;
    }
    if (surf - you.y > SWIM.maxDepth) {
      you.y = surf - SWIM.maxDepth;
      if (you.vy < 0) you.vy = 0;
    }
    you.depth = surf - you.y;
    deepest = Math.max(deepest, you.depth);

    // The stroke only turns over while you are actually swimming.
    const moving = Math.hypot(you.vx, you.vz);
    you.stroke += dt * SWIM.strokeHz * Math.PI * 2
      * (0.35 + moving / SWIM.cruise * 0.65);
  }

  /**
   * Where the water is shallow enough to stand up in, if it is here.
   *
   * Chest deep on the bed under your own feet — not "near the shore", which is
   * a different question with a different answer off a cliff.
   */
  function canWade() {
    if (!active) return false;
    return -bedAt(you.x, you.z) <= SWIM.wade && you.depth < 1.6;
  }

  function pose(camera) {
    if (!active) return;
    camera.up.set(0, 1, 0);
    // The roll and the rise of one stroke, and both of them stop when you do.
    const sw = Math.min(1, Math.hypot(you.vx, you.vz) / SWIM.cruise);
    const lift = Math.sin(you.stroke) * SWIM.strokeRise * sw;
    const roll = Math.sin(you.stroke * 0.5) * SWIM.strokeRoll * sw;
    camera.position.set(you.x, you.y + lift, you.z);
    const cp = Math.cos(you.pitch);
    camera.lookAt(
      you.x - Math.sin(you.yaw) * cp,
      you.y + lift + Math.sin(you.pitch),
      you.z - Math.cos(you.yaw) * cp,
    );
    camera.rotateZ(roll);
  }

  return {
    you,
    get active() { return active; },
    /** True once your eyes are under, which is what the tint is hung off. */
    get submerged() { return active && you.depth > SWIM.under; },
    get depth() { return Math.max(0, you.depth); },
    /**
     * How far the eye is above the bed, in metres, or a big number when there
     * is no swimming going on. The near plane is hung off this: the bottom is
     * the only thing in the sea you can put your face against.
     */
    get clearance() { return active ? Math.max(0, you.y - bedAt(you.x, you.z)) : 99; },
    get breath() { return you.breath; },
    get spent() { return you.spent; },
    get auto() { return auto; },
    get apNote() { return apNote; },
    toggleAuto,
    enter, leave, look, update, pose, canWade,
    surfaceAt: seaHeightAt,
    stats: () => ({
      on: active ? 1 : 0,
      at: [Math.round(you.x), Math.round(you.z)],
      depth: +you.depth.toFixed(2),
      deepest: +deepest.toFixed(1),
      bed: +bedAt(you.x, you.z).toFixed(1),
      breath: +you.breath.toFixed(2),
      spent: you.spent ? 1 : 0,
      sp: +Math.hypot(you.vx, you.vz).toFixed(2),
      shore: Math.round(shoreAt(you.x, you.z)),
      wade: canWade() ? 1 : 0,
      auto: auto ? (apNote || 'on') : 'off',
      t: +sinceIn.toFixed(1),
    }),
  };
}
