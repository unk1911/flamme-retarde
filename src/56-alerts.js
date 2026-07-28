// -----------------------------------------------------------------------------
// Ground proximity, and hitting things.
//
// The complaint that produced this file was fair: you could fly a twelve-tonne
// aeroplane into the Adriatic at ninety metres a second and the game would
// quietly show you a results screen. Nothing warned you on the way down and
// nothing happened at the bottom.
//
// So: a GPWS that behaves like the real thing — a rising radio-altimeter tick
// as the ground comes up, SINK RATE when the descent is too steep for the
// height, PULL UP when the terrain ahead is going to win — and an impact you
// feel, with a flash, a shake and something breaking.
//
// The one rule that matters for a water bomber: none of it may fire on a legal
// scoop run. Being five metres over the sea at sixty metres a second is the job,
// not an emergency, and an alarm that cries wolf every single fill is an alarm
// nobody hears when it counts. So the whole system inhibits itself the moment
// the scoop conditions are satisfied — which is also, neatly, exactly when a
// real crew would have the inhibit switch down.
// -----------------------------------------------------------------------------

const ALERT = {
  scanSecs: 7,          // how far ahead along the flight path we look
  sinkCeiling: 300,     // above this AGL a descent is never a "sink rate"
  pullUpTTI: 4.5,       // seconds to terrain impact that trips PULL UP
  tickFrom: 160,        // AGL at which the radio altimeter starts ticking
};

