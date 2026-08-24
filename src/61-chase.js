// -----------------------------------------------------------------------------
// The swim out to the skakaonica, and the person already ahead of you.
//
// Every other mode in this game is you against a fire, a machine or the water.
// This one is you against somebody who is better at it than you are, which is
// the oldest thing that happens on a beach: she is on the end of the jetty, she
// goes in, and by the time you are in the water she has a seven-metre lead on a
// hundred-and-fifty-metre swim to the platform.
//
// Three decisions are worth writing down.
//
// It is not a phase. `state.phase` stays `swim` the whole way through, and the
// chase is a layer over the top of it — the same water, the same breath bar, the
// same arms. A separate phase would have meant a second copy of every one of
// those and a second set of ways for them to disagree; what a race actually adds
// is one other swimmer, a gap, and a reason to press Q.
//
// She is beatable but not by drifting. Her cruise is 1.42 m/s against your 1.15,
// so at a steady crawl the gap opens the whole way and you lose. Sprint is 2.00
// and costs you nothing but distance under water, so the race is: hold the
// sprint, breathe, and do not let the gap past about fifty metres. And she has
// a tail — get inside four metres and she finds another fifth of a knot, which
// is what anybody does when they hear you coming.
//
// And she is built here rather than posed off the crowd rig. The rig has
// twenty-two clips and not one of them is a swim — see the note at the top of
// 60-arms.js, which reached the same wall from the other side and solved it the
// same way. What you actually see of a swimmer ahead of you is a back, two arms
// coming over, a pair of heels and a wake, all of it half in the water at ten to
// forty metres, and that is what this builds.
// -----------------------------------------------------------------------------

const CHASE = {
  lead: 7.0,           // m she is ahead when you hit the water
  // Measured against the swim: your cruise is 1.15 and your sprint gets you
  // about 1.69 through the water once drag has had its say. At 1.42 a clean
  // sprint the whole way finished 2.8 m behind her — which is a race you
  // cannot win, and a race you cannot win is a race nobody runs twice.
  sp: 1.34,            // m/s — a decent club swimmer in flat water
  spTail: 1.56,        // and what she finds when you get on her feet
  tailAt: 4.5,         // m — inside this she hears you
  catchAt: 2.80,       // m — and inside this you have caught her
  lost: 55,            // m behind and the race is over
  turnRate: 1.1,       // rad/s she comes round on to her line
  strokeHz: 0.72,      // her cycle, in strokes a second
  // How far off her bearing she strays, and where she stops straying.
  //
  // The first cut used 0.42 rad on a 12 s cycle and measured 0.9 m of
  // cross-track, which is a weave you have to be told about. The fix was not
  // more angle. How far she actually gets off the line is her speed over the
  // frequency times the angle — sp/w * A — so a period three times longer is
  // three times the excursion for exactly the same heading offset, and the
  // heading offset is the only thing that costs her anything. The drift term
  // runs at 33 s now and she swings 2.5 m either side of the rhumb line.
  //
  // What the angle costs is the cosine of it, averaged: 0.25 rad RMS is 3.1%
  // of speed made good, about 4.6 s over the whole swim. The race is that much
  // easier to win now and it should be — the reason to sprint is that she is
  // going somewhere you can cut the corner on. Against a straight line there
  // is no corner and no reason.
  wander: 0.52,
  wanderOut: 25.0,     // m from the platform where she straightens up
  // And her pace breathes. +/-7% on a 16.7 s cycle, which is enough to make the
  // gap counter move on its own without being enough to read as a bug.
  surge: 0.07,
  cut: 5.2,            // s of the shot before you get the keys
  talk: 10.5,          // s of her turning round, in three lines
  wake: 4.6,           // m of foam behind her
  // The swim back in, once she has said her piece.
  // How far under the surface she rides while the race is on.
  //
  // Matched to `RACE_DEEP` in 90-app.js, which is what pulls you down to meet
  // her: the point of both numbers is that a chase between two heads bobbing
  // in the chop is not a chase, and the same two swimmers a half metre under
  // are. She comes back up for the talk, because a conversation happens at the
  // surface.
  deep: 0.5,
  homeSp: 1.06,        // m/s — an easy return, not a second race
  homeHold: 6.0,       // m — past this she is waiting for you rather than going
  homeEase: 0.45,      // and how far she drops her pace while she waits
};

