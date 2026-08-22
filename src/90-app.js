// -----------------------------------------------------------------------------
// The game: renderer, loading, input, camera, mission and the frame loop.
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const canvas = $('stage-canvas');

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
});
// A phone reports a device pixel ratio of 3 and then cannot fill it: this is a
// deferred-lit scene with a shadow cascade and twenty thousand instanced trees,
// and rendering it at 3x is the difference between 60 fps and 12.
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_SMALL ? 1.25 : IS_TOUCH ? 1.6 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.setClearColor(0x87a8bd, 1);

/**
 * What this machine's GL will actually do, printed on the screen.
 *
 * `?gl` and nothing else, because the one class of bug this game has that
 * cannot be reproduced from here is a driver's: a figure that renders
 * perfectly on a desktop and comes apart on a phone is not a bug you can find
 * by reading the shader, and a phone has no console to ask. The limits below
 * are the ones a skinned figure can run out of, and the two lines under them
 * are every shader error and exception the page has managed to raise — a
 * program that failed to link says so here and nowhere else.
 */
function glReport() {
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const P = (s, k) => {
    const f = gl.getShaderPrecisionFormat(gl[s], gl[k]);
    return f ? f.precision : '?';
  };
  return {
    build: BUILD.v + ' ' + BUILD.date,
    gl: (typeof WebGL2RenderingContext !== 'undefined'
      && gl instanceof WebGL2RenderingContext) ? 2 : 1,
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'masked',
    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'masked',
    vertUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
    varyings: gl.getParameter(gl.MAX_VARYING_VECTORS),
    attribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
    vertTex: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
    texSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    // Whether a vertex program can have full float precision at all. A driver
    // that says 0 here gets mediump for everything, and mediump cannot hold a
    // world 42 km wide.
    vertHigh: P('VERTEX_SHADER', 'HIGH_FLOAT'),
    fragHigh: P('FRAGMENT_SHADER', 'HIGH_FLOAT'),
    depth: gl.getParameter(gl.DEPTH_BITS),
    dpr: +devicePixelRatio.toFixed(2),
    px: +renderer.getPixelRatio().toFixed(2),
    screen: screen.width + 'x' + screen.height,
    small: IS_SMALL, touch: IS_TOUCH,
  };
}

if (QUERY.has('gl')) {
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;margin:0;'
    + 'padding:6px 8px;background:#000c;color:#9f9;font:11px/1.35 monospace;'
    + 'max-width:100vw;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(pre);
  const errs = [];
  const paint = () => {
    const r = glReport();
    pre.textContent = Object.entries(r).map(([k, v]) => k + ': ' + v).join('\n')
      + (errs.length ? '\n\nERRORS\n' + errs.slice(0, 6).join('\n') : '\n\nno errors');
  };
  const note = (s) => {
    s = String(s).slice(0, 300);
    if (!errs.includes(s)) errs.push(s);
    paint();
  };
  addEventListener('error', (e) => note(e.message || e.error));
  for (const k of ['error', 'warn']) {
    const was = console[k].bind(console);
    console[k] = (...a) => { was(...a); note(a.join(' ')); };
  }
  paint();
  setInterval(paint, 2000);
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 1.2, 42000);
camera.position.set(0, 600, 0);

const frustum = new THREE.Frustum();
const _pv = new THREE.Matrix4();

/**
 * The long lens, and why getting a closer look is a lens and not a step.
 *
 * The near plane is 1.2 m. It has to be roughly there: the far plane is 42 km,
 * a depth buffer has 24 bits, and the precision you get is set by the *ratio* of
 * the two — drop the near plane to 15 cm and the ridges across the channel start
 * fighting with each other. So walking up to somebody's face does not work.
 * Inside 1.2 m she is not close, she is gone: the near plane cuts the head off
 * and you look straight through her at the sea.
 *
 * Which is exactly the problem a telephoto lens exists to solve, and it solves
 * it here for the same reason it does on a beach: you cannot get closer to the
 * thing, so you change the angle it subtends instead. Held, on Z, from about a
 * metre and a half, 11° puts her face across three quarters of the frame — near
 * enough to count eyelashes, which is now a thing there is a point in counting.
 *
 * Geometric rather than linear on the way in, because a lens is: halving the
 * angle doubles the magnification, wherever you start from, so equal steps of
 * `zoom` feel like equal steps of zoom. And the look sensitivity comes down with
 * the angle in `mousemove` below — a head turns at the same rate in the world
 * either way, but at 11° that is five times the pixels, and a view that whips is
 * a view you cannot hold on a face.
 */
const LENS = { min: 11, ease: 5.5 };
let baseFov = 58;
let zoom = 0;

/**
 * How far down time goes at full zoom, and why it hangs off the lens.
 *
 * There is no key for this and there should not be. A long lens is already the
 * gesture for "I am looking at that" — you have given up walking, turning
 * quickly and most of your view to hold on one thing — and slow motion says the
 * same sentence in the other language. Putting them on the same key means they
 * arrive together and leave together, eased by the one number `zoom` already
 * eases, and there is nothing to learn.
 *
 * 0.35 rather than something more dramatic. Past about a third the fire stops
 * reading as fire — a flame at a fifth speed is a slowly waving orange flag —
 * and her clips, which are authored at a real person's tempo, start to look
 * like a body being dragged rather than one moving.
 */
const SLOW = 0.35;

function stepLens(dt) {
  // And in the water, where the reason for it is the same one and stronger.
  // Treading water your eye is eleven centimetres off the surface, which is
  // the lowest viewpoint in the game and the one with the least in it: the
  // fire is a smudge on a hill you cannot walk up, the Canadair is a speck,
  // and the beach you are trying to reach is a line. There is nothing you can
  // do about any of it except look, so let the looking be worth something.
  const want = (state.phase === 'ground' || state.phase === 'swim'
    || state.phase === 'ride' || state.phase === 'foil')
    && (keys.has('KeyZ') || TOUCH.glook) ? 1 : 0;
  zoom = damp(zoom, want, LENS.ease, dt);
  if (zoom < 1e-4 && want === 0) zoom = 0;
  const f = baseFov * Math.pow(LENS.min / baseFov, zoom);
  if (Math.abs(f - camera.fov) > 1e-3) {
    camera.fov = f;
    camera.updateProjectionMatrix();
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  // A paused frame loop draws nothing, so the resized canvas would sit there
  // stretched until you resumed. One frame costs nothing and keeps it honest.
  if (state.paused && (!ao || !ao.render(scene, camera))) renderer.render(scene, camera);
});

// ── input ────────────────────────────────────────────────────────────────────

const keys = new Set();
const input = {
  scoop: false, drop: false, thrUp: false, thrDown: false,
  flaps: false, gear: false,
};
let pointerLocked = false;

/**
 * Chrome hands back a promise here and rejects it whenever the gesture that
 * asked has gone stale — which is routine, not exceptional. Left alone it
 * prints an unhandled rejection on a perfectly ordinary frame.
 */
function grabPointer() {
  try { canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* older API */ }
}

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  // A chord belongs to the browser, not to the game. Every branch below this
  // line is happy to call preventDefault on a bare letter, and R is a letter:
  // start the race and Ctrl+R stops reloading the page, because the handler
  // never asked which keys were being held down with it. The same swallow took
  // Ctrl+W, Ctrl+T, Cmd+R and the rest with it. Nothing in this game is bound
  // to a chord, so the whole class goes back to the browser here, once.
  //
  // Shift is deliberately not in the list: it is a modifier you hold *while*
  // playing — run, in most games — and it never makes a browser shortcut on
  // its own.
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // At the laptop the keyboard belongs to the laptop. Every letter in here is a
  // letter somebody is typing into a prompt, and W A S D would otherwise be
  // four steps across the living room taken by a camera that is not being drawn
  // — you would stand up somewhere else than you sat down. Escape is the way
  // out, which is what Escape means everywhere else in this game too; O is the
  // same key that got you here.
  if (computer.active) {
    if (e.code === 'Escape' || (e.code === 'KeyO' && e.target === document.body)) {
      e.preventDefault(); skipToComputer();
    }
    return;
  }
  if (comp) {
    e.preventDefault();
    if (e.code !== 'Escape') return;
    // Belt and braces: anything that manages to pause the world mid-move — an
    // alt-tab on the way down into the chair — would otherwise freeze the state
    // machine with no way out, because this is the only key it listens to.
    if (state.paused) setPaused(false);
    skipToComputer();
    return;
  }
  if (e.code === 'KeyO') { e.preventDefault(); skipToComputer(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); return; }
  // Ahead of the pause guard on purpose: pausing to read the hint and then
  // pressing the key it told you about should work.
  if (e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); skipToGround(); return; }
  if (e.code === 'Digit9' || e.code === 'Numpad9') { e.preventDefault(); skipToJadrija(); return; }
  // V for the vikendica, and pressed again in there for the other roof. Like
  // 9 it is ahead of the pause guard, because reading the hint and then
  // pressing the key it names should work.
  if (e.code === 'KeyV') { e.preventDefault(); skipToVikendica(); return; }
  // R — the race. Ahead of the pause guard with the other three back doors,
  // and for the same reason: it is a place to be taken to.
  if (e.code === 'KeyR') { e.preventDefault(); startChase(); return; }
  // L and N — the gameplay recorder. L arms a rolling buffer of the last ten
  // seconds of the canvas and N writes it out as a .webm. See src/92-clip.js.
  //
  // L and N because they were what was left. The board is nearly full: WASD,
  // the arrows, Space, Shift and Q move you; C cycles the camera, E is the
  // door, F the foil, G the gear, K the kite, J and U are the two ways out of
  // an aeroplane, T the autopilot, X centres the stick, Z levels the wings, B
  // the third-person camera, R the race, V the vikendica, O the laptop, M the
  // settings, H the HUD, P and Escape the pause, and 0 and 9 the two back
  // doors. That leaves I, L, N and Y, of which L for the rolling *loop* and N
  // for keep-what-just-happened-*now* are the two that mean anything.
  //
  // Ahead of the pause guard, like the back doors above: the whole point of
  // this is to keep something that has just happened, and the most natural
  // thing in the world at that moment is to hit Escape first and think second.
  if (e.code === 'KeyL') { e.preventDefault(); clipToggle(); return; }
  if (e.code === 'KeyN') {
    e.preventDefault();
    if (clipArmed()) clipSave(); else toast(T('clip.hint'));
    return;
  }
  // Q and Shift already hold the sprint on; this is the *press*, which is worth
  // a burst on top of it. `e.repeat` is the whole of the guard — a held key
  // autorepeats at thirty a second and would be an infinite surge.
  if ((e.code === 'KeyQ' || e.code === 'ShiftLeft' || e.code === 'ShiftRight')
    && !e.repeat && state.phase === 'swim' && swim && swim.active) {
    swim.kick();
    // No `return`: Q is also the run latch on foot and Shift is read as a held
    // key elsewhere in this handler, and swallowing them here would be a
    // surprise the next time somebody moves this block.
  }
  // B — round behind her, and back again. Only in the water: it is the only
  // mode with a body to look at, and the only one where being outside your own
  // eyes is not a bug. See `poseSwimBody`.
  if (e.code === 'KeyB') {
    e.preventDefault();
    if (state.phase === 'swim') {
      bodyCam = !bodyCam;
      toast(T(bodyCam ? 'body.on' : 'body.off'));
    }
    return;
  }
  // While the world is stopped, only the settings answer. Cycling the camera or
  // dropping the gear against a frozen simulation puts the picture and the
  // state out of step, and the HUD is not being redrawn to tell you.
  if (state.paused) { if (e.code === 'KeyM') togglePanel(); return; }
  keys.add(e.code);
  if (e.code === 'KeyM') togglePanel();
  if (e.code === 'KeyH') {
    $('hud').hidden = !$('hud').hidden;
    // The recorder's indicator goes with it. It is not part of the flight HUD
    // — it has to show on foot and in the water as well, so it lives outside
    // #hud and keeps its own flag — but H means "furniture off the screen",
    // and a pulsing red dot is furniture. Not that it could ever reach a clip:
    // what is recorded is the canvas, and every HUD in this game is DOM over
    // the top of it. See src/92-clip.js.
    clipHush();
  }
  // E is the door, both ways. It is the only control that means the same thing
  // in both halves of the game, which is why it is not shared with anything.
  if (e.code === 'KeyE') {
    e.preventDefault();
    // In the water E means one thing and it is not this one. Written the other
    // way round — this line first, with no `return` after it — every press out
    // there ran `toggleGround()` against an aeroplane you were four hundred
    // metres from *and then* fell through to the wade, which is the whole of
    // why E in the sea did nothing you could see.
    if (state.phase === 'swim') { wadeAshore(); return; }
    // The kite and the foil are in the water too — `inWater()` has said so all
    // along — and E did nothing in either, because only 'swim' reached the
    // wade. Put the gear away first and then go ashore, which is what the key
    // means everywhere else: E is the door.
    if (state.phase === 'ride' || state.phase === 'foil') {
      if (state.phase === 'ride') dropKite(); else dropFoil();
      if (state.phase === 'swim') wadeAshore();
      return;
    }
    toggleGround();
  }
  // ENTER — jump.
  //
  // Asked for as an escape hatch and that is mostly what it is. The walker
  // follows the ground exactly, so once `confine` has pushed you up against
  // something there is no way over it: you are simply stopped, and if the thing
  // stopping you is a knee-high blocker whose geometry reads as scenery, being
  // stopped by it looks like an invisible wall. A hop clears anything whose top
  // is below your feet — see the airborne test in `confine`.
  //
  // On foot only. In the seat Enter is not a jump and under a canopy you are
  // already off the ground.
  if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    if (state.phase === 'ground' && ground && ground.ok && !state.paused) {
      e.preventDefault();
      ground.hop();
      return;
    }
  }
  // J for e[J]ect. Deliberately not next to anything: it is the one key in the
  // game you cannot take back, and it should not be within reach of the fingers
  // flying the approach.
  if (e.code === 'KeyJ') { e.preventDefault(); baleOut(); }
  // And U is the same idea from a standing start — [U]p. Next door to J on the
  // board, which is right: they are the same act, once with an aeroplane
  // underneath you and once with a promenade. Only on foot; under a canopy you
  // already have one, and in the seat J is the key that does this.
  // K is the kite, both ways, for the same reason E is the door both ways: one
  // key, one idea, and you never have to remember which half of it you are in.
  if (e.code === 'KeyK') {
    e.preventDefault();
    if (state.phase === 'ground') takeKite();
    else if (state.phase === 'ride') dropKite();
    return;
  }
  // F is the foil, both ways, on exactly the argument K is: one key, one idea,
  // and you never have to remember which half of it you are in.
  if (e.code === 'KeyF') {
    e.preventDefault();
    if (state.phase === 'ground') takeFoil();
    else if (state.phase === 'foil') dropFoil();
    return;
  }
  if (e.code === 'KeyU' && state.phase === 'ground') { e.preventDefault(); launchOut(); return; }
  // And Enter is the small one: running at the balcony rail, off it, and down
  // under the cloth on to the promenade. Same key you would hit anyway when
  // you have decided to do something, and it declines quietly — standing still
  // or standing on the beach it is not a jump, and nothing happens.
  if (e.code === 'Enter' && state.phase === 'ground') { e.preventDefault(); hopOut(); return; }
  // T is the autopilot in both seats. In the aeroplane it flies the job list;
  // in the water there is one job and it swims you at it. Same key, same
  // promise — somebody else has the controls until you take them back — which
  // is worth more than a second key would have been.
  if (e.code === 'KeyT' && state.phase === 'swim') {
    e.preventDefault(); toggleSwimAuto(); return;
  }
  if (state.phase === 'ground' || state.phase === 'chute'
    || state.phase === 'swim' || state.phase === 'foil') {
    // On foot, or under a canopy, the aeroplane's controls are all meaningless
    // and several of them would quietly reconfigure an aircraft you are not
    // sitting in — or, by then, an aircraft that is a hole in a hillside.
    if (['Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD',
         'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    return;
  }
  if (e.code === 'KeyC') cycleCamera();
  if (e.code === 'KeyG') input.gear = !input.gear;
  if (e.code === 'KeyX') flight.p.stick.set(0, 0);
  if (e.code === 'KeyT') toggleAutopilot();
  if (['Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyZ',
       'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (flight) flight.p.kb.set(0, 0); });

canvas.addEventListener('click', () => {
  // Never on a touchscreen: there is no pointer to lock, and asking for it on
  // iOS throws up a permission bar over the top of the game.
  if (!IS_TOUCH && (state.phase === 'fly' || state.phase === 'ground'
    || state.phase === 'chute' || state.phase === 'swim') && !pointerLocked) grabPointer();
});
document.addEventListener('pointerlockchange', () => {
  const had = pointerLocked;
  pointerLocked = document.pointerLockElement === canvas;
  // Losing a lock we actually held means the player's attention went somewhere
  // else — Escape, alt-tab, the OS taking the cursor back — so stop the world
  // for them. A lock we never got is *not* a distraction: the browser refuses
  // the request whenever the click that asked for it has gone stale, which is
  // every time, because the ask comes at the end of a thirty-second cinematic.
  // Pausing on that stopped the game on the first frame of flight.
  // The settings panel drops the lock on purpose and is exempt.
  // The settings panel drops the lock on purpose and is exempt. So is sitting
  // down at the laptop, which drops it on purpose too — and pausing on that was
  // a deadlock rather than a nuisance: the pause returns before `stepComputer`,
  // so the camera froze halfway into its move, the terminal never opened, and
  // the only key the computer state machine listens to is one the paused game
  // could not act on. O put you in a Paused screen you could not leave.
  if (had && !pointerLocked && $('panel').hidden && !comp) setPaused(true);
});
addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  // On foot the mouse is a head, not a stick: it moves the view directly and
  // does not spring back. Same device, opposite contract.
  if (state.phase === 'ground') {
    // Scaled by the lens. Radians per pixel is the thing a hand has learned,
    // and it is the field of view that decides how many pixels a radian is.
    const g = 0.0020 * flight.p.sens * (camera.fov / baseFov);
    ground.look(e.movementX * g, e.movementY * g);
    return;
  }
  // On a board it is a head and nothing else. Steering is on the keys, which
  // is not a compromise — see the note on `look` in 59-ride.js. The gain is
  // the walking one rather than the swimming one, because you are standing up
  // and the thing being turned is not lying down in a jacket.
  if (state.phase === 'ride') {
    const g = 0.0022 * flight.p.sens * (camera.fov / baseFov);
    ride.look(e.movementX * g, e.movementY * g);
    return;
  }
  // Standing on a foil board, which is the same head on the same gain: the
  // steering is on the keys here too, because it is a lean and not a look.
  if (state.phase === 'foil') {
    const g = 0.0022 * flight.p.sens * (camera.fov / baseFov);
    foil.look(e.movementX * g, e.movementY * g);
    return;
  }
  // And in the water, where it is a head again — a slower one, because the
  // thing it is turning is lying down in a jacket.
  if (state.phase === 'swim') {
    const g = 0.0017 * flight.p.sens * (camera.fov / baseFov);
    swim.look(e.movementX * g, e.movementY * g);
    return;
  }
  // Same again under the canopy: the mouse is your head. What the canopy does
  // is on the rudder keys, because pulling a riser is a hand, not a look.
  if (state.phase === 'chute') {
    const g = 0.0020 * flight.p.sens;
    eject.look(e.movementX * g, e.movementY * g);
    return;
  }
  const s = 0.0022 * flight.p.sens;
  flight.p.stick.x = clamp(flight.p.stick.x + e.movementX * s, -1, 1);
  flight.p.stick.y = clamp(flight.p.stick.y - e.movementY * s, -1, 1);
});
let mouseDrop = false;
addEventListener('mousedown', (e) => { if (pointerLocked && e.button === 0) mouseDrop = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDrop = false; });

function readKeys(dt) {
  const p = flight.p;
  input.thrUp = keys.has('KeyW');
  input.thrDown = keys.has('KeyS');
  input.scoop = keys.has('Space') || TOUCH.scoop;
  input.drop = keys.has('KeyF') || mouseDrop || TOUCH.drop;
  input.flaps = keys.has('ShiftLeft') || keys.has('ShiftRight');
  p.rudder = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);

  // The arrows are the honest control: held means held, no spring, no drift.
  // Anyone who cannot get on with a mouse stick can fly the whole game here.
  const kx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  const ky = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
  p.kb.x = damp(p.kb.x, kx, 9, dt);
  p.kb.y = damp(p.kb.y, ky, 9, dt);

  // Z is the panic button: centre the stick and hold her level. On a phone it
  // latches instead of being held — you have only so many thumbs.
  p.levelling = keys.has('KeyZ') || TOUCH.level;
  if (p.levelling) p.stick.multiplyScalar(Math.exp(-9 * dt));

  // The spring. Without this the stick keeps whatever you last pushed into it
  // for ever, which is the single thing that made the aeroplane unflyable.
  p.stick.multiplyScalar(Math.exp(-FLIGHT.selfCentre * dt));
  if (p.stick.lengthSq() < 1e-5) p.stick.set(0, 0);

  if (p.autopilot) updateNavTarget(dt);
}

// ── autopilot navigation ─────────────────────────────────────────────────────
// The autopilot flies to whatever the job is right now: an empty tank means
// water, a full one means fire. It lines you up; the scoop and the drop stay
// on your fingers.

let apJob = 'water';        // 'water' | 'fire'
let apRun = null;           // the scoop run we have committed to
let apOnRun = false;        // past the gate, tracking down the run itself
let apFireT = 0, apFire = null;

function updateNavTarget(dt) {
  const p = flight.p;
  const cap = CONFIG.tankCapacity;

  // Hysteresis on the job, or it flips at the threshold and flies neither.
  if (apJob === 'water' && p.water >= cap - 60) { apJob = 'fire'; apRun = null; apOnRun = false; }
  if (apJob === 'fire' && p.water < 300) apJob = 'water';

  if (apJob === 'fire') {
    // Latch the aim point. Re-reading priorityTarget() every few seconds gives
    // a target that hops between cells faster than the turn radius can follow
    // — the same trap 60-ai.js documents. Hold it until it burns out.
    apFireT -= dt;
    if (!apFire || apFireT <= 0 || fire.intensityAt(apFire[0], apFire[1]) < 0.12) {
      apFire = fire.priorityTarget() || fire.nearestFire(p.pos.x, p.pos.z);
      apFireT = 25;
    }
    if (apFire) {
      const d = Math.hypot(apFire[0] - p.pos.x, apFire[1] - p.pos.z);
      p.navTarget = {
        x: apFire[0], z: apFire[1],
        // Glide down onto it the way the wingmen do, rather than arriving high.
        alt: apFire[2] + Math.min(240, 52 + d * 0.16),
        mode: 'fire',
        label: d < 700 ? (IS_TOUCH ? 'ap.overFireTouch' : 'ap.overFire') : 'ap.toFire',
      };
      return;
    }
    apJob = 'water';        // nothing alight: go and sit on the water
  }

  if (!wingmen || !wingmen.runs.length) { p.navTarget = null; return; }

  // ── the water approach ────────────────────────────────────────────────────
  // Track the run's *centreline*, not a point on it. Chasing a point simply
  // orbits: at cruise the turn radius is most of a mile, bigger than any sane
  // capture circle, so the gate stays permanently inside the circle. Pure
  // pursuit along the line converges instead — an ILS intercept, in effect.
  //
  // The catch is that pure pursuit from a long way off-line eats runway: two
  // kilometres of crosstrack takes two kilometres of run to wash out, and the
  // run is 1250 m long. So until she is established the carrot is pinned to a
  // point *before* the threshold, and the intercept happens in open water
  // where there is room for it.

  const lineOf = (r) => {
    const along = (p.pos.x - r.x) * r.dx + (p.pos.z - r.z) * r.dz;
    const cross = r.dx * (p.pos.z - r.z) - r.dz * (p.pos.x - r.x);
    return { along, cross };
  };

  if (apRun) {
    const { along, cross } = lineOf(apRun);
    if (!apOnRun && Math.abs(cross) < 300 && along > -2600) apOnRun = true;
    // Off the end, blown off the line, or past the threshold still not lined
    // up: this approach has failed. Go round on another run rather than fly a
    // ten-metre circuit over the channel hoping.
    // Stay down past the nominal end of the run while the tank still wants
    // filling and there is clear water ahead — otherwise she leaves with
    // two-thirds of a load and has to fly the whole circuit again.
    const room = waterRunClear(p.pos.x, p.pos.z, apRun.dx, apRun.dz, 800, 40);
    const end = (apOnRun && room && p.water < CONFIG.tankCapacity - 600) ? 2600 : 1500;
    if (apOnRun ? (along > end || Math.abs(cross) > 700) : along > -250) {
      apRun = null; apOnRun = false;
    }
  }

  if (!apRun) {
    // Nearest is not good enough: a run whose start is behind us, or that
    // points back the way we came, costs a 180° turn with a half-mile radius.
    const f = flight.axes().fwd;
    const fl = Math.hypot(f.x, f.z) || 1;
    let bd = Infinity, fallback = null, fd = Infinity;
    for (const r of wingmen.runs) {
      const ex = r.x - r.dx * 700, ez = r.z - r.dz * 700;
      const d = Math.hypot(ex - p.pos.x, ez - p.pos.z)
        + 900 * (1 - (r.dx * f.x / fl + r.dz * f.z / fl));
      if (d < fd) { fd = d; fallback = r; }
      if (lineOf(r).along > -600) continue;         // no room left to line up
      if (d < bd) { bd = d; apRun = r; }
    }
    if (!apRun) apRun = fallback;
    apOnRun = false;
  }

  const { along, cross } = lineOf(apRun);

  // The lookahead has to exceed the turn radius or pure pursuit oscillates
  // across the line instead of settling on it.
  const turnR = Math.max(300, state.speed * state.speed / (9.81 * 0.70));
  const look = clamp(Math.abs(cross) * 0.8 + turnR * 1.35, turnR * 1.35, 2600);
  const carrot = apOnRun ? along + look : Math.min(along + look, -350);

  // Down to 7 m, not 9: the scoop is only legal below 14 m AGL and the height
  // loop wanders a few metres either side of whatever it is asked for. Nothing
  // descends until she is established, so a failed approach is flown at a
  // sensible height rather than at ten metres over the sea.
  // A 3° slope beginning two kilometres out, so she is settled at seven metres
  // by the threshold and has the whole run to fill. The earlier 0.13 profile
  // put the descent in the last 800 m and she arrived still coming down, with
  // only a third of the run left to scoop on.
  const alt = apOnRun ? clamp(7 + Math.max(0, -along - 150) * 0.055, 7, 110) : 110;
  const onRun = apOnRun && along > -200 && p.pos.y < 45;

  // Keep the carrot inside the world; chasing one past the edge walked the
  // aeroplane into the boundary and stalled it there.
  const lim = HALF - 800;
  p.navTarget = {
    x: clamp(apRun.x + apRun.dx * carrot, -lim, lim),
    z: clamp(apRun.z + apRun.dz * carrot, -lim, lim),
    alt, along, cross,
    mode: onRun ? 'scoop' : 'toWater',
    label: onRun ? (IS_TOUCH ? 'ap.onWaterTouch' : 'ap.onWater')
      : apOnRun ? 'ap.approach' : 'ap.lining',
  };
}

/**
 * The same thing in the water. The model owns the decision — it is the object
 * that knows where the shore is and whether you are already standing on it —
 * so this is the toast and nothing else.
 */
function toggleSwimAuto() {
  if (!swim || !swim.active) return;
  const on = swim.toggleAuto();
  if (on) toast(T('swim.apOn'));
  else if (swim.apNote === 'far') toast(T('swim.apFar'));
  else if (swim.apNote === 'there') toast(T('swim.apThere'));
  else toast(T('swim.apOff'));
  paintSwimHud();
}

function toggleAutopilot() {
  if (!flight || state.phase !== 'fly') return;
  flight.p.autopilot = !flight.p.autopilot;
  if (flight.p.autopilot) { apRun = null; apOnRun = false; apFire = null; apFireT = 0;
    updateNavTarget(0.016); toast(T('ap.engaged')); }
  else { flight.p.apNote = ''; toast(T('ap.off')); }
}

// ── camera modes ─────────────────────────────────────────────────────────────

const CAMS = ['chase', 'close', 'cockpit', 'wing'];
let camMode = 0;
const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
function cycleCamera() { camMode = (camMode + 1) % CAMS.length; }

// A fixed viewpoint for the screenshot tool, so a shot of a building is a shot
// of a building and not of wherever the aeroplane drifted to while it settled.
let camOverride = null;

function updateCamera(dt) {
  if (camOverride) {
    camera.position.set(camOverride[0], camOverride[1], camOverride[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(camOverride[3], camOverride[4], camOverride[5]);
    return;
  }
  const { fwd, up, right } = flight.axes();
  const p = flight.p.pos;
  const mode = CAMS[camMode];
  const target = new THREE.Vector3();
  const aim = new THREE.Vector3();

  if (mode === 'chase') {
    target.copy(p).addScaledVector(fwd, -46).addScaledVector(up, 13);
    aim.copy(p).addScaledVector(fwd, 60);
  } else if (mode === 'close') {
    target.copy(p).addScaledVector(fwd, -24).addScaledVector(up, 7).addScaledVector(right, 5);
    aim.copy(p).addScaledVector(fwd, 40);
  } else if (mode === 'cockpit') {
    target.copy(p).addScaledVector(fwd, 6.6).addScaledVector(up, 2.1);
    aim.copy(p).addScaledVector(fwd, 400);
  } else {
    target.copy(p).addScaledVector(right, 34).addScaledVector(up, 4).addScaledVector(fwd, -6);
    aim.copy(p);
  }

  // Springy, but not so springy the horizon wallows on a hard turn.
  const k = mode === 'cockpit' ? 60 : 9;
  camPos.lerp(target, 1 - Math.exp(-k * dt));
  camAim.lerp(aim, 1 - Math.exp(-k * 1.4 * dt));
  camera.position.copy(camPos);
  // Roll the camera partway with the aircraft — all the way is nauseating,
  // none at all makes a banked turn read as a slide.
  const blend = mode === 'cockpit' ? 1.0 : 0.42;
  const upv = new THREE.Vector3(0, 1, 0).lerp(up, blend).normalize();
  camera.up.copy(upv);
  camera.lookAt(camAim);

  // Shake goes on *after* the look-at, so it throws the camera about without
  // swinging the aim point around with it — otherwise a hard bump reads as the
  // world lurching rather than as the airframe being hit.
  if (alerts) {
    const s = alerts.shakeOffset(dt, U.uTime.value);
    if (s) camera.position.add(s);
  }
}

// ── the world ────────────────────────────────────────────────────────────────

let terrain, sky, sea, fire, shadow, plane, flight, waterfx, city, wingmen, audio, intro,
  trees, landmarks, alerts, roads, rail, props, airfield, jadrija, ground, birds, eject,
  mirror, mirrorP, swim, under, seabed, arms, mask, kites, ride, foil, chase, you,
  ao;
/** You plus the three wingmen, as the birds see them. Built once, in boot(). */
let birdFlush = [];

function setSun() {
  const a = sunAngles(state.hour);
  state.sunElev = a.elev;
  const s = state.sky = skyStateAt(a.elev);
  U.uSunDir.value.copy(a.dir);
  U.uSunColor.value.setRGB(s.sun[0], s.sun[1], s.sun[2]);
  U.uSunI.value = s.sunI;
  U.uAmbSky.value.setRGB(s.ambSky[0], s.ambSky[1], s.ambSky[2]);
  U.uAmbGround.value.setRGB(s.ambGround[0], s.ambGround[1], s.ambGround[2]);
  U.uAmbI.value = s.ambI;
  U.uZenith.value.setRGB(s.zenith[0], s.zenith[1], s.zenith[2]);
  U.uHorizon.value.setRGB(s.horizon[0], s.horizon[1], s.horizon[2]);
  U.uHazeNear.value.setRGB(s.hazeNear[0], s.hazeNear[1], s.hazeNear[2]);
  U.uHazeFar.value.setRGB(s.hazeFar[0], s.hazeFar[1], s.hazeFar[2]);
  U.uHazeDensity.value = s.density;
  U.uNight.value = s.night;
}

const headingToYaw = (dx, dz) => Math.atan2(-dx, -dz);

/**
 * The two lines that name controls rather than concepts. They cannot be plain
 * data-i18n attributes because which string is right depends on whether there
 * is a keyboard attached, not only on the language.
 */
function paintDeviceText() {
  $('hint').innerHTML = TK('veil.hint', 'veil.hintTouch');
  // The settings panel is the only place the build stamp is still reachable
  // once the title screen is gone, which is when you most want to check it.
  // On foot, every control the flight version names is either meaningless or
  // attached to an aeroplane you are standing next to.
  $('panel-foot').textContent = (state.phase === 'ground'
    ? TK('set.footGround', 'set.footTouch')
    : TK('set.foot', 'set.footTouch')) + ' · v' + BUILD.v;
  $('pause').querySelector('.hint').innerHTML = TK('pause.hint', 'pause.hintTouch');
  if (state.paused) paintPauseState();
}
onLangChange(paintDeviceText);

async function boot() {
  // Language first: everything after this point renders text.
  applyLang();
  paintDeviceText();

  // A painted plate behind the title, at low opacity under the gradient.
  const art = document.createElement('div');
  art.id = 'veil-art';
  $('veil').appendChild(art);
  if (PAYLOAD.panel_volley) art.style.backgroundImage = `url(${PAYLOAD.panel_volley})`;

  const bar = $('bar-fill');
  const stageEl = $('stage');
  // The stage line keeps its key, so switching language mid-load retranslates
  // whatever it is currently saying instead of freezing in the old one.
  let stageKey = 'load.warm';
  onLangChange(() => { stageEl.textContent = T(stageKey); });
  const step = async (pct, key) => {
    bar.style.width = pct + '%';
    stageKey = key;
    stageEl.textContent = T(key);
    await new Promise((r) => setTimeout(r, 16));
  };

  await step(6, 'load.unpack');
  await loadWorld((k) => { stageKey = k; stageEl.textContent = T(k); });

  await step(34, 'load.wind');
  // Lebić — the south-westerly. It is what pushes a fire off Jadrija and up
  // the peninsula toward the town, and it is why today is a bad day.
  state.windDir = -0.35;
  state.windSpeed = 9.5;
  U.uWind.value.set(Math.cos(state.windDir), Math.sin(state.windDir));
  U.uWindSpeed.value = state.windSpeed;
  setSun();

  await step(44, 'load.sky');
  sky = buildSky(scene);

  await step(52, 'load.cascade');
  shadow = buildShadow(renderer);

  await step(60, 'load.terrain');
  terrain = buildTerrain(scene);

  await step(70, 'load.sea');
  sea = buildSea(scene);
  under = buildUnder(scene);
  seabed = buildBed(scene);
  ride = buildRide(scene);
  foil = buildFoil(scene);
  chase = await buildChase(scene);

  await step(74, 'load.stone');
  resolveLandmarks();
  landmarks = await buildLandmarks(scene);

  await step(78, 'load.city');
  // Jadrija first: it claims the footprints it is going to rebuild in detail,
  // and the town builder has to know about that before it draws them.
  jadrija = await buildJadrija(scene);
  // The one surface in the game that is a view rather than a colour. Costs a
  // dot product everywhere except stood in front of it — see `49-mirror.js`.
  if (jadrija && jadrija.vik) {
    mirror = bathMirror(jadrija.vik);
    mirrorP = bathMirrorP(jadrija.vik);
  }
  // And the one thing that stands in it. Built whether or not the mirror is,
  // because the mirror is the only place it is ever drawn and a missing house
  // is not a reason to fail loading a body.
  you = await buildYou(scene);
  if (mirror && you) mirror.guests.push(you.mesh);
  if (mirrorP && you) mirrorP.guests.push(you.mesh);
  city = buildCity(scene);

  await step(80, 'load.streets');
  airfield = buildAirfield(scene);
  // The aerodrome is the one place in the game you stand still and look at the
  // ground, so it is the one place a missing shadow is obvious. Static casters:
  // a hangar does not move.
  shadow.cast(airfield.buildings);
  shadow.cast(airfield.objMesh);
  if (jadrija) for (const m of jadrija.casters) shadow.cast(m);
  // The skinned figure brings her own depth material, because her shape lives
  // in a bone palette that the two shared ones know nothing about. Near
  // cascade: she is 1.75 m and the far map cannot draw anything under two.
  if (jadrija && jadrija.figure) jadrija.figure.cast(shadow);
  roads = buildRoads(scene);
  rail = buildRail(scene);
  props = buildProps(scene, roads.lanes);
  if (IS_SMALL) props.setDensity(0.45);
  // Cars, boats, parasols and everybody on the beach. Near cascade only — see
  // the note on `nearOnly` in src/06-shadow.js — and instanced, because the
  // depth pass has to reproduce SOLID_VERT's transform exactly or a shadow
  // lands somewhere its object is not.
  for (const k in props.layers) {
    shadow.cast(props.layers[k].mesh, { instanced: true, near: true });
  }
  if (jadrija) {
    for (const m of jadrija.crowd.meshes()) {
      shadow.cast(m, { instanced: true, near: true });
    }
  }

  await step(82, 'load.fuel');
  fire = buildFire(scene);
  // After the fire, because the ground mission is downstream of it in every
  // sense: it does not exist until the front is close enough to throw embers.
  ground = await buildGround(scene, airfield);
  // The ground crew, who had exactly the same problem as the bathers: eleven
  // parts each, all of them moving, none of them attached to the apron. Dynamic
  // because they walk, and near-only because a person is under four texels of
  // the far map.
  for (const c of ground.crew) {
    if (c.fig) shadow.castTree(c.fig.root, { dynamic: true, near: true });
  }
  // And the one person in the world the branch can be pointed at who is not on
  // the strength. Wired here rather than in either module because this is the
  // only place that has both of them: 43-jadrija.js is built before the ground
  // mode exists and knows nothing about hoses, and 47-ground.js knows nothing
  // about her.
  if (jadrija && jadrija.figureProbe) {
    ground.addGuest(jadrija.figureProbe, jadrija.figureWet);
    // The dog is a second guest and not a special case of the first. He is
    // hittable for exactly as long as he exists — `dogProbe` returns null when
    // he does not — and what he does about it is his own business.
    ground.addGuest(jadrija.dogProbe, jadrija.dogWet);
    // And the transistor set on the table in the kabina, which is a guest in
    // the same sense: something in the world the jet can land on that the hose
    // code has no business knowing anything else about.
    ground.addGuest(jadrija.radioProbe, jadrija.radioWet);
    // And the television beside it, which answers the same way for the same
    // reason: each hit knocks the knob round one channel, and the last position
    // on the dial is the end of the band.
    ground.addGuest(jadrija.tvProbe, jadrija.tvWet);
  }

  await step(85, 'load.maquis');
  trees = buildTrees(scene, fire);
  // A phone gets a third of the forest by default. Only as a *default* — the
  // slider still goes to the top, and anything already chosen is restored over
  // this by buildPanel().
  //
  // 0.35 rather than the old 0.5 because the budget and the radius both went
  // up and a tree went from 60 triangles to 96: at 0.5 a phone would now be
  // drawing nearly three times the vegetation it was tuned for.
  if (IS_SMALL) trees.setDensity(0.35);
  // Trees cast into both cascades. A pine is 7 to 13 m, which is sixteen
  // texels of the far map — coarse, but a real shape, and a hillside of maquis
  // with no shadow in it is the flattest thing in this world after the sea.
  // Two models a species since the close-up set arrived, so this is a layer of
  // nesting deeper than it was. Both cast: the near one is the one you are
  // standing under, and a tree whose shadow is the shape of a different tree is
  // the sort of thing that is only ever noticed on foot.
  for (const k in trees.layers) {
    for (const lod in trees.layers[k]) {
      shadow.cast(trees.layers[k][lod].mesh, { instanced: true });
    }
  }

  // The birds go up with the maquis because they belong to it: gulls over the
  // channel, swifts over the roofs, crows over the karst. They cost two draws
  // for the whole flock, so a phone gets fewer of them rather than none.
  birds = buildBirds(scene, fire);
  if (IS_SMALL) birds.setDensity(0.4);

  await step(88, 'load.plane');
  // Once, before anything builds an aeroplane: the player's and all three
  // wingmen's come out of the same table, and buildCanadair() falls back to the
  // hand-built airframe on its own if this comes back null.
  CANADAIR_RIG = await loadRig('canadair_fr3d');
  plane = buildCanadair();
  scene.add(plane.root);
  // `hero`: the aeroplane goes in the group that is drawn into the far cascade
  // even on the frames nothing else is — see `always` in 06-shadow.js. Over
  // open water it is the only thing out there that can cast on anything, and
  // its shadow crossing the sea underneath you is the one people watch.
  shadow.castTree(plane.root, { dynamic: true, hero: true });
  waterfx = buildWaterFX(scene);
  flight = buildFlight(plane, fire);
  eject = buildEject(scene, flight, chuteDown);
  swim = buildSwim(sea);
  arms = buildArms();
  mask = buildMask(scene);
  // The occlusion pass. Built here rather than beside the renderer because it
  // allocates nothing until somebody turns it on, and on a phone nobody does.
  ao = buildAO(renderer);
  ao.set(CONFIG.ao);
  kites = buildKites(scene, jadrija);

  await step(92, 'load.brief');
  wingmen = buildWingmen(scene, fire, (who, text) => radio(who, text));
  // Slot 0 is you, refreshed every frame because the flight model owns that
  // position; the wingmen are their own live objects and already carry `pos`
  // and `speed`, so they go in by reference and stay current for free.
  birdFlush = [{ pos: null, speed: 0 }, ...wingmen.planes];

  await step(95, 'load.engines');
  audio = buildAudio();
  alerts = buildAlerts(audio);

  await step(97, 'load.projector');
  intro = buildIntro(scene, camera, {
    fire, audio, plane, flight,
    setGrade: (g) => {
      canvas.style.filter =
        `saturate(${g.sat}) contrast(${g.con}) brightness(${g.bright})`;
      $('tint').style.background = g.tint;
    },
    caption: (html) => {
      const el = $('cine-caption');
      el.className = html ? 'doc on' : 'doc';
      el.innerHTML = html;
    },
  });

  startMission();

  await step(100, 'load.ready');
  $('enter').hidden = false;
  $('watch').hidden = !introSeen();
  $('hint').hidden = false;
}

// ── mission ──────────────────────────────────────────────────────────────────

const mission = {
  t: 0, radioQueue: [], radioTimer: 0, best: 0, radioNow: null,
};

function startMission() {
  const [ix, iz] = CONFIG.ignitionPoint;
  // Seed a small cluster, so it is already a fire rather than a match.

  // Start out over the open sea, pointed at the smoke, tanks full.
  const sx = -4300, sz = 3400;
  const dx = ix - sx, dz = iz - sz;
  const d = Math.hypot(dx, dz);
  flight.reset(sx, sz, headingToYaw(dx / d, dz / d), 540);
  flight.p.water = CONFIG.tankCapacity;

  state.t = 0;
  state.score = 0;
  state.litresDropped = 0;
  state.litresOnTarget = 0;
  state.phase = 'intro';
}

/** Both arguments are i18n keys — the callsign and the line. */
function radio(who, text, delay = 0) {
  mission.radioQueue.push({ who, text, delay });
}

function paintRadio(m) {
  $('radio').innerHTML = m
    ? `<div class="line"><span class="who">${T(m.who)}</span> &nbsp;${T(m.text)}</div>`
    : '';
}

function updateRadio(dt) {
  mission.radioTimer -= dt;
  if (mission.radioTimer <= 0 && mission.radioQueue.length) {
    const m = mission.radioQueue.shift();
    mission.radioNow = m;
    paintRadio(m);
    if (audio) audio.squelch();
    mission.radioTimer = 3.6 + T(m.text).length * 0.035;
  } else if (mission.radioTimer <= 0 && mission.radioNow) {
    mission.radioNow = null;
    paintRadio(null);
  }
}

onLangChange(() => { if (mission.radioNow) paintRadio(mission.radioNow); });

// ── settings ─────────────────────────────────────────────────────────────────

const SETTINGS = [
  // Meaningless without a mouse, so it is not offered to a thumb.
  { key: 'sens', label: 'set.sens', min: 0.25, max: 2.5, step: 0.05, desktopOnly: true,
    get: () => flight.p.sens, set: (v) => { flight.p.sens = v; },
    fmt: (v) => v.toFixed(2) + '×' },
  { key: 'assist', label: 'set.assist', min: 0, max: 1, step: 0.05,
    get: () => flight.p.assist, set: (v) => { flight.p.assist = v; },
    fmt: (v) => Math.round(v * 100) + '%' },
  { key: 'volume', label: 'set.volume', min: 0, max: 1, step: 0.05,
    get: () => audio.getVolume(), set: (v) => audio.setVolume(v),
    fmt: (v) => v <= 0.001 ? T('set.off') : Math.round(v * 100) + '%' },
  { key: 'trees', label: 'set.trees', min: 0, max: 1.6, step: 0.05,
    get: () => trees.getDensity(), set: (v) => trees.setDensity(v),
    fmt: (v) => v <= 0.001 ? T('set.off') : Math.round(v * 100) + '%' },
  { key: 'props', label: 'set.props', min: 0, max: 1, step: 0.05,
    get: () => props.getDensity(), set: (v) => props.setDensity(v),
    fmt: (v) => v <= 0.001 ? T('set.off') : Math.round(v * 100) + '%' },
  { key: 'birds', label: 'set.birds', min: 0, max: 1, step: 0.05,
    get: () => birds.getDensity(), set: (v) => birds.setDensity(v),
    fmt: (v) => v <= 0.001 ? T('set.off') : Math.round(v * 100) + '%' },
  // `baseFov` and not `camera.fov`: the lens sits on top of this, and reading
  // the live angle back would have the slider jump to 11 the moment somebody
  // opened the settings with Z held down — and then save that as their taste.
  { key: 'fov', label: 'set.fov', min: 45, max: 95, step: 1,
    get: () => baseFov,
    set: (v) => { baseFov = v; camera.fov = v; camera.updateProjectionMatrix(); },
    fmt: (v) => Math.round(v) + '°' },
  // Ambient occlusion, and the slider is the strength rather than a switch:
  // zero is genuinely off — the renderer goes back to drawing straight at the
  // canvas and allocates nothing — and everything above it is how dark a
  // corner is allowed to get. It is also the one setting in here that is a
  // frame-rate control, which is why it is offered rather than simply turned
  // on: it costs a few per cent on a desktop and rather more on a thumb.
  { key: 'ao', label: 'set.ao', min: 0, max: 1, step: 0.05,
    get: () => (ao ? ao.strength : 0), set: (v) => { if (ao) ao.set(v); },
    fmt: (v) => (v <= 0.001 ? T('set.off') : Math.round(v * 100) + '%') },
  { key: 'exposure', label: 'set.exposure', min: 0.55, max: 1.4, step: 0.02,
    get: () => renderer.toneMappingExposure, set: (v) => { renderer.toneMappingExposure = v; },
    fmt: (v) => v.toFixed(2) },
];

/** Rows are kept so the labels can be rewritten when the language changes. */
const settingRows = [];

function buildPanel() {
  const host = $('panel-rows');
  if (host._built) return;
  host._built = true;

  // ── the language picker ─────────────────────────────────────────────────
  const pick = $('lang-pick');
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.textContent = LANG_LABEL[l];
    b.title = STRINGS[l]['lang.name'];
    b.addEventListener('click', () => setLang(l));
    pick.appendChild(b);
  }
  const paintPicker = () => {
    [...pick.children].forEach((b, i) => b.classList.toggle('on', LANGS[i] === getLang()));
  };
  paintPicker();
  onLangChange(paintPicker);

  // ── the sliders ─────────────────────────────────────────────────────────
  const shown = SETTINGS.filter((s) => !(s.desktopOnly && IS_TOUCH));
  for (const s of shown) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = '<label><span></span><b></b></label>'
      + `<input type="range" min="${s.min}" max="${s.max}" step="${s.step}">`;
    const name = row.querySelector('span');
    const out = row.querySelector('b'), inp = row.querySelector('input');
    inp.value = s.get();
    name.textContent = T(s.label);
    out.textContent = s.fmt(s.get());
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      s.set(v);
      out.textContent = s.fmt(v);
      try { localStorage.setItem('fr.' + s.key, String(v)); } catch (e) { /* private mode */ }
    });
    host.appendChild(row);
    settingRows.push({ s, name, out, inp });
  }
  // Whatever you settled on last time is what you get this time.
  for (const r of settingRows) {
    let v = null;
    try { v = localStorage.getItem('fr.' + r.s.key); } catch (e) { /* ignore */ }
    if (v == null) continue;
    const n = parseFloat(v);
    if (Number.isFinite(n)) {
      r.s.set(clamp(n, r.s.min, r.s.max));
      r.inp.value = n;
      r.out.textContent = r.s.fmt(n);
    }
  }

  // Both the label and the *value* can be words — "off" is a translated
  // string, not a number — so the whole row is repainted, not just the name.
  onLangChange(() => {
    for (const r of settingRows) {
      r.name.textContent = T(r.s.label);
      r.out.textContent = r.s.fmt(parseFloat(r.inp.value));
    }
  });
}

