// -----------------------------------------------------------------------------
// Flying it with your thumbs.
//
// Three decisions carry this whole file:
//
//  1. The stick floats. It appears centred on wherever the thumb lands in the
//     left half of the screen rather than living in a fixed corner, because you
//     cannot see your own hand and you will not put it where the picture of a
//     stick is. Every fixed-position mobile stick is fighting that fact.
//
//  2. The throttle is a lever, not a pair of buttons. It has an absolute
//     position you can set in one movement and read at a glance, which is what
//     a throttle quadrant is; +/- buttons make you hold a finger down for four
//     seconds while the aeroplane does something else.
//
//  3. Level is a latch, not a hold. On a keyboard Z is held down with a spare
//     finger. On a phone you have two thumbs and both are busy, so the panic
//     button has to stay on when you let go of it.
//
// Everything is Pointer Events with explicit capture, so a thumb that slides
// off a button still releases it and two thumbs never get confused for one.
// -----------------------------------------------------------------------------

/** How far from the pad centre counts as full deflection, in CSS pixels. */
let padRadius = 78;

function initTouch() {
  if (!IS_TOUCH) return;

  const pad = document.getElementById('flypad');
  const knob = document.getElementById('flyknob');
  const thr = document.getElementById('thr');
  const thrTrack = document.getElementById('thr-track');

  let flyId = null, flyOx = 0, flyOy = 0;
  let thrId = null;

  const measure = () => {
    const r = pad.getBoundingClientRect();
    padRadius = Math.max(40, r.width * 0.5);
  };
  addEventListener('resize', measure);
  addEventListener('orientationchange', () => setTimeout(measure, 250));

  // ── the floating stick ────────────────────────────────────────────────────

  /** Anything that is already a control handles its own touches. */
  const isControl = (t) => t && t.closest
    && t.closest('button, input, a, #thr, #panel, #veil, #over, #rotate');

  function stickTo(dx, dy) {
    const r = padRadius;
    let x = clamp(dx / r, -1, 1);
    let y = clamp(-dy / r, -1, 1);            // screen y is down, pitch is up
    // A small dead zone at the centre, or the aeroplane never quite flies
    // straight — a thumb resting on glass is never perfectly still.
    const m = Math.hypot(x, y);
    if (m < 0.07) { x = 0; y = 0; }
    if (flight) flight.p.tch.set(x, y);
    knob.style.transform = `translate(${x * r * 0.6}px, ${-y * r * 0.6}px)`;
  }

  function releaseStick() {
    flyId = null;
    if (flight) flight.p.tch.set(0, 0);
    knob.style.transform = 'translate(0px, 0px)';
    pad.classList.remove('on');
  }

  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    if (isControl(e.target)) return;
    if (state.phase !== 'fly' || flyId !== null) return;
    // The right-hand third belongs to the throttle and the big buttons; a
    // stick started over there is a mis-hit, not an input.
    if (e.clientX > innerWidth * 0.58) return;
    e.preventDefault();
    flyId = e.pointerId;
    flyOx = e.clientX; flyOy = e.clientY;
    pad.style.left = flyOx + 'px';
    pad.style.top = flyOy + 'px';
    pad.classList.add('on');
    measure();
    stickTo(0, 0);
  }, { passive: false });

  addEventListener('pointermove', (e) => {
    if (e.pointerId !== flyId) return;
    e.preventDefault();
    stickTo(e.clientX - flyOx, e.clientY - flyOy);
  }, { passive: false });

  const endStick = (e) => { if (e.pointerId === flyId) releaseStick(); };
  addEventListener('pointerup', endStick);
  addEventListener('pointercancel', endStick);
  // Losing the phase mid-drag (a crash, the settings panel) has to let go too.
  addEventListener('blur', releaseStick);

  // ── the throttle lever ────────────────────────────────────────────────────

  function thrFromY(clientY) {
    const r = thrTrack.getBoundingClientRect();
    const v = clamp(1 - (clientY - r.top) / Math.max(1, r.height), 0, 1);
    if (!flight) return;
    // Grabbing the lever takes the aeroplane off the autopilot, exactly as
    // moving the stick does — the autopilot flies the throttle itself, and two
    // of you on it is worse than either.
    if (flight.p.autopilot) toggleAutopilot();
    flight.p.throttle = v;
  }

  thr.addEventListener('pointerdown', (e) => {
    if (state.phase !== 'fly') return;
    e.preventDefault();
    thrId = e.pointerId;
    thr.setPointerCapture(e.pointerId);
    thrFromY(e.clientY);
  }, { passive: false });
  thr.addEventListener('pointermove', (e) => {
    if (e.pointerId !== thrId) return;
    e.preventDefault();
    thrFromY(e.clientY);
  }, { passive: false });
  const endThr = (e) => {
    if (e.pointerId !== thrId) return;
    thrId = null;
    try { thr.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
  };
  thr.addEventListener('pointerup', endThr);
  thr.addEventListener('pointercancel', endThr);

  // ── buttons ───────────────────────────────────────────────────────────────

  /** A button that is on for exactly as long as a thumb is on it. */
  function hold(id, on) {
    const el = document.getElementById(id);
    const down = (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('on');
      on(true);
    };
    const up = (e) => {
      el.classList.remove('on');
      on(false);
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    };
    el.addEventListener('pointerdown', down, { passive: false });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /** A button that does something once, on release. */
  function tap(id, fn) {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('on'); },
      { passive: false });
    const go = (e) => {
      el.classList.remove('on');
      if (e.type === 'pointerup') fn(el);
    };
    el.addEventListener('pointerup', go);
    el.addEventListener('pointercancel', go);
  }

  hold('t-scoop', (v) => { TOUCH.scoop = v; });
  hold('t-drop', (v) => { TOUCH.drop = v; });

  tap('t-ap', () => toggleAutopilot());
  tap('t-cam', () => cycleCamera());
  tap('t-set', () => togglePanel());
  tap('t-pause', () => togglePause());
  tap('t-lvl', (el) => {
    TOUCH.level = !TOUCH.level;
    el.classList.toggle('on', TOUCH.level);
  });

  // ── on foot ───────────────────────────────────────────────────────────────
  // The same two halves as in the air, meaning the opposite thing in both. The
  // left thumb walks. The right half of the screen is the head: there is no
  // pointer to lock on a phone, so looking around has to be a drag, and it has
  // to be *relative* — an absolute mapping would snap the view to wherever the
  // thumb happened to land.

  const walkPad = document.getElementById('walkpad');
  const walkKnob = document.getElementById('walkknob');
  let walkId = null, walkOx = 0, walkOy = 0;
  let lookId = null, lookX = 0, lookY = 0;

  function walkTo(dx, dy) {
    const r = padRadius;
    let x = clamp(dx / r, -1, 1);
    let y = clamp(-dy / r, -1, 1);
    if (Math.hypot(x, y) < 0.12) { x = 0; y = 0; }
    TOUCH.gx = x; TOUCH.gy = y;
    walkKnob.style.transform = `translate(${x * r * 0.6}px, ${-y * r * 0.6}px)`;
  }

  const gtouch = document.getElementById('gtouch');
  gtouch.addEventListener('pointerdown', (e) => {
    if (isControl(e.target)) return;
    e.preventDefault();
    if (e.clientX < innerWidth * 0.46 && walkId === null) {
      walkId = e.pointerId;
      walkOx = e.clientX; walkOy = e.clientY;
      walkPad.style.left = `${walkOx}px`;
      walkPad.style.top = `${walkOy}px`;
      walkPad.classList.add('on');
      gtouch.setPointerCapture(e.pointerId);
      walkTo(0, 0);
    } else if (lookId === null) {
      lookId = e.pointerId;
      lookX = e.clientX; lookY = e.clientY;
      gtouch.setPointerCapture(e.pointerId);
    }
  }, { passive: false });

  gtouch.addEventListener('pointermove', (e) => {
    if (e.pointerId === walkId) {
      walkTo(e.clientX - walkOx, e.clientY - walkOy);
    } else if (e.pointerId === lookId) {
      if (ground) ground.look((e.clientX - lookX) * 0.0060, (e.clientY - lookY) * 0.0060);
      lookX = e.clientX; lookY = e.clientY;
    }
  }, { passive: false });

  const endGround = (e) => {
    if (e.pointerId === walkId) {
      walkId = null;
      TOUCH.gx = TOUCH.gy = 0;
      walkPad.classList.remove('on');
      walkKnob.style.transform = '';
    } else if (e.pointerId === lookId) {
      lookId = null;
    }
  };
  gtouch.addEventListener('pointerup', endGround);
  gtouch.addEventListener('pointercancel', endGround);

  hold('t-jet', (v) => { TOUCH.gjet = v; });
  tap('t-in', () => toggleGround());
  tap('t-gset', () => togglePanel());
  tap('t-gpause', () => togglePause());
  tap('t-run', (el) => {
    TOUCH.grun = !TOUCH.grun;
    el.classList.toggle('on', TOUCH.grun);
  });

  measure();
}

/**
 * Called from the HUD update. The throttle can move without you — the autopilot
 * flies it — so the lever has to read back from the aeroplane rather than
 * remember what it was last set to.
 */
function paintTouchHUD() {
  const p = flight.p;
  const fill = document.getElementById('thr-fill');
  const num = document.getElementById('thr-n');
  fill.style.height = (p.throttle * 100).toFixed(0) + '%';
  num.textContent = Math.round(p.throttle * 100);

  document.getElementById('t-scoop').classList.toggle('armed', p.scoopValid);
  document.getElementById('t-drop').classList.toggle('armed',
    p.water > 200 && state.altAgl > 3);
  document.getElementById('t-ap').classList.toggle('on', p.autopilot);
}

initTouch();