function buildAlerts(audio) {
  const gpwsEl = document.getElementById('gpws');
  const dmgEl = document.getElementById('damage');
  const flashEl = document.getElementById('flash');

  let warn = '';           // '' | 'sink' | 'pullUp'
  let lastWarn = '';
  let alertT = 0, tickT = 0;
  let shakeAmp = 0, shakeT = 0, shakeMax = 1;
  let crashed = false;

  const _fwd = { x: 0, z: 0 };
  const _shake = new THREE.Vector3();

  /** Highest ground along the flight path, ignoring the sea. */
  function terrainAhead(px, pz, fx, fz, reach) {
    let hi = 0;
    for (let d = 80; d <= reach; d += 80) {
      const x = px + fx * d, z = pz + fz * d;
      if (!isSea(x, z)) hi = Math.max(hi, groundAt(x, z));
    }
    return hi;
  }

  /**
   * @param s  { p, speed, agl, vs, fwd, inhibit }
   */
  function update(dt, s) {
    if (crashed) return;

    // On a legal scoop run the aeroplane is *supposed* to be on the deck.
    const inhibit = s.inhibit;

    warn = '';
    if (!inhibit && s.agl > 0.5) {
      const fl = Math.hypot(s.fwd.x, s.fwd.z) || 1;
      _fwd.x = s.fwd.x / fl; _fwd.z = s.fwd.z / fl;

      const scan = clamp(s.speed * ALERT.scanSecs, 240, 1500);
      const hiAhead = terrainAhead(s.p.x, s.p.z, _fwd.x, _fwd.z, scan);
      const surface = isSea(s.p.x, s.p.z) ? 0 : groundAt(s.p.x, s.p.z);
      const clearAhead = s.p.y - hiAhead;

      // Two things can close the gap: falling, and ground rising to meet you.
      // The second is the one that kills people in real aeroplanes, and it is
      // the one a bare vertical-speed check never sees.
      const rise = Math.max(0, hiAhead - surface);
      const secsToScan = scan / Math.max(20, s.speed);
      const closure = -s.vs + rise / secsToScan;
      const tti = closure > 0.2 ? clearAhead / closure : 99;

      if (tti < ALERT.pullUpTTI && clearAhead < 420) warn = 'pullUp';
      else if (s.agl < ALERT.sinkCeiling && -s.vs > 3.2 + s.agl * 0.075) warn = 'sink';
    }

    // ── the radio altimeter ────────────────────────────────────────────────
    // A tick that speeds up and rises in pitch as the ground comes up. Only
    // while actually descending, so straight-and-level down low is silent and
    // the tick means what it says.
    if (!inhibit && s.agl < ALERT.tickFrom && s.agl > 0.8 && s.vs < -1.5) {
      const u = sat(s.agl / ALERT.tickFrom);
      tickT -= dt;
      if (tickT <= 0) {
        tickT = lerp(0.09, 0.85, u * u);
        if (audio) audio.radalt(1520 - u * 700);
      }
    } else tickT = 0;

    // ── the callouts ───────────────────────────────────────────────────────
    if (warn !== lastWarn) alertT = 0;
    if (warn) {
      alertT -= dt;
      if (alertT <= 0) {
        if (warn === 'pullUp') { if (audio) audio.gpwsPullUp(); alertT = 1.25; }
        else { if (audio) audio.gpwsSink(); alertT = 1.6; }
      }
    }
    lastWarn = warn;

    // ── the picture ────────────────────────────────────────────────────────
    if (gpwsEl) {
      const txt = warn === 'pullUp' ? T('warn.pullUp') : warn === 'sink' ? T('warn.sink') : '';
      if (gpwsEl.textContent !== txt) gpwsEl.textContent = txt;
      gpwsEl.className = warn ? warn : '';
    }
    if (dmgEl) dmgEl.className = warn ? warn : '';
  }

  // ── shake ────────────────────────────────────────────────────────────────

  /** Kick the camera. `amp` is roughly metres of throw at the start. */
  function bump(amp) {
    shakeAmp = Math.max(shakeAmp, amp);
    shakeMax = shakeAmp;
    shakeT = Math.max(shakeT, 0.3 + amp * 0.75);
  }

  /**
   * Camera offset for this frame, or null. Three incommensurate frequencies per
   * axis so it never settles into a visible loop, and it decays rather than
   * stopping — a shake that ends abruptly reads as a bug.
   */
  function shakeOffset(dt, time) {
    if (shakeT <= 0) return null;
    shakeT -= dt;
    if (shakeT <= 0) { shakeAmp = 0; return null; }
    const a = shakeAmp * sat(shakeT / (0.3 + shakeMax * 0.75));
    _shake.set(
      Math.sin(time * 61.7) * 0.62 + Math.sin(time * 23.3) * 0.38,
      Math.sin(time * 47.1) * 0.70 + Math.sin(time * 17.9) * 0.30,
      Math.sin(time * 39.3) * 0.50 + Math.sin(time * 13.1) * 0.28,
    ).multiplyScalar(a);
    return _shake;
  }

  // ── impact ───────────────────────────────────────────────────────────────

  /** Full-screen flash. Colour matters: water is white, the karst is fire. */
  function flash(color, alpha, fade) {
    if (!flashEl) return;
    flashEl.style.transition = 'none';
    flashEl.style.background = color;
    flashEl.style.opacity = String(alpha);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      flashEl.style.transition = `opacity ${fade}s ease-out`;
      flashEl.style.opacity = '0';
    }));
  }

  /**
   * A hard but survivable arrival on the water — the hull slapping down on a
   * scoop run you flew a bit too enthusiastically. Scaled by how hard, so a
   * greaser gives you nothing and a real slam rattles the camera.
   */
  function thump(vv) {
    const hard = sat((-vv - 1.6) / 4.0);
    if (hard <= 0.02) return;
    bump(0.5 + hard * 2.6);
    if (audio) audio.hullSlam(hard);
  }

  /** The end of the flight. */
  function impact(onWater, speed) {
    if (crashed) return;
    crashed = true;
    warn = '';
    if (gpwsEl) { gpwsEl.textContent = ''; gpwsEl.className = ''; }
    if (dmgEl) dmgEl.className = 'dead';
    const v = sat(speed / 110);
    flash(onWater ? '#eaf8ff' : '#ffbb66', 0.85 + v * 0.15, onWater ? 1.5 : 2.1);
    bump(3.4 + v * 3.2);
    if (audio) audio.impact(onWater, speed);
  }

  function reset() {
    crashed = false;
    warn = ''; lastWarn = ''; alertT = 0; tickT = 0;
    shakeAmp = 0; shakeT = 0;
    if (gpwsEl) { gpwsEl.textContent = ''; gpwsEl.className = ''; }
    if (dmgEl) dmgEl.className = '';
  }

  return {
    update, bump, shakeOffset, thump, impact, reset, flash,
    get warning() { return warn; },
    get crashed() { return crashed; },
  };
}