function togglePanel() {
  if (!flight) return;
  buildPanel();
  const el = $('panel');
  el.hidden = !el.hidden;
  if (!el.hidden) document.exitPointerLock?.();
  else if (!IS_TOUCH && state.phase === 'fly') grabPointer();
}

// ── pause ────────────────────────────────────────────────────────────────────

/** The line under the word: what, exactly, you walked away from. */
function paintPauseState() {
  if (!fire) return;
  const ha = fire.burningCount() * (fire.cell * fire.cell) / 1e4;
  $('pause-sub').textContent = (ha < 10 ? ha.toFixed(1) : Math.round(ha))
    + ' ha ' + T('pause.alight') + ' · Šibenik ' + Math.round(state.cityHealth * 100) + '%';
}

function setPaused(on) {
  // Only while there is a mission to stop. Pausing the loader would strand the
  // world build, and the cinematic and the end screen have their own answer to
  // "make it stop" — the skip button and the reload.
  //
  // `swim` is on this list because it is a place you can be, and every place
  // you can be in this game can be walked away from. It was missing for the
  // simple reason that it was written after the list was: being in the water
  // is the newest of the five, and the breath clock does not stop for a
  // doorbell — which is the one mode where not being able to stop it actually
  // costs you something.
  if (state.phase !== 'fly' && state.phase !== 'crashing'
    && state.phase !== 'ground' && state.phase !== 'chute'
    && state.phase !== 'swim') return;
  if (state.paused === on) return;
  state.paused = on;
  $('pause').hidden = !on;
  audio.setPaused(on);

  if (on) {
    paintPauseState();
    // Nothing survives the pause held down. Coming back to full right rudder
    // because that is what your hand was doing thirty seconds ago is the
    // classic way a pause button loses an aeroplane.
    keys.clear();
    mouseDrop = false;
    TOUCH.scoop = TOUCH.drop = false;
    flight.p.kb.set(0, 0);
    flight.p.stick.set(0, 0);
    document.exitPointerLock?.();
  } else if (!IS_TOUCH && $('panel').hidden) {
    grabPointer();
  }
}

const togglePause = () => setPaused(!state.paused);

/**
 * The door. Getting out needs the aeroplane stopped on the pavement with the
 * wheels down; getting back in needs you standing next to it. Both directions
 * are the same key because from the player's side it is the same act.
 */
function toggleGround() {
  if (!ground || !ground.ok || state.paused) return;
  if (state.phase === 'ground') {
    if (ground.leave()) {
      $('ground-hud').hidden = true;
      $('hud').hidden = false;
      if (IS_TOUCH) { $('gtouch').hidden = true; $('touch').hidden = false; }
      // The chase camera has been parked at the aeroplane this whole time as
      // far as it knows. Start it where the eyes actually are, or boarding
      // whips the view across the apron.
      camPos.copy(camera.position);
      camAim.copy(flight.p.pos);
      paintDeviceText();
      toast(T('toast.boarded'));
    }
    return;
  }
  if (ground.enter()) {
    $('hud').hidden = true;
    $('ground-hud').hidden = false;
    if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = false; }
    if (!IS_TOUCH) grabPointer();
    // The settings panel names a different set of controls on foot, and the
    // phase has only just changed.
    paintDeviceText();
    toast(T('toast.onFoot'));
  }
}

// The prompt is also the button. On a phone there is nowhere left in the flight
// controls to put a sixth one, and on a desktop clicking the thing that just
// told you to press E is a reasonable thing to try.
$('ground-prompt').addEventListener('click', (e) => {
  e.preventDefault();
  toggleGround();
});

/** Put the aeroplane on the apron, stopped, wheels down, tank untouched. */
function parkAtApron() {
  if (!airfield || !airfield.site) return false;
  const a = airfield.stand;
  // reset() empties the tank and firewalls the throttle, because it exists to
  // start a mission. Keep the water: arriving at Rokići with a dry aeroplane
  // means one pack of four hundred litres and then nothing at all.
  const water = flight.p.water;
  flight.reset(a[0], a[2], airfield.standYaw, 400);
  flight.p.water = water;
  flight.p.pos.set(a[0], a[1] + FLIGHT.gearHeight, a[2]);
  flight.p.vel.set(0, 0, 0);
  flight.p.onGround = true;
  flight.p.gearOut = 1;
  flight.p.throttle = 0;
  // The gear animates toward input.gear every frame, so setting gearOut alone
  // retracts it again within a second and the aeroplane falls through its own
  // apron. In normal play this is true because you pressed G on the approach.
  input.gear = true;
  return true;
}

/**
 * What to say when a back door is pressed and you are already through one.
 *
 * Both of them used to answer this with "E to climb back in", which is right at
 * Rokići, where the aeroplane is thirty metres behind you with the door open,
 * and a lie at Jadrija, where there is no aeroplane at all — you arrived by the
 * same route as a bale-out and the airframe is gone. Being told to press a key
 * that does nothing, by a game that put you where you are, is worse than being
 * told nothing.
 *
 * `stranded` is the same flag `canBoard` reads, so the toast and the HUD hint
 * cannot disagree.
 */
function afootToast() {
  return ground.stranded ? T('ground.noPlane')
    : TK('ground.board', 'ground.boardTouch');
}

/**
 * The back door, on `0`.
 *
 * The ground mission sits behind a twenty-minute flight, a spot fire that has to
 * find the airfield on its own, and a landing — which is the right way round for
 * playing it and a ridiculous thing to ask of somebody who just wants to see
 * whether it is any good. This lights the field, puts the aeroplane on the apron
 * and opens the door, in one key.
 *
 * It is not hidden. There is no achievement here to protect.
 */
/**
 * Out of whichever water mode is running, without landing you anywhere.
 *
 * The three back doors — 0 for the apron, 9 for the terrace, V for the
 * vikendica — were all written against `state.phase === 'fly'`, because when
 * they were written the only other place you could be was in the seat. There
 * are two more now and both of them are out in the channel, which is exactly
 * where a way out is worth most: swimming four hundred metres back in to look
 * at a kitchen is not a thing anybody should have to do twice.
 *
 * It leaves the mode and nothing else — the caller is about to put you
 * somewhere, and a function that also decided where would be two answers to
 * one question.
 */
/**
 * Out of whichever water mode you are in, and take the race with you.
 *
 * `was` is which one that is, and it is a parameter rather than simply
 * `state.phase` because of a trap that has already been walked into once:
 * `ground.dropIn()` sets `state.phase` to 'ground' *itself*, before it
 * returns. So a caller that puts you on the beach first and tidies up second —
 * which is the right order, because the drop-in is the step that can fail —
 * finds the phase already changed and this function silently doing nothing.
 * The symptom was a swim that stayed `active` for the rest of the game: the
 * mask kept its frame on the screen, and the front clip stayed at the
 * underwater plane while you walked around a village.
 */
function leaveWater(was = state.phase) {
  // Whatever else is going on, the race does not survive leaving the water.
  //
  // The cut is cleared unconditionally and the race only if it is running, and
  // that asymmetry is the whole point: the two are not live at the same time.
  // `startChase` puts the shot up *first* and starts the race from a beat two
  // seconds into it, so for the length of the wide shot and her dive there is a
  // `chaseCut` driving her and no `chase.active` at all. Clearing the cut only
  // when the race was running — which is what this did — meant that a V or a 0
  // pressed in that window tore down the swim and left the shot running: it
  // re-drove her into the dive pose every frame, from inside the vikendica,
  // and overwrote the walk-up's camera while it was at it. She turned up in the
  // bathroom mirror mid-dive with the sea still playing.
  if (chase && chase.active) chase.stop();
  chaseCut = null;
  if (you) you.drive(null);
  bodyCam = false;
  $('chase-hud').hidden = true;
  // Whatever took you out, the mask comes off in the same frame — see the note
  // on `reset` in 62-mask.js. Ahead of the branches on purpose: it is cheap, it
  // is idempotent, and putting it inside the swim branch would mean trusting
  // `was` to be right about a thing you can see on your own face.
  if (mask) mask.reset();
  if (was === 'swim') {
    swim.leave();
    $('swim-hud').hidden = true;
    $('under').classList.remove('on');
    $('under').hidden = true;
    if (IS_TOUCH) $('stouch').hidden = true;
    wasUnder = false;
    return true;
  }
  if (was === 'ride') {
    ride.leave();
    $('ride-hud').hidden = true;
    if (IS_TOUCH) $('stouch').hidden = true;
    return true;
  }
  if (was === 'foil') {
    foil.leave();
    $('foil-hud').hidden = true;
    if (IS_TOUCH) $('stouch').hidden = true;
    return true;
  }
  return false;
}

