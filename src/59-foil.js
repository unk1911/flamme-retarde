// -----------------------------------------------------------------------------
// The eFoil.
//
// The third thing you can be on this water, and the only one of the three that
// does not care what the wind is doing. A kite needs the lebić and a swim needs
// nothing but your own arms; this is a board with a lithium pack in it, a mast
// under it and a wing under that, and a trigger in your hand. It is what half
// the water off Jadrija is doing on a flat August afternoon when the kites are
// sitting on the beach waiting for the breeze.
//
// Everything about how it feels is one number crossing another, and it is
// worth writing the number down because it is the whole mode: **at about four
// and a half metres a second the wing starts to carry you, and by six and a
// half the hull is out of the water.** Below that you are ploughing — slow,
// wet, loud, and the board is shoving a wave in front of it. Above it the
// board leaves the surface, the wave stops, the noise stops, and you are
// travelling on eight hundred square centimetres of aluminium eighty
// centimetres down with nothing else touching anything. Nobody who has done it
// forgets the moment it happens, and the mode is built to put that moment
// under your thumb rather than to hand it to you.
//
// Three things it has to get right.
//
// The first is that height is a control and not a result. You trim the ride
// height with your own weight — forward and it comes down, back and it comes
// up — and the top of that range is where the front wing breaks the surface,
// ventilates, and drops you. So the fast way to ride one is high, and high is
// also the way to fall off it, and that tension is the whole skill. There is
// no version of this mode with a "height" that the simulation picks for you.
//
// The second is that it turns by leaning. A foil has no edge to dig in and no
// fin to bite: you bank it and the lift vector tilts, so all of the turn comes
// out of the roll. Which means the camera has to roll — properly, thirty
// degrees on a hard one — because that is the only thing on the screen telling
// you that you are turning at all when there is no wake, no spray and no board
// in the picture.
//
// And the third is the mast. When you are up, the single thing in the world
// that is still touching the water is a fin the width of your hand, and the
// thin line of white it leaves behind it is the only mark on the sea. Take it
// out and flying reads as the camera being lifted; put it in and it reads as
// you being carried.
// -----------------------------------------------------------------------------

const FOIL = {
  eye: 1.56,             // m — standing on the board, eyes above the deck
  deck: 0.06,            // and the deck above the water, floating

  // Speed. A production eFoil does about 45 km/h flat out and a good one will
  // cruise all day at 30; 12.5 m/s is 45, which is fast enough that the
  // hundred and eighty metres across this channel goes by in fifteen seconds.
  top: 12.5,
  accel: 1.15,           // how fast the motor gets you there — it is not a jet
  drag: 1.35,            // and how fast you fall off it with the trigger shut
  // Down at displacement speed the hull is dragging a wave and everything is
  // harder, which is why the first two seconds of every ride are the slow ones.
  plough: 0.62,

  // The two numbers the whole mode is built round: where the wing starts to
  // carry and where it has all of you.
  fly: 4.6,
  glide: 6.6,

  // Ride height, in metres of mast out of the water, and how fast your own
  // weight moves it. `breach` is where the front wing comes near enough to the
  // surface to suck air down its low-pressure side, at which point it stops
  // being a wing — which is the fall you get on one of these and is not a
  // crash, it is a wet surprise.
  high: 0.86,
  rate: 0.62,
  breach: 0.79,
  breachOdds: 1.4,       // a second, once you are up there
  recover: 1.6,          // s of ploughing before it will fly again

  // Turning. Slow it spins, fast it carves, and every bit of it comes out of
  // the bank.
  turn: 1.35,
  turnFast: 0.58,
  bank: 0.52,            // rad at full lock and full speed
  bankRate: 2.6,

  mast: 0.80,            // how far the wing is below the board
  minDepth: 1.65,        // and how much water it needs under it
  chop: 0.05,            // m of the hull knocking about, before it flies
  wake: 9.0,             // m of it behind you at displacement speed
};

/**
 * A board with a motor in it.
 *
 * Same shape of object as the kite in 59-ride.js — `enter`, `leave`, `look`,
 * `update`, `pose`, `draw` — because the app drives all three water modes
 * through the same five verbs and a fourth one would be a fourth set of ways
 * for them to disagree.
 */
