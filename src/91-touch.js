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
//  4. Sticks listen on the window; only buttons listen on themselves. All three
//     overlays are full-screen and `pointer-events: none`, because they sit on
//     top of the readouts and have to let a touch through to them — so an
//     overlay never receives a pointerdown, and a stick bound to one is a
//     control that silently does not exist. The gate is `state.phase`, not what
//     the touch happened to land on.
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

  /**
   * Anything that is already a control handles its own touches.
   *
   * `#ground-prompt` is in here because it is a div that listens for clicks —
   * the "press E to board" line is also the button on a phone, since there was
   * nowhere left in the flight controls to put a sixth one. Without it, tapping
   * it would board the aeroplane *and* plant a walk stick under your thumb.
   */
  const isControl = (t) => t && t.closest
    && t.closest('button, input, a, #thr, #panel, #veil, #over, #rotate, #ground-prompt');

  /**
   * Claim a pointer, and do not care if it has already gone.
   *
   * setPointerCapture throws NotFoundError when the pointer it names is no
   * longer active, which can happen between the event being queued and the
   * handler running — and an exception thrown out of a pointerdown handler
   * leaves the pad half-set-up: latched onto an id, drawn on screen, and never
   * to be released, because the matching pointerup goes to the same dead id.
   * The releases in this file have always been wrapped. The claims should be
   * too, for the same reason.
   */
  const capture = (id) => {
    try { document.documentElement.setPointerCapture(id); }
    catch (err) { /* pointer already gone */ }
  };

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

  /**
   * A button that has to be asked twice.
   *
   * On a keyboard, J has no confirmation and is not getting one: half the point
   * of it is being available in the two seconds before the ridge arrives, and a
   * dialogue box in those two seconds is the same as not having the key. The
   * risk it is guarding against there is *hesitation*.
   *
   * On glass the risk is the opposite one. There is no travel, no edge to feel
   * for, and your thumb is already down there working the stick; the way you
   * lose the aeroplane is by brushing something, not by choosing it. So the
   * first tap only arms — the button lights and says so — and the second, within
   * `hold` seconds, commits. Two deliberate taps still take well under a second,
   * which is inside the budget the keyboard key was protecting.
   */
  function arm(id, fn, hold = 2.5) {
    const el = document.getElementById(id);
    let timer = null;
    const disarm = () => { clearTimeout(timer); timer = null; el.classList.remove('armed'); };
    tap(id, () => {
      if (timer) { disarm(); fn(); return; }
      el.classList.add('armed');
      timer = setTimeout(disarm, hold * 1000);
    });
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

  // The one-way doors. A phone has no number row and no J, so without these
  // three the seat and both back doors simply do not exist on a touchscreen —
  // which is where the half of the game that happens on foot is hardest to
  // reach and most worth reaching.
  arm('t-bail', () => baleOut());
  // Jadrija is one tap, and it is the exception on purpose. The arming above is
  // for the two doors you cannot come back through in a hurry: bailing out puts
  // you under a canopy at whatever height you were, and Rokići drops you on a
  // hillside that is alight. Jadrija drops you on a beach, and if you did not
  // mean it you press the seat again and fly on. It is also the one of the
  // three you take deliberately and often — it is how the whole second half of
  // the game is reached — and making the thing you do every session cost two
  // taps to guard against a brush you can undo is the wrong trade. J on a
  // keyboard has always been one press; this is the phone catching up.
  tap('t-jad', () => skipToJadrija());
  // And the vikendica, for the same reason and on the same terms: one tap,
  // because it is a place you go to look at something and come back from, not a
  // door that shuts behind you. It plays the walk up rather than dropping you
  // on the floor, so a phone gets the arrival and not just the destination.
  tap('t-vik', () => skipToVikendica());
  arm('t-rok', () => skipToGround());

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

  /**
   * On the window, and not on `#gtouch`.
   *
   * This is the whole of "I can get to Jadrija on my phone and then I am stuck
   * sitting in one spot". `#gtouch` is `pointer-events: none` and always was —
   * it has to be, because it is a full-screen overlay at z-index 45 sitting on
   * top of the readouts and the board-the-aeroplane prompt, and the only things
   * in it that are meant to swallow a touch are its own buttons, which set
   * `pointer-events: auto` for themselves. So the buttons worked. Everything
   * else — the walk stick, the whole right half of the screen that is your head
   * — was listening on an element that by construction never receives a
   * pointerdown, and there is no way to tell from the outside, because five
   * buttons light up and respond and only the two invisible controls are gone.
   *
   * The flight stick has been on the window since the day it was written, which
   * is why it never had this. All three modes work the same way now, and none
   * of them changes what a touch hits: the gate is the phase, not the geometry.
   */
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    if (state.phase !== 'ground' || isControl(e.target)) return;
    e.preventDefault();
    if (e.clientX < innerWidth * 0.46 && walkId === null) {
      walkId = e.pointerId;
      walkOx = e.clientX; walkOy = e.clientY;
      walkPad.style.left = `${walkOx}px`;
      walkPad.style.top = `${walkOy}px`;
      walkPad.classList.add('on');
      capture(e.pointerId);
      walkTo(0, 0);
    } else if (lookId === null) {
      lookId = e.pointerId;
      lookX = e.clientX; lookY = e.clientY;
      capture(e.pointerId);
    }
  }, { passive: false });

  addEventListener('pointermove', (e) => {
    if (e.pointerId === walkId) {
      e.preventDefault();
      walkTo(e.clientX - walkOx, e.clientY - walkOy);
    } else if (e.pointerId === lookId) {
      e.preventDefault();
      // Down with the lens, for the reason in `stepLens`: a thumb has learned a
      // number of degrees per centimetre of glass, not a number of radians.
      const g = 0.0060 * (camera.fov / baseFov);
      if (ground) ground.look((e.clientX - lookX) * g, (e.clientY - lookY) * g);
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
  addEventListener('pointerup', endGround);
  addEventListener('pointercancel', endGround);
  // Boarding the aeroplane, or being killed, with a thumb still down.
  addEventListener('blur', () => {
    if (walkId !== null) endGround({ pointerId: walkId });
    if (lookId !== null) endGround({ pointerId: lookId });
  });

  hold('t-jet', (v) => { TOUCH.gjet = v; });
  hold('t-look', (v) => { TOUCH.glook = v; });
  tap('t-up', () => launchOut());
  tap('t-in', () => toggleGround());
  // On foot this is V again, and V already means both things: outside the house
  // it walks you up to it, inside it swaps the roof. One button, and the label
  // says which — see `updateGroundHUD`.
  tap('t-roof', () => skipToVikendica());
  tap('t-pc', () => skipToComputer());
  tap('t-gset', () => togglePanel());
  tap('t-gpause', () => togglePause());
  tap('t-run', (el) => {
    TOUCH.grun = !TOUCH.grun;
    el.classList.toggle('on', TOUCH.grun);
  });
  // Both of these are B. They do not set their own `on` class: `toggleBodyCam`
  // does it for both at once, because the flag they show is also cleared from
  // under them when you leave the body.
  tap('t-body', () => toggleBodyCam());

  // ── under the canopy ──────────────────────────────────────────────────────
  // The same two halves once more. What is different is that one stick carries
  // all three controls rather than two of them, which is not a compromise: on a
  // real canopy your two hands do exactly this. Sideways hauls a riser. Forward
  // is the front risers — faster, steeper, further upwind. Back is the brakes,
  // and all the way back is the flare, which is why it is a threshold and not a
  // proportion: a flare is a thing you commit to at ten metres, not a dial.

  const chutePad = document.getElementById('chutepad');
  const chuteKnob = document.getElementById('chuteknob');
  let cId = null, cOx = 0, cOy = 0;
  let cLookId = null, cLookX = 0, cLookY = 0;

  function chuteTo(dx, dy) {
    const r = padRadius;
    let x = clamp(dx / r, -1, 1);
    let y = clamp(-dy / r, -1, 1);
    if (Math.hypot(x, y) < 0.12) { x = 0; y = 0; }
    TOUCH.cx = x; TOUCH.cy = y;
    chuteKnob.style.transform = `translate(${x * r * 0.6}px, ${-y * r * 0.6}px)`;
  }

  // On the window, for the reason above — and this one had the same fault and
  // was very much harder to notice, because the canopy flies itself well enough
  // that a descent with no input at all still lands you somewhere.
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    if (state.phase !== 'chute' || isControl(e.target)) return;
    e.preventDefault();
    if (e.clientX < innerWidth * 0.46 && cId === null) {
      cId = e.pointerId;
      cOx = e.clientX; cOy = e.clientY;
      chutePad.style.left = `${cOx}px`;
      chutePad.style.top = `${cOy}px`;
      chutePad.classList.add('on');
      capture(e.pointerId);
      chuteTo(0, 0);
    } else if (cLookId === null) {
      cLookId = e.pointerId;
      cLookX = e.clientX; cLookY = e.clientY;
      capture(e.pointerId);
    }
  }, { passive: false });

  addEventListener('pointermove', (e) => {
    if (e.pointerId === cId) {
      e.preventDefault();
      chuteTo(e.clientX - cOx, e.clientY - cOy);
    } else if (e.pointerId === cLookId) {
      e.preventDefault();
      if (eject) eject.look((e.clientX - cLookX) * 0.0060, (e.clientY - cLookY) * 0.0060);
      cLookX = e.clientX; cLookY = e.clientY;
    }
  }, { passive: false });

  const endChute = (e) => {
    if (e.pointerId === cId) {
      cId = null;
      TOUCH.cx = TOUCH.cy = 0;
      chutePad.classList.remove('on');
      chuteKnob.style.transform = '';
    } else if (e.pointerId === cLookId) {
      cLookId = null;
    }
  };
  addEventListener('pointerup', endChute);
  addEventListener('pointercancel', endChute);
  addEventListener('blur', () => {
    if (cId !== null) endChute({ pointerId: cId });
    if (cLookId !== null) endChute({ pointerId: cLookId });
  });

  // ── in the water ──────────────────────────────────────────────────────────
  // The third and last of these, and the one that had to exist: bailing out
  // over the channel is one tap on a phone, and what a thumb arrived to was a
  // sea it could look at and not move in. The walk stick is gated on `ground`,
  // so in `swim` there was no stick, no head, and nothing on screen except a
  // set of buttons for walking that all did nothing. Floating, breathing,
  // watching the shore stay exactly where it was.
  //
  // Left thumb swims, right half is the head — the same two halves as
  // everywhere else. The difference is the third axis. On a keyboard C dives
  // and Space rises; they are *held*, they are fighting a lifejacket that
  // never stops pulling, and they are the only controls in the game whose
  // whole job is to be sustained. So they are two big buttons where SCOOP and
  // DROP live in the air, in reach of the same thumb, and not a second stick.

  const swimPad = document.getElementById('swimpad');
  const swimKnob = document.getElementById('swimknob');
  let sId = null, sOx = 0, sOy = 0;
  let sLookId = null, sLookX = 0, sLookY = 0;

  function swimTo(dx, dy) {
    const r = padRadius;
    let x = clamp(dx / r, -1, 1);
    let y = clamp(-dy / r, -1, 1);
    if (Math.hypot(x, y) < 0.12) { x = 0; y = 0; }
    TOUCH.sx = x; TOUCH.sy = y;
    swimKnob.style.transform = `translate(${x * r * 0.6}px, ${-y * r * 0.6}px)`;
  }

  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    // The boat borrows this strip whole, because it is the same two halves
    // meaning the same two things — a thumb that walks and a half-screen that
    // is a head — and a fifth control scheme for a mode with two axes in it
    // would be a fifth set of ways to be wrong. What the boat does not have is
    // DIVE, UP and AUTO; `paintBrodTouch` takes those off it.
    if ((state.phase !== 'swim' && state.phase !== 'brod')
      || isControl(e.target)) return;
    e.preventDefault();
    if (e.clientX < innerWidth * 0.46 && sId === null) {
      sId = e.pointerId;
      sOx = e.clientX; sOy = e.clientY;
      swimPad.style.left = `${sOx}px`;
      swimPad.style.top = `${sOy}px`;
      swimPad.classList.add('on');
      capture(e.pointerId);
      swimTo(0, 0);
    } else if (sLookId === null) {
      sLookId = e.pointerId;
      sLookX = e.clientX; sLookY = e.clientY;
      capture(e.pointerId);
    }
  }, { passive: false });

  addEventListener('pointermove', (e) => {
    if (e.pointerId === sId) {
      e.preventDefault();
      swimTo(e.clientX - sOx, e.clientY - sOy);
    } else if (e.pointerId === sLookId) {
      e.preventDefault();
      // Slower than on foot, because `swim.look` is already slower than
      // `ground.look` for its own reason — you are looking through a mask at a
      // body that is lying down — and a thumb should feel that difference
      // rather than have it cancelled out by a bigger gain.
      if (swim) swim.look((e.clientX - sLookX) * 0.0050, (e.clientY - sLookY) * 0.0050);
      sLookX = e.clientX; sLookY = e.clientY;
    }
  }, { passive: false });

  const endSwim = (e) => {
    if (e.pointerId === sId) {
      sId = null;
      TOUCH.sx = TOUCH.sy = 0;
      swimPad.classList.remove('on');
      swimKnob.style.transform = '';
    } else if (e.pointerId === sLookId) {
      sLookId = null;
    }
  };
  addEventListener('pointerup', endSwim);
  addEventListener('pointercancel', endSwim);
  addEventListener('blur', () => {
    if (sId !== null) endSwim({ pointerId: sId });
    if (sLookId !== null) endSwim({ pointerId: sLookId });
  });

  hold('t-dive', (v) => { TOUCH.sdown = v; });
  hold('t-rise', (v) => { TOUCH.sup = v; });
  // Latched, unlike the two above and like RUN on foot: a sprint in the water
  // is a thing you *are* doing for twenty seconds, and a thumb that has to
  // stay on it is a thumb that is not on the stick.
  tap('t-fast', (el) => {
    TOUCH.sfast = !TOUCH.sfast;
    el.classList.toggle('on', TOUCH.sfast);
  });
  tap('t-sbody', () => toggleBodyCam());
  tap('t-sauto', () => toggleSwimAuto());
  // ASHORE is the same door E is, and on the boat E means the boat's version
  // of it: the gangway alongside at Šibenik, over the side anywhere else.
  tap('t-ashore', () => (state.phase === 'brod' ? leaveBrod() : goAshore()));
  tap('t-sset', () => togglePanel());
  tap('t-spause', () => togglePause());

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
  // The lever only travels to the stop; the number carries on past it, so the
  // overboost gate reads as 100 climbing to 150 rather than as nothing at all.
  num.textContent = Math.round((p.throttle + p.boost * FLIGHT.overboost) * 100);

  document.getElementById('t-scoop').classList.toggle('armed', p.scoopValid);
  document.getElementById('t-drop').classList.toggle('armed',
    p.water > 200 && state.altAgl > 3);
  document.getElementById('t-ap').classList.toggle('on', p.autopilot);
}

/**
 * And the one button in the water that is not always available.
 *
 * Called from `paintSwimHud`, which already knows the answer — `canWade` is
 * what the hint line is written off. ASHORE stays dim until there is a bottom
 * under your own feet, because a button that is always lit and only sometimes
 * does anything teaches a thumb nothing.
 */
function paintSwimTouch(wade, auto) {
  for (const id of ['t-dive', 't-rise', 't-fast', 't-sauto']) {
    document.getElementById(id).hidden = false;
  }
  document.getElementById('t-ashore').classList.toggle('armed', !!wade);
  document.getElementById('t-sauto').classList.toggle('on', !!auto);
}

/**
 * The same strip, minus the three buttons a boat has no use for.
 *
 * DIVE, UP and a swim autopilot are all controls for a body in the water, and
 * a button that is lit and does nothing is worse than no button: it is a thumb
 * learning something untrue. ASHORE stays and is always armed, because on the
 * boat it always does something — over the side is a thing you are allowed to
 * do at any point on those four and a half kilometres.
 */
function paintBrodTouch() {
  for (const id of ['t-dive', 't-rise', 't-fast', 't-sauto']) {
    document.getElementById(id).hidden = true;
  }
  document.getElementById('t-ashore').classList.add('armed');
}

initTouch();