/** True where a back door is allowed to fire from. */
const inWater = () => state.phase === 'swim' || state.phase === 'ride'
  || state.phase === 'foil';

// Two rings of eight bearings: one at the near cascade's reach, one at the far
// cascade's. `shoreAt` saturates at 400 m, so on its own it can promise that
// much clear in every direction and no more; the outer ring covers the band
// between 400 and the far cascade's own 450. A rock small enough to sit
// between two probes is a rock, and it is 44 cm to a texel out there.
const _ring = (r) => [[r, 0], [-r, 0], [0, r], [0, -r],
  [r * 0.71, r * 0.71], [-r * 0.71, r * 0.71],
  [r * 0.71, -r * 0.71], [-r * 0.71, -r * 0.71]];
const _SEA_NEAR = _ring(70);
const _SEA_FAR = _ring(460);
const _allSea = (x, z, ring) => {
  if (!isSea(x, z)) return false;
  for (const [dx, dz] of ring) if (!isSea(x + dx, z + dz)) return false;
  return true;
};

/**
 * Water under you and nothing on it — which is the one situation where the
 * shadow pass draws the whole landscape into maps that have nothing in them.
 *
 * Two answers, because there are two cascades and they reach different
 * distances. `near` means there is nothing but sea within 70 m of your eye,
 * which is the near cascade's 55 m plus margin: over the channel that is true
 * long before the shore is out of range of the far one. `far` means nothing
 * within 460 m either, which off Jadrija means the open Adriatic.
 *
 * Tested on the camera and not the aeroplane because the near cascade is aimed
 * at the eye, and every view in this game keeps the two within fifty metres of
 * each other, so one position answers for both.
 */
function overWater() {
  if (!CONFIG.shadowSkip || state.phase !== 'fly' || !world.cover) return null;
  const p = camera.position;
  // Below this your own shadow is still landing somewhere you can see the
  // detail of, and the near cascade has boats in it.
  if (p.y < 120) return null;
  if (!_allSea(p.x, p.z, _SEA_NEAR)) return null;
  return shoreAt(p.x, p.z) >= 395 && _allSea(p.x, p.z, _SEA_FAR)
    ? 'far' : 'near';
}

/**
 * Which cascades to draw this frame.
 *
 * Reads as a ladder from "everything" down to "your own shadow on the sea".
 * The one line worth pausing on is the last: over water a phone gets `solo`
 * rather than `near`, which is *more* than it had — a phone has no far cascade
 * at all, so the far map is free to hold the aeroplane, and two draw calls buy
 * back the shadow crossing the water underneath you.
 */
function shadowMode() {
  const w = overWater();
  if (!w) return CONFIG.shadowFar ? 'both' : 'near';
  return w === 'far' || !CONFIG.shadowFar ? 'solo' : 'far';
}

function skipToGround() {
  if (!ground || !ground.ok || !airfield || !airfield.site) return;
  if (state.phase === 'ground') { toast(afootToast()); return; }
  if (state.phase !== 'fly' && !inWater()) return;
  if (state.paused) setPaused(false);
  ground.force();                 // arm the field and light it, now, not in a minute
  if (!parkAtApron()) return;
  // Out of the sea first, or `toggleGround` would put you on the apron with a
  // swim still running underneath it and a breath bar counting down.
  if (inWater()) {
    leaveWater();
    state.phase = 'fly';
  }
  toggleGround();
  toast(T('toast.cheat'));
}

/**
 * The other back door, on `9`.
 *
 * Jadrija is where the figure on the promenade is, and reaching her the honest
 * way means flying out over the channel and taking the seat on J — a bale-out
 * at the right place over a resort you cannot land at. So this is deliberately
 * *not* the `0` door: nothing is parked anywhere and the aeroplane does not
 * follow you down. It is the parachute arrival with the parachute taken out,
 * which is why it goes through `dropIn` — the same call `chuteDown` makes when
 * you walk away from a landing — and leaves you stranded exactly as that does.
 *
 * You are put sixteen metres up the promenade from her and facing her, which is
 * just outside the distance at which she notices you. Walking the last few
 * metres is the whole point; being dropped on top of her is not.
 */
function skipToJadrija() {
  if (!ground || !ground.ok || !jadrija || !jadrija.figureAt) return;
  if (state.phase === 'ground') { toast(afootToast()); return; }
  if (state.phase !== 'fly' && !inWater()) return;
  if (state.paused) setPaused(false);
  leaveWater();
  const [ft, fs] = jadrija.figureAt;
  const w = jadrija.toWorld(ft + 16, fs - 1);
  const her = jadrija.toWorld(ft, fs);
  if (!ground.retarget(jadrija)) return;
  if (!ground.dropIn(w[0], w[2],
    Math.atan2(-(her[0] - w[0]), -(her[2] - w[2])))) return;
  $('hud').hidden = true;
  $('chute-hud').hidden = true;
  $('ground-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = false; }
  if (!IS_TOUCH) grabPointer();
  paintDeviceText();
  toast(T('toast.cheatJad'));
}

// ── the way in ───────────────────────────────────────────────────────────────
/**
 * The walk up to the vikendica, as a shot rather than as a teleport.
 *
 * Six legs along the promenade, up the outside flight, across the landing and
 * in through the front door, in the resort's own (t, s) frame with the height
 * written out separately — because the whole point of the sequence is the
 * height: the floor of this house is 2.9 m over the concrete and seventeen
 * risers is the reason it is 2.9 and not 3. A camera that arrives at the door
 * without having climbed to it has not told you anything.
 *
 * `at` is where the eye is, `look` is what it is on, `dur` is how long the leg
 * takes, and the pair is interpolated with a smoothstep so each leg eases out of
 * the last one instead of snapping. The last leg's `at` and `look` are also
 * where you are standing and what you are facing when it hands back control:
 * the cut ends on the shot, not near it.
 */
// Written as offsets ALONG THE SHORE FROM THE HOUSE, not as absolute t.
//
// These were absolute — 23.6 to 33.5 — and correct while `VIK.t` was 24.0.
// The house moved to 232 to stand where the real one does, on the last of the
// open frontage west of the mole, and the shot did not go with it: eleven
// seconds of camera walking up a staircase two hundred metres away over bare
// beach. `s` and the heights are unchanged, because neither the house's
// distance from the water nor its floor levels moved.
//
// `VIK` is declared in 44-vikendica.js, which the build concatenates before
// this file, so it is initialised by the time this literal is evaluated.
const VIK_WALK = [
  // Along the promenade from the east, with the house coming up on your left
  // and the water on your right.
  { at: [VIK.t + 9.5, 15.4, 1.76], look: [VIK.t + 2.5, 22.0, 3.20], dur: 2.6 },
  // At the foot of the flight, looking up it. This is the shot the whole thing
  // exists for — a first-row house is a house you look *up* at from the walk.
  // The foot moved: the flight now starts at the south face of the house, at
  // s 21.54, where it used to run out to 20.39.
  { at: [VIK.t + 4.8, 20.5, 1.72], look: [VIK.t + 4.1, 25.6, 4.30], dur: 1.8 },
  // Up. Two legs, because a single easing over 2.9 m of rise reads as a lift.
  { at: [VIK.t + 4.1, 23.1, 3.12], look: [VIK.t + 4.1, 26.0, 4.50], dur: 1.7 },
  { at: [VIK.t + 4.1, 25.0, 4.56], look: [VIK.t + 3.0, 25.3, 4.30], dur: 1.6 },
  // Through the door, and the room opens out to the left.
  { at: [VIK.t + 2.4, 25.2, 4.56], look: [VIK.t - 0.4, 24.0, 4.30], dur: 1.7 },
  // And stop where you would stop: in the middle of the floor with the terrace
  // and the channel in front of you.
  { at: [VIK.t + 1.3, 24.10, 4.56], look: [VIK.t + 1.1, 15.50, 4.20], dur: 1.9 },
];

let vikWalk = null;
/**
 * Wall time held off the walk-up, for `__fr.vik.cutAt`.
 *
 * A page rendering at one frame a second cannot film a shot that is driven by
 * the clock — the clock is the thing that is wrong. So the recorder freezes it
 * and scrubs the sequence to an absolute time before each capture, and this is
 * the switch that stops the frame loop putting its own `real` back in.
 */
let vikHold = false;

// A way out of it that does not need a keyboard. Every touch layer is hidden
// while the sequence runs — that is what makes it a shot rather than a walk
// with the controls drawn over it — so on a phone there would otherwise be no
// button to press and eleven seconds is a long time when you have seen it.
// Any touch, anywhere, ends it and leaves you standing where it was going.
addEventListener('pointerdown', () => { if (vikWalk) endVikWalk(); });

/** Start the sequence. Returns false if the locale is not up yet. */
function startVikWalk() {
  if (!jadrija || !jadrija.vik || !ground || !ground.ok) return false;
  const p = jadrija.toWorld(VIK_WALK[0].at[0], VIK_WALK[0].at[1]);
  if (!ground.retarget(jadrija)) return false;
  if (!ground.dropIn(p[0], p[2], 0)) return false;
  vikWalk = { leg: 0, u: 0 };
  $('hud').hidden = true;
  $('chute-hud').hidden = true;
  $('ground-hud').hidden = true;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = true; }
  return true;
}

/**
 * One frame of it. Driven by wall time and not world time: the lens slow-motion
 * has nothing to do with a walk up a staircase, and a sequence that stretched
 * because somebody was holding the zoom would be a bug nobody could describe.
 */
function stepVikWalk(dt) {
  if (!vikWalk) return;
  const base = jadrija.vik.base;
  const K = VIK_WALK;
  vikWalk.u += dt / K[vikWalk.leg].dur;
  while (vikWalk.u >= 1 && vikWalk.leg < K.length - 1) {
    vikWalk.u -= 1; vikWalk.leg += 1;
  }
  if (vikWalk.leg >= K.length - 1 && vikWalk.u >= 1) { endVikWalk(); return; }
  const a = K[vikWalk.leg], b = K[Math.min(vikWalk.leg + 1, K.length - 1)];
  const f = vikWalk.u * vikWalk.u * (3 - 2 * vikWalk.u);
  const pt = (key) => {
    const t = lerp(a[key][0], b[key][0], f), s = lerp(a[key][1], b[key][1], f);
    const w = jadrija.toWorld(t, s);
    return [w[0], base + lerp(a[key][2], b[key][2], f), w[2]];
  };
  const eye = pt('at');
  const aim = pt('look');
  camOverride = [eye[0], eye[1], eye[2], aim[0], aim[1], aim[2]];
}

/** Put the walker where the last frame of the shot was, and give the keys back. */
function endVikWalk() {
  vikWalk = null;
  camOverride = null;
  const last = VIK_WALK[VIK_WALK.length - 1];
  const p = jadrija.toWorld(last.at[0], last.at[1]);
  const q = jadrija.toWorld(last.look[0], last.look[1]);
  ground.put(p[0], p[2], Math.atan2(-(q[0] - p[0]), -(q[2] - p[2])), -0.06);
  $('hud').hidden = true;
  $('chute-hud').hidden = true;
  $('ground-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = false; }
  if (!IS_TOUCH) grabPointer();
  paintDeviceText();
  toast(T('toast.cheatVik'));
}

// ── the laptop ───────────────────────────────────────────────────────────────
/**
 * Sitting down at it, and getting up again.
 *
 * The same shape as the walk up to the house and for the same reason: the
 * screen is a div, and a div that simply appears is a menu. What makes it a
 * laptop on a table is the three seconds either side of it — the room swinging
 * round, the chair arriving, the terrace going out of frame behind the glass —
 * so the camera flies to the seat, holds there for as long as you are typing,
 * and flies back to where you were standing when you get up.
 *
 * `back` is that spot. Losing it is the difference between standing up from a
 * desk and being teleported to one.
 */
let comp = null;

function compAt(name) {
  const L = jadrija && jadrija.vik && jadrija.vik.plan.laptop;
  return L ? jadrija.vik.at(L[name]) : null;
}

/** The eye, and what it is looking at, as one six-vector. */
function camNow() {
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  const p = camera.position;
  return [p.x, p.y, p.z, p.x + d.x * 2, p.y + d.y * 2, p.z + d.z * 2];
}

function startComputer() {
  if (!jadrija || !jadrija.vik || !ground || !ground.ok) return false;
  const seat = compAt('seat'), scr = compAt('screen');
  if (!seat || !scr) return false;
  if (state.paused) setPaused(false);
  // Get on to your feet at Jadrija first if you are not already, so that
  // standing up afterwards lands you in a mode that has a floor.
  let back;
  if (state.phase === 'ground' && jadrija.inField(ground.you.x, ground.you.z)) {
    back = [ground.you.x, ground.you.z, ground.you.yaw, ground.you.pitch];
  } else {
    if (!ground.retarget(jadrija)) return false;
    if (!ground.dropIn(seat[0], seat[2], 0)) return false;
    back = [seat[0], seat[2], 0, -0.15];
  }
  const from = camNow();
  // A seated eye, and the screen 40 cm in front of it.
  const to = [seat[0], seat[1], seat[2], scr[0], scr[1], scr[2]];
  comp = { phase: 'in', u: 0, from, to, back };
  $('hud').hidden = true;
  $('chute-hud').hidden = true;
  $('ground-hud').hidden = true;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = true; }
  if (document.pointerLockElement) document.exitPointerLock();
  return true;
}

function stepComputer(dt) {
  if (!comp) return;
  const ease = (u) => u * u * (3 - 2 * u);
  if (comp.phase === 'held') { camOverride = comp.to.slice(); return; }
  comp.u += dt / (comp.phase === 'in' ? CRT.sit : CRT.rise);
  const done = comp.u >= 1;
  const f = ease(clamp(comp.u, 0, 1));
  const a = comp.phase === 'in' ? comp.from : comp.to;
  const b = comp.phase === 'in' ? comp.to : comp.from;
  camOverride = a.map((v, i) => lerp(v, b[i], f));
  if (!done) return;
  if (comp.phase === 'in') {
    comp.phase = 'held';
    camOverride = comp.to.slice();
    computer.open();
  } else {
    endComputer();
  }
}

/** Stand up: put the walker back where they were and give the keys back. */
function endComputer() {
  if (!comp) return;
  const back = comp.back;
  comp = null;
  camOverride = null;
  computer.close();
  ground.put(back[0], back[1], back[2], back[3]);
  $('ground-hud').hidden = false;
  if (IS_TOUCH) $('gtouch').hidden = false;
  if (!IS_TOUCH) grabPointer();
  paintDeviceText();
}

/**
 * Put the branch on the laptop and it wakes up.
 *
 * A discovery rather than a keystroke — O is in the hint text and this is not,
 * and finding out that the one machine in the flat responds to being hosed is
 * worth more than being told. It is also the only thing in the game you are
 * *supposed* to point four hundred litres at that is not on fire.
 *
 * Measured against where the branch is *pointed*, not against `you.aim`. That
 * was the first cut and it never once fired: `you.aim` is where the jet trace
 * stops, and the trace stops on the *terrain* — which indoors on the upper
 * floor is a metre under the floorboards, so the aim point was always out on
 * the hillside somewhere through the west wall, tens of metres from a laptop
 * two metres in front of your face. Nothing about the laptop was wrong; the
 * question was.
 *
 * So: is the laptop within four metres and within a hand's width of the line
 * the water is going down. 42 cm off that line at two metres is about 12°,
 * which is generous, and it should be — a jet is not a laser and somebody who
 * has decided to hose a laptop should not have to be accurate about it.
 */
let sprayHeld = 0;
const sprayDir = new THREE.Vector3();
function checkLaptopSpray() {
  if (state.phase !== 'ground' || !ground || !ground.you || !jadrija) {
    sprayHeld = 0; return;
  }
  const you = ground.you;
  if (!you.spraying || you.jet < 0.4) { sprayHeld = 0; return; }
  const p = compAt('at');
  if (!p) { sprayHeld = 0; return; }
  camera.getWorldDirection(sprayDir);
  const e = camera.position;
  const vx = p[0] - e.x, vy = p[1] - e.y, vz = p[2] - e.z;
  const along = vx * sprayDir.x + vy * sprayDir.y + vz * sprayDir.z;
  if (along < 0.30 || along > 4.0) { sprayHeld = 0; return; }
  const off = Math.hypot(vx - sprayDir.x * along, vy - sprayDir.y * along,
    vz - sprayDir.z * along);
  // Held, not touched. A jet that sweeps across the desk on its way to
  // something else should not sit you down.
  sprayHeld = off < 0.42 ? sprayHeld + 1 : 0;
  if (sprayHeld > 24) { sprayHeld = 0; ground.setSpray(false); skipToComputer(); }
}

/**
 * And the set on the cabinet, which answers the same way the one in the kabine
 * does: hit it and the channel goes round.
 *
 * Same geometry as the laptop's, one latch shorter — a television is a metre
 * across and you are not going to miss it, and the reward for hitting it is a
 * channel and not a mode change, so it does not need to be sure you meant it.
 * The 0.8 m radius is the set plus the cabinet under it, because water hitting
 * the cabinet is water hitting the television as far as anybody watching is
 * concerned.
 */
let tvHeld = 0;
function checkTvSpray() {
  const vik = jadrija && jadrija.vik;
  if (state.phase !== 'ground' || !ground || !ground.you || !vik || !vik.tv) {
    tvHeld = 0; return;
  }
  const you = ground.you;
  if (!you.spraying || you.jet < 0.4) { tvHeld = 0; return; }
  const p = vik.tv.at();
  camera.getWorldDirection(sprayDir);
  const e = camera.position;
  const vx = p[0] - e.x, vy = p[1] - e.y, vz = p[2] - e.z;
  const along = vx * sprayDir.x + vy * sprayDir.y + vz * sprayDir.z;
  if (along < 0.30 || along > 5.0) { tvHeld = 0; return; }
  const off = Math.hypot(vx - sprayDir.x * along, vy - sprayDir.y * along,
    vz - sprayDir.z * along);
  tvHeld = off < 0.55 ? tvHeld + 1 : 0;
  if (tvHeld > 10) { tvHeld = 0; vik.tv.knock(); if (audio) audio.radioClick(true); }
}

/**
 * O — the computer. Also what spraying the laptop does.
 *
 * Pressed at it, it stands you up again, which is the same key doing the same
 * job in reverse and is the contract every other door in this game keeps.
 */
function skipToComputer() {
  if (comp && comp.phase === 'out') return;
  if (comp) {
    // Get up: shut the glass first so the room is already there behind it as
    // the camera pulls back, then fly home.
    computer.close();
    comp = { phase: 'out', u: 0, from: comp.from, back: comp.back,
      to: camOverride ? camOverride.slice() : comp.to };
    return;
  }
  if (!startComputer()) toast(T('toast.noComputer'));
}

/**
 * V — the vikendica.
 *
 * Pressed from the air, or from anywhere at Jadrija that is not the house
 * itself, it plays the walk up: along the promenade, up the outside flight and
 * in through the door. Pressed again once you are in there it swaps the roof —
 * which is the whole reason the house was modelled, and the comparison is worth
 * a keystroke.
 *
 * The walk can be cut short by pressing V again, which is not a courtesy: this
 * is a debug door as much as a piece of cinema, and eleven seconds is a long
 * time when you are checking whether a wall is in the right place.
 */
function skipToVikendica() {
  if (!ground || !ground.ok || !jadrija || !jadrija.vik) return;
  const vik = jadrija.vik;
  if (state.paused) setPaused(false);
  if (vikWalk) { endVikWalk(); return; }

  // Already inside: the key becomes the roof switch. "Inside" is generous on
  // purpose — anywhere on the floor plate, terrace included, because comparing
  // the two roofs from the terrace is a fair thing to want.
  if (state.phase === 'ground') {
    const [t, s] = jadrija.local(ground.you.x, ground.you.z);
    if (vik.floorAt(t, s, ground.you.y) != null) {
      const now = vik.roof(vik.roofNow === 'loft' ? 'now' : 'loft');
      toast(T(now === 'loft' ? 'toast.vikLoft' : 'toast.vikNow'));
      return;
    }
  }
  if (state.phase !== 'fly' && state.phase !== 'ground' && !inWater()) return;
  // Same as the other two: the walk-up is a camera shot and a swim left
  // running under it would still be counting your breath.
  if (inWater()) { leaveWater(); state.phase = 'fly'; }
  startVikWalk();
}

// ── the race out to the platform ─────────────────────────────────────────────
/**
 * R — she is already on the end of the jetty.
 *
 * A door rather than a discovery, which is the answer to "how does it start"
 * that the other three cheats already gave: 0 is the apron, 9 is the terrace,
 * V is the house and R is the swim.
 *
 * Pressed again it starts the race over rather than cancelling it, which is the
 * one place this key differs from the other three. Written as a toggle it was a
 * race you could stop by leaning on the key, and — worse — a second press
 * arriving in the same frame as the first, which is a thing keyboards and test
 * harnesses both do, left you in the water with the shot half run and nothing
 * to chase. Restart is what "press R to go again" in the lost message means
 * anyway; the way out of the water is the way out of the water.
 *
 * The shot before it is three legs, exactly as the walk up to the vikendica is,
 * and it is here for the same reason: dropping straight into the water with a
 * gap counter on the screen is a menu. What makes it a race is seeing the two
 * ends of it — the jetty behind, the platform ahead, and her already between
 * them — before anybody hands you the controls.
 */
let chaseCut = null;
function startChase() {
  if (!jadrija || !jadrija.swimRun || !swim || !chase || !ground || !ground.ok) {
    return false;
  }
  if (state.paused) setPaused(false);
  if (chase.active) { chase.stop(); chaseCut = null; }
  const r = jadrija.swimRun;
  leaveWater();
  if (state.phase === 'ground') ground.bail();
  eject.reset();
  const yaw = Math.atan2(-(r.board[0] - r.start[0]), -(r.board[1] - r.start[1]));
  if (!swim.enter(r.start[0], r.start[1], yaw, 0)) return false;
  state.phase = 'swim';
  $('hud').hidden = true;
  $('chute-hud').hidden = true;
  $('ground-hud').hidden = true;
  $('ride-hud').hidden = true;
  // Both HUDs stay off until the shot has finished. A breath bar and a gap
  // counter over an establishing shot is the game telling you about a race you
  // have not been shown yet.
  $('swim-hud').hidden = true;
  $('chase-hud').hidden = true;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = true;
    $('ctouch').hidden = true; $('stouch').hidden = false; }
  // The race itself does not begin here any more. It begins when she hits the
  // water, four seconds into the shot — see the `shedives` beat. Starting it
  // up front is what made the old cut a title card over a race already in
  // progress rather than the start of one.
  wasUnder = false;

  // The shot. World metres, built from the two ends of the run so that moving
  // the platform moves the camera with it.
  const dx = r.board[0] - r.start[0], dz = r.board[1] - r.start[1];
  const L = Math.hypot(dx, dz) || 1;
  const ux = dx / L, uz = dz / L;          // down the course
  const nx = -uz, nz = ux;                 // and across it
  const P = (a, b, y) => [r.start[0] + ux * a + nx * b, y,
    r.start[1] + uz * a + nz * b];
  // Where the run-up starts, which is back up the jetty and not on it: the
  // resort's own frame is the only thing that knows which way the boards run,
  // so the point is taken there and brought back out rather than guessed at
  // from the two ends of the swim.
  const [jt, js] = jadrija.local(r.jetty[0], r.jetty[2]);
  // Where the boards stop, and it has to be measured rather than assumed.
  //
  // `r.jetty` is not the end of the jetty — it is three metres back from it,
  // because it is the mark somebody *stands* on. Taking off from there and
  // reaching `CUT.reach` past it puts the entry at about 2.6 m short of the
  // edge, which is to say on the concrete: both of them dived into the deck,
  // she first and Chloe after her, and the splash went off in the middle of the
  // boards. The run now ends at the last half metre of the jetty and the arc
  // carries on from there over open water.
  const jEnd = jadrija.local(r.jettyEnd[0], r.jettyEnd[2])[1];
  const runFrom = jadrija.toWorld(jt, js + CUT.runUp);
  const runTo = jadrija.toWorld(jt, jEnd);
  const rdx = runTo[0] - runFrom[0], rdz = runTo[2] - runFrom[2];
  const rL = Math.hypot(rdx, rdz) || 1;
  // Her heading down the jetty, in the game's own convention: forward is
  // (−sin yaw, −cos yaw), so this is the yaw that faces the water.
  const runYaw = Math.atan2(-rdx / rL, -rdz / rL);
  const deckY = r.jetty[1];

  // The shot's own frame, and it is the *jetty's* and not the swim course's.
  // Those two are not the same line — the course leaves from beside the jetty
  // head and runs out to the platform, while the run-up and both dives happen
  // along the boards — and building the cameras in the course frame is what
  // pointed every one of them at open water with the action off the edge of it.
  // `a` is metres seaward from the jetty head, `b` is metres to one side.
  const jx = rdx / rL, jz = rdz / rL;
  const J = (a, b, y) => [r.jetty[0] + jx * a - jz * b, y,
    r.jetty[2] + jz * a + jx * b];

  chaseCut = {
    u: 0,
    leg: 0,
    // Everything the beats need that is not the camera. Held here rather than
    // recomputed per frame, because a shot that is solved every frame is a
    // shot that drifts when the frame rate does.
    run: { from: runFrom, to: runTo, yaw: runYaw, y: deckY,
      len: rL, ux: rdx / rL, uz: rdz / rL },
    // Where she stands, and where the two of them go in. Her entry is the
    // point the race starts from; yours is where the camera ends up.
    hers: [r.start[0], r.start[1]],
    fired: {},
    legs: [
      // 1. High, behind the run-up and off to one side: the boards leading
      //    away, her standing on the end of them, and the platform out in the
      //    channel past her shoulder. The whole race in one frame before
      //    anybody moves.
      { at: J(-19.5, 9.0, deckY + 5.4), look: J(1.5, 0, deckY + 0.7),
        dur: CUT.wide, beat: 'stand' },
      // 2. Down at the water off the end of the jetty, looking back up at her.
      //    This is the only angle from which a dive is a dive rather than a
      //    person disappearing downwards — you have to be below the thing
      //    somebody is coming off.
      { at: J(5.2, 3.5, deckY - 0.10), look: J(1.4, 0, deckY + 0.55),
        dur: CUT.hers, beat: 'shedives' },
      // 3. Beside the boards, low, while you come down them. The leg is here
      //    for the interpolation either side of it — what actually points the
      //    camera through this beat is the tracking in `stepCutBeat`, because
      //    a fixed frame with somebody running across it is a shot of a jetty.
      { at: J(-5.0, 4.2, deckY + 1.2), look: J(1.5, 0, deckY + 1.0),
        dur: CUT.run, beat: 'run' },
      // 4. And back in the water for your own, so she comes at the camera off
      //    the end of the boards rather than away from it.
      { at: J(5.0, 2.1, deckY + 1.10), look: J(2.4, 0, deckY + 0.25),
        dur: CUT.yours, beat: 'youdive' },
      // 5. Into the swim, where the camera already is.
      { at: P(0, 0, 0.24), look: P(40, 0, 0.1), dur: CUT.settle, beat: 'swim' },
    ],
  };
  // She is on the end of the jetty and has not gone yet — which is the one
  // thing the old shot could not show, because the race began before it did.
  if (chase.stop) chase.stop();
  chase.poise(runTo[0], deckY, runTo[2], runYaw, 'idle');
  // And you are on the boards behind her, with the mask already on: it is a
  // race to a diving platform and you have been standing here watching her.
  if (you) {
    you.drive({ at: [runFrom[0], deckY, runFrom[2]], yaw: runYaw + Math.PI / 2,
      clip: 'idle', mask: true, wet: true });
  }
  paintChaseHud();
  toast(T('chase.on'));
  return true;
}