function buildFoil(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ── the hardware ─────────────────────────────────────────────────────────
  // A board, a mast, a front wing and a stabiliser, and they are built here
  // rather than pulled off the kite rig because an eFoil board is nothing like
  // a twin-tip: it is short, fat, thick and blunt, because it has eight kilos
  // of battery in it.
  const boardGeo = (() => {
    const rings = [];
    const L = 1.62, W = 0.71, T = 0.145;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const z = (t - 0.5) * L;
      // Full and square through the middle where the pack lives, and drawn out
      // to a point at the nose. The tail is cut off square, which is what a
      // foil board's tail is.
      const w = W * 0.5 * Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, t - 0.30) / 0.70, 3.2)), 0.6);
      const th = T * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.25)));
      const rock = Math.pow(Math.max(0, t - 0.55) / 0.45, 2) * 0.10;
      rings.push([
        new THREE.Vector3(-w, rock, z), new THREE.Vector3(-w, rock + th, z),
        new THREE.Vector3(w, rock + th, z), new THREE.Vector3(w, rock, z),
      ]);
    }
    return loft(rings, { closed: true, caps: true });
  })();

  /** A wing: a flat plate with a rounded leading edge, swept back at the tips. */
  const wingGeo = (span, chord, sweep, thick) => {
    const rings = [];
    for (let i = 0; i <= 10; i++) {
      const u = (i / 10 - 0.5) * 2;               // -1 at one tip, +1 at the other
      const x = u * span * 0.5;
      const c = chord * (1 - 0.55 * u * u);       // elliptical in plan
      const zc = Math.abs(u) * sweep;
      const th = thick * (1 - 0.7 * u * u) * 0.5;
      const dih = Math.abs(u) * span * 0.06;      // a little anhedral, tips down
      rings.push([
        new THREE.Vector3(x, -dih - th, zc - c * 0.5),
        new THREE.Vector3(x, -dih + th, zc - c * 0.5),
        new THREE.Vector3(x, -dih + th * 0.25, zc + c * 0.5),
        new THREE.Vector3(x, -dih - th * 0.25, zc + c * 0.5),
      ]);
    }
    return loft(rings, { closed: true, caps: true });
  };

  // Two materials on the board and not one. The first pass had the whole hull
  // at deck-pad black, which from eight metres away is a shadow on the water
  // rather than a board: a real one is a pale moulded shell with a dark
  // traction pad on the top of it, and the pale is what you see.
  const hullMat = solidMaterial(new THREE.Color(0.845, 0.855, 0.860),
    { spec: 0.46, specPower: 62, vcol: false });
  const padMat = solidMaterial(new THREE.Color(0.125, 0.132, 0.140),
    { spec: 0.16, specPower: 22, vcol: false });
  const alloyMat = solidMaterial(new THREE.Color(0.176, 0.190, 0.205),
    { spec: 0.52, specPower: 70, vcol: false });

  const board = new THREE.Mesh(boardGeo, hullMat);
  // The pad: the back two thirds of the deck, which is where you stand and is
  // the only part of one of these that is ever dark.
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.012, 0.96), padMat);
  const mast = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, FOIL.mast, 0.115), alloyMat);
  const fuse = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.038, 0.98), alloyMat);
  const wingF = new THREE.Mesh(wingGeo(1.06, 0.235, 0.055, 0.030), alloyMat);
  const wingR = new THREE.Mesh(wingGeo(0.42, 0.110, 0.020, 0.016), alloyMat);
  const rig = new THREE.Group();
  rig.add(board, pad, mast, fuse, wingF, wingR);
  group.add(rig);
  // Where each piece sits relative to the board's own centre, which is the one
  // place these numbers belong.
  board.position.set(0, 0, 0);
  pad.position.set(0, 0.146, 0.20);
  mast.position.set(0, -FOIL.mast * 0.5, 0.10);
  fuse.position.set(0, -FOIL.mast - 0.015, 0.10);
  wingF.position.set(0, -FOIL.mast - 0.015, -0.30);
  wingR.position.set(0, -FOIL.mast - 0.012, 0.55);

  // ── the water it disturbs ────────────────────────────────────────────────
  // Two marks, and which one you are leaving is the whole of what "flying"
  // looks like from the outside: a fat white wake while the hull is in, and
  // then nothing at all except the hairline the mast cuts.
  const foam = (w, h, a0) => {
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 96;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 96);
    grd.addColorStop(0, `rgba(255,255,255,${a0})`);
    grd.addColorStop(0.35, `rgba(255,255,255,${a0 * 0.42})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    for (let y = 0; y < 96; y++) {
      const ww = 5 + y * 0.26;
      g.fillRect(16 - ww / 2, y, ww, 1);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true,
        depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.set(-Math.PI / 2, 0, 0);
    m.renderOrder = 3;
    m.frustumCulled = false;
    group.add(m);
    return m;
  };
  const wake = foam(2.4, FOIL.wake, 0.50);
  const cut = foam(0.30, 5.0, 0.34);

  const you = {
    x: 0, z: 0, y: 0,
    yaw: 0, look: 0, pitch: -0.12,
    sp: 0,
    thr: 0,               // the trigger, 0..1
    trim: 0.30,           // where you are asking the board to ride, in metres
    air: 0,               // and where it actually is
    bank: 0, steer: 0,
    down: 0,              // s of being back on the hull after a breach
    t: 0, best: 0, far: 0,
  };
  let active = false;

  const head = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
  const waterOk = (x, z) => isSea(x, z) && -groundAt(x, z) > FOIL.minDepth;

  /**
   * Step on and go.
   *
   * Pointed at whichever heading has the most open water in front of it, which
   * on this shore is nearly always straight out — the same test the kite does,
   * for the same reason: a mode that begins by running you aground in four
   * seconds is a mode nobody finds out works.
   */
  function enter(x, z) {
    if (!waterOk(x, z)) return false;
    let best = null;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const [hx, hz] = head(a);
      let run = 0;
      for (; run < 320; run += 16) {
        if (!waterOk(x + hx * (run + 16), z + hz * (run + 16))) break;
      }
      if (!best || run > best.run) best = { run, a };
    }
    if (!best || best.run < 60) return false;
    you.x = x; you.z = z;
    you.y = seaHeightAt(x, z);
    you.yaw = best.a;
    you.look = 0; you.pitch = -0.12;
    you.sp = 0; you.thr = 0;
    you.trim = 0.30; you.air = 0;
    you.bank = 0; you.steer = 0; you.down = 0;
    you.t = 0; you.best = 0; you.far = 0;
    active = true;
    group.visible = true;
    return true;
  }

  function leave() { active = false; group.visible = false; }

  function look(dx, dy) {
    if (!active) return;
    you.look = clamp(you.look - dx, -2.4, 2.4);
    you.pitch = clamp(you.pitch - dy, -1.15, 1.2);
  }

  /**
   * One frame.
   *
   * `ctl` is the water modes' shape — { fwd, side, sprint, up, down } — where
   * fwd is the trigger, side is the lean and up/down trim the ride height.
   * Returns null, 'aground' or 'breach'.
   */
  function update(dt, ctl = {}) {
    if (!active) return null;
    you.t += dt;

    // ── the trigger ────────────────────────────────────────────────────────
    // Held, not tapped: a hand throttle on one of these is a squeeze and it
    // does not spring back to a detent in the middle.
    const want = ctl.sprint ? 1
      : clamp(you.thr + (ctl.fwd || 0) * dt * 0.95, 0, 1);
    you.thr += clamp(want - you.thr, -dt * 2.2, dt * 2.2);
    you.thr = clamp(you.thr, 0, 1);

    // ── along the water ────────────────────────────────────────────────────
    // The hull is a brake and the foil is not, which is the whole reason the
    // thing has a foil: once it is up, the same power carries you half again
    // as fast. Written the other way round — one drag figure for both — and
    // there would be no moment of taking off, only a number going up.
    const lift = clamp((you.sp - FOIL.fly) / (FOIL.glide - FOIL.fly), 0, 1);
    const flying = you.down <= 0 ? lift : 0;
    const target = FOIL.top * you.thr * (FOIL.plough + (1 - FOIL.plough) * flying);
    const k = 1 - Math.exp(-(target > you.sp ? FOIL.accel : FOIL.drag) * dt);
    you.sp += (target - you.sp) * k;
    if (you.sp < 0.02) you.sp = 0;

    // ── the height, which is a control ─────────────────────────────────────
    if (you.down > 0) {
      you.down -= dt;
      you.trim = Math.min(you.trim, 0.22);
    } else {
      const move = (ctl.up ? 1 : 0) - (ctl.down ? 1 : 0);
      you.trim = clamp(you.trim + move * FOIL.rate * dt, 0.10, FOIL.high);
    }
    const wantAir = you.trim * flying;
    you.air += clamp(wantAir - you.air, -dt * 2.4, dt * 1.7);

    let out = null;
    // Ventilation. Up near the top of the mast the front wing is close enough
    // to the surface to pull air down its own low-pressure side, and when it
    // does there is no lift left to argue with — you go down, hard, and the
    // board catches you. It is a die roll and not a threshold, because in life
    // it is a die roll: the same height over glass is fine and over chop is
    // not.
    if (flying > 0.9 && you.air > FOIL.breach
      && Math.random() < FOIL.breachOdds * dt * (0.4 + 0.6 * you.thr)) {
      you.down = FOIL.recover;
      you.air = 0;
      you.sp *= 0.48;
      you.trim = 0.20;
      out = 'breach';
    }

    // ── steering, which is banking ─────────────────────────────────────────
    const s = clamp(ctl.side || 0, -1, 1);
    you.steer += (s - you.steer) * Math.min(1, dt * 5.5);
    const spN = Math.min(1, you.sp / FOIL.top);
    you.yaw -= you.steer * dt
      * (FOIL.turn + (FOIL.turnFast - FOIL.turn) * spN)
      * (0.55 + 0.45 * flying);
    const wantBank = you.steer * FOIL.bank * (0.30 + 0.70 * spN)
      * (0.35 + 0.65 * flying);
    you.bank += clamp(wantBank - you.bank, -FOIL.bankRate * dt, FOIL.bankRate * dt);

    // ── where that puts you ────────────────────────────────────────────────
    const [hx, hz] = head(you.yaw);
    const nx = you.x + hx * you.sp * dt;
    const nz = you.z + hz * you.sp * dt;
    if (waterOk(nx, nz)) { you.x = nx; you.z = nz; }
    else {
      // Off the end of the water. The wing is eighty centimetres down and it
      // hits the bottom before you do — so the mode does not argue, it stops
      // you and puts you in the sea.
      you.sp *= 0.25;
      if (you.sp < 1.0) return 'aground';
    }
    you.y = seaHeightAt(you.x, you.z);
    you.best = Math.max(you.best, you.air);
    you.far = Math.max(you.far, you.sp);
    return out;
  }

  /**
   * The camera.
   *
   * Standing on the board, and rolled with the bank — properly rolled, not
   * hinted at. Once the hull is out of the water there is no wake, no spray
   * and no board in the frame, so the roll is the *only* thing on the screen
   * that says you are turning; a tenth of what the board is doing, which is
   * what the kite gets, reads here as the picture drifting sideways of its own
   * accord.
   */
  function pose(camera) {
    if (!active) return;
    camera.up.set(0, 1, 0);
    // The knock of a hull at displacement speed, and it stops the moment the
    // board leaves the water — which is the cheapest half of the whole effect
    // and probably the half you notice first.
    const chop = Math.sin(you.t * 8.1) * FOIL.chop
      * Math.min(1, you.sp / 3.0) * (1 - Math.min(1, you.air / 0.25));
    const ey = you.y + FOIL.deck + FOIL.eye + you.air + chop;
    camera.position.set(you.x, ey, you.z);
    const yaw = you.yaw + you.look;
    const cp = Math.cos(you.pitch);
    camera.lookAt(
      you.x - Math.sin(yaw) * cp,
      ey + Math.sin(you.pitch),
      you.z - Math.cos(yaw) * cp,
    );
    camera.rotateZ(-you.bank * 0.62);
  }

  /** Put the hardware where you are. Called after `pose`. */
  function draw() {
    if (!active) return;
    const [hx, hz] = head(you.yaw);
    rig.position.set(you.x, you.y + FOIL.deck + you.air, you.z);
    // Nose up while the hull is still in the water and shoving, level once it
    // is out — which is exactly what one of these does and is the shape the
    // whole take-off reads by from any other boat on the channel.
    const plough = 1 - Math.min(1, you.air / 0.20);
    rig.rotation.set(-0.16 * plough * Math.min(1, you.sp / 4.0), you.yaw,
      you.bank, 'YXZ');

    const wk = Math.min(1, you.sp / 4.2) * plough;
    wake.visible = wk > 0.10;
    wake.position.set(you.x - hx * FOIL.wake * 0.5, you.y + 0.05,
      you.z - hz * FOIL.wake * 0.5);
    wake.rotation.set(-Math.PI / 2, 0, -you.yaw + Math.PI);
    wake.scale.set(0.5 + 0.5 * wk, wk, 1);

    // And the hairline the mast leaves when there is nothing else touching.
    const ct = Math.min(1, you.sp / 6.0) * Math.min(1, you.air / 0.14);
    cut.visible = ct > 0.10;
    cut.position.set(you.x - hx * 2.4, you.y + 0.045, you.z - hz * 2.4);
    cut.rotation.set(-Math.PI / 2, 0, -you.yaw + Math.PI);
    cut.scale.set(1, ct, 1);
  }

  return {
    you, group,
    enter, leave, look, update, pose, draw,
    get active() { return active; },
    get speed() { return you.sp; },
    get air() { return you.air; },
    get flying() { return you.air > 0.12; },
    get throttle() { return you.thr; },
    /** What the HUD says about what the board is doing. */
    state: () => (you.down > 0 ? 'down'
      : you.air > FOIL.breach - 0.06 ? 'high'
        : you.air > 0.12 ? 'flying'
          : you.sp > FOIL.fly * 0.7 ? 'lifting' : 'hull'),
    stats: () => ({
      on: active ? 1 : 0,
      at: [Math.round(you.x), Math.round(you.z)],
      kmh: Math.round(you.sp * 3.6),
      thr: Math.round(you.thr * 100),
      air: +you.air.toFixed(2),
      trim: +you.trim.toFixed(2),
      bankDeg: Math.round(you.bank * 180 / Math.PI),
      best: +you.best.toFixed(2),
      fastest: Math.round(you.far * 3.6),
      down: +Math.max(0, you.down).toFixed(1),
      t: +you.t.toFixed(1),
    }),
  };
}