/**
 * Turn her to face you, at `rate` radians a second. Shared by the two phases
 * that do nothing else.
 */
function _turnTo(her, you, dt, rate) {
  const aim = Math.atan2(-(you.x - her.x), -(you.z - her.z));
  let d = aim - her.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return her.yaw + Math.max(-rate * dt, Math.min(rate * dt, d));
}

/**
 * The race.
 *
 * Owns her, the line she is on and what is left of it. `update` is handed the
 * swim's own `you` so it never has to know how the water works; what it returns
 * is the one thing the frame loop above it has to act on.
 */
async function buildChase(scene) {
  // Her, and not a stand-in.
  //
  // The first version of this built a swimmer out of scaled spheres — a torso,
  // a head, four limbs — on the argument that what you see of somebody ten
  // metres ahead of you in the water is a back and two arms, and that argument
  // is true. It was still the wrong call, and the report on it was one line
  // long: she should look the same as she does on shore. She does now. This is
  // the same rig, the same skin, the same face and the same twenty-eight bones
  // as the figure standing on the middle terrace, running a `swim` clip
  // authored for it in tools/blender/human_mh.py — the only clip on the rig
  // that is not written standing up.
  const fig = await loadSkin('human_skin_fr3d', {
    spec: 0.09, specPower: 24, face: true, body: 'base *= vVCol;',
  });
  const root = new THREE.Group();
  root.visible = false;
  root.frustumCulled = false;
  scene.add(root);
  if (fig) {
    fig.mesh.frustumCulled = false;
    root.add(fig.mesh);
    fig.play('swim', { fade: 0 });
  }

  // The wake: a flat ribbon of foam behind her, drawn on the surface. Cheap,
  // and it is most of what tells you at thirty metres that the shape ahead is
  // a person and not a buoy.
  const wake = (() => {
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 128;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 128);
    // Faint. The first version was 0.62 at the head of it and on a moving
    // water surface that is not foam, it is a sheet of ice being towed.
    grd.addColorStop(0, 'rgba(255,255,255,0.30)');
    grd.addColorStop(0.30, 'rgba(255,255,255,0.13)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    for (let y = 0; y < 128; y++) {
      const w = 6 + y * 0.16;
      g.fillRect(16 - w / 2, y, w, 1);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.92, CHASE.wake),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false,
        side: THREE.DoubleSide,
      }));
    // Flat on the water and trailing back down −X, which is astern of a rig
    // whose forward is +X.
    m.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    m.frustumCulled = false;
    m.renderOrder = 3;
    root.add(m);
    return m;
  })();

  const her = { x: 0, z: 0, y: 0, yaw: 0, u: 0, sp: 0, done: 0 };
  /** Set while the shot is holding her on the jetty — see `poise`. */
  let poised = null;
  let on = false;
  let phase = 'off';        // 'swim' | 'talk' | 'lost' | 'off'
  let t = 0, line = 0, gap = 0, best = 1e9;
  let target = [0, 0];
  let startAt = [0, 0];

  const say = () => (phase === 'talk'
    ? Math.min(3, 1 + Math.floor(t / (CHASE.talk / 3.4))) : 0);

  /**
   * Put her on the line and start the clock.
   *
   * `from` and `to` are the two ends of the run in world metres — the jetty
   * head and the platform — and both come out of 43-jadrija.js so that moving
   * either one moves the race with it.
   */
  function start(from, to, surfaceY) {
    startAt = [from[0], from[1]];
    target = [to[0], to[1]];
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const L = Math.hypot(dx, dz) || 1;
    her.x = from[0] + (dx / L) * CHASE.lead;
    her.z = from[1] + (dz / L) * CHASE.lead;
    her.yaw = Math.atan2(-dx, -dz);
    her.u = 0; her.sp = CHASE.sp; her.done = 0;
    her.y = surfaceY(her.x, her.z);
    on = true; phase = 'swim'; t = 0; gap = CHASE.lead; best = CHASE.lead;
    line = L;
    root.visible = true;
    return true;
  }

  function stop() {
    on = false; phase = 'off'; root.visible = false;
    poised = null;
  }

  /**
   * Stand her somewhere, out of the race.
   *
   * The race used to begin with her already seven metres out and already
   * swimming, which is a fair model of what you are chasing and a poor one of
   * how it started: you arrive at a jetty somebody has just left. So now there
   * is a beat before it in which she is a person standing on concrete, and
   * this is the state she is in for the length of it — placed by the shot,
   * upright, playing whatever it asks for, and not moving under her own power.
   *
   * `stop()` clears it, and `start()` overrides it, so there is no way to be
   * both poised and racing.
   */
  function poise(x, y, z, yaw, clip = 'idle', pitch = 0) {
    poised = { x, y, z, yaw, clip, pitch };
    root.visible = true;
    return poised;
  }

  /**
   * One frame. Returns 'caught', 'lost', 'done' or null.
   *
   * 'caught' is the moment you get inside `catchAt` and is fired once; 'done'
   * is the end of what she has to say afterwards; 'lost' is her climbing out
   * without you.
   */
  function update(dt, you, surfaceY) {
    if (!on) return null;
    t += dt;

    const dx = target[0] - her.x, dz = target[1] - her.z;
    const left = Math.hypot(dx, dz);
    gap = Math.hypot(you.x - her.x, you.z - her.z);
    best = Math.min(best, gap);

    if (phase === 'swim') {
      // On her feet and she knows it.
      const want = (gap < CHASE.tailAt ? CHASE.spTail : CHASE.sp)
        * (1 + CHASE.surge * Math.sin(t * 0.377 + 2.1));
      her.sp += (want - her.sp) * Math.min(1, dt * 1.4);
      if (left > 2.0) {
        // Her line is not a line.
        //
        // She swam dead at the platform, which is what a bearing does and not
        // what a person does. Two hundred metres of open water with nothing to
        // sight on but a raft, and nobody holds a course inside a few degrees:
        // you drift off it, you pick your head up, you come back on, and then
        // you do it again. Straight, the race was a gap counter with a body
        // attached — you could read the outcome off the first ten seconds and
        // nothing after that changed your mind.
        //
        // Three sines at periods that do not divide into one another, summed:
        // 33 s is the drift and carries almost all of the excursion, 13.4 s is
        // her picking her head up and correcting it, and 3.1 s is the fact that
        // a stroke is not symmetrical and every swimmer yaws a little inside
        // each cycle. Off her own clock rather than off `Math.random`, so that
        // a run is a run and a test of a run is the same run — which is the
        // same reason the beach is laid out off `jit`.
        //
        // It goes to nothing over the last twenty-five metres, and that is the
        // finish rather than a softening: a wander that carried on into the
        // platform would never satisfy `left > 2.0` and she would circle the
        // raft she has just won at.
        const wob = CHASE.wander * Math.min(1, left / CHASE.wanderOut)
          * (Math.sin(t * 0.190 + 1.7) * 0.62
            + Math.sin(t * 0.470) * 0.26
            + Math.sin(t * 2.03 + 0.4) * 0.12);
        const aim = Math.atan2(-dx, -dz) + wob;
        let d = aim - her.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        her.yaw += Math.max(-CHASE.turnRate * dt,
          Math.min(CHASE.turnRate * dt, d));
        her.x -= Math.sin(her.yaw) * her.sp * dt;
        her.z -= Math.cos(her.yaw) * her.sp * dt;
        her.u += dt * CHASE.strokeHz;
      } else {
        her.done = Math.min(1, her.done + dt);
      }
      her.y = surfaceY(her.x, her.z) - CHASE.deep;

      if (gap <= CHASE.catchAt) {
        phase = 'talk'; t = 0;
        // She turns and faces you, which is the whole of the payoff and is
        // therefore worth a whole line of code.
        her.yaw = Math.atan2(-(you.x - her.x), -(you.z - her.z));
        return 'caught';
      }
      if (gap > CHASE.lost) { phase = 'lost'; t = 0; return 'lost'; }
      // She has got there first, and getting there first is not leaving.
      //
      // This used to hand her to `lost`, which counts to 2.6 and hides her —
      // so from the water it looked like she evaporated somewhere short of the
      // platform, which is exactly what it was. She waits now, treading, and
      // she waits as long as it takes: the platform is the finish, and a person
      // at the finish of a race she has won does not swim off.
      if (her.done >= 1) { phase = 'wait'; t = 0; return 'arrived'; }
      return null;
    }

    if (phase === 'wait') {
      // Treading at the platform, turning to watch you come in. The same scull
      // and the same turn rate as `talk`, because it is the same thing she is
      // doing — the difference is only that you have not arrived yet. Up at
      // the surface: she has stopped swimming.
      her.y = surfaceY(her.x, her.z);
      her.u += dt * 0.22;
      her.yaw = _turnTo(her, you, dt, 1.2);
      if (gap <= CHASE.catchAt) { phase = 'talk'; t = 0; return 'caught'; }
      if (gap > CHASE.lost) { phase = 'lost'; t = 0; return 'lost'; }
      return null;
    }

    if (phase === 'home') {
      // Back to the jetty, together.
      //
      // She holds a little ahead of you rather than running her own race: the
      // point of the leg is that there are two of you in the water, and a
      // swimmer who is fifty metres up the channel is one of you. So she takes
      // her pace from the gap — easing off when you fall behind, picking it up
      // when you are on her shoulder — and she is done when the jetty is close
      // enough to climb out at.
      const back = Math.hypot(startAt[0] - her.x, startAt[1] - her.z);
      const want = CHASE.homeSp
        * (gap > CHASE.homeHold ? CHASE.homeEase : 1.0);
      her.sp += (want - her.sp) * Math.min(1, dt * 1.2);
      if (back > 3.0) {
        const aim = Math.atan2(-(startAt[0] - her.x), -(startAt[1] - her.z));
        let d = aim - her.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        her.yaw += Math.max(-CHASE.turnRate * dt,
          Math.min(CHASE.turnRate * dt, d));
        her.x -= Math.sin(her.yaw) * her.sp * dt;
        her.z -= Math.cos(her.yaw) * her.sp * dt;
        her.u += dt * CHASE.strokeHz * 0.82;
      } else {
        stop();
        return 'home';
      }
      // Half as deep on the way back as on the way out: an easy swim in, not a
      // sprint, and she is talking to you over her shoulder.
      her.y = surfaceY(her.x, her.z) - CHASE.deep * 0.5;
      if (gap > CHASE.lost) { phase = 'lost'; t = 0; return 'lost'; }
      return null;
    }

    if (phase === 'talk') {
      her.y = surfaceY(her.x, her.z);
      // Treading water: a slow scull rather than a stroke, and she keeps facing
      // you while you drift.
      her.u += dt * 0.22;
      her.yaw = _turnTo(her, you, dt, 1.6);
      if (t > CHASE.talk) {
        // Not `stop()`. She turns round and swims back in with you — see the
        // `home` phase, and the note on it about why she does not simply go.
        phase = 'home'; t = 0; her.sp = CHASE.homeSp * 0.4;
        return 'done';
      }
      return null;
    }

    if (phase === 'lost' && t > 2.6) { stop(); return null; }
    return null;
  }

  /**
   * Place and pose her, after everything has moved.
   *
   * The rig's forward is +X and a Three.js object with `rotation.y = θ` points
   * its local +X at (cos θ, −sin θ), while `her.yaw` is written the way every
   * heading in this game is — forward is (−sin, −cos). Hence the quarter turn,
   * which is the only place in this file that has to know either convention.
   */
  function draw(dt) {
    if (!fig) return;
    // Poised beats racing, and it is drawn even when the race has not begun —
    // that is the whole point of it. Upright, so the rig's floor is under her
    // feet and there is no sinking to do: she is standing on a jetty.
    if (poised) {
      root.position.set(poised.x, poised.y, poised.z);
      root.rotation.set(0, poised.yaw + Math.PI / 2, poised.pitch || 0, 'YZX');
      if (fig.playing() !== poised.clip) fig.play(poised.clip, { fade: 0.25 });
      fig.update(dt);
      if (fig.faceTick) fig.faceTick(dt);
      wake.visible = false;
      return;
    }
    if (!on) return;
    const tread = phase !== 'swim';
    // How deep she floats, in metres below the surface.
    //
    // Prone she is just awash. Upright she is a whole different number and it
    // is the bigger of the two by a metre and a half: the `tread` clip is
    // authored standing, so the rig's floor is under her *feet*, and treading
    // water puts the waterline at her shoulders. Written at −0.46 — the prone
    // figure's number with a bit off it — she stood on the sea.
    // Prone she is *under* it, which is the correction this number exists to
    // carry. −0.12 floated the rig twelve centimetres clear of the waterline
    // and, the clip being authored lying down, that put a whole swimmer on top
    // of the sea — the one thing nobody swimming has ever done. A front crawl
    // sits the spine a hand's breadth under, the head down between the arms
    // and only the roll bringing a shoulder through; 0.34 is that, and it is
    // also what makes the wake read as coming off something rather than as
    // being towed by it.
    const sink = tread ? 0.88 : 0.34;
    root.position.set(her.x, her.y - sink, her.z);
    root.rotation.set(0, her.yaw + Math.PI / 2, 0);
    const want = tread ? 'tread' : 'swim';
    if (fig.playing() !== want) fig.play(want, { fade: 0.35 });
    fig.update(dt);
    if (fig.faceTick) fig.faceTick(dt);
    wake.visible = phase === 'swim';
    wake.position.set(-CHASE.wake * 0.5, 0.02 + sink, 0);
  }

  return {
    root, her, fig, start, stop, update, draw, poise,
    get poised() { return poised; },
    get active() { return on; },
    get phase() { return phase; },
    get gap() { return gap; },
    /** How far she still has to go, 0..1 through the race. */
    get through() {
      const left = Math.hypot(target[0] - her.x, target[1] - her.z);
      return line > 0 ? Math.max(0, Math.min(1, 1 - left / line)) : 0;
    },
    /** Which of her three lines is on screen, 1..3, or 0 for none. */
    get line() { return say(); },
    stats: () => ({
      on: on ? 1 : 0, phase,
      gap: +gap.toFixed(1), best: +best.toFixed(1),
      at: [Math.round(her.x), Math.round(her.z)],
      // Unrounded, because `at` is for reading and this is for measuring: a
      // wander whose whole amplitude is a metre and a half does not survive
      // being reported to the nearest metre.
      pos: [+her.x.toFixed(3), +her.z.toFixed(3), +her.yaw.toFixed(4),
        +her.sp.toFixed(3)],
      through: +(line > 0
        ? 1 - Math.hypot(target[0] - her.x, target[1] - her.z) / line : 0).toFixed(2),
      t: +t.toFixed(1),
    }),
  };
}