// -----------------------------------------------------------------------------
// Looking at yourself in the water.
//
// Every mode in this game is behind your own eyes, and in three of them that is
// the only place it could be: you are in a cockpit, under a canopy, or holding
// a branch. The water is the one that is not. A swimmer is the most legible
// thing a person can be from outside — the roll, the arm coming over, the wake
// off the heels — and from inside it is a horizon that goes up and down.
//
// So B swings the camera round behind her, and the body it finds there is not a
// new one: it is the same Chloe who has been standing in the mirror since
// 49-you.js, driven off the swim's own state instead of off the camera. She
// gets the mask on out here, because out here you can see it — the one in
// 62-mask.js is the inside of the same object and only exists when you are
// behind it.
// -----------------------------------------------------------------------------

/**
 * How far under she and you ride during the race, in metres.
 *
 * Half a metre: deep enough that you are looking through water at somebody
 * rather than at two heads in the chop, and shallow enough that the surface is
 * still right there with the light coming through it.
 */
const RACE_DEEP = 0.5;

const BODY = {
  // How far back and how high the camera sits, in metres, and where it aims
  // relative to her. Low and close: a swimmer seen from six metres up is a
  // dot on a plane, and what is worth looking at here is at the surface.
  back: 2.5, up: 0.72, ahead: 4.5, aim: 0.05,
  // How deep she floats, prone and upright, in metres below the surface. Two
  // numbers and not one, for the reason 61-chase.js sets out at length: the
  // `swim` clip is authored lying down and the `tread` clip is authored
  // standing, so the rig's own origin is at her waist in the first and under
  // her feet in the second. One number for both stands her on the sea.
  sink: 0.34,
  sinkUp: 0.88,
  // And how quickly the rig catches up with a camera that is being flung
  // about. She is being told where to be rather than swimming there, so
  // without this every flick of the mouse is a body teleporting.
  ease: 9.0,
};

/** Third person in the water: off, or on with the mask down. */
let bodyCam = false;
const _bodyAt = new THREE.Vector3();
let _bodyHas = false;

/**
 * Put her in the water under the camera, and — if the third person is on —
 * put the camera behind her.
 *
 * Called after `swim.pose`, which has already put the camera at her eye. That
 * ordering is the whole trick: the eye is the one point both cameras agree
 * about, so the body is hung off the first person's answer and the second
 * person is hung off the body. Nothing has to be solved twice.
 */
function poseSwimBody(dt) {
  if (!you) return;
  // The shot owns her while it is running, and it puts her on a jetty rather
  // than in the water. Nothing here may touch that — including, in
  // particular, the tidy-up below, which would otherwise take her off the
  // boards on the first frame of the cut if the third person happened to be
  // on when R was pressed.
  if (chaseCut) return;
  if (!bodyCam || !swim.active) {
    if (_bodyHas) { you.drive(null); _bodyHas = false; }
    return;
  }
  const w = swim.you;
  const yaw = w.yaw;
  // Her root, which is her eye taken back down the line she is facing: the
  // swim clip is authored lying down, so the rig's own origin is between her
  // feet and the head is a body-length forward of it along +X.
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const prone = Math.hypot(w.vx, w.vz) > 0.25;
  // Prone, her root is a body-length behind her eye along the line she is
  // facing; upright it is straight under it.
  const lead = prone ? 0.62 : 0.0;
  const want = [w.x - fx * lead, w.y - (prone ? BODY.sink : BODY.sinkUp),
    w.z - fz * lead];
  if (!_bodyHas) { _bodyAt.set(want[0], want[1], want[2]); _bodyHas = true; }
  const k = 1 - Math.exp(-BODY.ease * dt);
  _bodyAt.x += (want[0] - _bodyAt.x) * k;
  _bodyAt.y += (want[1] - _bodyAt.y) * k;
  _bodyAt.z += (want[2] - _bodyAt.z) * k;

  you.drive({
    at: [_bodyAt.x, _bodyAt.y, _bodyAt.z],
    yaw: yaw + Math.PI / 2,
    pitch: prone ? w.pitch * 0.75 : 0,
    clip: prone ? 'swim' : 'tread',
    // The stroke goes at the speed you are going. The clip is authored for a
    // cruise and played at one, so without this a sprint and a drift are the
    // same arms — which is the one thing you can see from back here and cannot
    // see from inside your own head.
    speed: prone
      ? clamp(Math.hypot(w.vx, w.vz) / 1.15, 0.55, 1.9) : 1,
    mask: !!(mask && mask.on),
    wet: true,
  });

  // And the camera, behind and a little over her. Aimed ahead of her rather
  // than at her, so she sits low in the frame with the water she is going
  // through in it — a camera pointed at a swimmer's back is a portrait.
  camera.up.set(0, 1, 0);
  camera.position.set(
    w.x - fx * BODY.back, w.y + BODY.up, w.z - fz * BODY.back,
  );
  const cp = Math.cos(w.pitch);
  camera.lookAt(w.x + fx * BODY.ahead * cp,
    w.y + BODY.aim + Math.sin(w.pitch) * BODY.ahead,
    w.z + fz * BODY.ahead * cp);
}

/**
 * How long each beat of the shot lasts, and the two dives inside it.
 *
 * The whole thing is seven seconds, which is long for a cut you will see every
 * time you press R and is the right length anyway: what it has to establish is
 * a course, a person, a head start and the fact that you are chasing her, and
 * the old five-second version established the first two.
 */
const CUT = {
  wide: 2.2,        // the course, and her standing on the end of it
  hers: 1.6,        // she goes
  run: 1.7,         // and you go after her
  yours: 1.2,       // off the end of the boards
  settle: 0.8,      // and into the swim
  // Where the run-up starts, in metres back up the jetty from its head. Eleven
  // is about four strides, which is long enough to be a run and short enough
  // that the boards do not run out from under her.
  runUp: 11.0,
  // Through the beat that owns it, where each dive leaves the deck and where
  // it arrives. Both are fractions of that beat, not seconds, so retiming a
  // beat does not silently move the splash off the water.
  goAt: 0.34, inAt: 0.80,
  // The arc. How high over the deck the apex is and how far past the edge she
  // lands, in metres — a dive off a jetty is nearly all forward and barely up,
  // which is the difference between a dive and a jump.
  rise: 0.45, reach: 3.1,
  // The over-the-shoulder while you run: back, up and to one side, in metres.
  // Close enough that she fills a third of the frame and the boards go past
  // underneath, which is what makes it a run rather than a dolly.
  overBack: 2.9, overUp: 1.62, overSide: 0.85,
  // And the same three for the dive itself, which is side on rather than over
  // the shoulder: you cannot read somebody going over from behind them.
  diveBack: 1.4, diveSide: 3.8, diveUp: 0.55,
  // And how far over she goes on the way down, in radians.
  //
  // 0.9 is fifty degrees, which is a racing dive, and it is reached early
  // rather than at the water. The first pass had it late — pitch as k squared
  // — and the arithmetic was right and the picture was wrong: a parabola over
  // three metres only drops a hand's breadth in its first half, so a body that
  // has not turned over by then is a body lying flat in the air a foot above
  // the boards, which is what it looked like. What tells you somebody has
  // dived is the going-over, and the going-over happens off the end.
  tip: 0.90,
};

/**
 * One frame of the shot. Wall time, same as the walk up to the house.
 *
 * Two things move in it besides the camera, and each is owned by exactly one
 * beat: she leaves the jetty in `shedives` and you leave it in `youdive`.
 * Everything either of them does is a function of `u` through its own beat, so
 * the sequence is re-enterable — press R again mid-dive and it starts over
 * from the top with nobody left in mid-air.
 */
function stepChaseCut(dt) {
  if (!chaseCut) return;
  const K = chaseCut.legs;
  chaseCut.u += dt / K[chaseCut.leg].dur;
  while (chaseCut.u >= 1 && chaseCut.leg < K.length - 1) {
    chaseCut.u -= 1; chaseCut.leg += 1;
  }
  if (chaseCut.leg >= K.length - 1 && chaseCut.u >= 1) {
    if (you) you.drive(null);
    chaseCut = null; camOverride = null;
    $('swim-hud').hidden = false;
    $('chase-hud').hidden = false;
    paintChaseHud();
    if (!IS_TOUCH && !pointerLocked) grabPointer();
    return;
  }
  const a = K[chaseCut.leg], b = K[Math.min(chaseCut.leg + 1, K.length - 1)];
  const f = chaseCut.u * chaseCut.u * (3 - 2 * chaseCut.u);
  const m = (p, q) => [lerp(p[0], q[0], f), lerp(p[1], q[1], f), lerp(p[2], q[2], f)];
  const eye = m(a.at, b.at), aim = m(a.look, b.look);
  camOverride = [eye[0], eye[1], eye[2], aim[0], aim[1], aim[2]];
  stepCutBeat(a.beat, chaseCut.u, dt);
}

/** Fire something exactly once per run of the shot. */
function cutOnce(name, fn) {
  if (!chaseCut || chaseCut.fired[name]) return;
  chaseCut.fired[name] = 1;
  fn();
}

/**
 * The arc off the end of the boards.
 *
 * `k` is 0 at the moment the feet leave and 1 at the moment the head goes in.
 * Returns the world point and the pitch, which is the thing that makes it read
 * as a dive: a body that travels a parabola without turning over is a sack.
 */
function cutArc(run, k, endY) {
  const x = run.to[0] + run.ux * CUT.reach * k;
  const z = run.to[2] + run.uz * CUT.reach * k;
  // Up over the first third and down over the rest, which is what a shallow
  // racing dive does — and the fall is the one that has to land on the water,
  // so it is written from the two ends rather than from a gravity constant.
  const y = run.y + CUT.rise * Math.sin(Math.PI * Math.min(1, k * 0.72))
    - (run.y - endY) * k * k;
  return { at: [x, y, z], pitch: -CUT.tip * Math.sqrt(k) };
}

/** What each beat of the shot is responsible for. */
function stepCutBeat(beat, u, dt) {
  const C = chaseCut;
  const run = C.run;
  const seaY = swim ? swim.surfaceAt(C.hers[0], C.hers[1]) : 0;

  if (beat === 'stand') {
    // Nobody moves. She is on the end looking at the platform and you are
    // behind her on the boards, which is the picture the beat is for.
    chase.poise(run.to[0], run.y, run.to[2], run.yaw, 'idle');
    if (you) {
      you.drive({ at: [run.from[0], run.y, run.from[2]],
        yaw: run.yaw + Math.PI / 2, clip: 'idle', mask: true, wet: true });
    }
    return;
  }

  if (beat === 'shedives') {
    if (u < CUT.goAt) {
      chase.poise(run.to[0], run.y, run.to[2], run.yaw, 'idle');
      return;
    }
    const k = Math.min(1, (u - CUT.goAt) / (CUT.inAt - CUT.goAt));
    if (k < 1) {
      const A = cutArc(run, k, seaY + 0.1);
      chase.poise(A.at[0], A.at[1], A.at[2], run.yaw, 'swim', A.pitch);
      return;
    }
    // In. This is where the race actually begins — see `startChase`.
    cutOnce('herIn', () => {
      const p = cutArc(run, 1, seaY + 0.1).at;
      if (bodySplash) {
        bodySplash.at(p[0], seaY, p[2], 1.9, 2.2, run.ux, run.uz);
      }
      if (audio) audio.plunge(1.6);
      chase.stop();
      chase.start(C.hers, jadrija.swimRun.board, (x, z) => swim.surfaceAt(x, z));
    });
    return;
  }

  if (beat === 'run') {
    // Four strides down the boards. The walk clip covers 0.687 m a step and is
    // authored for 1.37 m/s, so running it at 1.9 is the rig's own gait played
    // fast rather than a stride length nothing supports — see the note on
    // `pace` in 43-jadrija.js, which is the same problem and the same dodge.
    if (!you) return;
    const k = u * u * (3 - 2 * u);
    const px = lerp(run.from[0], run.to[0], k);
    const pz = lerp(run.from[2], run.to[2], k);
    you.drive({
      at: [px, run.y, pz],
      yaw: run.yaw + Math.PI / 2, clip: 'walk', speed: 1.9, mask: true, wet: true,
    });
    // And the camera goes with her, over her left shoulder. Written here and
    // not as a leg because a leg is two fixed points and what this beat is for
    // is *her*: from a fixed frame a run down a jetty is a small figure
    // crossing a large empty picture, and the one thing the sequence was asked
    // to show is who is doing the running.
    camOverride = [
      px - run.ux * CUT.overBack - run.uz * CUT.overSide,
      run.y + CUT.overUp,
      pz - run.uz * CUT.overBack + run.ux * CUT.overSide,
      px + run.ux * 2.2, run.y + 1.15, pz + run.uz * 2.2,
    ];
    return;
  }

  if (beat === 'youdive') {
    if (!you) return;
    if (u < CUT.goAt * 0.5) {
      you.drive({ at: [run.to[0], run.y, run.to[2]], yaw: run.yaw + Math.PI / 2,
        clip: 'walk', speed: 1.9, mask: true, wet: true });
      return;
    }
    const k = Math.min(1, (u - CUT.goAt * 0.5) / (CUT.inAt - CUT.goAt * 0.5));
    if (k < 1) {
      const A = cutArc(run, k, seaY + 0.1);
      you.drive({ at: A.at, yaw: run.yaw + Math.PI / 2, pitch: A.pitch,
        clip: 'swim', speed: 1, mask: true, wet: true });
      // Side on, and tracking. Same argument as the run: a dive is three
      // metres of travel and a fixed frame either has her crossing a corner of
      // it or misses her altogether, which is what two passes of moving the
      // leg by hand actually produced. Hung off the arc itself, so it cannot.
      camOverride = [
        A.at[0] - run.ux * CUT.diveBack - run.uz * CUT.diveSide,
        // Floored at the deck and not at the water. She falls a metre and a
        // half through this beat and a camera that falls with her ends up
        // inside the jetty it is standing beside, which is what it did: a grey
        // slab across the frame with a pair of feet over the top of it.
        Math.max(run.y + 0.45, A.at[1] + CUT.diveUp),
        A.at[2] - run.uz * CUT.diveBack + run.ux * CUT.diveSide,
        A.at[0], A.at[1] + 0.10, A.at[2],
      ];
      return;
    }
    cutOnce('youIn', () => {
      const p = cutArc(run, 1, seaY + 0.1).at;
      if (bodySplash) {
        bodySplash.at(p[0], seaY, p[2], 1.6, 2.0, run.ux, run.uz);
      }
      if (audio) audio.plunge(1.3);
      you.drive(null);
    });
    return;
  }

  if (beat === 'swim' && you) you.drive(null);
}

/** Put the race away. `won` only decides what gets said about it. */
function endChase(won, keep = false) {
  if (chase && !keep) chase.stop();
  // Whatever the shot was holding, it is not holding it any more. Belt and
  // braces: the cut clears her itself on the way out, and this is the path
  // that does not go through the cut.
  if (you) you.drive(null);
  chaseCut = null;
  if (camOverride && state.phase === 'swim') camOverride = null;
  $('chase-hud').hidden = true;
  if (!won) toast(T('chase.lost'));
}

/** The gap, how far through she is, and whatever she is saying. */
function paintChaseHud() {
  if (!chase || !chase.active) return;
  const talking = chase.phase === 'talk';
  $('ch-gap').textContent = talking ? '' : Math.round(chase.gap);
  $('ch-unit').textContent = talking ? '' : T('chase.behind');
  $('ch-fill').style.width = (chase.through * 100).toFixed(1) + '%';
  const n = chase.line;
  $('ch-say').innerHTML = n ? T('chase.say' + n) : '';
}

/**
 * J — the seat.
 *
 * There is no confirmation on it and there is not going to be one. Half the
 * point of the key is that it is available in the two seconds before the ridge
 * arrives, and a dialogue box in those two seconds is the same as not having
 * the key at all. The price is paid the other way: the aeroplane is gone the
 * instant you press it, and she is gone whatever the reason was.
 */
function baleOut() {
  if (!eject || state.paused || state.phase !== 'fly') return;
  if (!eject.canFire()) { toast(T('toast.ejectNo'), 'bad'); return; }
  const low = state.altAgl < EJECT.minSafe + Math.max(0, -flight.p.vel.y) * 1.6;
  eject.fire();
  $('hud').hidden = true;
  $('touch').hidden = true;
  $('chute-hud').hidden = false;
  if (IS_TOUCH) $('ctouch').hidden = false;
  alerts.bump(2.2);
  toast(T(low ? 'toast.ejectLow' : 'toast.eject'), 'bad');
}

/**
 * U — the charge under your boots.
 *
 * There is a rope ladder in every world made of triangles, and this is ours.
 * Terrain, a promenade deck, a hut and a hundred bathers all have to agree with
 * each other about where the floor is, and now and again they do not: you find
 * yourself standing under the concrete looking up at the underside of a
 * platform with people walking about on top of it, and no amount of walking
 * gets you back, because the way you got in was not a way that runs backwards.
 *
 * Rather than pretend that can never happen — which is a promise no geometry
 * this size can keep — this is the answer to it happening. Fifty metres
 * straight up off something loud, and then you are under the canopy, which is
 * a set of controls the game already has and you already know, over terrain you
 * can see all of and pick your spot on. It gets you out of a hole; it is also
 * simply a very good way to look at Šibenik.
 *
 * The height is honest arithmetic and not a number that was typed, and it is
 * measured rather than solved: body drag in 57-eject.js goes as the square of
 * the speed, so the apex is a long way under v squared over 2g and gets further
 * under it the harder you go. 34 m/s came out a shade over fifty metres, which
 * is a fire escape. This is meant to be the other thing it is good for — a way
 * to look at Šibenik — and fifty metres is not high enough to see over the
 * headland you are standing on.
 */
const LAUNCH = {
  // 90 m/s off the deck, integrating the same v' = -g - k v^2 the canopy code
  // does: 202 m of apex, reached at 5.7 s, and 43 s of descent under the cloth.
  // Four times the old fifty, which is the difference between getting out of a
  // hole and being able to see the channel, the old town and the fire at once.
  up: 90,
  // And the climb, so the canopy streams at the top rather than on the way up.
  // Not a taste number either: apex is at 5.7 s and the cloth streams `hang`
  // plus EJECT.tumble (0.85 s) after the charge, so this is 5.7 - 0.85.
  hang: 4.85,
};
// Whether you were stranded *before* the charge, so that landing again can put
// you back exactly as it found you. See dropIn's `lost` argument.
let launchedFrom = null;

function launchOut() {
  if (!ground || !ground.ok || !ground.active || state.paused) return;
  if (!eject || eject.active) return;
  launchedFrom = { stranded: ground.stranded };
  const { x, y, z, yaw } = ground.you;
  ground.bail();
  eject.reset();
  eject.launch(x, y, z, yaw, LAUNCH.up, LAUNCH.hang);
  audio.boom();
  alerts.bump(1.6);
  $('ground-hud').hidden = true;
  $('hud').hidden = true;
  $('chute-hud').hidden = false;
  if (IS_TOUCH) { $('gtouch').hidden = true; $('touch').hidden = true; $('ctouch').hidden = false; }
  toast(T('toast.launch'));
}

/**
 * Enter — off the balcony rail, under a canopy, on to the promenade.
 *
 * The same machinery as the charge under your boots and a fifth of the speed:
 * 9.6 m/s off the deck is about four and a half metres of apex, so from the
 * terrace you top out around seven above the ground and the cloth streams as
 * you stop going up. It is a hop rather than a flight — you are over the road
 * and down in about eight seconds — and that is the point. Fifty metres is a
 * way of looking at Šibenik; this is a way of getting off your own balcony.
 *
 * Gated on two things, both of which are what the ask was: you have to be
 * moving, because it is a running jump and not a step off a ledge, and you
 * have to be somewhere with a drop under it. The second test is the plinth of
 * the vikendica rather than any general reading of the terrain — everything
 * raised on this plot is part of that house, and the beach is not.
 */
const HOP = {
  up: 10.5,        // m/s off the rail — about 5.6 m of apex
  // Negative, where the charge's is positive, and for the opposite reason. The
  // charge climbs for two and a half seconds and wants the cloth held back
  // until the top; this is off a balcony, where the whole flight is four
  // seconds and the canopy has to be out of the bag almost at once. `launch`
  // sets the clock to -hang and streams at `tumble` (0.85 s), so -0.70 streams
  // it a sixth of a second after your feet leave the rail and has it full,
  // `deploy` later, a shade after the top of the arc — about seven metres over
  // the promenade with a second and a half of glide left to pick your spot.
  hang: -0.70,
  minSp: 0.9,      // m/s: a running jump, not a step
  minUp: 1.6,      // m above the plinth, which is the raised half of the house
};

function hopOut() {
  if (!ground || !ground.ok || !ground.active || state.paused) return false;
  if (!eject || eject.active) return false;
  const v = jadrija && jadrija.vik;
  if (!v) return false;
  const { x, y, z, yaw, vx, vz } = ground.you;
  if (y < v.base + HOP.minUp) return false;
  if (Math.hypot(vx || 0, vz || 0) < HOP.minSp) return false;
  launchedFrom = { stranded: ground.stranded };
  ground.bail();
  eject.reset();
  eject.launch(x, y, z, yaw, HOP.up, HOP.hang);
  alerts.bump(0.8);
  $('ground-hud').hidden = true;
  $('hud').hidden = true;
  $('chute-hud').hidden = false;
  if (IS_TOUCH) { $('gtouch').hidden = true; $('touch').hidden = true; $('ctouch').hidden = false; }
  return true;
}

// Whether the cloth has been heard to open on this descent. The canopy fills
// over about a second inside 57-eject.js and nothing in there makes a noise, so
// the sound is hung off the number rather than off an event: watch inflation
// cross, play it once, and clear it when the parachute is put away.
let chuteHeard = false;

/** Once a frame while under the canopy: the cloth, when it takes air. */
function chuteAudio() {
  if (!eject || !eject.active) { chuteHeard = false; return; }
  if (chuteHeard) return;
  const sh = eject.stats ? eject.stats() : null;
  if (!sh || !(sh.inflation > 0.18)) return;
  chuteHeard = true;
  if (audio) audio.canopy();
}

/**
 * Speed, and why.
 *
 * A speed on its own is a number that goes up and down for no reason anybody
 * can see. The point of sail next to it is the reason, and it is the whole of
 * what there is to learn here — the same power on the same water is thirty
 * knots or nothing at all depending on one angle.
 */
function paintRideHud() {
  if (!ride || !ride.active) return;
  $('rd-kt').textContent = (ride.speed * 1.94384).toFixed(0);
  const p = ride.point();
  const el = $('rd-point');
  // In the air the point of sail is not the thing you want to know, and there
  // is exactly one thing that is. It takes the same slot rather than a new
  // one, because a HUD that grows a line when something happens is a HUD that
  // moves, and this one sits under a horizon that is already moving.
  const air = ride.air;
  if (air > 0.35) {
    el.textContent = T('ride.air') + ' ' + air.toFixed(1) + ' m';
    el.classList.remove('stall');
    el.classList.add('air');
  } else {
    el.textContent = T('ride.' + p);
    el.classList.toggle('stall', p === 'noGo');
    el.classList.remove('air');
  }
  $('rd-hint').innerHTML = air > 0.35 ? T('ride.floating')
    : p === 'noGo' ? T('ride.stalled')
      : TK('ride.hint', 'ride.hintTouch');
}

/**
 * Speed, height off the water, and what the board is doing.
 *
 * Kilometres an hour rather than the kite's knots, and that is not an
 * inconsistency: a kite is a sail and everybody who rides one talks in knots,
 * and an eFoil is a vehicle with a battery in it and everybody who rides one
 * talks in kilometres an hour. The number on the screen should be the number
 * the person on the board would say.
 */
function paintFoilHud() {
  if (!foil || !foil.active) return;
  $('fo-kmh').textContent = Math.round(foil.speed * 3.6);
  const st = foil.state();
  const el = $('fo-state');
  el.textContent = st === 'flying' || st === 'high'
    ? T('foil.up') + ' ' + (foil.air * 100).toFixed(0) + ' cm'
    : T('foil.' + st);
  el.classList.toggle('air', st === 'flying');
  el.classList.toggle('stall', st === 'high' || st === 'down');
  $('fo-thr').style.width = (foil.throttle * 100).toFixed(0) + '%';
  $('fo-hint').innerHTML = st === 'down' ? T('foil.downHint')
    : st === 'high' ? T('foil.highHint')
      : st === 'hull' ? T('foil.pushHint')
        : TK('foil.hint', 'foil.hintTouch');
}

/**
 * The two numbers, the wash, and the one hint.
 *
 * The wash is the whole picture and it is a `div`. It could have been a fog
 * colour, and a fog colour would have been wrong twice over: it would have
 * greened the sun and the sky along with the water, and it would have had to be
 * put back on every path out of here. A layer over the top goes on and off in
 * one line and never touches the render.
 */
function paintSwimHud() {
  if (!swim || !swim.active) return;
  const d = swim.depth;
  $('sw-depth').textContent = d.toFixed(1);
  const b = swim.breath;
  const fill = $('sw-fill');
  fill.style.width = (b * 100).toFixed(0) + '%';
  fill.classList.toggle('low', b < 0.34);
  $('sw-breath').hidden = !swim.submerged && b > 0.995;
  const wade = swim.canWade();
  // Somebody else has the controls, and the one thing a light like this has to
  // do is say so without being read: it is on or it is not there.
  const ap = $('sw-auto');
  ap.hidden = !swim.auto;
  ap.textContent = swim.apNote === 'up' ? T('swim.apUp') : T('swim.auto');
  $('sw-hint').innerHTML = swim.spent ? T('swim.spent')
    : swim.auto ? T('swim.apHint')
      : wade ? TK('swim.wade', 'swim.wadeTouch')
        : TK('swim.hint', 'swim.hintTouch');
  if (IS_TOUCH) paintSwimTouch(wade, swim.auto);
  // Nothing below the waterline until your eyes are actually under it, and then
  // it closes in slowly and never far: this is the mask now, not the sea. The
  // sea is drawn.
  const u = $('under');
  u.hidden = false;
  u.classList.toggle('on', swim.submerged);
  u.style.opacity = swim.submerged
    ? (0.16 + 0.44 * Math.min(1, d / 11.0)).toFixed(3) : '0';
}

/**
 * Out of the water and on to whatever the shore turned out to be.
 *
 * The same handover the canopy makes on dry land, and for the same reason: the
 * walking model wants a locale before it wants a position, because everything
 * it can answer is inside one.
 */
/**
 * The nearest bit of land you could actually stand on, from a point in the sea.
 *
 * `canWade` answers a different question — is there a bottom under your own
 * feet — and the answer to that is yes in chest-deep water a good fifteen
 * metres out. Handing that position straight to the on-foot mode is what put
 * you standing in the sea about half the time you pressed E, which is the
 * complaint: E is meant to get you *ashore*, not merely out of the swim.
 *
 * So: walk outward, the way you are facing first and then round, and stop at
 * the first place with real dry land under it and more dry land two metres
 * past it — the second test is what stops you being landed on a waterline
 * that the next wave is over. If there is genuinely nothing (a swim off a
 * cliff, a channel with no beach on it) it takes the highest ground it found
 * rather than failing, because a key that sometimes does nothing is worse than
 * a key that does its best.
 *
 * Returns [x, z, yaw] — the heading is the way you walked out, so you come up
 * the beach facing inland rather than back at the water you just left.
 */
function dryLand(x0, z0, yaw) {
  const DRY = 0.45;          // metres above the waterline before it is a beach
  let best = null, bestD = 1e9;
  // The fallback is the highest *sea bed* within reach and it is not land. It
  // is returned separately, flagged, because the one caller used to take it as
  // an answer — and a sea bed 0.15 m under the surface accepted as a beach is
  // exactly what "E does nothing" looked like from the chair: you were put
  // ashore on the water, and the shoreline handover in `ground.tick` noticed
  // and put you straight back in. Nothing failed loudly enough to be seen.
  let fallback = null, fallbackH = -1e9;
  // And the second tier, which is the difference between a beach and a coast.
  //
  // `DRY` is a height, and on much of this shore the height and the coastline
  // disagree: the DEM is 12.7 m a sample against a rasterised cover mask, so
  // there are flats where `isSea` has said land for sixty metres while
  // `groundAt` is still reading 0.10. Measured at world (-1600, 700) — the
  // north side of the channel — where the mask turns to land and the terrain
  // does not rise above 0.10 m for another sixty metres inland. A height-only
  // test finds no beach there at all and the search comes back empty, which is
  // how E could fail two hundred metres off a coastline you can see.
  //
  // So: a real beach if there is one, and otherwise anywhere the game itself
  // considers not-sea — which is the same test `waadeIn` uses to decide you
  // have gone back in, and therefore the only one that will not bounce you
  // straight out again.
  let shore = null, shoreD = 1e9;
  for (let a = 0; a < 26; a++) {
    const ang = yaw + (a === 0 ? 0 : (a % 2 ? 1 : -1) * Math.ceil(a / 2) * 0.25);
    const dx = -Math.sin(ang), dz = -Math.cos(ang);
    // 160 m rather than 70. The old reach was written for somebody standing
    // chest deep with the beach in front of them; it is now also the last leg
    // of a two-hundred-metre walk in and has to cover a wide flat.
    for (let d = 1.5; d <= 160; d += 1.5) {
      const x = x0 + dx * d, z = z0 + dz * d;
      const h = groundAt(x, z);
      if (h > fallbackH) { fallbackH = h; fallback = [x, z, ang]; }
      if (!isSea(x, z) && !isSea(x + dx * 2, z + dz * 2) && d < shoreD) {
        shoreD = d; shore = [x + dx * 1.5, z + dz * 1.5, ang];
      }
      if (h < DRY || groundAt(x + dx * 2, z + dz * 2) < DRY) continue;
      // A metre and a half further in again, so you land on the beach rather
      // than on its edge.
      if (d < bestD) { bestD = d; best = [x + dx * 1.5, z + dz * 1.5, ang]; }
      break;
    }
  }
  if (best) return { at: best, dry: true };
  if (shore) return { at: shore, dry: true };
  return { at: fallback, dry: false };
}

/**
 * Walk the shore distance field until it runs out, from anywhere in the sea.
 *
 * `dryLand` looks seventy metres and no further, which is right for the thing
 * it was written for — you are chest deep and the beach is in front of you.
 * From the diving platform it is two hundred metres short, so it found nothing
 * dry, fell back on the highest sea bed within its reach, and handed the walk
 * model a spot that was still under water. That is the whole of "E does not
 * work": the key fired, the search failed quietly, and you stayed in the sea.
 *
 * So: sixteen headings, forty metres a step, take whichever reduces `shoreAt`
 * the most and keep going — the same gradient descent the swim's own
 * autopilot steers on, run to completion in one frame instead of at 1.15 m/s.
 * It stops when the field says the shore is inside a step, and then `dryLand`
 * does the last bit of it properly from there.
 */
function shoreWalk(x0, z0, yaw) {
  let x = x0, z = z0, a = yaw;
  // `shoreAt` saturates at 400 m — see 08-assets.js, it is a byte per sample
  // over 400 — and out past that the field reads a flat 400 in every direction.
  // Gradient descent on a flat field has nothing to descend: the sixteen probes
  // all come back equal to the sample under your feet, `best` stays null, and
  // the loop breaks on its first pass and returns the point it started from.
  // So from the middle of the channel this walked nowhere, `dryLand` then found
  // no beach within its seventy metres, and you were planted on open water.
  //
  // Get inside the field's range first, then descend it. Widening rings, and
  // the *lowest* sample on the first ring that reads under saturation rather
  // than the first one found — otherwise the direction taken is whichever way
  // the loop happened to start, which in the channel is as often out to sea.
  if (shoreAt(x, z) >= 395) {
    let got = null;
    for (let r = 300; r <= 7000 && !got; r *= 1.6) {
      let bd = 395;
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        const px = x - Math.sin(ang) * r, pz = z - Math.cos(ang) * r;
        const d = shoreAt(px, pz);
        if (d < bd) { bd = d; got = [px, pz, ang]; }
      }
    }
    // Genuinely nowhere within seven kilometres. The world is thirteen across,
    // so this is somebody who has swum off the edge of it, and the honest
    // answer is to say so rather than to put them down on the sea.
    if (!got) return null;
    x = got[0]; z = got[1]; a = got[2];
  }
  for (let step = 0; step < 60; step++) {
    const here = shoreAt(x, z);
    if (here < 30) break;
    // Was capped at 60 m a step, which is forty steps and 2.4 km — not enough
    // from a ring point 4 km out. The cap is now the distance the field itself
    // reports, which is the only number that knows how far there is to go.
    const reach = Math.max(20, Math.min(240, here * 0.6));
    let best = null, bestD = here;
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const px = x - Math.sin(ang) * reach, pz = z - Math.cos(ang) * reach;
      const d = shoreAt(px, pz);
      if (d < bestD) { bestD = d; best = [px, pz, ang]; }
    }
    if (!best) break;
    x = best[0]; z = best[1]; a = best[2];
  }
  return [x, z, a];
}

/**
 * E, in the water.
 *
 * Chest deep it is a wade and always was. Out of your depth it is now a swim
 * you do not have to do — the report on it was blunt, and it was right: the
 * only thing between you and the beach at that point is four minutes of
 * holding W, and nothing in this game is improved by four minutes of holding
 * W. So it finds the shore, puts you on it and flashes the picture once, which
 * is the difference between a cut and a bug.
 */
function wadeAshore() {
  if (state.phase !== 'swim') return false;
  const y = swim.you;
  const far = !swim.canWade();
  const from = far ? shoreWalk(y.x, y.z, y.yaw) : [y.x, y.z, y.yaw];
  // Three things in this sequence used to be unable to report a failure, and
  // between them they are the whole of the complaint. `shoreWalk` returned the
  // point it started from when the distance field was saturated; `dryLand`
  // returned a sea bed when it found no beach; and `dropIn` cannot refuse
  // anything — read it, it ends in `return true` and has no other exit. So the
  // key fired, the search failed three times in silence, and the walk model was
  // handed a spot under the surface. Every one of them is checked here now.
  if (!from) { toast(T('toast.noShore')); return false; }
  const land = dryLand(from[0], from[1], from[2]);
  const spot = land.at;
  if (!land.dry || !spot || isSea(spot[0], spot[1])) {
    toast(T('toast.noShore'));
    return false;
  }
  if (!ground || !ground.ok
    || !ground.retarget(localeAt(spot[0], spot[1], airfield, jadrija, city))
    || !ground.dropIn(spot[0], spot[1], spot[2], true)) {
    toast(T('ground.noPlane'));
    return false;
  }
  // `leaveWater` rather than `swim.leave`, so the race and its HUD come off
  // with it. Leaving them running was survivable while E only fired chest deep
  // — you cannot be chest deep and racing — and is not now that it fires from
  // the middle of the course.
  //
  // Told which mode it is closing rather than being left to read the phase:
  // `dropIn` above has already set the phase to 'ground'. See `leaveWater`.
  leaveWater('swim');
  eject.reset();
  state.phase = 'ground';
  $('ground-hud').hidden = false;
  if (IS_TOUCH) { $('stouch').hidden = true; $('gtouch').hidden = false; }
  if (!IS_TOUCH && !pointerLocked) grabPointer();
  if (audio) audio.boots();
  // A cut and not a teleport. One frame of white and a half-second out of it
  // is the whole difference between "the picture changed" and "the game
  // glitched", and it costs a line.
  if (far && alerts) alerts.flash('#dff0f6', 0.92, 0.55);
  paintDeviceText();
  toast(T('toast.ashore'));
  return true;
}

/**
 * Take one out.
 *
 * From the sand, which is where kites launch from, and it wants open water in
 * front of you — so it walks out along the way you are facing looking for
 * somewhere a board would actually go. If there is nothing there it says so
 * and does nothing, which is the right answer on the wrong beach.
 */
function takeKite() {
  if (state.phase !== 'ground' || !ride) return false;
  const y = ground.you;
  const fx = -Math.sin(y.yaw), fz = -Math.cos(y.yaw);
  let got = null;
  // Ahead first, because you are looking at the water you mean. Then a sweep,
  // because nobody lines themselves up before pressing a key.
  for (let a = 0; a <= 8 && !got; a++) {
    const ang = (a === 0 ? 0 : (a % 2 ? 1 : -1) * Math.ceil(a / 2) * 0.42);
    const c = Math.cos(ang), sn = Math.sin(ang);
    const dx = fx * c - fz * sn, dz = fx * sn + fz * c;
    for (let d = 12; d <= 70; d += 4) {
      const x = y.x + dx * d, z = y.z + dz * d;
      if (!isSea(x, z)) continue;
      if (-groundAt(x, z) < 1.1) continue;
      got = [x, z];
      break;
    }
  }
  if (!got || !ride.enter(got[0], got[1])) { toast(T('toast.noLaunch')); return false; }
  ground.bail();
  eject.reset();
  state.phase = 'ride';
  $('ground-hud').hidden = true;
  $('hud').hidden = true;
  $('chute-hud').hidden = true;
  $('swim-hud').hidden = true;
  $('ride-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = true; $('stouch').hidden = false; }
  if (!IS_TOUCH && !pointerLocked) grabPointer();
  paintDeviceText();
  toast(T('toast.onTheKite'));
  return true;
}

/**
 * F — take a foil out.
 *
 * Same search as the kite's, and deliberately: you are standing on a beach
 * looking at water, and the mode wants a piece of it that is open and deep
 * enough for a mast. It wants more depth than a kite does — the wing is eighty
 * centimetres under the board — so it looks a little further out before it
 * agrees.
 */
function takeFoil() {
  if (state.phase !== 'ground' || !foil) return false;
  const y = ground.you;
  const fx = -Math.sin(y.yaw), fz = -Math.cos(y.yaw);
  let got = null;
  for (let a = 0; a <= 8 && !got; a++) {
    const ang = (a === 0 ? 0 : (a % 2 ? 1 : -1) * Math.ceil(a / 2) * 0.42);
    const c = Math.cos(ang), sn = Math.sin(ang);
    const dx = fx * c - fz * sn, dz = fx * sn + fz * c;
    for (let d = 14; d <= 80; d += 4) {
      const x = y.x + dx * d, z = y.z + dz * d;
      if (!isSea(x, z)) continue;
      if (-groundAt(x, z) < 1.8) continue;
      got = [x, z];
      break;
    }
  }
  if (!got || !foil.enter(got[0], got[1])) { toast(T('toast.noLaunch')); return false; }
  ground.bail();
  eject.reset();
  state.phase = 'foil';
  $('ground-hud').hidden = true;
  $('hud').hidden = true;
  $('chute-hud').hidden = true;
  $('swim-hud').hidden = true;
  $('ride-hud').hidden = true;
  $('foil-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = true; $('stouch').hidden = false; }
  if (!IS_TOUCH && !pointerLocked) grabPointer();
  paintDeviceText();
  toast(T('toast.onTheFoil'));
  return true;
}

/** And stepping off it, which — like the kite — puts you in the sea. */
function dropFoil(hard = false) {
  if (state.phase !== 'foil' || !foil || !swim) return false;
  const y = foil.you;
  if (!swim.enter(y.x, y.z, y.yaw, hard ? 0.6 : -0.3)) return false;
  foil.leave();
  state.phase = 'swim';
  $('foil-hud').hidden = true;
  $('swim-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = true; $('stouch').hidden = false; }
  if (audio) audio.plunge(hard ? 1.15 : 0.8);
  wasUnder = false;
  paintDeviceText();
  toast(T(hard ? 'toast.foilDown' : 'toast.offTheFoil'));
  return true;
}

/**
 * And putting it down, which puts you in the sea.
 *
 * Not back on the beach. Letting go of a bar in the middle of the channel does
 * not teleport anybody anywhere, and the swim mode is already the whole of
 * what happens to a person in this water — so it is the one door out, and the
 * shore is still reached the way the shore has always been reached.
 */
function dropKite(hard = false) {
  if (state.phase !== 'ride' || !ride || !swim) return false;
  const y = ride.you;
  if (!swim.enter(y.x, y.z, y.yaw, -0.3)) return false;
  ride.leave();
  state.phase = 'swim';
  $('ride-hud').hidden = true;
  $('swim-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = true; $('stouch').hidden = false; }
  if (audio) audio.plunge(hard ? 1.15 : 0.8);
  wasUnder = false;
  paintDeviceText();
  toast(T(hard ? 'toast.wipeout' : 'toast.offTheKite'));
  return true;
}

/**
 * The other way in: you walked off the front and kept going. Same handover as
 * the canopy's, minus the canopy — and deliberately the same function on the
 * way back out, so the shore is one door and not two.
 */
let wasUnder = false;

function waadeIn(x, z) {
  if (state.phase !== 'ground' || !swim) return false;
  const y = ground.you;
  if (!swim.enter(x, z, y.yaw, -0.4)) return false;
  ground.bail();
  state.phase = 'swim';
  $('ground-hud').hidden = true;
  $('hud').hidden = true;
  $('chute-hud').hidden = true;
  $('swim-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = true; $('stouch').hidden = false; }
  if (!IS_TOUCH && !pointerLocked) grabPointer();
  if (audio) audio.plunge();
  wasUnder = false;
  paintDeviceText();
  toast(T('toast.inTheWater'));
  return true;
}

/** And the arrival, whichever of the three it turned out to be. */
function chuteDown(kind) {
  if (state.phase !== 'chute') return;
  // Down on your feet on dry land is not the end of anything. You are a pilot
  // standing on a Dalmatian hillside with a pump on your back and a fire over
  // the ridge — which is the whole reason the key exists, and which the game
  // used to answer with a red screen that was indistinguishable from having
  // been killed by it.
  // Down off the escape charge is not the same event as down off a bale-out,
  // and the only thing that tells them apart by the time we are here is whether
  // launchOut() set this. Everything else about the descent is identical.
  const from = launchedFrom;
  launchedFrom = null;
  if (kind === 'land' && ground && ground.ok
    && ground.retarget(localeAt(eject.pos.x, eject.pos.z, airfield, jadrija, city))
    && ground.dropIn(eject.pos.x, eject.pos.z, eject.you.yaw, from ? from.stranded : true)) {
    // Back in the seat, and this is the whole of "U works exactly once".
    //
    // The canopy ends its descent in `down` rather than `stowed`, which is
    // right — `down` is a state you are in, standing on a hillside with cloth
    // around your ankles, and the frame after landing still has to know that is
    // what just happened. What nothing did was ever leave it. `eject.active` is
    // `phase !== 'stowed'`, so from the first landing onwards it was true for
    // the rest of the session, and `launchOut` is guarded on exactly that. The
    // reset was there, one line inside `launchOut`, on the far side of the test
    // that could no longer be reached.
    //
    // It belongs here instead: the moment the ground mode has you is the moment
    // the parachute is over, whichever way you got under it.
    eject.reset();
    // Both boots on the dirt.
    if (audio) audio.boots();
    chuteHeard = false;
    alerts.bump(1.1);
    $('chute-hud').hidden = true;
    $('hud').hidden = true;
    $('ground-hud').hidden = false;
    if (IS_TOUCH) { $('touch').hidden = true; $('ctouch').hidden = true; $('gtouch').hidden = false; }
    if (!IS_TOUCH && !pointerLocked) grabPointer();
    paintDeviceText();
    toast(T('toast.walkedAway'));
    return;
  }
  // In the water under an open canopy you are not lost, you are wet. The note
  // that used to end the run here made the argument against itself: a
  // lifejacket, four hundred metres of August Adriatic, three aircraft and a
  // lookout. Cut the cloth away and swim — see src/59-swim.js.
  if (kind === 'sea' && swim) {
    swim.enter(eject.pos.x, eject.pos.z, eject.you.yaw, eject.you.vs || 0);
    eject.reset();
    state.phase = 'swim';
    alerts.bump(1.4);
    $('chute-hud').hidden = true;
    $('hud').hidden = true;
    $('ground-hud').hidden = true;
    $('swim-hud').hidden = false;
    if (IS_TOUCH) { $('ctouch').hidden = true; $('touch').hidden = true;
      $('gtouch').hidden = true; $('stouch').hidden = false; }
    if (!IS_TOUCH && !pointerLocked) grabPointer();
    if (audio) audio.plunge(1);
    wasUnder = true;
    paintDeviceText();
    toast(T('toast.inTheWater'));
    return;
  }
  state.phase = 'lost';
  alerts.bump(kind === 'sea' ? 1.6 : 4.5);
  showEnd(false, false, kind === 'sea', kind);
}

$('resume').addEventListener('click', () => setPaused(false));
$('pause').addEventListener('click', (e) => { if (e.target.id === 'pause') setPaused(false); });

// A backgrounded tab stops getting frames anyway; this only makes the stop
// honest, so you do not come back to a city that burned down in another window.
// Not while you are sat at the laptop, though: nobody is flying anything, the
// fire is somebody else's problem for the minute, and a Paused card thrown over
// a terminal you were reading is just something else to dismiss on the way back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !comp) setPaused(true);
});

function toast(msg, kind = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'on ' + kind;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = kind; }, 1900);
}

// ── HUD ──────────────────────────────────────────────────────────────────────

let hudAcc = 0;
function updateHUD(dt) {
  hudAcc += dt;
  if (hudAcc < 0.06) return;
  hudAcc = 0;

  const p = flight.p;
  $('i-spd').textContent = Math.round(state.speed * 3.6);
  $('i-alt').textContent = Math.round(Math.max(0, state.altAgl));
  const { fwd } = flight.axes();
  let hdg = Math.round((Math.atan2(fwd.x, -fwd.z) * 180 / Math.PI + 360)) % 360;
  $('i-hdg').textContent = String(hdg).padStart(3, '0');

  // The vertical speed readout does double duty as the descent indicator: an
  // arrow you cannot miss, and a colour that changes well before the GPWS has
  // anything to say. Amber is "you are coming down"; red is "at this rate you
  // are going to arrive".
  const vs = p.vel.y;
  const arrow = vs > 0.6 ? '▲ ' : vs < -0.6 ? '▼ ' : '';
  $('i-vsi').textContent = arrow + (vs >= 0 ? '+' : '') + vs.toFixed(1);
  const vsiEl = $('inst-vsi');
  vsiEl.className = 'inst small'
    + (vs < -3 && state.altAgl < 400 ? (vs < -8 || (state.altAgl < 90 && vs < -5)
      ? ' hard' : ' down') : '');

  const pct = p.water / CONFIG.tankCapacity;
  $('tank-fill').style.height = (pct * 100) + '%';
  $('t-litres').textContent = groupNum(p.water);

  const hint = $('tank-hint');
  if (p.water >= CONFIG.tankCapacity - 1) {
    hint.textContent = T('tank.full'); hint.className = 'ready';
  } else if (p.scoopValid) {
    hint.textContent = TK('tank.hold', 'tank.holdTouch'); hint.className = 'hot';
  } else {
    hint.textContent = p.scoopReason ? T(p.scoopReason)
      : TK('tank.prompt', 'tank.promptTouch');
    hint.className = '';
  }

  $('g-clock').firstElementChild.textContent = formatClock(state.t);
  $('g-score').firstElementChild.textContent = groupNum(state.score);

  // The offer to get out. It appears only when it is actually true — stopped,
  // on the pavement, with the field alight — so it never asks you to do
  // something that would refuse.
  const gp = $('ground-prompt');
  const offer = !!(ground && ground.ok && ground.canEnter());
  gp.hidden = !offer;
  if (offer) gp.innerHTML = TK('ground.disembark', 'ground.disembarkTouch');

  const burntHa = fire.burntArea();
  const activeHa = fire.burningCount() * (fire.cell * fire.cell) / 1e4;
  $('fb-fire').style.width = Math.min(100, activeHa / 8) + '%';
  $('fb-fire-n').textContent = Math.round(burntHa) + ' ha';
  $('fb-city').style.width = (state.cityHealth * 100) + '%';
  $('fb-city-n').textContent = Math.round(state.cityHealth * 100) + '%';

  // warnings. Ground proximity is not here — it gets the middle of the screen
  // to itself (see 56-alerts.js), because it is the only one you must act on.
  const w = [];
  // Not while she is standing on her wheels: the apron is 5 m AGL by the time
  // the gear has lifted the hull, so a parked aeroplane was warning you about a
  // stall the entire twenty minutes you were on foot beside it.
  if (state.speed < FLIGHT.vStall * 1.05 && state.altAgl > 3 && !p.onGround) {
    w.push(`<span class="pulse">${T('warn.stall')}</span>`);
  }
  if (p.water > CONFIG.tankCapacity * 0.99 && !state.dropping) w.push(T('warn.tankFull'));
  // The other end of the envelope. Only reachable with the overboost gate open,
  // which is the point: holding W past the stop should have a number attached.
  if (state.speed > FLIGHT.vNever * 0.97) {
    w.push(`<span class="pulse">${T('warn.vne')}</span>`);
  }
  $('warn').innerHTML = w.join(' &nbsp; ');

  $('ap').innerHTML = p.autopilot
    ? `${T('ap.label')} <span>${p.apNote ? T(p.apNote) : ''}</span>`
    : (p.levelling ? T('ap.levelling') : '');

  $('reticle').classList.toggle('armed', p.water > 200 && state.altAgl < 260 && state.altAgl > 20);

  // wingmen
  if (wingmen) {
    $('wingmen').innerHTML = wingmen.status().map((w) =>
      `<div class="w"><i class="dot ${w.phase === 'scoop' ? 'scoop' : w.phase === 'drop' ? 'drop' : ''}"></i>`
      + `<span class="name">${T(w.call)}</span>${T('wing.' + w.phase)}`
      + ` <span style="opacity:.55">${Math.round(w.water / CONFIG.tankCapacity * 100)}%</span></div>`
    ).join('');
  }

  // compass tape
  const tape = $('compass-tape');
  if (!tape._built) {
    // Cardinal letters are language-specific: north is N, S and N again in
    // English, Croatian and French, but east is E, I and E, so the whole set
    // comes out of the string table as four characters.
    const card = T('hud.compass');
    let h = '';
    for (let a = -180; a <= 540; a += 15) {
      const lbl = ((a % 360) + 360) % 360;
      const txt = lbl % 90 === 0 ? card[lbl / 90] : (lbl % 45 === 0 ? String(lbl) : '·');
      h += `<span style="width:46px">${txt}</span>`;
    }
    tape.innerHTML = h;
    tape._built = true;
  }
  tape.style.left = `calc(50% - ${(hdg + 180) / 15 * 46 + 23}px)`;

  if (IS_TOUCH) paintTouchHUD();
}

// The compass is built once and cached, so it needs telling.
onLangChange(() => {
  const tape = $('compass-tape');
  if (tape) tape._built = false;
  if (state.phase === 'won' || state.phase === 'lost') redrawEnd();
});

/** Where the virtual stick is, drawn every frame — the HUD's 16 Hz is too
    coarse for something the hand is steering. */
function updateStickHUD() {
  const p = flight.p;
  const el = $('stick');
  const sx = clamp(p.stick.x + p.kb.x + p.tch.x, -1, 1);
  const sy = clamp(p.stick.y + p.kb.y + p.tch.y, -1, 1);
  el.style.transform = `translate(${sx * 92}px, ${-sy * 78}px)`;
  const off = 1 - Math.min(1, Math.hypot(sx, sy) / FLIGHT.handsOffAt);
  el.className = p.autopilot ? 'auto' : (p.levelling || off > 0.45 ? 'hands' : '');
}

// ── scoring & end ────────────────────────────────────────────────────────────

let scoredLitres = 0, lastBurning = 0, spotWarned = 0, planeGone = false;

// Held-branch override for the headless tests. A dispatched keydown is cleared
// by the first blur, which a screenshot is enough to cause, so a test that
// holds water for a minute cannot hold it with a key.
let debugJet = false;
let ghAcc = 0;
// Circumference of the soak ring in the reticle, r = 15 in its own viewBox.
// Kept next to the code that sets the dash offset rather than only in the CSS,
// because the two have to agree exactly or the ring never quite closes.
const RETICLE_ARC = 2 * Math.PI * 15;

/**
 * The ground HUD. Four numbers and a hint, because on foot you are looking at
 * the world and not at the instruments — anything you have to read is a thing
 * you were not watching a burning person for.
 */

/**
 * And the one under the canopy. Height, rate, and whether what is coming up is
 * going to hold you — which on this map is the only question that matters,
 * because two thirds of what you can drift over is the Adriatic.
 */
function updateChuteHUD() {
  const el = $('chute-hud');
  const s = eject.you;
  const agl = Math.max(0, eject.agl());
  const wet = isSea(s.pos.x, s.pos.z);
  $('ch-alt').textContent = agl < 100 ? agl.toFixed(0) : Math.round(agl / 5) * 5;
  $('ch-vs').textContent = Math.max(0, -s.vel.y).toFixed(1);
  el.className = (agl < 60 ? 'close ' : '') + (wet ? 'wet' : '');
  // The hint used to advertise the flare as the landing technique. It is not
  // one — an untouched canopy always puts you down safely, and the flare is a
  // garnish you can stall if you sit on it. Telling somebody to press the one
  // key that can only make things worse is how you get killed by a tooltip.
  $('ch-hint').textContent = eject.phase === 'down' ? ''
    : !eject.flying ? T('chute.wait')
      : s.stalled ? T('chute.stalled')
        : wet ? T('chute.water')
          : T(IS_TOUCH ? 'chute.steerTouch' : 'chute.steer');
}

function updateGroundHUD(dt) {
  ghAcc += dt;
  if (ghAcc < 0.06) return;
  ghAcc = 0;
  const g = ground.hud();

  // On a hillside you parachuted on to there is no aerodrome mission to count
  // and no aeroplane to go back to, so the three gauges that tally it and the
  // line that reads the tank both go away rather than sitting there at zero
  // telling you about a tank that is at the bottom of a valley.
  const alone = ground.stranded && g.alight === 0 && g.crewLeft === 0;
  $('gh-top').hidden = alone;
  $('gh-reserve').hidden = !!ground.stranded;
  $('gh-alight').textContent = g.alight;
  $('gh-crew').textContent = g.crewLeft;
  $('gh-saved').textContent = g.rescued;

  const pct = g.packMax > 0 ? g.pack / g.packMax : 0;
  $('gh-fill').style.width = (pct * 100) + '%';
  $('gh-litres').textContent = Math.round(g.pack);
  $('gh-reserve').textContent = T('ground.reserve').replace('{n}', groupNum(g.reserve));
  $('gh-pack').className = pct < 0.18 ? 'low' : '';

  let hint = '', urgent = false;
  if (g.refilling) hint = T('ground.filling');
  else if (g.pack < 1 && g.reserve < 1) { hint = T('ground.empty'); urgent = true; }
  else if (g.pack < 1) { hint = TK('ground.dry', 'ground.dryTouch'); urgent = true; }
  else if (g.canBoard) hint = TK('ground.board', 'ground.boardTouch');
  $('gh-hint').textContent = hint;
  $('gh-hint').className = urgent ? 'urgent' : '';

  // The house button says which of its two jobs it is about to do. Standing on
  // the floor plate — terrace included, because comparing the two roofs from
  // the terrace is a fair thing to want — it is the roof switch and lights up
  // when the raised one is on; anywhere else it is the way there.
  if (IS_TOUCH && jadrija && jadrija.vik) {
    const vik = jadrija.vik;
    const [vt, vs] = jadrija.local(ground.you.x, ground.you.z);
    const inHouse = vik.floorAt(vt, vs, ground.you.y) != null;
    const el = $('t-roof');
    const key = inHouse ? 'touch.roof' : 'touch.vik';
    if (el.dataset.i18n !== key) {
      el.dataset.i18n = key;
      el.textContent = T(key);
    }
    el.classList.toggle('on', inHouse && vik.roofNow === 'loft');
  }

  // classList, not className: on an SVG element className is a read-only
  // SVGAnimatedString and assigning to it throws every frame.
  const ret = $('gh-reticle').classList;
  ret.toggle('crew', g.aimKind === 'crew');
  ret.toggle('obj', g.aimKind === 'obj');
  // How wet the thing under the crosshair already is, as a ring that closes.
  // Without it the branch is a hose you point at a running person with no way
  // of knowing whether any of it is landing until they either stop or go down,
  // which is forty seconds of doing something and being told nothing.
  ret.toggle('soaking', g.aimSoak >= 0);
  if (g.aimSoak >= 0) {
    $('gh-soak').style.strokeDashoffset =
      (RETICLE_ARC * (1 - clamp(g.aimSoak, 0, 1))).toFixed(1);
  }
}

function updateMission(dt) {
  state.t += dt;

  // Score: water that actually landed on fire, plus a standing bonus for the
  // city being intact. Water in the sea earns nothing.
  const gained = state.litresOnTarget - scoredLitres;
  if (gained > 0) {
    state.score += gained * 0.02;
    scoredLitres = state.litresOnTarget;
  }

  // Spot fires get called out — this is the only warning the city gets.
  for (const ev of fire.events) {
    if (ev.kind === 'spot' && ev.city && !recess && state.t - spotWarned > 12) {
      spotWarned = state.t;
      radio('call.lookout', 'radio.spot');
      toast(T('toast.spot'), 'bad');
    }
  }
  fire.events.length = 0;

  // The hull taking a hard one on the water — survivable, but it should knock
  // the picture about and make a noise.
  if (flight.p.slam < 0) {
    alerts.thump(flight.p.slam);
    flight.p.slam = 0;
  }

  // Not while you are at Jadrija: the fire is frozen down there, so this could
  // only fire on a count that was already zero when you arrived, and an ending
  // that lands on a beach is an ending nobody was watching for.
  const burning = fire.burningCount();
  if (!recess && lastBurning > 25 && burning === 0) {
    state.phase = 'won';
    showEnd(true);
  }
  lastBurning = Math.max(lastBurning, burning);

  // Losable from the ground too. The town does not stop burning because you
  // are standing on an apron forty kilometres of road away from it.
  if (!recess && state.cityHealth < 0.55
    && (state.phase === 'fly' || state.phase === 'ground'
      || state.phase === 'chute' || state.phase === 'swim')) {
    state.phase = 'lost';
    showEnd(false);
  }
  // What you paid for the key, arriving. She is a long way off by now, so this
  // is a noise and a shove and not the end of anything.
  //
  // Any phase, not just under the canopy: by the time she goes in you have very
  // often already got your boots on the ground, and that used to be the one
  // state in which nobody was watching for it.
  if (flight.p.crashed && eject.active && !planeGone) derelictDown();
  if (flight.p.crashed && state.phase === 'fly') {
    // Not straight to the results screen. Twelve tonnes stopping deserves two
    // seconds of its own: the flash, the shake, the noise, the engines dying,
    // and the picture going out. *Then* the numbers.
    state.phase = 'crashing';
    alerts.impact(flight.p.crashOnWater, flight.p.crashSpeed || state.speed);
    $('hud').hidden = true;
    $('touch').hidden = true;
    document.exitPointerLock?.();
    const onWater = flight.p.crashOnWater;
    setTimeout(() => { state.phase = 'lost'; showEnd(false, true, onWater); }, 2400);
  }
}

let endState = null;

function redrawEnd() {
  if (!endState) return;
  const { won, crashed, onWater, chute } = endState;
  // Three ways down under silk, and they are not the same ending. Two of them
  // you walk away from — the mission is still lost either way, because the
  // aeroplane is a hole in a hillside and the fire is still burning, but being
  // fished out of the channel is not the same as being killed by it and the
  // screen should not say the same thing about both.
  const CH = { land: 'chute', sea: 'chuteSea', low: 'chuteHard' };
  const key = chute && CH[chute];
  $('over-title').textContent = key ? T('over.' + key)
    : crashed ? T('over.crashed') : won ? T('over.won') : T('over.lost');
  $('over-sub').textContent = key ? T('over.' + key + 'Sub')
    : crashed ? T(onWater ? 'over.crashedSub' : 'over.crashedLand')
      : won ? T('over.wonSub') : T('over.lostSub');
  const rows = [
    ['over.time', formatClock(state.t)],
    ['over.dropped', groupNum(state.litresDropped) + ' l'],
    ['over.onTarget',
      Math.round(state.litresOnTarget / Math.max(1, state.litresDropped) * 100) + '%'],
    ['over.burnt', Math.round(fire.burntArea()) + ' ha'],
    ['over.intact', Math.round(state.cityHealth * 100) + '%'],
    ['over.score', groupNum(state.score)],
  ];
  // The airfield only appears if it ever happened. A line reading "0 of 0" for
  // a rescue nobody was offered is worse than no line.
  const g = ground && ground.ok ? ground.stats() : null;
  if (g && g.armed) {
    rows.push(['over.rescued', `${g.rescued} / ${g.rescued + g.crewLost}`]);
    rows.push(['over.apron', `${g.objSaved} / ${g.objSaved + g.objLost}`]);
  }
  $('over-stats').innerHTML = rows
    .map(([k, v]) => `<div><span>${T(k)}</span><b>${v}</b></div>`).join('');
}

function showEnd(won, crashed = false, onWater = false, chute = null) {
  // Whatever ended it, you are not in the water any more — and the sea is only
  // drawn from both sides while somebody is under it.
  if (swim && swim.active) swim.leave();
  $('swim-hud').hidden = true;
  $('under').hidden = true;
  $('under').classList.remove('on');
  const el = $('over');
  el.hidden = false;
  el.className = won ? 'win' : 'lose';
  endState = { won, crashed, onWater, chute };
  redrawEnd();
  $('touch').hidden = true;
  $('gtouch').hidden = true;
  $('ctouch').hidden = true;
  $('stouch').hidden = true;
  $('ground-hud').hidden = true;
  $('chute-hud').hidden = true;
  document.exitPointerLock?.();
}

$('again').addEventListener('click', () => location.reload());

// ── the aeroplane you left ───────────────────────────────────────────────────
/**
 * Nobody is flying her.
 *
 * The throttles wind back on their own, and with the stabiliser off she is out
 * of trim with six tonnes of water free to move in the tank. What she does not
 * do is glide: the first version of this dropped a wing and left the elevator
 * alone, and the lift model holds level flight for as long as the wings are
 * anywhere near level, so she flew straight on at cruise for the best part of a
 * minute before the bank had built enough to bring her down. From under the
 * canopy that reads as an aeroplane parked in the sky.
 *
 * So: a bank and a nose attitude, both held, both wound in over about two
 * seconds so she falls away rather than snapping over the instant you leave.
 * Sixty-odd degrees and twenty-five down is a spiral, which is what an
 * abandoned aeroplane actually does and what puts her in the ground inside
 * twenty seconds — long enough to watch, short enough to be an event.
 *
 * Both commands undo the flight model's squared stick response before handing
 * it over, so the gains here mean what they say. Without that, the first two
 * seconds of a ramp are squared down to nothing and the wind-in takes four
 * times as long as it reads.
 */
function flyDerelict(dt) {
  const p = flight.p;
  // Nobody left her. The escape charge puts you under a canopy from a standing
  // start, and the aeroplane it took you away from may well still be parked on
  // the apron with her chocks in — so there is no derelict here to fly, and
  // taking her controls would be the game flying an aircraft with a pilot in
  // fifty metres of clear air above it.
  if (launchedFrom) return;
  if (p.crashed) return;
  input.thrUp = input.thrDown = input.scoop = input.drop = false;
  p.throttle = Math.max(0, p.throttle - dt * 0.35);

  const away = sat((eject.since - 0.7) / 2.0);
  const ax = flight.axes();
  const bank = Math.atan2(ax.right.y, ax.up.y);
  const nose = Math.asin(clamp(ax.fwd.y, -1, 1));
  // Held to attitudes, not to rates. A steady deflection into a model this
  // forgiving does not depart, it barrel-rolls — round and round, all the way
  // down, which looks like an air display rather than a wreck in the making.
  const preSq = (c) => Math.sign(c) * Math.sqrt(Math.abs(c));
  p.stick.x = preSq(clamp((bank + DERELICT.bank * away) * 1.7, -1, 1));
  p.stick.y = preSq(clamp((-DERELICT.nose * away - nose) * 1.7, -1, 1));
  p.rudder = 0;
  flight.update(dt, input);
}

/**
 * And where she lands. Twelve tonnes and whatever is left in the tank, at two
 * hundred knots, into a hillside that is already alight in three other places —
 * so on land this starts a fourth. That is the price of the key, and it is
 * meant to be one: you get to walk away, and the fire gets a new front.
 *
 * The airframe goes. There is no wreck model, and a clean Canadair parked on a
 * burning hill would be a worse lie than an empty one; the fire and its smoke
 * column are the marker, and they are visible from further off than any wreck
 * would have been.
 */
function derelictDown() {
  planeGone = true;
  const d = flight.p.pos.distanceTo(eject.pos);
  alerts.bump(3.0 * (1 - sat((d - 200) / 1400)));
  audio.impact(flight.p.crashOnWater, flight.p.crashSpeed || 0);
  toast(T('toast.planeGone'), 'bad');
  if (!flight.p.crashOnWater && fire) {
    fire.igniteNear(flight.p.pos.x, flight.p.pos.z, 1);
    // Fuel, spread down the line she was travelling. One cell is a campfire;
    // this wants to read as an aircraft going in.
    const f = flight.axes().fwd;
    for (let i = 1; i <= 4; i++) {
      fire.igniteNear(flight.p.pos.x + f.x * i * 14, flight.p.pos.z + f.z * i * 14, 0.8);
    }
  }
  plane.root.visible = false;
}

// ── frame ────────────────────────────────────────────────────────────────────

const clock = new THREE.Clock();
let started = false;
let wasDropping = false;
let wasAfoot = false;
// How far into the special kabina you are, smoothed. One number, because the
// door has to move the light and the sound together or it is two effects that
// happen to share a threshold.
let indoors = 0;
let inLatch = 0;
let cicadaAt = 0;
let waterAt = -1, wetAt = -1;
// How *dark* the room you are in is, which is a separate number from whether
// you are in one. The kabina is a wooden box with a single door and stopping
// down half a stop walking into it is what an eye does. The vikendica has
// thirteen square metres of glass in two walls and white plaster on all of
// them; stopped down the same amount it reads as a cellar with a view, which is
// the opposite of the thing the model is for. Same latch, different weight.
let roomDark = 0;
let darkWant = 0;
// And a third: how close the camera is to a surface it must not be able to see
// through. Wider than either of the others, ramped rather than latched, and it
// drives the near clip and nothing else — see `vik.hull`.
let clipNear = 0;
let cicadaGain = 0.05;
// True while you are on foot inside the Jadrija field, which is the one place
// the mission is allowed to stop happening. Set at the top of `frame`.
let recess = false;
let lastFrameMs = 0;

/**
 * The threshold.
 *
 * You can walk into the kabina perfectly well — the doorway measures 1.45 m
 * clear from the face right through the wall, and the floor behind it is 4.0 m
 * across and 5.1 m deep with nothing in the middle of it. What you cannot do is
 * *arrive*. You step over the sill and you are standing in the opening with a
 * white promenade at your back and a dark room in front, half in and half out,
 * and the room never becomes the place you are — it stays a thing you are
 * looking into. That is not a collision problem and no amount of making the
 * room bigger fixes it, which is the lesson of the last two passes at it.
 *
 * So the door is a cut. Screen goes down over a fifth of a second, you are set
 * on the middle of the floor with the room in front of you and the doorway
 * behind, the light and the mix are snapped to the room's, and it comes back up
 * over half a second — which is roughly what an eye does walking in off white
 * concrete, and is why the fade up is more than twice the fade down.
 *
 * Your heading and your pitch survive it. A cut that also turns you round is a
 * cut that loses you, and being lost is the one thing a room this small has no
 * way to recover from.
 *
 * It works in both directions and the way out is the way in: walk at the light.
 */
const DIP = { down: 0.20, hold: 0.09, up: 0.52, cool: 0.45, sill: 0.34 };
let dipPhase = 0;        // 0 idle, 1 going dark, 2 coming back
let dipT = 0;
let dipDo = null;
let dipPin = null;
let dipCool = 0;
let inRoom = false;
let roomStep = null;
const dipEl = () => document.getElementById('dip');

function crossThreshold(dt, afoot) {
  const K = jadrija && jadrija.kabina;
  dipCool = Math.max(0, dipCool - dt);

  if (dipPhase) {
    dipT += dt;
    let a;
    if (dipPhase === 1) {
      a = Math.min(1, dipT / DIP.down);
      if (dipT >= DIP.down + DIP.hold) {
        // At the bottom, where nobody can see the seam.
        if (dipDo) dipDo();
        dipDo = null;
        dipPhase = 2; dipT = 0; a = 1;
      }
    } else {
      const u = Math.min(1, dipT / DIP.up);
      // Squared, so it clears the last of the black quickly and then dwells
      // near the light — which is the shape of an iris opening.
      a = (1 - u) * (1 - u);
      // Zeroed *here* and not on the next frame. Written as a fall-through it
      // put one frame of full black on the screen at the end of every fade up,
      // because ending the phase resets the clock the opacity is computed from
      // and 1 - 0 is 1: a cut that finishes with a blink.
      if (u >= 1) { dipPhase = 0; dipT = 0; dipCool = DIP.cool; a = 0; }
    }
    // Pinned for the whole of the dark. Nothing stops the keys while the
    // screen is down, and 0.8 s at six metres a second is four and a half
    // metres of walking you cannot see — which at the far end of a room 5 m
    // deep is the back wall. Looking around still works, and wants to: coming
    // up out of the black already turning is most of what makes it a place.
    if (dipPin && ground && ground.ok) ground.stepTo(dipPin[0], dipPin[1]);
    if (!dipPhase) dipPin = null;
    const el = dipEl();
    if (el) el.style.opacity = String(a);
    return;
  }

  const el = dipEl();
  if (el && el.style.opacity !== '0') el.style.opacity = '0';
  if (!afoot || !K || !ground || !ground.ok || dipCool > 0) {
    // Walking away from the resort, baling out, or dying in it all count as
    // having left the room, or you come back to Jadrija already indoors.
    if (!afoot) { inRoom = false; roomStep = null; }
    return;
  }

  const [t, s] = jadrija.local(camera.position.x, camera.position.z);
  const prev = roomStep;
  roomStep = [t, s];
  // This has to be a crossing, not merely being somewhere behind the hut in
  // the doorway's t span. Otherwise the alley behind it becomes an invisible
  // entrance and running along the back wall cuts straight into the room. Test
  // where the path crosses the threshold, not its endpoint: a diagonal or fast step
  // can legitimately end past a jamb after passing through the open door.
  const u = prev && s > prev[1] ? (K.face - prev[1]) / (s - prev[1]) : -1;
  const tAtSill = prev ? prev[0] + (t - prev[0]) * u : 0;
  const entered = prev && u >= 0 && u <= 1
    && Math.abs(tAtSill - K.dc) < K.dj + 0.20;
  if (!inRoom && entered) {
    inRoom = true;
    dipStart(() => {
      const w = jadrija.toWorld(K.standIn[0], K.standIn[1]);
      dipPin = [w[0], w[2]];
      ground.stepTo(w[0], w[2]);
      roomStep = [K.standIn[0], K.standIn[1]];
      inLatch = 1;
    });
  } else if (inRoom && prev && prev[1] >= K.face && s < K.face) {
    inRoom = false;
    dipStart(() => {
      const w = jadrija.toWorld(K.standOut[0], K.standOut[1]);
      dipPin = [w[0], w[2]];
      ground.stepTo(w[0], w[2]);
      roomStep = [K.standOut[0], K.standOut[1]];
      inLatch = 0;
    });
  }
}

function dipStart(fn) { dipPhase = 1; dipT = 0; dipDo = fn; dipPin = null; }

/** What `state.phase` was last frame, so the change itself can be acted on. */
let lastPhase = '';

function frame() {
  requestAnimationFrame(frame);
  // Read the clock even when paused, and read it before anything can bail out.
  // getDelta() reports wall time since it was last read, so an interval that is
  // never read comes back as one enormous dt — and a pause you sat through for
  // thirty seconds would resume by integrating thirty seconds of flight in a
  // single step, straight through whichever hill you were over.
  const real = Math.min(0.05, clock.getDelta());
  // Nothing else: not the sim, not uTime, not even the render. The canvas holds
  // the last frame it drew, which is exactly the picture a pause should show.
  if (state.paused) return;

  // Slow motion, and it is one multiplication because there is one delta.
  //
  // `dt` from here down is world time and `real` is wall time, and almost
  // everything wants the first: her clips, the birds, the trees, the water, the
  // hose, your own walk. Three things want the second, each for its own reason,
  // and they are the whole of the design here — see `stepLens`, `updateMission`
  // and `fire.update` below.
  //
  // `zoom` is last frame's value, because `stepLens` runs near the bottom of
  // this function. One frame of lag on a number that takes about a fifth of a
  // second to travel is not a thing anybody can see, and the alternative —
  // hoisting the lens up here — would put the camera's easing ahead of the
  // simulation it is easing over.
  // Slow motion rides the lens — see SLOW — everywhere, water included.
  //
  // It used to stop at the waterline, on the argument that the sea's own
  // rhythm is the clock you read the mode by and that slowing it would read
  // as hung. That was the wrong call: Z is a scope, and the whole of what a
  // scope is is that the world goes quiet and long while you are looking down
  // it. Holding it under water is the same act for the same reason, and the
  // swell going slow and the breath bar going slow with it is the point of
  // pressing the key rather than a side effect of it.
  const dt = real * (1 - (1 - SLOW) * zoom);
  U.uTime.value += dt;
  if (!started) return;

  // Leave the seat and leave the seat's noise behind with it.
  //
  // The alert model draws a caption and a red vignette that are only cleared
  // by the next frame of `alerts.update`, and `alerts.update` only runs in
  // 'fly' — so a PULL UP that was on the screen at the moment you hit J stayed
  // on the screen through the canopy, the swim, the walk and the whole of the
  // vikendica, being redrawn by nothing and cleared by nothing. `reset()` has
  // existed since the module was written and was called from precisely
  // nowhere. One transition edge is the right place for it: not eleven copies
  // in eleven back doors, one line where the phase actually changes.
  if (state.phase !== lastPhase) {
    if (lastPhase === 'fly' && alerts) alerts.reset();
    lastPhase = state.phase;
  }

  // Jadrija is a recess, and while you are in it the fire waits.
  //
  // This contradicts, deliberately and only here, the rule two hundred lines
  // down that the town does not stop burning because you got out of the
  // aeroplane. That rule is right about Rokići: the apron is forty kilometres
  // of road from the fire and you are still fighting it, still watching the
  // wingmen work, still able to lose the town while you stand there. It is
  // wrong about Jadrija, which is not the mission at a distance — it is a
  // different game with a different subject, and the mission finishing without
  // you while you are down there reads exactly as it reads: a verdict on
  // something nobody in the frame is looking at. "The fire is out" arriving
  // over a beach at four in the afternoon is not a reward, it is an interruption
  // by a screen from another game.
  //
  // So the whole of it holds: no spread, no burn-out, no spot calls, no win and
  // no loss. Walk back to the aeroplane and the fire is where you left it, which
  // is also the only honest thing to do with a clock you have stopped.
  recess = (state.phase === 'ground' || state.phase === 'chute') && !!jadrija
    && jadrija.inField(camera.position.x, camera.position.z);

  if (state.phase === 'ground') {
    // The branch, on mouse or space. The aeroplane's own input is deliberately
    // not read: it is parked, and nothing on foot should be moving its controls.
    ground.setSpray(mouseDrop || keys.has('Space') || TOUCH.gjet || debugJet);
    // Unless she is not parked. Walking away from an aeroplane you jumped out of
    // does not stop her flying — and it used to: the only place she was being
    // integrated was the chute branch, so the moment the canopy touched down she
    // froze in mid-air and hung there for the rest of the game, in plain view.
    if (eject.active) flyDerelict(dt);
    // And if that walk was into the sea, it was a walk into the sea. The
    // barrier at the waterline used to be the end of the world in that
    // direction; now it is a doorway, and the far side of it has its own mode.
    const wet = ground.wet && ground.wet();
    if (wet) waadeIn(wet[0], wet[1]);
    updateMission(real);
  }

  if (state.phase === 'chute') {
    // Two things are happening at once and only one of them is you. You are
    // hanging under a canopy watching the other one go in.
    flyDerelict(dt);
    eject.update(dt, {
      turn: clamp((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
        - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + TOUCH.cx, -1, 1),
      // Up is the front risers and down is the brakes, which is the way round
      // your hands actually go: push the nose down to reach, hold it off to
      // stay up. Space keeps the flare on its own key for the landing.
      //
      // On glass all three are the one stick. Forward is proportional, because
      // the risers are; back past two-thirds is the flare, because a flare is
      // not — it is a thing you commit to at ten metres with both hands.
      dive: keys.has('ArrowUp') || keys.has('KeyW') ? 1 : Math.max(0, TOUCH.cy),
      flare: keys.has('Space') || keys.has('ArrowDown') || keys.has('KeyS')
        || TOUCH.cy < -0.66,
    });
    updateMission(real);
  }

  if (state.phase === 'swim') {
    // The aeroplane is still going in somewhere behind you, and you are still
    // the only person watching it. Same as under the canopy.
    if (eject.active) flyDerelict(dt);
    // Keys and thumbs, added rather than switched between, exactly as the
    // other three modes do it: a touchscreen laptop with a keyboard plugged
    // into it is a real machine and neither half of it should win.
    // Whether the race is on, which two of the controls below care about.
    const racing = !!(chase && chase.active) || !!chaseCut;
    swim.update(dt, chaseCut ? { held: true } : {
      fwd: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
        - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + TOUCH.sy,
      // A and D still strafe, because that is what they do in the other two
      // modes and a key that means two things in two modes is worse than a
      // key that means nothing. The arrows turn: under water there is no
      // ground to push sideways off, so strafing was the one control in the
      // mode that did nothing you could see, and left and right are the keys
      // everybody reaches for to look round.
      side: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + TOUCH.sx,
      turn: (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0),
      // Q as well as shift, which is what the on-foot mode runs on.
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyQ')
        || TOUCH.sfast,
      // Down, and during the race down on its own.
      //
      // Two people chasing each other along the surface is two heads in the
      // chop; the same two a half metre under is a swim. So while the race is
      // on the water takes you down to `RACE_DEEP` unless you are actively
      // asking to come up — a nudge and not a lock: Space still works, and
      // letting go of it simply sinks you back to where she is.
      down: keys.has('KeyC') || keys.has('ControlLeft') || TOUCH.sdown
        || (racing && !keys.has('Space') && !TOUCH.sup
          && swim.depth < RACE_DEEP),
      up: keys.has('Space') || TOUCH.sup,
      // And no breath clock while it runs — see the note in 59-swim.js for why
      // this is the race and not the mask.
      held: racing,
    });
    // Under and out from under. Both are events and neither is a state: the
    // sound belongs to the moment the ears change what they are in, which is
    // the one frame the flag flips. How hard you gasp is how badly you needed
    // it — a duck under and up is nothing, twenty seconds down is a noise.
    if (swim.submerged !== wasUnder) {
      wasUnder = swim.submerged;
      if (audio) {
        if (wasUnder) audio.plunge(0.7);
        else audio.gasp(clamp(1.35 - swim.breath, 0.45, 1.15));
      }
    }
    // And the race, if there is one. Frozen while the shot is running: she has
    // a seven-metre lead and five seconds of camera, and letting her swim
    // through the establishing shot would hand her twenty-five.
    if (chase && chase.active && !chaseCut) {
      const out = chase.update(dt, swim.you, (x, z) => swim.surfaceAt(x, z));
      if (out === 'caught') { toast(T('chase.caught')); if (audio) audio.gasp(0.8); }
      else if (out === 'lost') { $('ch-say').textContent = ''; }
      // She has finished talking and is swimming back in. The race is over —
      // the HUD goes, the keys are yours — but she is not: `keep` is what stops
      // `endChase` calling `chase.stop()` and hiding her in the same frame she
      // turns round. She goes when she reaches the jetty, which is 'home'.
      else if (out === 'done') { endChase(true, true); }
      else if (out === 'home') { endChase(true); }
      paintChaseHud();
    }
    paintSwimHud();
    updateMission(real);
  }

  if (state.phase === 'ride') {
    // The aeroplane is still going in somewhere behind you, same as under the
    // canopy and in the water.
    if (eject.active) flyDerelict(dt);
    const out = ride.update(dt, {
      fwd: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
        - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + TOUCH.sy,
      side: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
        - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + TOUCH.sx,
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || TOUCH.sfast,
      down: keys.has('KeyC') || keys.has('ControlLeft') || TOUCH.sdown,
      up: keys.has('Space') || TOUCH.sup,
    });
    // Off the end of the water. The mode does not argue about it — it puts you
    // in the sea, which is where you would be.
    // Off the end of the water, or down on your back from ten metres. Both
    // put you in the sea, which is where they put you.
    if (out) dropKite(out === 'wipeout');
    else paintRideHud();
    updateMission(real);
  }

  if (state.phase === 'foil') {
    if (eject.active) flyDerelict(dt);
    const out = foil.update(dt, {
      // The trigger. Held rather than tapped, so W is "more" and S is "less"
      // and letting go of both leaves it where you put it — which is what a
      // hand throttle on a lanyard actually does and is the one control on the
      // board that is not a lean.
      fwd: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
        - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + TOUCH.sy,
      side: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
        - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + TOUCH.sx,
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || TOUCH.sfast,
      // Trim. Weight back and the board comes up the mast, weight forward and
      // it settles — the same two keys the swim uses for up and down, meaning
      // the same two things.
      up: keys.has('Space') || TOUCH.sup,
      down: keys.has('KeyC') || keys.has('ControlLeft') || TOUCH.sdown,
    });
    if (out === 'aground') dropFoil(false);
    else {
      if (out === 'breach' && audio) audio.plunge(0.55);
      paintFoilHud();
    }
    updateMission(real);
  }

  if (state.phase === 'fly') {
    readKeys(dt);
    flight.update(dt, input);
    updateMission(real);
    // Ground proximity, last, so it reads the state this frame ended in.
    // The inhibit is the whole design: on a legal scoop run, being five metres
    // over the sea is the job and nothing is allowed to shout about it.
    alerts.update(dt, {
      p: flight.p.pos,
      speed: state.speed,
      agl: state.altAgl,
      vs: flight.p.vel.y,
      fwd: flight.axes().fwd,
      inhibit: flight.p.scoopValid || state.scooping || flight.p.onWater,
    });
  }
  flight.pose(plane, dt);
  if (state.phase === 'intro') intro.update();

  // Gusts: one slow wave, one fast, so the fire breathes.
  state.gust = 0.5 + 0.5 * Math.sin(U.uTime.value * 0.11) * Math.sin(U.uTime.value * 0.043 + 2.1);
  U.uWindSpeed.value = state.windSpeed * (0.8 + 0.4 * state.gust);

  // On foot the camera *is* the player — no smoothing, no chase spring, no
  // lerp. Every one of those is there to make an aeroplane readable from
  // outside, and every one of them reads as motion sickness from inside a head.
  // The screenshot override goes first, ahead of the phase. It used to live
  // inside updateCamera(), which only the aeroplane reaches — so `__fr.look()`
  // did nothing at all on foot or under a canopy, silently, and every attempt
  // to photograph something at eye height came back as a picture of wherever
  // the player happened to be standing. Those are the two modes you most want
  // to aim a camera in.
  // Not under an override: `__fr.fov()` sets the angle by hand for a
  // screenshot, and a lens easing back to the setting every frame would take it
  // straight off again.
  // Wall time, not world time, and this one is nearly a paradox: the lens is
  // what causes the slowing, so easing it on slowed time would mean the deeper
  // it got the slower it got deeper. It would still arrive — the easing is
  // exponential and 0.35 of it still converges — but it would take three times
  // as long to finish, and the thing you pressed the key for would come in like
  // a hydraulic door.
  if (vikWalk && !vikHold) stepVikWalk(real);
  if (chaseCut) stepChaseCut(real);
  if (comp) stepComputer(real);
  else { checkLaptopSpray(); checkTvSpray(); }
  if (!camOverride) stepLens(real);
  // And the mix goes with it, water included — the duck and the long tail are
  // most of what makes the lens read as a scope rather than as a zoom, and
  // under water there is a second filter on top of it already, so the two
  // stack into something further off rather than fighting.
  if (audio) audio.slowmo(zoom);
  if (camOverride) updateCamera(dt);
  else if (state.phase === 'ground') ground.pose(camera);
  else if (state.phase === 'ride') ride.pose(camera);
  else if (state.phase === 'foil') foil.pose(camera);
  else if (state.phase === 'swim') { swim.pose(camera); poseSwimBody(dt); }
  else if (state.phase === 'chute' || eject.active) eject.pose(camera);
  else if (state.phase !== 'intro') updateCamera(dt);
  // After the pose, because the rig hangs off where you ended up rather than
  // off where you were.
  if (state.phase === 'ride') ride.draw();
  if (state.phase === 'foil') foil.draw();
  if (chase && (chase.active || chase.poised)) chase.draw(dt);
  U.uCamPos.value.copy(camera.position);
  // How deep the eye itself is, which is what dims the water rather than
  // merely colouring it. Taken off the wave surface at your own position and
  // not off zero, so a trough does not briefly surface you.
  U.uCamDepth.value = state.phase === 'swim' && swim
    ? Math.max(0, swim.surfaceAt(camera.position.x, camera.position.z)
      - camera.position.y)
    : Math.max(0, -camera.position.y);
  // After the camera is posed and before anything reads its matrix: the arms
  // hang off it, minus the roll. See src/60-arms.js.
  //
  // Gated on `swim.active` rather than on `state.phase`, which is the same
  // question asked of the object that owns the answer: the swim model sets it
  // when you enter the water and clears it when you leave, and there is nothing
  // for the phase to disagree with it about.
  // One arm rig, two water modes. It works out which from what it is handed —
  // see the note on `update` in 60-arms.js.
  if (arms) {
    // Not during the establishing shot: the camera is sixteen metres up and a
    // pair of arms drawn over the top of it is a pair of arms in the sky.
    arms.update(dt, chaseCut || bodyCam ? null : (state.phase === 'ride' ? ride : swim),
      camera);
  }
  // And what took the swimming arms' place — see 62-mask.js. Same gate for the
  // same reason: a mask frame drawn over a shot taken from sixteen metres up
  // is a mask on the sky.
  // The mask overlay is the inside of the thing on her face, so it goes away
  // the moment the camera is not behind it — but `mask.on` stays true, because
  // she is still wearing it and the body out in the water is drawing it.
  if (mask) {
    mask.update(dt, chaseCut || state.phase !== 'swim' ? null : swim, camera);
  }
  // Somebody else's afternoon, in the same wind as the fire. 46-kite.js.
  if (kites) kites.update(dt, camera);

  camera.updateMatrixWorld();
  _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(_pv);

  terrain.update(camera, frustum);
  trees.update(dt, camera.position);
  // After camera.updateMatrixWorld() above, which this depends on: the calls are
  // panned by projecting each bird on to the camera's right axis.
  //
  // All four aeroplanes are handed over, not just yours — a wingman coming off
  // the water puts the channel up the same way you do, and watching it happen to
  // somebody else is what stops it reading as a trick done for the player.
  birdFlush[0].pos = flight.p.pos;
  birdFlush[0].speed = state.speed;
  birds.update(dt, camera, birdFlush);
  props.update(dt);
  // The bathers. They pose off the camera rather than off the aeroplane: the
  // whole point of them is what they look like from the promenade, and on foot
  // the aeroplane is parked two kilometres away at Rokići.
  if (jadrija) jadrija.update(dt, camera.position);
  rail.update(dt);
  sea.update(camera);
  // The water column, which only exists while somebody is inside it. Keyed on
  // the eye rather than on the phase, so a bale-out that puts the camera under
  // the surface for half a second gets it too.
  under.update(camera, U.uCamDepth.value, U.uCamDepth.value > 0.02, renderer, dt);
  // Same gate as the dust: what is on the bottom is only ever seen from
  // under the surface, and from above it the sea shader is what you are
  // looking at rather than anything past it.
  seabed.update(camera, U.uCamDepth.value > 0.02);
  // Wall time to spread, world time to burn. The only process in the game that
  // is racing the clock rather than racing you — see the note on `update` in
  // src/40-fire.js for why letting it slow would be a cheat and letting
  // everything else slow is not.
  // Except at Jadrija — see `recess` at the top of this function. The events
  // queue is drained rather than left to bank up, so that walking back out does
  // not deliver twenty minutes of spot-fire calls in one frame.
  if (recess) fire.events.length = 0;
  else fire.update(real, dt);
  ground.update(dt);
  // The other three keep working while your wreck is still settling — and while
  // you are on foot. Gating this on the flying phase left all three of them
  // hanging motionless in the sky for the whole ground mission, which is both
  // the most obvious possible bug to see from the apron and a lie about what
  // they are doing: the fire does not stop for you getting out.
  if (state.phase !== 'intro') wingmen.update(dt);
  if (state.phase === 'intro') shadow.update(camera.position, camera.position);
  waterfx.update(dt);

  // Billboard bases for every instanced sprite system.
  const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  scene.traverse((o) => {
    const u = o.material && o.material.uniforms;
    if (u && u.uCamRight) { u.uCamRight.value.copy(camRight); u.uCamUp.value.copy(camUp); }
  });

  // Only on the edge: setTargetAtTime every frame is a ramp that never gets
  // anywhere, and re-arming it sixty times a second is audible as a stutter.
  if (state.dropping !== wasDropping) {
    if (state.dropping) audio.dropWhoosh();
    audio.setGush(state.dropping);
  }
  wasDropping = state.dropping;

  // Cicadas, on foot. A Dalmatian hillside in August is not quiet — it is one
  // continuous shrill from every pine on it, loud enough to talk over, and it
  // is the first thing anybody who has been there remembers. The synthesis for
  // it has been in the build since the cinematic and was only ever heard there,
  // which left the one mode you actually stand still in silent.
  //
  // Under the canopy too: you can hear the hillside coming up at you a long
  // time before you are on it, and that is most of what the last thirty seconds
  // of a descent is.
  const afoot = state.phase === 'ground' || state.phase === 'chute'
    || state.phase === 'swim';

  // Indoors, in the one kabina that opens. A wooden box with a single door
  // takes the singing off the terrace almost entirely and leaves the hillside
  // coming through the boards, so the cicadas stay and go up rather than down —
  // they are what quiet sounds like here, and a room with nothing in it at all
  // would read as the sound having broken.
  //
  // Latched, not followed. Being indoors is a place you are or are not, and
  // the first version — a ramp over the depth of the room — meant a player who
  // stopped a stride past the door stood in half a room in half the light,
  // with the singers half there. Schmitt: in at 0.62, out at 0.18, so the
  // doorway itself is the whole of the crossing and standing in it does not
  // flicker. What is left of the crossfade is the 0.3 s the light takes, which
  // is an eye adapting and wants to stay.
  //
  // Two rooms now. The kabina was the only interior in the game when this was
  // written, and the vikendica quietly inherited none of it — so standing in
  // the middle of a modelled flat the near clip was still 1.2 m and every wall
  // inside that distance was thrown away. You could see the beach through the
  // bedroom partition. Being *in* a house that you can see straight out of is
  // worse than not being able to go in at all, because it is the one thing the
  // house was built to test.
  const kabIn = afoot && jadrija && jadrija.kabina
    ? jadrija.kabina.inside(camera.position.x, camera.position.z) : 0;
  const vikIn = afoot && jadrija && jadrija.indoorsAt
    ? jadrija.indoorsAt(camera.position.x, camera.position.y, camera.position.z)
    : 0;
  const raw = Math.max(kabIn, vikIn);
  if (raw > 0.62) inLatch = 1; else if (raw < 0.18) inLatch = 0;
  // Which room it was, held while the latch is held so a doorway does not
  // change the exposure on the way through it.
  if (raw > 0.62) darkWant = vikIn > kabIn ? 0.34 : 1;
  crossThreshold(dt, afoot);
  // Held wherever the crossing put it while the screen is dark, so the light
  // in the room is already the room's light when it comes back up. Watching a
  // 0.3 s exposure ramp *after* a cut is watching the cut not have worked.
  if (dipPhase) { indoors = inLatch; roomDark = inLatch * darkWant; }
  else {
    indoors += (inLatch - indoors) * Math.min(1, dt * 3.6);
    roomDark += (inLatch * darkWant - roomDark) * Math.min(1, dt * 3.6);
  }
  // The cicadas, and how far away they are — which until now was "never".
  //
  // They were a switch: on for the whole of being out of the aeroplane, at a
  // fixed level, wherever you were. On the beach that is right and it is where
  // it was written; a kilometre out in the channel it is a hillside of pines
  // following you across open water at beach volume, which is what "the sound
  // of cicadas is loud out deep at sea" is, and it is not something the depth
  // curve could ever have fixed because the depth curve is about a surface and
  // this is about a distance.
  //
  // So: off the shore distance field, the same one the swim autopilot steers
  // down and the fire and the crowd already use. A hillside is a distributed
  // source and falls off slower than a point — an inverse square would have
  // them gone forty metres out, which is wrong the other way — so it is an
  // inverse 1.8 power over a 130 m scale: full on the sand, half at 130 m,
  // a twelfth at four hundred, and nothing at all by the time the far shore is
  // the nearer one.
  //
  // And how many of them there are, which the shore distance gets backwards at
  // exactly the place you spend most of your time.
  //
  // Measured, off two walks recorded on the peninsula. In the pine wood the
  // chorus is the loudest thing on the recording: a narrow band centred on
  // 5.1 kHz, half power from 4.6 to 5.6, and decorrelated between the two
  // microphones to r = 0.08 — which is to say it is not coming from anywhere,
  // it is the air. Two hundred metres away, standing on the concrete at the
  // water with the wood thirty metres behind, the same band is five or six
  // decibels down and the peak has slid to 3.6 kHz with the sides falling out
  // of it, which is not cicadas at all any more; it is wavelets and voices.
  //
  // Shore distance cannot express that. The bathing terrace is *at* the shore,
  // so the old curve gives it full gain — the one spot on the headland the
  // recording says is quietest. What the difference actually tracks is whether
  // there is a canopy over you, so that is what it is hung off now, with the
  // distance curve kept for the case it was written for: a kilometre out in
  // the channel, where there is neither.
  //
  // 0.45 at nothing and 1.0 under the trees is the five and a half decibels,
  // near enough.
  const cicD = afoot ? shoreAt(camera.position.x, camera.position.z) : 0;
  const cicW = afoot && trees && trees.canopyAt
    ? trees.canopyAt(camera.position.x, camera.position.z) : 1;
  const cicG = 0.05 * (0.45 + 0.55 * cicW)
    / (1 + Math.pow(Math.max(0, cicD) / 130, 1.8));
  if (afoot !== wasAfoot || (afoot && Math.abs(cicG - cicadaGain) > 0.0015)) {
    cicadaGain = cicG;
    audio.cicadas(afoot, cicG);
    wasAfoot = afoot;
  }
  // The beach, shut out by the wall. This used to make the cicadas *louder*
  // indoors on the theory that a quiet room is what you notice them in, and it
  // was the wrong theory: a changing hut with a hillside of cicadas at full
  // level in it is not a room you have walked into, it is a room somebody has
  // taken the roof off. They go through a gain and a lowpass now — see `room`
  // in src/80-audio.js — with the klapa on the same bus, and the radio on the
  // table pointedly not, because it is the one sound in here that is in here.
  if (afoot && Math.abs(indoors - cicadaAt) > 0.01) {
    cicadaAt = indoors;
    audio.room(indoors);
  } else if (!afoot && cicadaAt !== 0) { cicadaAt = 0; audio.room(0); }
  // And the sea shutting it out, which is the same idea one surface further
  // out. Driven from here rather than from the swim block so that it is also
  // driven on the frame you leave the water: a beach that stays muffled after
  // you have walked out of the sea is worse than one that never muffled.
  //
  // 1.1 m for the full effect. That is not a long way down, and it is not
  // meant to be — the change happens in the first hand's breadth and the rest
  // is the tail of it. `sat` clamps, so surfacing above the waterline (`depth`
  // goes negative floating on a swell) reads as zero rather than as noise.
  if (audio) {
    const wet = swim && swim.active;
    // Exponential, over about three metres rather than saturating at one.
    // A ramp that was finished at 1.1 m is a ramp that answers "deeper" with
    // "same", and deeper is the only thing the down key does.
    const w = wet ? 1 - Math.exp(-Math.max(0, swim.depth) / 0.95) : 0;
    if (Math.abs(w - waterAt) > 0.004 || (wet ? 1 : 0) !== wetAt) {
      waterAt = w; wetAt = wet ? 1 : 0;
      audio.water(w, wetAt);
    }
  }
  // The light. ACES over the whole frame rather than a lamp in the room,
  // because there is no lamp in the room — that is the point of it — and what
  // your eye actually does walking in off a white promenade is exactly this.
  renderer.toneMappingExposure = 0.92 - 0.50 * roomDark;
  // And the near plane, which is the whole of "I can see the sky through the
  // ceiling". 1.2 m is the right front clip for an aeroplane and is nonsense
  // for a person: standing on the floor of the kabina your eye is 1.66 m up
  // under a 2.10 m ceiling, so the ceiling is 0.44 m away and every one of its
  // triangles is in front of the near plane and thrown away. What is behind it
  // is the roof, also inside 1.2 m, also thrown away, and then the sky. The
  // same clip ate any wall you stood within 1.2 m of, which in a room 4 m
  // across is most of the floor — the room was not dark, it was full of holes.
  //
  // Ramped on `indoors` rather than switched on `afoot`, so the depth buffer
  // only pays for it in the one place that needs it. Outdoors the near clip
  // stays where the aeroplane wants it: near/far is 1.2/42000 and dropping the
  // near end twenty-fold costs twenty-fold the depth resolution at the far end,
  // which at four kilometres is the difference between a town and a town that
  // flickers. Indoors the far end is a doorway 1.45 m wide with the sea in it.
  //
  // Off `clipNear`, which is the union of "in a room" and "up against the
  // vikendica from either side". Inside 1.2 m the clip does not care which side
  // of a wall you are standing on, and the cut sequence's own best shot — the
  // climb, taken 0.7 m off the east face — was a shot of the furniture through
  // the wall.
  const hullNow = afoot && jadrija && jadrija.hullAt
    ? jadrija.hullAt(camera.position.x, camera.position.y, camera.position.z)
    : 0;
  //
  // Followed and not ramped, which is the opposite of everything else on this
  // threshold. The whole guarantee is that the clip stays nearer than the
  // nearest wall — hull() is chosen so the two curves never cross — and a lag
  // is exactly what breaks it: walk at a wall faster than the ramp and for a
  // tenth of a second the wall is inside the clip again. Nothing pops, because
  // by that same guarantee there was never anything between the two positions
  // of the plane to pop in.
  // The third surface you can put your face against is the bottom of the sea,
  // and it was the one nobody had thought of. A swimmer is allowed within
  // eighty centimetres of the bed and the front clip sits at 1.2 m, so looking
  // down from there threw away every triangle of seabed under you and left the
  // inside of the world showing through it — which is exactly what "I can see
  // below the sea bed" is. Same treatment as a wall, off the same plane, and
  // free: underwater the far end of the view is eighteen metres of green, so
  // there is no far end left to spend depth precision on.
  const bedNow = swim && swim.active
    ? 1 - Math.min(1, Math.max(0, (swim.clearance - 0.7) / 1.7))
    : 0;
  // And a fourth: your own hands. A kite bar is 62 cm in front of your face
  // and the four lines leave from it, so at the standing clip everything from
  // the bar up to head height is inside the front plane and the lines arrive
  // as four white poles that begin in mid-air. 0.38 m rather than the 0.06 a
  // wall gets — the far end of this view is still four kilometres of town and
  // does not want its depth thrown away, and 0.38 is all it takes to clear a
  // pair of hands.
  // And the foil board, which is under your own feet and a metre and a half
  // long: at the standing clip its nose is inside the front plane and the
  // board arrives as a shape that starts in mid-air.
  const rideNear = state.phase === 'ride' || state.phase === 'foil' ? 0.72 : 0;
  clipNear = Math.max(indoors, hullNow, bedNow, rideNear);
  const wantNear = 1.2 - 1.14 * clipNear;
  if (Math.abs(camera.near - wantNear) > 0.005) {
    camera.near = wantNear;
    camera.updateProjectionMatrix();
  }

  // And the klapa, off the terrace at Jadrija. Measured from the camera rather
  // than from the aeroplane, which is the same point in every mode except the
  // chase view and is the right one in that too: what you hear should follow
  // where you are looking from, not where the airframe is.
  //
  // Deliberately audible from a long way out. On a still August afternoon four
  // men singing outdoors carry a kilometre over flat water, and the whole point
  // of the thing is that you pick it up as a suggestion somewhere over the
  // channel and only work out what it is on the way in.
  if (jadrija && state.phase !== 'intro') {
    const d = Math.hypot(camera.position.x - jadrija.site.x,
      camera.position.z - jadrija.site.z);
    // Indoors the singers go away by being put back over the water: the same
    // distance curve `klapa` already has, walked out to the edge of earshot.
    // Cheaper than a second gain stage and, unlike one, it takes the top off
    // them on the way — which is what a shut door does to four men singing.
    //
    // And on a board they stay with you. A rider does ten metres a second and
    // is a kilometre out inside two minutes, which put the whole of the kite
    // mode in silence — and the kite mode is a Jadrija afternoon, not an
    // expedition. Capped rather than pinned: it still opens all the way up
    // when you carve back in along the terrace, it just stops going away.
    const dk = state.phase === 'ride' || state.phase === 'foil' ? Math.min(d, 400) : d;
    audio.klapa(dk + indoors * 2000, state.phase === 'fly');
  }

  if (state.scooping) {
    const { fwd, right } = flight.axes();
    scoopSpray.emit(flight.p.pos, fwd, right, state.speed, dt);
  }

  // Centred on whoever the player currently is. Left on the aeroplane, a
  // parachute descent watches an unshadowed hillside come up while the shadow
  // map follows a wreck four kilometres away.
  //
  // On foot it has to be the eye and not the aircraft, and for a worse reason
  // than a missing shadow: outside the cascade `shadowAt` reads as *shadowed*,
  // so walking away from your aeroplane draws a hard black line across the world
  // at 450 m and everything past it goes out. That never showed while the only
  // way on to your feet was climbing out of the door at Rokići — you were always
  // standing next to the thing the map was centred on.
  shadow.set(shadowMode(), state.phase === 'fly' ? CONFIG.shadowEvery : 1);
  shadow.update(state.phase === 'ground' ? camera.position
    : eject.active ? eject.pos : flight.p.pos, camera.position);
  shadow.syncMoving();
  shadow.render(renderer);

  // The mix: your own engines, and only your own engines.
  //
  // There used to be a second term here — `0.55 * (1 - sat((nearestAI - 40) /
  // 700))` — folded in with a `Math.max` so that a wingman passing nearby could
  // also open the engine beds. The intention was good and the mechanism was
  // not, and it is the drone people kept reporting on the promenade.
  //
  // What made it wrong is what `near` feeds. It scales four beds and every one
  // of them belongs to *your* aeroplane: two propellers at your shaft speed, a
  // turbine at your throttle, the combustion rumble, and the slipstream over
  // your airframe. Handing that a wingman's distance does not render a wingman.
  // It renders your own aeroplane, at your own throttle setting, from wherever
  // you happen to have left it — with no direction, no doppler and no pass-by,
  // so it does not swell and fade as the aircraft goes over. It sits there.
  //
  // And it could only ever fire in exactly the case where it is most wrong.
  // `own` is above 0.55 for anything within about 240 m, so the wingman term
  // only wins when you are far from your own aeroplane — which is to say, on
  // foot, which is to say, standing on a beach with a Canadair four kilometres
  // away drumming in your ears. Flying, it changed nothing, because the chase
  // camera is twenty metres off your own tail and `own` is already 1.
  //
  // A wingman going over *should* be audible, and this is not the way: that
  // wants its own voice, positioned, with an envelope that arrives and leaves.
  // Until there is one, silence on the promenade is the honest answer, and it
  // is much closer to right than a stuck drone is.
  //
  // `gone` is the other half. Stranded means you walked in under a canopy or
  // through one of the back doors, and in both cases the airframe is not a
  // thing over there that you are standing away from — it is gone, or it never
  // came. `flight.p` goes on existing regardless and its position is wherever
  // the model left it, which at Jadrija is close enough across the channel to
  // score a healthy `own` on its own.
  const gone = ground.stranded || eject.active;
  const own = gone ? 0
    : 1 - sat((camera.position.distanceTo(flight.p.pos) - 20) / 400);
  const nf = fire.nearestFire(camera.position.x, camera.position.z);
  audio.update(dt, {
    throttle: flight.p.throttle,
    speed: state.speed,
    alt: state.altAgl,
    // And the cockpit mix only while you are in the cockpit. `camMode` is
    // remembered across a bale-out, so leaving this on the camera alone meant
    // that whether the promenade had engines drumming over it depended on
    // which view you happened to have been flying in.
    inside: CAMS[camMode] === 'cockpit' && state.phase === 'fly',
    near: own,
    scooping: state.scooping,
    overSea: isSea(flight.p.pos.x, flight.p.pos.z),
    fireDist: nf ? Math.hypot(nf[0] - camera.position.x, nf[1] - camera.position.z) : 1e9,
    burning: fire.burningCount(),
    stall: state.speed < FLIGHT.vStall * 1.05 && state.altAgl > 3 && state.phase === 'fly',
    hose: ground.hose(),
    // Standing in it. The mixer shuts down for good when the aeroplane hits
    // something, which is right if that was the end of you and wrong if you
    // walked away from it — see the note on `dead` in 80-audio.js.
    afoot: state.phase === 'ground' || state.phase === 'chute'
      || state.phase === 'swim',
  });

  if (state.phase === 'ground') {
    updateGroundHUD(dt);
  } else if (eject.active) {
    updateChuteHUD();
  } else {
    updateStickHUD();
    updateHUD(dt);
  }
  updateRadio(dt);

  // Before the frame, not after: the reflection is of this frame's world, and
  // it renders into a target of its own, so the order that matters is that the
  // glass has something in it by the time the room it is hanging in is drawn.
  if (you) you.tick(dt, camera);
  chuteAudio();
  if (mirror) mirror.update(renderer, scene, camera);
  if (mirrorP) mirrorP.update(renderer, scene, camera);
  // The world, through the occlusion pass if it is on. It returns false when
  // it has not drawn — off, or a target it could not make — and then this is
  // the renderer exactly as it was before any of that existed.
  if (!ao || !ao.render(scene, camera)) renderer.render(scene, camera);
  // And your own arms over the top of it, on a near plane the world cannot
  // afford. See src/60-arms.js.
  if (arms) arms.render(renderer);
  // The mask goes on last of all, because it is the closest thing to your eye
  // that exists — and only in the water. The alpha it fades on its own is a
  // frame behind the phase, and one frame of a dive mask over the first frame
  // of a walk up to the vikendica is the whole of the complaint.
  if (mask && state.phase === 'swim' && !chaseCut && !bodyCam) mask.render(renderer);
  const now = performance.now();
  if (lastFrameMs) state.fps = damp(state.fps, 1000 / Math.max(1, now - lastFrameMs), 2, dt);
  lastFrameMs = now;
}

// The cinematic is thirty seconds long and it is the same thirty seconds every
// time. Worth watching once; an obstacle on the fourth attempt at the same
// fire. So it is remembered: the first visit gets it off the take-off button,
// and after that the button goes straight to the aeroplane and the cinematic
// has its own, quieter one. Remembered in localStorage rather than for the tab,
// because a second tab is not a second first impression.
//
// localStorage throws outright on file:// in Chrome and in some private modes,
// which is exactly how this build is often opened, so neither call may be
// trusted to return. Failing closed means the intro plays — the old behaviour.
const SEEN_KEY = 'fr.introSeen';

function introSeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
}

function markIntroSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* nothing to do */ }
}

function leaveVeil() {
  $('veil').classList.add('gone');
  started = true;
  audio.start();
  camPos.copy(flight.p.pos);
  camAim.copy(flight.p.pos);
}

$('enter').addEventListener('click', () => {
  const seen = introSeen();
  leaveVeil();
  if (seen) beginFlight();
  else playIntro();
});

$('watch').addEventListener('click', () => {
  leaveVeil();
  playIntro();
});

function playIntro() {
  // Skipping counts as having seen it. Someone who pressed skip is the last
  // person who wants it again next time.
  markIntroSeen();
  if (location.search.includes('nointro')) { beginFlight(); return; }
  $('cine').hidden = false;
  requestAnimationFrame(() => $('cine').classList.add('open'));
  intro.start(beginFlight);
}

function beginFlight() {
  intro.finish();
  $('cine').hidden = true;
  $('hud').hidden = false;
  if (IS_TOUCH) $('touch').hidden = false;
  state.phase = 'fly';
  state.t = 0;
  // If the intro was skipped before its last beat, the fire still has to exist.
  if (fire.burningCount() === 0) {
    const [ix, iz] = CONFIG.ignitionPoint;
    fire.igniteNear(ix, iz, 1);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      fire.igniteNear(ix + Math.cos(a) * 70, iz + Math.sin(a) * 70, 0.85, 3);
    }
  }
  radio('call.1', 'radio.start');
  camPos.copy(camera.position);
  camAim.copy(flight.p.pos);
  if (!IS_TOUCH) setTimeout(grabPointer, 250);
  // The same back door as `0`, as a link — which is the only version of it a
  // phone can use, there being no keyboard to press it on.
  if (location.search.includes('jadrija')) setTimeout(skipToJadrija, 60);
  else if (location.search.includes('ground')) setTimeout(skipToGround, 60);
}

$('cine-skip').addEventListener('click', beginFlight);

// Also on the console, where a bug report can be copied out of it.
console.log(`Flamme Retardé v${BUILD.v} · built ${BUILD.date}`);

frame();
boot().catch((e) => {
  $('stage').textContent = T('load.failed') + e.message;
  console.error(e);
});

// A small handle for the screenshot tool.
window.__fr = {
  build: BUILD,
  /** What this machine's GL will do. `?gl` puts the same thing on the screen. */
  gl: () => glReport(),
  stats: () => ({
    build: BUILD.v + ' (' + BUILD.date + ')',
    fps: Math.round(state.fps), burning: fire ? fire.burningCount() : 0,
    tiles: terrain ? terrain.stats() : null,
    trees: trees ? trees.stats() : null,
    landmarks: landmarks ? landmarks.list.length + '/' + LANDMARKS.length : null,
    city: city ? {
      built: city.built, tris: city.tris, tagged: city.tagged,
      forms: city.forms && { gable: city.forms[0], hip: city.forms[1], flat: city.forms[2],
        pyramid: city.forms[3], skillion: city.forms[4], round: city.forms[5] },
    } : null,
    roads: roads ? { runs: roads.drawn, km: Math.round(roads.km), tris: roads.tris } : null,
    field: airfield && airfield.site ? {
      at: [Math.round(airfield.site.x), Math.round(airfield.site.z)],
      hdgDeg: Math.round(airfield.site.yaw * 180 / Math.PI),
      slopePc: +(airfield.site.slope * 100).toFixed(2),
      bumpM: +airfield.site.worst.toFixed(2),
      objects: airfield.objects.length, tris: Math.round(airfield.tris),
    } : null,
    jadrija: jadrija ? {
      shoreM: Math.round(jadrija.length), houses: jadrija.houses,
      census: jadrija.census,
      blockers: jadrija.blockers.length, tris: Math.round(jadrija.tris),
      at: [Math.round(jadrija.site.x), Math.round(jadrija.site.z)],
      people: jadrija.crowd.people, walkers: jadrija.crowd.walkers,
      rigs: jadrija.crowd.rigs.join('+') || 'none',
      posed: jadrija.crowd.drawn,
      testFigure: jadrija.testFigure || 'none',
    } : null,
    rail: rail ? { ways: rail.ways, km: +rail.km.toFixed(1), cars: rail.cars,
      lineKm: +rail.lineKm.toFixed(2), tris: Math.round(rail.tris) } : null,
    ground: ground ? ground.stats() : null,
    swim: swim && swim.active ? swim.stats() : null,
    under: under ? under.stats() : null,
    seabed: seabed ? seabed.stats() : null,
    ride: ride && ride.active ? { ...ride.stats(), point: ride.point() } : null,
    arms: arms ? arms.stats() : null,
    mask: mask ? mask.stats() : null,
    shadow: shadow ? shadow.stats() : null,
    ao: ao ? ao.stats() : null,
    foil: foil && foil.active ? foil.stats() : null,
    kites: kites ? kites.stats() : null,
    props: props ? props.counts : null,
    birds: birds ? birds.stats() : null,
    water: Math.round(flight ? flight.p.water : 0),
    wingmen: wingmen ? wingmen.debug() : null,
    runs: wingmen ? wingmen.runCount() : 0,
    aiLitres: wingmen ? Math.round(wingmen.litres()) : 0,
    burntHa: fire ? Math.round(fire.burntArea()) : 0,
    speed: Math.round(state.speed * 3.6), alt: Math.round(state.altAgl),
    hdg: flight ? Math.round((Math.atan2(flight.axes().fwd.x, -flight.axes().fwd.z)
      * 180 / Math.PI + 360)) % 360 : 0,
    bank: flight ? Math.round(Math.atan2(flight.axes().right.y, flight.axes().up.y)
      * 180 / Math.PI) : 0,
    phase: state.phase,
    // True while the mission is on hold because you are down at Jadrija — see
    // `recess` in `frame`. Worth reporting: it is the one flag that makes the
    // fire stop moving, and a fire that is not moving is otherwise a bug.
    recess,
    // And where the eye is in the resort's own frame, which is what decides it.
    //
    // Reported next to `recess` rather than left to be worked out, because the
    // two disagreeing is the tell for a stale frame and not for a broken test:
    // `recess` is written once a frame and a headless page runs rAF at about
    // one frame a second, so a probe taken a tenth of a second after the camera
    // is moved reads the flag from before the move. That cost an hour once.
    camTS: jadrija ? jadrija.local(camera.position.x, camera.position.z)
      .map((v) => +v.toFixed(1)) : null,
    planeShown: plane ? plane.root.visible : null,
    crashed: flight ? flight.p.crashed : false,
    // What the stick is actually being told, and whether anything is helping.
    // Both are invisible from outside and both have hidden a bug: an aeroplane
    // that will not do what the code plainly commands is nearly always one of
    // these two, and guessing at it from attitude alone costs an afternoon.
    stick: flight ? [+flight.p.stick.x.toFixed(3), +flight.p.stick.y.toFixed(3)] : null,
    assist: flight ? +flight.p.assist.toFixed(2) : null,
    ap: flight ? (flight.p.autopilot ? flight.p.apNote || 'on' : 'off') : null,
    scoop: flight ? (flight.p.scoopValid ? 'OK' : flight.p.scoopReason) : null,
    thr: flight ? Math.round((flight.p.throttle + flight.p.boost * FLIGHT.overboost) * 100) : 0,
    nav: flight && flight.p.navTarget ? {
      mode: flight.p.navTarget.mode,
      along: Math.round(flight.p.navTarget.along ?? 0),
      cross: Math.round(flight.p.navTarget.cross ?? 0),
      alt: Math.round(flight.p.navTarget.alt),
    } : null,
    pos: flight ? [Math.round(flight.p.pos.x), Math.round(flight.p.pos.y),
      Math.round(flight.p.pos.z)] : null,
  }),
  key: (code, down = true) => dispatchEvent(
    new KeyboardEvent(down ? 'keydown' : 'keyup', { code })),
  /**
   * The gameplay recorder — src/92-clip.js.
   *
   * `grab` rather than `save` is what a headless test wants: `save` starts a
   * download, and a download is a file dialog and a disk that a CDP driver has
   * neither of unless it has been told to.
   */
  clip: {
    arm: () => clipArm(),
    disarm: () => clipDisarm(),
    armed: () => clipArmed(),
    /** Seconds in the bank — what N would write out right now. */
    held: () => +clipHeld().toFixed(2),
    save: () => clipSave(),
    grab: () => clipGrab(),
  },
  skipIntro: () => beginFlight(),
  /**
   * The seat, without a keyboard. Synthetic key events never reach the `keys`
   * set from a headless driver, so a parachute test drives the canopy the same
   * way a flight test drives the aeroplane: by stepping it itself.
   */
  chute: {
    fire: () => baleOut(),
    reset: () => {
      eject.reset(); state.phase = 'fly'; planeGone = false;
      plane.root.visible = true;
    },
    raw: () => eject,
    step: (dt, turn = 0, flare = false, dive = 0) => {
      eject.update(dt, { turn, flare, dive });
      return eject.stats();
    },
    stats: () => eject.stats(),
    /**
     * Put the abandoned aeroplane just above whatever is under her. The dive is
     * eighteen seconds of real time and rather more than that headless with a
     * hillside alight, and none of it is what a test of the *arrival* is for.
     */
    sink: (x, z) => {
      const p = flight.p;
      if (x !== undefined) { p.pos.x = x; p.pos.z = z; }
      const sea = isSea(p.pos.x, p.pos.z);
      p.pos.y = (sea ? 0 : groundAt(p.pos.x, p.pos.z)) + 6;
      return { y: Math.round(p.pos.y), sea };
    },
  },
  /**
   * The land itself, for anything that has to be sited against real ground
   * rather than dropped at a guessed height. Everything in the bundle shares one
   * lexical scope and none of it is on `window`, so a test that wants to know
   * whether a point is in the sea has no way to ask without this.
   */
  boats: (n = 8) => (props ? props.boatList(n) : null),
  props: {
    raw: () => props,
    /** Where the near-model cars actually are this frame, nearest first. */
    nearCars: () => props.nearCarList(),
  },
  audio: {
    raw: () => audio,
    klapa: () => audio.klapaStats(),
    /** Step the klapa at a given range without flying there. */
    at: (d, inside = false) => { audio.klapa(d, inside); return audio.klapaStats(); },
    beds: () => audio.beds(),
    fire: () => audio.fireStats(),
    /** The beat on its own, without having to soak her for sixteen seconds. */
    beat: (g = 1) => { audio.firestarter(g); return audio.fireStats(); },
  },
  land: {
    at: (x, z) => groundAt(x, z),
    sea: (x, z) => isSea(x, z),
    /** The baked cover class, which is what decides what grows here. */
    cover: (x, z) => coverAt(x, z),
    shore: (x, z) => shoreAt(x, z),
    place: (name) => placeNamed(name),
    /** A coarse height/sea grid, which is the only readable way to see a shore. */
    grid: (x0, z0, step, nx, nz) => {
      const rows = [];
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * step, row = [];
        for (let k = 0; k < nz; k++) {
          const z = z0 + k * step;
          row.push(isSea(x, z) ? '~~~' : String(Math.round(groundAt(x, z))).padStart(3));
        }
        rows.push(Math.round(x) + ' | ' + row.join(' '));
      }
      return rows;
    },
  },
  /**
   * Stand on the Jadrija promenade without flying there and jumping out. `t` is
   * metres along the shore from the west end, `s` metres inland from the water,
   * which is the frame the whole resort is laid out in — so a test can ask for
   * "on the quay by the jetty" rather than for a pair of world coordinates that
   * mean nothing and stop meaning it the moment the shore is re-traced.
   */
  jad: {
    raw: () => jadrija,
    mirror: () => (mirror ? mirror.stats() : null),
    mirrorP: () => (mirrorP ? mirrorP.stats() : null),
    you: () => (you ? you.stats() : null),
    youRaw: () => you,
    youShow: (v) => (you ? you.show(v) : null),
    youFreeze: (v) => (you ? you.freeze(v) : null),
    /** The threshold: where it thinks you are, and whether it is mid-cut. */
    dip: () => {
      const K = jadrija && jadrija.kabina;
      if (!K) return null;
      const [t, s] = jadrija.local(camera.position.x, camera.position.z);
      return { inRoom, phase: dipPhase, cool: +dipCool.toFixed(2),
        t: +t.toFixed(2), s: +s.toFixed(2), sill: +(K.face + DIP.sill).toFixed(2),
        opacity: dipEl() ? dipEl().style.opacity : null };
    },
    stand: (t, s = 14, yaw = null) => {
      if (!jadrija || !ground || !ground.ok) return null;
      const w = jadrija.toWorld(t, s);
      ground.retarget(jadrija);
      const st = jadrija.local(w[0], w[2]);
      ground.dropIn(w[0], w[2], yaw == null ? jadrija.site.yaw : yaw);
      return { at: [+w[0].toFixed(1), +w[1].toFixed(2), +w[2].toFixed(1)],
        ts: st.map((v) => +v.toFixed(1)) };
    },
    probe: (t, s) => {
      const w = jadrija.toWorld(t, s);
      return { w: w.map((v) => +v.toFixed(2)), back: jadrija.local(w[0], w[2])
        .map((v) => +v.toFixed(2)), walkY: +jadrija.walkY(w[0], w[2]).toFixed(2) };
    },
    /** The performance, and a way to run it in a window that will not animate. */
    show: () => jadrija && jadrija.show(),
    // `camera.position`, not `camPos`: the smoothed follow position is written
    // once a frame by the render loop, and this exists precisely because the
    // render loop is not running often enough to be trusted.
    step: (secs) => { jadrija.step(secs, camera.position); return jadrija.show(); },
    /** Fill her soak meter, so the turn starts on the next frame she is stepped. */
    flare: () => { jadrija.flare(); return jadrija.show(); },
    /** Her blink and her smile, held still — see `face` in 43-jadrija.js. */
    face: (o) => jadrija.face(o),
    /** Put a number at the front of her running order. */
    cue: (...n) => jadrija.cue(...n),
    /**
     * Stand her somewhere, in the resort's own frame, and optionally start a
     * phase there. The indoor sequence is half a minute of walking end to end,
     * which is thirty seconds a test cannot spend and a headless page at two
     * frames a second cannot finish at all.
     */
    put: (...a) => jadrija.putShow(...a),
    bones: (...a) => jadrija.bones(...a),
    /**
     * How far into the special kabina the game thinks you are, 0 to 1 — the
     * number the light and the klapa both hang off, which is the only way to
     * tell a door that is not working from a room that is not dark enough.
     */
    indoors: () => ({ v: +indoors.toFixed(3),
      dark: +roomDark.toFixed(3),
      exp: +renderer.toneMappingExposure.toFixed(3),
      // The near clip, which is what "I can see through that wall" actually is.
      near: +camera.near.toFixed(3),
      cam: [+camera.position.x.toFixed(1), +camera.position.z.toFixed(1)],
      kab: jadrija && jadrija.kabina
        ? +jadrija.kabina.inside(camera.position.x, camera.position.z).toFixed(3) : null,
      vik: jadrija && jadrija.indoorsAt
        ? jadrija.indoorsAt(camera.position.x, camera.position.y,
          camera.position.z) : null,
      hull: +clipNear.toFixed(3) }),
  },
  /**
   * Drive the ground mission from a test without flying an approach first.
   * `arm` lights the field, `foot` puts you out on it, `look`/`walk`/`jet` are
   * the three things a player does once there.
   */
  /**
   * The vikendica. `stand('doorOut')` puts you on foot at one of the sidecar's
   * anchors — stairFoot, stairHead, doorOut, doorIn, living, terrace, loftTop —
   * and `roof('loft')` swaps the pantile gable for the raised one and its
   * mezzanine without touching anything below the wall head.
   */
  /**
   * The laptop. `step` exists for the same reason `vik.cut` does: the sit-down
   * is driven by wall time and a headless page runs its clock at about a frame
   * a second, so a 1.15 s move takes twenty seconds of settle to finish.
   */
  pc: {
    open: () => { skipToComputer(); return comp ? comp.phase : null; },
    step: (secs) => {
      for (let i = 0; i < Math.round(secs * 60); i++) stepComputer(1 / 60);
      return comp ? comp.phase : null;
    },
    say: (t) => computer.say(t),
    /**
     * Hose the laptop from wherever you are standing, as the frame loop would.
     * `checkLaptopSpray` runs once a frame and a headless page runs about one
     * of those a second, so testing this by waiting is testing nothing.
     */
    spray: () => {
      for (let i = 0; i < 60 && !comp; i++) checkLaptopSpray();
      return { phase: comp ? comp.phase : null, held: sprayHeld };
    },
    stats: () => ({ ...computer.stats(), phase: comp ? comp.phase : null }),
  },
  /** The water. `dip` drops you in it wherever you name, for a look. */
  /**
   * The board. `on(x, z)` puts you on one at a point on the water without
   * walking down a beach first, `tick` runs the mode's own clock, and `aim`
   * turns the head — which here is genuinely not the same as turning the
   * board, so both are exposed.
   */
  ride: {
    stats: () => (ride ? { ...ride.stats(), point: ride.point() } : null),
    raw: () => ride,
    on: (x, z) => {
      if (!ride || !ride.enter(x, z)) return null;
      state.phase = 'ride';
      $('chute-hud').hidden = true;
      $('hud').hidden = true;
      $('ground-hud').hidden = true;
      $('swim-hud').hidden = true;
      $('ride-hud').hidden = false;
      paintRideHud();
      return { ...ride.stats(), point: ride.point() };
    },
    /** Point the board itself, in radians, which a player cannot do directly. */
    heading: (yaw) => {
      if (!ride) return null;
      ride.you.yaw = yaw;
      return { ...ride.stats(), point: ride.point() };
    },
    aim: (look, pitch) => {
      if (!ride) return null;
      ride.you.look = look; ride.you.pitch = pitch;
      return ride.stats();
    },
    tick: (secs, dtStep = 1 / 60, ctl = {}) => {
      if (!ride || !ride.active) return null;
      let out = null;
      for (let t = 0; t < secs; t += dtStep) out = ride.update(dtStep, ctl) || out;
      paintRideHud();
      return { ...ride.stats(), point: ride.point(), out };
    },
    /** What the polar says about every heading, which is the whole model. */
    polar: () => {
      const o = [];
      for (let d = 0; d <= 180; d += 15) {
        o.push([d, +ridePolar(d * Math.PI / 180).toFixed(3)]);
      }
      return o;
    },
  },
  chase: {
    stats: () => (chase ? chase.stats() : null),
    raw: () => chase,
    start: () => startChase(),
    /** Skip the shot, for a test that wants the race and not the camera. */
    go: () => {
      startChase();
      if (you) you.drive(null);
      chaseCut = null; camOverride = null;
      // Skipping the shot skips the beat that starts the race, so it has to be
      // started here instead. Without this `go()` leaves you in the water with
      // nobody to chase, which is exactly what the shot was rewritten to stop
      // happening to a player.
      if (chase && !chase.active && jadrija && jadrija.swimRun) {
        chase.stop();
        chase.start(jadrija.swimRun.start, jadrija.swimRun.board,
          (x, z) => swim.surfaceAt(x, z));
      }
      $('swim-hud').hidden = false; $('chase-hud').hidden = false;
      paintChaseHud();
      return chase.stats();
    },
    /**
     * Run the shot forward by hand.
     *
     * The cut is driven by wall time and a headless page runs its clock at
     * about a frame a second, so the seven seconds of it are eight frames and
     * nothing can be caught in the middle of a dive. This steps it at 30 Hz
     * and stops wherever it is told to, which is the only way to photograph an
     * arc.
     */
    cut: (secs, dtStep = 1 / 30) => {
      for (let t = 0; t < secs && chaseCut; t += dtStep) {
        stepChaseCut(dtStep);
        if (chase && (chase.active || chase.poised)) chase.draw(dtStep);
        if (you) you.tick(dtStep, camera);
        if (waterfx) waterfx.update(dtStep);
      }
      return chaseCut
        ? { leg: chaseCut.leg, beat: chaseCut.legs[chaseCut.leg].beat,
          u: +chaseCut.u.toFixed(2), fired: Object.keys(chaseCut.fired),
          you: you ? you.driven() : null,
          her: chase.poised ? 'poised' : (chase.active ? 'racing' : 'off') }
        : { leg: -1, beat: 'done', you: you ? you.driven() : null,
          her: chase.active ? 'racing' : 'off' };
    },
    tick: (secs, dtStep = 1 / 30, ctl = {}) => {
      if (!chase || !chase.active || !swim) return null;
      let out = null;
      for (let t = 0; t < secs; t += dtStep) {
        swim.update(dtStep, ctl);
        out = chase.update(dtStep, swim.you, (x, z) => swim.surfaceAt(x, z)) || out;
      }
      chase.draw(1 / 30);
      paintChaseHud();
      paintSwimHud();
      return { ...chase.stats(), out };
    },
  },
  maskRaw: () => mask,
  ao: (v) => { if (ao) ao.set(v); return ao ? ao.stats() : null; },
  aoDbg: (n, show, k) => { if (ao) ao.dbg(n, show, k); },
  foil: {
    stats: () => (foil ? foil.stats() : null),
    raw: () => foil,
    /** Put one in the water at a point, without needing a beach to start on. */
    go: (x, z) => {
      if (!foil || !foil.enter(x, z)) return null;
      if (ground && ground.ok && state.phase === 'ground') ground.bail();
      state.phase = 'foil';
      for (const id of ['hud', 'ground-hud', 'chute-hud', 'swim-hud', 'ride-hud']) {
        $(id).hidden = true;
      }
      $('foil-hud').hidden = false;
      paintFoilHud();
      return foil.stats();
    },
    /**
     * Step the board without the frame loop. Software GL runs at a few frames
     * a second, so a real-time settle advances almost no simulation at all and
     * every timed check on this mode needs this instead.
     */
    tick: (secs, dtStep = 1 / 60, ctl = {}) => {
      if (!foil || !foil.active) return null;
      let out = null;
      for (let t = 0; t < secs; t += dtStep) out = foil.update(dtStep, ctl) || out;
      foil.draw();
      paintFoilHud();
      return { ...foil.stats(), out };
    },
  },
  swim: {
    stats: () => (swim ? swim.stats() : null),
    raw: () => swim,
    /** Third person, as the B key does it. See `poseSwimBody`. */
    body: (v) => { bodyCam = v == null ? !bodyCam : !!v; return bodyCam; },
    driven: () => (you ? you.driven() : null),
    dip: (x, z, yaw = 0, depth = 0.3) => {
      if (!swim) return null;
      swim.enter(x, z, yaw, 0);
      swim.you.depth = depth;
      swim.you.y = swim.surfaceAt(x, z) - depth;
      state.phase = 'swim';
      $('chute-hud').hidden = true;
      $('hud').hidden = true;
      $('ground-hud').hidden = true;
      $('swim-hud').hidden = false;
      if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = true;
        $('ctouch').hidden = true; $('stouch').hidden = false; }
      paintSwimHud();
      return swim.stats();
    },
    /** Point the head somewhere, in radians. */
    aim: (yaw, pitch = 0) => {
      if (!swim) return null;
      swim.you.yaw = yaw;
      swim.you.pitch = pitch;
      return [yaw, pitch];
    },
    /**
     * `ctl` is the same shape the mode's own input is — {fwd, side, sprint,
     * up, down} — because the interesting poses are the ones you only reach
     * by swimming, and a tick with nothing held only ever shows the scull.
     */
    tick: (secs, dtStep = 1 / 30, ctl = {}) => {
      if (!swim || !swim.active) return null;
      for (let t = 0; t < secs; t += dtStep) swim.update(dtStep, ctl);
      paintSwimHud();
      return swim.stats();
    },
  },
  vik: {
    raw: () => jadrija && jadrija.vik,
    stats: () => (jadrija && jadrija.vik ? jadrija.vik.stats() : null),
    roof: (which) => (jadrija && jadrija.vik ? jadrija.vik.roof(which) : null),
    anchors: () => (jadrija && jadrija.vik
      ? Object.keys(jadrija.vik.plan.anchors) : []),
    /** On foot at a named anchor, looking at the middle of the big room. */
    stand: (name = 'doorOut', yaw = null) => {
      const v = jadrija && jadrija.vik;
      if (!v) return null;
      const p = v.anchor(name);
      if (!p) return null;
      const look = v.anchor('living');
      const a = yaw != null ? yaw
        : Math.atan2(-(look[0] - p[0]), -(look[2] - p[2]));
      // `dropIn`, not `force`: force() arms the spot fire, which wants an
      // aerodrome behind it and throws at Jadrija.
      ground.retarget(jadrija);
      ground.dropIn(p[0], p[2], a);
      ground.put(p[0], p[2], a, 0);
      return { at: p.map((n) => +n.toFixed(2)), yaw: +a.toFixed(3) };
    },
    /**
     * Start the walk-up and run it forward by `secs`.
     *
     * The sequence is driven by wall time and this page runs at about one frame
     * a second under software GL, with `real` clamped to 0.05 — so eleven
     * seconds of settling advances half a second of it and a screenshot of the
     * cut is a screenshot of its first leg. Same reason `ground.tick` exists.
     */
    cut: (secs = 0) => {
      if (!vikWalk && !startVikWalk()) return 'no locale';
      const dt = 1 / 30;
      for (let i = 0; i < Math.round(secs / dt) && vikWalk; i++) stepVikWalk(dt);
      return vikWalk ? { leg: vikWalk.leg, u: +vikWalk.u.toFixed(2) } : 'done';
    },
    /** How long the whole shot runs, so a recorder can size itself off it. */
    cutLen: () => VIK_WALK.reduce((a, k) => a + k.dur, 0),
    /**
     * Scrub the walk-up to an absolute time and hold it there.
     *
     * `cut()` above advances by a delta, which is right for a test that wants
     * to be somewhere in the middle of the shot and wrong for filming it: the
     * frame loop is still adding its own `real` between calls, so the errors
     * accumulate and the frames come out unevenly spaced. This sets the time
     * outright and takes the loop's hands off it, so frame *n* is always at
     * exactly n/fps whatever the page manages to render at.
     *
     * `cutAt(null)` gives it back.
     */
    cutAt: (t) => {
      if (t == null) { vikHold = false; return 'released'; }
      if (!vikWalk && !startVikWalk()) return 'no locale';
      vikHold = true;
      vikWalk.leg = 0;
      let rem = Math.max(0, t);
      while (vikWalk.leg < VIK_WALK.length - 1
        && rem >= VIK_WALK[vikWalk.leg].dur) {
        rem -= VIK_WALK[vikWalk.leg].dur;
        vikWalk.leg += 1;
      }
      vikWalk.u = Math.min(0.9999, rem / VIK_WALK[vikWalk.leg].dur);
      stepVikWalk(0);
      return { leg: vikWalk.leg, u: +vikWalk.u.toFixed(3) };
    },
  },

  /**
   * Debug: take one layer out of the picture, which is the only way to find
   * out which layer you are looking at. Underwater especially — down there
   * every surface is some shade of the same green and a screenshot cannot
   * tell you whether that is the bottom, the surface or nothing at all.
   */
  show: (what, on) => {
    const m = {
      sea: () => [sea.mesh],
      terrain: () => terrain.levels.map((l) => l.mesh),
      trees: () => SPECIES.flatMap((sp) => [trees.layers[sp].near.mesh,
        trees.layers[sp].far.mesh]),
      sky: () => [sky.mesh],
    }[what];
    if (!m) return Object.keys({ sea: 0, terrain: 0, trees: 0, sky: 0 });
    const list = m();
    for (const o of list) o.visible = !!on;
    return list.length;
  },
  /** Debug: the vegetation, which is now grown from a spec and worth probing. */
  veg: {
    cost: () => trees.cost(),
    /** How far the grown model reaches right now — it adapts. See repack. */
    nearR: () => trees.nearR(),
    /** How wooded it is where you are standing — what the cicadas ride on. */
    canopy: (x, z) => trees.canopyAt(
      x == null ? camera.position.x : x, z == null ? camera.position.z : z),
    nearest: (sp, x, z) => trees.nearest(sp, x, z),
  },
  ground: {
    arm: () => ground.force(),
    raw: () => ground,
    /** Park the aeroplane on the apron, stopped, wheels down. */
    park: () => parkAtApron(),
    skip: () => skipToGround(),
    foot: () => { ground.force(); flight.p.onGround = true; flight.p.vel.set(0, 0, 0); },
    out: () => toggleGround(),
    apron: () => airfield.apron,
    put: (x, z, yaw, pitch, yHint) => ground.put(x, z, yaw, pitch, yHint),
    /** Debug: the balcony jump, without having to be running when you ask. */
    hop: (sp = 2.0) => {
      if (ground && ground.you) { ground.you.vx = -Math.sin(ground.you.yaw) * sp;
        ground.you.vz = -Math.cos(ground.you.yaw) * sp; }
      return hopOut();
    },
    confine: (x, z, y) => ground.confine(x, z, y),
    walkY: (x, z, y) => ground.walkY(x, z, y),
    /** Debug: is the land cover at (x, z) water? The shoreline test. */
    sea: (x, z) => isSea(x, z),
    /**
     * On foot anywhere at all, synthesising a locale for open country the same
     * way a parachute landing does. `jad.stand` only reaches Jadrija, and the
     * whole point of the open locale is that it is built around wherever you
     * came down.
     */
    anywhere: (x, z, yaw = 0) => {
      const loc = localeAt(x, z, airfield, jadrija, city);
      ground.retarget(loc);
      ground.dropIn(x, z, yaw);
      return { kind: loc.kind || 'open', blockers: loc.blockers.length };
    },
    look: (dx, dy) => ground.look(dx, dy),
    jet: (on) => { debugJet = !!on; },
    aimAt: (kind) => ground.aimAt(kind),
    aim: () => ({ kind: ground.you.aimKind, at: ground.you.aim.map((v) => +v.toFixed(1)),
      you: [+ground.you.x.toFixed(1), +ground.you.z.toFixed(1)],
      yaw: +ground.you.yaw.toFixed(3), pitch: +ground.you.pitch.toFixed(3) }),
    /**
     * Step the ground mission without the aeroplane. fastForward() flies, which
     * on a parked aircraft means taking off from the apron by itself; software
     * GL runs at a few frames a second, so a real-time settle advances almost no
     * simulation at all and every timed check here needs this instead.
     */
    tick: (secs) => {
      const dt = 1 / 30;
      for (let i = 0; i < Math.floor(secs / dt); i++) {
        state.t += dt;
        fire.update(dt);
        ground.setSpray(mouseDrop || keys.has('Space') || TOUCH.gjet || debugJet);
        ground.update(dt);
        // The shoreline handover, which the real frame loop does too. Without
        // it a headless walk into the sea grinds along the barrier for ever.
        const w = ground.wet && ground.wet();
        if (w && waadeIn(w[0], w[1])) break;
      }
      return state.phase === 'swim' ? swim.stats() : ground.stats();
    },
    crew: () => ground.crew.map((c) => ({
      mode: c.mode, burn: +c.burn.toFixed(2), wet: +c.wet.toFixed(2),
      at: [Math.round(c.x), Math.round(c.z)],
      // What they are doing and why, which is the only way to tell a figure
      // standing about on purpose from one that has stopped being updated.
      spd: +(c.speed || 0).toFixed(2), wait: +c.wait.toFixed(1),
      dest: c.dest ? c.dest.map(Math.round) : null,
    })),
    objects: () => airfield.objects.map((o) => ({
      kind: o.kind, burning: +o.burning.toFixed(2), heat: +o.heat.toFixed(2),
      wet: +o.wet.toFixed(2), spent: +o.spent.toFixed(2), out: o.out,
    })),
  },
  beat: (i) => intro.jump(i),
  /** What the on-screen controls are doing, for the headless touch tests. */
  touch: () => ({
    ...TOUCH,
    stick: flight ? [+flight.p.tch.x.toFixed(2), +flight.p.tch.y.toFixed(2)] : null,
    thr: flight ? Math.round(flight.p.throttle * 100) : 0,
    padOn: $('flypad').classList.contains('on'),
    shown: !$('touch').hidden,
  }),
  lang: (l) => (l ? setLang(l) : getLang()),
  /** What the ground-proximity system and the HUD are currently saying. */
  warn: () => ({
    gpws: $('gpws').textContent,
    cls: $('gpws').className,
    vsi: $('i-vsi').textContent,
    vsiCls: $('inst-vsi').className,
    tank: $('tank-hint').textContent,
    ap: $('ap').textContent.trim(),
    phase: state.phase,
    paused: state.paused,
  }),
  /** Read the pause with no argument, set it with one. */
  pause: (on) => {
    if (on !== undefined) setPaused(on);
    return { paused: state.paused, shown: !$('pause').hidden,
      sub: $('pause-sub').textContent, t: +state.t.toFixed(2) };
  },
  setPos: (x, y, z) => flight.reset(x, z, 0, y),
  place: (x, y, z, yaw) => { flight.reset(x, z, yaw ?? 0, y); },
  cam: (i) => { camMode = i % CAMS.length; },
  look: (px, py, pz, tx, ty, tz) => { camOverride = [px, py, pz, tx, ty, tz]; },
  free: () => {
    camOverride = null;
    zoom = 0;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  },
  /**
   * A long lens, for photographing something small.
   *
   * The near plane is 1.2 m — it has to be, with 42 km behind it — so a face
   * cannot be approached, only zoomed in on. `free()` puts it back.
   */
  fov: (deg) => { camera.fov = deg; camera.updateProjectionMatrix(); },
  /** And the one Z drives, which is the same lens with a hand on it. */
  lens: () => ({ zoom: +zoom.toFixed(3), fov: +camera.fov.toFixed(2), base: baseFov,
    // What one second of wall time is worth in world time right now.
    slow: +(1 - (1 - SLOW) * zoom).toFixed(3) }),
  /** Advance the simulation `secs` with no rendering — for headless testing. */
  fastForward: (secs) => {
    const dt = 1 / 30;
    for (let i = 0; i < Math.floor(secs / dt); i++) {
      readKeys(dt);
      flight.update(dt, input);
      fire.update(dt);
      wingmen.update(dt);
      updateMission(dt);
    }
    return { t: state.t, burning: fire.burningCount(), burntHa: Math.round(fire.burntArea()),
      aiLitres: Math.round(wingmen.litres()), wingmen: wingmen.debug() };
  },
  // Not the module — `JSON.stringify` of it walks the whole Three.js scene and
  // has twice produced most of a gigabyte of output. Two readings instead.
  arms: {
    stats: () => (arms ? arms.stats() : null),
    probe: () => (arms ? arms.probe() : null),
  },
  kites: () => kites,
  fire: () => fire,
  flight: () => flight,
  airfield: () => airfield,
  train: () => (rail ? rail.trainPos() : null),
  /** Runway geometry, so a test can put the aeroplane on an actual approach. */
  field: () => (airfield && airfield.site ? {
    centre: airfield.centre, apron: airfield.apron,
    thresholds: airfield.thresholds, axis: airfield.axis,
  } : null),
  scene, camera, renderer,
};
