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
  // `brod` belongs in this list and was left out of it, which is the whole of
  // why you could not zoom from her deck. The note above argues for the lens on
  // the grounds that there is nothing to do but look — and a passenger on a
  // nine-minute crossing is the strongest case in the game for exactly that.
  const want = (state.phase === 'ground' || state.phase === 'swim'
    || state.phase === 'ride'
    || state.phase === 'brod' || state.phase === 'plunge')
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
  // The phone's slab is sized in vw and vh, so a rotation changes its width —
  // and the fly cam's corner box was pushed left by the width it used to be.
  // See `phoneSync`.
  phoneSync();
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

/**
 * Is somebody typing, rather than playing?
 *
 * There are TWO keydown listeners on this window — this file's main one, and
 * the little one at the bottom that lets Enter stand in for the Take off
 * button. 1.168.1 taught the first about text fields and not the second, so
 * Enter in the password box still fell through and launched the aeroplane out
 * from under the sign-in sheet. One helper, both callers, no third way to get
 * this wrong.
 *
 * The sheet counts even with nothing focused in it: click the backdrop and the
 * target is the sheet, not the input, and the keyboard still is not the game's.
 */
function keyboardIsBusy(e) {
  const el = e.target;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
    return true;
  }
  return !$('signin').hidden;
}

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  // Shift on its own is the crouch, on its RELEASE — see the keyup — so that
  // Shift held with another key (Shift+I, Shift+/) stays a modifier.
  shiftTap = e.code === 'ShiftLeft' || e.code === 'ShiftRight';
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
  // And a key typed into a text field belongs to the field.
  //
  // Misha, 31 Aug: "i cannot seem to type in the password into the sign-in.. i
  // think the game keys are somehow overriding it". They were. Every branch
  // below is happy to call preventDefault on a bare letter, and a password is
  // made of bare letters — N is Baye's voice, P pauses, M opens the settings,
  // ? opens the help sheet, and each of them ate the character on its way past.
  //
  // Not a list of keys to leave alone: a list is wrong the moment somebody adds
  // a binding or a field. The laptop terminal has always been safe because the
  // whole handler bails while it is open, which is the same rule written for
  // one case; this is that rule written once, for every field there will ever
  // be. Escape is the exception, because closing the thing you are typing in is
  // the one game action that still belongs to the game.
  if (e.code !== 'Escape' && keyboardIsBusy(e)) return;
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
  // ── THE TYPING LINE COMES FIRST ──────────────────────────────────────
  //
  // Misha, 17 Sep 2026: *"maybe when u press 'I', it should be possible to
  // 'type in' commands into it, not just use the voice.... for higher
  // precision"*.
  //
  // Above every other branch in this handler, including the cut-scene skips
  // and the pause: while the caret is in that box a key is a LETTER. The box
  // stops the event itself as well (see the handler where it is built), so
  // this is the belt to that braces — a stray listener that saw a W as the
  // throttle while somebody typed "swim" would be a bug nobody could explain.
  if (ears && ears.typing && ears.typing()) return;
  // The trampoline cut, and its skip. Ahead of the pause guard AND ahead of
  // Escape, which would otherwise stop the world in the middle of a shot and
  // leave a paused camera two hundred metres over the beach with no way back
  // to the game that owns it. Three keys rather than one because this is a
  // seven-second cut with no button on it: Escape is what a cinematic means
  // everywhere, and Enter and Space are what a hand actually presses.
  if (flyCut && (e.code === 'Escape' || e.code === 'Enter'
    || e.code === 'NumpadEnter' || e.code === 'Space')) {
    e.preventDefault(); endFlyCut(); return;
  }
  // The swat, and the same three keys for the same reason. It is a quarter the
  // length of the trampoline shot and it is still interruptible: the second
  // time you kill a fly you have seen it, and there is nothing worse in a game
  // than a reward you have to sit through.
  if (swatCut && (e.code === 'Escape' || e.code === 'Enter'
    || e.code === 'NumpadEnter' || e.code === 'Space')) {
    e.preventDefault(); endSwat(); return;
  }
  // And the pour, and the same three keys again. It is the longest of the
  // three at nine and a bit seconds, and it is the one the player did not ask
  // for — it fires itself when she happens to tip the bucket in front of you —
  // so being able to wave it away is not a courtesy here, it is the price of
  // taking the camera off somebody who was walking.
  if (pourCut && (e.code === 'Escape' || e.code === 'Enter'
    || e.code === 'NumpadEnter' || e.code === 'Space')) {
    e.preventDefault(); endPour(false); return;
  }
  // ENTER — the caret into the typing line, because a pointer-locked game
  // cannot click an input. Below the three cut skips, which own Enter while
  // they are running: a nine-second cinematic you cannot wave away because the
  // microphone happens to be on would be a worse bug than the one this fixes.
  // Only while the ears are up; otherwise Enter belongs to whatever wants it.
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && $('signin').hidden
      && ears && ears.open && ears.open() && ears.focusTyping
      && ears.focusTyping()) {
    e.preventDefault();
    return;
  }
  // N — Baye's voice. H was taken by the HUD and V by the doors, and this sits
  // above the pause guard with ? and ESC because switching her off is something
  // you want to be able to do while she is in the middle of a sentence.
  if (e.code === 'KeyN') { e.preventDefault(); voice.toggle(); return; }
  // I — ears: the microphone, for talking to them. See src/49-ears.js. Up here
  // with N for the same reason: it is a switch you want mid-sentence.
  //
  // And split by case since 24 Sep 2026. Misha: *"if it's lowercase 'i',
  // then it's ears by typing, and if it's upper case 'I', it should be the
  // old ears using microphone... sometimes i wanna be able to retain control
  // of the navigation controls without opening the ears dialog box"*. So
  // `i` is the typing line (which takes the pointer, to type), and `I` —
  // Shift+I or with Caps Lock — is the microphone alone: listening, with the
  // pointer and W A S D left where they are.
  if (e.code === 'KeyI') {
    e.preventDefault();
    shiftTap = false;
    if (e.key === 'I') ears.mic(); else ears.toggle();
    return;
  }

  // ? and F1 — the help sheet. Above the pause guard because a paused game is
  // exactly when somebody goes looking for it, and ESC closes it rather than
  // unpausing when it is up. Not H: H already hides the HUD, and Misha asked
  // for "H or equivalent" — this is the equivalent, and the conventional one.
  if (e.code === 'F1' || (e.key === '?' || (e.code === 'Slash' && e.shiftKey))) {
    e.preventDefault(); toggleHelp(); return;
  }
  if (e.code === 'Escape' && !$('help').hidden) {
    e.preventDefault(); toggleHelp(false); return;
  }
  // The sign-in sheet swallows the keyboard whole while it is up — not only the
  // field. Otherwise a key pressed after clicking the backdrop still reaches
  // the game, and toggling Baye's voice from behind a modal asking you to sign
  // in so she can talk is a small joke at the player's expense.
  if (!$('signin').hidden) {
    if (e.code === 'Escape') { e.preventDefault(); toggleSignIn(false); }
    return;
  }
  // ' — the satchel: what you are carrying. See src/62-satchel.js.
  //
  // THE APOSTROPHE BECAUSE THERE IS NOTHING ELSE LEFT, and the note over the
  // lick further down this handler is where that was established: all twenty-six
  // letters are bound in this handler, the comma and the full stop are the
  // counter menu, the slash with shift on it is the help sheet, the digits are
  // the two back doors, and the semicolon went to the ice cream. The
  // apostrophe is the physical key next to that semicolon — `e.code`, so it is
  // the same key under the thumb whatever the layout prints on it — and it is
  // the last mark in reach of a hand that is on WASD with the other one.
  // Verified by grep before taking it: 'Quote' appeared nowhere in src/.
  //
  // NOT TAB, which is what a game would normally use. Tab is how somebody
  // reaches the sign-in field and the settings sliders with a keyboard, and
  // swallowing it here would take that away to save a keystroke.
  //
  // Above the pause guard, with the help sheet and the four back doors: a
  // player who has stopped the world is exactly the player who wants to know
  // what is in the bag, and it is a read-out — there is nothing in it that
  // could act on a frozen simulation.
  if (e.code === 'Quote') { e.preventDefault(); satchelToggle(); return; }
  // ] — the phone, out of that same bag. See src/63-phone.js.
  //
  // THE BRACKET BECAUSE THE APOSTROPHE'S OWN NOTE IS STILL TRUE: all twenty-six
  // letters are bound in this handler, and the marks that were left when the
  // satchel took ' are the two brackets. ] is the one under the same hand, one
  // key up and one over from the bag it comes out of, which is the right place
  // for a thing that lives IN that bag.
  //
  // Above the pause guard, with the bag: the phone is a read-out too — the
  // quotes, the battery, her on the camera — and the one thing on it that
  // acts, the Lovense button, goes through `signal` and is harmless against a
  // stopped world. And it opens the bag's own question from the other side:
  // what have I got, versus what can I do with it.
  if (e.code === 'BracketRight') { e.preventDefault(); phoneToggle(); return; }
  if (e.code === 'KeyO') { e.preventDefault(); skipToComputer(); return; }
  // P and Escape stop the world, and Escape can be pressed twice for the
  // silent version of it — see `escPause`, which owns that decision. Every
  // Escape above this line was consumed by whatever it was closing and never
  // reaches here, so the back doors out of a sheet, a sign-in or a cut-scene
  // are unchanged and cannot be read as half of a double-tap. A held Escape
  // cannot be either: this handler drops `e.repeat` on its first line, so the
  // thirty presses a second an autorepeat would deliver never arrive.
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (e.code === 'Escape') escPause(); else togglePause();
    return;
  }
  // Ahead of the pause guard on purpose: pausing to read the hint and then
  // pressing the key it told you about should work.
  if (e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); skipToGround(); return; }
  if (e.code === 'Digit9' || e.code === 'Numpad9') { e.preventDefault(); skipToJadrija(); return; }
  // 8 — inside the kabina, which is one door further on from where 9 lands
  // you. Ahead of the pause guard with the other two digits, and for the same
  // reason. See `skipToKabina`.
  if (e.code === 'Digit8' || e.code === 'Numpad8') { e.preventDefault(); skipToKabina(); return; }
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
  // door, F the water, G the gear, K the kite, J and U are the two ways out of
  // an aeroplane, T the autopilot, X centres the stick, Z levels the wings, B
  // the third-person camera, R the race, V the vikendica, O the laptop, M the
  // settings, H the HUD, P and Escape the pause, and 0 and 9 the two back
  // doors. That leaves I, L, N and Y, of which L for the rolling *loop* and N
  // for keep-what-just-happened-*now* are the two that mean anything.
  //
  // Ahead of the pause guard, like the back doors above: the whole point of
  // this is to keep something that has just happened, and the most natural
  // thing in the world at that moment is to hit Escape first and think second.
  // One key, both ends. It was L to arm and N to save, and the asymmetry was
  // the bug: L on an armed recorder threw the take away, so the obvious
  // gesture for "stop recording" was the one that lost it.
  if (e.code === 'KeyL') { e.preventDefault(); clipToggle(); return; }
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
  // B — round behind her, and back again.
  //
  // It said "only in the water: it is the only mode with a body to look at",
  // and that was true when it was written and is not any more. Misha, 26 Aug:
  // "I think we should be able to see me from anywhere". So the walk gets it
  // too, and what makes that possible is that the body was never the hard
  // part — `you.drive` has taken an arbitrary pose since the chase cut needed
  // one, and the camera is `ground.pose`'s own eye slid backwards down the
  // line it was already looking along.
  //
  // Still not the aeroplane, and that is not an oversight. There is no body in
  // the cockpit and the outside views are `CAMS` — see `cycleCamera`, which is
  // the aeroplane's own answer to this question and has four of them.
  if (e.code === 'KeyB') {
    e.preventDefault();
    toggleBodyCam();
    return;
  }
  // E, but only out in the water: ahead of the pause guard with the four back
  // doors, and there for the same reason they are. It is the way out. Somebody
  // who has stopped to read the hint that names the key and then presses it
  // should go ashore, and there is no way of telling from the chair how many
  // of ten reports of "cannot exit water" were a pause nobody remembered
  // pressing.
  //
  // The kite is in the water too — `inWater()` has always said so — and E
  // means the same thing there: put the gear away, then walk out.
  // And E at the foot of the skakaonica's ladder is up it, not ashore: the
  // one place in the sea where E has somewhere nearer to go. On the tower it
  // is the reminder that the way down is off the end.
  if (e.code === 'KeyE' && state.phase === 'swim' && plungeHere()) {
    e.preventDefault();
    climbTower();
    return;
  }
  if (e.code === 'KeyE' && state.phase === 'plunge') {
    e.preventDefault();
    toast(T('plunge.down'));
    return;
  }
  if (e.code === 'KeyE' && inWater()) {
    e.preventDefault();
    goAshore();
    return;
  }
  // And E aboard the boat, above the pause guard with the rest of them, for the
  // reason that block gives: somebody who has stopped to read the line naming
  // the key and then presses it should get off the boat.
  if (e.code === 'KeyE' && state.phase === 'brod') {
    e.preventDefault();
    leaveBrod();
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
    // Every water phase was answered above the pause guard and returned there.
    // On this side of it there are two doors left: the boat, if you are stood
    // at the head of the mole with her alongside, and the aeroplane.
    if (inWater()) return;
    // AND ON TO SOMEBODY'S MACHINE, or off it — see `rideKey`. First, because
    // on one E means nothing else, and next to one lying there it means that.
    if (rideKey()) return;
    // AND A THIRD, which is a hatch. E is the interact key and a counter is
    // the one place on this shore where standing in front of something means
    // being served at it: you cannot be at the Tisak's window and at the
    // aeroplane at the same time, so there is nothing for it to take away.
    if (buyHere()) return;
    if (boardBrod()) return;
    toggleGround();
  }
  // Y — a swig. Free everywhere and it does nothing unless there is a beer
  // in your pocket or a bottle already in your hand, so it costs no other
  // control anything.
  if (e.code === 'KeyY') {
    e.preventDefault();
    const got = drinkBeer();
    if (got === 'no beer') toast(T('beer.none'));
    return;
  }
  // ; — a lick of the ice cream, and see src/61-cream.js.
  //
  // SEMICOLON BECAUSE THERE IS NOT A LETTER LEFT. The note over L and N a
  // hundred lines up said the board was nearly full and listed what was on it;
  // it is full now. Every one of the twenty-six letters is bound in this
  // handler — A through Z, checked one at a time and not from memory — so a
  // lick either shares a key with something or takes a punctuation mark, and
  // sharing is how you end up dropping the gear at a gelato counter. The comma
  // and the full stop are the counter menu, the slash is the help sheet with
  // shift on it, and the digits are the two back doors; the semicolon is next
  // to nothing and means nothing, which is the most that is left to want.
  //
  // Free everywhere and it does nothing unless there is an ice cream in your
  // hand, so it costs no other control anything.
  if (e.code === 'Semicolon') {
    e.preventDefault();
    const got = lickCream();
    if (got === 'no cream') toast(T('cream.none'));
    return;
  }
  // [ — the beach ball: out of the satchel and thrown, or, standing over it,
  // back into the satchel. See `ballKey` and src/43-ball.js.
  //
  // THE OTHER BRACKET, for the reason the phone took the first: every letter
  // is bound here, the apostrophe is the bag and ] is the phone out of it,
  // and [ is the last mark under that hand — one key along from the phone,
  // which is where the other thing you carry in that bag belongs. Checked
  // before taking it: 'BracketLeft' appeared nowhere in src/. Below the pause
  // guard, unlike those two: a throw acts on the world.
  if (e.code === 'BracketLeft') {
    e.preventDefault();
    const got = ballKey();
    if (got.toast) toast(T(got.toast));
    return;
  }
  // \ — your belt, in the kabina: out of the loops and into your hand, or
  // back in. See `beltCmd`. The last mark under that hand, next to the two
  // brackets that are the other things you carry; checked: 'Backslash'
  // appeared nowhere in src/. Below the pause guard: it acts on the world.
  if (e.code === 'Backslash') {
    e.preventDefault();
    const got = beltCmd('belt.key');
    if (got !== 'out' && got !== 'back') toast(T('belt.' + got));
    return;
  }
  // = — the collar and the leash: on her, or off her again. See `collarCmd`.
  // Next to the belt's key and the brackets: the things you carry. Checked
  // before taking it: 'Equal' appeared nowhere in src/. Below the pause
  // guard: it acts on the world.
  if (e.code === 'Equal') {
    e.preventDefault();
    const got = collarCmd('collar.key');
    if (got !== 'asked' && got !== 'off') toast(T('collar.' + got));
    return;
  }
  // And the menu at a counter. Two keys rather than one, so that E means buy
  // and only buy: a key that cycled AND bought is a key that buys the wrong
  // thing the moment you press it once too often.
  if ((e.code === 'Comma' || e.code === 'Period') && counterNow()) {
    e.preventDefault();
    const n = counterNow().items.length;
    POCKET.pick = ((POCKET.pick + (e.code === 'Period' ? 1 : n - 1)) % n + n) % n;
    paintCounter();
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
  //
  // Three jumps on one key, tried hardest first, and they are one block because
  // they were three and only the first of them could ever run. `hopOut` had its
  // own `if (e.code === 'Enter' && state.phase === 'ground')` seventy lines
  // below this, and this block returns unconditionally for every Enter on foot
  // — so the balcony jump has been unreachable from the keyboard, silently, and
  // the only thing that still reached it was the debug handle. Adding a fourth
  // jump under the same key without collapsing them would have made a second
  // one dead the same way.
  //
  // The order is the order of specificity, and it now lives in `jumpOut` with
  // the two jumps it calls rather than here — the ladder is the interesting
  // part of this key and it was written out in a keydown handler, where the
  // only way to reach it was a keydown.
  //
  // AND SPACE, because Enter is not reachable on every keyboard while you are
  // already running.
  //
  // Misha, 7 Sep, holding Q and the up arrow: *"it's just when i hold q + up +
  // <enter> is when it DOES NOT ARRIVE"*. It does not, and no branch in here
  // could cause that — by the time `keydown` runs the game cannot know what
  // else is held. It is the keyboard: three simultaneous keys have to be three
  // separate lines in its matrix, and on his `ArrowUp` and `Enter` share one.
  // Measured from the other side, at the listener: Enter alone arrives, Shift
  // plus Enter arrives, Q plus W plus Enter arrives, and Q plus ArrowUp plus
  // Enter never reaches the page at all. That is rollover, not a binding.
  //
  // Space is the answer for the reason every other game already uses it: it is
  // wired on its own line on essentially any keyboard, so it survives whatever
  // else is held. Confirmed on his — with Q and ArrowUp both down, Space
  // arrives.
  //
  // Enter and NumpadEnter stay. They work for everybody they ever worked for,
  // and taking a key away to add one is how you break somebody else's hands.
  // SPACE IS STILL THE BRANCH. It only becomes a jump on the one gesture that
  // cannot reach Enter — already running, already going forward — which is
  // Misha's own rule: *"i want space to be the hose for everything else...
  // except for when pressing q+up+space"*. Generalised to whichever run and
  // forward keys are down, because Shift runs as well as Q and W goes forward
  // as well as the up arrow, and a rule that only knew two of the four would
  // be a rule somebody trips over on their own keyboard.
  //
  // `spaceLeapt` is what stops the same press doing both. The branch is read
  // from `keys` every frame, so without it a running jump would also open the
  // hose for as long as the bar stayed down. Cleared on the way up.
  if (e.code === 'Enter' || e.code === 'NumpadEnter'
    || (e.code === 'Space' && runHeld() && fwdHeld())) {
    // Not on a bicycle, where Q and W are pedalling hard and Space is still
    // the hose — see `rideKey`.
    if (state.phase === 'ground' && ground && ground.ok && !state.paused && !riding()) {
      e.preventDefault();
      if (e.code === 'Space') spaceLeapt = true;
      jumpOut(); return;
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
  if (e.code === 'KeyU' && state.phase === 'ground') { e.preventDefault(); launchOut(); return; }
  // Enter — the balcony rail and the trampoline — is answered in the one block
  // above, with the ordinary hop. It used to be answered here as well, and here
  // never ran.
  // T is the autopilot in both seats. In the aeroplane it flies the job list;
  // in the water there is one job and it swims you at it. Same key, same
  // promise — somebody else has the controls until you take them back — which
  // is worth more than a second key would have been.
  if (e.code === 'KeyT' && state.phase === 'swim') {
    e.preventDefault(); toggleSwimAuto(); return;
  }
  // And on her deck, where it makes the same promise a third time: let the
  // passage run itself. See `brodFast`.
  if (e.code === 'KeyT' && state.phase === 'brod') {
    e.preventDefault(); toggleBrodFast(); return;
  }
  // Space on the tower is a press, and the press is the event: a bounce on
  // the board, or the tuck in the air. Held, it is read in the frame loop.
  if (e.code === 'Space' && state.phase === 'plunge' && plunge && !e.repeat) plunge.press();
  if (state.phase === 'ground' || state.phase === 'chute'
    || state.phase === 'swim'
    || state.phase === 'brod' || state.phase === 'plunge') {
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
// THE CROUCH. Misha, 24 Sep 2026: *"inside the kabine, if i press 'Shift',
// i'd like to be able to crouch on my knees and thus have a lower vantage
// point/view. actually even outside kabine, just press shift, should do a
// crouch"*. A tap of Shift on foot toggles it: down on your knees, a slower
// walk, and a tap again to stand. On the release and only if nothing else was
// pressed with it, so Shift+I and Shift+/ are still what they were. It was
// the run; the run is Q, which it always also was.
let shiftTap = false;
addEventListener('keyup', (e) => {
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && shiftTap
    && state.phase === 'ground' && ground && ground.you && !computer.active
    && !keyboardIsBusy(e)) {
    ground.you.crouch = !ground.you.crouch;
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shiftTap = false;
  keys.delete(e.code);
  if (e.code === 'Space') spaceLeapt = false;
});
addEventListener('blur', () => { keys.clear(); if (flight) flight.p.kb.set(0, 0); });

canvas.addEventListener('click', () => {
  // Never on a touchscreen: there is no pointer to lock, and asking for it on
  // iOS throws up a permission bar over the top of the game.
  if (!IS_TOUCH && (state.phase === 'fly' || state.phase === 'ground'
    || state.phase === 'chute' || state.phase === 'swim'
    || state.phase === 'brod' || state.phase === 'plunge'
    // On a bike or a scooter too, which looks with the mouse like the rest
    // and was the one place a freed mouse could not be clicked back.
    || state.phase === 'ride') && !pointerLocked
    && !(typeof poser !== 'undefined' && poser.on)) grabPointer();
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
  //
  // AND SO ARE THE EARS, which is the third thing in this game that drops the
  // lock ON PURPOSE and the only one that was not on this line. Misha, 19 Sep
  // 2026: *"how come pressing 'I' sometimes makes it go to Paused state?"* —
  // because a locked pointer cannot put a caret in a text box, so opening the
  // typed line releases it, and this handler read that as the player's
  // attention going somewhere else. It had not: it had gone into the box this
  // game just opened for them. "Sometimes" is whether the lock was held at
  // the moment — after a settings panel or a sign-in sheet it is not, and
  // then `I` behaved.
  //
  // And the right button's release (`freeMouse`), which is the fourth.
  const ours = mouseFreeing;
  mouseFreeing = false;
  if (had && !pointerLocked && !ours && $('panel').hidden && !comp && !ears.open()
    && !(typeof poser !== 'undefined' && poser.on)) {
    setPaused(true);
  }
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
    // A tug being held: which way the mouse goes is which way it is yanked
    // (COLLAR.yank.flickY) — counted in pixels, not pitch, so it still reads
    // looking straight down at her, where the pitch is at its stop.
    if (colPressed) colMouseY += e.movementY;
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
  // On the tower: her head in her own eyes, the orbit round her behind them.
  if (state.phase === 'plunge' && plunge) {
    const g = 0.0020 * flight.p.sens * (camera.fov / baseFov);
    plunge.look(e.movementX * g, e.movementY * g, bodyCam);
    return;
  }
  // And in the water, where it is a head again — a slower one, because the
  // thing it is turning is lying down in a jacket.
  if (state.phase === 'swim') {
    const g = 0.0017 * flight.p.sens * (camera.fov / baseFov);
    swim.look(e.movementX * g, e.movementY * g);
    return;
  }
  // On the boat it is a head and nothing else — there is no steering to take
  // it away from. Walking gain, because you are standing up on a deck.
  if (state.phase === 'brod') {
    const g = 0.0020 * flight.p.sens * (camera.fov / baseFov);
    brod.look(e.movementX * g, e.movementY * g);
    return;
  }
  // Same again under the canopy: the mouse is your head. What the canopy does
  // is on the rudder keys, because pulling a riser is a hand, not a look.
  if (state.phase === 'chute') {
    // Except while a shot has the camera. The canopy's heading and the view are
    // one number — see `look` in 57-eject.js — so a mouse moved during the
    // trampoline cut would be steering a parachute nobody can see, and the shot
    // ends behind a heading that is no longer the one it was framed for.
    if (flyCut) return;
    const g = 0.0020 * flight.p.sens;
    eject.look(e.movementX * g, e.movementY * g);
    return;
  }
  const s = 0.0022 * flight.p.sens;
  flight.p.stick.x = clamp(flight.p.stick.x + e.movementX * s, -1, 1);
  flight.p.stick.y = clamp(flight.p.stick.y - e.movementY * s, -1, 1);
});
let mouseDrop = false;
// True from the moment a running Space becomes a jump until that bar comes back
// up, so one press cannot both leap and hose. See the jump block in `keydown`.
let spaceLeapt = false;
/** Whichever key is running you, and whichever is sending you forward. The run
 *  list is `walk`'s own in 47-ground.js and the forward list is its `iz`, so a
 *  key added there is a key this already knows about. */
const runHeld = () => keys.has('KeyQ') || !!TOUCH.grun;
const fwdHeld = () => keys.has('KeyW') || keys.has('ArrowUp') || (TOUCH.gy || 0) > 0.2;
addEventListener('mousedown', (e) => { if (pointerLocked && e.button === 0) mouseDrop = true; });
// The right button, in the kabina only: point at the radio or the TV and click
// — what hosing them used to do, now that the branch is a thumb in there. See
// `kabinaPoke` in 43-jadrija.js. Taken on the frame, not in the handler, so it
// is answered from the same camera the picture was drawn with.
let rightClick = false;
// AND EVERYWHERE ELSE IT LETS GO OF THE MOUSE. Misha, 30 Sep 2026: *"if i'm
// pointing at nothing in particular, to use right-mouse button as equivalent
// of pressing Escape-Escape ... free-up the mouse from moving/looking around,
// and to use it to maybe close the Ears dialog box"*. What Escape-Escape
// actually does in Chrome: the first is the browser's, which drops the lock,
// and `pointerlockchange` pauses; the second reaches `escPause` and unpauses,
// and its `grabPointer` is refused because an Escape is not a user gesture.
// So the end state is the world running with the cursor out — and this goes
// straight there, without the pause card flashing up in between. The radio
// and the TV keep the button when they are what you are pointing at: in the
// kabina the decision is made on the frame, by `kabinaPoke` itself (a miss
// is a free); anywhere else there is nothing else for it to mean. A click on
// the canvas takes the mouse back, as it always has, and that click is not a
// drop or a spray: the mousedown above only counts while the lock is held.
let mouseFreeing = false;      // a release that is ours — `pointerlockchange` must not pause on it
let mouseFreedAt = -1e9;       // and when, for the context menu below
let rightLast = null;          // debug: what the last right-click did — 'free', 'radio', 'tv'
function freeMouse() {
  if (document.pointerLockElement !== canvas) return false;
  mouseFreeing = true;
  mouseFreedAt = performance.now();
  document.exitPointerLock?.();
  return true;
}
addEventListener('mousedown', (e) => {
  if (!pointerLocked || e.button !== 2) return;
  if (state.phase === 'ground') rightClick = true;
  else if (freeMouse()) rightLast = 'free';
});
// And no browser menu over the game — while you are playing it, anywhere on
// the canvas, and for a moment after a right-click let go: Windows sends the
// menu on the button's release, by which time the lock is already gone.
addEventListener('contextmenu', (e) => {
  if (pointerLocked || e.target === canvas
    || performance.now() - mouseFreedAt < 1500) e.preventDefault();
});
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
// Your thumb at her mouth — see the gate in the ground branch of the loop.
// `thumbK` is how far out the hand is, 0..1, eased; `thumbAt` is the last place
// her lip was, kept so the hand has somewhere to come back FROM when she
// closes her mouth under it. THUMB_D is how close counts as within reach, eye
// to lip: an arm and a lean.
let thumbK = 0, thumbAt = null;
// And your hand on her head — "pet her". Same shape as the thumb: `petK` how
// far out, `petAt` the last place the top of her hair was.
let petK = 0, petAt = null;
// And your hand in her hair from behind — the pull (1.544.0, PULL_RAG in
// 43-jadrija.js). `hairK` how far out the hand is, `hairAt` where it is going
// (the hair where it closes, then the fist as it draws back), `hairHeld`
// whether it has closed.
let hairK = 0, hairAt = null, hairHeld = false;
// And your hand on her breast — see the gate. `reachKind` is decided on the
// press; `cupSide` is which of the two.
let cupK = 0, cupAt = null, reachKind = 'thumb', reachWas = false, cupSide = 0, pressHam = false;
const _gripAt = new THREE.Vector3();
// THE SHAKE. Misha, 24 Sep 2026: *"sometimes the entire kabine starts
// shaking uncontrollably"*. Measured frame by frame (`camTrace`): with your
// hand at her mouth the camera kept steering on to her lip — which moves with
// her breathing, her head and her jaw, a centimetre of it being over a degree
// of view at 45 cm — and kept stepping to a stand point that her collider
// pushed back off, so the position stalled and jumped 6 cm a frame. The room
// is what you see move. Once the hand has arrived the view is let go of (the
// arm follows her, you do not) and the walk has a dead zone.
const settleTurn = (k) => 1 - clamp((k - 0.55) / 0.35, 0, 1);
const settleGap = (k) => (k > 0.6 ? 0.14 : 0.02);
let thighT = 0;
let thighHold = null;         // debug: 0..1 up the stroke, held there — see `thighHold`
// How much of the stroke's path there is room for, 0..1 of its length — see
// `thighOpen` in 43-jadrija.js — as asked, and eased to.
let thighCap = 1, thighCapWant = 1, thighCapT = 0;
// s, bottom of the stroke to the top and back. It was 2.6 s for the 22 cm of
// thigh the stroke used to be; the path is 35 cm now, and this keeps the hand
// at the pace it had — 17 cm a second on average.
const THIGH_STROKE = 4.1;
/**
 * Centripetal Catmull–Rom between Q[1] and Q[2] at `t`, the other two for
 * the tangents — Barry and Goldman's pyramid, with the knots spaced by the
 * square root of each step's length. Points are anything with x, y, z.
 */
function catmullC(Q, t) {
  const k = [0];
  for (let j = 1; j < 4; j++) {
    const a = Q[j - 1], b = Q[j];
    k.push(k[j - 1] + Math.max(Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)), 1e-4));
  }
  const u = k[1] + (k[2] - k[1]) * t;
  const lerp = (a, b, ka, kb) => {
    const w = (u - ka) / (kb - ka);
    return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, z: a.z + (b.z - a.z) * w };
  };
  const A1 = lerp(Q[0], Q[1], k[0], k[1]), A2 = lerp(Q[1], Q[2], k[1], k[2]);
  const A3 = lerp(Q[2], Q[3], k[2], k[3]);
  return lerp(lerp(A1, A2, k[0], k[2]), lerp(A2, A3, k[1], k[3]), k[1], k[2]);
}
let buttSlaps = 0;              // debug: how many the click has actually played
/**
 * A slap on her backside, on the press — `side` +1 her left cheek; `k` N·s
 * for a probe (see `cotSpank`). The sound; the mark it leaves (see
 * `apprenticeSlap`), whether or not the sound was ready, because the hand
 * landed either way; sometimes her hands going back to where it landed (see
 * `slapped` in 43-jadrija.js, which decides whether this is one of those
 * times); and, 1.540.0, its weight, when she is lying on her front on the cot
 * — see `cotSpank`, which is the ragdoll's — and since 1.544.0 in whatever
 * pose she holds on it.
 */
function buttSlap(side, k = null, hit = null) {
  if (audio && audio.slap) buttSlaps += audio.slap() ? 1 : 0;
  // And, 1.542.1, `hit`: where on her back, bottom or thighs it landed, lying
  // on her front on the cot (`cotAim`) — the mark goes there and the weight
  // goes on the body under it. Her hands only go back to her cheeks for one
  // that landed on them.
  if (typeof apprenticeSlap === 'function') apprenticeSlap(side, hit ? hit.bind : null, hit ? hit.reg : 'butt');
  if (jadrija && jadrija.slapped && (!hit || hit.reg === 'butt')) jadrija.slapped();
  const on = !!(jadrija && jadrija.cotSpank && jadrija.cotSpank(side, camera.position, k, hit));
  // And for her voice (`sceneTalk`): on the cot the ragdoll dealt its weight
  // and says how hard; standing it was a smack with no number, a firm one.
  const last = on && jadrija.cotLast ? jadrija.cotLast() : null;
  sceneHit('hand', last && last.u >= 0.6 ? 2 : 1, hit ? hit.reg : 'butt');
  return on;
}

// ── THE SPANK, WITH YOUR HAND IN IT ──────────────────────────────────────────
//
// 1.553.2. Misha, 30 Sep 2026: *"when we spank her without the belt, it would
// be nice to see my (Chloe's) right hand appearing doing the spanking"*. It
// never had one. The press on her bottom was written (25 Sep) as "a sound,
// no reach, one per press", and everything since — the mark, her hands going
// back, the weight on the cot, where on her it lands — was hung off that
// same instant: `buttSlap` on the frame the button went down, and nothing
// sent to the arm rig, whose chain in the frame loop had a line for the
// thumb, the cup, the pet, the pull, the belt and the leash and none for this.
//
// Now the press starts a gesture and the slap waits for the hand. Your right
// hand comes up from under the picture to over the spot the crosshair picked
// (`cotAim` on the cot, the cheek's own point standing), the wrist cocked
// back; comes down on it accelerating, the palm flat and the fingers
// together (`HAND_POSE.slap`) along her away from you; and on the frame it
// arrives — not the frame you clicked — the sound, the mark, her hands and
// the weight on the ragdoll all go, which is `buttSlap` unchanged. It rests
// on her a moment, a few millimetres in and back, and goes down out of view.
// The spot is followed while the hand comes down (the same ray, asked again),
// so a cot still rocking from the last one is met where it is now.
//
// AN ARM HAS TO REACH, which a sound never did. The crosshair picks her out
// from 3 m, and lying on the cot she is a metre under a standing eye: so
// from further than an arm you step in to her first, and from standing you
// kneel by the cot (SPANK_HAND `near`, `kneelIf` — the belt's aftercare
// kneels you for the same reason), and you get up again a little after the
// last one. Where even then no arm could get to the spot without going
// through her — her far side, the small of her back past the rise of her
// bottom bent over the edge — it is the slap on its own (`spankReach`).
// Click to sound is 0.175 s when she is within reach, about 0.55 s when you
// kneel first.
//
// Quick presses: up to two are kept while a hand is on its way down, each
// starting straight from her skin once the one before has landed; one
// arriving after it landed starts at once from wherever the hand is. So a
// flurry is a hand going up and down on her, about four a second, and not a
// stack of slaps nobody's hand made.
//
// No hand when your right hand is busy: the belt out (the press is the
// belt's swing then anyway — see the gate), the leash clipped to her, the
// collar going on, the aftercare. Then it is the slap on the press, as it
// always was. In the third person the figure's own right arm does it, from
// the shoulder (`spankArm`, `spankElbow` — see `poseSwimBody`), up in front
// of her and down to the spot; in the kabina the third person's camera can
// rarely get behind you, and then, as for every reach, there is neither the
// body nor the first person's arm to see it with.
const SPANK_HAND = {
  // Seconds: up to over the spot; down on to her, accelerating all the way;
  // on her; and away, out of the bottom of the picture. The first two are
  // the time from the click to the sound, 0.175 s.
  up: 0.10, down: 0.075, hold: 0.08, away: 0.30,
  // How far over the spot the hand goes up (m, out along her skin), from the
  // lightest to the hardest; and back toward you, level, as a hand winds.
  lift: [0.14, 0.24], back: 0.07,
  // The wrist cocked back at the top of it (rad), flat by the time it lands.
  cock: 0.60,
  // The palm's bone line off her skin (m) — the thigh stroke's THIGH_OFF and
  // a little over, since her capsules are a hair inside her skin and her
  // bottom rounds away under the fingers — and how far it goes in at
  // the moment it lands and comes back (the flatten), m.
  off: 0.038, press: 0.003,
  // The palm's underside, for `spankLift`: points along the fingers from the
  // palm's middle (heel −, tips +) and across it, m; how far under the bone
  // line its skin is (the thigh stroke's 26 mm, less a little); and the gap
  // it keeps off her capsules, which are a hair inside her skin.
  palm: { along: [-0.05, 0, 0.06, 0.13], across: [-0.04, 0, 0.04], under: 0.024, gap: 0.004 },
  // Where the hand goes on its way out, before it drops out of the picture:
  // right, up, forward of your eye (m) — see the `away` phase.
  exit: [0.30, -0.28, 0.28],
  // Presses kept while a hand is on its way down.
  queue: 2,
  // Your shoulder off your eye (right, up, m) — ARMS.shoulder — for which
  // way the fingers lie.
  shoulder: [0.195, -0.245],
  // AND YOU GO TO HER, when it is further than an arm: the crosshair picks
  // her out from across the room (COT_RAG.aim's `reach` is 3 m), and an arm
  // sent 2 m is an arm floating by the cot with nobody on the end of it —
  // MEASURED from the door, the hand stopped 0.9 m short. So past `near` m
  // (level, your eye to the spot) you step in first, briskly (`walk` m/s),
  // to `stand` m off it, turned on to it, and the hand goes up once you are
  // there — or once the cot will not let you closer (`stall` s).
  near: 0.72, stand: 0.45, walk: 2.4, stall: 0.9,
  // And if the cot will not let you nearer than `reachMax` (level) — her
  // bottom over the far edge from where you are, or her length between you
  // and it — there is no hand that could do it from there without going
  // through her: MEASURED from her head, bent over the edge, an arm along
  // her back 28 mm into it. Then it is the slap on its own, as it was.
  reachMax: 0.80,
  // Your arm against her, for `spankReach`: the forearm's radius (m), the
  // palm's own `near` m of it left out, and how much of the upper arm from
  // the elbow is tried (the rest runs out under the picture).
  arm: { r: 0.045, near: 0.12, upper: 1.0, cap: 0.07 },
  // And the spot: how square to the eye that picked it its skin must face
  // (the cosine), and the most the hand may stand off it (`spankLift`)
  // before it does not fit there at all — see `spankReach`.
  facing: 0.1, liftMax: 0.079,
  // How far down the shoulder goes as it leans in (see `dip` in 60-arms.js),
  // tried in this order until the arm clears her.
  dips: [0.7, 0.5, 0.35, 0.2, 0],
  // AND DOWN TO HER. Lying on the cot her bottom is a metre under a standing
  // eye (0.98 m MEASURED, lying flat), and an arm is 0.48 m and a hand: sent
  // from a standing eye the upper arm stood up the middle of the picture at
  // you, its cut end showing, however the elbow was hung. So when the spot
  // is more than `kneelIf` m under your eye you kneel by the cot first — the
  // crouch, Shift's, which the belt's aftercare already kneels you into for
  // the same reason — and the hand goes up once you are most of the way
  // down (`low`). You stay down while you keep spanking, and get up again
  // `rise` s after the last one, unless you were kneeling before it.
  kneelIf: 0.80, low: 0.85, rise: 2.5,
};
let spankKnelt = null;              // { was, idle } — you knelt for it; see `rise`
// idle | step | up | down | hold | away
let spankPh = 'idle', spankT = 0, spankK = 0;
const spankQ = [];                  // presses waiting for the hand — at most SPANK_HAND.queue
let spankArm = 0, spankElbow = 0;   // the third person's right arm, rad — see `spankHandTick`
let spank = null;                   // { side, k, hit, o, d, lift, u, fromK, al }
const spankAt = new THREE.Vector3(), spankFrom = new THREE.Vector3();
const spankP = new THREE.Vector3(), spankN = new THREE.Vector3(0, 1, 0);
const spankAlong = [0, 0, -1], spankPalm = [0, -1, 0];
const _skA = new THREE.Vector3(), _skB = new THREE.Vector3(), _skW = new THREE.Vector3();
const spankLog = { presses: 0, landed: 0, instant: 0, queued: 0, dropped: 0, far: 0, blocked: 0, last: [] };
let spankClock = 0;
let spankStop = null;               // debug: [phase, t] to hold the gesture at — see `__fr.jad.spankStop`

/** Whether the right hand is free to show a spank, first person or third. */
function spankShowable() {
  if (state.phase !== 'ground' || !ground || !ground.ok || chaseCut) return false;
  if (beltActive() || beltK > 0.01 || beltRubK > 0.01) return false;
  if (colK > 0.01 || colAfterK > 0.01) return false;
  const s = collarState();
  if (s && s.on && s.clipped) return false;
  return bodyCam || !!arms;
}

/**
 * A press on her backside: the hand, and the slap when it lands — or the
 * slap now, if the hand is busy. Same arguments as `buttSlap`.
 */
function spankStart(side, k = null, hit = null) {
  spankLog.presses++;
  if (!spankShowable()) {
    spankLog.instant++;
    spankPush({ side, reg: hit ? hit.reg : 'butt', press: +spankClock.toFixed(3), ms: 0, instant: true });
    return buttSlap(side, k, hit);
  }
  const job = { side, k, hit, o: camera.position.clone(), d: camera.getWorldDirection(new THREE.Vector3()),
    press: spankClock };
  // One on its way down already: this one goes next — up to `queue` of
  // them, and past that a press is a press nobody's hand could keep up with.
  if (spankPh === 'step' || spankPh === 'up' || spankPh === 'down') {
    if (spankQ.length >= SPANK_HAND.queue) { spankLog.dropped++; return false; }
    spankQ.push(job); spankLog.queued++;
    return true;
  }
  return spankBegin(job) || true;
}
/**
 * The hand for `job`, from wherever the hand is now — or, when it is in
 * reach and there is no way to it that does not go through her, the slap on
 * its own (see `spankReach`), and whatever the hand was doing goes on.
 */
function spankBegin(job) {
  // Harder the higher: `k` N·s when a probe says it (10 to 18 is the cot's
  // range, COT_RAG.spank), otherwise a little different every time.
  const u = job.k != null ? clamp((job.k - 10) / 8, 0, 1) : 0.25 + 0.5 * Math.random();
  job.lift = SPANK_HAND.lift[0] + (SPANK_HAND.lift[1] - SPANK_HAND.lift[0]) * u;
  job.u = u;
  job.fromK = spankK;
  spankSpot(job);
  // Out of an arm's reach, or a long way under it: over to her, and down.
  const Y = ground && ground.you;
  let step = false;
  if (Y) {
    job.kneel = !Y.crouch && Y.y + (Y.eye || GROUND.eye) - spankP.y > SPANK_HAND.kneelIf;
    // Straight on from her skin, the next of a flurry does not step: only if
    // she is well out of reach of where the hand already is.
    const far = SPANK_HAND.near + (job.fromK > 0.5 ? 0.35 : 0);
    step = job.kneel || Math.hypot(spankP.x - Y.x, spankP.z - Y.z) > far;
  }
  const was = spank;
  spank = job;
  if (!step && !spankReach()) {
    spankLog.blocked++;
    job.blocked = true;
    spankLand();
    spank = was;
    if (was) spankSpot(was);
    return false;
  }
  spankFrom.copy(spankAt);
  spankPh = step ? 'step' : 'up'; spankT = 0;
  if (step) { job.fromK = 0; job.moved = true; }
  return true;
}
/**
 * Whether the hand can get to the spot from here without your arm going
 * through her. Asked of the arm itself: posed once, out of turn, with the
 * palm on the spot (the frame's own pose, later, replaces it), and its
 * wrist, elbow and the elbow's end of the upper arm tried against her
 * capsules (`beltWorld`) — all but the last `near` m round the palm, which
 * is the hand's own business (`spankLift`). Two guesses at it came first and
 * both were wrong: her skin facing your shoulder said no to her far cheek
 * from beside the cot, which the arm reaches cleanly, and a straight line
 * from your shoulder said no to both cheeks from behind her bent over the
 * edge. What it is for: from behind her like that, the small of her back is
 * past the rise of her bottom and the forearm went 19 mm into it
 * (MEASURED); and from her head a flurry's crosshair slid on to the far
 * side of her.
 */
function spankReach() {
  const J = spank;
  J.dip = SPANK_HAND.dips[0];
  if (SPANK_HAND.guard === false) return true;
  // The skin there faces the eye that picked it — a crosshair cannot pick
  // what it cannot see, and a near miss (`cotAim`'s snap) on the far side of
  // her can — and the flat of a hand fits on it (`spankLift` not at its
  // limit): the whole hand went 117 mm into her, MEASURED, on a flurry's
  // spot on the far side of her from her head.
  if (_skA.subVectors(J.o, spankP).normalize().dot(spankN) < SPANK_HAND.facing) return false;
  const lift = spankLift();
  if (lift >= SPANK_HAND.liftMax) return false;
  if (bodyCam || !arms || !arms.joints) return true;
  const P = _skW.copy(spankP).addScaledVector(spankN, SPANK_HAND.off + lift);
  spankLie(0);
  const w = jadrija && jadrija.beltWorld ? jadrija.beltWorld() : null;
  if (!w || !w.caps || !w.n) return true;
  // The most the shoulder can go down first, since that is the arm that
  // looks right (see `dip` in 60-arms.js), and less of it if that one would
  // go through her — down through the edge of the cot, or through her legs
  // kneeling in front of you with her bent over it.
  for (const dip of SPANK_HAND.dips) {
    arms.update(0, { reach: { x: P.x, y: P.y, z: P.z, k: 1, kind: 'slap', along: spankAlong, palm: spankPalm,
      dip } }, camera);
    const j = arms.joints();
    if (!j) return true;
    const g = spankArmGap(j, P, w);
    spankLog.armGap = +g.toFixed(3);
    if (g >= SPANK_HAND.arm.r) { J.dip = dip; return true; }
  }
  return false;
}
/** The least gap (m) between the posed arm `j` (joints) and her capsules `w`, the palm's own end left out. */
function spankArmGap(j, P, w) {
  const G = SPANK_HAND.arm, C = w.caps;
  // Wrist to elbow, and the elbow's end of the upper arm.
  const segs = [[j.wrist, j.elbow, 0, 1], [j.elbow, j.shoulder, 0, G.upper]];
  let worst = Infinity;
  for (const [a, b, f0, f1] of segs) {
    for (let k = 0; k <= 8; k++) {
      const f = f0 + (f1 - f0) * k / 8;
      const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f;
      if (Math.hypot(x - P.x, y - P.y, z - P.z) < G.near) continue;
      // The round of the shoulder stands further off its joint than the arm
      // does off its line (MEASURED: in her 16 mm with the joint 76 clear).
      const cap = b === j.shoulder && f > 0.99 ? G.cap : 0;
      for (let i = 0; i < w.n; i++) {
        const o = 8 * i;
        const ex = C[o + 3] - C[o], ey = C[o + 4] - C[o + 1], ez = C[o + 5] - C[o + 2];
        const ee = ex * ex + ey * ey + ez * ez;
        const t = ee > 0 ? clamp(((x - C[o]) * ex + (y - C[o + 1]) * ey + (z - C[o + 2]) * ez) / ee, 0, 1) : 0;
        const g = Math.hypot(x - C[o] - ex * t, y - C[o + 1] - ey * t, z - C[o + 2] - ez * t)
          - (C[o + 6] + (C[o + 7] - C[o + 6]) * t) - cap;
        if (g < worst) worst = g;
      }
    }
  }
  return worst;
}
function spankPush(e) {
  spankLog.last.push(e);
  if (spankLog.last.length > 16) spankLog.last.shift();
}

/**
 * Where the hand is going on her, now: the spot (`spankP`), the way out of
 * her skin there (`spankN`, off the capsule she is drawn round), and the
 * fingers' way along her (`al`), away from your shoulder.
 */
function spankSpot(J = spank) {
  if (!J || !jadrija) return;
  if (J.hit) {
    // The same ray, asked again: she may have moved under it.
    const h = jadrija.cotAim ? jadrija.cotAim(J.o, J.d) : null;
    const g = h && !h.miss ? h : !J.had ? J.hit : null;
    if (g) { spankP.set(g.x, g.y, g.z); if (g.n) J.n = g.n; }
  } else {
    const b = jadrija.butt ? jadrija.butt() : null;
    const c = b ? b.find((q) => q.side === J.side) || b[0] : null;
    if (c) spankP.set(c.x, c.y, c.z);
    else if (!J.had) spankP.copy(J.o).addScaledVector(J.d, 0.9);
  }
  J.had = true;
  // Out of her skin: off the capsule the crosshair's ray went into, which
  // `cotAim` says; or, standing, off the nearest of her capsules — the ones
  // the belt and the cuff chains lie on (`beltWorld`) — from its line to the
  // spot. The nearest was the cot's first answer too, and lying flat her
  // hand beside her thigh is nearer a thigh's spot than the thigh is: the
  // palm stood up on its edge, square to the thigh's side.
  const w = !J.n && jadrija.beltWorld ? jadrija.beltWorld() : null;
  let best = Infinity;
  if (J.n) { spankN.fromArray(J.n); best = 0; }
  if (w && w.caps && w.n) {
    const C = w.caps;
    for (let i = 0; i < w.n; i++) {
      const o = 8 * i;
      const ex = C[o + 3] - C[o], ey = C[o + 4] - C[o + 1], ez = C[o + 5] - C[o + 2];
      const ee = ex * ex + ey * ey + ez * ez;
      const t = ee > 0 ? clamp(((spankP.x - C[o]) * ex + (spankP.y - C[o + 1]) * ey
        + (spankP.z - C[o + 2]) * ez) / ee, 0, 1) : 0;
      _skA.set(spankP.x - (C[o] + ex * t), spankP.y - (C[o + 1] + ey * t), spankP.z - (C[o + 2] + ez * t));
      const d = _skA.length();
      const g = Math.abs(d - (C[o + 6] + (C[o + 7] - C[o + 6]) * t));
      if (g < best && d > 1e-4) { best = g; spankN.copy(_skA).multiplyScalar(1 / d); }
    }
  }
  if (best > 0.06) spankN.subVectors(J.o, spankP).normalize();
  // The fingers: from your shoulder to the spot, laid on her skin.
  beltFrames();
  const S = SPANK_HAND.shoulder;
  _skB.set(_bO.x + _br.x * S[0], _bO.y + S[1], _bO.z + _br.z * S[0]);
  _skA.subVectors(spankP, _skB);
  _skA.addScaledVector(spankN, -_skA.dot(spankN));
  if (_skA.lengthSq() < 1e-6) _skA.copy(_bf).addScaledVector(spankN, -_bf.dot(spankN));
  _skA.normalize();
  J.al = [_skA.x, _skA.y, _skA.z];
}

/**
 * How much further off her the hand has to be (m) for the whole flat of it
 * to lie on her and not in her: the palm is 19 cm from heel to fingertip and
 * her skin is not flat under it. Bent over the edge of the cot the small of
 * her back is a hollow under the rise of her bottom, and a palm laid on it
 * by its middle went 29 mm into her with its heel (MEASURED). So the palm's
 * underside, heel to tips and side to side (`palm`, m along the fingers and
 * across, and how far under the bone line), is tried against her capsules,
 * and the hand stands off by the deepest, and a little.
 */
function spankLift() {
  const J = spank, w = jadrija && jadrija.beltWorld ? jadrija.beltWorld() : null;
  if (!J || !J.al || !w || !w.caps || !w.n) return 0;
  const C = w.caps, A = J.al, N = spankN, F = SPANK_HAND.palm;
  // Across the hand: fingers × out of her.
  const sx = A[1] * N.z - A[2] * N.y, sy = A[2] * N.x - A[0] * N.z, sz = A[0] * N.y - A[1] * N.x;
  let need = 0;
  for (const a of F.along) for (const c of F.across) {
    const x = spankP.x + A[0] * a + sx * c + N.x * (SPANK_HAND.off - F.under);
    const y = spankP.y + A[1] * a + sy * c + N.y * (SPANK_HAND.off - F.under);
    const z = spankP.z + A[2] * a + sz * c + N.z * (SPANK_HAND.off - F.under);
    for (let i = 0; i < w.n; i++) {
      const o = 8 * i;
      const ex = C[o + 3] - C[o], ey = C[o + 4] - C[o + 1], ez = C[o + 5] - C[o + 2];
      const ee = ex * ex + ey * ey + ez * ez;
      const t = ee > 0 ? clamp(((x - C[o]) * ex + (y - C[o + 1]) * ey + (z - C[o + 2]) * ez) / ee, 0, 1) : 0;
      const g = Math.hypot(x - C[o] - ex * t, y - C[o + 1] - ey * t, z - C[o + 2] - ez * t)
        - (C[o + 6] + (C[o + 7] - C[o + 6]) * t);
      if (F.gap - g > need) need = F.gap - g;
    }
  }
  return Math.min(need, 0.08);
}

/** The hand's lie with the wrist cocked back by `a` rad, into spankAlong / spankPalm. */
function spankLie(a) {
  const A = spank.al, N = spankN, c = Math.cos(a), sn = Math.sin(a);
  const n = [N.x, N.y, N.z];
  for (let i = 0; i < 3; i++) {
    spankAlong[i] = A[i] * c + n[i] * sn;
    spankPalm[i] = -n[i] * c + A[i] * sn;
  }
}

/** Once a frame, before the arms are posed: where the hand is, and the slap when it lands. */
function spankHandTick(dt) {
  spankClock += dt;
  if (spankPh === 'idle') {
    spankK = damp(spankK, 0, 10, dt);
    spankArm = spankArm < 0.01 ? 0 : damp(spankArm, 0, 10, dt);
    spankElbow = spankElbow < 0.01 ? 0 : damp(spankElbow, 0, 10, dt);
    // Up again, a while after the last one — unless you were down before it,
    // or have stood up yourself since.
    if (spankKnelt) {
      spankKnelt.idle += dt;
      const Y = ground && ground.you;
      if (!Y || !Y.crouch || state.phase !== 'ground') spankKnelt = null;
      else if (spankKnelt.idle > SPANK_HAND.rise) {
        if (!spankKnelt.was) Y.crouch = false;
        spankKnelt = null;
      }
    }
    return;
  }
  if (spankKnelt) spankKnelt.idle = 0;
  const H = SPANK_HAND, J = spank;
  // Gone from where a hand could do it: whatever was coming lands now.
  if (!J || state.phase !== 'ground') {
    if (J && (spankPh === 'step' || spankPh === 'up' || spankPh === 'down')) spankLand();
    while (spankQ.length) { const q = spankQ.shift(); spankLog.instant++; buttSlap(q.side, q.k, q.hit); }
    spankPh = 'idle'; spank = null;
    return;
  }
  spankT = spankStop && spankStop[0] === spankPh ? Math.min(spankT + dt, spankStop[1]) : spankT + dt;
  spankSpot();
  const P = _skW.copy(spankP).addScaledVector(spankN, H.off + spankLift());
  // Over the spot, and back toward you.
  const W = _skB.set(camera.position.x - spankP.x, 0, camera.position.z - spankP.z);
  if (W.lengthSq() > 1e-8) W.normalize();
  W.multiplyScalar(H.back).add(spankP).addScaledVector(spankN, J.lift);
  // The third person's arm, about the shoulder's fore-and-aft swing (the
  // jump's axis): up in front of her and bent at the elbow, then down to her.
  const armUp = 1.9 + 0.3 * J.u, armAt = 0.62, elUp = 1.25;
  // Your view kept on the spot while you step in, go down and swing — only
  // when it was the spank that moved you, and not once the hand is on her:
  // she moves under it then, and a view steered on to a thing that moves is
  // THE SHAKE (see `settleTurn`).
  if (J.moved && !bodyCam && !camOverride && (spankPh === 'step' || spankPh === 'up' || spankPh === 'down')) {
    const Y = ground.you, O = camera.position, ch = Math.hypot(spankP.x - O.x, spankP.z - O.z);
    let dy = Math.atan2(O.x - spankP.x, O.z - spankP.z) - Y.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    Y.yaw += dy * (1 - Math.exp(-12 * dt));
    Y.pitch += (Math.atan2(spankP.y - O.y, Math.max(ch, 0.05)) - Y.pitch) * (1 - Math.exp(-12 * dt));
  }
  if (spankPh === 'step') {
    // To `stand` off the spot, level, along the line from you to it; your
    // view turned on to it as you go, so the crosshair stays where you put it.
    const Y = ground.you;
    if (J.kneel && !Y.crouch) {
      Y.crouch = true;
      if (!spankKnelt) spankKnelt = { was: false, idle: 0 };
    }
    const dx = spankP.x - Y.x, dz = spankP.z - Y.z, hd = Math.hypot(dx, dz) || 1;
    const md = hd - H.stand;
    let moved = 0;
    if (md > 0.005 && ground.confine) {
      const st = Math.min(md, H.walk * dt);
      const [nx, nz] = ground.confine(Y.x + dx / hd * st, Y.z + dz / hd * st);
      moved = Math.hypot(nx - Y.x, nz - Y.z);
      Y.x = nx; Y.z = nz;
    }
    J.stuck = moved < 0.2 * H.walk * dt ? (J.stuck || 0) + dt : 0;
    const there = md <= 0.02 || J.stuck > 0.12 || spankT >= H.stall;
    const down = !J.kneel || (Y.low || 0) > H.low || spankT >= H.stall + 0.6;
    if (there && down) {
      J.stepped = +spankT.toFixed(3);
      const far = Math.hypot(spankP.x - Y.x, spankP.z - Y.z) > H.reachMax;
      if (far || !spankReach()) {
        if (far) { J.far = true; spankLog.far++; } else { J.blocked = true; spankLog.blocked++; }
        spankLand();
        spankPh = 'idle'; spank = null;
        while (spankQ.length) { const q = spankQ.shift(); spankLog.instant++; buttSlap(q.side, q.k, q.hit); }
        return;
      }
      spankPh = 'up'; spankT = 0; spankFrom.copy(spankAt);
    }
    spankK = damp(spankK, 0, 10, dt);
  } else if (spankPh === 'up') {
    const u = smooth01(spankT / H.up);
    if (J.fromK < 0.05) { spankAt.copy(W); spankK = u; } else {
      // From her skin, up and over: straight across to the next spot went
      // through whatever of her rose between the two.
      spankAt.lerpVectors(spankFrom, W, u).addScaledVector(spankN, 0.08 * Math.sin(Math.PI * u));
      spankK = J.fromK + (1 - J.fromK) * u;
    }
    spankLie(H.cock * u);
    spankArm += (armUp - spankArm) * u; spankElbow += (elUp - spankElbow) * u;
    if (spankT >= H.up) { spankPh = 'down'; spankT = 0; }
  } else if (spankPh === 'down') {
    const u = clamp(spankT / H.down, 0, 1), w = u * u;
    spankAt.lerpVectors(W, P, w);
    spankK = 1;
    spankLie(H.cock * (1 - w));
    spankArm = armUp + (armAt - armUp) * w; spankElbow = elUp + (0.15 - elUp) * w;
    if (u >= 1) { spankAt.copy(P); spankLand(); spankPh = 'hold'; spankT = 0; }
  } else if (spankPh === 'hold') {
    // Flattened on her, a few millimetres, and back — and coming up off her
    // already in the second half, since she comes up under it too (the seat
    // goes into the foam and back past where it lay: COT_RAG.spank).
    const v = clamp(spankT / H.hold, 0, 1);
    spankAt.copy(P).addScaledVector(spankN, v < 0.5 ? -H.press * Math.sin(Math.PI * v * 2)
      : 0.012 * smooth01((v - 0.5) * 2));
    spankK = 1;
    spankLie(0);
    if (spankT >= H.hold) {
      spankFrom.copy(spankAt);
      while (spankQ.length) if (spankBegin(spankQ.shift())) return;
      spankPh = 'away'; spankT = 0;
    }
  } else if (spankPh === 'away') {
    const u = clamp(spankT / H.away, 0, 1);
    // Up off her first, then in to the bottom right of the picture close to
    // you (`exit`, the eye's frame), and only from there down out of it:
    // straight from her skin to where the hand rests is through her and the
    // edge of the cot, kneeling (MEASURED, 34 mm into her), and bent over
    // the edge, through her legs in front of you (43).
    const lifted = _skB.copy(P).addScaledVector(spankN, 0.012 + 0.15 * smooth01(u / 0.4));
    if (u > 0.4) {
      beltFrames();
      const X = H.exit, v = smooth01((u - 0.4) / 0.6);
      const ex = _bO.x + _bR.x * X[0] + _bU.x * X[1] + _bF.x * X[2];
      const ey = _bO.y + _bR.y * X[0] + _bU.y * X[1] + _bF.y * X[2];
      const ez = _bO.z + _bR.z * X[0] + _bU.z * X[1] + _bF.z * X[2];
      lifted.set(lifted.x + (ex - lifted.x) * v, lifted.y + (ey - lifted.y) * v, lifted.z + (ez - lifted.z) * v);
    }
    spankAt.copy(lifted);
    spankK = 1 - smooth01((u - 0.75) / 0.25);
    spankLie(0.25 * u);
    spankArm = armAt * (1 - u); spankElbow = 0.15 * (1 - u);
    if (spankT >= H.away) { spankPh = 'idle'; spankK = 0; spank = null; }
  }
}
/** The hand is on her: the slap — sound, mark, her hands, the weight. */
function spankLand() {
  const J = spank;
  if (!J || J.landed) return;
  J.landed = true;
  // Where the hand actually is on her now, for the weight; the mark keeps
  // the bind point it was aimed at.
  const hit = J.hit ? { ...J.hit, x: spankP.x, y: spankP.y, z: spankP.z } : null;
  const n0 = buttSlaps;
  buttSlap(J.side, J.k, hit);
  spankLog.landed++;
  spankPush({ side: J.side, reg: hit ? hit.reg : 'butt', press: +J.press.toFixed(3),
    contact: +spankClock.toFixed(3), ms: Math.round((spankClock - J.press) * 1000), step: J.stepped || 0,
    aimed: !!J.hit,
    far: !!J.far, blocked: !!J.blocked, dip: J.dip, gap: spankLog.armGap, sound: buttSlaps > n0, at: [+spankP.x.toFixed(3), +spankP.y.toFixed(3), +spankP.z.toFixed(3)],
    n: [+spankN.x.toFixed(2), +spankN.y.toFixed(2), +spankN.z.toFixed(2)],
    miss: arms && arms.probe && !bodyCam ? arms.probe()[1].missMm : null });
}
/** Debug: where the spank is — see `__fr.jad.spankHand`. */
function spankStats() {
  return { ph: spankPh, t: +spankT.toFixed(3), k: +spankK.toFixed(3), queued: spankQ.length,
    eye: camera.position.toArray().map((v) => +v.toFixed(3)), knelt: !!spankKnelt,
    // The third person's right hand, world, while B is on — see `spankArm`.
    hand3: bodyCam && collarThirdHand(_skA) ? _skA.toArray().map((v) => +v.toFixed(3)) : null,
    arm: +spankArm.toFixed(2), elbow: +spankElbow.toFixed(2),
    at: [+spankAt.x.toFixed(3), +spankAt.y.toFixed(3), +spankAt.z.toFixed(3)],
    spot: [+spankP.x.toFixed(3), +spankP.y.toFixed(3), +spankP.z.toFixed(3)],
    n: [+spankN.x.toFixed(3), +spankN.y.toFixed(3), +spankN.z.toFixed(3)],
    log: { ...spankLog, last: spankLog.last.slice() } };
}

let buttSide = 1;               // which cheek the crosshair picked, +1 her left
let buttHit = null;             // and where on her, on the cot — see `cotAim`
let reachForce = null;       // debug: [kind, side] instead of the crosshair
let camTraceOn = false;       // debug: the camera, frame by frame — see camTrace
const camTrace = [];
const CUP_AIM_R = 0.16;      // rad off the crosshair a breast still counts
const CUP_STAND = 0.45;      // m, eye to her, where you stop
const CUP_OFF = 0.046;       // m, the palm's bone line off her skin: the palm is 15 mm under it and the breast curves toward the hand either side of its point
// On the thigh stroke it is the bone line off the plane the palm lies in
// there, clear of the highest of her skin under the whole hand — see
// `apprenticeStrokeBind`. With the bone line 46 mm out the palm stood 16 to
// 22 mm off the round of her thigh, so it is some 26 mm thick under it; 30
// is the palm resting on her rather than in her.
const THIGH_OFF = 0.030;
const cupOff = () => (reachKind === 'thigh' && cupAt && cupAt.off != null ? THIGH_OFF + cupAt.off : CUP_OFF);
const PET_STAND = 0.50;      // m, eye to crown, horizontally, where you stop
const PET_REACH = 0.95;      // and how close the hand comes up from
const HAIR_STAND = 0.42;     // m, level, her hair to your eye, where you stop behind her
const HAIR_REACH = 0.90;     // and how close the hand goes out from
const _thumbF = new THREE.Vector3(), _thumbV = new THREE.Vector3();
const THUMB_D = 1.8;         // how far off her lip the button means the thumb
const THUMB_STAND = 0.45;    // and where you stop, eye to lip

// ── THE BEACH BALL, out of your hand ─────────────────────────────────────────
//
// Misha, 26 Sep 2026: the ball for the Slow Doodle. `[` (or "throw the ball")
// brings your hand up into view with it, and at the top of that it leaves
// your hand along where you are looking — see BALL in src/43-ball.js for the
// speed and the numbers, and `── the fetch ──` in 43-doodle.js for what he
// does about it. `throwT` is the gesture's clock (−1 when there is none),
// `throwK` how far out the hand is, `throwAt` where it is going.
let throwT = -1, throwK = 0, throwDone = false;
const throwAt = new THREE.Vector3();
const _thF = new THREE.Vector3(), _thR = new THREE.Vector3(), _thU = new THREE.Vector3();
let ballFetchSaid = null;       // what the creature said to the last throw, for a probe

/**
 * The key, and the voice's way into it. Out of the bag and thrown; or, when
 * it is lying within reach, back into the bag. Answers `{ got, toast }` —
 * `toast` an i18n key or nothing.
 */
function ballKey() {
  const B = jadrija && jadrija.ball;
  if (!B) return { got: 'noball', toast: null };
  // IN THE SEA: he will not go in after it — see the fetch's `sad` — so
  // somebody has to. Swim up to it and it comes back into the bag; it does
  // not get thrown from the water.
  if (state.phase === 'swim' && swim && swim.you && B.where === 'out') {
    const I = B.info(), Y = swim.you;
    const dh = Math.hypot(I.x - Y.x, I.z - Y.z);
    if (dh < BALL.pick && Math.abs(I.y - Y.y) < 1.2) {
      B.stow();
      satchelPut('ball');
      return { got: 'picked', toast: 'ball.picked', far: +dh.toFixed(2) };
    }
    return { got: 'away', toast: 'ball.away', far: +dh.toFixed(1) };
  }
  if (state.phase !== 'ground' || !ground || !ground.ok || !ground.you) return { got: 'foot', toast: 'ball.foot' };
  if (throwT >= 0) return { got: 'throwing', toast: null };
  if (B.where === 'out') {
    const I = B.info(), Y = ground.you;
    const dh = Math.hypot(I.x - Y.x, I.z - Y.z), dy = I.y - Y.y;
    if (dh < BALL.pick && dy > -0.9 && dy < 2.3) {
      B.stow();
      satchelPut('ball');
      return { got: 'picked', toast: 'ball.picked', far: +dh.toFixed(2) };
    }
    return { got: 'away', toast: 'ball.away', far: +dh.toFixed(1) };
  }
  if (B.where === 'held') return { got: 'held', toast: null };
  if (!satchelHas('ball')) return { got: 'noball', toast: null };
  throwT = 0;
  throwDone = false;
  ballHand();
  // Drawn in your hand from the first frame of the gesture: `hold` is the
  // same door the creature's mouth uses.
  B.hold(() => [throwAt.x + _thF.x * BALL.r, throwAt.y + _thF.y * BALL.r, throwAt.z + _thF.z * BALL.r]);
  return { got: 'thrown', toast: null };
}

/** Where your hand is going: BALL.hand in the eye's frame, into `throwAt`. */
function ballHand() {
  camera.getWorldDirection(_thF);
  _thU.set(0, 1, 0);
  _thR.crossVectors(_thF, _thU).normalize();
  _thU.crossVectors(_thR, _thF).normalize();
  const H = BALL.hand;
  if (bodyCam && ground && ground.you) {
    // In the third person the camera is not where you are: from your chest.
    const Y = ground.you;
    throwAt.set(Y.x, Y.y + 1.35, Y.z).addScaledVector(_thF, H[0]);
    return;
  }
  throwAt.copy(camera.position).addScaledVector(_thF, H[0]).addScaledVector(_thR, H[1])
    .addScaledVector(_thU, H[2]);
}

/** The gesture, once a frame: up, let go at the top, and down again. */
function ballThrowTick(dt) {
  if (throwT < 0) { throwK = damp(throwK, 0, 8, dt); return; }
  const B = jadrija && jadrija.ball;
  if (!B || state.phase !== 'ground') {
    if (B && B.where === 'held' && !throwDone) B.stow();
    throwT = -1;
    return;
  }
  throwT += dt;
  ballHand();
  if (throwT < BALL.windup) {
    const u = throwT / BALL.windup;
    throwK = u * u * (3 - 2 * u);
    return;
  }
  if (!throwDone) {
    throwDone = true;
    throwK = 1;
    if (!satchelTake('ball')) { B.stow(); throwT = -1; return; }
    // Along the look, lifted by `loft`, and out of the palm: the ball's
    // centre a radius in front of the hand.
    const vx = _thF.x, vy = _thF.y + BALL.loft, vz = _thF.z;
    const l = Math.hypot(vx, vy, vz) || 1;
    const k = BALL.throwV / l;
    B.throwFrom(throwAt.x + _thF.x * BALL.r, throwAt.y + _thF.y * BALL.r, throwAt.z + _thF.z * BALL.r,
      vx * k, vy * k, vz * k);
    // And the creature, if he heard it: he answers who he is bringing it to,
    // or why not — which is said only when it was asked for in words.
    ballFetchSaid = jadrija.doodleFetch ? jadrija.doodleFetch() : 'nodog';
    return;
  }
  const u = (throwT - BALL.windup) / BALL.follow;
  throwK = Math.max(0, 1 - u);
  if (u >= 1) throwT = -1;
}

// ── THE HAMMOCK PUSH ──────────────────────────────────────────────────────
//
// Misha, 27 Sep 2026: *"I can sorta swing baye on it"*. The same button the
// branch is on, and the same finger: standing by the hammock with the cloth
// (or her in it) in front of you, a press is a shove with the flat of your
// hand instead of water — the way the kabina's press is a thumb instead of
// water. Once per press: the swing is a pendulum, and pushing again as it
// comes back toward you and starts away is what builds it, which is the whole
// game of pushing somebody in a hammock.
//
// The hand goes out to where the cloth is and comes back — `pushK`, the
// throw's gesture with the open palm — over `PUSH_HAND` seconds.
const PUSH_HAND = { out: 0.14, back: 0.30 };
let pushT = -1, pushK = 0, hammockPushes = 0;
const pushAt = new THREE.Vector3();
const _pushV = new THREE.Vector3(), _pushF = new THREE.Vector3();
/**
 * The hammock is within reach and in front of you: the point to push, or
 * null. `any` skips the aim (a probe cannot aim a crosshair to the degree).
 */
function hammockAim(any = false) {
  const H = jadrija && jadrija.hammock;
  if (!H || state.phase !== 'ground' || !ground || !ground.ok || !ground.you) return null;
  const Y = ground.you;
  const n = H.nearest(Y.x, Y.z);
  if (!n || n.d > HAMMOCK.reach) return null;
  if (any) return n;
  const fw = camera.getWorldDirection(_pushF);
  _pushV.set(n.x - camera.position.x, n.y - camera.position.y, n.z - camera.position.z).normalize();
  // 0.2 and not 0.55: about 78 degrees either side of the crosshair rather
  // than 57, so the cloth only has to be in front of you, not under the
  // crosshair — "from more angles". And the reach is 2.8 m now (HAMMOCK).
  return fw.dot(_pushV) > 0.2 ? n : null;
}

/**
 * The crosshair on the hammock itself, not merely the hammock in front of
 * you (1.554.0): with her in it on the leash, a press aimed at the cloth is
 * the push, and anywhere else a tug — see the press, `collarTuggable`.
 */
function hammockOnAim() {
  const n = hammockAim(true);
  if (!n) return false;
  const fw = camera.getWorldDirection(_pushF);
  _pushV.set(n.x - camera.position.x, n.y - camera.position.y, n.z - camera.position.z).normalize();
  return fw.dot(_pushV) > 0.9;
}

// AND HARDER THE LONGER YOU HOLD IT. Misha, 27 Sep 2026: *"if, i dunno press
// and hold the mouse while doing it, it should rock *harder*... so i do want
// her to occasionally fall out"*. The press is the shove it always was; held,
// the hand stays on the cloth and keeps pushing — `HOLD.rate` of a shove a
// second, from `HOLD.after` to `HOLD.max` — so a full hold is three shoves'
// worth, across the span and away from you like the first. Let go and it stops.
const HOLD = { after: 0.12, max: 0.8, rate: 2.5 };
let holdT = -1;
function hammockHold(dt, down) {
  if (!down || pushT < 0) { holdT = -1; return; }
  holdT = holdT < 0 ? 0 : holdT + dt;
  if (holdT < HOLD.after || holdT > HOLD.max) return;
  if (!hammockAim(true)) return;
  const Y = ground.you;
  const r = jadrija.hammock.push(Y.x, Y.z, HOLD.rate * dt, false);
  if (r && jadrija.hamPushed) jadrija.hamPushed(r.dv);
}
/** Push it, if you can; the velocity it was given, or null. */
function hammockPush(any = false) {
  const n = hammockAim(any);
  if (!n || pushT >= 0) return null;
  const H = jadrija.hammock, Y = ground.you;
  const r = H.push(Y.x, Y.z);
  if (!r) return null;
  pushT = 0;
  pushAt.set(r.at[0], r.at[1] + 0.05, r.at[2]);
  hammockPushes++;
  // And her, if she is in it: a smile at a push, and a laugh at a big one —
  // see `hamPushed` in 43-jadrija.js.
  if (jadrija.hamPushed) jadrija.hamPushed(r.dv);
  return r;
}
function hammockPushTick(dt) {
  if (pushT < 0) { pushK = damp(pushK, 0, 8, dt); return; }
  // Held: the palm stays out on the cloth — see `hammockHold`.
  if (holdT >= 0 && holdT <= HOLD.max && pushT >= PUSH_HAND.out) { pushK = 1; return; }
  pushT += dt;
  if (pushT < PUSH_HAND.out) {
    const u = pushT / PUSH_HAND.out;
    pushK = u * u * (3 - 2 * u);
    return;
  }
  const u = (pushT - PUSH_HAND.out) / PUSH_HAND.back;
  pushK = Math.max(0, 1 - u);
  if (u >= 1) pushT = -1;
}

// ── THE BELT, IN YOUR HAND ───────────────────────────────────────────────────
//
// Misha, 30 Sep 2026: *"would be cool if in kabine when spanking. I (chloe)
// take out my belt and spank baye with it, also could probably reuse the AVBD
// physics for it"*. The strap is 43-belt.js and where it lands on her is
// `beltHit` in 43-jadrija.js; this is your hand and the game round it.
//
// WHAT IT IS, AND WHAT IT IS NOT. Two adults in a private room, playing, and
// the design says so at every turn: she takes it laughing and asking for more
// (`BELT_SAY`); a lazy swing is a pat and not a blow; nothing it does leaves
// more than the hand's own faint flush, gone in half a minute; and there is a
// SAFEWORD, "crvena" — red — which ends it at once, whoever says it. You say
// it by typing or saying "red" / "crvena" / "stop" (the typed line is matched
// here, before anything is sent anywhere, so it works signed out and offline).
// SHE says it when it is too much: hard lashes close together heat a meter
// (`beltHeat`), at `yellow` she tells you to ease off, and past `red` she
// calls it. Either way the belt goes straight back on, the swing that was
// coming does not come, your hand goes to her hair (her `pet`, the room's
// own tenderness), and she thanks you for it. After her red it stays on for
// `lock` seconds whatever you ask.
//
// THE HAND: `\` or "belt" / "remen" and your right hand goes down to the
// buckle at your waist, draws the belt out of the loops — laid along a curve
// from your fist to where it leaves your jeans, and taken off her by the
// same amount in the body shader (`you.belt`) — and holds it by the buckle
// with the strap hanging, a physical strap from then on. The press is a
// swing: held, your hand winds up over your shoulder, and let go it comes
// down on the crosshair, faster the longer you wound it (`charge`), so a
// quick click is a lazy one. `\` again, or "belt back", feeds it back in.
// First person and in the kabina only: anywhere else it is simply back on.
const BELT_HAND = {
  // Your hand holding it, in the eye's frame (right, up, forward, m): low on
  // the right, in view.
  hold: [0.18, -0.17, 0.45],
  // The buckle at your waist and the loop on your left hip it goes back in
  // through, in your LEVEL frame (right, up, forward) — your waist does not
  // look down when you do.
  waist: [0.03, -0.66, 0.15], feed: [-0.13, -0.66, 0.08],
  // Seconds: to the buckle, drawing it out; and to the waist again, feeding it
  // back, buckling. `fast` of each when it is a safeword.
  reach: 0.35, draw: 0.85, toWaist: 0.35, feedIn: 0.75, buckle: 0.30, fast: 0.6,
  // The swing: up to the wind-up; the strike, `strike[0]` s at no charge to
  // `strike[1]` wound right up (`full` s of holding); through, and back.
  windUp: 0.30, strike: [0.80, 0.17], full: 0.55, through: 0.12, back: 0.45,
  // THE SWING'S PLANE (`beltPlan`): your shoulder, right of the eye and
  // under it (m); how far out along the line from it to what you aimed at the
  // hand stops — a strap's reach short of it, `strapReach`; the path's last
  // `over` m straight down that line, and before it the wind-up, `windBack`
  // further back (level) and `windUp2` up.
  shoulder: [0.18, -0.22], reachOut: [0.12, 0.62], strapReach: 0.95,
  windBack: 0.22, windUp2: 0.30, over: 0.36, overUp: 0.0,
  // THE METER: each crack adds 0.2 + u (u 0..1 how hard, BELT.hit), a pat
  // next to nothing, and it cools over `cool` s. `yellow` and `red`: the
  // hardest a second apart is red on the third, an ordinary full swing on
  // the fourth; half-strength ones at any pace never get past yellow.
  cool: 3.0, yellow: 1.3, red: 2.2,
  // After her red, seconds before the belt will come out again; after yours.
  lock: 20, lockYou: 3,
  // The aftercare lying on her front: how long, the hand's round (m, s), and
  // how far over her skin its target is (m — the pet's is her hair's crown).
  rub: { secs: 4.5, r: 0.03, period: 1.6, off: 0.035 },
};
// What she says, in her Croatian, and what it means (i18n `belt.g.*` — the
// gloss, which is empty in Croatian). One line in two, never closer than
// `sayGap` s, a pat or a crack; the rest are always said.
const BELT_SAY = {
  pat: [['Hehe. To je sve?', 'pat0'], ['Mm, škakljivo.', 'pat1'], ['Jače, ne bojim se.', 'pat2']],
  crack: [['Ah! ...Opet.', 'crack0'], ['Mmh. Još jednom.', 'crack1'], ['Uh! Hehe, zločesta.', 'crack2'],
    ['Joj, to je dobro.', 'crack3'], ['Opet!', 'crack4'], ['Hehe. Svidjelo mi se.', 'crack5']],
  off: [['Hej! Ne tamo, hehe.', 'off0']],
  yellow: [['Žuta. Polako, ljubavi.', 'yellow0']],
  red: [['Crvena.', 'red0']],
  heard: [['Okej. Dođi ovamo.', 'heard0']],
  after: [['Mm... hvala ti.', 'after0'], ['Hvala ti, ljubavi.', 'after1']],
  sayGap: 1.4,
};
let belt = null;                 // the strap, built the first time it comes out
let beltPh = 'off';              // off | reach | draw | hold | wind | strike | through | back | toWaist | feed | buckle
let beltT = 0, beltK = 0, beltGrip = 0, beltCharge = 0, beltHeld = 0;
let beltHeat = 0, beltYellow = false, beltLock = 0, beltSaidAt = -9, beltClock = 0;
let beltFast = false, beltAfter = null, beltPressed = false;
let beltRubK = 0;                // the aftercare's hand on her, 0..1 — see `beltHandTick`
const beltRubAt = new THREE.Vector3();
const beltAt = new THREE.Vector3(), beltQ = new THREE.Quaternion();
const beltFrom = new THREE.Vector3(), beltDirFrom = new THREE.Vector3(), beltDirTo = new THREE.Vector3();
const beltTo = new THREE.Vector3(), beltAim = new THREE.Vector3(), beltExit = new THREE.Vector3();
const _bF = new THREE.Vector3(), _bR = new THREE.Vector3(), _bU = new THREE.Vector3();
const _bf = new THREE.Vector3(), _br = new THREE.Vector3(), _bD = new THREE.Vector3(), _bZ = new THREE.Vector3();
const _bY = new THREE.Vector3(), _bM = new THREE.Matrix4();
const beltLog = { out: 0, back: 0, swings: 0, lashes: 0, pats: 0, off: 0, landed: 0, yellow: 0,
  safe: { you: 0, her: 0 }, said: [], hits: [], after: null, last: null,
  react: { line: 0, moan: 0, gasp: 0, none: 0 } };

let beltEye = null;              // debug: the eye held where it was — see `__fr.belt.freeze`
const _bO = new THREE.Vector3();
/** The eye's frame (`_bF`/`_bR`/`_bU`) and the level one (`_bf`/`_br`); the eye in `_bO`. */
function beltFrames() {
  if (beltEye) { _bO.fromArray(beltEye, 0); _bF.fromArray(beltEye, 3); } else {
    _bO.copy(camera.position);
    camera.getWorldDirection(_bF);
  }
  _bR.crossVectors(_bF, _bU.set(0, 1, 0)).normalize();
  _bU.crossVectors(_bR, _bF).normalize();
  _bf.set(_bF.x, 0, _bF.z).normalize();
  _br.set(-_bf.z, 0, _bf.x);
}
/** A point in the eye's frame, or (`level`) in the level one, into `out`. */
function beltPoint(o, out, level = false) {
  const O = _bO;
  if (level) return out.set(O.x + _br.x * o[0] + _bf.x * o[2], O.y + o[1], O.z + _br.z * o[0] + _bf.z * o[2]);
  return out.copy(O).addScaledVector(_bR, o[0]).addScaledVector(_bU, o[1]).addScaledVector(_bF, o[2]);
}
/**
 * The fist's attitude for a strap leaving it along `dir`, its width across
 * `across` (your right, unless a swing says otherwise). A strap bends only
 * through its thickness — edgewise it is held — so a swing must have the
 * width square to the plane it swings in, or it cannot bend in that plane
 * and goes wide: see `beltPlan`.
 */
function beltAttitude(dir, out, across = _bR) {
  _bD.copy(dir).normalize();
  _bZ.copy(across).addScaledVector(_bD, -across.dot(_bD));
  if (_bZ.lengthSq() < 1e-6) _bZ.set(0, 0, 1);
  _bZ.normalize();
  _bY.crossVectors(_bZ, _bD);
  _bM.makeBasis(_bD, _bY, _bZ);
  return out.setFromRotationMatrix(_bM);
}
// (`smooth01`, the clamped smoothstep, is 44-corpse.js's.)

/**
 * A curve of length `len` from `a` to `b`, hanging between them — a quadratic
 * with its middle let down until it is that long — as [x, y, z] points.
 */
function beltSag(a, b, len, n = 16) {
  const d = a.distanceTo(b);
  const pt = (sag) => {
    const out = [];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - sag, mz = (a.z + b.z) / 2;
    for (let k = 0; k <= n; k++) {
      const u = k / n, v = 1 - u;
      out.push([v * v * a.x + 2 * u * v * mx + u * u * b.x, v * v * a.y + 2 * u * v * my + u * u * b.y,
        v * v * a.z + 2 * u * v * mz + u * u * b.z]);
    }
    return out;
  };
  const lenOf = (P) => { let L = 0; for (let k = 1; k < P.length; k++) L += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1], P[k][2] - P[k - 1][2]); return L; };
  if (len <= d + 1e-4) {
    const u = len / Math.max(d, 1e-6);
    return [[a.x, a.y, a.z], [a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u]];
  }
  let lo = 0, hi = 2 * len;
  for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (lenOf(pt(m)) < len) lo = m; else hi = m; }
  return pt((lo + hi) / 2);
}

/** Whether the belt is in your hand (and so the press is a swing). */
const beltInHand = () => beltPh === 'hold' || beltPh === 'wind' || beltPh === 'strike'
  || beltPh === 'through' || beltPh === 'back';
/** Whether it is out at all — for "stop" meaning the belt and not something else. */
const beltActive = () => beltPh !== 'off';

/** Where you can have it out: on foot, first person, in the kabina, with her. */
function beltPlace() {
  if (state.phase !== 'ground' || !ground || !ground.ok || !jadrija || !jadrija.kabina) return 'kabina';
  if (bodyCam) return 'first';
  // Where YOU are, not the camera — see `personAt`.
  if (!(jadrija.kabina.inside && jadrija.kabina.inside(ground.you.x, ground.you.z) > 0.5)) return 'kabina';
  return null;
}

/** Straight back on, no gesture — leaving the room, the third person, a cut. */
function beltSnap() {
  if (audio && audio.beltQuiet) audio.beltQuiet();
  if (belt) belt.hide();
  if (you && you.belt) you.belt(1);
  beltPh = 'off'; beltK = 0; beltGrip = 0; beltT = 0; beltPressed = false;
}

/**
 * "belt", "belt back", "red" — and the key. Answers what happened, a word:
 * 'out', 'back', 'stopped', or why not ('kabina', 'first', 'later', 'busy', 'not out').
 */
function beltCmd(what) {
  if (what === 'belt.stop') return beltSafeword('you');
  if (what === 'belt.back') {
    if (!beltInHand()) return beltPh === 'off' ? 'not out' : 'busy';
    beltStow(false);
    return 'back';
  }
  // Out, or the key pressed with it already out: back.
  if (what === 'belt.key' && beltInHand()) { beltStow(false); return 'back'; }
  if (what === 'belt.out' && beltInHand()) return 'already';
  if (beltPh !== 'off') return 'busy';
  // The leash is in that hand — see COLLAR.
  if (typeof collarActive === 'function' && collarActive()) return 'collar';
  const why = beltPlace();
  if (why) return why;
  if (beltLock > 0) return 'later';
  if (!belt) {
    belt = beltStrap(scene);
    belt.onHit = beltLanded;
  }
  if (audio && audio.slapWarm) audio.slapWarm();
  beltPh = 'reach'; beltT = 0; beltGrip = 0; beltFast = false;
  // The unbuckle (1.552.1, his recording): its clink as the fist, closed on
  // the buckle at the end of `reach`, pulls — a tenth of a second into `draw`.
  if (audio && audio.beltBuckle) audio.beltBuckle(BELT_HAND.reach + 0.1);
  beltLog.out++;
  return 'out';
}

/** Back into the loops: to the waist, fed in, buckled. `fast` for a safeword. */
function beltStow(fast) {
  if (!beltActive() || beltPh === 'reach' || beltPh === 'toWaist' || beltPh === 'feed' || beltPh === 'buckle') {
    if (beltPh === 'reach' || beltPh === 'draw') { beltSnap(); }
    return;
  }
  beltFast = !!fast;
  beltPh = 'toWaist'; beltT = 0;
  beltFrom.copy(beltAt);
  beltPressed = false;
  beltLog.back++;
}

/**
 * THE SAFEWORD. `who` 'you' or 'her'. Ends it now: whatever swing was coming
 * does not come, the belt goes back on, and when it is on your hand goes to her
 * hair and she thanks you (`beltAfter`).
 */
function beltSafeword(who) {
  // Nothing of hers still to come — no gasp a second after a red, even one
  // asked for just before the belt went back in — and a moan that is
  // sounding, gone in a quarter of a second.
  if (audio && audio.herHush) audio.herHush('safe');
  if (!beltActive()) return 'not out';
  beltLog.safe[who]++;
  sceneSafe(who, 'belt');
  beltSay(who === 'her' ? 'red' : 'heard', true);
  beltLock = who === 'her' ? BELT_HAND.lock : BELT_HAND.lockYou;
  beltHeat = 0; beltYellow = false;
  if (beltPh === 'reach' || beltPh === 'draw') beltSnap();
  else beltStow(true);
  beltAfter = { t: 0, who, how: null, said: false };
  return 'stopped';
}

/** A line of hers, captioned: from `BELT_SAY[kind]`, or nothing if she spoke a moment ago (`force` says it anyway). */
function beltSay(kind, force = false) {
  const L = BELT_SAY[kind];
  if (!L || !L.length) return null;
  if (!force && beltClock - beltSaidAt < BELT_SAY.sayGap) return null;
  const [text, id] = L[Math.floor(Math.random() * L.length)];
  beltSaidAt = beltClock;
  const gloss = T('belt.g.' + id);
  if (voice && voice.sub) voice.sub(text, 2.6, gloss && gloss !== 'belt.g.' + id ? gloss : '');
  beltLog.said.push(text);
  if (beltLog.said.length > 12) beltLog.said.shift();
  return text;
}

/** The strap says it landed on her — see `onHit` in 43-belt.js. */
function beltLanded(h) {
  const r = jadrija && jadrija.beltHit ? jadrija.beltHit(h, camera.position) : null;
  const k = clamp((h.v - BELT.hit.pat) / (BELT.hit.top - BELT.hit.pat), 0, 1);
  // How hard past the crack, 0..1 — what the recorded crack and her answer scale with.
  const u = clamp((h.v - BELT.hit.crack) / (BELT.hit.top - BELT.hit.crack), 0, 1);
  if (audio && audio.beltCrack) audio.beltCrack(k, h.v >= BELT.hit.crack, u);
  beltLog.last = r;
  if (!r) return;
  beltLog.hits.push([beltLog.swings, r.reg || 'off:' + r.part, +h.v.toFixed(1)]);
  if (beltLog.hits.length > 64) beltLog.hits.shift();
  if (!r.reg) {
    beltLog.off++;
    if (h.v >= BELT.hit.crack && beltSay('off') && audio && audio.herHush) audio.herHush('line');
    return;
  }
  if (r.landed) beltLog.landed++;
  if (r.crack) beltLog.lashes++; else beltLog.pats++;
  sceneHit('belt', !r.crack ? 0 : u >= 0.5 ? 2 : 1, r.reg);
  // The meter, and what she makes of it.
  beltHeat += r.crack ? 0.2 + r.u : 0.03;
  if (beltHeat > BELT_HAND.red) { beltSafeword('her'); return; }
  if (beltHeat > BELT_HAND.yellow && !beltYellow) {
    beltYellow = true; beltLog.yellow++;
    beltSay('yellow', true);
    if (audio && audio.herHush) audio.herHush('line');
    return;
  }
  beltReact(r.crack, u);
}

/**
 * HER ANSWER to a lash that landed where it should: ONE of a line (captioned,
 * `BELT_SAY`), her moan straight after it, a gasp a second or two later
 * (Misha's, 1.552.1 — `audio.herGasp`), or nothing, drawn by `BELT_REACT`'s
 * weights at the lightest crack and the hardest (`u`), so the harder it is
 * the likelier the gasp. Whatever she did last time counts `again` as much,
 * so it does not settle into a pattern. One of the four and never two: a
 * gasp is her voice and so is a line. Any line of hers here — this one, the
 * yellow, "not there" — drops a gasp still waiting from the blow before and
 * fades a moan still sounding (`herHush('line')`). A pat is a line or
 * nothing, and one time in ten a short, quiet gasp.
 */
const BELT_REACT = {
  pat: { line: [1, 1], moan: [0, 0], gasp: [0.2, 0.2], none: [0.8, 0.8] },
  crack: { line: [1, 1], moan: [1, 0.5], gasp: [0.6, 1.8], none: [0.5, 0.2] },
  again: 0.5,
};
let beltReactLast = null;
function beltReact(crack, u) {
  const W = BELT_REACT[crack ? 'crack' : 'pat'];
  const canSay = beltClock - beltSaidAt >= BELT_SAY.sayGap;
  const kinds = ['line', 'moan', 'gasp', 'none'];
  const w = kinds.map((kd) => {
    let v = W[kd][0] + (W[kd][1] - W[kd][0]) * (crack ? u : 0);
    if (kd === 'line' && !canSay) v = 0;
    if (kd === beltReactLast && kd !== 'none') v *= BELT_REACT.again;
    return v;
  });
  let x = Math.random() * w.reduce((a, b) => a + b, 0), pick = 'none';
  for (let i = 0; i < kinds.length; i++) if ((x -= w[i]) < 0) { pick = kinds[i]; break; }
  let did = false;
  if (pick === 'line') {
    did = !!beltSay(crack ? 'crack' : 'pat');
    if (did && audio && audio.herHush) audio.herHush('line');
  } else if (pick === 'moan') did = !!(audio && audio.herMoan && audio.herMoan());
  else if (pick === 'gasp') did = !!(audio && audio.herGasp && audio.herGasp(crack ? u : 0, !crack));
  if (!did) pick = 'none';
  beltReactLast = pick;
  beltLog.react[pick]++;
  return pick;
}

/** The press, with the belt in your hand: down, winding up; up, the swing. */
function beltPress(down) {
  if (down) {
    if (!(beltPh === 'hold' || beltPh === 'back' || beltPh === 'through')) return;
    beltPh = 'wind'; beltT = 0; beltHeld = 0; beltPressed = true;
    beltFrom.copy(beltAt);
    beltPlan();
    return;
  }
  if (beltPh !== 'wind' || !beltPressed) return;
  beltPressed = false;
  beltStrike();
}

/**
 * THE SWING'S PLANE. What makes a strap land where it was aimed is that the
 * hand moves in the plane it is to land in: it unrolls along the way it was
 * going, and anything across that is where it goes wide (MEASURED, a swing
 * from over the eye's right to the middle of the view landed on her far
 * thigh, her shoulder or nothing in six of eight). So the whole swing is in
 * the upright plane through your right shoulder and the point aimed at: the
 * wind-up above and behind the stop, the stop a strap's reach short of her
 * along that line, and the path between them over the top.
 */
function beltPlan() {
  beltFrames();
  const O = _bO;
  const hit = jadrija && jadrija.cotAim ? jadrija.cotAim(O, _bF) : null;
  if (hit && !hit.miss) beltAim.set(hit.x, hit.y, hit.z);
  else if (beltAimAtButt && jadrija && jadrija.butt && jadrija.butt()) {
    const b = jadrija.butt();
    beltAim.set((b[0].x + b[1].x) / 2, (b[0].y + b[1].y) / 2, (b[0].z + b[1].z) / 2);
  } else beltAim.copy(O).addScaledVector(_bF, 1.3);
  const H = BELT_HAND;
  // The shoulder: right of the eye and under it.
  _bY.set(O.x + _br.x * H.shoulder[0], O.y + H.shoulder[1], O.z + _br.z * H.shoulder[0]);
  _bD.subVectors(beltAim, _bY);
  const d = _bD.length();
  _bD.multiplyScalar(1 / Math.max(d, 1e-6));
  beltTo.copy(_bY).addScaledVector(_bD, clamp(d - H.strapReach, H.reachOut[0], H.reachOut[1]));
  // Back, level, from the stop toward you.
  _bZ.set(-_bD.x, 0, -_bD.z);
  if (_bZ.lengthSq() < 1e-6) _bZ.set(-_bf.x, 0, -_bf.z);
  _bZ.normalize();
  beltBack.copy(_bZ);
  // Square to the swing: the strap's width lies across it.
  beltAcross.set(-_bZ.z, 0, _bZ.x);
  // The last of the path is straight down that line, so the strap unrolls
  // along it and its tongue arrives where the line meets her.
  beltTop.copy(beltTo).addScaledVector(_bD, -H.over);
  beltTop.y += H.overUp;
  beltWind.copy(beltTop).addScaledVector(_bZ, H.windBack);
  beltWind.y += H.windUp2;
}
function beltStrike() {
  beltPlan();
  beltCharge = clamp(beltHeld / BELT_HAND.full, 0, 1);
  beltFrom.copy(beltAt);
  beltPh = 'strike'; beltT = 0;
  beltLog.swings++;
  if (belt && BELT.guide > 0) belt.aim([beltAim.x, beltAim.y, beltAim.z]);
  if (audio && audio.beltSwish) audio.beltSwish(0.3 + 0.7 * beltCharge);
}
const beltWind = new THREE.Vector3(), beltTop = new THREE.Vector3(), beltBack = new THREE.Vector3();
const beltAcross = new THREE.Vector3(1, 0, 0);
let beltAimAtButt = false;       // debug: a probe's swing goes for her bottom, crosshair or not
let beltLetGo = -1;              // debug: a probe's press, let go after this long held
let beltRehang = false;          // debug: hang the strap afresh at the hand (after a teleport)

/**
 * Once a frame, before the arms are posed: where your hand is and which way
 * the strap leaves it, and the strap laid, when it is being drawn or fed.
 */
function beltHandTick(dt) {
  beltClock += dt;
  if (beltLock > 0) beltLock -= dt;
  beltHeat *= Math.exp(-dt / BELT_HAND.cool);
  if (beltHeat < 0.6) beltYellow = false;
  // THE AFTERCARE: once it is back on, your hand goes to her, and she thanks
  // you. Lying on her front, you kneel by the cot (the crouch, Shift's) and
  // lay the flat of your hand on her bottom where it stung, slowly round
  // (`rub`, BELT_HAND.rub) — the petting of her hair cannot reach a head on
  // a pillow from a standing eye (its reach is 0.95 m and hers is 1.1 down),
  // and standing, a hand on her bottom is an arm straight down the view.
  // Any other way, "pet her", which is the room's own.
  let rubbing = false;
  if (beltAfter && beltPh === 'off') {
    beltAfter.t += dt;
    if (!beltAfter.how && beltAfter.t > 0.15) {
      const sh = jadrija && jadrija.show ? jadrija.show() : null;
      const prone = !!(sh && (sh.phase === 'flatheld' || sh.phase === 'edgeHeld'));
      beltAfter.how = prone && jadrija.butt && jadrija.butt() ? 'rub' : 'pet';
      if (beltAfter.how === 'pet' && jadrija && jadrija.askShow) jadrija.askShow('pet');
      if (beltAfter.how === 'rub' && ground && ground.you) {
        beltAfter.knelt = !!ground.you.crouch;
        ground.you.crouch = true;
      }
      beltLog.after = beltAfter.how;
    }
    if (beltAfter.how === 'rub' && beltAfter.t < BELT_HAND.rub.secs) {
      const b = jadrija.butt ? jadrija.butt() : null;
      if (b) {
        rubbing = true;
        // Over the cheek on your side of her, round and round a little.
        const O = camera.position;
        const d0 = Math.hypot(b[0].x - O.x, b[0].z - O.z), d1 = Math.hypot(b[1].x - O.x, b[1].z - O.z);
        const c = d0 < d1 ? b[0] : b[1];
        const R = BELT_HAND.rub, w = beltAfter.t * Math.PI * 2 / R.period;
        _bD.set(c.x - O.x, 0, c.z - O.z).normalize();
        beltRubAt.set(c.x + _bD.x * R.r * Math.cos(w) - _bD.z * R.r * Math.sin(w), c.y + R.off,
          c.z + _bD.z * R.r * Math.cos(w) + _bD.x * R.r * Math.sin(w));
        // And your eyes on her, gently.
        if (ground && ground.you) {
          const Y = ground.you, hd = Math.hypot(c.x - O.x, c.z - O.z);
          const want = Math.atan2(c.y - O.y, Math.max(hd, 0.05));
          Y.pitch += (want - Y.pitch) * (1 - Math.exp(-3 * dt));
        }
      }
    } else if (beltAfter.how === 'rub' && !beltAfter.rose && beltAfter.t >= BELT_HAND.rub.secs) {
      // Up again, unless you were kneeling before it.
      beltAfter.rose = true;
      if (ground && ground.you && !beltAfter.knelt) ground.you.crouch = false;
    }
    if (!beltAfter.said && beltAfter.t > 1.6) { beltAfter.said = true; beltSay('after', true); }
    if (beltAfter.t > BELT_HAND.rub.secs + 0.5) beltAfter = null;
  }
  beltRubK = damp(beltRubK, rubbing ? 1 : 0, rubbing ? 3.0 : 5, dt);
  if (beltPh === 'off') { beltK = damp(beltK, 0, 8, dt); return; }
  if (beltPlace()) { beltSnap(); return; }
  beltFrames();
  beltT += dt;
  const H = BELT_HAND, L = BELT.len;
  const fast = beltFast ? H.fast : 1;
  const hold = beltPoint(H.hold, _bY.set(0, 0, 0).clone());
  const holdDir = _bD.copy(_bU).multiplyScalar(-1).addScaledVector(_bF, 0.25).normalize().clone();
  const waist = beltPoint(H.waist, new THREE.Vector3(), true);
  let dir = holdDir;
  if (beltPh === 'reach') {
    beltK = smooth01(beltT / H.reach);
    beltGrip = smooth01((beltT - H.reach * 0.6) / (H.reach * 0.4));
    beltAt.copy(waist);
    dir = _bD.set(-_br.x, 0, -_br.z).clone();
    if (beltT >= H.reach) { beltPh = 'draw'; beltT = 0; beltExit.copy(waist); }
  } else if (beltPh === 'draw') {
    beltK = 1; beltGrip = 1;
    const u = smooth01(beltT / H.draw);
    // Out and up to the side, then in to where you hold it.
    const mid = waist.clone().addScaledVector(_bR, 0.30).addScaledVector(_bU, 0.12);
    if (u < 0.5) beltAt.lerpVectors(waist, mid, smooth01(u * 2)); else beltAt.lerpVectors(mid, hold, smooth01(u * 2 - 1));
    const out = L * smooth01(beltT / (H.draw * 0.9));
    belt.lay(beltSag(beltAt, beltExit, out), out, [_bR.x, _bR.y, _bR.z], dt);
    if (you && you.belt) you.belt(1 - out / L);
    if (beltT >= H.draw) {
      if (you && you.belt) you.belt(0);
      beltAttitude(beltAt.clone().sub(beltExit).multiplyScalar(-1), beltQ);
      belt.release(beltAt, beltQ);
      beltPh = 'hold'; beltT = 0;
    }
  } else if (beltPh === 'hold') {
    beltK = 1; beltGrip = 1;
    beltAt.copy(hold);
  } else if (beltPh === 'wind') {
    beltHeld += dt;
    if (beltLetGo >= 0 && beltHeld >= beltLetGo) { beltLetGo = -1; beltPress(false); }
    if (beltPh === 'wind') {
      beltAt.lerpVectors(beltFrom, beltWind, smooth01(beltT / H.windUp));
      // The strap back over your shoulder, the way it will come forward.
      dir = beltBack.clone().multiplyScalar(0.7).add(new THREE.Vector3(0, 0.7, 0)).normalize()
        .lerp(holdDir, 1 - smooth01(beltT / H.windUp)).normalize();
    }
    // Held right up: the swing goes on its own — nobody holds a wind-up for ever.
    if (beltHeld > H.full + 0.6) { beltPressed = false; beltStrike(); }
  } else if (beltPh === 'strike') {
    // A click and not a hold is a lazy swing, most of a second from over
    // your shoulder to her — and lands as a pat (BELT.hit).
    const dur = H.strike[0] + (H.strike[1] - H.strike[0]) * Math.pow(beltCharge, 0.7);
    const u = clamp(beltT / dur, 0, 1);
    // Over the top and down, accelerating all the way: fastest as it arrives.
    // A quadratic from where the hand is through `beltTop` to the stop.
    const w = u * u, a = (1 - w) * (1 - w), b = 2 * w * (1 - w), c = w * w;
    beltAt.set(a * beltFrom.x + b * beltTop.x + c * beltTo.x, a * beltFrom.y + b * beltTop.y + c * beltTo.y,
      a * beltFrom.z + b * beltTop.z + c * beltTo.z);
    const back = beltBack.clone().multiplyScalar(0.7).add(new THREE.Vector3(0, 0.7, 0)).normalize();
    const at = new THREE.Vector3().subVectors(beltAim, beltTo).normalize();
    // And the wrist turns over late, which is the crack.
    dir = back.lerp(at, u * u * u).normalize();
    if (u >= 1) { beltPh = 'through'; beltT = 0; beltFrom.copy(beltAt); }
  } else if (beltPh === 'through') {
    const u = smooth01(beltT / H.through);
    const to = beltTo.clone().addScaledVector(_bD.subVectors(beltAim, _bO).normalize(), 0.08)
      .add(new THREE.Vector3(0, -0.16, 0));
    beltAt.lerpVectors(beltFrom, to, u);
    dir = new THREE.Vector3().subVectors(beltAim, beltTo).normalize().lerp(new THREE.Vector3(0, -1, 0), u).normalize();
    if (beltT >= H.through) { beltPh = 'back'; beltT = 0; beltFrom.copy(beltAt); }
  } else if (beltPh === 'back') {
    const u = smooth01(beltT / H.back);
    beltAt.lerpVectors(beltFrom, hold, u);
    dir = new THREE.Vector3(0, -1, 0).lerp(holdDir, u).normalize();
    if (beltT >= H.back) { beltPh = 'hold'; beltT = 0; }
    if (belt && belt.aiming && beltT > 0.15) belt.aim(null);
  } else if (beltPh === 'toWaist') {
    const u = smooth01(beltT / (H.toWaist * fast));
    beltAt.lerpVectors(beltFrom, waist, u);
    if (beltT >= H.toWaist * fast) {
      beltPh = 'feed'; beltT = 0;
      beltExit.copy(beltPoint(H.feed, new THREE.Vector3(), true));
      // The buckle done up: the unbuckle clips in their own turn, the clink halfway through `buckle`.
      if (audio && audio.beltBuckle) audio.beltBuckle((H.feedIn + H.buckle * 0.5) * fast, true);
    }
  } else if (beltPh === 'feed') {
    beltAt.copy(waist);
    const T = H.feedIn * fast, u = smooth01(beltT / T);
    const out = L * (1 - u);
    beltExit.copy(beltPoint(H.feed, new THREE.Vector3(), true));
    belt.lay(beltSag(beltAt, beltExit, Math.max(out, 0.001)), out, [_bR.x, _bR.y, _bR.z], dt,
      clamp(beltT / 0.15, 0.2, 1));
    if (you && you.belt) you.belt(1 - out / L);
    if (beltT >= T) { beltPh = 'buckle'; beltT = 0; belt.hide(); if (you && you.belt) you.belt(1); }
  } else if (beltPh === 'buckle') {
    beltAt.copy(waist);
    beltK = 1 - smooth01(beltT / (H.buckle * fast));
    beltGrip = beltK;
    if (beltT >= H.buckle * fast) { beltPh = 'off'; beltK = 0; beltGrip = 0; }
  }
  if (belt) belt.setDrag(beltPh === 'wind' ? BELT.windDrag : BELT.drag);
  const swinging = beltPh === 'wind' || beltPh === 'strike' || beltPh === 'through';
  beltAttitude(dir, beltQ, swinging ? beltAcross : _bR);
}

/** Once a frame, after she is posed: the strap solved against her and the cot. */
function beltSimTick(dt) {
  if (!belt || belt.mode !== 'sim') return;
  if (beltRehang) {
    beltRehang = false;
    // Back toward you and level: a strap hung straight down from a hand
    // that has just been put over her would start inside her, and a contact
    // found that deep is refused (`deep`) — it would hang through her.
    belt.hang(beltAt, beltQ, [-_bf.x, 0.1, -_bf.z], [_bR.x, _bR.y, _bR.z]);
  }
  const w = jadrija && jadrija.beltWorld ? jadrija.beltWorld() : { caps: null, n: 0, boxes: null, nb: 0 };
  const floor = ground && ground.you ? ground.you.y : _bO.y - 1.66;
  belt.world(w.caps || [], w.n, w.boxes, w.nb, floor);
  belt.step(dt, beltAt, beltQ);
}

function beltStats() {
  const s = belt ? belt.stats : null;
  return { ph: beltPh, k: +beltK.toFixed(2), mode: belt ? belt.mode : 'none',
    heat: +beltHeat.toFixed(2), lock: +Math.max(0, beltLock).toFixed(1), charge: +beltCharge.toFixed(2),
    ms: s ? +s.ms.toFixed(3) : 0, msAvg: s ? +(s.msSum / Math.max(1, s.frames)).toFixed(3) : 0,
    msMax: s ? +s.msMax.toFixed(3) : 0, steps: s ? s.steps : 0, contacts: s ? s.contacts : 0,
    onHer: s ? s.onHer : 0, tip: s ? +s.tip.toFixed(2) : 0, vMax: s ? +s.vMax.toFixed(2) : 0,
    rescues: s ? s.rescues : 0, strap: s ? s.last : null,
    log: { ...beltLog, safe: { ...beltLog.safe }, said: beltLog.said.slice(), hits: beltLog.hits.slice(),
      react: { ...beltLog.react } } };
}

// ── THE COLLAR AND THE LEASH, IN YOUR HAND ───────────────────────────────────
//
// 1.553.0. Misha, 30 Sep 2026: *"putting on the black collar with a diamond
// leash/chain, which we can pull ... we need to be able to yank the collar
// around and lead her, even outside kabine, perhaps to the back where the
// hammock is. should also be possible to later take off the collar"*. The
// chain and the collar are 43-leash.js; what she does on the end of it is
// `leashStep` in 43-jadrija.js; this is your hand and the game round it.
//
// THE BELT'S KIND OF SCENE, and the belt's rules: two adults playing; she
// takes it laughing (`COLLAR_SAY`); and the SAFEWORD — "red" / "crvena" /
// "stop" — takes the collar off at once, fast, and then comes the aftercare
// (the belt's own lines and your hand in her hair).
//
// THE CONTROLS: `=` or "collar" / "ogrlica" and she comes to you, kneels up,
// and your hands put it on her — the strap round her neck from the buckle,
// buckled, the leash clipped to the ring at her throat — and she goes down
// on all fours. Walk, and she follows on your trail at the leash's length
// (you walk at a lead's pace, and the leash holds you if you get ahead of
// her: `tether`). The click is a tug: held, it winds up, and let go your
// hand draws back until the chain is taut and past it — harder the longer
// you held it, and harder again if the mouse was moving (`flick`). "Get in
// the hammock" at the hammock lets her off the leash into it; out of it she
// is back on all fours on the end of it. `=` again, or "take off the collar"
// / "skini ogrlicu", and she gets up and your hands take it off.
//
// AND WHICH WAY (1.554.0). A firm tug (held a quarter second, or flicked)
// with the mouse moved UP while it is held brings her up a step — all fours
// to her knees, her knees to her feet, and from her knees or feet beside the
// cot, on to it; moved DOWN, down a step (`flickY`). A firm pull toward the
// cot takes her there from anywhere near it. On the cot a tug lifts her head
// and shoulders to you (her side's `cotTug`), up is her knees on it, down her
// front, and a firm pull from a step back has her off it. In the hammock a
// tug swings it to you, and a firm one has her out. The words are the same
// steps: "kneel", "stand up", "on all fours", "on the cot" (49-ears.js).
//
// THE BELT AND THE COLLAR ARE ONE HAND. The belt is held in your right hand
// and so is the leash: the belt will not come out while the leash is in it
// (`belt.collar`), and the collar will not go on while the belt is out
// (`collar.belt`). The safeword ends whichever of them is on.
const COLLAR = {
  // The loop in your fist while you lead her: at your right hip, in your LEVEL
  // frame (right, up from the eye, forward) — a lead is held low, and your
  // hip does not look down when you do.
  hold: [0.20, -0.62, 0.26],
  // A TUG. Held, it winds up over `full` s (a click is a quarter of one);
  // `flick` rad/s of the mouse turning you while it is held is another whole
  // one. The hand draws back along the leash (and `up` of that upward) until
  // the chain is at `taut` of its length and `past` beyond it (plus `more`
  // times how hard); the draw takes `rise` s, is held `peak`, goes back over
  // `fall`. Against your arm (`arm` N/m) the draw past taut is the force on
  // her ring, up to `F` N from a click to the hardest.
  // A tug with more slack in it than `most` of an arm steps you back by the
  // rest, up to `step`.
  yank: { full: 0.50, flick: 5.0, up: 0.35, taut: 0.985, past: 0.07, more: 0.10, most: 0.65, step: 0.45,
    rise: 0.07, peak: 0.10, fall: 0.38, arm: 1500, F: [45, 165],
    // UP OR DOWN (1.554.0): the mouse moved this many pixels up (or down)
    // while the button is held is a yank that way — `flickY`; and the hand
    // is drawn that much more up (`upY`), or down (`downY`), with it. How
    // FIRM it has to be to move her pose is her side's (LEASH_POSE.firm):
    // held a quarter second, or flicked.
    flickY: 30, upY: 1.1, downY: 0.55 },
  // Walking with her on it: your pace, m/s, and the leash's reach from her
  // ring to your feet, level, m — past it you are held.
  pace: 1.45, tether: 1.30,
  // After a safeword, seconds before the collar will go on again.
  lock: 3,
  // Her lines while she follows, outside, one in `every` s at the most.
  every: [14, 26],
};
// What she says, in her Croatian, and what it means (i18n `collar.g.*`).
const COLLAR_SAY = {
  on: [['Mm. Lijepo mi stoji?', 'on0'], ['Hehe. Sad sam tvoja.', 'on1'], ['Vodi me, ljubavi.', 'on2']],
  tug: [['Hej! Polako, hehe.', 'tug0'], ['Idem, idem!', 'tug1'], ['Mm, zločesta.', 'tug2']],
  yank: [['Ah! Hehe, jaka si.', 'yank0'], ['Joj! Dobro, dobro.', 'yank1'], ['Uh! ...Još jednom.', 'yank2']],
  lead: [['Kamo me vodiš?', 'lead0'], ['Hehe, svi nas gledaju.', 'lead1'], ['Mm, sporije, ljubavi.', 'lead2']],
  ham: [['Mreža? Može.', 'ham0']],
  // 1.554.0: a yank that moves her — up on her knees or her feet, down, on
  // to the cot.
  up: [['Mm, dobro, dobro.', 'up0'], ['Evo me, hehe.', 'up1'], ['Gore? Kako želiš.', 'up2']],
  down: [['Dolje? Hehe, dobro.', 'down0'], ['Mm... polako.', 'down1']],
  cot: [['Na krevet? Mm.', 'cot0'], ['Hehe, znam kamo me vodiš.', 'cot1']],
  off: [['Hvala ti. Opet sutra?', 'off0'], ['Mm... bilo je lijepo.', 'off1']],
  sayGap: 1.6,
};
let leashC = null;               // the chain, built the first time it is clipped on
let colK = 0, colGrip = 0;       // your hand on it: how far out, how shut
const colAt = new THREE.Vector3(), colHand = new THREE.Vector3(), colHold = new THREE.Vector3();
const colDir = new THREE.Vector3(0, -1, 0), colPull = new THREE.Vector3(), colFirst = new THREE.Vector3();
const _coA = new THREE.Vector3(), _coB = new THREE.Vector3(), _coC = new THREE.Vector3();
let colPressed = false, colHeld = 0, colFlick = 0, colYawWas = null;
let colMouseY = 0;               // the mouse's travel up (−) or down (+) while the tug is held, px
let colYank = null;              // { t, u, dir, D, landed, gest }
let colLock = 0, colClock = 0, colSaidAt = -9, colLeadNext = 16, colAfter = null;
let colArm = 0;                  // the third person's right arm swung by a tug, rad
let colWalk = null;              // debug: a walk for a probe — see `__fr.collar.walk`
let colHandBone = -1;
let colKnelt = null;             // crouched for the putting on, and whether you already were
let colAfterK = 0;               // the aftercare's hand in her hair, 0..1
const colAfterAt = new THREE.Vector3();
const colLog = { asked: 0, on: 0, off: 0, tugs: 0, landed: 0, Fmax: 0, safe: 0, said: [], why: null,
  held: 0, tetherHits: 0, did: null, dids: {}, lastPress: null, poses: 0 };

/** The leash as her side of it stands, or null. */
const collarState = () => (jadrija && jadrija.leashState ? jadrija.leashState() : null);
/** Whether the collar is on her at all — for "stop" meaning it, and for the belt. */
function collarActive() { const s = collarState(); return !!(s && s.on); }
/**
 * Whether the press is a tug (1.554.0): clipped on, and not while it is going
 * on or coming off — on all fours, on her knees, on her feet, on the cot and
 * in the hammock alike. Through 1.553.0 this was 'following on all fours' only, which is
 * why the leash did nothing to her anywhere but following on all fours.
 */
function collarTuggable() {
  const s = collarState();
  return !!(s && s.on && s.clipped && s.offT == null
    && (s.mode === 'lead' || s.mode === 'cot' || s.mode === 'free')
    && s.phase !== 'leashCome' && s.phase !== 'leashKneel' && s.phase !== 'leashPut');
}

// ── WHAT THE TWO OF YOU ARE DOING, for her voice ────────────────────────────
//
// 1.553.1. Misha, 30 Sep 2026, in the middle of spanking her on the cot:
//
//   [ears] "am i spanking you?"
//   [ears] Baye · 0.5 m: "No, you ain't spanking me yet, sweetheart."
//
// Nothing the voice was sent said so. `/talk` carried where you were, what
// your feet were doing and which beat of her routine she was on — and not the
// slap, the belt, the collar, your hand on her or the safeword, so the model
// had "inside the beach hut" and improvised "not yet". This is that half, read
// off the live state, and it goes up with every line of hers (`context` in
// 49-voice.js), the ones she volunteers as well as the answers.
//
// NUMBERS AND KEYS, NEVER WORDS — the rule the whole service stands on: the
// page sends claims, and `clean_scene` in server/baye/baye.py clamps them and
// owns every word she is told. The slaps are kept as they land (`sceneHit`,
// from `buttSlap` and `beltLanded`), the tugs and the safeword likewise; the
// rest is what is true this frame.
const SCENE = {
  window: 60,           // s: "in the last minute" is what a hit counts in
  keep: 48,             // most hits remembered, all told
  safeFor: 600,         // s a safeword is still worth telling her about
  markK: 0.08,          // a flush or a lash this strong is a mark you can see
};
// Each hit [t s, 'hand'|'belt', hard 0 light / 1 firm / 2 hard, region].
const sceneLog = { hits: [], tugs: [], safe: null };
const sceneNow = () => performance.now() / 1000;
/** A slap or a lash that landed on her — `reg` 'butt' | 'back' | 'thigh' | 'hip'. */
function sceneHit(tool, hard, reg) {
  sceneLog.hits.push([sceneNow(), tool, hard, reg || 'butt']);
  if (sceneLog.hits.length > SCENE.keep) sceneLog.hits.shift();
}
/** The safeword, said — `who` 'you' | 'her', `of` 'belt' | 'collar'. */
function sceneSafe(who, of) { sceneLog.safe = { t: sceneNow(), who, of }; }

/**
 * Everything happening between you and her this second, as the keys
 * `clean_scene` accepts. Absent keys are things that are not happening; the
 * server prints no line for them.
 */
function sceneTalk() {
  const now = sceneNow(), o = {};
  const her = jadrija && jadrija.sceneHer ? jadrija.sceneHer() : null;
  if (her) Object.assign(o, her);
  if (o.worn && !o.worn.length) delete o.worn;
  if (!o.buzz) delete o.buzz;
  if (!o.on_cot) delete o.on_cot;
  // The hand and the belt, each: how many in the last minute, the last one's
  // seconds, the hardest, and where on her — most-hit first.
  for (const [tool, key, n] of [['hand', 'spank', 'spanks'], ['belt', 'lash', 'lashes']]) {
    const H = sceneLog.hits.filter((h) => h[1] === tool && now - h[0] <= SCENE.window);
    if (!H.length) continue;
    o[n] = H.length;
    o[key + '_ago_s'] = Math.round(now - H[H.length - 1][0]);
    o[key + '_hard'] = Math.max(...H.map((h) => h[2]));
    const by = {};
    for (const h of H) by[h[3]] = (by[h[3]] || 0) + 1;
    o[key + '_at'] = Object.keys(by).sort((a, b) => by[b] - by[a]);
  }
  if (beltInHand()) o.belt_out = true;
  if (beltYellow && beltActive()) o.belt_yellow = true;
  const L = collarState();
  if (L && L.on) {
    o.collar_on = true;
    if (L.clipped) o.leashed = true;
    if (L.clipped && L.mode === 'lead') o.leading = true;
  }
  const T = sceneLog.tugs.filter((t) => now - t <= SCENE.window);
  if (T.length) { o.tugs = T.length; o.tug_ago_s = Math.round(now - T[T.length - 1]); }
  // Your hands on her, this second.
  if (hairHeld) o.hair_pull = true;
  else if (petK > 0.5) o.petting = true;
  if (cupK > 0.5 && (reachKind === 'cup' || reachKind === 'hip' || reachKind === 'thigh')) {
    o.hand_on = reachKind === 'cup' ? 'breast' : reachKind;
  } else if (thumbK > 0.5 && reachKind === 'thumb') o.hand_on = 'mouth';
  // The marks on her skin, off the shader's own numbers: how many you can
  // see, and the reddest of them.
  const M = [...(typeof apprenticeSlapState === 'function' ? apprenticeSlapState() : []),
    ...(typeof apprenticeLashState === 'function' ? apprenticeLashState() : [])]
    .map((m) => m.k).filter((k) => k >= SCENE.markK);
  if (M.length) { o.marks = M.length; o.mark_k = +Math.max(...M).toFixed(2); }
  const S = sceneLog.safe;
  if (S && now - S.t <= SCENE.safeFor) {
    o.safeword_ago_s = Math.round(now - S.t);
    o.safeword_by = S.who;
    o.safeword_of = S.of;
  }
  if (beltAfter || colAfter) o.aftercare = true;
  return o;
}

/** A line of hers, captioned: from `COLLAR_SAY[kind]`, or nothing if she spoke a moment ago. */
function collarSay(kind, force = false) {
  const L = COLLAR_SAY[kind];
  if (!L || !L.length) return null;
  if (!force && colClock - colSaidAt < COLLAR_SAY.sayGap) return null;
  const [text, id] = L[Math.floor(Math.random() * L.length)];
  colSaidAt = colClock;
  const gloss = T('collar.g.' + id);
  if (voice && voice.sub) voice.sub(text, 2.6, gloss && gloss !== 'collar.g.' + id ? gloss : '');
  colLog.said.push(text);
  if (colLog.said.length > 12) colLog.said.shift();
  return text;
}

/**
 * "collar", "take off the collar", "red" — and the key. Answers a word:
 * 'asked', 'off', 'stopped', or why not ('ground', 'belt', 'later', 'far',
 * 'collared', 'inhammock', 'swimming', 'not on', 'nobody').
 */
function collarCmd(what) {
  if (what === 'collar.key') what = collarActive() ? 'collar.off' : 'collar.on';
  if (what === 'collar.stop') {
    if (!collarActive()) return 'not on';
    colLog.safe++;
    sceneSafe('you', 'collar');
    jadrija.leashOff('you');
    colYank = null; colPressed = false;
    colLock = COLLAR.lock;
    // She heard it, and it is the belt's line: "Okay. Come here."
    if (typeof beltSay === 'function') beltSay('heard', true);
    colAfter = { t: 0, said: false };
    return 'stopped';
  }
  if (what === 'collar.off') {
    const got = jadrija && jadrija.leashOff ? jadrija.leashOff(null) : 'not on';
    if (got === 'off') colLog.off++;
    return got;
  }
  // HER POSE ON IT, SAID (1.554.0): "stand up", "kneel", "on all fours",
  // "on the cot" while it is on her — the words for what a firm yank does
  // (see `leashTug` in 43-jadrija.js). 'posed', or why not.
  const POSE = { 'collar.stand': 'stand', 'collar.kneel': 'kneel', 'collar.fours': 'fours', 'collar.cot': 'cot' };
  if (POSE[what]) {
    if (!collarActive()) return 'not on';
    const got = jadrija && jadrija.leashPose ? jadrija.leashPose(POSE[what]) : 'not on';
    if (got === 'ok') { colLog.poses++; return 'posed'; }
    return got;
  }
  // On.
  if (state.phase !== 'ground' || !ground || !ground.ok || !jadrija || !jadrija.askShow) return 'ground';
  if (typeof beltActive === 'function' && beltActive()) return 'belt';
  if (colLock > 0) return 'later';
  const sh = jadrija.show ? jadrija.show() : null;
  if (!sh) return 'nobody';
  const w = jadrija.toWorld(sh.t, sh.s);
  if (Math.hypot(w[0] - ground.you.x, w[2] - ground.you.z) > 25) return 'far';
  const got = jadrija.askShow('collar');
  if (got === true) { colLog.asked++; return 'asked'; }
  return typeof got === 'string' ? got : 'nobody';
}

/**
 * The press, with her on the leash: down winds a tug up, up lets it go. And
 * WHICH WAY (1.554.0): the mouse moved up while it is held is a yank up —
 * which, firm, brings her up a step — and down is down (`flickY`).
 */
function collarPress(down) {
  if (down) {
    if (!collarTuggable()) return;
    colPressed = true; colHeld = 0; colFlick = 0; colMouseY = 0;
    colYawWas = ground && ground.you ? ground.you.yaw : null;
    return;
  }
  if (!colPressed) return;
  colPressed = false;
  const Y = COLLAR.yank;
  const u = clamp(0.25 + 0.75 * Math.min(1, colHeld / Y.full) + colFlick / Y.flick, 0.2, 1);
  const gest = colMouseY < -Y.flickY ? 'up' : colMouseY > Y.flickY ? 'down' : null;
  colLog.lastPress = { u: +u.toFixed(2), held: +colHeld.toFixed(2), mouseY: Math.round(colMouseY), gest };
  collarTug(u, gest);
}

/**
 * A tug of `u` (0..1), and `gest` 'up' / 'down' / null: see COLLAR.yank. The
 * draw is decided against the leash as it hangs now — and drawn up or down
 * with the gesture, so the pull on her ring goes that way too.
 */
function collarTug(u, gest = null) {
  const s = collarState();
  if (!s || !s.clipped || !(s.mode === 'lead' || s.mode === 'cot' || s.mode === 'free')) return false;
  const Y = COLLAR.yank, len = LEASH.len;
  _coA.subVectors(colHand, s.ring);
  const span = _coA.length() || 1;
  _coA.multiplyScalar(1 / span);
  _coA.y += gest === 'up' ? Y.upY : gest === 'down' ? -Y.downY : Y.up;
  _coA.normalize();
  const want = Math.max(0.10, len * Y.taut - span) + Y.past + Y.more * u;
  const D = Math.min(Y.most, want);
  colYank = { t: 0, u, gest, dir: _coA.clone(), D, landed: false,
    step: Math.min(Y.step, Math.max(0, want - D)), stepped: 0 };
  colLog.tugs++;
  sceneLog.tugs.push(sceneNow());
  if (sceneLog.tugs.length > SCENE.keep) sceneLog.tugs.shift();
  if (gest) colLog[gest] = (colLog[gest] || 0) + 1;
  return true;
}

/** How far out along the tug your hand is at `t`, 0..1. */
function collarDraw(t) {
  const Y = COLLAR.yank;
  if (t < Y.rise) { const v = t / Y.rise; return v * v * (3 - 2 * v); }
  if (t < Y.rise + Y.peak) return 1;
  if (t < Y.rise + Y.peak + Y.fall) { const v = 1 - (t - Y.rise - Y.peak) / Y.fall; return v * v * (3 - 2 * v); }
  return 0;
}

/**
 * Once a frame, before the arms are posed: where your hand is — at her neck
 * while it goes on or comes off, at your hip holding the loop while you
 * lead her, drawn back in a tug — and the walk of a probe.
 */
function collarHandTick(dt) {
  const t0 = performance.now();
  collarHandTickIn(dt);
  colMs.hand = performance.now() - t0;
}
function collarHandTickIn(dt) {
  colClock += dt;
  if (colLock > 0) colLock -= dt;
  // A probe's walk: steer at the next point and hold W — see `__fr.collar.walk`.
  if (colWalk && ground && ground.you && jadrija) {
    const W = colWalk, Y = ground.you;
    const p = W.pts[W.i];
    const w = jadrija.toWorld(p[0], p[1]);
    const dx = w[0] - Y.x, dz = w[2] - Y.z, dl = Math.hypot(dx, dz);
    const key = W.back ? 'KeyS' : 'KeyW';
    if (dl < (W.i === W.pts.length - 1 ? 0.35 : 0.6)) {
      W.i++;
      if (W.i >= W.pts.length) { keys.delete(key); colWalk = null; }
    } else {
      // Facing the point, or — `back` — facing away from it and walking
      // backwards, which is how you watch her follow you.
      const want = W.back ? Math.atan2(dx, dz) : Math.atan2(-dx, -dz);
      let dy = want - Y.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      Y.yaw += dy * (1 - Math.exp(-8 * dt));
      if (W.pitch != null) Y.pitch = W.pitch;
      keys.add(key);
    }
    if (colWalk) colWalk.t += dt;
    if (colWalk && colWalk.t > colWalk.limit) { keys.delete(key); colWalk = null; }
  }
  // THE AFTERCARE, after a safeword: the belt's — she is up and standing
  // with you (her `care` in 43-jadrija.js), your hand in her hair, slowly
  // round, and her thanks. Your own hand and not the room's petting, which
  // is the kabina's alone (`petReach`): a safeword out by the hammock is
  // owed the same. A step in to her if she is out of reach.
  let caring = false;
  if (colAfter) {
    colAfter.t += dt;
    const s2 = collarState(), Y = ground && ground.you;
    if (s2 && s2.care && s2.head && Y && colAfter.t > 0.35) {
      caring = true;
      const hx = s2.head.x - Y.x, hz = s2.head.z - Y.z, hd = Math.hypot(hx, hz) || 1;
      const w = colAfter.t * Math.PI * 2 / 1.7;
      colAfterAt.set(s2.head.x - hx / hd * (0.03 + 0.03 * Math.cos(w)), s2.head.y + 0.10 + 0.012 * Math.sin(w),
        s2.head.z - hz / hd * (0.03 + 0.03 * Math.cos(w)));
      if (hd > 0.62 && ground.confine) {
        const step = Math.min(hd - 0.62, THUMB_WALK * dt);
        const [nx, nz] = ground.confine(Y.x + hx / hd * step, Y.z + hz / hd * step);
        Y.x = nx; Y.z = nz;
      }
      if (!bodyCam && !camOverride) {
        const O = camera.position;
        const wantYaw = Math.atan2(O.x - s2.head.x, O.z - s2.head.z);
        let dy = wantYaw - Y.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        Y.yaw += dy * (1 - Math.exp(-4 * dt));
        const wantPitch = Math.atan2(s2.head.y - 0.12 - O.y, Math.max(hd, 0.05));
        Y.pitch += (wantPitch - Y.pitch) * (1 - Math.exp(-4 * dt));
      }
    }
    if (caring && !colAfter.said && colAfter.t > 1.8) { colAfter.said = true; if (typeof beltSay === 'function') beltSay('after', true); }
    if (colAfter.t > 7) colAfter = null;
  }
  colAfterK = damp(colAfterK, caring ? 1 : 0, caring ? 3 : 5, dt);
  const s = collarState();
  const Yg = ground && ground.you;
  // OFF THE BEACH WITH IT IN YOUR HAND — into the sea, on to a bicycle, the
  // boat, the aeroplane: the leash is let go and the collar comes off her,
  // quickly, rather than her crawling after you into any of those.
  if (s && s.on && s.clipped && state.phase !== 'ground' && !s.offT && jadrija.leashOff) {
    jadrija.leashOff('away');
  }
  // AND A JUMP rather than a walk (the skip keys): her a stride behind you
  // wherever you have landed, not the leash dragging you back to her.
  if (s && s.clipped && (s.mode === 'lead' || s.mode === 'cot') && Yg && state.phase === 'ground'
    && Math.hypot(Yg.x - s.ring.x, Yg.z - s.ring.z) > COLLAR.tether + 2.5 && jadrija.leashSnap) {
    jadrija.leashSnap(Yg.x, Yg.z, Yg.yaw);
    Yg.tether = null;
  }
  if (!s || !s.on || state.phase !== 'ground') {
    colK = damp(colK, 0, 8, dt); colGrip = damp(colGrip, 0, 8, dt);
    colYank = null; colPressed = false; colArm = 0;
    if (Yg) { Yg.tether = null; Yg.lead = 0; }
    if (colKnelt && Yg) { if (!colKnelt.was) Yg.crouch = false; colKnelt = null; }
    return;
  }
  // Her words, when her side says something happened.
  const said = jadrija.leashSaid ? jadrija.leashSaid() : null;
  if (said === 'on') { colLog.on++; collarSay('on', true); }
  if (said === 'off') collarSay('off', true);
  if (said === 'ham') collarSay('ham', true);
  // DOWN TO HER, while it goes on: she kneels up a hand's width in front of
  // you, and from a standing eye her neck is past your arm's reach (0.82 m
  // from the shoulder against 0.56 of arm, MEASURED) — so you crouch, Shift's
  // own, and stand again once it is clipped. And as she goes down on all
  // fours her head comes forward half a metre, so you step back with the
  // loop in your hand while she does, and she is not left at your boots.
  const kneelNow = s.phase === 'leashKneel' || s.phase === 'leashPut';
  if (Yg) {
    if (kneelNow && !colKnelt) { colKnelt = { was: !!Yg.crouch }; Yg.crouch = true; }
    else if (!kneelNow && colKnelt) { if (!colKnelt.was) Yg.crouch = false; colKnelt = null; }
    if (s.phase === 'leashDown' && ground.confine) {
      const dx = Yg.x - s.ring.x, dz = Yg.z - s.ring.z, dl = Math.hypot(dx, dz);
      if (dl < 0.85 && dl > 1e-3) {
        const step = Math.min(0.85 - dl, 0.9 * dt);
        const [nx, nz] = ground.confine(Yg.x + dx / dl * step, Yg.z + dz / dl * step);
        Yg.x = nx; Yg.z = nz;
      }
    }
  }
  // YOUR EYES ON HER NECK while it goes on and comes off: she comes to you,
  // and a collar is put on somebody you are looking at — from wherever you
  // were facing when you asked, the view turns on to her (the thumb's rule).
  const looking = s.phase === 'leashKneel' || s.phase === 'leashPut'
    || (s.phase === 'leashCome' && s.neck.distanceToSquared(camera.position) < 2.2 * 2.2)
    || (s.offT != null && !s.fast && s.offT < 2.0);
  if (looking && Yg && !bodyCam && !camOverride) {
    const O = camera.position, hd = Math.hypot(s.neck.x - O.x, s.neck.z - O.z);
    const wantYaw = Math.atan2(O.x - s.neck.x, O.z - s.neck.z);
    let dy = wantYaw - Yg.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    Yg.yaw += dy * (1 - Math.exp(-4 * dt));
    const wantPitch = Math.atan2(s.neck.y - O.y, Math.max(hd, 0.05));
    Yg.pitch += (wantPitch - Yg.pitch) * (1 - Math.exp(-4 * dt));
  }
  beltFrames();
  const hold = beltPoint(COLLAR.hold, colHold, true);
  let target = hold, k = 0, grip = 0;
  // THE PUTTING ON: your hand to her neck on the side the strap starts
  // (her left, which is your right as you face her), round the front with
  // it, back to the buckle, and to the ring for the clip — see LEASH_ON.put.
  const path = (t, ks) => {
    let i = 1;
    while (i < ks.length - 1 && ks[i][0] < t) i++;
    const [t0, a] = ks[i - 1], [t1, b] = ks[i];
    const u = smooth01((t - t0) / Math.max(1e-3, t1 - t0));
    return _coB.copy(a).lerp(b, u);
  };
  const out = (p, d = 0.035) => _coC.copy(p).addScaledVector(s.fwd, d).clone();
  if (s.phase === 'leashPut') {
    const P = [[0, hold.clone()], [0.50, out(s.left, 0.01)], [0.95, out(s.neck, 0.02)], [1.30, out(s.right, 0.01)],
      [1.62, out(s.buckle, 0.0)], [2.18, out(s.ring, 0.02)], [2.85, hold.clone()]];
    target = path(s.putT, P);
    k = smooth01(s.putT / 0.35) * (1 - smooth01((s.putT - 2.45) / 0.45));
    grip = 0.55;
    if (s.clipped) { grip = 1; k = Math.max(k, 1); target = s.putT >= 2.85 ? hold : target; }
  } else if (s.offT != null && !s.fast) {
    // AND OFF: the clip at the ring, the buckle, the strap drawn round and
    // away — see LEASH_ON.off.
    const P = [[0, hold.clone()], [0.50, out(s.ring, 0.02)], [1.05, out(s.buckle, 0.0)],
      [1.45, out(s.neck, 0.02)], [1.80, out(s.right, 0.02)], [2.40, hold.clone()]];
    target = path(s.offT, P);
    k = smooth01(s.offT / 0.3) * (1 - smooth01((s.offT - 2.0) / 0.4));
    grip = 0.55;
  } else if (s.clipped) {
    k = 1; grip = 1;
  }
  // A TUG, while she is on it — in every pose (1.554.0, `collarTuggable`).
  if (s.clipped && s.offT == null && (s.mode === 'lead' || s.mode === 'cot' || s.mode === 'free')) {
    if (colPressed) {
      colHeld += dt;
      if (colYawWas != null && Yg) {
        let dy = Yg.yaw - colYawWas;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        colFlick = Math.max(colFlick, Math.abs(dy) / Math.max(dt, 1e-3));
        colYawWas = Yg.yaw;
      }
      colLog.held = +colHeld.toFixed(2);
      // Held right up, it goes on its own.
      if (colHeld > COLLAR.yank.full + 0.6) collarPress(false);
    }
    if (colYank) {
      colYank.t += dt;
      const e = collarDraw(colYank.t);
      target = _coA.copy(hold).addScaledVector(colYank.dir, colYank.D * e).clone();
      // A SLACK LEASH TAKES A STEP: her at your boots, the chain has more
      // slack than an arm can draw (0.72 m of span against 1.48, MEASURED on
      // all fours at your feet), so you step back with the tug by what the
      // arm is short of — the lean a yank is made with.
      const Y = COLLAR.yank;
      if (colYank.step > 0 && colYank.t < Y.rise + Y.peak && Yg && ground.confine) {
        const want = colYank.step * Math.min(1, colYank.t / (Y.rise + Y.peak));
        const d = want - colYank.stepped;
        if (d > 0) {
          const hx = colYank.dir.x, hz = colYank.dir.z, hl = Math.hypot(hx, hz) || 1;
          const [nx, nz] = ground.confine(Yg.x + hx / hl * d, Yg.z + hz / hl * d);
          Yg.x = nx; Yg.z = nz;
          colYank.stepped = want;
        }
      }
      if (colYank.t > Y.rise + Y.peak + Y.fall) colYank = null;
    }
  } else { colYank = null; colPressed = false; }
  colAt.copy(target);
  colK = damp(colK, k, 10, dt);
  colGrip = damp(colGrip, grip, 12, dt);
  // Which way the chain leaves your fist: toward her.
  if (s.clipped) colDir.subVectors(s.ring, colAt).normalize();
  // The third person has no arms of its own to send: the leash is in her
  // right hand wherever her walk has it, and a tug swings that arm.
  const e = colYank ? collarDraw(colYank.t) * colYank.D : 0;
  if (bodyCam && s.clipped) {
    const fx = -Math.sin(Yg.yaw), fz = -Math.cos(Yg.yaw);
    const along = colYank ? colYank.dir.x * fx + colYank.dir.z * fz : 0;
    colArm = clamp(along * e * 2.4, -0.9, 0.9);
  } else colArm = 0;
  // The leash's own reach, and your pace, while it is clipped on.
  if (Yg) {
    if (s.clipped && s.ring) {
      Yg.tether = { x: s.ring.x, z: s.ring.z, r: COLLAR.tether + (s.mode === 'free' || s.mode === 'cot' ? 0.25 : 0) };
      Yg.lead = s.mode === 'lead' ? COLLAR.pace : 0;
    } else { Yg.tether = null; Yg.lead = 0; }
  }
}

/** Her right hand in the third person, world, into `out` — or null. */
function collarThirdHand(out) {
  if (!you || !you.fig || !you.mesh) return null;
  if (colHandBone < 0) colHandBone = you.fig.boneIndex('handR');
  if (colHandBone < 0) return null;
  you.mesh.updateMatrixWorld();
  you.fig.boneAt(colHandBone, out).applyMatrix4(you.mesh.matrixWorld);
  out.y -= 0.035;
  return out;
}

/**
 * Once a frame, after she is posed: the chain between her ring and your
 * hand, solved against her; the pull on her ring off how far your hand is
 * past the chain's length; and a tug's lurch the moment it comes taut.
 */
function collarSimTick(dt) {
  const t0 = performance.now();
  collarSimTickIn(dt);
  // The whole of it this frame, your side and hers: the hand, the chain, the
  // pull, and her leash phase, collar and ragdoll (43-jadrija.js's timers).
  const live = !!(jadrija && jadrija.leashMs && (leashC && leashC.on || colK > 0.01));
  const ms = performance.now() - t0 + colMs.hand + (live ? jadrija.leashMs() : 0);
  if (live) { colMs.n++; colMs.sum += ms; colMs.max = Math.max(colMs.max, ms); colMs.last = ms; }
}
const colMs = { hand: 0, n: 0, sum: 0, max: 0, last: 0 };
function collarSimTickIn(dt) {
  const s = collarState();
  if (!s || !s.clipped || state.phase !== 'ground') {
    if (leashC && leashC.on) leashC.hide();
    if (jadrija && jadrija.leashPull) jadrija.leashPull(0);
    return;
  }
  if (!leashC) leashC = leashChain(scene);
  if (s.rehang) { leashC.rehang(); jadrija.leashRehung(); }
  // Your hand: the fist, or her right hand in the third person.
  // In the third person the hand is her right hand where her walk has it,
  // and a tug is that arm swung (`colArm`) and the loop drawn along with it
  // the rest of the way — her arm cannot reach back as far as the first
  // person's draws it.
  if (bodyCam) {
    if (!collarThirdHand(colHand)) colHand.copy(colAt);
    else if (colYank) colHand.addScaledVector(colYank.dir, colYank.D * collarDraw(colYank.t) * 0.8);
  } else colHand.copy(colAt);
  colHand.addScaledVector(colDir, 0.02);
  // The chain's reach from the ring: your hand past it is held at it, and
  // how far past is the draw against your arm.
  // Less whatever the chain has had to go round her to get here: wrapped
  // over her shoulder it is that much shorter, and your hand is held that
  // much nearer — or the tug stretches it round her in a loop of parted
  // links (PHOTOGRAPHED; see LEASH.slip, which is the backstop).
  const len = LEASH.len;
  const reach = len * COLLAR.yank.taut - Math.max(0, (leashC ? leashC.stats.stretchSum : 0) - 0.01);
  _coA.subVectors(colHand, s.ring);
  const span = _coA.length() || 1e-6;
  const past = Math.max(0, span - reach);
  const hand = span > reach ? _coB.copy(s.ring).addScaledVector(_coA, reach / span) : colHand;
  const w = jadrija.leashWorld();
  const floor = Math.min(s.feetY, ground && ground.you ? ground.you.y : s.feetY);
  leashC.step(dt, s.ring, hand, w.caps || new Float64Array(8), w.n, w.near, floor, w.boxes, w.nb || 0);
  // THE PULL ON HER RING: a tug's draw past taut against your arm, up to the
  // tug's strength; or, walked out ahead of her, the leash leaning her on.
  colPull.copy(_coA).multiplyScalar(1 / span);
  let F = 0;
  if (colYank) {
    // As hard as the tug is, once the chain is taut — from 90 % of its
    // length to 97 % it comes on; the draw past taut is where your hand
    // stops, held at the chain's reach. Against a draw alone (`arm` times
    // how far past), a tug from a leash with slack in it was two or three
    // centimetres past taut at best and landed as 20-40 N (MEASURED).
    const Y = COLLAR.yank, Fmax = Y.F[0] + (Y.F[1] - Y.F[0]) * colYank.u;
    const taut = clamp((span / reach - 0.92) / 0.07, 0, 1);
    F = Fmax * collarDraw(colYank.t) * taut;
    if (F > 20 && !colYank.landed) {
      colYank.landed = true;
      colLog.landed++;
      const did = jadrija.leashTug(colYank.u, colPull, colYank.gest);
      colLog.did = did;
      if (did) colLog.dids[did] = (colLog.dids[did] || 0) + 1;
      // Her line: for the step it asked of her if it was one (1.554.0), and
      // otherwise the tug's.
      const step = { up: 'up', down: 'down', cot: 'cot', cotKnees: 'up', cotFlat: 'down', offCot: 'up',
        hamOut: 'up' }[did];
      collarSay(step || (colYank.u > 0.6 ? 'yank' : 'tug'), !!step);
    }
  }
  // AND ONLY A TUG. A steady lean on the leash as you walk ahead of her was
  // tried (25-40 N from 94 % of its length) and it kept her ragdoll on for
  // the whole of a walk, where every corner she crawled round swung her
  // chest and head 40-75 degrees behind her hips (MEASURED, 100 ms samples
  // round the kabina): a net built for a woman kneeling still, carried
  // round a turn at a crawl. The chain comes taut on its own, and that is
  // what walking ahead of her looks like.
  colLog.Fmax = Math.max(colLog.Fmax, F);
  colLog.F = F;
  jadrija.leashPull(F, colPull, leashC.firstDir(colFirst));
  // And now and then, following you about outside, a word.
  const inKab = jadrija.kabina && jadrija.kabina.inside
    && jadrija.kabina.inside(ground.you.x, ground.you.z) > 0.5;
  if (s.mode === 'lead' && (s.phase === 'leashCrawl' || s.phase === 'leashWalk') && !inKab) {
    colLeadNext -= dt;
    if (colLeadNext <= 0) {
      colLeadNext = COLLAR.every[0] + Math.random() * (COLLAR.every[1] - COLLAR.every[0]);
      collarSay('lead');
    }
  }
}

function collarStats() {
  const s = collarState(), c = leashC ? leashC.stats : null;
  const info = jadrija && jadrija.leashInfo ? jadrija.leashInfo() : null;
  const rag = jadrija && jadrija.leashRag ? jadrija.leashRag() : null;
  return { on: !!(s && s.on), phase: s ? s.phase : null, mode: s ? s.mode : null,
    clipped: !!(s && s.clipped), collar: s ? +s.collar.toFixed(2) : 0,
    k: +colK.toFixed(2), grip: +colGrip.toFixed(2), yank: colYank ? +colYank.t.toFixed(2) : null,
    chain: c ? { ms: +c.ms.toFixed(3), msAvg: +(c.msSum / Math.max(1, c.frames)).toFixed(3), msMax: +c.msMax.toFixed(3),
      steps: c.steps, hangs: c.hangs, rescues: c.rescues, contacts: c.contacts, span: +c.span.toFixed(3),
      taut: +c.taut.toFixed(3), frames: c.frames } : null,
    rag: rag ? { on: rag.on, layer: rag.layer, ms: +rag.ms.toFixed(3), msAvg: +(rag.msSum / Math.max(1, rag.frames)).toFixed(3),
      msMax: +rag.msMax.toFixed(3), F: +rag.F.toFixed(1), Fmax: +rag.Fmax.toFixed(1), pitch: +rag.pitch.toFixed(1),
      pitchMax: +rag.pitchMax.toFixed(1), chest: +rag.chest.toFixed(1), chestMax: +rag.chestMax.toFixed(1),
      headD: +rag.headD.toFixed(3), headDMax: +rag.headDMax.toFixed(3), rescues: rag.rescues, why: rag.why, frames: rag.frames } : null,
    her: info, tether: ground && ground.you && ground.you.tether ? { r: ground.you.tether.r } : null,
    lock: +Math.max(0, colLock).toFixed(1), after: colAfter ? +colAfter.t.toFixed(1) : null,
    frame: { avg: +(colMs.sum / Math.max(1, colMs.n)).toFixed(3), max: +colMs.max.toFixed(3),
      last: +colMs.last.toFixed(3), n: colMs.n },
    log: { ...colLog, said: colLog.said.slice(), F: colLog.F ? +colLog.F.toFixed(1) : 0, Fmax: +colLog.Fmax.toFixed(1) } };
}

const THUMB_WALK = 1.3;      // m/s you step in at
let camMode = 0;
const camPos = new THREE.Vector3();
const camAim = new THREE.Vector3();
function cycleCamera() { camMode = (camMode + 1) % CAMS.length; }

// A fixed viewpoint for the screenshot tool, so a shot of a building is a shot
// of a building and not of wherever the aeroplane drifted to while it settled.
let camOverride = null;
// Seconds of world per frame while filming, or 0 for wall time. See `frame()`.
let filmDt = 0;
// One-frame-at-a-time filming: how many passes the recorder still wants, and
// who to tell when the next one has finished drawing. See `__fr.filmStep`.
let filmWant = 0;
let filmDone = null;

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
  mirror, mirrorP, swim, under, seabed, arms, mask, kites, ride, chase, you,
  brod, ao, backlane, backlaneCars, plunge, crabs;
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
  // The settings panel is the only place the build stamp is still reachable
  // once the title screen is gone, which is when you most want to check it.
  // On foot, every control the flight version names is either meaningless or
  // attached to an aeroplane you are standing next to.
  $('panel-foot').textContent = (state.phase === 'ground'
    ? TK('set.footGround', 'set.footTouch')
    : TK('set.foot', 'set.footTouch')) + ' · v' + BUILD.v;
  $('pause').querySelector('.hint').innerHTML = TK('pause.hint', 'pause.hintTouch');
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
  // A null key is a step with nothing to say — the last one — and it clears
  // the line rather than printing whatever T() makes of null.
  onLangChange(() => { stageEl.textContent = stageKey ? T(stageKey) : ''; });
  const step = async (pct, key) => {
    bar.style.width = pct + '%';
    stageKey = key;
    stageEl.textContent = key ? T(key) : '';
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
  bakeRipple(renderer);
  sea = buildSea(scene);
  under = buildUnder(scene);
  seabed = buildBed(scene);
  ride = buildRide(scene);
  brod = buildBrod(scene);
  chase = await buildChase(scene);

  await step(74, 'load.stone');
  resolveLandmarks();
  landmarks = await buildLandmarks(scene);

  await step(78, 'load.city');
  // Jadrija first: it claims the footprints it is going to rebuild in detail,
  // and the town builder has to know about that before it draws them.
  jadrija = await buildJadrija(scene);
  // The collision blip. Hung on here rather than inside 43-jadrija.js because
  // the mixer lives in this file and reaching down the concatenation for it
  // from up there is Rule 3 waiting to happen.
  if (jadrija && jadrija.setThud) jadrija.setThud(() => { if (audio) audio.nudge(); });
  // The crabs on the rocks at the water — 44-crabs.js. Built on the shore's
  // own surfaces, so after it; nothing is baked until you come near them.
  crabs = jadrija ? buildCrabs(scene, jadrija) : null;
  // Where she lies is a pair of degrees now — the Brod, on the far side of the
  // spit — so this no longer waits on the shore having been traced. It stays
  // here because the quay is masonry in the same scene and the loading order
  // is the order things appear.
  if (brod) brod.moor();
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
  // The back lane, and the plots along it. After the town rather than before
  // it, because it is an overlay on ground the town builder has already had its
  // say about — see src/46-backlane.js. Its blockers go straight into the
  // locale's own list, which `47-ground.js` has not read yet.
  backlane = buildBackLane(scene, jadrija, city);
  backlaneCars = backlane && backlane.sites.length
    ? await buildJadrijaCars(scene, backlane.sites) : null;

  await step(80, 'load.streets');
  airfield = buildAirfield(scene);
  // The aerodrome is the one place in the game you stand still and look at the
  // ground, so it is the one place a missing shadow is obvious. Static casters:
  // a hangar does not move.
  shadow.cast(airfield.buildings);
  shadow.cast(airfield.objMesh);
  // The resort's own trees are drawn with the landscape's tree material
  // (`arbor` in 43-jadrija.js), and cast with its depth program for the same
  // reason the landscape does: a dappled crown throws a dappled shadow.
  if (jadrija) {
    for (const m of jadrija.casters) {
      shadow.cast(m, m.userData.tree ? { material: treeCaster(shadow, false) } : {});
    }
  }
  // Each also into the kabina pendant's own map (1.552.1) — see `lampAdd`.
  if (jadrija) for (const m of jadrija.castersLive || []) shadow.lampAdd(shadow.cast(m, { dynamic: true }));
  // The skinned figure brings her own depth material, because her shape lives
  // in a bone palette that the two shared ones know nothing about. Near
  // cascade: she is 1.75 m and the far map cannot draw anything under two.
  if (jadrija && jadrija.figure && jadrija.figureCasts !== false) {
    shadow.lampAdd(jadrija.figure.cast(shadow));
  }
  // v2.0 is the one drawn when she is primary, and she casts no sun shadow
  // (see BAYE in 46-apprentice.js) — but under the kabina's pendant a body
  // with no shadow is a body pasted on the floor. Into the lamp's map only:
  // her sun proxy is taken straight back out of the cascades (1.552.1).
  if (jadrija && jadrija.figureCasts === false && appr && appr.cast) {
    const px = appr.cast(shadow);
    if (px && px.parent) px.parent.remove(px);
    shadow.lampAdd(px);
  }
  // The same for the Bucketeer, plus the bucket — which is not skinned and is
  // the one thing she is carrying that a missing shadow would show up on,
  // because half of her loop is spent standing on a sunlit porch with it.
  if (jadrija && jadrija.bucketeer) {
    jadrija.bucketeer.fig.cast(shadow);
    // `castTree`, because the pail and its bail turn against each other and are
    // two meshes on one group. Near cascade, like everything under two metres.
    shadow.castTree(jadrija.bucketeer.pail, { dynamic: true, near: true });
  }
  // And the two things on her that are not skinned. `syncMoving` reads the
  // source mesh's `visible` every frame, so before the turn — when they are
  // hidden — they cast nothing.
  if (jadrija) {
    for (const m of jadrija.horns) shadow.cast(m, { dynamic: true, near: true });
  }
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
    // And the good ones, which are not instanced and cannot share either of
    // the two depth materials: a skinned figure's shape is in a bone palette
    // and the depth pass has to be handed it too. See `shadows` in 42-crowd.js
    // for why this is only now worth what it costs.
    if (jadrija.crowd.shadows) jadrija.crowd.shadows(shadow);
    // And the row parked in the wood. These used to be baked into `upMesh` and
    // so cast into both cascades; instanced and near-only is the same deal the
    // town's cars get, and a car is nine texels across in the far map.
    for (const m of jadrija.carMeshes || []) {
      shadow.cast(m, { instanced: true, near: true });
    }
  }
  if (backlane) {
    for (const m of backlane.casters) shadow.cast(m);
    if (backlaneCars) {
      for (const m of backlaneCars.meshes()) {
        shadow.cast(m, { instanced: true, near: true });
      }
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
    // And the cat, who is a third guest and answers nothing like the second.
    // A wet dog stands in it and shakes at you; a wet cat is gone. See
    // `catWet`.
    ground.addGuest(jadrija.catProbe, jadrija.catWet);
    // And the six people nearest you on the sand, who answer out loud. One
    // guest per slot and not one per bather: there are four hundred and fifty
    // of them and `traceJet` reads every guest once a trace.
    for (const [probe, wet] of jadrija.batherGuests) ground.addGuest(probe, wet);
    // And the café sitters, whom the jet PUSHES — see `HOSE` in 43-jadrija.js.
    if (jadrija.sitterGuests) for (const [probe, wet] of jadrija.sitterGuests) ground.addGuest(probe, wet);
    // And the riders, off their bicycles and scooters — see `THEFT` there.
    if (jadrija.riderGuests) for (const [probe, wet] of jadrija.riderGuests) ground.addGuest(probe, wet);
    // And the transistor set on the table in the kabina, which is a guest in
    // the same sense: something in the world the jet can land on that the hose
    // code has no business knowing anything else about.
    ground.addGuest(jadrija.radioProbe, jadrija.radioWet);
    // And the television beside it, which answers the same way for the same
    // reason: each hit knocks the knob round one channel, and the last position
    // on the dial is the end of the band.
    ground.addGuest(jadrija.tvProbe, jadrija.tvWet);
    // And the Bucketeer, who was the one person on this shore the jet went
    // straight through. Her own two ends and not `figureProbe`'s: she is built
    // by 45-bucketeer.js, she is only a target for the half of her loop she is
    // outdoors for, and `buckProbe` is what knows which half that is.
    if (jadrija.bucketeer && jadrija.bucketeer.probe) {
      ground.addGuest(jadrija.bucketeer.probe, jadrija.bucketeer.onWet);
    }
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
      // The near model with the foliage's own depth program, which opens the
      // same tufts in the shadow that it opens in the crown — see
      // FOLIAGE_CASTER_FRAG. Not the far one: it is never inside the near
      // cascade, the far cascade's texels are too coarse to hold a hole, and
      // a program that can discard costs early depth on thirty thousand trees.
      shadow.cast(trees.layers[k][lod].mesh, lod === 'near'
        ? { instanced: true, material: treeCaster(shadow, true) }
        : { instanced: true });
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
  // Up the skakaonica's ladder and off its board — src/61-plunge.js. After
  // the swim, because the swim is the only way to the foot of the ladder and
  // the only thing she comes back to.
  plunge = buildPlunge(jadrija, you, {
    splash: (x, y, z, hard, fwd, fx, fz) => { if (bodySplash) bodySplash.at(x, y, z, hard, fwd, fx, fz); },
    sound: (kind, amt) => {
      if (!audio) return;
      if (kind === 'plunge' && audio.plunge) audio.plunge(amt);
      else if (kind === 'land' && audio.nudge) audio.nudge();
    },
    toast: (msg) => toast(msg),
  });
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

  // The last step used to sign off with a line of its own; now the bar simply
  // fills and the line empties, which is the whole of what "ready" needs to
  // say once there is a lit Take off button underneath it. `step` still runs:
  // it is what takes the bar to 100 and yields a frame for it to get there.
  await step(100, null);
  $('enter').hidden = false;
  $('watch').hidden = !introSeen();
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

/**
 * The help sheet — every key the game answers.
 *
 * A table rather than a wall of prose, and grouped by what you are sitting in,
 * because "what does F do" has two answers and which one is right depends on
 * whether you are in the aeroplane. The glyph column is not translated: W is
 * W on a Croatian keyboard too. Only the right-hand column goes through T().
 */
const HELP = [
  ['help.g.fly', [
    ['mouse · ← ↑ → ↓', 'help.k.stick'],
    ['W · S', 'help.k.thr'],
    ['A · D', 'help.k.rudder'],
    ['SPACE', 'help.k.scoop'],
    ['F', 'help.k.drop'],
    ['Z', 'help.k.level'],
    ['T', 'help.k.ap'],
    ['C', 'help.k.cam'],
    ['G', 'help.k.gear'],
    ['X', 'help.k.centre'],
  ]],
  ['help.g.foot', [
    ['W A S D · arrows', 'help.k.walk'],
    ['Q', 'help.k.run'],
    ['SHIFT', 'help.k.crouch'],
    ['SPACE', 'help.k.branch'],
    ['ENTER', 'help.k.hop'],
    ['Z', 'help.k.lens'],
    ['B', 'help.k.body'],
    ['U', 'help.k.up'],
    ['K', 'help.k.kite'],
    ['E', 'help.k.in'],
    ['E', 'help.k.buy'],
    ['E', 'help.k.steal'],
    ['Y', 'help.k.drink'],
    [';', 'help.k.lick'],
    [', .', 'help.k.menu'],
    // The bag and the phone that is in it, which were both keys nobody could
    // find: ' has been the satchel since it was built and appeared on no
    // sheet, and ] is new. See src/62-satchel.js and src/63-phone.js.
    ["'", 'help.k.bag'],
    [']', 'help.k.cell'],
    ['[', 'help.k.ball'],
    ['\\', 'help.k.belt'],
    ['=', 'help.k.collar'],
    ['CLICK + ↑ / ↓', 'help.k.yank'],
    ['O', 'help.k.pc'],
  ]],
  ['help.g.water', [
    ['W A S D · arrows', 'help.k.swim'],
    ['SHIFT · Q', 'help.k.kick'],
    ['SPACE', 'help.k.rise'],
    ['C · CTRL', 'help.k.dive'],
    ['T', 'help.k.auto'],
    ['B', 'help.k.body'],
    ['E', 'help.k.ashore'],
  ]],
  ['help.g.doors', [
    ['J', 'help.k.bail'],
    ['9', 'help.k.jadrija'],
    ['8', 'help.k.kabina'],
    ['0', 'help.k.rokici'],
    ['V', 'help.k.vikendica'],
    ['R', 'help.k.race'],
  ]],
  ['help.g.any', [
    ['P · ESC', 'help.k.pause'],
    ['ESC ESC', 'help.k.silent'],
    ['RIGHT CLICK', 'help.k.free'],
    ['N', 'help.k.voice'],
    ['i', 'help.k.ears'],
    ['SHIFT + I', 'help.k.mic'],
    ["'", 'help.k.satchel'],
    ['M', 'help.k.settings'],
    ['H', 'help.k.hud'],
    ['L', 'help.k.clip'],
    ['?  ·  F1', 'help.k.help'],
  ]],
];

function buildHelp() {
  // Not a data-i18n attribute: which line is right depends on whether there is
  // a keyboard, and on glass neither ESC nor ? exists to be pressed.
  $('help-foot').textContent = TK('help.note', 'help.noteTouch');
  const cols = $('help-cols');
  cols.textContent = '';
  for (const [gk, rows] of HELP) {
    const sec = document.createElement('section');
    const h = document.createElement('h4');
    h.textContent = T(gk);
    sec.appendChild(h);
    for (const [glyph, dk] of rows) {
      const row = document.createElement('div');
      const k = document.createElement('kbd');
      k.textContent = glyph;
      const d = document.createElement('span');
      d.textContent = T(dk);
      row.append(k, d);
      sec.appendChild(row);
    }
    cols.appendChild(sec);
  }
}

function toggleHelp(force) {
  const el = $('help');
  const show = force == null ? el.hidden : force;
  if (show) buildHelp();
  el.hidden = !show;
  if (show) document.exitPointerLock?.();
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

// The pause card used to carry a line of arithmetic under the word — hectares
// alight, the city's health — and Misha, 11 Sep: "remove the shit about 'fire
// still burning', just have it show a simple Pause button". He is right: a
// number you cannot act on while the world is stopped is a number read once
// and then sat behind. The HUD says it while you are playing, which is when it
// means something.

/**
 * The silent pause: stopped, with nothing painted over the frame.
 *
 * Misha again, same message: "often i need to pause, take a screenshot of some
 * defect or what not". The ordinary pause is no good for that — it throws a
 * dark card and a nine-pixel backdrop blur over the exact frame he wanted to
 * keep, so the defect goes out of focus at the moment he photographs it. This
 * is the same stop with the card taken off.
 */
let silentPause = false;

/**
 * Whether the microphone was open when the world stopped, so that resuming
 * gives it back.
 *
 * Misha, 17 Sep 2026: *"if i press Pause: the 'I' audio still listening for
 * stuff.. it should also pause"*. It was listening, and worse than merely
 * listening: a paused game is exactly when somebody talks to the room rather
 * than to the game, and every sentence in it was going up to the transcriber
 * and coming back as something for Baye to answer. A stopped world that is
 * still spending your microphone on the conversation you stopped it for is not
 * stopped.
 *
 * The latch is the whole of it: pausing closes the microphone, and only a pause
 * that closed one opens it again. Anything else and P becomes a way to switch
 * the mic ON — press it once with the ears off and you would come back listening.
 */
let earsHeld = false;

// 400 ms is the double-tap window, and it is not a taste: it is GTK's and Qt's
// default double-click interval, with Windows' GetDoubleClickTime at 500 and
// macOS in the same place. A deliberate double-tap lands nearer 200 ms, so 400
// clears a real one with room to spare, and it is still far shorter than the
// gap between two Escapes that meant two different things — nobody pauses,
// looks at the frozen frame, and decides to carry on inside half a second.
const ESC_DOUBLE_MS = 400;
let escLast = -1e9;

/**
 * Escape's half of the pause, which is the half that can be pressed twice.
 *
 * The first press is exactly what it always was — pause, or unpause — and it
 * fires immediately. Holding the decision for 400 ms to find out whether a
 * second one is coming would buy the double-tap at the price of making the
 * ordinary pause feel broken, and the ordinary pause is the one pressed a
 * hundred times more often. What makes that affordable is that the *second*
 * press has somewhere new to go: the world is already stopped by the time it
 * arrives, so instead of starting it again it can take the card off.
 */
function escPause() {
  const now = performance.now();
  const quick = now - escLast <= ESC_DOUBLE_MS;
  escLast = now;
  // Already silent: a pair gets you out. The lone Escape in between is
  // swallowed on purpose, and that is the whole point of the mode rather than
  // an oversight — resuming for 200 ms and stopping again would move the frame
  // he is in the middle of photographing. P is the instant way out, and it
  // still is.
  if (silentPause) { if (quick) setPaused(false); return; }
  // The second of a quick pair, with the first one's card still up: drop the
  // card and the blur with it, and leave the world stopped.
  if (quick && state.paused) { silentPause = true; $('pause').hidden = true; return; }
  togglePause();
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
  //
  // `brod` is on it for a harder version of the same reason. The boat to
  // Šibenik is nine and a half minutes long and it is the only thing in this
  // game that takes that long without asking you for anything, so it is the
  // one most likely to be interrupted by the room you are sitting in — and a
  // voyage that cannot be stopped is a voyage you have to watch the end of.
  if (state.phase !== 'fly' && state.phase !== 'crashing'
    && state.phase !== 'ground' && state.phase !== 'chute'
    && state.phase !== 'swim' && state.phase !== 'brod') return;
  if (state.paused === on) return;
  state.paused = on;
  // And the phone's live view, which cannot be live and cannot even be a
  // still while the pause card's blur is over the canvas. See `phonePaused`.
  phonePaused(on);
  // Every other door in and out of a pause — P, the Resume button, the touch
  // buttons, the back doors that unpause on their way somewhere — puts the
  // card back where it belongs. Only `escPause` takes it off, and only for as
  // long as that one stop lasts, so the next ordinary pause looks ordinary.
  silentPause = false;
  $('pause').hidden = !on;
  audio.setPaused(on);

  if (on) {
    // Nothing survives the pause held down. Coming back to full right rudder
    // because that is what your hand was doing thirty seconds ago is the
    // classic way a pause button loses an aeroplane.
    keys.clear();
    mouseDrop = false;
    TOUCH.scoop = TOUCH.drop = false;
    flight.p.kb.set(0, 0);
    flight.p.stick.set(0, 0);
    document.exitPointerLock?.();
    // And the microphone, which is a key held down by any other name — see
    // `earsHeld`. It closes the device rather than gating what comes off it,
    // because the tally light is the promise: nothing in the room is being
    // listened to while the world is stopped.
    if (ears && ears.on) { earsHeld = true; ears.toggle(); }
  } else if (!IS_TOUCH && $('panel').hidden) {
    grabPointer();
  }
  // Coming back: the microphone as you left it. The permission is already
  // given and the resume is itself a keypress or a click, so opening it again
  // needs nothing from the player.
  if (!on && earsHeld) {
    earsHeld = false;
    if (ears && !ears.on) ears.toggle();
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
/**
 * The waterline the walk model refused a step at, on the frame that just ran.
 *
 * Null every other time, which is the whole point of it existing rather than
 * `ground.wet()` being read directly. See the frame loop. Declared up here
 * because `leaveWater` clears it and `leaveWater` is the first thing in the
 * file that does — see RULES 3 in plan/jadrija-TODO.md.
 */
let handover = null;

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
  // Off the tower too, whatever took her: the board back to hanging empty
  // and the diver back to his own afternoon. See `abort` in 61-plunge.js.
  if (plunge && plunge.active) plunge.abort();
  $('plunge-hud').hidden = true;
  if (you) you.drive(null);
  bodyCam = false;
  syncBodyBtn();
  $('chase-hud').hidden = true;
  // Whatever took you out, the mask comes off in the same frame — see the note
  // on `reset` in 62-mask.js. Ahead of the branches on purpose: it is cheap, it
  // is idempotent, and putting it inside the swim branch would mean trusting
  // `was` to be right about a thing you can see on your own face.
  if (mask) mask.reset();
  // And then the whole of the water comes off the screen, whatever `was` says.
  //
  // This branched three ways on `was` and did nothing at all if `was` named
  // none of them, which is a teardown that has to be told what it is tearing
  // down. `skipToVikendica` is the caller that showed why that is wrong: it
  // reads `state.phase`, and by the time anything downstream of it has run the
  // phase can already have moved. One reading of the phase that was a frame
  // stale left a swim active with its HUD up and a mask on your face for the
  // whole eleven seconds of a camera walking up somebody else's staircase.
  //
  // Leaving a mode that is not running is free — read them, they set a flag —
  // and hiding a hidden div is free. What is not free is a screen that has to
  // be told which of three overlays it is wearing.
  const wet = was === 'swim' || was === 'ride' || was === 'plunge'
    || (swim && swim.active) || (ride && ride.active);
  if (swim && swim.active) swim.leave();
  if (ride && ride.active) ride.leave();
  $('swim-hud').hidden = true;
  $('ride-hud').hidden = true;
  // The underwater tint is the one piece of this that is not a div you can
  // simply hide: `paintSwimHud` drives its opacity, and an element left at
  // 0.4 with `hidden` cleared by something downstream comes back blue.
  $('under').classList.remove('on');
  $('under').style.opacity = '0';
  $('under').hidden = true;
  if (IS_TOUCH) $('stouch').hidden = true;
  wasUnder = false;
  // Nothing in the water can still be holding the shoreline handover either.
  // See the frame loop: a stale one is how you got put back in.
  handover = null;
  return !!wet;
}

/**
 * The way out of the water, whichever water you are in.
 *
 * E on a keyboard and ASHORE under a thumb are the same door and now go
 * through the same function. They did not: the touch button called
 * `wadeAshore()` straight, which answers only in 'swim', so on the kite —
 * which draws the same control strip — the button was furniture.
 */
function goAshore() {
  if (!inWater()) return false;
  // The world being stopped is not a reason to stay in the sea. See the note
  // on the key handler, above the pause guard.
  if (state.paused) setPaused(false);
  if (state.phase === 'ride') dropKite();
  // That hands you to the swim, which is where the walk out starts.
  return state.phase === 'swim' ? wadeAshore() : false;
}

/** True where a back door is allowed to fire from. */
// The skakaonica's tower counts: you only ever get up it from the sea, it is
// the sea you go back into, and without it 9, 0, V and R did nothing at all
// from the top of the ladder (MEASURED — 9 left her standing on the plank).
const inWater = () => state.phase === 'swim' || state.phase === 'ride'
  || state.phase === 'plunge';

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
 *
 * It answers from everywhere, and that is the whole of what it is for.
 *
 * It used to answer from the seat and from the water and nowhere else, which
 * made it useless in the two places somebody most wants it. Pressed during the
 * walk up to the vikendica it hit the `state.phase === 'ground'` guard — the
 * cut has already dropped you on the promenade, the phase is 'ground' by the
 * time the first leg plays — and said "there is no aeroplane here", while the
 * shot carried on running the camera up somebody else's staircase. Pressed
 * during the race's establishing shot it did move the walker, correctly, four
 * hundred metres up the shore, and left the camera on the end of the jetty: the
 * cut had been torn down by `leaveWater` but `camOverride` still held its last
 * frame, and nothing puts that back on its own. You were at Jadrija and could
 * not see it.
 *
 * So: kill the walk-up outright rather than through `endVikWalk`, which would
 * finish the shot by standing you in the middle of the living room — the thing
 * you just pressed a key to get out of; give the camera back unconditionally;
 * and let 'ground' and 'chute' through the door with the rest. On foot the
 * refusal was never right anyway. `0` refuses on foot because it means "get
 * into the aeroplane" and you are standing next to it; `9` means "be over
 * there", and being on foot somewhere else is the reason to press it.
 */
function skipToJadrija() {
  if (!ground || !ground.ok || !jadrija || !jadrija.figureAt) {
    // Was a silent return, and a back door that silently does nothing is
    // indistinguishable from a back door that took you somewhere and something
    // else took you back. That is exactly how this one was reported: "9 puts
    // me back in swim mode". It did not — something else did — but there was
    // nothing on the screen that could tell the two apart.
    toast(T('toast.noComputer'));
    return;
  }
  if (state.paused) setPaused(false);
  if (vikWalk) { vikWalk = null; vikHold = false; }
  camOverride = null;
  if (state.phase !== 'fly' && state.phase !== 'ground'
    && state.phase !== 'chute' && !inWater()) return;
  // Under a canopy there is a canopy, and it does not come with you. Harmless
  // anywhere else — `reset` puts the seat back to 'stowed' and zeroes a
  // descent that is not happening.
  if (eject) eject.reset();
  leaveWater();
  const [ft, fs] = jadrija.figureAt;
  const w = jadrija.toWorld(ft + 16, fs - 1);
  const her = jadrija.toWorld(ft, fs);
  if (!ground.retarget(jadrija) || !ground.dropIn(w[0], w[2],
    Math.atan2(-(her[0] - w[0]), -(her[2] - w[2])))) {
    toast(T('ground.noPlane'));
    return;
  }
  // The phase `dropIn` set, said again here for the same reason `wadeAshore`
  // says it: this is the end of a transition and the end of a transition is
  // where the state is written down, not somewhere in the middle of one.
  state.phase = 'ground';
  $('hud').hidden = true;
  $('chute-hud').hidden = true;
  $('ground-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = false; }
  if (!IS_TOUCH) grabPointer();
  paintDeviceText();
  toast(T('toast.cheatJad'));
}

/**
 * The third back door, on `8` — inside the kabina.
 *
 * Misha, 21 Sep: *"can u assign button '8' to teleport into the kabine? lately
 * been spending lots of time in the kabine"*. `9` lands you sixteen metres up
 * the promenade from her, and from there the room is another walk and a door
 * to find; this is the door taken as read.
 *
 * NOT `placeNamed`: that one resets the flight model and puts you back in the
 * aeroplane over the spot, which for a room 4 m across is a crash and a card.
 * This is the walking entry — `dropIn`, exactly as `9` is — and it is on the
 * digit next to it because it is the same errand one building further in.
 *
 * Three things are said by hand that walking in through the doorway says for
 * you, and all three are latches rather than functions of where you are:
 *
 *   `inRoom` is set by a CROSSING and only by one — see `crossThreshold`. Put
 *   down in the middle of the floor with it still false, the room is not
 *   somewhere you have ever been, so walking back out over the sill fires
 *   nothing and the way out of the room is not the way out of the room.
 *
 *   `roomStep` is the previous (t, s) that crossing is measured against. Left
 *   at wherever you pressed the key — the far end of the promenade, the
 *   channel, the air — the very next frame reads a step of two hundred metres
 *   that happens to pass through the doorway, and cuts you into the room you
 *   are already standing in.
 *
 *   `inLatch` and the two exposures would sort themselves out on their own,
 *   because `kabina.inside` is a function of position and answers 1 here. But
 *   `indoors` ramps at 3.6 a second, so arriving without them is a third of a
 *   second of a dark room lit for white concrete.
 *
 * The iris is the fade UP and not the whole cut. There is nothing to hide on
 * the way in — the move has already happened by the time the screen would go
 * down — and half a second of black before a teleport that was instant is a
 * loading screen. What is worth keeping is the other half: an eye opening on a
 * dark room, which is the grammar this doorway already has.
 */
function skipToKabina() {
  const K = jadrija && jadrija.kabina;
  if (!ground || !ground.ok || !K) {
    // Same as `9`: a back door that silently does nothing is indistinguishable
    // from one that took you somewhere and something else took you back.
    toast(T('toast.noComputer'));
    return;
  }
  if (state.paused) setPaused(false);
  if (vikWalk) { vikWalk = null; vikHold = false; }
  camOverride = null;
  if (state.phase !== 'fly' && state.phase !== 'ground'
    && state.phase !== 'chute' && !inWater()) return;
  if (eject) eject.reset();
  leaveWater();
  // The big room before the drop, so the walker is put down in its walls and
  // not the small one's — see `KAB.grow`.
  if (jadrija.kabinaMode) jadrija.kabinaMode(true);
  const w = jadrija.toWorld(K.standIn[0], K.standIn[1]);
  // Facing into the room: the back wall, not the doorway. Everything in here —
  // the cot, the table, the glass — is behind you otherwise, and a teleport
  // that lands you looking at the way out has shown you nothing.
  const deep = jadrija.toWorld(K.standIn[0], K.back);
  if (!ground.retarget(jadrija) || !ground.dropIn(w[0], w[2],
    Math.atan2(-(deep[0] - w[0]), -(deep[2] - w[2])))) {
    toast(T('ground.noPlane'));
    return;
  }
  state.phase = 'ground';
  $('hud').hidden = true;
  $('chute-hud').hidden = true;
  $('ground-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = false; }
  if (!IS_TOUCH) grabPointer();
  paintDeviceText();
  // The three latches, and the iris. `dipPhase = 2` is the fade up on its own;
  // `dipPin` is where the walker is held for the half second it lasts, which is
  // where we just put him.
  inRoom = true;
  roomStep = [K.standIn[0], K.standIn[1]];
  inLatch = 1; darkWant = 1; indoors = 1; roomDark = 1;
  dipPhase = 2; dipT = 0; dipDo = null; dipPin = [w[0], w[2]];
  toast(T('toast.cheatKab'));
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

// And out of the swat, for the same reason: the ground HUD and the touch layer
// are both away while it runs, so on a phone there is no button to press.
//
// Not for the first half second. The gesture that STARTS this is a finger held
// on the spray button, and a finger that is lifted and put back down inside the
// first frames of the shot — which is what holding a button through a hit looks
// like — would skip the thing it just earned.
addEventListener('pointerdown', () => { if (swatCut && swatCut.t > 0.5) endSwat(); });

// And out of the pour, for the same reason and with the same guard. Nothing a
// finger is doing STARTS this one, so the half second is not about a held
// button: it is about a tap that lands in the same handful of frames the cut
// begins in, which on a phone is whatever the player was already doing when
// she happened to reach the porch.
addEventListener('pointerdown', () => {
  if (pourCut && pourCut.wall > 0.5) endPour(false);
});

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

// ── swatting the fly ─────────────────────────────────────────────────────────
/**
 * And the fly, which is the one thing in the flat you can hit with the hose
 * that is trying not to be hit.
 *
 * ── WHAT COUNTS AS A HIT ──
 *
 * The water's own PARABOLA, from the eye, and both halves of that are a
 * decision that was measured rather than assumed.
 *
 * The parabola, because the laptop and the television are tested against a
 * straight line and they are half a metre across. The fly is seven
 * millimetres, and the jet leaves the branch at 23 m/s and falls: 5 cm at two
 * metres and 16 cm at four, which against a 30 cm cone is nothing at one end
 * of the room and half of it at the other. Twelve steps of the same walk
 * `traceJet` makes in src/47-ground.js, and it is 12 steps of arithmetic and
 * no allocation, once a frame, and only while the branch is open.
 *
 * From the EYE, though, and not from the nozzle — and that is the correction
 * that made this work at all. Measured: with the reticle held exactly on a fly
 * 2.6 m away, the water's own axis passes 0.365 m from it. The branch is held
 * 22 cm to your right and 22 cm below your eye, so the jet runs down a line
 * parallel to the one you are sighting along and permanently a third of a
 * metre off it, at every range. Test against that line and pointing straight
 * at the animal is a guaranteed miss for ever, with no way to see why: the
 * offset does not shrink with distance and there is nothing on the screen to
 * measure it against. And the visible spray is a cone half a metre wide at
 * that range, so the water genuinely IS on the fly in the picture while the
 * axis is nowhere near it. The player's line is the honest one to test.
 *
 *   SWAT.radius is 0.30 m off that line, which at two metres is 8.5 DEGREES.
 *
 * That is a number worth defending in both directions. A branch is not a
 * laser: 47-ground.js catches a person within 0.62 m of the axis at the nozzle
 * and 1.4 m of it at twenty metres, because a jet is a cone and being made to
 * be accurate with one is not the game. Half of that, and pointing a hose at a
 * housefly is a thing a person can actually do — find it, hold the water on
 * it, and it dies. But it is still only a quarter of the room's width at the
 * range you fight it at, so it is not free: at four metres, which is across
 * the room, the same cone is a target 60 cm across and the fly is one part in
 * eighty-five of it.
 *
 * And it is HELD, not touched: 0.10 s of water on it, in seconds and not in
 * frames, because a frame count is a difficulty setting that reads differently
 * on every machine — six frames at 60 fps is two at 24, and the frame-count
 * version of this would have been three times harder on the laptop it was
 * written on than on the desktop it was tested on. Time outside the cone
 * drains at twice the rate it fills, so a jet sweeping across the animal on
 * its way to somewhere else does not bank a kill.
 */
const SWAT = {
  reach: 4.2,        // m of jet a fly can be hit in — the room is 3.9 across
  radius: 0.30,      // m off the line you are sighting down
  hold: 0.10,        // s of it, and see above for why this is not a frame count
  steps: 12,         // of the parabola, which at 23 m/s is 35 cm apiece
  // The shot. Five beats, and it is seconds and not a cutscene: 7.00 s from
  // the hit to standing in the room again, of which the close-up is 5.00 s
  // because it is the only part of this that is new. Escape, Enter or Space
  // ends it wherever it has got to, the static beat included — the same three
  // keys the trampoline cut takes, and for the reason written over that one.
  //
  //   1.55  the spiral, zoomed into from where you stand   (vik.fly.fallSecs)
  //   0.45  held on the tile after it lands                (floor)
  //   3.00  the close-up's arc, one side of it to the other (macro)
  //   2.00  and then STOPPED on it                         (still)
  //         of which the last 0.32 goes to black           (fade)
  //
  // THIS COMMENT USED TO SAY 4.65 s and it was never true: 1.55 + 0.45 + 3.00
  // is five, and it has been five since the shot was written. The arithmetic
  // is spelt out above so the next person does not have to redo it.
  //
  // `still` is the answer to "pause on it for a few seconds longer so we can
  // marvel at it", and it is called that because `hold` is already taken,
  // eleven lines up, by the tenth of a second of water. A duplicate key in
  // this object is not a syntax error in any mode — the second one silently
  // wins — so a second `hold` here would have quietly made killing a fly need
  // TWO SECONDS of water on it, and nothing in the close-up's own tests would
  // ever have noticed, because they all start the shot by hand.
  //
  // It is a held beat rather than a bigger `macro` on
  // purpose. The arc covers 1.75 rad of azimuth on a smoothstep, which is
  // 33 deg/s mean and 50 deg/s through the middle of the move; stretching
  // `macro` to 5.00 s to buy the same two seconds would put those at 20 and
  // 30, and that is not more marvelling, it is the same marvelling in slow
  // motion — past some speed a macro push stops reading as reverent and starts
  // reading as sluggish. So the rate is untouched and the time is bought at
  // the END, where the camera arrives, stops, and sits on the composition the
  // whole move existed to reach. Which is also how a real macro insert is cut.
  // Rejected with it: a residual drift through the still, 28 mm creeping to
  // 25 mm, to keep the frame "alive". Smoothstep already arrives at zero
  // velocity, so the stop is soft without help, and a camera that never quite
  // settles is the opposite of the thing that was asked for.
  //
  // And it fixes something that was wrong before anyone asked. The fade used
  // to eat the last 0.32 s of the ARC, so the frame the whole move exists to
  // arrive at — the belly side, the six legs curled up over it — was never once
  // seen at full brightness. At the smoothstep's tail 0.32 s is only the last
  // 3% of the move, so it was not much travel that was lost; it was the
  // destination itself, playing entirely under a wipe to black. Now the arc
  // finishes in the clear and the fade is measured off the end of the still,
  // so that frame is lit and motionless for 1.68 s before it starts to go
  // dark. Measured, on the two frames either side of it: t = 5.70 s and
  // t = 6.62 s of the shot come back pixel for pixel identical, at the same
  // mean luminance as the last frame of the arc.
  floor: 0.45,       // s held on the tile after it lands
  macro: 3.00,       // s of the close-up's arc — a rate, not a duration
  still: 2.00,       // s stopped on the end of it, and the fade is inside this
  fade: 0.32,        // of which the last third of a second goes to black
  // The zoom, and it is a zoom and not a fly-in: see below.
  //
  // 58° down to 26°, and the bottom of that ramp is a compromise that was
  // measured rather than chosen. The animal is about four pixels across at the
  // two metres this is fought at, and every degree off the lens is another
  // pixel on it — at 16° it is eight or nine. But 16° at two metres is a frame
  // 56 cm wide, and 56 cm of this room is white floor tile and nothing else:
  // the fly gets bigger and the shot gets emptier, and a speck spiralling
  // against a blank white field reads as a dead pixel rather than as a fly
  // coming down in a room. 26° keeps a metre of the room in frame — the tile
  // grid, the leg of the low table, the skirting — which is what the spiral is
  // legible AGAINST.
  fov: [26, 58],
  creep: 0.40,       // m of push on top of it, and no more
  keepOff: 1.75,     // m the eye stays off the fly, because the near plane is
                     // 1.2 and a fly inside it is a fly that is not drawn
  // The close-up's own move: metres out, radians above the tile, radians round
  // from the animal's nose. A slow push and a slow arc, which is what a macro
  // shot of something that is not going to move again is.
  //
  // It ARCS, and the arc is the whole reason this beat is three seconds rather
  // than one — and the whole reason the two seconds after it are a STILL and
  // not more arc. A fly on its back rolled a quarter over shows you
  // two different animals from its two sides: from the low side the striped
  // grey scutum and a flank, and from the high side the belly with the six
  // legs curled up over it. There is no single angle that has both, so the
  // camera starts on the one and finishes on the other — which is also the
  // only thing in this shot that gives the frame any parallax to read the
  // shape off.
  from: [0.046, 0.42, 1.30],
  to: [0.028, 0.25, -0.45],
  // AND THEN IT GETS UP. Misha, 14 Sep 2026: the fly twitches, comes back to
  // life and flies off with two tiny blue buckets to join the Bucketeers of
  // America. When there is room in the movement — `jadrija.zombies.room()`,
  // three members — the still does not fade: 1.2 s into it the resurrection in
  // src/44-corpse.js takes over the close-up and runs to its own black, and the
  // corpse in the room gets up behind the cut. When there is no room it is the
  // old ending, still and fade, and the fly stays dead.
  stillRise: 1.20,
};

/** The swat, or null. */
let swatCut = null;
let swatHeld = 0;
/**
 * Wall time held off the shot, for `__fr.fly.cutAt` — the same switch, and the
 * same reason, as `vikHold` over the walk up to the house: a page rendering at
 * one frame a second cannot film a sequence that is driven by the clock,
 * because the clock is the thing that is wrong.
 */
let swatHold = false;
const _jetP = new THREE.Vector3();
const _jetV = new THREE.Vector3();
const _flyP = new THREE.Vector3();

/**
 * Is the water on it? One walk of the jet's parabola per frame, which is
 * twelve steps of arithmetic and no allocation.
 */
function checkFlySwat(dt) {
  const vik = jadrija && jadrija.vik;
  if (state.phase !== 'ground' || !ground || !ground.you || !vik || !vik.fly) {
    swatHeld = 0; return;
  }
  const you = ground.you;
  if (!you.spraying || you.jet < 0.4 || !vik.fly.alive()) { swatHeld = 0; return; }
  // In the room with it. Hosing the terrace through a shut door is not a hit,
  // and the same test the buzz is gated on is the one to ask.
  if (!jadrija.indoorsAt(camera.position.x, camera.position.y, camera.position.z)) {
    swatHeld = 0; return;
  }
  const at = vik.fly.at();
  _flyP.set(at[0], at[1], at[2]);
  // The branch's own direction, which is the walker's yaw and pitch and is
  // where the water actually goes — and the eye as the origin, for the reason
  // written above.
  const { dir } = ground.nozzle();
  _jetP.copy(camera.position);
  _jetV.set(dir[0], dir[1], dir[2]).multiplyScalar(GROUND.jetV);
  // Straight-line range first, because most frames are a miss and this is the
  // cheap half of the test.
  if (_flyP.distanceTo(_jetP) > SWAT.reach) { swatHeld = 0; return; }
  const step = SWAT.reach / GROUND.jetV / SWAT.steps;
  let near = Infinity;
  for (let i = 0; i < SWAT.steps; i++) {
    const x0 = _jetP.x, y0 = _jetP.y, z0 = _jetP.z;
    _jetV.y -= 9.81 * step;
    _jetP.addScaledVector(_jetV, step);
    // Closest approach along the step and not at the end of it: a step is a
    // third of a metre and the target is seven millimetres, so sampling only
    // the ends walks straight through it — the same mistake, and the same fix,
    // that `sweep` in 47-ground.js carries a paragraph about.
    const dx = _jetP.x - x0, dy = _jetP.y - y0, dz = _jetP.z - z0;
    const L2 = dx * dx + dy * dy + dz * dz;
    const t = L2 > 1e-9 ? clamp(((_flyP.x - x0) * dx + (_flyP.y - y0) * dy
      + (_flyP.z - z0) * dz) / L2, 0, 1) : 0;
    near = Math.min(near, Math.hypot(x0 + dx * t - _flyP.x,
      y0 + dy * t - _flyP.y, z0 + dz * t - _flyP.z));
  }
  swatHeld = clamp(swatHeld + (near < SWAT.radius ? dt : -dt * 2), 0, SWAT.hold);
  if (swatHeld >= SWAT.hold) { swatHeld = 0; startSwat(); }
}

/**
 * Hit: take the camera, and let the animal get on with dying.
 *
 * The branch is shut off at the same moment, and that is not tidiness — a hose
 * left running through five seconds of cut is 46 litres of a 400 litre pack
 * spent on a shot. The same thing `checkLaptopSpray` does when it sits you
 * down at the desk, and for the same reason.
 */
function startSwat() {
  const vik = jadrija && jadrija.vik;
  if (!vik || swatCut || !vik.fly.swat()) return false;
  ground.setSpray(false);
  const at = vik.fly.at();
  swatCut = {
    t: 0,
    // Where the eye was standing when it happened. The push is measured off
    // this rather than followed off the camera, so nothing the player does
    // with the mouse during the shot can drag the frame around.
    //
    // Off the WALKER and not off `camera.position`, for two reasons. The
    // camera is a derived quantity — `ground.pose` writes it from the walker
    // later in the same frame — so anything that starts a shot before that has
    // run reads a camera still standing wherever it was last frame, which for
    // `__fr.fly.swat()` called straight after `__fr.vik.stand()` is two
    // kilometres away over the channel. And the walker's eye has no head bob
    // on it, which is right for a locked-off shot and wrong for a walk.
    eye: new THREE.Vector3(ground.you.x,
      ground.you.y + ground.you.eye, ground.you.z),
    aim: new THREE.Vector3(at[0], at[1], at[2]),
    // And where the walker was, put back every frame. A cut is a cut: coming
    // out of one three metres from where you went into it, because a key was
    // held down through a shot you could not see yourself in, reads as the
    // game having lost track of you.
    stood: [ground.you.x, ground.you.z, ground.you.yaw, ground.you.pitch],
  };
  // The room's own letterbox, which is the intro's. The skip button goes away
  // with it: it belongs to the film and it calls `beginFlight`, which pressed
  // in the middle of a walk around the vikendica would put you in an aeroplane.
  $('cine-skip').hidden = true;
  $('cine').hidden = false;
  $('ground-hud').hidden = true;
  if (IS_TOUCH) $('gtouch').hidden = true;
  requestAnimationFrame(() => { if (swatCut) $('cine').classList.remove('open'); });
  return true;
}

/** Give it all back, whether it ran out or was skipped. */
function endSwat() {
  if (!swatCut) return;
  const zv = jadrija && jadrija.vik;
  if (zv) zv.fly.buzz(null);
  // The corpse gets up whether or not you sat through the shot of it getting
  // up: a cut skipped is a cut you did not watch, not a fly that did not rise.
  // Decided here if the close-up never started, which is a skip in the spiral.
  const Z = jadrija && jadrija.zombies;
  if (Z) {
    if (swatCut.rise == null) swatCut.rise = Z.room();
    if (swatCut.rise) Z.expect();
  }
  // The fade is not put back here, and that is deliberate: `vik.fly.shot()`
  // BUILDS the close-up on first call, and a shot skipped in its first second
  // has no close-up yet. Every frame of the macro beat writes the fade from its
  // own clock anyway, so the next one opens at full whatever this one ended on.
  swatCut = null;
  swatHold = false;
  camOverride = null;
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  $('cine').classList.add('open');
  setTimeout(() => { if (!swatCut) $('cine').hidden = true; }, 800);
  $('cine-skip').hidden = false;
  $('ground-hud').hidden = false;
  if (IS_TOUCH) $('gtouch').hidden = false;
  if (!IS_TOUCH) grabPointer();
}

/**
 * One frame of it, on wall time — the same clock the walk up to the house and
 * the race's cut use, and for the reason written over `stepVikWalk`: a lens
 * that slows the world has nothing to say about how long a shot is.
 */
function stepSwat(dt) {
  if (!swatCut) return;
  const vik = jadrija && jadrija.vik;
  if (!vik || state.phase !== 'ground') { endSwat(); return; }
  const S = swatCut;
  S.t += dt;
  // Standing still through it. See `stood`.
  ground.put(S.stood[0], S.stood[1], S.stood[2], S.stood[3]);

  const fall = vik.fly.fallSecs();
  if (S.t < fall + SWAT.floor) {
    // ── the spiral, and the camera going in on it ──────────────────────────
    // A ZOOM, and not a fly-in, and that is the whole of why this beat is
    // possible at all. The world's near plane is 1.2 m and moving it has cost
    // this project a shimmer across the entire scene once already; a camera
    // that pushes in on something in the middle of a four-metre room ends up
    // through the furniture and inside its own clip. A long lens takes the
    // same picture from where you are already standing and touches nothing.
    // There is 40 cm of creep on top of it because a lens alone is a flat
    // move, and a frame that closes AND advances reads as somebody leaning in.
    const at = vik.fly.at();
    _flyP.set(at[0], at[1], at[2]);
    const u = sat(S.t / fall);
    const e = u * u * (3 - 2 * u);
    const f = lerp(SWAT.fov[1], SWAT.fov[0], e);
    if (Math.abs(camera.fov - f) > 1e-3) {
      camera.fov = f;
      camera.updateProjectionMatrix();
    }
    _jetV.subVectors(_flyP, S.eye);
    const gap = _jetV.length();
    _jetV.y = 0;
    if (_jetV.lengthSq() > 1e-6) _jetV.normalize();
    const creep = Math.min(SWAT.creep * e, Math.max(0, gap - SWAT.keepOff));
    // The aim lags the animal a little, so the spiral moves inside the frame
    // instead of being nailed to the middle of it. An operator swinging a long
    // lens on to something falling is always slightly behind it, and that lag
    // is the single thing that makes a tracked shot read as handled rather
    // than as parented.
    S.aim.lerp(_flyP, Math.min(1, dt * 9));
    camOverride = [
      S.eye.x + _jetV.x * creep, S.eye.y, S.eye.z + _jetV.z * creep,
      S.aim.x, S.aim.y, S.aim.z,
    ];
    return;
  }

  // ── and the cut to the close-up ─────────────────────────────────────────
  const shot = vik.fly.shot();
  const m = S.t - fall - SWAT.floor;   // s into the close-up
  // The first frame of it: the corpse put back exactly as it was built — the
  // last one may have got up and flown off — and the one decision about how
  // this shot ends, taken once so that a movement that fills up half way
  // through a shot cannot change its ending under it.
  if (S.rise == null) {
    shot.reset();
    const Z = jadrija && jadrija.zombies;
    S.rise = !!(Z && Z.room());
  }
  const riseAt = SWAT.macro + SWAT.stillRise;
  if (S.rise && m >= riseAt) {
    const r = m - riseAt;
    const wings = shot.revive(r, SWAT.to);
    vik.fly.buzz(wings * 0.8);
    // And as it climbs away with the buckets, it hums her tune — the undead
    // version, see `zombieHum` in src/80-audio.js. Once, on the frame the climb
    // starts, and only when the shot is running live rather than scrubbed.
    if (!S.hummed && r >= RISE.climb[0]) {
      S.hummed = true;
      if (audio && audio.zombieHum && !swatHold) {
        audio.zombieHum(0.5, { start: true, id: 0, rate: 0.66 });
      }
    }
    if (r >= shot.riseLen()) endSwat();
    return;
  }
  const v = sat(m / SWAT.macro);
  const e = v * v * (3 - 2 * v);
  // `sat` is what makes the still a still: past `macro` the parameter is
  // pinned at 1, `look` is handed the same three numbers every frame, and the
  // camera is simply not moving. No second branch, no second state — the arc
  // runs off the end of its own clock and stops there.
  shot.look(lerp(SWAT.from[0], SWAT.to[0], e), lerp(SWAT.from[1], SWAT.to[1], e),
    lerp(SWAT.from[2], SWAT.to[2], e));
  // Out through black rather than back to the room on a hard cut, because what
  // is behind this is a wide shot of a floor from two metres and the join
  // between the two is a jump of a hundredfold in scale. Measured off the end
  // of the STILL and not the end of the arc: see the note over `still`.
  shot.setFade(S.rise ? 1
    : 1 - sat((m - SWAT.macro - SWAT.still + SWAT.fade) / SWAT.fade));
  if (!S.rise && m >= SWAT.macro + SWAT.still) endSwat();
}

// ── the Bucketeer's first pour ───────────────────────────────────────────────
/**
 * She empties the bucket on the porch, and once a session that is a scene.
 *
 * Misha, 10 Sep 2026: *"create a cut-scene, the first time we come to
 * vikendica, and the first time the bucketeer baye descends down the stairs,
 * for that scene where she pours the water out of the bucket, and then picks up
 * the empty bucket to go back up... since u are struggling with 3d-rendering
 * that part anyway, i had asked about it 3 times and it's still not really 100%
 * working... i am thinking maybe in a cut-scene u can really do a much better
 * job"*.
 *
 * ── WHY THIS IS NOT THE FLY'S ANSWER ──
 *
 * The dead fly next door is a SECOND SCENE with a second camera and a 2 mm near
 * plane, because it is seven millimetres long and the world's near plane is
 * 1.2 m: there is no camera position in that room that can photograph it, and
 * the argument is written at length at the top of src/44-corpse.js. None of
 * that applies here. The Bucketeer is 1.66 m tall and stands in the sun on a
 * porch with the channel behind her; every frame this cut wants is reachable by
 * the world camera from two and a half metres, in the world's own light, with
 * the beach bar and the far shore in the back of it. So this is `camOverride`
 * and nothing else — no private scene, no second lighting rig, no asset built
 * twice, and nothing at all to put back afterwards but the lens.
 *
 * What it is instead is an EDIT, and that is where the work is.
 *
 * ── WHAT THE EDIT IS FOR ──
 *
 * src/45-bucketeer.js is honest about three things its loop still gets wrong,
 * and all three are at ankle height and all three are about the bucket:
 *
 *   1. SHE CANNOT BEND. There is no crouch clip. Her palm hangs 0.87 m above
 *      her feet and a pail standing on the floor has its bail at 0.40 m, so
 *      `set`, `take`, `lift` and the first 0.9 s of `rest` are a bucket
 *      travelling to meet a hand rather than a hand going down to the bucket.
 *      Photographed from anywhere that has both in frame it is unmistakable: a
 *      pail hanging in clear air a third of a metre below an open hand.
 *   2. The surface of the water is a circle where a plane through a tilted
 *      cylinder cuts an ellipse — rejected deliberately, written up over
 *      `waterDisc`.
 *   3. `placePail`'s 60 mm outboard offset leaves the pin 17.7 mm off plumb
 *      carrying and 83 mm through the swung pour.
 *
 * This cut SOLVES two of those and COVERS the third, and it is worth being
 * plain about which is which.
 *
 *   SOLVED — the disc. A circle standing in for an ellipse is only a lie when
 *   you can see the plane of it. Shot A's eye is at 0.60 m and the pail's rim
 *   starts at 0.755 m and goes DOWN from there as she rolls it; shot B stops at
 *   her waist. There is not one frame in this cut that looks into the bucket,
 *   and that is not a dodge — it is where a bucket being emptied is watched
 *   from anyway, because the thing worth seeing is the sheet coming over the
 *   lip and not the water still inside.
 *
 *   SOLVED — the plumb. 17.7 mm at 2.8 m is a fifth of a degree; 83 mm is one
 *   degree. Both are on the axis running away from both of these cameras. They
 *   were never visible and they are certainly not visible here.
 *
 *   NO LONGER PRESENT — the bend. This used to say COVERED, and everything
 *   under it is still true and is left standing because it is what makes the
 *   framing defensible if the beat ever comes back. What changed on 10 Sep is
 *   that there is no bend in this cut at all: `st.setLap` in 45-bucketeer.js
 *   now puts the pail down on the porch only on the laps she is about to
 *   pirouette on, and `BUCK.ear` is non-null for the whole of this cut, so the
 *   cut's lap is by construction one of the laps she keeps hold of it. She
 *   straightens up with ten litres' worth of empty bucket still in her fist,
 *   stands there, and walks off with it.
 *
 *   RE-PHOTOGRAPHED RATHER THAN ARGUED, at 3.80, 4.40, 5.50, 7.00, 7.40 and
 *   9.00 s through `__fr.pour.frame`. Shot B is unchanged to the eye at every
 *   one of them: a held pail's rim sits at 0.755 m and this frame's bottom edge
 *   crosses it at 0.90, so it is 14.5 cm under the picture exactly as the
 *   set-down pail's 0.2875 m was, and there is no blue in any of the six. The
 *   only difference is her right arm, which now holds the light carry pose
 *   through `rest` instead of relaxing to her side — which is what somebody
 *   holding a bucket does, and is the point.
 *
 *   The rest of the original argument:
 *
 *   The hand and the bucket are never in frame together
 *   while they are apart. Shot A ends on the frame the pail comes back upright,
 *   which is the frame before the set-down starts. And shot B's bottom edge
 *   crosses her at 0.85 m, and crosses the pail — which stands 0.23 m nearer
 *   the lens — at 0.90 m, against a rim that travels from 0.2875 m on the
 *   paving to 0.755 m in her fist. So the WHOLE of both transfers happens under
 *   the picture, with 14 cm to spare at the worst of it. Those two numbers
 *   include the letterbox, which eats 11 per cent off the top and the bottom
 *   and is part of the shot: the geometric figures are 0.69 and 0.74. Measured
 *   on the frames, not computed — `__fr.pour.frame(4.40)` and `(7.40)` are the
 *   two worst instants and there is no blue in either of them.
 *
 *   The pail comes back into the picture when she turns and walks off with it,
 *   hanging off her fist exactly as a bucket does. Nothing false is shown. What
 *   is not shown is her bending down — and she does not bend down, so there was
 *   never anything there to show.
 *
 * ── THE SHOTS ──
 *
 *   A  0.00 → 3.75 s   THE POUR. 2.79 m out on a 28 degree lens, eye at 0.62 m,
 *      from her front quarter on the bucket side — 30 degrees off her nose and
 *      1.40 m to her right. Three things were measured to land on that: from
 *      dead in front the pail crosses her own thigh and loses its silhouette;
 *      from square on her right at two metres the camera is inside the
 *      prizemlje's wall (there is one, 2 m off her shoulder); and from anything
 *      above about a metre you are looking down into the bucket. What this one
 *      has is the pail clear of her body against the pale ground of the
 *      promenade and the pines, the sheet falling in front of a sunlit paving
 *      slab, and the shot cut off at her waist — which is deliberate too, and
 *      is the one place a taste for a face has to be resisted: `leanHead` keeps
 *      her eyes level, so through the whole pour she is looking at the horizon
 *      and not at what she is doing. A pour shot with her face in it is a shot
 *      of somebody not paying attention.
 *
 *      It LEANS IN 30 cm over the first 1.25 s and then stops dead. 1.25 s is
 *      not a round number, it is when the water stops: the lip goes under the
 *      surface at 0.222 rad and the plane clears the inside of the base at
 *      1.093, which on the roll's own smoothstep is 0.475 s to 1.25 s. So the
 *      camera closes in while there is water coming over and is motionless for
 *      the 2.5 s of shake-out and righting that follow, which is the fly cut's
 *      own rule — arrive, and then stop — applied to a thing that lasts three
 *      quarters of a second.
 *
 *   B  3.75 → 9.50 s   SHE PUTS IT DOWN, LOOKS AT THE CHANNEL, AND GOES.
 *      3.17 m out on a 26 degree lens, eye at 1.50 m, from behind her right
 *      shoulder as she ends up — which is 1.58 m in front of her and 2.75 m to
 *      her right as she STARTS, because she turns 64 degrees to her left across
 *      this shot. Locked off for five of its five and three quarter seconds:
 *      the move in it is hers. She straightens up, she turns and looks out at
 *      the channel with the konoba's pergola, its barman and the far shore
 *      behind her, she gets her breath back, and then she turns and walks away
 *      out of the left of it, the pail swinging off her fist.
 *
 *      (This used to read "the bucket goes down out of the bottom of the frame
 *      ... she picks the bucket up (under the frame)", and both of those
 *      happened under the picture. Since 10 Sep neither happens at all on this
 *      lap — see NO LONGER PRESENT above — and the pail is simply in her hand
 *      for the whole shot, 14.5 cm below the frame line, until the tilt finds
 *      it at the end.)
 *
 *      And in the last second the camera tilts 35 cm down after her, which is
 *      the only move in this cut that is not a camera arriving somewhere. It is
 *      also what hands the bucket back: the frame line is set where it is to
 *      keep the transfers out, and it does that so well that her own walk alone
 *      left 5 cm of blue at the bottom edge. See `pourPlace`.
 *
 *      30 degrees of azimuth between the two shots and 13 of elevation, on
 *      purpose: under about 30 all told and a cut reads as a jump rather than
 *      as a cut. Both cameras are on the same side of her line, so she does not
 *      swap ends of the screen.
 *
 * ── HOW LONG, AND WHY IT IS NOT SEVEN SECONDS ──
 *
 * 9.50 s, against the fly's 7.00, and the length is not a taste: THE CUT DOES
 * NOT STOP HER CLOCK. It is exactly `tipIn + tipHold + tipOut + setDown +
 * breathe + lift` — 7.75 s, every one of those a number in BUCK that was argued
 * somewhere else — plus 1.75 s of her walking away with the bucket.
 *
 * `setDown` and `lift` are still in that sum even on the laps the pail never
 * leaves her hand, and that is not an oversight: they are the LENGTHS of `rest`
 * and `take`, which are unchanged. Measured after the 10 Sep pass, one whole
 * lap traced at 1/30 s from `fill`: fill 5.20, lift 0.94, down 23.13, tip 2.87,
 * right 0.93, rest 3.13, take 0.94, up 14.26, set 0.94 — 52.37 s, the same lap
 * to the frame it has always been. Shortening
 * it would mean either shortening her beats, which changes every other lap, or
 * cutting away from an action half done. So the clock below is HERS: `beat()`
 * hands back the phase and how far into it she is, and `pourClock` lays those
 * end to end. A cut driven by a wall clock started up to a fifth of a second
 * late would end shot A a fifth of a second into the set-down, with the bucket
 * sinking through the bottom of a frame that was supposed to be over.
 *
 * ── WHO IS THERE TO SEE IT: NOBODY HAS TO BE ──
 *
 * She pours every lap, and now every pour is this cut. That is the third answer
 * this question has had and it is the one that was asked for:
 *
 *   Misha, 11 Sep 2026: *"the cut-sequence downstairs still doesn't fire every
 *   time... so how about this: make it fire EVERY FUCKING TIME.... so every
 *   time she is down there, doesn't matter if we are near/not near, the cut
 *   scene gets triggered"*.
 *
 * WHAT IT USED TO BE, AND WHAT THE MEASUREMENT SAID. The gate was seven
 * clauses about the player: at least 5 m from her, at most 18, within 2.2 m of
 * her floor, not indoors, not with the vikendica between you, within 35 degrees
 * of straight at her, and 0.45 s of that banked before she tipped. Each one was
 * arguable on its own and together they were a sieve. Measured rather than
 * argued — `__fr.pour.why()` sampled every frame for whole laps at a time, and
 * the clause that was false at the instant she tipped counted:
 *
 *   standing 3 m in front of her, looking straight at her   5 of 5 laps blocked
 *      on the 5 m floor alone. Which is where he stands. *"i often stand next
 *      to her pouring water, but the cut-scene doesn't trigger"* was not a
 *      timing complaint; it was this number, every single lap.
 *   on the terrace over the porch, the spot `?tgps=233,21` lands on
 *                                                          32 of 32 blocked
 *      on four clauses at once — 1.22 m out, 2.80 m up, looking down at 0.28.
 *   25 m away                                              5 of 5 blocked, far
 *   8 m away, back turned                                  6 of 6 blocked, dot
 *   8 m away, looking at her — the one legal spot          1 fired, then 4 of 4
 *      blocked by the ten minute cooldown. That is the *"i only saw it trigger
 *      1 time"*, exactly: one lap in eleven and a half, and only from a five
 *      metre annulus he had no reason to stand in.
 *
 * And the banking was a fiction. From that one legal spot, 48% of a lap fails
 * the level test because she is upstairs and 13% fails the house test, so
 * `pourEyes` was zeroed for 61% of every lap and stood at 0.13 s — one frame —
 * on the frame she tipped. It only ever reached 0.45 inside the 0.50 s arm
 * window, with 0.05 s to spare. One dropped frame and the lap was gone.
 *
 * WHAT IS LEFT. Everything that was about the player has gone. What remains is
 * not proximity, it is the four ways a cut can be a bug rather than a scene:
 *
 *   SHE IS ACTUALLY POURING. `pourClock()` inside `POUR.arm` of the top of the
 *   tip, and it has to be a RISING edge — see `pourEdge`. This is the whole of
 *   the trigger now.
 *
 *   YOU ARE ON FOOT. `state.phase === 'ground'` and nothing else, which is one
 *   clause covering every way of not being: a cut that takes the camera off a
 *   Canadair on a drop run is not a scene, it is a crash. `lost`, `crashing`,
 *   `swim`, `ride` and `brod` go with it for the same reason.
 *
 *   NOBODY ELSE OWNS THE CAMERA. `camOverride` is most of that list in one
 *   test — the walk-up, the computer, the race, the trampoline — with the fly
 *   swat, `vikWalk`, `comp` and `dipPhase` named beside it.
 *
 *   AND THE GAME IS RUNNING. `state.paused`, and `ground.ok`.
 *
 * THE COOLDOWN IS ZERO, AND THAT IS A DECISION ABOUT HER LAP. `POUR.again` was
 * ten minutes because her lap was 52 seconds and 9.4 s of cut every 52 would
 * have been a tic. Her journey is minutes long now — she wanders the flat
 * between trips — so the lap IS the cooldown, and one 9.4 s cut per trip is a
 * couple of percent of play. The number is still there, in one place, if it
 * ever needs to be a number again. `POUR.hold` is what a probe parks it at.
 *
 * A SKIP IS NOT A RE-OFFER. With no cooldown, `endPour` can land back inside
 * the arm window — Escape at 0.3 s of a 0.50 s window — and the next frame
 * would start the same pour over. `pourEdge` is why it does not: the trigger is
 * the frame her clock ENTERS the window, and a clock already inside it never
 * enters it again.
 *
 * AND THE SHOT DOES NOT CARE WHERE YOU WERE. Both cameras are placed in HER
 * frame off `b.where()` — see `pourRig` — so the cut looks the same from 3 m,
 * from 120 m and from inside the bathroom; all three were shot and compared
 * frame for frame. The one real bound is `BUCK.poseM`, 150 m, beyond which her
 * loop does not advance at all and there is no pour to catch. That is honest
 * and it is not a gate: she is not being simulated out there.
 *
 * ── AND SHE SAYS ONE THING ──
 *
 * `tip_evo` — *"Evo vam vode."*, "Here is your water" — fired at 0.90 s, which
 * is the middle of the three quarters of a second the water is actually going
 * over the lip. One line and not two: `rest_lipo` on the breather was the other
 * candidate and two of them inside nine seconds is a woman narrating. It is a
 * line out of the `tip` pool, on the `tip` beat, in the shot that IS the tip.
 *
 * It goes through her own `say()` so that it lands in `stats().said` where a
 * probe can read it and so that `sayTick` knows a line is in the air and will
 * not start a second over the top of it — and `BUCK.ear` is pointed at the
 * camera for the length of the cut, because otherwise the level would be
 * computed from a body standing anywhere between five and eighteen metres away
 * while she fills the frame. See the note over `ear` in 45-bucketeer.js.
 */

/** Her beats laid end to end, so that the cut's clock can be hers. */
const POUR_INTO = {
  tip: 0,
  right: BUCK.tipIn + BUCK.tipHold,
  rest: BUCK.tipIn + BUCK.tipHold + BUCK.tipOut,
  take: BUCK.tipIn + BUCK.tipHold + BUCK.tipOut + BUCK.setDown + BUCK.breathe,
  up: BUCK.tipIn + BUCK.tipHold + BUCK.tipOut + BUCK.setDown + BUCK.breathe
    + BUCK.lift,
};

const POUR = {
  // ── HOW LONG BEFORE IT MAY RUN AGAIN, AND THE ANSWER IS NOT AT ALL.
  //
  // This is the one knob left of the seven that used to decide whether the cut
  // played, so it is worth being plain about why it is a zero. It was 600 —
  // ten minutes of REAL play, `checkPour` being handed `real` and not the
  // slowed step the way `SWAT`'s five beats are wall time — and 600 was right
  // when her lap was 52.37 s, because the alternative was 9.4 seconds of cut
  // every fifty and that is a tic rather than a scene. Her journey is minutes
  // long now. The lap has become the cooldown, and a second one on top of it is
  // what was turning every other trip into nothing. Misha's own reasoning, and
  // it is the right one: *"this might mean each of her journeys' trips should
  // be much longer than 52s"* — a longer trip is what makes an every-time
  // cut-scene bearable, so the trip pays for it and this does not have to.
  //
  // Turn it up and it is a rate limit again, in seconds of real play. Nothing
  // else reads it.
  again: 0,
  // And what a probe means by "not now". `__fr.pour.seen(true)` and the scrub
  // in `__fr.pour.frame` both park the cooldown here: long enough to be out of
  // the way of any run that is supposed to be without the cut, and a number
  // rather than a second latch of the kind this whole block is a history of.
  hold: 3600,
  // HOW LATE THE CAMERA MAY BE, and the number is the water's and not a
  // preference.
  //
  // Misha, 10 Sep 2026: *"i don't see the cut-scene of bucketeer baye for some
  // reason"*, and then *"widen the arm window"*.
  //
  // It was 0.25 s, and it was widened to 0.50 to buy a player who was watching
  // her the extra quarter second `pourEyes` needed to bank. There is no
  // `pourEyes` any more and nothing is late: `checkPour` runs every frame and
  // the first frame of `tip` is inside this window, so what the window means
  // now is only "she is at the TOP of the pour and not half way down it" — the
  // definition of the beat the shot exists for, and the guard on a cut being
  // started by anything that jumps her clock.
  //
  // 0.50 AND NOT MORE, because the cut's clock IS her clock — `pourPlace` is a
  // pure function of it — so joining late does not restart the shot, it starts
  // it already running. Traced at 1/60 s, `st.pour` is zero until **0.52 s**,
  // crosses 0.55 at 0.62, peaks at 1.02 and is dry again by **1.23**: the whole
  // pour this cut exists to show is a 0.71 s event. So 0.50 is the last frame
  // at which the camera still arrives BEFORE the water does, and 1.25 — which
  // `pushFor` would have made a tidy-looking number — is a cut that opens on a
  // woman standing over a channel holding an empty bucket.
  arm: 0.50,
  // ── the two shots, in HER frame at the tip point: metres in front of her,
  // metres to her right, metres above her feet. Both the eye and the point it
  // is pointed at, because a shot is a line and not a position.
  // RAISED, AND THE REASON IS THAT THIS SHOT NOW PLAYS EVERY TRIP.
  //
  // It used to sit at 0.60 m — knee height — and aim at 0.66, which is the
  // bail. At 30 degrees and 2.4 m that is 1.29 m of frame centred on the
  // bucket, so her head was out of it by a third of a metre and the crop
  // landed on her hips. As an insert on a shot nobody saw twice that was
  // arguable; at one firing every five minutes it reads as a camera that
  // missed, and the place it crops is the worst available.
  //
  // THE FIRST TRY AT THE FIX WAS WORSE THAN THE FAULT, and it is worth saying
  // why, because it is the trap this shot sets. Raising the eye to 1.15 and the
  // aim to 1.05 does put her head in frame — and it puts the WATER out of it.
  // The jet runs from the lip to the paving, so a frame that starts at her
  // knees has thrown away the event the cut exists for; A/B'd against the old
  // build at one deterministic instant (`frame(0.75)`, pour 0.692, roll 0.48),
  // the old shot had a bright column of water down the left of frame and the
  // raised one had none at all — the pail's own body occluding it from the
  // steeper angle, with the ground under it below the bottom edge.
  //
  // So the shot has to hold about 1.8 m of subject — her crown at 1.62 down to
  // the wet paving at 0 — and the only way to buy that without a wide-angle
  // lens on a person is to stand further back. 3.28 m at 34 degrees is 1.96 m
  // of frame from -0.08 to 1.88, and the 0.30 m push still leaves 16 cm of air
  // over her head at the end of it. Checked at 0.02, 0.30, 0.75, 1.50 and 2.20
  // s: head in, feet in, jet in, at every one.
  a: { eye: [3.28, 1.76, 1.10], at: [0.15, 0.30, 0.90], fov: 34 },
  b: { eye: [1.577, 2.751, 1.50], at: [0.00, 0.00, 1.42], fov: 26 },
  push: 0.30,        // m of lean-in on shot A, and then it stops
  // s, which is when the last of the water is down. (1.540.0) The pour is a
  // swing-toss now and the water leaves when the physics says, so this is
  // read off the throw's own table rather than typed here — see `TOSS` in
  // 45-bucketeer.js.
  pushFor: TOSS.dry,
  // ── how long, on her clock. `cut` is the frame the pail comes upright.
  cut: POUR_INTO.rest,
  // 1.75 s past the pick-up, and the three numbers inside it are the reason.
  // The tilt below lands at 0.90; the composition it lands on — her striding
  // off with the pail swinging, the wet paving she made, the channel behind —
  // then stands in the CLEAR for half a second; and only then does the fade
  // take the last 0.35. That order is the fly cut's own hard-won correction,
  // written over `SWAT.still`: its fade used to eat the end of the move, so the
  // frame the whole shot existed to arrive at was never once seen lit.
  len: POUR_INTO.up + 1.75,
  // And the one move shot B makes, once the pick-up is over and there is
  // nothing left to hide. See the note in `pourPlace`.
  tilt: 0.35,
  tiltFor: 0.90,
  fade: 0.35,        // s of the end of it that goes to black
  back: 0.45,        // and how long the game takes to come back up out of it
  // ── and the one thing she says.
  line: 'tip_evo',
  // While the sheet is in the air — `TOSS.mid`, for the same reason.
  lineAt: TOSS.mid,
};

/** The cut, or null. */
let pourCut = null;
/** Has it ever played this session. Reported, and nothing gates on it. */
let pourSeen = false;
// Seconds of real time before it may run again, and zero all the way down
// unless somebody has turned `POUR.again` up or a probe has parked it at
// `POUR.hold`. `pourSeen` is the other question — whether it has EVER played —
// and the two have answered different questions since the latch became a
// clock.
let pourAgain = 0;
/**
 * Her clock as of last frame, so that the top of a pour is a RISING edge.
 *
 * The trigger is one window on `pourClock()` and a window is not an event: a
 * cut skipped at 0.3 s of a 0.50 s window would leave her clock still inside
 * it, and with no cooldown to hide behind the next frame would start the same
 * pour again. Read and rewritten at the top of `checkPour`, before every guard,
 * so it is never stale by a frame nobody sampled.
 */
let pourEdge = -1;
/**
 * What the last pass of `checkPour` decided, as one of its own clause names.
 *
 * `__fr.pour.why()` used to be a second implementation of the gate, reading
 * every number back from outside the frame and re-deriving the answer. Two
 * copies of a seven-clause conjunction is two copies to keep in step, and the
 * one that goes stale is the one nobody runs. So the decision is written where
 * it is made and the handle only reports it.
 */
let pourWhy = 'boot';
/** Seconds of coming back up out of the black, after the cut has ended. */
let pourBack = 0;
/**
 * The fly cam's clock, or −1 when it is down. Started by `startFlyCam` when a
 * spoken "drop your buckets" lands (src/49-ears.js); run on wall time in the
 * frame loop and drawn in the corner by the render above.
 */
let flyCamT = -1;
/**
 * ── THE POCKET ──
 *
 * Misha, 16 Sep 2026: *"ok so how do i buy a pack of cigarettes at the
 * Tisak?"*, and asked how he wanted it: real euros, and the transaction on its
 * own for now.
 *
 * Twenty euros, because a note out of a machine is twenty and because it is
 * enough to stand at a counter half a dozen times before the answer is no. It
 * is a session and not a save: nothing here is written down anywhere, so a
 * reload is a fresh twenty, and that is the same trade every other bit of
 * state in this game makes.
 *
 * AND `bought` IS THE SATCHEL, seen from out here. It was a plain object and
 * it is now a view onto the one bag in src/62-satchel.js — same reads, same
 * writes, same names, and `buyAt` below and `drinkBeer` in 61-beer.js did not
 * change a line for it. The whole argument is written over `satchelBought`.
 */
const POCKET = { eur: 20.00, bought: satchelBought(), pick: 0 };
/** Which shot the fly cam is showing: `drop`, `dance`, `birthday`, `brush` or
 *  `site`. */
let flyCamMode = 'drop';
/** Held by `__fr.ears.flyCam(t)`, for a scrub — the same switch as `swatHold`. */
let flyCamHold = false;
/** Debug only: draw the fly cam over the whole frame. See `__fr.ears.flyCam`. */
let flyCamBig = false;
function startFlyCam(mode = 'drop') {
  if (!jadrija || !jadrija.vik) return false;
  flyCamMode = (mode === 'dance' || mode === 'birthday' || mode === 'brush'
    || mode === 'site') ? mode : 'drop';
  flyCamT = 0;
  flyCamHold = false;
  const el = $('flycam');
  if (el) el.hidden = false;
  return true;
}
/**
 * The clock `__fr.pour.frame` scrubbed to, so the flies' insert is in the
 * scrubbed picture too — the real cut is `pourCut` and has its own clock. −1
 * is none; `startPour` clears it.
 */
let pourInsertT = -1;
const _pourEye = new THREE.Vector3();
const _pourAt = new THREE.Vector3();

/**
 * Where she is in the run, in seconds, or −1 if she is not in it at all.
 *
 * HER clock and not one of ours. See the note above: the shot boundary is
 * `tipIn + tipHold + tipOut` and it has to be the frame the pail is upright,
 * not a wall-clock guess at when that was.
 */
function pourClock() {
  const b = jadrija && jadrija.bucketeer;
  if (!b) return -1;
  const k = b.beat();
  const base = POUR_INTO[k.phase];
  return typeof base === 'number' ? base + k.t : -1;
}

/**
 * The two cameras, in world metres, off where she is standing NOW.
 *
 * Taken once when the cut starts and never again: both shots are locked off,
 * and a rig recomputed every frame off a woman who walks out of the second one
 * would follow her out of it.
 */
function pourRig(b) {
  const w = b.where();
  const y = b.stats().yaw;
  const fx = Math.cos(y), fz = -Math.sin(y);
  const rx = Math.sin(y), rz = Math.cos(y);
  const put = (v) => new THREE.Vector3(
    w[0] + fx * v[0] + rx * v[1], w[1] + v[2], w[2] + fz * v[0] + rz * v[1]);
  const R = { aEye: put(POUR.a.eye), aAt: put(POUR.a.at),
    bEye: put(POUR.b.eye), bAt: put(POUR.b.at) };
  R.lean = R.aAt.clone().sub(R.aEye).normalize();
  return R;
}

/** Put the camera where the cut wants it at `t`. Returns which shot that is. */
function pourPlace(R, t) {
  let eye, at, fov, shot;
  if (t < POUR.cut) {
    const u = sat(t / POUR.pushFor);
    const e = u * u * (3 - 2 * u);
    _pourEye.copy(R.aEye).addScaledVector(R.lean, POUR.push * e);
    eye = _pourEye; at = R.aAt; fov = POUR.a.fov; shot = 'A';
  } else {
    eye = R.bEye; fov = POUR.b.fov; shot = 'B';
    // Shot B is locked off for five of its five and a half seconds, and then
    // it tilts 35 cm down over the last one — which is an operator following
    // somebody who has picked something up and is walking away, and is the one
    // move in this cut that is not the camera arriving somewhere.
    //
    // It is also what hands the bucket back. The frame's bottom edge is set
    // where it is to keep both transfers out of the picture, and it succeeds so
    // well that at 3.17 m it is still 14 cm clear of the pail's rim after she
    // has picked the thing up — so without this she walks off with a bucket
    // that is 5 cm of blue at the bottom of the frame. Started at
    // `POUR_INTO.up`, which is the frame `held` reaches 1 and the last frame
    // there is anything to hide: by the time the tilt has taken the edge past
    // the rim, a third of a second later, the pail has been hanging off her
    // fist for eight frames. It brings the wet paving into the shot with it,
    // which is the other thing worth ending on.
    const u = sat((t - POUR_INTO.up) / POUR.tiltFor);
    _pourAt.copy(R.bAt);
    _pourAt.y -= POUR.tilt * u * u * (3 - 2 * u);
    at = _pourAt;
  }
  if (Math.abs(camera.fov - fov) > 1e-3) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camOverride = [eye.x, eye.y, eye.z, at.x, at.y, at.z];
  return shot;
}

/**
 * Is this the one? It is, every time, and the whole argument is at the top of
 * this block.
 *
 * There is nothing about the player in here any more — not where he is
 * standing, not which way he is looking, not what is between the two of them.
 * What is left is her clock, and the ways a cut would be a bug rather than a
 * scene.
 */
function checkPour(dt) {
  // HER CLOCK FIRST, above every guard and every return, because this is the
  // one line in the function that has to run on a frame that fires nothing:
  // `pourEdge` is only a rising edge if it was sampled on the frame before.
  const t = pourClock();
  const was = pourEdge;
  pourEdge = t;
  // ONE CLAUSE TO A LINE, AND EACH ONE NAMES ITSELF ON THE WAY OUT. The old
  // version was a conjunction and `__fr.pour.why()` was a second copy of it
  // that recomputed every number from outside the frame — which is how you get
  // a debug handle reporting clauses the game no longer has. `pourWhy` is the
  // decision itself, written where it is made, so the two cannot drift.
  if (pourCut) { pourWhy = 'rolling'; return; }
  // The cooldown, which is zero unless somebody has set it — `POUR.again`.
  if (pourAgain > 0) { pourAgain -= dt; pourWhy = 'cooldown'; return; }
  const b = jadrija && jadrija.bucketeer;
  if (!b) { pourWhy = 'noBucketeer'; return; }
  // ON FOOT, and this one clause is the Canadair guard and every other one at
  // once: `fly`, `crashing`, `lost`, `swim`, `ride` and `brod` are all
  // not-ground. A cut that hijacks the camera off a drop run over a fire is not
  // a scene, it is a crash.
  if (state.phase !== 'ground') { pourWhy = 'notAfoot'; return; }
  if (!ground || !ground.ok) { pourWhy = 'noGround'; return; }
  if (state.paused) { pourWhy = 'paused'; return; }
  // NOBODY ELSE HOLDING THE CAMERA. `camOverride` is most of that list in one
  // test — the walk-up, the computer, the race and the trampoline all go
  // through it — and the other four are named because they do not.
  if (camOverride || swatCut || vikWalk || comp || dipPhase) {
    pourWhy = 'owned'; return;
  }
  // SHE IS ACTUALLY POURING, at the top of it and not half way down.
  if (!(t >= 0 && t <= POUR.arm)) { pourWhy = 'notPouring'; return; }
  // AND THIS IS A NEW TIP. The frame her clock ENTERS the window, not every
  // frame it spends inside one — see `pourEdge`, and the skip it exists for.
  if (was >= 0 && was <= POUR.arm) { pourWhy = 'sameTip'; return; }
  pourWhy = 'fired';
  startPour();
}

/**
 * Take the camera.
 *
 * The branch is shut off with it, for the reason `startSwat` gives: nine
 * seconds of hose is 83 litres of a 400 litre pack spent on a cone of droplets
 * computed for a camera that is somewhere else.
 */
function startPour() {
  const b = jadrija && jadrija.bucketeer;
  if (!b || pourCut) return false;
  pourCut = pourRig(b);
  pourInsertT = -1;
  // Where the walker was, put back every frame. A cut is a cut: coming out of
  // one three metres from where you went into it, because a key was held down
  // through a shot you could not see yourself in, reads as the game having lost
  // track of you. The floor goes with it — `put` takes a `yHint` and the porch
  // has a terrace 2.80 m over it, so asking `walkY` cold here is how you end up
  // standing on the balcony.
  pourCut.stood = [ground.you.x, ground.you.z, ground.you.yaw, ground.you.pitch,
    ground.you.y];
  pourCut.wall = 0;
  pourCut.was = -1;
  pourCut.stuck = 0;
  pourCut.said = false;
  // Armed here and not when it finishes, which mattered when the cooldown was
  // ten minutes and still says the right thing at zero: a cut skipped in its
  // second second is a cut that was seen and turned down, so what it costs is
  // counted from where it started. What actually stops a skip re-offering
  // itself on the next frame is `pourEdge`, not this.
  pourSeen = true;
  pourAgain = POUR.again;
  ground.setSpray(false);
  // AND THE LENS PUT BACK, which the swat does not have to do and this does.
  // `stepLens` is not called under an override — see the note where it is
  // skipped — so a zoom left half in when the cut takes the camera stays half
  // in, and the whole world keeps running at `1 - (1 - SLOW) * zoom` for the
  // length of it. That is nothing to the swat, whose five beats are wall time.
  // It is everything here: this cut's clock is HER clock, so a player who
  // walks up to the porch with a finger on Z would get the same nine seconds
  // of her stretched over half a minute of his.
  zoom = 0;
  // The ear goes to the camera for the length of it — a live reference, so it
  // is never a frame stale. See `BUCK.ear`.
  BUCK.ear = camera.position;
  // The room's own letterbox, which is the intro's. The skip button goes with
  // it: it belongs to the film and it calls `beginFlight`.
  $('cine-skip').hidden = true;
  $('cine').hidden = false;
  $('ground-hud').hidden = true;
  if (IS_TOUCH) $('gtouch').hidden = true;
  requestAnimationFrame(() => { if (pourCut) $('cine').classList.remove('open'); });
  return true;
}

/** Give it all back. `faded` is true only when it ran to the end of itself. */
function endPour(faded) {
  if (!pourCut) return;
  pourCut = null;
  camOverride = null;
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  BUCK.ear = null;
  // Out of the black the way it went in, but only if it got there. A SKIP is
  // instant and always has been everywhere else in this game: somebody who
  // presses Escape is asking for the game back, not for a fade.
  pourBack = faded ? POUR.back : 0;
  const el = dipEl();
  if (el) el.style.opacity = faded ? '1' : '0';
  $('cine').classList.add('open');
  setTimeout(() => { if (!pourCut) $('cine').hidden = true; }, 800);
  $('cine-skip').hidden = false;
  $('ground-hud').hidden = false;
  if (IS_TOUCH) $('gtouch').hidden = false;
  if (!IS_TOUCH) grabPointer();
}

/** One frame of it. */
function stepPour(dt) {
  if (!pourCut) return;
  const b = jadrija && jadrija.bucketeer;
  if (!b || state.phase !== 'ground') { endPour(false); return; }
  const S = pourCut;
  S.wall += dt;
  const t = pourClock();
  // The dead man's handle, and it watches HER CLOCK rather than counting wall
  // seconds. A loop that has stopped — held from the console, or stopped by
  // somebody who has managed to stand in her way — would otherwise leave the
  // camera parked on the porch for the rest of the session. A plain cap on
  // wall time would do it too and would be wrong for the same reason `zoom` is
  // cleared above: her seconds and the wall's are not the same seconds the
  // moment anything touches the lens, and a cap tight enough to be a safety
  // net at 1.0 would cut the shot in half at 0.35.
  if (t < 0) { endPour(false); return; }
  if (t > S.was + 1e-4) { S.was = t; S.stuck = 0; } else S.stuck += dt;
  if (S.stuck > 2.5) { endPour(false); return; }
  if (t >= POUR.len) { endPour(true); return; }
  ground.put(S.stood[0], S.stood[1], S.stood[2], S.stood[3], S.stood[4]);
  pourPlace(S, t);
  if (!S.said && BUCK.say && t >= POUR.lineAt) { S.said = true; b.say(POUR.line); }
  const el = dipEl();
  if (el) el.style.opacity = String(sat((t - (POUR.len - POUR.fade)) / POUR.fade));
}

/** And coming back up out of it, once the cut itself is over. */
function stepPourBack(dt) {
  if (pourBack <= 0) return;
  pourBack = Math.max(0, pourBack - dt);
  const u = pourBack / POUR.back;
  const el = dipEl();
  // Squared, so it clears the last of the black quickly and dwells near the
  // light — the shape `crossThreshold` uses for the kabina, and for the same
  // reason: that is what an iris opening looks like.
  if (el) el.style.opacity = String(u * u);
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
  //
  // Unconditionally, and no longer only when `inWater()` agrees. `inWater()`
  // reads the phase, `leaveWater` reads the phase again, and the whole of the
  // mask-at-the-vikendica report is what happens when one of those two
  // readings is of a phase that has already moved. On dry land it costs three
  // hidden divs being hidden again; in the water it is the difference between
  // a shot and a shot with somebody else's breath bar over it.
  const wasWet = inWater();
  leaveWater();
  if (eject) eject.reset();
  if (wasWet) state.phase = 'fly';
  if (!startVikWalk()) {
    // There is no house to walk up to. Say so rather than leaving the phase
    // parked between the water it has just left and the staircase it never
    // reached — which is a state with no controls attached to it.
    if (wasWet) toast(T('ground.noPlane'));
    return;
  }
  // The walk-up drives the camera itself. Anything else that was holding it —
  // a race cut torn down half a second ago, a laptop — has to let go, or the
  // shot plays underneath somebody else's frame.
  camOverride = null;
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
  /**
   * AND THE FLOOR UNDER `back`, WHICH IS THE SAME BUG AS THE PROMENADE'S.
   *
   * Misha, 7 Sep, about the third person on foot: *"the camera ... slices right
   * through me so i see sorta 'inside' myself"*. It slices out here too, and it
   * was worse for being invisible: the front plane in the water is normally
   * pulled in to a few centimetres by `bedNow`, so over the shallows off the
   * beach nothing shows. Out in the channel the bed is twenty metres down, the
   * plane goes back to its standing 1.2 m, and the shot is 1.17 m off her toes.
   * Measured with `__fr.swim.bodyGap` at (-2212, 658): 1.189 m cruising and
   * 1.169 m nose-down, both inside the plane, both a pair of feet cut off flat.
   *
   * `stand` is the plane and `reach` is her, and unlike the promenade she is a
   * body LYING DOWN — a column round her own axis is the wrong shape and a
   * sphere round her root is the right one, because the pitch swings her whole
   * length about that point. Measured off her own skinned buffer: the `swim`
   * clip reaches 0.988 m from the root and `tread` 0.557, so 1.05 and 0.65
   * are those with a centimetre or two on top.
   *
   * There is nothing out here to collide with, so unlike the promenade this
   * never has to give up and hand the frame back: the lens simply goes further
   * back until she fits. Measured at the same two places, that is a tenth of a
   * metre on 2.5 and it buys 1.277 and 1.275 — which is why the framing this
   * file argued for is still the framing you get.
   */
  stand: 1.20,
  reach: 1.05,
  reachUp: 0.65,
};

/**
 * The jump, which only the third person can see and which was a plank.
 *
 * Misha, 27 Aug: "when i use B to see myself do a jump i just lift up
 * completely straight... it should look more natural with the bending of the
 * knees for the jump and while i'm in the air i should be moving my legs".
 * He was watching `ground.you.hop` translate a standing idle two metres into
 * the air and back, because that is all there was: the hop is an arc applied
 * to her feet and nothing in the rig knew it was happening.
 *
 * Two aims a leg, in the rig's own sagittal axis, which is exactly what Baye
 * already does clearing a bench — see `SHOW.tuck` in 43-jadrija.js. The hips
 * bring the knees up and the knees fold the heels back under her.
 *
 * `air` is the shape of the arc and not a second clock: `hop / apex` is a
 * triangle that is zero on the deck at both ends and one at the top, so the
 * knees come up as she rises and the legs are down again by the time there is
 * anything to land on. 43-jadrija.js learned that the expensive way — read off
 * a timer, the knees were still 0.58 of the way up when her feet met the deck
 * and she landed folded.
 *
 * `crouch` is the other half and it is a compromise worth naming. A jump reads
 * as crouch, drive, tuck, reach, absorb, and the first of those cannot happen
 * here: `ground.hop()` launches on the keystroke, the hop is an escape hatch
 * as much as a move, and putting a hundred milliseconds of wind-up in front of
 * an escape hatch is a worse bug than a stiff jump. So the crouch is spent at
 * the two ends where it still reads — a fast straightening out of the first
 * 0.13 s of the rise, which is a push-off, and a longer fold on touchdown,
 * which is an absorb. She is four centimetres off the deck for the first and
 * on it for the second, and neither is long enough to look at.
 *
 * `drop` is what stops the crouch floating her: folding a hip and a knee
 * shortens the leg, and with the root between her feet the feet are what come
 * up. Sinking the root by the shortening puts them back on the concrete.
 */
const JUMP = {
  // GROUND.hopV squared over twice GROUND.hopG. Written out rather than
  // computed so that changing the hop and forgetting this one shows up as a
  // tuck that peaks early rather than as nothing at all.
  apex: 2.04,
  // These are the second set. The first — 0.62 and 0.95 — were picked to be
  // conservative and were simply not visible: measured at the apex through
  // `__fr.swim.jump`, they carried the knee 0.25 m forward and the foot 0.08 m
  // off its standing height, which at the four metres the third person puts
  // you at is a leg that has not moved. Baye clears a bench at 0.95 and 1.20
  // and reads as a jump; this is that, and a little more knee, because she is
  // not clearing anything and the whole shape is the point.
  // 0.62 and 0.95, back down from 0.95 and 1.30. The larger pair was chosen
  // because the first cut "was invisible" at four metres — and that reading
  // was taken off a render I had framed wrongly, which is the same mistake
  // twice in one object. Measured, 0.62 carries the knee a quarter of a metre
  // and the foot 80 mm; that is not invisible, it is a jump. 0.95 folds her
  // knees to her chest, which from behind in the third person is somebody
  // being winched up in a ball.
  tuck: 0.62,             // rad the knees come up at the top of the arc
  knee: 0.95,             // and how far the heels fold back under her
  // A jump is not symmetrical and a symmetrical one is uncanny — two legs
  // doing the identical thing at the identical moment is a puppet on one
  // string. Twelve per cent apart is not a scissor kick, it is one leg leading
  // the other by a frame or two, which is what a person does.
  // Six per cent, down from twelve. The idea is right — two legs doing the
  // identical thing at the identical moment is a puppet on one string — and
  // twelve was too much of it: on a deep tuck it reads as a scissor kick and
  // the hips look wrong from any angle but the side, which is the one angle
  // it was checked at.
  split: 0.06,
  crouch: 0.45,           // rad of hip flex in the push-off and the landing
  crouchKnee: 0.85,       // and the knee that goes with it
  // The arms. Up and back on the way, which is where they go: the swing is
  // half of what a standing jump is made of and leaving them hanging reads as
  // somebody being lifted rather than jumping.
  arm: 0.40,
  // m the root sinks so the crouch does not lift her. Measured off the same
  // probe: a fold of this size takes the foot about 45 mm off the deck, and a
  // crouch that leaves her standing in the air is worse than no crouch.
  drop: 0.045,
  push: 0.13,             // s the push-off takes to straighten
  land: 0.24,             // s the landing takes to come back up
};
let jumpWas = 0, jumpPush = 0, jumpLand = 0, jumpPosed = false;

/** Third person in the water: off, or on with the mask down. */
const _look = new THREE.Vector3();
/** A pretend jet landing at `at` for `t` more seconds, for testing the crabs. */
let crabJet = null;
/** Scratch for the crabs' clack, which is panned off the camera's right. */
const _crabV = new THREE.Vector3(), _crabR = new THREE.Vector3();
let bodyCam = false;

/**
 * B, and the two buttons that are B on a phone.
 *
 * Only in the water and on foot, because those are the two modes with a body
 * to look at; in the aeroplane the outside views are `CAMS` and `cycleCamera`
 * is that question's answer. `syncBodyBtn` is what makes the button honest —
 * `bodyCam` is also cleared by `leaveGround`, and a lit button over a
 * first-person view is worse than no button.
 */
function toggleBodyCam() {
  // On the tower B is not a switch but a dial — her eyes, round her, the
  // judge's chair, the water under the board, the deck behind her — because
  // the ask was to see the dive "from different angles". `bodyCam` is only
  // "anything but her eyes" there, so it hands the swim the right answer
  // when she comes up.
  if (state.phase === 'plunge' && plunge) {
    const i = plunge.cycleCam();
    bodyCam = i > 0;
    syncBodyBtn();
    toast(T('plunge.cam.' + plunge.cam));
    return;
  }
  if (state.phase !== 'swim' && state.phase !== 'ground'
    && state.phase !== 'brod') return;
  bodyCam = !bodyCam;
  syncBodyBtn();
  toast(TK(bodyCam ? 'body.on' : 'body.off',
           bodyCam ? 'body.onTouch' : 'body.off'));
}

function syncBodyBtn() {
  for (const id of ['t-body', 't-sbody']) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', bodyCam);
  }
}
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
/**
 * Take the jump back off her.
 *
 * `aim` holds a rotation until it is handed a zero, which is exactly what it
 * has to do for a pose that is driven every frame and exactly wrong for one
 * that is driven by a branch. Turn the third person off at the top of a hop,
 * or press R, and the ground branch below simply stops running — and she
 * carries the tuck into the next thing she does. A swimmer stroking out to the
 * marker with her knees folded under her is not a subtle bug, but it only
 * happens if you press B in mid-air, which is to say it would have shipped.
 */
function clearJump() {
  if (!you || !jumpPosed) return;
  jumpPosed = false;
  jumpWas = 0; jumpPush = 0; jumpLand = 0;
  for (const b of ['legUL', 'legUR', 'legLL', 'legLR', 'armUL', 'armUR', 'armLR']) {
    you.fig.aim(b, 0, 0, 1, 0);
  }
}

/**
 * HER CROUCH, which until 1.539.1 was the camera's alone.
 *
 * Misha, 28 Sep 2026: *"when i press 'B' to see me (Chloe) from external
 * camera, and then press 'Shift' to crouch, Chloe doesn't actually crouch,
 * just the camera lowers itself.. but I/Chloe should also crouch, for
 * consistency."* Shift took the eye from 1.66 m to `GROUND.kneel` and nothing
 * else — so in the third person she stood at full height with the lens at her
 * chin, and in the vikendica's bathroom mirror, which hangs her off the
 * camera by a standing eye, she was two-thirds of a metre into the floor.
 *
 * A SQUAT, SOLVED ON HER OWN LEGS. Nothing here is typed as a pose except
 * three things a person chooses — how far the shins lean over the boots, how
 * far the back bows, how far the chin comes back up — and the rest is
 * whatever puts her eyes where the lens is. The lens goes down 0.66 m; the bow
 * takes some of that (its share is measured through her own spine chain), and
 * each thigh is then folded by exactly the angle that drops her hips the
 * remainder with that shin lean. The thighs come out about level, which is a
 * flat-footed full squat and what an eye a metre off the ground is on a woman
 * her height.
 *
 * `aim` composes in FIGURE space, and all of these are one axis — +z, the
 * rig's sagittal hinge; see the jump below for how that was learned — so they
 * add down the chain. The thigh at +a and the knee at −(a + c) leave the shin
 * leaning −c; the foot at +c then brings the boot back to exactly the clip's
 * attitude, flat on the ground. The arms take the bow back and a little more,
 * so they hang forward over her knees for balance instead of trailing along a
 * back that has tipped.
 *
 * FEET PLANTED. Folding a leg about the hip moves the ankle up and forward of
 * the pelvis, and the root is the pelvis — so she is lowered by the hips' drop
 * and moved BACK by the ankles' travel, which leaves both boots where standing
 * had them, the hips back over the heels and her head forward over her toes.
 * Both legs are solved to the same drop rather than the same angle, because
 * her idle stands one foot ahead of the other and the same angle on both
 * would put one boot in the ground.
 *
 * The depth is solved on the idle clip's first frame, taken once off the clip
 * itself (not off whatever she happens to be playing when Shift goes down,
 * which mid-stride is a leg that is not a standing leg). Walking, each leg is
 * then re-reached every frame against the walk as it is — see `crouchSolve`.
 *
 * Every state that is not on foot takes it straight back off (`clearCrouch`):
 * the water, the tower, the boats and bikes, the chase cut — each of those
 * drives her itself.
 */
const CROUCH_YOU = {
  // rad the shins lean forward over the boots at the bottom. Flat-footed: an
  // ankle takes about 35° before the heel has to come up, and 0.62 is that.
  shin: 0.62,
  // rad of forward bow, laid up the spine 0.45 / 0.33 / 0.22 as Baye's crouch
  // at the plate lays hers (43-jadrija.js) — a back that bends, not a hinge.
  bow: 0.55,
  // rad the neck takes back, so she looks ahead and not at the ground between
  // her boots. Less than the bow: a crouched head is carried slightly down.
  chin: 0.40,
  // rad forward on the upper arms beyond giving the bow back, and on the
  // forearms: hands forward over the knees rather than trailing.
  arm: 0.34, elbow: 0.55,
  // rad each knee swings out about the line from hip to ankle — see
  // `crouchLeg`.
  splay: 0.30,
  // How much of the walk's stride she takes crouched, and the clip is run
  // faster by one over it so the ground still goes by at the same speed.
  // With her hips 0.36 m up, the walk's full stride puts the trailing boot
  // 0.39 m behind her and there is no leg that reaches it with the knee above
  // the ground — MEASURED at 1.0 it was 0.12 m under the promenade. Half is a
  // crouched shuffle, which is what a person does down there.
  stride: 0.50,
  // And the rate's ceiling crouched, over the walk's 2.4: at 1.36 m/s half a
  // stride wants 2.96, and a shuffle is quick.
  rate: 3.0,
  // m the knee joint is kept off the ground: a kneecap's worth, and a little.
  knee: 0.12,
  // How much of the walk's arm swing she loses crouched — see `crouchSolve`.
  swing: 0.65,
};
let crouchIdle = null, crouchPosed = false, crouchIdx = null;
const CROUCH_BONES = ['legUL', 'legUR', 'legLL', 'legLR', 'footL', 'footR',
  'spine01', 'spine02', 'spine03', 'neck', 'armUL', 'armUR', 'armLL', 'armLR'];
const CROUCH_READ = ['legUL', 'legLL', 'footL', 'legUR', 'legLR', 'footR',
  'spine01', 'spine02', 'spine03', 'neck', 'eyeR', 'armUL', 'armLL', 'armUR', 'armLR'];
// Scratch for `crouchGeometry`, which runs every frame she is crouched.
const _crS = { q: null, t: new Float32Array(3), wq: [], wt: [], lq: new THREE.Quaternion() };

/**
 * Her legs and spine as `clip` has them `t` s in, in figure space: each leg
 * as hip-to-knee `t` and knee-to-ankle `s`, and the spine as five points up
 * to her eye. Sampled off the clip and composed exactly as `update` does, so
 * it is this frame's leg and not the last one — which matters mid-stride.
 */
function crouchGeometry(fig, clip, t) {
  const nb = fig.bones.length, S = _crS;
  if (!crouchIdx) {
    crouchIdx = CROUCH_READ.map((n) => fig.boneIndex(n));
    if (crouchIdx.some((i) => i < 0)) crouchIdx = [];
  }
  if (!crouchIdx.length) return null;
  if (!S.q) {
    S.q = new Float32Array(nb * 4);
    for (let i = 0; i < nb; i++) { S.wq[i] = new THREE.Quaternion(); S.wt[i] = new THREE.Vector3(); }
  }
  if (!fig.sample(clip, t, S.q, S.t)) return null;
  const { restT } = fig.rest();
  for (let i = 0; i < nb; i++) {
    const p = fig.bones[i].parent, q = S.q;
    S.lq.set(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]);
    if (p < 0) { S.wq[i].copy(S.lq); S.wt[i].set(S.t[0], S.t[1], S.t[2]); continue; }
    S.wq[i].multiplyQuaternions(S.wq[p], S.lq);
    S.wt[i].set(restT[i * 3], restT[i * 3 + 1], restT[i * 3 + 2])
      .applyQuaternion(S.wq[p]).add(S.wt[p]);
  }
  const P = crouchIdx.map((i) => S.wt[i]);
  const leg = (H, K, F) => ({ t: [K.x - H.x, K.y - H.y], s: [F.x - K.x, F.y - K.y],
    z: F.z - H.z });
  return {
    L: leg(P[0], P[1], P[2]), R: leg(P[3], P[4], P[5]), hy: 0.5 * (P[0].y + P[3].y),
    spine: [P[6], P[7], P[8], P[9], P[10]].map((v) => [v.x, v.y]),
    // Each upper arm's pitch in the plane, shoulder to elbow.
    armL: Math.atan2(P[12].y - P[11].y, P[12].x - P[11].x),
    armR: Math.atan2(P[14].y - P[13].y, P[14].x - P[13].x),
  };
}

// A turn of `v` about +z by `a`, in the sagittal plane: x forward, y up.
const crRotX = (v, a) => v[0] * Math.cos(a) - v[1] * Math.sin(a);
const crRotY = (v, a) => v[0] * Math.sin(a) + v[1] * Math.cos(a);

/**
 * The thigh fold that drops this leg's hip by `drop` with the shin leaning
 * `c`. Bisected: the hip's height is monotone in the fold from straight down
 * to well past level, and sixteen halvings are a tenth of a millimetre.
 */
function crouchFoldFor(L, c, drop) {
  const y0 = L.t[1] + L.s[1], sy = crRotY(L.s, -c);
  const hipDrop = (a) => crRotY(L.t, a) + sy - y0;
  let lo = 0, hi = 2.4;
  if (hipDrop(hi) <= drop) return hi;
  for (let i = 0; i < 16; i++) {
    const m = (lo + hi) * 0.5;
    if (hipDrop(m) < drop) lo = m; else hi = m;
  }
  return (lo + hi) * 0.5;
}

/**
 * One leg, two bones, in the sagittal plane: the thigh and shin turns (about
 * +z, figure space) that put this ankle at `dx, dy` from the hip with the
 * knee in front. Lengths are the leg's own as projected into the plane, which
 * is what a turn about z preserves; out of reach, the leg goes straight.
 */
function crouchReach(L, dx, dy) {
  const T = Math.hypot(L.t[0], L.t[1]), S = Math.hypot(L.s[0], L.s[1]);
  const d = clamp(Math.hypot(dx, dy), Math.abs(T - S) + 1e-4, T + S - 1e-4);
  const ph = Math.atan2(dy, dx);
  const al = Math.acos(clamp((T * T + d * d - S * S) / (2 * T * d), -1, 1));
  const th = ph + al;                              // + is the knee forward
  const kx = T * Math.cos(th), ky = T * Math.sin(th);
  const sh = Math.atan2(dy - ky, dx - kx);
  return [th - Math.atan2(L.t[1], L.t[0]), sh - Math.atan2(L.s[1], L.s[0]), ky];
}

/**
 * The whole crouch at depth `w`, 0..1, over `clip` at `t` s — or null
 * standing. See above.
 *
 * The drop and the step back are the IDLE's, and fixed for a given depth:
 * they are where her root goes, and a root that breathed with the stride
 * would bob the whole of her. Each ankle is then put exactly where the clip
 * has it NOW, lifted by the drop and moved forward by the step back — which
 * in the world is exactly where the clip has it standing, because the root
 * moved the other way by the same two numbers. So a planted boot stays as
 * planted as the walk plants it, and a lifted one lifts by the walk's lift.
 *
 * FOLDING THE WALK DID NOT WORK and it is worth saying why. Laid on the walk,
 * one fold for the whole cycle put the planted boot 86 mm into the promenade
 * at the back of every step and lifted the other 0.34 m: with the thigh near
 * level, the walk's ±0.3 rad of thigh swing is a knee going up and down, not
 * forward and back. Re-solving the fold per leg per frame fixed the heights
 * and left a stride a fifth as long, so at a crouched 1.36 m/s the boots
 * skated forward at 0.9 m/s. Putting the ankle where the walk puts it — a
 * two-bone reach per leg — is the answer to both, and it is also the idle's
 * answer: standing still it lands on the fold above to the millimetre.
 */
function crouchSolve(w, clip, t) {
  if (w < 0.003 || !you) return null;
  if (!crouchIdle) crouchIdle = crouchGeometry(you.fig, 'idle', 0);
  const G = crouchIdle;
  if (!G) return null;
  const C = CROUCH_YOU;
  const c = C.shin * w, b = C.bow * w, ch = C.chin * w;
  // Her eye through the bow: each segment of the chain turned by everything
  // aimed at or above it. `aim` about −z is a turn by −angle about +z.
  const P = G.spine;
  const turns = [-0.45 * b, -0.78 * b, -b, -b + ch];
  let ey = P[0][1];
  for (let k = 0; k < 4; k++) {
    ey += crRotY([P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]], turns[k]);
  }
  const bowDrop = P[4][1] - ey;
  // What the hips have to find: all of the lens's descent the bow did not.
  const drop = Math.max(0, w * (GROUND.eye - GROUND.kneel) - bowDrop);
  const ahead = (L, a) => crRotX(L.t, a) + crRotX(L.s, -c) - (L.t[0] + L.s[0]);
  const back = 0.5 * (ahead(G.R, crouchFoldFor(G.R, c, drop))
    + ahead(G.L, crouchFoldFor(G.L, c, drop)));
  const N = (clip && clip !== 'idle' && crouchGeometry(you.fig, clip, t)) || G;
  // The stride, shortened about where the idle stands each boot.
  const k = 1 + (C.stride - 1) * w;
  // THE KNEE STAYS OFF THE GROUND. The walk kicks the heel up behind her as
  // each leg comes through, and with the hips down here an ankle that high
  // and that far back is reached with the knee in the promenade — MEASURED,
  // 70 mm under it at the back of every swing. A swinging boot is therefore
  // drawn in toward where the idle stands it, an eighth at a time, until the
  // knee clears `knee`; a planted boot never needs it (its knee is 0.3 m up
  // and more), so nothing that is on the ground is moved.
  const floor = C.knee - (N.hy - drop);
  const leg = (L, I) => {
    const ix = I.t[0] + I.s[0] + back, iy = I.t[1] + I.s[1] + drop;
    const wx = ix + (L.t[0] + L.s[0] + back - ix) * k, wy = L.t[1] + L.s[1] + drop;
    let dx = wx, dy = wy, r = crouchReach(L, dx, dy);
    for (let j = 1; j <= 8 && r[2] < floor; j++) {
      dx = wx + (ix - wx) * j / 8; dy = wy + (iy - wy) * j / 8;
      r = crouchReach(L, dx, dy);
    }
    // The line the knee swings out about: hip to ankle, as reached.
    return { a: r[0], n: r[1], u: [dx, dy, L.z] };
  };
  // The walk swings the arms as far as a standing stride does, and laid over
  // arms already carried forward for balance that is a hand going up past
  // her face on every step. So the swing is cut back to what a shuffle has:
  // the clip's own departure from the idle arm, taken off in part.
  const swL = (N.armL - G.armL) * C.swing * w, swR = (N.armR - G.armR) * C.swing * w;
  return { w, b, ch, drop, back, L: leg(N.L, G.L), R: leg(N.R, G.R), swL, swR };
}

// Scratch for `crouchAims`.
const _crA = new THREE.Quaternion(), _crB = new THREE.Quaternion(),
  _crK = new THREE.Quaternion(), _crV = new THREE.Vector3(), _crZ = new THREE.Vector3(0, 0, 1);

/** `aim` takes an axis and an angle; this hands it a whole turn. */
function crouchAimQ(f, name, q) {
  if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  const ang = 2 * Math.acos(Math.min(1, q.w));
  const s = Math.sqrt(Math.max(0, 1 - q.w * q.w));
  if (ang < 1e-4 || s < 1e-6) { f.aim(name, 0, 0, 1, 0); return; }
  f.aim(name, q.x / s, q.y / s, q.z / s, ang);
}

/**
 * One leg: thigh turn `a` and shin turn `n` from `crouchReach`, the jump's
 * hip `h` and knee `k` on top, and the knees let OUT. A squat with the knees
 * together is a woman in a tight skirt perching; with them over the toes it
 * is a squat. Swung about the line from her hip to her ankle, so the ankle —
 * the one point that has to stay where it is — is on the axis and does not
 * move at all, and the boot is then turned back by the whole of it and
 * stands as flat and square as the clip had it.
 */
function crouchLeg(f, up, lo, ft, g, h, k, sv) {
  _crV.set(g.u[0], g.u[1], g.u[2]).normalize();
  _crK.setFromAxisAngle(_crV, sv);                     // the swivel
  _crA.setFromAxisAngle(_crZ, g.a + h);
  crouchAimQ(f, up, _crB.multiplyQuaternions(_crK, _crA));
  _crA.setFromAxisAngle(_crZ, g.n - g.a - k);
  _crB.multiplyQuaternions(_crK, _crA);
  _crK.setFromAxisAngle(_crV, -sv);
  crouchAimQ(f, lo, _crB.multiply(_crK));
  _crA.setFromAxisAngle(_crZ, -g.n);
  crouchAimQ(f, ft, _crA.multiply(_crK));
}

/**
 * Write her legs, back and arms: the crouch `cr` with the jump's hip, knee
 * and arm on top, which simply add because they are the same axis.
 */
function crouchAims(cr, hL, hR, kL, kR, aa) {
  const f = you.fig, w = cr.w;
  const nz = (v) => (Math.abs(v) < 1e-4 ? 0 : v);
  // Figure left is −z, so her left knee goes out the other way round.
  crouchLeg(f, 'legUL', 'legLL', 'footL', cr.L, hL, kL, -CROUCH_YOU.splay * w);
  crouchLeg(f, 'legUR', 'legLR', 'footR', cr.R, hR, kR, CROUCH_YOU.splay * w);
  f.aim('spine01', 0, 0, -1, nz(cr.b * 0.45));
  f.aim('spine02', 0, 0, -1, nz(cr.b * 0.33));
  f.aim('spine03', 0, 0, -1, nz(cr.b * 0.22));
  f.aim('neck', 0, 0, 1, nz(cr.ch));
  const arm = cr.b + CROUCH_YOU.arm * w;
  f.aim('armUL', 0, 0, 1, nz(arm + aa - cr.swL));
  f.aim('armUR', 0, 0, 1, nz(arm + aa - cr.swR + spankArm));
  f.aim('armLL', 0, 0, 1, nz(CROUCH_YOU.elbow * w));
  f.aim('armLR', 0, 0, 1, nz(CROUCH_YOU.elbow * w + spankElbow));
  crouchPosed = true;
}

/** Take the crouch back off her, once — see `clearJump` for why once. */
function clearCrouch() {
  if (!you) return;
  you.lower(null);
  if (!crouchPosed) return;
  crouchPosed = false;
  for (const b of CROUCH_BONES) you.fig.aim(b, 0, 0, 1, 0);
}

function poseSwimBody(dt) {
  if (!you) return;
  // The shot owns her while it is running, and it puts her on a jetty rather
  // than in the water. Nothing here may touch that — including, in
  // particular, the tidy-up below, which would otherwise take her off the
  // boards on the first frame of the cut if the third person happened to be
  // on when R was pressed.
  if (chaseCut) { clearJump(); clearCrouch(); return; }
  // On the tower 61-plunge.js drives her, every bone of it. `_bodyHas` is
  // dropped so the swim, when she comes up, starts her where she is.
  if (state.phase === 'plunge') { clearCrouch(); _bodyHas = false; return; }
  // On somebody's machine: the machine under her and her on it, whichever
  // camera — see `rideBody`.
  if (rideBody(dt)) return;
  // Crouched on foot, whichever camera: the third person below drives her
  // off it, and the first person's mirror hangs her off it through `lower`.
  //
  // Solved against the clip she is about to be drawn in, at the time she
  // will be drawn at: the third person picks it here (and hands the same
  // choice to `drive` below), the mirror leaves her in whatever she is in.
  const onFoot = state.phase === 'ground' && ground && ground.ok;
  let crClip = null, crSpeed = 1, cr = null;
  if (onFoot) {
    const g = ground.you, sp = Math.hypot(g.vx, g.vz);
    if (bodyCam) {
      crClip = sp > 0.35 ? 'walk' : 'idle';
      // The walk clip is authored at about 0.92 m/s — 42-crowd.js measures it
      // and says so — and this mode's top speed is 9.4, which is a tenfold
      // range no cycle survives being stretched across. Clamped to 2.4, so a
      // sprint is a fast walk and not a blur: past that the legs stop reading
      // as legs, and what is actually wrong at 9.4 m/s is the 9.4.
      //
      // Crouched, her boots go where the walk's go on a stride shortened by
      // `CROUCH_YOU.stride` (see `crouchSolve`), so the clip is run faster by
      // the same factor to keep them planted, under a higher ceiling.
      const k = 1 + (CROUCH_YOU.stride - 1) * g.low;
      crSpeed = sp > 0.35 ? clamp(sp / (0.92 * k), 0.6,
        2.4 + (CROUCH_YOU.rate - 2.4) * g.low) : 1;
    } else {
      crClip = you.fig.playing();
      crSpeed = you.fig.state.speed || 1;
    }
    const st = you.fig.state;
    const at = (you.fig.playing() === crClip ? st.curT : 0) + dt * crSpeed;
    cr = crClip ? crouchSolve(g.low, crClip, at) : null;
  }
  if (!cr) clearCrouch();
  // On foot, which is the other half of this now. Kept in front of the swim
  // branch rather than folded into it: everything below is about a body in
  // water — how deep it floats, how far its root leads its eye when it is
  // prone, whether the necklace has come off — and none of that means
  // anything to somebody standing on concrete.
  if (bodyCam && onFoot) {
    const g = ground.you;
    const sp = Math.hypot(g.vx, g.vz);
    you.lower(null);
    // The jump. Edges first: `hop` is the height over the ground and it is
    // exactly zero when she is on it, so leaving and arriving are one
    // comparison each and neither needs a flag from the collider.
    if (g.hop > 0 && jumpWas <= 0) jumpPush = 1;
    if (g.hop <= 0 && jumpWas > 0) jumpLand = 1;
    jumpWas = g.hop;
    jumpPush = Math.max(0, jumpPush - dt / JUMP.push);
    jumpLand = Math.max(0, jumpLand - dt / JUMP.land);
    const air = g.hop > 0 ? clamp(g.hop / JUMP.apex, 0, 1) : 0;
    // Both ends want the same fold, and they cannot overlap — she is either
    // leaving the ground or on it — so the larger of the two IS the crouch.
    const sq = Math.max(jumpPush, jumpLand);
    const hipA = air * JUMP.tuck + sq * JUMP.crouch;
    const kneeA = air * JUMP.knee + sq * JUMP.crouchKnee;
    // Cleared to nothing below a hundredth rather than left at a millionth:
    // `aim` reads zero as "forget this bone" and anything else as a rotation
    // to carry for ever, so a walk with a residual tuck on it never gets its
    // legs back.
    const hp = hipA < 0.01 ? 0 : hipA, kn = kneeA < 0.01 ? 0 : kneeA;
    // THE AXIS IS Z AND IT WAS X FOR THREE RELEASES.
    //
    // Misha, 28 Aug: "the knees/legs bend sideways somehow so weird/ and
    // unnatural and wrong". They did. On this rig x is fore-and-aft and z is
    // lateral — 49-you.js has said so since it was written, in the terms that
    // paint her vest: `front` is a smoothstep on vLocal.x and `trunk` is one on
    // abs(vLocal.z). A rotation about x is therefore ABDUCTION, and every tuck
    // this jump has ever done swung her legs out sideways.
    //
    // (1, 0, 0) was copied from Baye's somersault in 43-jadrija.js without
    // asking what it did, and the measurement that should have caught it was
    // taken and then read with the axes swapped: I wrote down "the knee moved
    // 0.38 m forward" about a number that was z. Measured properly, at 0.7 rad
    // on the hip, x moves the knee 0.29 m sideways and z moves it 0.28 m
    // forward — and z does the same on both legs, so there is no mirror to
    // worry about either.
    const L = 1 + JUMP.split, R = 1 - JUMP.split;
    const ar = air * JUMP.arm;
    const aa = ar < 0.01 ? 0 : ar;
    // Negative on the knee, because the shin folds the heel back under a
    // thigh that has just come forward. Same axis, opposite sense.
    //
    // And the arms on the same axis, which carries the hand forward and up —
    // 0.27 m and 0.11 m at 0.6 rad. That is a swing; x was throwing them out
    // to the sides like a tightrope walker.
    //
    // All of it on top of the crouch, if she is in one — see `crouchAims`.
    if (cr) crouchAims(cr, hp * L, hp * R, kn * L, kn * R, aa);
    else {
      you.fig.aim('legUL', 0, 0, 1, hp * L);
      you.fig.aim('legUR', 0, 0, 1, hp * R);
      you.fig.aim('legLL', 0, 0, 1, -kn * L);
      you.fig.aim('legLR', 0, 0, 1, -kn * R);
      you.fig.aim('armUL', 0, 0, 1, aa);
      you.fig.aim('armUR', 0, 0, 1, aa + colArm + spankArm);
      // And the spank's elbow — see `spankHandTick`. Zero is "forget it".
      you.fig.aim('armLR', 0, 0, 1, spankElbow);
    }
    jumpPosed = hp > 0 || kn > 0 || aa > 0 || spankArm > 0 || spankElbow > 0;
    // Her root is between her feet, so `at` is simply where she stands —
    // `g.y` is already the hopped height, which is why the eye is taken off it
    // directly in `ground.pose`.
    //
    // The yaw is the swim branch's, and for the same reason: the rig faces +X
    // and the walk carries the same quarter turn every other user of it does.
    //
    // Crouched, she goes down by her hips' drop and back along her facing by
    // her ankles' travel, so her boots stay where they stood — `crouchSolve`.
    const cd = cr ? cr.drop : 0, cb = cr ? cr.back : 0;
    you.drive({
      at: [g.x + Math.sin(g.yaw) * cb, g.y - cd - sq * JUMP.drop,
        g.z + Math.cos(g.yaw) * cb],
      yaw: g.yaw + Math.PI / 2,
      // No pitch. Looking up does not lean a walking body back, it moves a
      // head — and the head is not what the camera is behind.
      pitch: 0,
      // Not drawn when the camera could not get behind her — see `THIRD.stand`
      // in 47-ground.js, which is where the whole of "the camera slices into
      // me" is settled. With her back to a wall the pull-back collapses, the
      // shot is the first person in all but name, and a body drawn at that
      // range is not a body: it is her front cut off by the 1.2 m plane and
      // the inside of her back showing through the hole.
      seen: ground.thirdD() > 0,
      clip: crClip,
      // How fast, and why it is clamped: see `crSpeed` above.
      speed: crSpeed,
      wet: false,
    });
    _bodyHas = true;
    return;
  }
  clearJump();
  // First person on foot, crouched: nobody sees her but the mirror, which
  // hangs her off the lens by a standing eye — so fold her the same way and
  // say how far lower and further back her root is than that puts it.
  if (cr) {
    crouchAims(cr, 0, 0, 0, 0, 0);
    you.lower({ dy: ground.you.y - cr.drop - (camera.position.y - GROUND.eye),
      back: cr.back });
  }
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
  //
  // `back` is a floor and not a distance — see `BODY.stand`. The lens slides
  // further down the same line, and only ever further, until the sphere her
  // body turns inside clears the front plane. Solved rather than stepped,
  // because it is one quadratic: the lens runs along a horizontal unit vector
  // at a fixed height, so |lens(b) - root|² is b² - 2pb + q and the larger root
  // is the b that puts her exactly `need` away. `p*p - q + need*need` cannot go
  // negative at a `need` this side of her own reach, and the guard is there for
  // the frame where it does rather than for the case where it should.
  const dx = w.x - _bodyAt.x, dz = w.z - _bodyAt.z;
  const dy = w.y + BODY.up - _bodyAt.y;
  const need = BODY.stand + (prone ? BODY.reach : BODY.reachUp);
  const pb = fx * dx + fz * dz;
  const disc = pb * pb - (dx * dx + dy * dy + dz * dz) + need * need;
  const back = Math.max(BODY.back, disc > 0 ? pb + Math.sqrt(disc) : BODY.back);
  camera.up.set(0, 1, 0);
  camera.position.set(
    w.x - fx * back, w.y + BODY.up, w.z - fz * back,
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
  if (!v || ground.field !== jadrija) return false;
  const { x, y, z, yaw, vx, vz } = ground.you;
  if (y < v.base + HOP.minUp) return false;
  // AND ON THE HOUSE, which is what the note above has always claimed and what
  // the code did not do. The only test was a height, and 4.50 m above the sea
  // is most of this map: the apron stands at 20.05 m, the pine slope behind
  // Jadrija reaches 4.9, so a height on its own says "balcony" about an
  // aerodrome. The other gate is worse than useless here, because it is the
  // one that decides *when*: `minSp` means the jump is stolen precisely while
  // you are moving.
  //
  // Misha, 5 Sep: *"when i'm running around (using the 'Q' button and the 'UP'
  // arrow), i should, at the same time, be able to JUMP up <Enter>"*. He could
  // not, and the whole on-foot mission is on that aerodrome: Enter while
  // moving there threw you under a canopy at 10.5 m/s, and had done since the
  // day the three jumps were collapsed onto the one key (24 Aug) and this one
  // stopped being dead code.
  //
  // `floorAt` answers null off the footprint and a surface height on it, so it
  // is the plinth test the note was describing. The height gate stays in front
  // of it: it is what keeps the ramp up to the front door from counting.
  const [t, s] = jadrija.local(x, z);
  if (v.floorAt(t, s, y) == null) return false;
  // And not from indoors, which the footprint alone does not exclude: the
  // rooms and the terrace share a floor plate, so `floorAt` answers for the
  // living room as readily as for the balcony and a running Enter took you out
  // through your own roof. `indoorsAt` is the line between them — measured, 1
  // in the living room and on the loft deck, 0 on the terrace, which is the
  // one place this was ever about.
  if (v.indoorsAt(t, s, y)) return false;
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

/**
 * Enter, standing on a trampoline bed.
 *
 * Third of the three jumps on the key and the first one tried, because it is
 * the most specific: four squares of black mat in the pine wood behind the back
 * row, and nowhere else in the game does Enter mean this.
 *
 * The physics is `launchOut` — U, the charge under your boots — and that is the
 * ask rather than a shortcut. What a bed does to a body is a very large impulse
 * straight up followed by a very long time in the air with nothing to do, and
 * that is exactly the shape the escape charge already has, down to the canopy
 * streaming at the top of the climb. There is no second parachute here and no
 * second set of numbers: `LAUNCH.up` and `LAUNCH.hang` are integrated by the
 * same `v' = -g - k v²` in 57-eject.js, and the apex is the same 202 m at 5.7 s
 * that U has been giving since it stopped being fifty.
 *
 * What is different is what you see while it happens. U is a fire escape and
 * puts you straight into the first person, because the thing you want from it
 * is to look at where you are going. This is not an escape from anything; the
 * whole of it is the going up, and the going up is the one event in the game
 * that is better watched than had. Hence `startFlyCut`.
 *
 * Declines quietly everywhere that is not a bed, which is everywhere but four
 * squares of one resort — see the note on the Enter block.
 */
function bounceOut() {
  if (!ground || !ground.ok || !ground.active || state.paused) return false;
  if (!eject || eject.active) return false;
  if (!jadrija || !jadrija.onBed || ground.field !== jadrija) return false;
  const g = ground.you;
  // Feet on the cloth. `gy` is what `walkY` answered and is the mat's own
  // height when you are over one; `hop` is how far above that you actually
  // are, and a bed you are sailing over on an ordinary jump has not got you.
  if (g.hop > 0.05) return false;
  const bed = jadrija.onBed(g.x, g.z, g.gy);
  if (!bed) return false;
  launchedFrom = { stranded: ground.stranded };
  ground.bail();
  eject.reset();
  eject.launch(g.x, g.y, g.z, g.yaw, LAUNCH.up, LAUNCH.hang);
  // Not `boom()`. That is a cartridge going off under a pair of boots and it is
  // the right noise for U; this is thirty square metres of sprung cloth letting
  // go, which is the low thump `boots()` already is — 92 Hz down to 38 in a
  // sixth of a second — with the grit in it standing in for the springs.
  if (audio) { audio.boots(); audio.gasp(0.8); }
  alerts.bump(1.6);
  $('ground-hud').hidden = true;
  $('hud').hidden = true;
  if (IS_TOUCH) { $('gtouch').hidden = true; $('touch').hidden = true; }
  startFlyCut(bed, g.yaw);
  toast(T('toast.tramp'));
  return true;
}

/**
 * Enter, on foot: one verb, three things it can mean, and the order they are
 * tried in.
 *
 * Specificity first. A trampoline bed is one square metre of the resort, the
 * vikendica's plinth is one building, and the jump is everywhere else — so the
 * general case is the last rung and it is the one that can always run. That is
 * the whole safety property of this ladder, and it only holds while the two
 * above it decline quietly off the thing they are about, which is what the
 * plinth test in `hopOut` is for.
 *
 * A function rather than three lines inside the keydown handler because it was
 * three lines inside the keydown handler and there is more than one key now:
 * the on-screen pad has no jump, and the day it gets one it must get this
 * ladder and not a second copy of it in the wrong order. Returns which rung
 * answered, which is what a probe wants to read.
 */
function jumpOut() {
  // Not off a bicycle. E is the way off it.
  if (riding()) return '';
  if (bounceOut()) return 'tramp';
  if (hopOut()) return 'balcony';
  return ground.hop() ? 'jump' : '';
}

// -----------------------------------------------------------------------------
// Free as a bird.
//
// Built on the race's cut and not on the title cinematic, and the two are
// genuinely different animals. `intro` in 70-intro.js is text over a held
// image with a fade and a skip button: nothing in the world moves and the whole
// of it is words. This is a camera move on the live scene with a person in it,
// which is what `stepChaseCut` is — camera through `camOverride`, the body
// through `you.drive`, everything hung off a clock. So it is that machinery,
// written out here rather than shared, because the race's shot is five legs
// between fixed points on a jetty and every frame of this one is solved off a
// body that is doing ninety metres a second.
//
// The shot, and why. "Wide-eyed and FREE as a bird" is a feeling and not a
// frame, and the reading taken is: you have to see what she left, and then you
// have to see nothing under her at all. So a third of a second on the ground
// beside the bed while it throws her — the park, the fence, the pines, and her
// going up out of the top of the frame — and then everything after it is her
// against sky with Jadrija shrinking underneath. The camera orbits half a turn
// while it falls away from her, passes under her at the middle of the shot
// looking up, and ends behind her shoulder as the cloth blossoms, which is
// where the first person is about to be.
//
// Her face is the game's own, not a rig invented for this: `face.rate = 0` is
// the skin's word for staring and is what wide-eyed IS here — she stops
// blinking for seven seconds — and `gape` opens her mouth. The smile is kept
// low on purpose, because a smile narrows the eyes in this shader (see
// `setBlink` in 41-skin.js) and narrowed eyes are the opposite of the ask.
// -----------------------------------------------------------------------------

const FLY = {
  // How long the camera stays on the ground with the bed, and where it aims.
  //
  // The aim is a FIXED point three metres over the mat and not her, and that is
  // the whole of what makes this beat work. Tracking her was the first cut and
  // it is unwatchable: ninety metres a second is twenty-one metres of altitude
  // by the time a screenshot lands, so a camera pointed at her has tilted
  // through sixty degrees inside a third of a second and the frame is empty
  // sky with a speck in it — the park, the fence, the four beds and the pines,
  // which are the only reason to be on the ground at all, are all off the
  // bottom of it. Held on the bed instead, she streaks up out of the top of a
  // frame that stays on what threw her, which is what a launch looks like.
  //
  // Placed off the bed's own two clear bearings rather than at an angle taken
  // from her heading, and inside the cage rather than outside it: the mesh is
  // opaque black at this range, and a camera on a bearing that follows the
  // player is a camera behind a black panel about half the time. Diagonally,
  // because neither axis on its own is far enough back — five metres of gravel
  // seaward and two metres to the end of the row.
  bed: 0.30,
  bedOut: 4.3,    // m seaward of the bed centre
  bedAlong: 4.6,  // and m down the row towards the middle of it
  bedH: 2.00,     // m over the mat, which is about somebody watching
  // Where it looks, over the mat. 2.4 rather than 3.4 for one reason: the
  // vertical field is 58°, so the aim decides which of the bed and the sky the
  // frame gets, and at 3.4 the beds are thirty degrees down and off the bottom
  // of it. At 2.4 the park sits in the lower third and she is in shot up to
  // about six metres of altitude, which at ninety metres a second is the first
  // seventieth of a second — this beat is the park, and she is a streak.
  bedAim: 2.80,
  // And the whole thing. Seven seconds, the same as the race's cut, and it is
  // measured rather than chosen: the canopy streams at LAUNCH.hang + tumble =
  // 5.70 s and is full 1.15 s after that, so a shot that ends before 6.85 ends
  // before the thing it is about.
  dur: 7.0,
  /**
   * Where the camera is, as [t, radius, height, azimuth, aim].
   *
   * Radius and height are metres from her eye; azimuth is measured from the
   * angle that ends up directly behind her, so the orbit lands square on the
   * first person's heading however she was facing when the bed let go. `aim` is
   * how far above her eye the camera looks — the canopy's centre is 6.4 m up
   * (EJECT.riser), so the last two keys aim between her and the cloth.
   */
  // The one number that governs all of these is the angle the camera ends up
  // looking UP at: from two hundred metres the horizon is a degree and a bit
  // below level, so anything steeper than about 25° puts the whole of Šibenik
  // off the bottom of the frame and leaves her a figure in an empty blue
  // rectangle. That is what the third key was on the first pass — 6.5 m under
  // her at 9 m out is 38°, and it photographed as nothing at all. Every key
  // here keeps (aim − height) / radius under 0.45.
  keys: [
    [0.30, 7.0, -1.2, -3.60, -0.2],
    [2.10, 13.0, -4.0, -2.90, 0.1],
    [3.70, 8.5, -3.4, -2.05, 0.1],
    [5.40, 16.0, -2.0, -1.10, 2.2],
    [6.30, 22.0, 2.0, -0.45, 3.8],
    [7.00, 9.0, 0.8, 0.00, 0.8],
  ],
  // Her, while it happens. `tread` is the only clip on this rig that is upright
  // with the arms out and the legs loose, which is what a body thrown off a
  // trampoline is and is as close to a bird as fourteen authored actions get.
  spin: 1.30,     // rad/s she turns on the way up, easing out as the cloth fills
  lean: 0.42,     // rad of chest-to-the-sky, gone by the time she is hanging
  roll: 0.22,     // rad of lazy roll, and how fast it goes round
  rollHz: 1.70,
};

/** The trampoline shot, or null. See the block above. */
let flyCut = null;

function startFlyCut(bed, yaw) {
  // The canopy's HUD belongs to the descent and not to this. It comes back in
  // `endFlyCut`, on both the way the shot ends.
  $('chute-hud').hidden = true;
  if (IS_TOUCH) $('ctouch').hidden = true;
  flyCut = {
    t: 0,
    at: bed.at.slice(),
    out: bed.out.slice(),
    along: bed.along.slice(),
    // Where the camera has to finish: behind her, looking the way she is. She
    // faces (−sin yaw, −cos yaw) — see `pose` in 57-eject.js — so behind her is
    // +(sin, cos), and the azimuth of that is π/2 − yaw.
    az: Math.PI / 2 - yaw,
    yaw,
    spun: 0,
  };
}

/** Put the shot away, whether it ran out or was skipped. */
function endFlyCut() {
  if (!flyCut) return;
  flyCut = null;
  camOverride = null;
  if (you) {
    you.drive(null);
    const f = you.fig && you.fig.face;
    if (f) { f.rate = 1; f.gape = 0; f.smile = 0; }
  }
  // Only if you are still under it. Skipping is instant and the canopy is
  // still there; running out is not the only way this ends, and a landing
  // during the shot would leave a chute HUD over a walk.
  if (eject && eject.active) {
    $('chute-hud').hidden = false;
    if (IS_TOUCH) $('ctouch').hidden = false;
  }
}

/** One frame of it. Wall time, like the race's cut and the walk to the house. */
function stepFlyCut(dt) {
  if (!flyCut) return;
  if (!eject || !eject.active) { endFlyCut(); return; }
  flyCut.t += dt;
  const t = flyCut.t;
  if (t >= FLY.dur) { endFlyCut(); return; }
  const P = eject.pos;
  const A = flyCut.az;

  if (t < FLY.bed) {
    // On the ground with the bed, aimed at the bed. See `bedAim`.
    const B = flyCut.at, o = flyCut.out, al = flyCut.along;
    camOverride = [
      B[0] + o[0] * FLY.bedOut + al[0] * FLY.bedAlong,
      B[1] + FLY.bedH,
      B[2] + o[1] * FLY.bedOut + al[1] * FLY.bedAlong,
      B[0], B[1] + FLY.bedAim, B[2],
    ];
  } else {
    const K = FLY.keys;
    let i = 0;
    while (i < K.length - 2 && t >= K[i + 1][0]) i++;
    const a = K[i], c = K[i + 1];
    const u = clamp((t - a[0]) / (c[0] - a[0]), 0, 1);
    const f = u * u * (3 - 2 * u);
    const r = lerp(a[1], c[1], f), h = lerp(a[2], c[2], f);
    const az = A + lerp(a[3], c[3], f), aim = lerp(a[4], c[4], f);
    camOverride = [
      P.x + Math.cos(az) * r, P.y + h, P.z + Math.sin(az) * r,
      P.x, P.y + aim, P.z,
    ];
  }

  if (!you) return;
  // She turns on the way up and stops turning as the cloth takes her weight,
  // which is what a canopy does to a body: the risers are the first thing since
  // the bed that has any say in which way she is pointing.
  const settle = 1 - sat((t - 4.4) / 1.6);
  flyCut.spun += dt * FLY.spin * settle;
  you.drive({
    at: [P.x, P.y - EJECT.eye, P.z],
    yaw: flyCut.yaw + Math.PI / 2 + flyCut.spun,
    pitch: FLY.lean * settle,
    roll: FLY.roll * settle * Math.sin(t * FLY.rollHz),
    clip: 'tread',
    // Fast while she is flying and slow once she is hanging. The clip is
    // authored for somebody keeping their chin out of the water; played at 1.7
    // it is a body scissoring in air, and at 0.45 it is a pair of legs under a
    // parachute, which is the same twenty-eight bones doing two jobs.
    speed: 0.45 + 1.25 * settle,
  });
  const fc = you.fig && you.fig.face;
  if (fc) {
    // Wide-eyed, literally: `rate` is blinks a second and zero is a stare.
    fc.rate = 0;
    fc.gape = (0.22 + 0.50 * sat((t - 0.1) / 0.9)) * (1 - 0.55 * sat((t - 5.2) / 1.3));
    fc.smile = 0.32 * sat((t - 1.2) / 1.4);
  }
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
 * The passage, and what has just gone past.
 *
 * Minutes remaining rather than metres run, because a passenger's question is
 * how long is left, and because 4 469 m means nothing to anybody who has not
 * read the file. It is computed off her *actual* speed rather than off
 * `cruise`, so the five seconds she spends alongside before letting go read as
 * a dash and not as a lie, and so the last three hundred metres — where she is
 * braking — count down slower, which is what braking is.
 */
// Eight, and the walking zeroed, for the reasons written at the call site.
const BROD_FAST = 8;
const BROD_STILL = { fwd: 0, side: 0, sprint: false };
let brodFast = false;
/**
 * ── AND IT RUNS ITSELF UNLESS YOU SAY OTHERWISE ──────────────────────────
 *
 * Misha, 19 Sep 2026: *"the trip to sibenik should be somehow accelerated
 * maybe with time lapse or some trick right now it is too boring"*.
 *
 * The time-lapse has been here since the passage was built and it was behind
 * a key nobody presses: T is named in the hint line on a keyboard and NOT in
 * the touch one, and the FAST button was explicitly hidden on her deck — so
 * on a phone, which is where this gets played, there was no way to reach it
 * at all and the honest nine and a half minutes were the only option there
 * was. A feature you cannot find is a feature you have not got.
 *
 * So the default turns over. She winds on to eight times a hundred metres
 * out — far enough to watch her leave — and the ways OUT of it are the ways
 * anybody would try: press the key, press the button, or simply walk. A
 * walking input while the coast is going by at eight times is somebody who
 * wants to be on the boat rather than on the crossing, and it drops her back
 * to one and stays there.
 *
 * `brodWant` is that choice, and it is per voyage: null until you express
 * one, true or false after.
 */
const BROD_AUTO_AT = 100;      // m under way before it winds on by itself
let brodWant = null;
/**
 * ── AND IT STOPS FOR THE SIGHTS ───────────────────────────────────────────
 *
 * Seconds of ordinary time the passage drops back to after a call.
 *
 * The skipper names seven things on the way over and they are placed by
 * DISTANCE — 40, 520, 800, 1860, 2860, 3470 and 3800 m — which at walking
 * pace is one every eighty seconds and at eight times is one every five. Two
 * of them land within four seconds of each other, and worse: at eight steps
 * to the frame two calls can fire in the SAME frame, and `out` holds one
 * value, so the second one is simply never said.
 *
 * Both are the same fix. A call drops her back to one for four seconds — long
 * enough to read it and to look at the thing being named, which is the whole
 * point of naming it — and the fast loop stops at the first call it fires, so
 * no call can be swallowed by another. The time-lapse picks itself back up
 * afterwards without being asked.
 */
const BROD_CALL_HOLD = 4.0;
let brodHold = 0;

/**
 * T on her deck: let the passage run itself.
 *
 * The same promise the key makes in the other two seats — in the aeroplane it
 * flies the job list, in the water it swims you at the one job, and here it
 * takes the nine and a half minutes off your hands. Somebody else has the
 * controls until you take them back, which you do by pressing it again, by
 * walking into the last 300 m, or by arriving.
 */
function toggleBrodFast(on) {
  if (!brod || !brod.active) return false;
  if (brod.phase === 'slow' || brod.phase === 'alongside') return false;
  brodFast = on == null ? !brodFast : !!on;
  // An explicit answer, which is what stops the auto-engage below putting it
  // straight back on the next frame.
  brodWant = brodFast;
  return brodFast;
}

function paintBrodHud() {
  if (!brod || !brod.active) return;
  const left = Math.max(0, brod.total - brod.run);
  const mins = brod.speed > 0.4 ? left / brod.speed / 60 : null;
  $('br-left').textContent = mins == null ? '–' : (mins < 1 ? '<1' : Math.ceil(mins));
  $('br-run').style.width = (sat(brod.run / (brod.total || 1)) * 100).toFixed(1) + '%';
  const c = brod.call;
  $('br-say').textContent = c ? T(c.key) : '';
  $('br-hint').innerHTML = brod.phase === 'alongside'
    ? TK('brod.ashoreHint', 'brod.ashoreHintTouch')
    : (brodFast ? TK('brod.fast', 'brod.fastTouch')
      : TK('brod.hint', 'brod.hintTouch'));
  if (IS_TOUCH) paintBrodTouch();
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
      : plungeHere() ? T(plunge.blocked() || 'plunge.here')
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
 * Somewhere to stand, from a point in the sea, that cannot come back empty.
 *
 * This is the answer to the same report ten times over. E had three ways to
 * fail — `shoreWalk` finding nothing, `dryLand` finding no beach, the ground
 * mode refusing the locale — and all three ended in a toast reading "no shore"
 * and a swimmer still swimming. A toast is not an outcome for the only key
 * that gets you out of the sea. Measured on the instrumented build none of the
 * three was even firing, which is worse than it sounds: it meant ten reports
 * had been answered by tightening searches that were already succeeding.
 *
 * So the searches stay, and under them there is now a floor. In order:
 *
 *   1. `dryLand` from where the swim walked to, which is the good answer and
 *      the one that gets used off any beach in the game.
 *   2. Rings, outward, to four hundred metres: the nearest sample that the
 *      cover mask calls land and the terrain agrees is above the waterline.
 *      This is what answers on a coast with no beach on it — a channel wall, a
 *      quay, the far side of a headland.
 *   3. The same rings again with the height test dropped, because the DEM is
 *      12.7 m a sample and there are flats where `isSea` says land for sixty
 *      metres while `groundAt` is still reading 0.10.
 *   4. A hand-placed spot: the promenade at Jadrija, sixteen metres up from
 *      the figure, which is the same place `9` puts you and is known to be
 *      standable because a cheat key stands on it. Then the apron.
 *
 * `how` says which rung answered, so a landing that keeps coming out of rung 4
 * is visible in `__fr.modes()` instead of being felt as a teleport.
 */
function landing(from) {
  const [x0, z0, a0] = from;
  const loc = (x, z) => localeAt(x, z, airfield, jadrija, city);
  // `retarget` refuses a locale with no site. Open country always has one, so
  // this only ever matters if the synthesiser is handed something it cannot
  // centre on — but the whole point of this function is that nothing below it
  // is allowed to be the reason E did nothing.
  const ok = (x, z, a, how) => {
    const l = loc(x, z);
    return l && l.site ? { at: [x, z, a], loc: l, how } : null;
  };

  const land = dryLand(x0, z0, a0);
  if (land.dry && land.at && !isSea(land.at[0], land.at[1])) {
    const g = ok(land.at[0], land.at[1], land.at[2], 'dryLand');
    if (g) return g;
  }

  // Rings. Nearest first, so the answer is still the shore you were swimming
  // at rather than whichever bearing the loop happened to start on.
  for (const strict of [true, false]) {
    for (let r = 12; r <= 400; r *= 1.5) {
      const n = Math.max(16, Math.round(r * 0.6));
      let best = null, bestD = 1e9;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const dx = -Math.sin(ang), dz = -Math.cos(ang);
        // A metre and a half further in than the first dry sample, and the
        // sample two metres past that has to be dry as well: landing on a
        // waterline is landing in the sea one wave later.
        const x = x0 + dx * r, z = z0 + dz * r;
        if (isSea(x, z) || isSea(x + dx * 2, z + dz * 2)) continue;
        if (strict && groundAt(x, z) < 0.45) continue;
        const px = x + dx * 1.5, pz = z + dz * 1.5;
        if (isSea(px, pz)) continue;
        const d = Math.hypot(px - x0, pz - z0);
        if (d < bestD) { bestD = d; best = [px, pz, ang]; }
      }
      if (best) {
        const g = ok(best[0], best[1], best[2], strict ? 'ring' : 'ringFlat');
        if (g) return g;
      }
    }
  }

  // The floor. Somebody has swum off the edge of a thirteen-kilometre world
  // and there is genuinely nothing within four hundred metres of them; put
  // them on the promenade rather than leave them in the water, and say so.
  if (jadrija && jadrija.figureAt && jadrija.site) {
    const [ft, fs] = jadrija.figureAt;
    const w = jadrija.toWorld(ft + 16, fs - 1);
    const her = jadrija.toWorld(ft, fs);
    return { at: [w[0], w[2], Math.atan2(-(her[0] - w[0]), -(her[2] - w[2]))],
      loc: jadrija, how: 'promenade' };
  }
  if (airfield && airfield.site && airfield.apron) {
    const [ax, , az] = airfield.apron;
    return { at: [ax, az, airfield.site.yaw], loc: airfield, how: 'apron' };
  }
  return { at: null, loc: null, how: 'none' };
}

// ── the skakaonica, from the water ──────────────────────────────────────────

/** Is she treading water at the foot of the tower's ladder? */
function plungeHere() {
  if (!plunge || state.phase !== 'swim' || !swim || !swim.active) return false;
  if (chaseCut || (chase && chase.active)) return false;
  const y = swim.you;
  return y.depth < 1.2 && plunge.toLadder(y.x, y.z) < plunge.reach;
}

/**
 * E at the foot of the ladder: out of the swim and on to the rungs.
 *
 * Not `leaveWater`, which is a door out of the water altogether and turns
 * the third person off on its way — and the whole point of pressing B out
 * here is to watch her climb. What it shares with it is the HUD going and
 * the tint coming off.
 */
function climbTower() {
  if (!plungeHere()) return false;
  const why = plunge.blocked();
  if (why) { toast(T(why)); return false; }
  const y = swim.you;
  if (!plunge.climb([y.x, y.y, y.z])) return false;
  swim.leave();
  if (mask) mask.reset();
  state.phase = 'plunge';
  $('swim-hud').hidden = true;
  $('under').classList.remove('on');
  $('under').style.opacity = '0';
  $('under').hidden = true;
  wasUnder = false;
  // B out here was the swim's single view; on the tower it is a dial, and a
  // swimmer who had the third person on arrives on its first stop.
  if (bodyCam) plunge.setCam(1); else plunge.setCam(0);
  $('plunge-hud').hidden = false;
  paintPlungeHud();
  toast(T('plunge.climb'));
  return true;
}

/** The splash, as far as the app is concerned: the verdict. */
function plungeEntry(r) {
  if (!r) return;
  toast(T('plunge.q.' + r.word) + ' — ' + r.what + ' · ' + r.score.toFixed(1) + '/10');
}

/** And back into the swim, where she went in, however deep that was. */
function plungeToSwim() {
  if (!plunge || !swim) return false;
  const h = plunge.handover();
  plunge.end();
  const sy = swim.surfaceAt(h.x, h.z);
  swim.enter(h.x, h.z, h.yaw, 0);
  swim.you.depth = clamp(sy - h.y, 0.4, 3.5);
  swim.you.y = sy - swim.you.depth;
  swim.you.pitch = 0.2;
  state.phase = 'swim';
  $('plunge-hud').hidden = true;
  $('swim-hud').hidden = false;
  // Her own eyes hand the body back; behind her, `poseSwimBody` picks it up
  // from where she is on the next frame.
  if (!bodyCam && you) you.drive(null);
  paintSwimHud();
  return true;
}

/** Two lines: how the board is moving under her, and what the keys do now. */
function paintPlungeHud() {
  if (!plunge) return;
  const r = plunge.readout();
  $('pl-read').textContent = T('plunge.read')
    .replace('{d}', Math.round(-r.tip * 100)).replace('{v}', r.v.toFixed(1));
  const h = plunge.hint;
  $('pl-hint').innerHTML = h ? T('plunge.hint.' + h) : '';
}

/**
 * Why the last press of E did what it did.
 *
 * Ten reports of "E does not get me out of the water" were answered ten times
 * by reading the code, and the code has three ways to fail and no way to say
 * which one fired. So it says. `__fr.modes().wade` is the whole of it and the
 * transition tests read it.
 */
let lastWade = null;

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
  if (state.phase !== 'swim') { lastWade = { why: 'phase:' + state.phase }; return false; }
  if (!ground || !ground.ok) { lastWade = { why: 'noGround' }; toast(T('ground.noPlane')); return false; }
  const y = swim.you;
  const far = !swim.canWade();
  const from = far ? shoreWalk(y.x, y.z, y.yaw) : [y.x, y.z, y.yaw];
  // `shoreWalk` returning null is no longer a failure, it is a rung: it means
  // the distance field had nothing to descend, and the ladder below starts
  // from where you are instead. See `landing`.
  const found = landing(from || [y.x, y.z, y.yaw]);
  const spot = found.at;
  // Nothing left that can refuse. `landing` walks a ladder that ends at a
  // hand-placed spot on the promenade, `retarget` is retried against the two
  // built locales if the synthesised one will not have it, and `dropIn` has no
  // exit but `return true`. If this is ever reached there is no walking mode
  // at all, which is a page that failed to build and not a shore that could
  // not be found.
  if (!spot || !ground.retarget(found.loc) || !ground.dropIn(spot[0], spot[1], spot[2], true)) {
    lastWade = { why: 'ground', far, how: found.how };
    toast(T('ground.noPlane'));
    return false;
  }
  lastWade = { why: 'ok', far, how: found.how,
    at: [Math.round(spot[0]), Math.round(spot[1])] };
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
 * E on the mole — get on the boat.
 *
 * There is no key of its own for this and there is not going to be one. E is
 * the door in both halves of this game already, the board is full to the point
 * where the keydown handler keeps a list of what is left, and standing at the
 * head of a mole with a boat alongside is the single most obvious place in the
 * world for "the door" to mean that boat. `canBoard` is seven metres from a
 * mark on the mole and nothing else — see 59-brod.js.
 */
/**
 * Every overlay a mode owns, in one place, for the back doors.
 *
 * `boardBrod` can only be reached from the promenade, so the five it hides by
 * hand are the five that can possibly be up. `__fr.brod.go()` can be called
 * from anywhere — and a sweep of every mode found it: called mid-race it
 * leaves `chase-hud` and the underwater tint up, so a race HUD rides the
 * ferry across the channel and steps ashore at Šibenik with you.
 *
 * Nobody can reach that as a player, which is exactly why it is worth fixing
 * rather than shrugging at. This door is the handle every headless probe
 * leans on, and a harness that lands you in a state the real door cannot
 * produce is a harness that tests a game nobody plays. That already cost a
 * night once, when this same door left the aeroplane's touch controls up and
 * the stick that walks her deck was not on the screen to be driven.
 *
 * One list, so the next mode to grow a HUD shows up here as a missing entry
 * instead of as a panel that will not go away.
 */
const MODE_HUDS = ['hud', 'ground-hud', 'chute-hud', 'swim-hud', 'chase-hud',
  'ride-hud', 'brod-hud', 'under'];

/** Hide every one of them but `keep`, and stop whatever was driving them. */
function clearModes(keep) {
  for (const id of MODE_HUDS) {
    const el = $(id);
    if (el) el.hidden = id !== keep;
  }
  if (chase && chase.active) chase.stop();
}

function boardBrod() {
  if (state.phase !== 'ground' || !brod || !ground || !ground.ok) return false;
  const y = ground.you;
  if (!brod.canBoard(y.x, y.z)) return false;
  if (!brod.enter()) return false;
  // A fresh voyage has no opinion about the time-lapse yet — see `brodWant`.
  brodFast = false;
  brodWant = null;
  brodHold = 0;
  ground.bail();
  eject.reset();
  // Whatever was holding the camera lets go of it here. Nothing should be — but
  // `skipToJadrija` is a whole comment in this file about a back door that
  // moved the player and left a dead cutscene holding the last frame, and this
  // is a door.
  camOverride = null;
  state.phase = 'brod';
  $('ground-hud').hidden = true;
  $('hud').hidden = true;
  $('chute-hud').hidden = true;
  $('swim-hud').hidden = true;
  $('brod-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = true; $('stouch').hidden = false; }
  if (!IS_TOUCH && !pointerLocked) grabPointer();
  paintDeviceText();
  toast(T('toast.onTheBoat'));
  return true;
}

/**
 * E aboard, and it means two different things depending on where she is.
 *
 * Alongside at Šibenik it is the gangway. Anywhere else on those four and a
 * half kilometres it is **over the side**, which is the same rule every other
 * water mode in this game obeys — you never leave the water straight on to
 * land, the sea is the one door — read from the other end: you never leave a
 * boat straight on to land either, unless she is tied to it.
 */
function leaveBrod() {
  if (state.phase !== 'brod' || !brod) return false;
  if (state.paused) setPaused(false);
  return brod.phase === 'alongside' ? landAtSibenik() : overTheSide();
}

/** Off the rail, into the channel, and the swim takes it from there. */
function overTheSide() {
  const at = brod.where();
  if (!swim || !swim.enter(at[0], at[2], brod.heading(), -0.5)) return false;
  brod.leave();
  brod.reset();
  state.phase = 'swim';
  $('brod-hud').hidden = true;
  $('swim-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('gtouch').hidden = true; $('stouch').hidden = false; }
  if (audio) audio.plunge(0.9);
  wasUnder = false;
  paintDeviceText();
  toast(T('toast.overTheSide'));
  return true;
}

/**
 * Alongside the riva, and off her.
 *
 * The step-ashore mark is *walked to* rather than written down: march from the
 * berth toward the cathedral in two-metre steps until `isSea` goes false and
 * the ground is a hand above the water, then take three more. Which means it
 * survives a re-bake of the coastline, and means the one number in it that is
 * a decision — how far past the waterline you stand — is the only one.
 *
 * From there it is `localeAt`, which is the same machinery a parachute landing
 * in the middle of the old town gets: a kilometre and a half of country
 * synthesised round you with the city's own footprints as its walls. Eight
 * hundred of them, in the densest part of Šibenik.
 */
function landAtSibenik() {
  const q = brod.quay;
  if (!q || !ground || !ground.ok) return false;
  const K = placeNamed('katedrala');
  let dx = (K ? K.x : q.x + 90) - q.x, dz = (K ? K.z : q.z - 30) - q.z;
  const L = Math.hypot(dx, dz) || 1;
  dx /= L; dz /= L;
  let hit = null;
  for (let d = 2; d <= 90; d += 2) {
    const x = q.x + dx * d, z = q.z + dz * d;
    if (!isSea(x, z) && groundAt(x, z) > 0.15) { hit = [x + dx * 3, z + dz * 3]; break; }
  }
  if (!hit) { toast(T('toast.noQuay')); return false; }
  // `headingToYaw`, not a hand-rolled `atan2`. The walk model's yaw is not a
  // compass bearing: its forward is `(-sin yaw, -cos yaw)`, so the naive
  // `atan2(dx, -dz)` is the correct answer *mirrored about north* — which put
  // you ashore under the cathedral facing out to sea, and only out to sea in
  // the half of the world where the sign happened to agree.
  const yaw = headingToYaw(dx, dz);
  if (!ground.retarget(localeAt(hit[0], hit[1], airfield, jadrija, city))
    || !ground.dropIn(hit[0], hit[1], yaw, true)) {
    toast(T('toast.noQuay'));
    return false;
  }
  brod.leave();
  brod.reset();
  state.phase = 'ground';
  $('brod-hud').hidden = true;
  $('hud').hidden = true;
  $('ground-hud').hidden = false;
  if (IS_TOUCH) { $('touch').hidden = true; $('stouch').hidden = true; $('gtouch').hidden = false; }
  if (!IS_TOUCH && !pointerLocked) grabPointer();
  if (audio) audio.boots();
  paintDeviceText();
  toast(T('toast.ashoreSibenik'));
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
  // innerHTML and not textContent, which is what this was and which quietly
  // broke four of its own strings. `chase.on`, `chase.lost` and `body.on` have
  // carried a bolded key — "<b>B</b> to get back in your own eyes" — since
  // they were written, and every one of them has been rendering the angle
  // brackets on screen. Nothing here is user input: every string this is ever
  // called with comes out of `T()` and 02-i18n.js, and all thirty-six of them
  // were checked to be plain text or a simple <b> pair before this was
  // changed. If that ever stops being true, this is the line that has to know.
  el.innerHTML = msg;
  el.className = 'on ' + kind;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = kind; }, 1900);
}

// ── HUD ──────────────────────────────────────────────────────────────────────

let hudAcc = 0;
/**
 * Put the aeroplane's instruments away, every frame you are not in it.
 *
 * `updateHUD` DOES NOT RUN ON FOOT — see the dispatch that calls this — so
 * whatever it wrote in its last airborne frame is still sitting in the DOM:
 * "TANK FULL", a stall warning, an autopilot note, a tank hint. The only thing
 * keeping that off the screen is `#hud` being hidden, and every one of the
 * fifteen-odd transitions out of the aeroplane has to remember to hide it.
 * The ones that go through `toggleGround` or `skipToJadrija` do. The debug
 * doors — `__fr.jad.stand`, and everything built on it — do not, and then you
 * are running around Jadrija under a stale set of flight gauges telling you
 * the tank is full.
 *
 * So it is ASSERTED FROM THE FRAME LOOP rather than trusted to a transition,
 * which makes every route correct including the ones nobody has written yet.
 * And it blanks the text as well as hiding the box, because hidden is where a
 * bug hides and blank is where it cannot: if `#hud` is ever shown again by
 * mistake, there is nothing stale left in it to show.
 *
 * Idempotent and guarded, so it costs four string compares a frame and no DOM
 * writes at all once it has settled.
 */
function stowFlightHUD() {
  const h = $('hud');
  if (h && !h.hidden) h.hidden = true;
  for (const id of ['warn', 'ap', 'gpws']) {
    const e = $(id);
    if (e && e.innerHTML !== '') e.innerHTML = '';
  }
  const th = $('tank-hint');
  if (th && th.textContent !== '') th.textContent = '';
}

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
  // `!p.onGround` for the same reason the stall warning above has it, and it
  // was missed here when that one was fixed: a full tank is not news while she
  // is sitting on her wheels, and it is the line people actually complained
  // about seeing over Jadrija.
  if (p.water > CONFIG.tankCapacity * 0.99 && !state.dropping && !p.onGround) {
    w.push(T('warn.tankFull'));
  }
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

  // ── AND THE TANK GOES AWAY ON THE BEACH ─────────────────────────────────
  //
  // Misha, 19 Sep 2026: *"dont need to see the LITRES indicator in jadrija
  // mode"*. There is nothing alight on that concrete and nothing to put out,
  // so a gauge reading 400 litres is four hundred litres of nothing.
  //
  // UNLESS THE BRANCH IS OPEN, and then it is the one number that matters:
  // the hose works down there — it is half of what happens in the kabina —
  // and a tank that empties with no gauge on it is worse than a gauge nobody
  // asked for. `hose()` is the ramp the trigger drives, so this comes up with
  // the water and goes when the water stops.
  const onBeach = !!(jadrija && jadrija.inField
    && jadrija.inField(ground.you.x, ground.you.z, 5));
  $('gh-pack').hidden = onBeach && ground.hose() < 0.02 && !g.refilling;

  const pct = g.packMax > 0 ? g.pack / g.packMax : 0;
  $('gh-fill').style.width = (pct * 100) + '%';
  $('gh-litres').textContent = Math.round(g.pack);
  $('gh-reserve').textContent = T('ground.reserve').replace('{n}', groupNum(g.reserve));
  $('gh-pack').className = pct < 0.18 ? 'low' : '';

  let hint = '', urgent = false;
  if (g.refilling) hint = T('ground.filling');
  else if (g.pack < 1 && g.reserve < 1) { hint = T('ground.empty'); urgent = true; }
  else if (g.pack < 1) { hint = TK('ground.dry', 'ground.dryTouch'); urgent = true; }
  // The boat first. Where she is there is no aeroplane, so the two can never
  // both be true — but the offer that is two metres away wins over the one that
  // is a mile away on principle rather than by luck.
  else if (brod && brod.canBoard(ground.you.x, ground.you.z)) {
    hint = TK('brod.board', 'brod.boardTouch');
  } else if (riding()) hint = T('steal.ride.' + riding().kind);
  else if (stealNear()) hint = T('steal.take.' + stealNear().kind);
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
/**
 * Where the perched birds are, in world metres — resolved from the stations in
 * `audio.perches()` the first frame Jadrija exists and then left alone,
 * because the shore frame does not move and neither do they.
 */
let perchW = null;
/**
 * And the set on the shelf downstairs at the vikendica — see SONG in
 * src/80-audio.js. Four numbers, resolved the same way and for the same
 * reason: the point it plays from, and the height of the slab over it, which
 * is the whole of what keeps it off the birds upstairs.
 */
let songW = null;
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
let cicadaGain = 0.05, cicadaWood = -1;
// True while you are on foot inside the Jadrija field, which is the one place
// the mission is allowed to stop happening. Set at the top of `frame`.
let recess = false;
let lastFrameMs = 0;

// Where the PERSON is, as against where the camera is.
//
// THEY STOPPED BEING THE SAME POINT the day B grew a third person on foot,
// and four things that mean "you" went on asking the camera. Misha, 30 Aug:
// "the rotating camera B mode inside kabine is still messed up and sometimes
// breaks out of the kabine... and sometimes the walls shimmer."
//
// Measured, standing still on the middle of the kabina floor with the lap
// running: she never moves — s 19.65 for fifteen samples — and the camera
// swings between s 17.31, which is the doorway, and s 22.21, which is the
// back wall. `kabina.inside` is a ramp across the door, so it read anywhere
// from 0.14 to 1.00, the Schmitt latch below flipped out and back in, and
// with it went `indoors`: the near clip swung between 0.064 m and 1.194 m
// and the exposure between 0.42 and 0.919. A front plane at 1.2 m in a room
// 4 m across throws away every wall you are standing next to, which is the
// whole of "the walls shimmer" and most of "we end up OUTSIDE" — you are not
// outside, the room has been clipped off in front of you.
//
// So the room is asked about the eye, and the eye is where the walker is.
// 43-jadrija.js has carried the same warning since Baye learned to follow
// you: "this is the WALKER and not the camera; if those two ever agree while
// the third person is on and swung round, something has gone back to reading
// `cam`."
//
// `you.y` is the floor under her boots and `you.eye` is her standing height,
// already eased down by `eyeAt` wherever there is something to duck under.
// The bob and the sway are deliberately left out: they are a few centimetres
// of gait and a threshold has no business flickering at 2 Hz because somebody
// is walking. Under `camOverride` there is no walker to speak of — the cuts
// fly the camera through the house on their own — so the camera stands in.
const personPt = new THREE.Vector3();
/**
 * ── BEING SERVED ──
 *
 * `counterNow` is the shop you are standing at, `paintCounter` is the line on
 * the screen that says so, and `buyHere` is E. All three answer nothing at all
 * unless you are on foot at Jadrija in front of a serving hatch, which is what
 * lets E keep its own meaning everywhere else.
 */
let counterKey = null;
function counterNow() {
  if (state.phase !== 'ground' || !jadrija || !jadrija.counter) return null;
  const p = personAt();
  return jadrija.counter(p.x, p.z);
}

function paintCounter() {
  const el = $('counter');
  if (!el) return;
  const c = counterNow();
  if (!c) {
    counterKey = null;
    POCKET.pick = 0;
    el.hidden = true;
    return;
  }
  // The highlighted row goes back to the top when you walk to a different
  // shop, and stays where it was while you are standing at this one.
  if (c.key !== counterKey) { counterKey = c.key; POCKET.pick = 0; }
  const [, what, price] = c.items[POCKET.pick % c.items.length];
  const line = c.name + ' — ' + what + ', ' + price.toFixed(2) + ' €'
    + '   [E] buy   [, .] menu   ·   ' + POCKET.eur.toFixed(2) + ' € on you';
  el.hidden = false;
  // Only when it has actually changed. This runs every frame — it is how the
  // line knows you have walked away — and a `textContent` write a frame is a
  // layout a frame for a string that changes about once a minute.
  if (el.textContent !== line) el.textContent = line;
}

/**
 * Buy something. With no `key` it is the highlighted row, which is E; with one
 * it is that item by name, which is the microphone — see `BUY` in
 * server/baye/baye.py. Answers a word for what happened, because the ears
 * panel prints it and "nothing happened" is not an answer a player can use.
 */
function buyAt(key) {
  const c = counterNow();
  if (!c) return 'no counter';
  const row = key
    ? c.items.find((it) => it[0] === key)
    : c.items[POCKET.pick % c.items.length];
  if (!row) return 'not sold here';
  const [, what, price] = row;
  if (POCKET.eur + 1e-9 < price) { toast(T('shop.short')); return 'short'; }
  POCKET.eur = Math.round((POCKET.eur - price) * 100) / 100;
  POCKET.bought[what] = (POCKET.bought[what] || 0) + 1;
  toast(what + ' · ' + POCKET.eur.toFixed(2) + ' €');
  paintCounter();
  return 'bought ' + what + ', ' + POCKET.eur.toFixed(2) + ' € left';
}

/** E at a counter. Answers whether it was a counter, so E can carry on if not. */
function buyHere() {
  if (!counterNow()) return false;
  buyAt(null);
  return true;
}

/**
 * ── SOMEBODY ELSE'S BICYCLE (1.550.0) ──
 *
 * Hose a rider off a bicycle or an e-scooter at Jadrija and the machine lies
 * there; E beside it and it is yours, E on it and you step off and it goes
 * over where it is. The machine, the riding and the owner's opinion of all
 * this are `THEFT` in 43-jadrija.js; this is the key, the line on the screen
 * that names it, and her on it (`rideBody`). The third person comes on when
 * you get on — a bicycle is a thing you watch yourself ride — and goes back
 * to what it was when you get off.
 */
let rideCam = null;
function riding() {
  return jadrija && jadrija.steal ? jadrija.steal.riding() : null;
}
/** A machine lying within reach of you, or null. */
function stealNear() {
  if (state.phase !== 'ground' || !ground || !ground.ok || camOverride || !jadrija || !jadrija.steal) return null;
  return jadrija.steal.offer(ground.you.x, ground.you.z);
}
/** E: on to one, or off the one you are on. Answers whether it was either. */
function rideKey() {
  if (!jadrija || !jadrija.steal || state.phase !== 'ground' || !ground || !ground.ok) return false;
  if (riding()) { rideOff(false); return true; }
  const o = stealNear();
  if (!o || !you) return false;
  const m = jadrija.steal.take(o.i, ground.you, you);
  if (!m) return false;
  clearJump();
  clearCrouch();
  ground.you.crouch = false;
  ground.mount(m);
  rideCam = bodyCam;
  if (!bodyCam) { bodyCam = true; syncBodyBtn(); }
  toast(T('steal.took.' + m.kind));
  return true;
}
/** Off it: `stay` when you have been taken somewhere it has not come. */
function rideOff(stay) {
  if (jadrija && jadrija.steal) jadrija.steal.drop(ground ? ground.you : null, you, stay);
  if (ground && ground.mount) ground.mount(null);
  if (rideCam === false) { bodyCam = false; syncBodyBtn(); }
  rideCam = null;
}
/**
 * Her on it, from `poseSwimBody`: true when she is riding and has been
 * posed. Anything that has taken you off the promenade — a back door, the
 * sea, the aeroplane — takes you off the machine first, and it stays where
 * you left it.
 */
function rideBody(dt) {
  if (!riding()) return false;
  if (state.phase !== 'ground' || !ground || !ground.ok || !ground.active || !ground.mounted()) {
    rideOff(true);
    return false;
  }
  const P = jadrija.steal.pose(ground.you, dt, camera.position);
  if (!P || P.drop) { rideOff(true); return false; }
  if (!bodyCam) {
    if (_bodyHas) { you.drive(null); _bodyHas = false; }
    return true;
  }
  you.drive({ at: P.at, quat: P.quat, yaw: P.yaw, pitch: 0, seen: ground.thirdD() > 0,
    clip: 'idle', speed: 0, wet: false });
  _bodyHas = true;
  return true;
}

function personAt() {
  if (!camOverride && state.phase === 'ground' && ground && ground.ok) {
    const y = ground.you;
    return personPt.set(y.x, y.y + y.eye, y.z);
  }
  return personPt.copy(camera.position);
}

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
  // Hands off while the pour cut owns the screen. `#dip` is the only full-frame
  // black in the page and both of us write it every frame, so without this line
  // the idle branch below — which exists to make sure nothing is left dark —
  // would zero the pour's fade on the very frame it started. The walker is
  // pinned through the cut anyway, so there is no threshold for it to cross.
  if (pourCut || pourBack > 0) return;
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
  // Walking away from the resort, baling out, or dying in it all count as
  // having left the room, or you come back to Jadrija already indoors.
  if (!afoot) { inRoom = false; roomStep = null; }
  // Which of the kabina's two rooms is there — the small one everybody sees
  // from outside, or the big one you are in (`KAB.grow`). Swapped at the
  // bottom of the dip below; this only catches every other way of arriving
  // or leaving, and costs nothing when it already agrees.
  if (jadrija && jadrija.kabinaMode) jadrija.kabinaMode(inRoom);
  if (!afoot || !K || !ground || !ground.ok || dipCool > 0) return;

  // The eye and not the camera — see `personAt`. In the third person the cut
  // was being fired by a point up to 3.1 m behind you, so walking in put the
  // screen down a stride and a half after you were already standing in the
  // room, and the lap on its own could carry the camera back out over the
  // sill while you had not moved at all.
  const at = personAt();
  const [t, s] = jadrija.local(at.x, at.z);
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
      jadrija.kabinaMode(true);
      if (jadrija.leashDoor) jadrija.leashDoor(true);
      const w = jadrija.toWorld(K.standIn[0], K.standIn[1]);
      dipPin = [w[0], w[2]];
      ground.stepTo(w[0], w[2]);
      roomStep = [K.standIn[0], K.standIn[1]];
      inLatch = 1;
    });
  } else if (inRoom && prev && prev[1] >= K.face && s < K.face) {
    inRoom = false;
    dipStart(() => {
      jadrija.kabinaMode(false);
      if (jadrija.leashDoor) jadrija.leashDoor(false);
      const w = jadrija.toWorld(K.standOut[0], K.standOut[1]);
      dipPin = [w[0], w[2]];
      ground.stepTo(w[0], w[2]);
      roomStep = [K.standOut[0], K.standOut[1]];
      inLatch = 0;
    });
  }
}

function dipStart(fn) { dipPhase = 1; dipT = 0; dipDo = fn; dipPin = null; }

// ── the changing station ─────────────────────────────────────────────────────
/**
 * Whether Chloe is dressed, and which cubicle she is standing in.
 *
 * `dressed` is the whole of the state and it is deliberately one boolean.
 * There is no wardrobe here and there should not be: a bathing station has
 * exactly two things you can be wearing and the entire point of the hut is
 * that it is where you stop being one of them.
 */
let dressed = true;
let inChg = -1;          // which bay, or -1 for outside
let chgStep = null;      // last (t, s), for the crossing test

/**
 * In and out of the changing station.
 *
 * WALKED, NOT TELEPORTED, which is the opposite of what this was going to be.
 * The hut's footprint is handed to `tightTS`, which answers with a girth of
 * its own — 0.16, a person turned side on — and under it the doorway, the
 * slot beside the screen and the corridor behind it are all a quarter of a
 * metre of free walking. The building is the size the photograph says and you
 * get into it by walking round the screen, which is how you get into the real
 * one. The kabina's dip is still the right answer for the kabina, whose door
 * is a hole in a wall with a room behind it; it is the wrong answer here,
 * where the thing in the way is a screen you walk around.
 *
 * The first cut of this shipped on `GROUND.tight` at 0.26 and could not be
 * entered at all — see `changingStation`, which carries the three numbers and
 * why two of them looked fine.
 *
 * So this is a REGION test and not a crossing. Stepping into either cubicle
 * changes her; stepping out does nothing, because a changing room does not
 * change you back on the way out.
 *
 * The dip stays, and it is doing something real: it is the only way to say
 * that time passed. Without it she flickers from dressed to changed between
 * two frames while standing still, which reads as a bug rather than as an
 * event. Down, black, up — and she is different when it comes back.
 */
function crossChanging(afoot) {
  const C = jadrija && jadrija.changing && jadrija.changing();
  if (!afoot || !C || !ground || !ground.ok || dipCool > 0 || dipPhase
      || state.phase !== 'ground') {
    if (!afoot) { inChg = -1; }
    return;
  }
  // Likewise the eye. This one is a region test rather than a crossing, so
  // the third person's camera swinging through a cubicle would have changed
  // her out of her clothes from the other side of the screen.
  const at = personAt();
  const [t, s] = jadrija.local(at.x, at.z);
  const bay = C.bay(t, s);
  if (bay === inChg) return;
  const was = inChg;
  inChg = bay;
  // Only on the way IN. Walking out is not a second change of clothes, and
  // stepping across the spine from one cubicle to the other is not one either
  // — which you cannot do anyway, but the test is written so that it would not
  // matter if the spine ever came out.
  if (bay >= 0 && was < 0) dipStart(() => setDressed(!dressed));
}

/**
 * Dressed or changed, everywhere it shows.
 *
 * One uniform and one draw range, which is what makes this cheap.
 *
 * The uniform is `uSwim` in 49-you.js and it takes off everything that is
 * paint: the tank, the print, the jeans. The draw range is `wear`, and what it
 * takes off is her boots — 1 188 triangles at the tail of the index buffer,
 * which `write_skin` counts and `loadSkin` re-inflates per call so hers is hers
 * and nobody on the beach loses theirs.
 *
 * That range used to be a hip scarf, and for one release in between it was
 * nothing at all: the scarf was Baye's and came off Chloe's bake in 1.148,
 * which took `shed` to nought and left this call inert on her. The boots put it
 * back, and on a better tenant — a wrap is the kind of thing paint could have
 * done, and a boot is the one thing on her that paint could not.
 *
 * Everything comes OFF, and none of it is replaced. That is what was asked for
 * — "if we walk in with clothes we leave without" — and four releases went
 * into a painted swimming costume that was never part of it.
 */
function setDressed(v) {
  dressed = !!v;
  if (!you) return;
  if (you.fig && you.fig.wear) you.fig.wear(dressed);
  if (you.swim) you.swim(!dressed);
  toast(T(dressed ? 'chg.dressed' : 'chg.changed'));
}

/** What `state.phase` was last frame, so the change itself can be acted on. */
let lastPhase = '';

// FAST-FORWARD, for tests and nothing else. Misha, 27 Sep 2026, on why
// things take an hour: *"do you think we can optimize some of our pipelines
// to somehow build things faster?"*. The measured answer was that most of an
// agent's hour is spent WAITING ON THE WORLD'S OWN CLOCK — a probe asking
// whether the hammock holds watched Baye walk there for 17 s and lie in it
// for 70, two minutes a question, a dozen questions. `__fr.warp(n)` runs the
// world `n` times per animation frame on the same clamped step, and draws
// only the last of them: n x the world per wall second, every step the size
// it always is, so nothing that is stable at 1 is asked to be stable at a
// bigger dt. Off (1) unless a test turns it on; `?warp=n` does it from the
// address bar.
let warp = Math.max(1, Math.min(64, (+QUERY.get("warp")) | 0 || 1));
function frame() {
  requestAnimationFrame(frame);
  // Read the clock even when paused, and read it before anything can bail out.
  // getDelta() reports wall time since it was last read, so an interval that is
  // never read comes back as one enormous dt — and a pause you sat through for
  // thirty seconds would resume by integrating thirty seconds of flight in a
  // single step, straight through whichever hill you were over.
  const wall = Math.min(0.05, clock.getDelta());
  for (let i = warp; i > 0; i--) tick(wall, i === 1);
}

/** One step of the world, and — when `draw` — the picture of it. See `warp`. */
function tick(wall, draw) {
  // Filming. `__fr.filmDt(1/16)` pins the world's step to a fixed number of
  // seconds a frame, whatever the renderer is managing.
  //
  // Wall time is right for a game and useless for a camera. A headless page
  // draws this scene at somewhere between three and thirty frames a second
  // depending on where it is pointed, so a film taken by capturing every frame
  // is a film whose *world* advances by a different amount in every frame of
  // it — the aeroplane crawls over the fire and sprints over the water, and
  // nothing in the footage is at a constant rate. The 0.05 clamp above hides
  // the worst of it and is not a fix: it makes every frame slower than 20 fps
  // identical, and every frame faster than 20 fps not.
  //
  // Pinned, the page is a film camera: N frames is exactly N x dt of world,
  // evenly spaced, reproducible, and independent of the machine it ran on.
  // Nothing but `tools/film.mjs` sets it, and it is off by default.
  //
  // The clock is still read every frame even when it is ignored, for the same
  // reason the comment above gives: an interval nobody reads comes back as one
  // enormous delta the moment somebody does.
  const real = filmDt > 0 ? filmDt : wall;
  // Nothing else: not the sim, not uTime, not even the render. The canvas holds
  // the last frame it drew, which is exactly the picture a pause should show.
  //
  // Except for one asked-for pass, which is how a film gets taken. Paused is
  // the only state in which a recorder can be sure the world advanced exactly
  // once between two captures: left running, an unknown number of animation
  // frames fire while a screenshot is being encoded, and the footage comes out
  // evenly *lit* and unevenly *timed*. See `__fr.filmStep`.
  const filming = filmWant > 0;
  if (state.paused && !filming) return;

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
  //
  // And the boat is on the list unconditionally, which is a stronger claim than
  // the Jadrija one and rests on the same argument. The voyage is nine and a
  // half minutes of standing on a deck watching the channel go by; a fire that
  // spread through all of it would end the mission somewhere off the fortress
  // with nobody in the frame looking at it, every single time, so the side
  // quest would be a way of losing. Get off her and the fire is where you left
  // it — which is also the only honest thing to do with a clock you stopped.
  //
  // AND IN THE WATER, AND ON THE BIKE. Misha, 27 Sep 2026,
  // at Jadrija: the "fire is out" screen came up anyway — *"but i don't care
  // about the fire at this point... ya know?"*. The recess only knew two ways
  // of being here, on foot and under the chute, and only the field itself,
  // which stops four metres out from the edge of the concrete. Swimming out
  // to the diving tower was a way of leaving Jadrija; so was riding a bike.
  // It is anywhere within a quarter of a kilometre of the place
  // now, water included, however you are getting about — Rokići is forty
  // kilometres off, so nothing on the mission's own ground is inside that.
  const atJad = !!jadrija && jadrija.inField(camera.position.x, camera.position.z, 250);
  recess = (atJad && (state.phase === 'ground' || state.phase === 'chute'
    || state.phase === 'swim' || state.phase === 'ride'
    || state.phase === 'plunge'))
    || state.phase === 'brod';

  if (state.phase === 'ground') {
    // The branch, on mouse or space. The aeroplane's own input is deliberately
    // not read: it is parked, and nothing on foot should be moving its controls.
    //
    // And not at all while the swat's cut is running. `startSwat` shuts the
    // branch off, and without this line that lasted exactly one frame: this
    // one, which writes the button straight back on top of it every frame a
    // finger is on it. Five seconds of cut is 46 litres of a 400 litre pack
    // poured at a wall nobody can see, and a trace and a cone of droplets
    // computed for a camera that is somewhere else. It comes straight back the
    // frame the shot ends, because the finger is still down.
    // AND YOUR THUMB INSTEAD OF THE WATER, at her mouth. Misha, 23 Sep 2026:
    // *"in the kabine, and when her mouth is open, instead of spraying with
    // water, it should be my (chloe price)'s thumb reaching for her open
    // mouth and lips"*, and then: *"regardless of whether the mouth is wide
    // open or not... which should cause her to open wider"*. The same button
    // and the same finger on it: in the kabina, facing her, close enough to
    // touch, the branch stays shut and the hand goes out instead — and the
    // thumb on her lip is what opens her mouth. First person only —
    // the view-model arm is the only arm there is to send; in the third
    // person the branch behaves as it always has.
    const pressing = mouseDrop || (keys.has('Space') && !spaceLeapt)
      || TOUCH.gjet || debugJet;
    // IN THE KABINA THERE IS NO HOSE. Misha, 23 Sep 2026: *"sometimes it
    // still breaks and becomes hose. in kabine it should just not be a hose
    // at all. it should be a thumb no matter what."* Every gate below was a
    // way for a press to fall through to the branch — facing her, her facing
    // you, how far — and in there none of them is wanted. So inside, the
    // branch never opens: holding the button walks you round to the front of
    // her face, turns you on to her mouth and brings the thumb up as you get
    // there. If she is not in the room it does nothing at all.
    const inKab = !!(jadrija && jadrija.kabina && jadrija.kabina.inside
      && jadrija.kabina.inside(camera.position.x, camera.position.z) > 0.5);
    if (rightClick) {
      rightClick = false;
      const hit = inKab && jadrija.kabinaPoke
        ? jadrija.kabinaPoke(camera.position, camera.getWorldDirection(_thumbF)) : null;
      // Pointing at nothing it answers to: let go of the mouse. See `freeMouse`.
      rightLast = hit || (freeMouse() ? 'free' : null);
    }
    const lip = jadrija && jadrija.thumbReach ? jadrija.thumbReach() : null;
    const lipD = lip ? Math.hypot(lip.x - camera.position.x,
      lip.y - camera.position.y, lip.z - camera.position.z) : Infinity;
    // Outside the kabina — where she never publishes a lip anyway — the old
    // gates stand: close, in front of her face, and her in your view.
    const lipNear = !!lip && lipD < THUMB_D
      && ((camera.position.x - lip.x) * lip.fx + (camera.position.y - lip.y) * lip.fy
        + (camera.position.z - lip.z) * lip.fz) > 0.5 * lipD
      && camera.getWorldDirection(_thumbF).dot(_thumbV.set(lip.x - camera.position.x,
        lip.y - camera.position.y, lip.z - camera.position.z).normalize()) > 0.77;
    if (lip) thumbAt = lip;
    // HER BREAST, IF THAT IS WHERE YOU ARE LOOKING. Misha, 24 Sep 2026: *"if
    // i have the cross-hairs on or near her breasts instead of thumb in the
    // mouth, the hand should reach towards the breast"*. Decided once, on
    // the frame the button goes down, from where the crosshair is then — not
    // every frame, or turning on to her as you step in would flip it back to
    // the thumb halfway there.
    const brs = inKab && jadrija && jadrija.breasts ? jadrija.breasts() : null;
    const hps = inKab && jadrija && jadrija.hips ? jadrija.hips() : null;
    // Decoded while she is in the room with you, so the first click on her
    // backside is not the silent one that asks for it (see `slap`).
    if (hps && audio && audio.slapWarm) audio.slapWarm();
    if (pressing && !reachWas) {
      reachKind = 'thumb';
      buttHit = null;
      if (brs) {
        const fw = camera.getWorldDirection(_thumbF);
        // Her back to you — see her hair, below.
        const herBack = !!(jadrija.hairBack && jadrija.hairBack(camera.position));
        // Near a breast, and nearer it than her mouth: the mouth keeps the
        // thumb whenever it is the thing you are looking at — from in front
        // of her. From behind, her mouth is on the far side of her head and
        // straight down the same line as the back of it: MEASURED aimed at
        // her crown from 0.6 m behind her, the lip won and the press was the
        // thumb, walking you round to her face. With her back to you it is
        // not in the contest.
        let best = Math.cos(CUP_AIM_R);
        if (lip && !herBack) {
          best = Math.max(best, fw.dot(_thumbV.set(lip.x - camera.position.x,
            lip.y - camera.position.y, lip.z - camera.position.z).normalize()));
        }
        brs.forEach((b, i) => {
          const d = fw.dot(_thumbV.set(b.x - camera.position.x, b.y - camera.position.y,
            b.z - camera.position.z).normalize());
          if (d > best) { best = d; reachKind = 'cup'; cupSide = i; }
        });
        // And low on her: either hip, or the middle below her navel, which
        // means the hip on whichever side of her middle you are aiming.
        if (hps) {
          const cand = hps.spots.map((h, i) => [h, i]);
          cand.push([hps.low, -1]);
          for (const [h, i] of cand) {
            const d = fw.dot(_thumbV.set(h.x - camera.position.x, h.y - camera.position.y,
              h.z - camera.position.z).normalize());
            if (d > best) {
              best = d; reachKind = i < 0 ? 'thigh' : 'hip';
              // Always the hip on YOUR right: it is your right hand, and
              // reaching it to the far one takes the forearm across the
              // front of her.
              const rx = camera.matrixWorld.elements[0], rz = camera.matrixWorld.elements[2];
              const s0 = (hps.spots[0].x - hps.spots[1].x) * rx + (hps.spots[0].z - hps.spots[1].z) * rz;
              cupSide = s0 >= 0 ? 0 : 1;
            }
          }
        }
        // AND HER HAIR, which is "pet her" without saying it. Misha, 25 Sep
        // 2026: *"if the cross-hairs points at her hair, it should trigger the
        // same as 'pet her' already does"* — so it asks for exactly that, once,
        // on the press, and from there it is the petting below with its own
        // ten seconds. The mouth still wins when it is nearer the crosshair.
        const hair = jadrija.hairAim ? jadrija.hairAim() : null;
        if (hair) {
          for (const h of hair) {
            const d = fw.dot(_thumbV.set(h.x - camera.position.x, h.y - camera.position.y,
              h.z - camera.position.z).normalize());
            if (d > best) { best = d; reachKind = 'pet'; }
          }
        }
        // AND HER BACKSIDE. Misha, 25 Sep 2026: *"if cross-hairs click on her
        // butt, play the sound"*. Only from behind her — from the front the
        // same two points sit right under the hips and the crotch, which
        // already mean something — and the click is the whole of it: a sound,
        // no reach, one per press.
        const bt = jadrija.butt ? jadrija.butt() : null;
        if (bt && hps) {
          const mx = (hps.spots[0].x + hps.spots[1].x) * 0.5;
          const mz = (hps.spots[0].z + hps.spots[1].z) * 0.5;
          const bx = (bt[0].x + bt[1].x) * 0.5 - mx, bz = (bt[0].z + bt[1].z) * 0.5 - mz;
          const behind = (camera.position.x - mx) * bx + (camera.position.z - mz) * bz > 0;
          for (const h of behind ? bt : []) {
            const d = fw.dot(_thumbV.set(h.x - camera.position.x, h.y - camera.position.y,
              h.z - camera.position.z).normalize());
            if (d > best) { best = d; reachKind = 'butt'; buttSide = h.side; }
          }
        }
        // AND ALL OF HER BACK, LYING ON HER FRONT ON THE COT. Misha, 28 Sep
        // 2026: *"only about 25% of the spanks land, the others result in
        // nothing ... on various parts of butt, lower back, even middle back,
        // even thighs they should all land, really"*. Face down, every point
        // above is within a hand of every other as you look down at her, and
        // the breast under her back or the hip at her side won the contest
        // as often as a cheek did — see `cotAim` in 43-jadrija.js, which
        // tests the crosshair against her body instead. On her it is the
        // slap, whatever else was nearer by angle — and her head and neck are
        // in that test, so a press nearer them than her back is not on her
        // back, and goes on to the thumb or the pet as before (by angle alone
        // her face is right behind the small of her back, seen from her
        // feet). And off her it is not the slap, however near a cheek's
        // point it passed: the mattress beside her took one in five before.
        //
        // AND IN EVERY OTHER POSE ON THE COT (1.544.0): the same test, and it
        // is the slap where her pose lists it — a thigh on her back, a hip on
        // her side, her bottom kneeling up — and null anywhere else, so her
        // breast, her belly, the inside of her thigh and her mouth are the
        // cup, the stroke and the thumb exactly as they were.
        const bk = jadrija.cotAim ? jadrija.cotAim(camera.position, fw) : null;
        if (bk && bk.miss) { if (reachKind === 'butt') reachKind = 'thumb'; } else if (bk) {
          reachKind = 'butt'; buttSide = bk.side; buttHit = bk;
        }
        // AND HER HAIR FROM BEHIND IS NOT THE PET. Misha, 28 Sep 2026: *"if
        // in the kabine she has her back to us, and cross-hairs goes for the
        // hair, instead of petting her (like from the front), it should pull
        // on the hair"*. The same press on the same points, and one question
        // more: is her face turned away from you — see `pullBack` in
        // 43-jadrija.js, and PULL_RAG for all of what follows.
        if (reachKind === 'pet' && herBack) reachKind = 'pull';
      }
    }
    // THE BELT, when it is in your hand: the press is the swing and nothing
    // else — not the thumb, not a cup, not the hand's own slap. Down winds it
    // up, up lets it go. See `beltPress`.
    if (beltInHand()) {
      if (pressing && !reachWas) { reachKind = 'belt'; beltPress(true); }
      if (!pressing && reachWas && reachKind === 'belt') beltPress(false);
    }
    // THE LEASH, with her on the end of it: the press is a tug and nothing
    // else — not the hose, not a reach. Down winds it up, up lets it go. See
    // `collarPress`. IN EVERY POSE (1.554.0, `collarTuggable`), with two
    // presses left as they were, because they are the OTHER hand's: on the
    // cot, a press on her back, her bottom or a thigh (`cotAim`) is the hand
    // spank — the leash stays in your right, the slap is your left; and at
    // the hammock with the cloth in front of you and in reach, a press is
    // the push it always was — the crosshair ON the cloth, which beside her
    // in it is the one thing that tells the two apart (`hammockOnAim`). (The
    // belt is still not to be had while the leash is in the hand the belt
    // would be in: `belt.collar`.)
    if (collarTuggable()) {
      const s0 = pressing && !reachWas ? collarState() : null;
      const other = s0 && ((s0.mode === 'cot' && reachKind === 'butt' && buttHit)
        || (s0.mode === 'free' && !inKab && hammockOnAim()));
      if (pressing && !reachWas && !other) { reachKind = 'leash'; collarPress(true); }
      if (!pressing && reachWas && reachKind === 'leash') collarPress(false);
    } else if (reachKind === 'leash' && !pressing) { reachKind = null; collarPress(false); }
    // THE HAMMOCK, outside: a press with the cloth in front of you and within
    // an arm is a shove and not the branch, for the whole of the press — see
    // `hammockPush`. Decided on the frame the button goes down, like the reach.
    if (pressing && !reachWas) pressHam = !inKab && reachKind !== 'leash' && !!hammockPush();
    if (!pressing) pressHam = false;
    hammockHold(dt, pressHam && pressing);
    // A probe cannot aim a crosshair to the degree; it can say what it meant.
    if (pressing && reachForce) { reachKind = reachForce[0]; cupSide = reachForce[1]; }
    if (pressing && !reachWas && reachKind === 'pet' && jadrija && jadrija.askShow) {
      jadrija.askShow('pet');
    }
    // The slap is the hand's now, and goes when it lands — see `spankStart`.
    if (pressing && !reachWas && reachKind === 'butt') {
      if (reachForce) spankStart(reachForce[0] === 'butt' ? (reachForce[1] ? -1 : 1) : buttSide);
      else spankStart(buttSide, null, buttHit);
    }
    reachWas = pressing;
    let cupNow0 = pressing && reachKind === 'cup' && brs ? brs[cupSide]
      : pressing && reachKind === 'hip' && hps ? hps.spots[cupSide]
        : pressing && reachKind === 'thigh' && hps ? hps.thighs[cupSide] : null;
    // THE STROKE. Misha, 24 Sep 2026: *"do the stroke along the thigh"* —
    // and, of 'along the leg, not between her legs': *"i don't get the
    // refusal"*. Fair: the line is her genitals, not her inner thighs. So the
    // hand is on the inner face of her thigh, between her legs, and slides
    // down it and back up.
    //
    // AND NOW ON UP HER. Misha, 25 Sep 2026: *"when we pet her thigh, the arm
    // should come up higher, almost all the way to her navel"*. From the old
    // bottom of the stroke, up the front of her thigh, over the fold of her
    // hip outside the line of her hair, and on to her lower belly, until the
    // tips of the fingers are 3.4 cm under her navel — five points on her
    // skin (`path`, see `apprenticeStrokeBind`), and the hand runs along the
    // curve through them by distance, so it keeps one pace over the short
    // steps at the top and the long run up her thigh. A straight line from
    // the bottom to the top stands up to 12 mm off the round of her thigh.
    // Starting where it arrived — where it always did — and going up first.
    //
    // And the fingers — Misha, same evening: *"for that stroke, the finger
    // should reach towards the crotch area"*. Low on her thigh they point up
    // and in at where her legs meet; nearer, up her, and at the top at the
    // point under her navel they stop at (`strokeAim`), laid flat along her
    // skin (`along`), the palm on her (`palm`) — see `updateReach` in
    // 60-arms.js.
    if (cupNow0 && reachKind === 'thigh' && cupNow0.path) {
      thighT = cupK > 0.9 ? thighT + dt : 0;
      const P = cupNow0.path, n = P.length;
      const cum = [0];
      for (let i = 1; i < n; i++) {
        cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y, P[i].z - P[i - 1].z));
      }
      // Only as far up her as there is room for the hand: lying back with
      // her knees drawn up, her thigh is folded down over the top of the
      // path. Asked a few times a second, and eased, so the top of the
      // stroke comes down as she curls up and goes back up as she opens.
      thighCapT -= dt;
      if (thighCapT <= 0 && jadrija.thighOpen) {
        thighCapT = 0.15;
        const op = jadrija.thighOpen(cupSide);
        // Not even the bottom clear: the hand rests there and does not stroke.
        thighCapWant = op == null ? 1 : op < 0 ? 0 : cum[Math.min(op, n - 1)] / cum[n - 1];
      }
      thighCap = thighT === 0 ? thighCapWant : damp(thighCap, thighCapWant, 2.5, dt);
      const L = Math.max(cum[n - 1] * thighCap, 1e-3), sA = Math.min(cum[cupNow0.arrive], L);
      // s(t) = L (1 − cos(ωt + φ)) / 2, with φ putting t = 0 where the hand
      // arrived, on its way up.
      const ph = Math.acos(clamp(1 - 2 * sA / L, -1, 1));
      const s = thighHold != null ? cum[n - 1] * clamp(thighHold, 0, 1)
        : L * (0.5 - 0.5 * Math.cos(thighT * Math.PI * 2 / THIGH_STROKE + ph));
      let i = 1;
      while (i < n - 1 && cum[i] < s) i++;
      const t = clamp((s - cum[i - 1]) / Math.max(cum[i] - cum[i - 1], 1e-6), 0, 1);
      // Centripetal Catmull–Rom through the four round the step: the steps
      // are 5 to 11 cm apart and a uniform spline over steps that uneven
      // overshoots the short ones.
      const Q = [P[Math.max(0, i - 2)], P[i - 1], P[i], P[Math.min(n - 1, i + 1)]];
      const at = catmullC(Q, t);
      const nx = P[i - 1].nx + (P[i].nx - P[i - 1].nx) * t;
      const ny = P[i - 1].ny + (P[i].ny - P[i - 1].ny) * t;
      const nz = P[i - 1].nz + (P[i].nz - P[i - 1].nz) * t;
      const nl = Math.hypot(nx, ny, nz) || 1;
      // Which way the fingers point: see `strokeAim` in 46-apprentice.js.
      const C = cupNow0.crotch, T = cupNow0.tip, V = cupNow0.navel;
      const G = strokeAim([at.x, at.y, at.z], [C.x, C.y, C.z], [T.x, T.y, T.z],
        [V.x, V.y, V.z], [nx / nl, ny / nl, nz / nl]);
      cupNow0 = { ...cupNow0, x: at.x, y: at.y, z: at.z,
        fx: nx / nl, fy: ny / nl, fz: nz / nl,
        off: P[i - 1].off + (P[i].off - P[i - 1].off) * t,
        along: G, up: s / cum[n - 1], cap: thighCap };
    }
    if (cupNow0) cupAt = cupNow0;
    const thumbing = pressing && reachKind === 'thumb' && (inKab ? !!lip : lipNear);
    // AND YOU GO TO HER. Left to herself she stops about a metre and a half off
    // you, which is outside anybody's arm, so while the button is held you
    // walk — at walking pace, through the same `confine` as every step — to
    // THE FRONT OF HER FACE: her lip plus 55 cm along the way her face points,
    // so a press from behind her or from the side comes round to meet her
    // rather than reaching through the back of her head. Your view turns on
    // to her mouth as you go.
    if (thumbing && ground.you && ground.confine) {
      const Y = ground.you;
      const fh = Math.hypot(lip.fx, lip.fz) || 1;
      const gx = lip.x + (lip.fx / fh) * THUMB_STAND, gz = lip.z + (lip.fz / fh) * THUMB_STAND;
      const mx = gx - Y.x, mz = gz - Y.z, md = Math.hypot(mx, mz);
      if (md > settleGap(thumbK)) {
        const step = Math.min(md, THUMB_WALK * dt);
        const [nx, nz] = ground.confine(Y.x + (mx / md) * step, Y.z + (mz / md) * step);
        Y.x = nx; Y.z = nz;
      }
      const hd = Math.hypot(lip.x - camera.position.x, lip.z - camera.position.z);
      const wantYaw = Math.atan2(camera.position.x - lip.x, camera.position.z - lip.z);
      const wantPitch = Math.atan2(lip.y - camera.position.y, Math.max(hd, 0.05));
      let dy = wantYaw - Y.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      Y.yaw += dy * (1 - Math.exp(-6 * dt)) * settleTurn(thumbK);
      Y.pitch += (wantPitch - Y.pitch) * (1 - Math.exp(-6 * dt)) * settleTurn(thumbK);
    }
    // The hand comes up once she is within an arm and a lean, not across the
    // room while you are still walking; and down a little faster than it goes
    // out — a reach is a decision, and letting go is just letting go.
    const reachNow = thumbing && lipD < 0.95;
    thumbK = damp(thumbK, reachNow ? 1 : 0, reachNow ? 4.5 : 7, dt);
    if (jadrija && jadrija.thumbTouch) jadrija.thumbTouch(thumbK);
    // And the breast, the same way: to the front of her, turned on to it, and
    // the hand up once you are within reach of it.
    if (cupNow0 && ground.you && ground.confine && !(reachForce && reachForce[2])) {
      const Y = ground.you, B = cupNow0;
      // Where you stand and what you look at. A breast: in front of it, at
      // it. A hip: in front of HER — its own outward way is sideways, and
      // walking round to it put you over her shoulder looking straight down
      // — and looking at her middle, a hand's span above the hip.
      let fx = B.fx, fz = B.fz, cx = B.x, cz = B.z, ly = B.y;
      if ((reachKind === 'hip' || reachKind === 'thigh') && hps && brs) {
        fx = brs[0].fx; fz = brs[0].fz;
        cx = (hps.spots[0].x + hps.spots[1].x) * 0.5;
        cz = (hps.spots[0].z + hps.spots[1].z) * 0.5;
        ly = B.y + 0.30;
      }
      const fh = Math.hypot(fx, fz) || 1;
      const st = reachKind === 'thigh' ? CUP_STAND - 0.08 : CUP_STAND;
      const gx = cx + (fx / fh) * st, gz = cz + (fz / fh) * st;
      const mx = gx - Y.x, mz = gz - Y.z, md = Math.hypot(mx, mz);
      if (md > settleGap(cupK)) {
        const step = Math.min(md, THUMB_WALK * dt);
        const [nx, nz] = ground.confine(Y.x + (mx / md) * step, Y.z + (mz / md) * step);
        Y.x = nx; Y.z = nz;
      }
      const hd = Math.hypot(cx - camera.position.x, cz - camera.position.z);
      const wantYaw = Math.atan2(camera.position.x - cx, camera.position.z - cz);
      const wantPitch = Math.atan2(ly - camera.position.y, Math.max(hd, 0.05));
      let dy = wantYaw - Y.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      Y.yaw += dy * (1 - Math.exp(-6 * dt)) * settleTurn(cupK);
      Y.pitch += (wantPitch - Y.pitch) * (1 - Math.exp(-6 * dt)) * settleTurn(cupK);
    }
    const cupD = cupNow0 ? Math.hypot(cupNow0.x - camera.position.x,
      cupNow0.y - camera.position.y, cupNow0.z - camera.position.z) : Infinity;
    // Low on her, the thing is well below your eye, so the distance that
    // counts as within an arm and a lean is longer.
    const cupping = !!cupNow0 && cupD < (reachKind === 'thigh' ? 1.30 : 0.95);
    cupK = damp(cupK, cupping ? 1 : 0, cupping ? 4.0 : 7, dt);
    if (jadrija && jadrija.cupTouch) {
      jadrija.cupTouch(cupK, reachKind === 'cup' && arms && arms.forearmAt
        ? arms.forearmAt(_gripAt) : null, reachKind);
    }
    // PETTING HER. Asked for rather than held: "pet her" and for the next ten
    // seconds you go to her, in front of her face, and your hand comes up on
    // to the top of her head and strokes her hair — forehead to crown and
    // back, riding her head wherever it goes. The thumb, if you press for it,
    // wins.
    const petNow0 = !thumbing && jadrija && jadrija.petReach ? jadrija.petReach() : null;
    if (petNow0) petAt = petNow0;
    const petD = petNow0 ? Math.hypot(petNow0.x - camera.position.x,
      petNow0.y - camera.position.y, petNow0.z - camera.position.z) : Infinity;
    if (petNow0 && ground.you && ground.confine) {
      const Y = ground.you;
      const fh = Math.hypot(petNow0.fx, petNow0.fz) || 1;
      // Closer the lower her head is: kneeling, the top of it is a long way
      // down from your shoulder, and you step in over her to reach it.
      const st = PET_STAND - 0.3 * clamp(camera.position.y - petNow0.y - 0.2, 0, 0.4);
      const gx = petNow0.x + (petNow0.fx / fh) * st;
      const gz = petNow0.z + (petNow0.fz / fh) * st;
      const mx = gx - Y.x, mz = gz - Y.z, md = Math.hypot(mx, mz);
      if (md > settleGap(petK)) {
        const step = Math.min(md, THUMB_WALK * dt);
        const [nx, nz] = ground.confine(Y.x + (mx / md) * step, Y.z + (mz / md) * step);
        Y.x = nx; Y.z = nz;
      }
      // Looking at her face, a hand's width under the top of her head — her
      // eyes, not your own knuckles.
      const lx = petNow0.x, ly = petNow0.y - 0.10, lz = petNow0.z;
      const hd = Math.hypot(lx - camera.position.x, lz - camera.position.z);
      const wantYaw = Math.atan2(camera.position.x - lx, camera.position.z - lz);
      const wantPitch = Math.atan2(ly - camera.position.y, Math.max(hd, 0.05));
      let dy = wantYaw - Y.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      Y.yaw += dy * (1 - Math.exp(-6 * dt)) * settleTurn(petK);
      Y.pitch += (wantPitch - Y.pitch) * (1 - Math.exp(-6 * dt)) * settleTurn(petK);
    }
    const petting = !!petNow0 && petD < PET_REACH;
    petK = damp(petK, petting ? 1 : 0, petting ? 3.5 : 6, dt);
    if (jadrija && jadrija.petTouch) jadrija.petTouch(petK);
    // HER HAIR, FROM BEHIND. While the button is held: the hand goes out to
    // where it will close on her hair (stepping you in to it if it is out of
    // reach, the petting's walk), closes once it is there — and from then on
    // it is `hairPull` in 43-jadrija.js that says where the fist is, drawn
    // back toward you with her head coming after it. Let go and it opens.
    const hairWant = pressing && reachKind === 'pull' && jadrija && jadrija.hairGrab;
    let hairNow = null;
    if (hairWant) {
      hairNow = hairHeld && jadrija.hairPullAt ? jadrija.hairPullAt() : jadrija.hairGrab();
      if (hairNow) hairAt = hairNow;
    }
    const hairD = hairNow ? Math.hypot(hairNow.x - camera.position.x,
      hairNow.y - camera.position.y, hairNow.z - camera.position.z) : Infinity;
    if (hairNow && !hairHeld && ground.you && ground.confine && !(reachForce && reachForce[2])) {
      const Y = ground.you;
      // Behind her head, on your own side of it, an arm's length back.
      let fx = camera.position.x - hairNow.x, fz = camera.position.z - hairNow.z;
      const fh = Math.hypot(fx, fz) || 1;
      fx /= fh; fz /= fh;
      // Nearer the lower her head is — on her knees, on all fours, lying on
      // the cot — the petting's rule: you step in over her to reach down.
      const st = HAIR_STAND - 0.25 * clamp(camera.position.y - hairNow.y - 0.2, 0, 0.6);
      const gx = hairNow.x + fx * st, gz = hairNow.z + fz * st;
      const mx = gx - Y.x, mz = gz - Y.z, md = Math.hypot(mx, mz);
      if (md > settleGap(hairK) && fh > st) {
        const step = Math.min(md, THUMB_WALK * dt);
        const [nx, nz] = ground.confine(Y.x + (mx / md) * step, Y.z + (mz / md) * step);
        Y.x = nx; Y.z = nz;
      }
      const hd = Math.hypot(hairNow.x - camera.position.x, hairNow.z - camera.position.z);
      const wantYaw = Math.atan2(camera.position.x - hairNow.x, camera.position.z - hairNow.z);
      const wantPitch = Math.atan2(hairNow.y - camera.position.y, Math.max(hd, 0.05));
      let dy = wantYaw - Y.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      Y.yaw += dy * (1 - Math.exp(-6 * dt)) * settleTurn(hairK);
      Y.pitch += (wantPitch - Y.pitch) * (1 - Math.exp(-6 * dt)) * settleTurn(hairK);
    }
    // And a head well below your eye is further off than an arm and still
    // within one: you bend down to it (the arm leans in — see 60-arms.js).
    const hairReach = !!hairNow && (hairHeld
      || hairD < HAIR_REACH + clamp(camera.position.y - hairNow.y - 0.3, 0, 0.8));
    hairK = damp(hairK, hairReach ? 1 : 0, hairReach ? 5.0 : 7, dt);
    // Closed once the hand is there; held on for as long as the button is.
    if (hairWant && !hairHeld && hairK > 0.92 && jadrija.hairPull) {
      hairHeld = !!jadrija.hairPull(true, camera.position);
    } else if (hairWant && hairHeld) jadrija.hairPull(true, camera.position);
    if (!hairWant && hairHeld) {
      if (jadrija && jadrija.hairPull) jadrija.hairPull(false);
      hairHeld = false;
    }
    // Letting go, the hand opens where the fist was and comes away from there.
    if (!hairWant && hairAt && jadrija && jadrija.hairPullAt) {
      const lg = jadrija.hairPullAt();
      if (lg) hairAt = lg;
    }
    ground.setSpray(!swatCut && !pourCut && pressing && !inKab && !lipNear && !pressHam && reachKind !== 'leash');
    // Unless she is not parked. Walking away from an aeroplane you jumped out of
    // does not stop her flying — and it used to: the only place she was being
    // integrated was the chute branch, so the moment the canopy touched down she
    // froze in mid-air and hung there for the rest of the game, in plain view.
    if (eject.active) flyDerelict(dt);
    // And if that walk was into the sea, it was a walk into the sea. The
    // barrier at the waterline used to be the end of the world in that
    // direction; now it is a doorway, and the far side of it has its own mode.
    //
    // `handover`, not `ground.wet()`. See the note where it is filled in, below
    // `ground.update`: read straight out of the mode this is last frame's
    // answer, and last frame may have been a frame of swimming, in which case
    // it is not an answer at all — it is whatever the walk model was holding
    // when it stopped running, and it holds it for ever.
    if (handover) { const w = handover; handover = null; waadeIn(w[0], w[1]); }
    updateMission(real);
  }

  if (state.phase === 'chute') {
    // Two things are happening at once and only one of them is you. You are
    // hanging under a canopy watching the other one go in.
    flyDerelict(dt);
    // Hands off while the shot has her. Same argument the race makes when it
    // passes `{ held: true }` to the swim: the toggles would be steering a
    // canopy the player cannot see, and a riser hauled during the cut turns the
    // frame the shot was composed for.
    eject.update(dt, flyCut ? { turn: 0, dive: 0, flare: false } : {
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

  // On the tower. Its own phase, like the kite: the swim is
  // left behind at the foot of the ladder and picked up again at the splash.
  if (state.phase === 'plunge' && plunge) {
    if (eject.active) flyDerelict(dt);
    const ev = plunge.update(dt, {
      fwd: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
        - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
      // W or S held as she leaves the board is the dive, and which way.
      lean: keys.has('KeyW') || keys.has('ArrowUp') ? 1
        : keys.has('KeyS') || keys.has('ArrowDown') ? -1 : 0,
      tuck: keys.has('Space'),
      pike: keys.has('KeyC') || keys.has('ControlLeft'),
      twist: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
        - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    });
    if (ev && ev.type === 'top') toast(T('plunge.top'));
    if (ev && ev.type === 'entry') plungeEntry(ev.rate);
    // In her own eyes she is in the sea the moment she is; behind her, the
    // shot holds a second on the water closing over her first.
    if (ev && (ev.type === 'done' || (ev.type === 'entry' && !bodyCam))) plungeToSwim();
    else paintPlungeHud();
    updateMission(real);
  } else if (plunge) {
    // The board rings on after she has gone, whatever she is doing now; and
    // if anything took her off the tower without going through the water,
    // the tower is let go of here.
    if (plunge.active) plunge.abort();
    plunge.tick(dt);
  }

  if (state.phase === 'brod') {
    // She is still going in somewhere behind you, same as under the canopy.
    if (eject.active) flyDerelict(dt);
    const ctl = {
      // The only input on her: two axes of walking her deck. There is no
      // throttle and no wheel — see the header of 59-brod.js.
      fwd: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
        - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + TOUCH.sy,
      side: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
        - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + TOUCH.sx,
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || TOUCH.sfast,
    };
    // Hands on the controls: whoever is walking her deck is not asking for the
    // coast to go by at eight times. This is also the only cancel a thumb can
    // find without being told where to look.
    if (brodFast && (Math.abs(ctl.fwd) > 0.2 || Math.abs(ctl.side) > 0.2)) {
      brodFast = false;
      brodWant = false;
    }
    // And on by itself, once she is clear of the mole — see `brodWant`.
    if (!brodFast && brodWant === null && brod.phase === 'run'
      && brod.run > BROD_AUTO_AT) {
      brodFast = true;
    }
    let out = brod.update(dt, ctl);
    // And the clock, which is NOT her engine.
    //
    // 59-brod.js argues for the nine and a half minutes and the argument is
    // sound: she is a 16 m wooden boat on one diesel, 15.6 knots is what that
    // is, and the subject of this mode is how long and how slow this coast is.
    // So her speed is untouched. What runs faster is the passage, by stepping
    // her integrator again on the SAME frame — seven more times, with the
    // walking zeroed out, so the coast goes by at eight times and you still
    // cross her deck at your own pace. A time-lapse says "time passed". A
    // faster boat would have said "she is a RIB", which is the one thing that
    // note asked us not to say.
    //
    // It gives itself up at `slow`, 300 m out, because coming alongside is the
    // part nobody wants compressed — and because a passage that ends at eight
    // times ends without you noticing it has.
    // The four seconds after a call — see BROD_CALL_HOLD. Real time and not
    // world time: what it is holding open is a thing to read.
    if (brodHold > 0) brodHold = Math.max(0, brodHold - real);
    if (out === 'call') brodHold = BROD_CALL_HOLD;
    if (brodFast && brodHold <= 0) {
      if (brod.phase === 'slow' || brod.phase === 'alongside') brodFast = false;
      else {
        for (let i = 1; i < BROD_FAST; i++) {
          const o = brod.update(dt, BROD_STILL);
          if (o) out = o;
          // At the first call, stop stepping for this frame: `out` holds one
          // value, so a second call in the same frame would replace the first
          // one and never be said at all.
          if (o === 'call') { brodHold = BROD_CALL_HOLD; break; }
          if (brod.phase === 'slow' || brod.phase === 'alongside') {
            brodFast = false; break;
          }
        }
      }
    }
    if (out === 'call' && brod.call) toast(T(brod.call.key));
    else if (out === 'alongside') toast(T('brod.arrived'), 'good');
    paintBrodHud();
    // Not `updateMission`: `recess` is true for the whole voyage, and calling
    // it would still run the clock, the score and the radio over a fire that is
    // deliberately not moving. See the note over `recess`.
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
  if (flyCut) stepFlyCut(real);
  if (swatCut && !swatHold) stepSwat(real);
  if (comp) stepComputer(real);
  // Not while the swat is running: the branch is already shut off, and a
  // second hit on the animal that is currently falling out of the sky would
  // start a second camera sequence over the top of the first.
  else if (!swatCut) { checkLaptopSpray(); checkTvSpray(); checkFlySwat(real); }
  // The Bucketeer's pour, every one of them. It arms itself off her own clock
  // and off nothing else at all — not where you are, not which way you are
  // looking, see `checkPour` — so unlike every other cut in this file there is
  // no key that starts it.
  if (pourCut) stepPour(real);
  // The counter you are standing at, repainted every frame: you walk into it
  // and out of it, and nothing else tells the DOM when that happened.
  paintCounter();
  // And the bottle in your hand, if there is one.
  beerTick(real);
  // And the ice cream, which unlike the bottle is on a clock whether you are
  // eating it or not — see MELT in src/61-cream.js.
  creamTick(real);
  // And the phone, which has a clock, a battery and five seconds of buzz to
  // count down — all of them wall time, like the ice cream and for the same
  // reason. See src/63-phone.js.
  phoneTick(real);
  if (flyCamT >= 0) {
    if (!flyCamHold) flyCamT += real;
    const S = jadrija.vik.fly.shot();
    const camLen = flyCamMode === 'dance' ? S.danceLen()
      : flyCamMode === 'birthday' ? S.birthdayLen()
        : flyCamMode === 'brush' ? S.brushLen()
          : flyCamMode === 'site' ? S.siteLen() : S.dropLen();
    if (flyCamT >= camLen || swatCut || pourCut) {
      flyCamT = -1;
      const el = $('flycam');
      if (el) el.hidden = true;
    }
  }
  else { stepPourBack(real); checkPour(real); }
  if (!camOverride) stepLens(real);
  // And the mix goes with it, water included — the duck and the long tail are
  // most of what makes the lens read as a scope rather than as a zoom, and
  // under water there is a second filter on top of it already, so the two
  // stack into something further off rather than fighting.
  if (audio) audio.slowmo(zoom);
  // Ahead of the override and not inside the chain below it, because `pose` on
  // the parachute is two jobs and only one of them is the camera: it is also
  // the one place the canopy is positioned, scaled and swung on its risers. A
  // shot that takes the camera and skips this leaves the cloth parked wherever
  // it was last frame, which for the trampoline cut is a canopy on the ground
  // at the trampoline park while the person it belongs to is at two hundred
  // metres. The override is applied straight after and has the last word.
  if (camOverride && eject.active) eject.pose(camera);
  if (camOverride) updateCamera(dt);
  else if (state.phase === 'ground') ground.pose(camera, bodyCam ? 3.10 : 0, dt);
  else if (state.phase === 'ride') ride.pose(camera);
  // On her deck the pull-back is 59-brod.js's own number and that file drives
  // its own body — see `pose` and `driveBody` there. 3.10 is ground's figure
  // too, but it is kept where the reasoning for it lives.
  else if (state.phase === 'brod') brod.pose(camera, bodyCam ? BROD.third : 0, dt);
  else if (state.phase === 'swim') swim.pose(camera);
  else if (state.phase === 'plunge') plunge.pose(camera, bodyCam, dt);
  else if (state.phase === 'chute' || eject.active) eject.pose(camera);
  else if (state.phase !== 'intro') updateCamera(dt);
  // Every frame and not inside a branch, which it was while the swim was the
  // only mode with a body. Two modes drive her now, and more than that, the
  // function is also the only thing that ever hands her BACK — so hanging it
  // off a phase meant that leaving that phase with the third person on left a
  // body standing on the promenade with nobody in it. It early-returns in
  // every other case, and it is called after the poses above for the reason
  // its own note gives: the eye is the point both cameras agree about, so the
  // body is hung off the first person's answer.
  poseSwimBody(dt);
  // After the pose, because the rig hangs off where you ended up rather than
  // off where you were.
  if (state.phase === 'ride') ride.draw();
  // The one mode that is drawn when it is *not* running: she lies at the mole
  // whenever you are near enough to see her, which is what makes walking out
  // there something you do on purpose. See `idle` in 59-brod.js.
  // `draw` takes the step and the eye now, for the same reason `idle` always
  // has: her passengers are a crowd, a crowd runs off a clock, and the clock
  // has to be the world's step rather than wall time or a film comes out with
  // twenty-two people moving at the wrong speed. See `drawPax` in 59-brod.js.
  if (brod) {
    if (state.phase === 'brod') brod.draw(dt, camera.position);
    else brod.idle(dt, camera.position);
  }
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
    ballThrowTick(dt);
    hammockPushTick(dt);
    beltHandTick(dt);
    collarHandTick(dt);
    spankHandTick(dt);
    arms.update(dt, chaseCut || bodyCam ? null
      // The belt — see `beltHandTick`. A fist round the buckle, the strap
      // hanging out of the bottom of it; ahead of everything, because while
      // it is in your hand that hand is not free for anything else.
      : state.phase === 'ground' && beltK > 0.01 && !beltEye
        ? { reach: { x: beltAt.x, y: beltAt.y, z: beltAt.z, k: beltK, kind: 'pull', grip: beltGrip,
          hair: [_bf.x, 0, _bf.z] } }
      // And after a safeword, the flat of your hand on her where it stung —
      // the petting hand, palm down (see `beltHandTick`).
      // The leash — see `collarHandTick`. A fist round the loop at your hip,
      // the chain running out of it toward her; or your hands at her neck
      // while the collar goes on or comes off.
      : state.phase === 'ground' && colK > 0.01
        ? { reach: { x: colAt.x, y: colAt.y, z: colAt.z, k: colK, kind: 'pull', grip: colGrip,
          hair: [colDir.x, colDir.y, colDir.z] } }
      // And after a safeword, your hand in her hair — see `colAfter`.
      : state.phase === 'ground' && colAfterK > 0.01
        ? { reach: { x: colAfterAt.x, y: colAfterAt.y, z: colAfterAt.z, k: colAfterK, kind: 'pet' } }
      : state.phase === 'ground' && beltRubK > 0.01
        ? { reach: { x: beltRubAt.x, y: beltRubAt.y, z: beltRubAt.z, k: beltRubK, kind: 'pet' } }
      // The spank — see `spankHandTick`. The flat of the hand, laid on her
      // the way `spankLie` says; ahead of the rest, because it is over in
      // under half a second and the press that started it ended them.
      : state.phase === 'ground' && spankK > 0.01 && spank
        ? { reach: { x: spankAt.x, y: spankAt.y, z: spankAt.z, k: spankK, kind: 'slap',
          along: spankAlong, palm: spankPalm, dip: spank.dip } }
      // The throw — see `ballThrowTick`. The cupped hand, because it has a
      // ball in it; ahead of the others, because it is over in half a second.
      : state.phase === 'ground' && throwK > 0.01
        ? { reach: { x: throwAt.x, y: throwAt.y, z: throwAt.z, k: throwK, kind: 'cup' } }
      // The push — see `hammockPush`. The open palm, out to the cloth and back.
      : state.phase === 'ground' && pushK > 0.01
        ? { reach: { x: pushAt.x, y: pushAt.y, z: pushAt.z, k: pushK, kind: 'cup' } }
      : state.phase === 'ground' && thumbK > 0.01 && thumbAt
        ? { reach: { x: thumbAt.x, y: thumbAt.y, z: thumbAt.z, k: thumbK } }
        : state.phase === 'ground' && cupK > 0.01 && cupAt
          // The palm's middle a hand's thickness off the skin, out along the
          // way her chest faces, so it rests on her rather than in her.
          ? { reach: { x: cupAt.x + cupAt.fx * cupOff(), y: cupAt.y + cupAt.fy * cupOff(),
            z: cupAt.z + cupAt.fz * cupOff(), k: cupK,
            kind: reachKind === 'hip' || reachKind === 'thigh' ? reachKind : 'cup',
            // The thigh stroke says which way the hand lies on her, world:
            // the fingers (`strokeAim`), and the palm in on her skin.
            along: reachKind === 'thigh' ? cupAt.along : null,
            palm: reachKind === 'thigh' && cupAt.along ? [-cupAt.fx, -cupAt.fy, -cupAt.fz] : null } }
        : state.phase === 'ground' && petK > 0.01 && petAt
          ? { reach: { x: petAt.x, y: petAt.y, z: petAt.z, k: petK, kind: 'pet' } }
        // Your fist in her hair, from behind — see `hairPull`. `grip` how
        // shut it is, `hair` the way the hair runs from it to her scalp.
        : state.phase === 'ground' && hairK > 0.01 && hairAt
          ? { reach: { x: hairAt.x, y: hairAt.y, z: hairAt.z, k: hairK, kind: 'pull',
            grip: hairAt.grip || 0, hair: [hairAt.hx, hairAt.hy, hairAt.hz] } }
        : (state.phase === 'ride' ? ride : swim),
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
  // The camera and the person, separately, because B put three metres and a
  // lap between them — see `updateCrowd` in 43-jadrija.js. On foot the person
  // is the walker; everywhere else there is nobody on the ground and the
  // camera is the only answer there is.
  if (jadrija) {
    // And WHERE YOU ARE LOOKING, which is the camera's and not the walker's:
    // the person's own yaw is where her feet point, and you can stand still and
    // turn your head. Distance is decided against the walker and attention
    // against the eye, and they are two different questions.
    jadrija.update(dt, camera.position,
      state.phase === 'ground' && ground && ground.ok
        ? { x: ground.you.x, y: ground.you.y, z: ground.you.z } : null,
      camera.getWorldDirection(_look));
    // The crabs, which run from YOU — the walker or the swimmer, not the
    // camera, which in the third person is somewhere else — and from the
    // jet when it lands near them.
    if (crabs) {
      const who = state.phase === 'ground' && ground && ground.ok ? ground.you
        : state.phase === 'swim' && swim ? swim.you : null;
      let jet = state.phase === 'ground' && ground && ground.hose() > 0.2 && ground.aimAt
        ? ground.aimAt() : null;
      // A test's stand-in for a jet, for `crabJet` seconds — see __fr.crabs.jet.
      if (crabJet && crabJet.t > 0) { crabJet.t -= dt; jet = crabJet.at; }
      crabs.update(dt, camera, who, jet, (c, sp) => {
        if (!audio || !audio.crabClack) return;
        _crabV.set(c.x, c.y, c.z).sub(camera.position);
        const d = _crabV.length();
        _crabR.setFromMatrixColumn(camera.matrixWorld, 0);
        audio.crabClack(Math.pow(1 - d / 4.5, 2) * (0.4 + Math.min(1, sp / 0.4)),
          d > 1e-3 ? _crabV.dot(_crabR) / d : 0);
      });
    }
    // The strap, against her as she has just been posed — see `beltSimTick`.
    beltSimTick(dt);
    // The leash, against her as she has just been posed — see `collarSimTick`.
    collarSimTick(dt);
  }
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
  // The shoreline handover, latched here and spent at the top of the next
  // frame.
  //
  // `ground.wet()` is an *output of one step of `walk()`* — "the step you just
  // asked for was refused and there is water a metre and a half past it" — and
  // `walk()` is the only thing that ever clears it. `walk()` runs only while
  // the mode is driving somebody, so the moment you go swimming it stops
  // running and the last waterline you leant on is frozen into the getter for
  // the rest of the session.
  //
  // The frame loop then read that getter at the top of every ground frame. So
  // every door out of the water — E, 9, V — put you correctly on dry land, and
  // the next frame read a pair of coordinates from a walk you took ten minutes
  // ago and swam you back out to the spot you had just left. Measured: one
  // frozen pair, `[-2094, 382]`, was still being handed back at the end of a
  // seventeen-case run in which it was returned to seventeen times. Three
  // separate bug reports — E cannot get me out of the water, 9 puts me back in
  // swim mode, V keeps my mask on — are that one value.
  //
  // Latching it here says the thing that was actually meant: a handover is
  // only good if the walk model produced it on the frame that just ran, while
  // it was the thing being driven.
  handover = state.phase === 'ground' && ground.wet ? ground.wet() : null;
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
  // Both asked about the EYE and not the camera — see `personAt`, which
  // carries the measurement. This is the line the shimmer came out of: the
  // latch below is fed from here, `indoors` is fed from the latch, and the
  // near clip and the exposure are both fed from `indoors`.
  const at = personAt();
  const kabIn = afoot && jadrija && jadrija.kabina
    ? jadrija.kabina.inside(at.x, at.z) : 0;
  const vikIn = afoot && jadrija && jadrija.indoorsAt
    ? jadrija.indoorsAt(at.x, at.y, at.z)
    : 0;
  const raw = Math.max(kabIn, vikIn);
  if (raw > 0.62) inLatch = 1; else if (raw < 0.18) inLatch = 0;
  // Which room it was, held while the latch is held so a doorway does not
  // change the exposure on the way through it.
  if (raw > 0.62) darkWant = vikIn > kabIn ? 0.34 : 1;
  // Nobody rides a bicycle into a changing cubicle or through a hut door.
  crossThreshold(dt, afoot && !riding());
  crossChanging(afoot && !riding());
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
  // Sent on a change in either the weighting or the canopy, and the second
  // condition is not redundant. Since the beds at Jadrija became one bed that
  // is divided by where you are standing — see MORPH in src/80-audio.js — the
  // canopy figure is no longer only the chorus's own crossfade, it is what
  // decides how much of the promenade bed the pines are given. And the walk
  // this exists for is the one walk on which the weighting does not move: from
  // the water's edge up into the trees, canopy goes 0.36 to 1.0 while the
  // distance term goes the other way by almost exactly as much, so `cicG`
  // arrives at the far end within a thousandth of where it started and a
  // gain-only test would send nothing at all for the whole climb.
  if (afoot !== wasAfoot || (afoot && (Math.abs(cicG - cicadaGain) > 0.0015
      || Math.abs(cicW - cicadaWood) > 0.02))) {
    cicadaGain = cicG;
    cicadaWood = cicW;
    audio.cicadas(afoot, cicG, cicW);
    wasAfoot = afoot;
  }
  // The beach, shut out by the wall. This used to make the cicadas *louder*
  // indoors on the theory that a quiet room is what you notice them in, and it
  // was the wrong theory: a changing hut with a hillside of cicadas at full
  // level in it is not a room you have walked into, it is a room somebody has
  // taken the roof off. They go through a gain and a lowpass now — see `room`
  // in src/80-audio.js — with the shore bed on the same bus, and the radio on the
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
  const rideNear = state.phase === 'ride' ? 0.72 : 0;
  // And a fifth, which is somebody else's face.
  //
  // People became solid on 22 Aug and the collider stops you with 0.54 m
  // between centres — about 0.30 m of clear air to the surface of them. The
  // standing clip is 1.2 m. So the person you have just walked into is wholly
  // in front of the front plane and is not drawn: you get the head turn and
  // the "excuuuuse me" out of a promenade with nobody on it. Two fixes landed
  // in the same hour and neither could see the other.
  //
  // Handled here rather than by standing you further off, because the stand-off
  // is the thing that was measured — it is what makes a bump read as a bump —
  // and the front plane is free. Same ramp as a wall, so walking up to somebody
  // and walking up to a doorframe pull the plane in the same way.
  // And a sixth, which is the Brod's side deck, and it was the worst of them.
  //
  // Walk her deck and by four metres along the boat has come apart: a row of
  // bare white stanchions over open sea with the deck as a tan sliver BEHIND
  // them, as if the eye had gone outboard of the rail. It had not. The side
  // deck is about a metre wide with a bulwark down one edge and the deckhouse
  // wall down the other, so at the standing clip of 1.2 m both of them are
  // inside the front plane and neither is drawn — and what is left is the far
  // half of the deck, the stanchions that are further along than 1.2 m, and
  // the sea through the hole where the bulwark was. Every frame of it looks
  // like a camera that has left the boat, which is why it was read as one.
  //
  // Same fault as the kite bar and the same fix, and it is
  // the fifth time this list has grown for the same reason: a mode that puts
  // something solid within arm's reach has to say so, because the clip does
  // not measure, it is told. 0.82 puts the plane at 0.26 m — enough to clear
  // a bulwark at half a metre and a deckhouse wall at a third of one, and not
  // so near that it spends the depth this view needs, because the far end of
  // it is four kilometres of Šibenik coming up the channel.
  const brodNear = state.phase === 'brod' ? 0.82 : 0;
  // And the tower, where her own hands are on a rung a forearm from her face
  // and the eye is in front of her own nose: 0.95 puts the plane at 0.12 m.
  const plungeNear = state.phase === 'plunge' ? 0.95 : 0;
  const faceD = state.phase === 'ground' && ground.nearBody ? ground.nearBody() : null;
  clipNear = Math.max(indoors, hullNow, bedNow, rideNear, brodNear, plungeNear);
  let wantNear = 1.2 - 1.14 * clipNear;
  // Somebody else's face, and it is taken out of the ramp above rather than
  // fed into it.
  //
  // The ramp bottoms out at 0.12 m against a stand-off of 0.24, which is fine
  // for the body it measures and wrong for the person attached to it.
  // `nearBody` reports the distance to a COLUMN — `b.r` is 0.30 and it is the
  // collider's cylinder — and an arm does not stay inside its own column. Her
  // hands come up when she talks to you; Misha's screenshot is a forearm and a
  // shoulder sliced flat, at maybe 0.10 m, in front of a plane at 0.12.
  //
  // So the plane is put 0.28 m nearer than the nearest column, floored at
  // 0.04. At the stand-off the collider actually holds — 0.54 m between
  // centres, 0.24 m of clear air to the column — that is the floor, which is
  // 200 mm of reach outside a cylinder before anything is cut, and an arm is
  // about that. The floor is what keeps the depth buffer honest at the other
  // end of a hundred and sixty-nine square kilometres; 0.04 against the 0.06
  // this could already reach is not a change in that.
  if (faceD != null) {
    wantNear = Math.min(wantNear, clamp(faceD - 0.28, 0.04, 1.2));
  }
  // And the near plane held while a hand is out: it tracks her body and she
  // sways, and a projection that changes every frame is the room wobbling.
  if (thumbK > 0.3 || cupK > 0.3 || petK > 0.3 || hairK > 0.3) wantNear = camera.near;
  // And a seventh, the Slow Doodle, who is the one body `nearBody` could
  // never see. Misha, 27 Sep 2026: *"the game allows me to get too close to
  // the slow doodle and the result is i see/slice through his head into his
  // tongue etc..."*.
  //
  // `nearBody` measures columns and skips any whose top is under your eye —
  // right for a sunbather at your feet, and the whole of him: his column is
  // 0.95 m and your eye is 1.66. So the plane stayed at 1.2 m with a dog a
  // metre off, and looking down at him it went through his skull. Measured
  // off every vertex of him skinned on the CPU, 1.533.0, walking at his
  // flank: nearest vertex 0.74 m from the lens, plane 1.20, and 14,740 of
  // the 21,442 vertices of him in view in front of it and not drawn.
  // Kneeling at his face your eye was 0.23 m from him.
  //
  // Asked of HIM, in three dimensions and of the camera — which in the third
  // person is not where you are — so looking down on him, kneeling beside him
  // and him walking under the lens are one question. See `DOODLE.lens` for
  // the capsules and why the answer is not a bigger collider, and `lensNear`
  // for why it is two bounds and not a distance. After the hold above, so a
  // hand out to Baye cannot keep a plane that cuts him; floored at 5 cm,
  // which is where his own lick puts it. Standing at his side it comes to
  // about 0.4 m.
  const dogNear = jadrija && jadrija.doodle && jadrija.doodle.lensNear
    ? jadrija.doodle.lensNear(camera)
    : null;
  if (dogNear != null) {
    wantNear = Math.min(wantNear, clamp(dogNear - DOODLE.lens.pad, DOODLE.lens.floor, 1.2));
  }
  // And the crabs, which are four centimetres across and live where you
  // crouch at the water's edge: one a metre from the lens is inside the
  // 1.2 m plane and is not drawn. Only while one is that close and in front.
  const crabNear = crabs ? crabs.lensNear(camera) : null;
  if (crabNear != null) wantNear = Math.min(wantNear, clamp(crabNear - 0.08, 0.06, 1.2));
  // And the beach ball in your hand, which is half a metre from your eye:
  // inside the promenade's 1.2 m front plane it is not drawn at all, and the
  // hand came up empty. For the half second the throw lasts.
  if (throwT >= 0) wantNear = Math.min(wantNear, 0.08);
  if (Math.abs(camera.near - wantNear) > 0.005) {
    camera.near = wantNear;
    camera.updateProjectionMatrix();
  }
  // And the Slow Doodle's tongue, when it is you he came for: the laugh in
  // the camera, and his face inside the front plane. After the plane, since
  // it moves it. See `doodleLickView` in 43-doodle.js.
  if (typeof doodleLickView === 'function') {
    doodleLickView(camera, dt, !camOverride && state.phase === 'ground' ? (bodyCam ? 2 : 1) : 0);
  }

  // And Jadrija itself, off the promenade. Measured from the camera rather
  // than from the aeroplane, which is the same point in every mode except the
  // chase view and is the right one in that too: what you hear should follow
  // where you are looking from, not where the airframe is.
  //
  // Deliberately audible from a long way out. A couple of hundred people on a
  // concrete promenade on a still August afternoon carry over flat water the
  // way any broad low source does, and the whole point of the thing is that you
  // pick it up as a suggestion somewhere over the channel and only work out
  // what it is on the way in.
  if (jadrija && state.phase !== 'intro') {
    const d = Math.hypot(camera.position.x - jadrija.site.x,
      camera.position.z - jadrija.site.z);
    // Indoors the beach goes away by being put back over the water: the same
    // distance curve `shore` already has, walked out to the edge of earshot.
    // Cheaper than a second gain stage and, unlike one, it takes the top off it
    // on the way — which is what a shut door does to a crowd.
    //
    // And on a board they stay with you. A rider does ten metres a second and
    // is a kilometre out inside two minutes, which put the whole of the kite
    // mode in silence — and the kite mode is a Jadrija afternoon, not an
    // expedition. Capped rather than pinned: it still opens all the way up
    // when you carve back in along the terrace, it just stops going away.
    const dk = state.phase === 'ride' ? Math.min(d, 400) : d;
    audio.shore(dk + indoors * 2000, state.phase === 'fly');
    // And the birds sitting still in the pines behind the vikendica.
    //
    // The mixer owns what they sound like and how often; the only thing it
    // cannot know is where they are, because a station in the resort's frame
    // means nothing over there. So this is the whole of the coupling: resolve
    // each perch to a world point once — the shore frame does not move — and
    // then hand back a distance and a bearing every frame.
    //
    // Deliberately NOT put through the `indoors * 2000` trick the shore bed
    // uses above. That works for the promenade because a crowd that is further
    // away is exactly what a crowd behind a wall sounds like; it is wrong for
    // a bird twenty-four metres away in a tree, which is exactly where it was
    // before you shut the door. What the wall does to these is a stage on
    // their own bus — see PERCH in src/80-audio.js.
    const birds = audio.perches();
    if (!perchW && birds.length && jadrija.toWorld) {
      perchW = birds.map((b) => {
        const w = jadrija.toWorld(b.t, b.s);
        return [w[0], w[1] + b.up, w[2]];
      });
    }
    if (perchW) {
      // The camera's own +X in world space, straight off its matrix rather
      // than through a Vector3 nobody needs: this runs every frame per bird.
      const e = camera.matrixWorld.elements;
      for (let i = 0; i < perchW.length; i++) {
        const w = perchW[i];
        const bx = w[0] - camera.position.x, by = w[1] - camera.position.y,
          bz = w[2] - camera.position.z;
        const bd = Math.hypot(bx, by, bz);
        audio.perch(i, bd, bd > 1 ? (bx * e[0] + bz * e[2]) / bd : 0);
      }
    }
    // And the radio on the shelf downstairs, which is the same coupling again
    // with one number more.
    //
    // THE THIRD NUMBER IS THE STOREY AND IT IS ASKED OF THE EYE, not of the
    // camera. Everything else here is measured from `camera.position`, which
    // is right: what you hear should follow where you are looking from. But
    // this one is multiplied by `roomV` on the far side — see SONG in
    // src/80-audio.js — and `roomV` is fed from `indoors`, which is fed from
    // `personAt()`. Feed a camera into one half of a product and a person into
    // the other and the third-person pull-back can have the slab half applied
    // with nobody upstairs, which is the same class of bug as the shimmer.
    //
    // Ramped over 0.9 m off the slab rather than stepped, because the storey
    // it decides is a storey you walk up an outside stair to reach: there is
    // no doorway here to make the crossing at, and a hard edge in mid-air over
    // a terrace is a place the song switches off as you stand up.
    if (!songW && jadrija.toWorld) {
      const set = audio.songAt();
      const w = jadrija.toWorld(set.t, set.s);
      songW = [w[0], w[1] + set.up, w[2], w[1] + set.slab];
    }
    if (songW) {
      const e = camera.matrixWorld.elements;
      const sx = songW[0] - camera.position.x, sy = songW[1] - camera.position.y,
        sz = songW[2] - camera.position.z;
      const sd = Math.hypot(sx, sy, sz);
      // AND THE FOURTH NUMBER, WHICH IS THE ONE HOLE IN THE SLAB: how far into
      // the upper bathroom the eye is, over the soil stack. Asked of the eye
      // for exactly the reason the storey above it is — a product with a
      // person in one half and a camera in the other is the shimmer bug — and
      // asked of the house rather than answered here, because the house owns
      // which room you are in. See `vik.ductAt` and `stack` in src/80-audio.js.
      audio.song(sd, sd > 1 ? (sx * e[0] + sz * e[2]) / sd : 0,
        clamp((at.y - songW[3]) / 0.9, 0, 1),
        jadrija.ductAt ? jadrija.ductAt(at.x, at.y, at.z) : 0);
    }
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
  if (draw) shadow.render(renderer);
  // The kabina's pendant, while its room is lit — nothing otherwise.
  if (draw) shadow.lampRender(renderer);

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
  // Baye, if she has anything to say. Cheap when she has not: the first
  // thing it does is ask whether you are signed in, and the second is how
  // far away she is. See 49-voice.js.
  voice.step(real);
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
      || state.phase === 'swim' || state.phase === 'brod',
    // Her diesel, and only while you are standing on her. See the note in
    // 80-audio.js: `BOAT`'s ambient passes are every other hull in the channel
    // heard from the shore, and this is the one you are aboard.
    brod: brod && brod.active ? { thr: brod.speed / BROD.cruise,
      speed: brod.speed } : null,
  });

  if (state.phase === 'ground') {
    stowFlightHUD();
    updateGroundHUD(dt);
  } else if (eject.active) {
    stowFlightHUD();
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
  // `?pose` takes the camera AFTER your body has been put where you are — the
  // body hangs off the camera — and before anything draws. See 93-poser.js.
  const posing = typeof poser !== 'undefined' && poser.on;
  if (posing) poser.frame(dt, camera);
  chuteAudio();
  // Everything below is the picture: skipped on a fast-forward step.
  if (!draw) return;
  if (mirror) mirror.update(renderer, scene, camera);
  if (mirrorP) mirrorP.update(renderer, scene, camera);
  // Her, live, into the phone's own target — before the frame for the mirror's
  // reason, and at 20 Hz rather than 60 for its own. Nothing at all when the
  // phone is away or on another app. See src/63-phone.js.
  phoneCamStep(renderer, scene, real);
  // The world, through the occlusion pass if it is on. It returns false when
  // it has not drawn — off, or a target it could not make — and then this is
  // the renderer exactly as it was before any of that existed.
  if (!ao || !ao.render(scene, camera)) renderer.render(scene, camera);
  // And your own arms over the top of it, on a near plane the world cannot
  // afford. See src/60-arms.js.
  // With her drawn into its depth, when your thumb is out — so a thumb in her
  // mouth is inside it, behind her lips.
  if (arms && !posing) arms.render(renderer, typeof apprenticeOccluder === 'function' ? apprenticeOccluder() : null);
  // Debug: a frame-by-frame trace of the camera while a hand is out, for the
  // shake — see `__fr.camTrace`.
  if (camTraceOn && (thumbK > 0.01 || cupK > 0.01 || petK > 0.01)) {
    const y = ground && ground.you;
    camTrace.push([+camera.position.x.toFixed(4), +camera.position.y.toFixed(4),
      +camera.position.z.toFixed(4), y ? +y.yaw.toFixed(4) : 0, y ? +y.pitch.toFixed(4) : 0,
      +camera.near.toFixed(3)]);
    if (camTrace.length > 600) camTrace.shift();
  }
  // And the bottle, if there is one in your hand — same reason, same pass, and
  // after the arms because you do not drink while you are swimming a crawl.
  beerRender(renderer);
  // And the ice cream, same pass and same reason, after the bottle because you
  // are never holding both — she hands one over and the other is in the other
  // hand, and if the two ever did overlap the cone is the thing you are
  // looking at. See src/61-cream.js.
  creamRender(renderer);
  // The mask goes on last of all, because it is the closest thing to your eye
  // that exists — and only in the water. The alpha it fades on its own is a
  // frame behind the phase, and one frame of a dive mask over the first frame
  // of a walk up to the vikendica is the whole of the complaint.
  if (mask && state.phase === 'swim' && !chaseCut && !bodyCam) mask.render(renderer);
  // And the close-up of the dead fly, which is not an overlay but a CUT: it
  // clears the colour and the depth under itself and what was drawn above is
  // gone. Last, for the same reason the mask is last — it is the whole frame
  // while it is on — and gated on the beat rather than on the sequence, so the
  // first two seconds of the shot are still the room. See src/44-corpse.js.
  if (swatCut && swatCut.t >= jadrija.vik.fly.fallSecs() + SWAT.floor) {
    jadrija.vik.fly.shot().render(renderer);
  } else if (flyCamT >= 0 && !camOverride && jadrija && jadrija.vik) {
    // The fly cam, in the corner: "drop your buckets!" — see `dropShot`.
    const shot = jadrija.vik.fly.shot();
    if (flyCamMode === 'dance') shot.danceShot(flyCamT);
    else if (flyCamMode === 'birthday') shot.birthdayShot(flyCamT);
    else if (flyCamMode === 'brush') shot.brushShot(flyCamT);
    else if (flyCamMode === 'site') shot.siteShot(flyCamT);
    else shot.dropShot(flyCamT);
    shot.render(renderer, flyCamBig ? false : 'pip');
  } else if (camOverride && jadrija && jadrija.zombies && jadrija.zombies.count() > 0
    && (pourCut || pourInsertT >= 0)) {
    // And the movement, in front of the lens, pouring with her. An OVERLAY and
    // not a cut: depth only, so the porch stays in the picture. See `insert` in
    // src/44-corpse.js.
    const shot = jadrija.vik.fly.shot();
    shot.insert(pourCut ? pourClock() : pourInsertT, POUR.cut, camera.fov,
      jadrija.zombies.count());
    shot.render(renderer, true);
  }
  // And the phone's glass, last of all: a quad the size of the hole the DOM
  // has left for it, with the target `phoneCamStep` filled on it. After the
  // fly cam and the insert because it is the nearest thing to the player of
  // anything in this list — it is in their hand.
  phoneCamBlit(renderer);
  const now = performance.now();
  if (lastFrameMs) state.fps = damp(state.fps, 1000 / Math.max(1, now - lastFrameMs), 2, dt);
  lastFrameMs = now;
  // The recorder's own composite, and it has to be here rather than anywhere
  // else in the file: a WebGL canvas without `preserveDrawingBuffer` is empty
  // by the time this task ends, so the one moment the drawing buffer can be
  // copied out of is between the last render above and the return below. It
  // early-returns unless the recorder is armed AND the capture rate is due.
  clipFrame();
  // Down here and not at the top: the recorder is waiting to be told the frame
  // is *drawn*, and everything above this line is what drawing it means.
  if (filming) {
    filmWant--;
    const tell = filmDone;
    filmDone = null;
    if (tell) tell();
  }
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

// One session for the whole game — the title screen's sign-in, and the check
// that tells the laptop and Baye whether it already happened. See 47-auth.js.
wireAuth();
$('panel-voice').addEventListener('click', () => voice.toggle());
syncVoiceBtn();
$('help-close').addEventListener('click', () => toggleHelp(false));
// Clicking the backdrop, but not the sheet itself.
$('help').addEventListener('click', (e) => {
  if (e.target === $('help')) toggleHelp(false);
});
// The thumb's way in: a phone has no ? to press, and every touch HUD already
// carries a SET button.
$('panel-help').addEventListener('click', () => { togglePanel(); toggleHelp(true); });
$('panel-close').addEventListener('click', () => togglePanel());
/**
 * And a tap anywhere else shuts it.
 *
 * Misha, 19 Sep 2026: *"on cellphone if u open controls u cannot close it
 * because controls button is occluded by the controls menu"*. On a keyboard M
 * is both doors; on glass the only door was the SET button, and this sheet is
 * centred over the row that button is in.
 *
 * In the CAPTURE phase and stopped there, or the same tap that closes the
 * sheet also plants a thumb on the walk stick underneath it. Buttons are
 * excluded so that SET itself still toggles — closed here and reopened by its
 * own handler is a sheet that will not shut.
 */
addEventListener('pointerdown', (e) => {
  const p = $('panel');
  if (p.hidden || e.pointerType === 'mouse') return;
  if (p.contains(e.target)) return;
  if (e.target.closest && e.target.closest('button, input, a, #signin, #ears')) return;
  e.preventDefault();
  e.stopPropagation();
  togglePanel();
}, true);

$('enter').addEventListener('click', () => {
  const seen = introSeen();
  leaveVeil();
  if (seen) beginFlight();
  else playIntro();
});

/**
 * Enter as well as the button.
 *
 * The first thing this page asks anybody to do should not need a mouse, and a
 * keypress is as good a gesture as a click for the audio context — which is the
 * only reason the button exists at all.
 *
 * Gated on `started`, and not on the button being on screen. Enter is also the
 * jump, and `started` is the one flag in this file that is false before the
 * veil is left and true for ever after; the button's `hidden` is not, so a
 * player who clicked with the mouse would still have a listener sitting here
 * that turns every jump into a second `beginFlight`. `repeat` is out for the
 * same reason: holding the key down must not send its later repeats through to
 * a game that has by then started.
 */
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.repeat || started || $('enter').hidden) return;
  // Misha, 31 Aug: "pressing the <Enter> key on the password falls thru and
  // causes the game to start prematurely". It did: this is a second listener
  // with its own guards, and the field rule added to the main handler never
  // reached it. Enter in the sign-in form is the form's — it submits it.
  if (keyboardIsBusy(e)) return;
  e.preventDefault();
  $('enter').click();
});

$('watch').addEventListener('click', () => {
  leaveVeil();
  playIntro();
});

function playIntro() {
  // Skipping counts as having seen it. Someone who pressed skip is the last
  // person who wants it again next time.
  markIntroSeen();
  // A coordinate in the link is somebody going to a place, not somebody
  // starting the game, and making them sit through the cinematic every time
  // would be the whole of what is annoying about a bookmark. `?jadrija` and
  // `?ground` still play it: those are back doors into the mission, and the
  // mission is what the cinematic is the beginning of.
  if (location.search.includes('nointro') || QUERY.has('pose')
    || QUERY.has('gps') || QUERY.has('tgps')) { beginFlight(); return; }
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
  if (QUERY.has('gps') || QUERY.has('tgps')) setTimeout(queryDoor, 60);
  else if (location.search.includes('jadrija') || QUERY.has('pose')) setTimeout(skipToJadrija, 60);
  else if (location.search.includes('ground')) setTimeout(skipToGround, 60);
}

/**
 * `?gps=43.724982,15.847840` — start the game standing there.
 *
 * And `?tgps=579.6,134.1`, the same door in the shore frame: `t` metres along
 * the traced Jadrija shoreline and `s` metres inland from it, which is the
 * frame every number in 43-jadrija.js is written in and therefore the one
 * worth being able to type. Misha asked for both, and the pair is the point —
 * degrees are how you say where a place is to somebody standing in it, and
 * (t, s) is how you say where a thing is to the file that draws it.
 *
 * Both go through the Jadrija door first. That is not because they always land
 * there — `__fr.gps` picks its own locale through `localeAt` and answers from
 * anywhere in the 13 km world — but because the door is what swaps the HUD,
 * takes the pointer and writes the phase down, and a teleport that leaves the
 * flight HUD up is a teleport that looks broken.
 *
 * A coordinate that will not parse says so and does nothing, rather than
 * silently flying the mission: a link is typed by hand and a typo in one
 * should be visible.
 */
function queryDoor() {
  const pair = (v) => {
    const p = String(v).split(',').map((n) => Number(n.trim()));
    return (p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) ? p : null;
  };
  const g = QUERY.get('gps'), tg = QUERY.get('tgps');
  const p = pair(g != null ? g : tg);
  if (!p) {
    toast('?' + (g != null ? 'gps' : 'tgps') + '= wants two numbers', 'bad');
    return;
  }
  skipToJadrija();
  if (state.phase !== 'ground') return;   // the door said why
  const r = g != null ? __fr.gps(p[0], p[1]) : __fr.jad.stand(p[0], p[1]);
  if (!r || r.error) toast(r && r.error ? r.error : 'nowhere', 'bad');
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
  /**
   * The skakaonica — src/61-plunge.js.
   *
   *   __fr.plunge.go()              in the water at the foot of the ladder, and up it
   *   __fr.plunge.top()             straight to standing on the plank, facing the tip
   *   __fr.plunge.stats()           the board, her, the last takeoffs, the entry
   *   __fr.plunge.press()           one Space
   *   __fr.plunge.script([{t, jump, fwd, lean, tuck, pike, twist}])
   *   __fr.plunge.autoPump(3, 1, 'tuck', 1)   three bounces, then a forward 1½ tucked
   *   __fr.plunge.cam(2)            0 her eyes, 1 round her, 2 judge, 3 water, 4 deck
   */
  plunge: {
    raw: () => plunge,
    stats: () => (plunge ? plunge.stats() : null),
    go: () => {
      if (!plunge || !swim) return false;
      const f = plunge.foot();
      __fr.swim.dip(f[0], f[2], 0, 0.1);
      return climbTower();
    },
    top: () => {
      if (!plunge) return false;
      if (state.phase !== 'plunge' && !__fr.plunge.go()) return false;
      return plunge.top();
    },
    press: () => (plunge ? (plunge.press(), true) : false),
    script: (list, end) => (plunge ? plunge.script(list, end) : false),
    autoPump: (n, lean, shape, turns, twist, late) => (plunge ? plunge.autoPump(n, lean, shape, turns, twist, late) : false),
    cam: (i) => {
      if (!plunge) return null;
      const k = plunge.setCam(i);
      bodyCam = k > 0;
      syncBodyBtn();
      return plunge.cam;
    },
    blowUp: (v = 30) => (plunge ? plunge.blowUp(v) : false),
    here: () => plungeHere(),
    phase: () => state.phase,
  },
  /** The help sheet. Toggles when called with nothing, like `body`. */
  help: (v) => { toggleHelp(v); return !$('help').hidden; },
  /**
   * The voices. `voice()` is what both of them are doing, `voice.say()` makes
   * one say something now without waiting out the gap, and `voice.on(false)`
   * is the switch. There are two speakers on this beach — Baye and the cat —
   * so `say` and `context` take a name: `__fr.voice.say('cat')`.
   */
  voice: Object.assign(() => voice.stats(), {
    say: (who) => voice.now(who),
    on: (v) => voice.toggle(v),
    context: (who) => voice.context(who),
    /** What she would be told about herself and you if you spoke to her now —
     *  `talk(true)` for the Bucketeer. See `converse` in 49-voice.js. */
    talk: (buck) => voice.talkState(buck),
    /** What the phase gate in `converse` makes of where you are. */
    where: () => voice.where(),
  }),
  /** Who the page thinks you are, asked fresh rather than remembered. */
  who: () => authWhoami(),
  /** The sign-in sheet, so a probe can drive it. */
  signin: (v) => { toggleSignIn(v); return !$('signin').hidden; },
  build: BUILD,
  /** What this machine's GL will do. `?gl` puts the same thing on the screen. */
  gl: () => glReport(),
  /**
   * Debug: the belt — see `beltCmd` and 43-belt.js. `cmd('belt.out' |
   * 'belt.back' | 'belt.stop')` as the typed line does it; `swing(charge)`
   * a press held for `charge` of a full wind-up and let go (`butt` aims it at
   * her bottom whatever the crosshair says); `look(side, d, pitch)` stands you
   * beside the cot at her hip looking down at her; `stats()`, `links()`.
   */
  belt: {
    cmd: (what) => beltCmd(what),
    key: () => beltCmd('belt.key'),
    swing: (charge = 1, butt = true) => {
      if (!beltInHand()) return 'not in hand';
      beltAimAtButt = !!butt;
      beltPress(true);
      // Held for that long and let go, by the frame clock — as a finger would.
      beltLetGo = Math.max(0.02, clamp(charge, 0, 1) * BELT_HAND.full);
      return beltPh;
    },
    /** Wind it up and hold it there, for a photograph. */
    wind: () => { if (!beltInHand()) return 'not in hand'; beltPress(true); return beltPh; },
    stats: () => beltStats(),
    /** How many of the strap's contacts are on her after the last step. */
    onHerNow: () => (belt ? belt.stats.onHer : 0),
    /**
     * Hold the eye the hand is laid off where it is now (true), or let it
     * follow the camera again — for photographing the strap from somewhere
     * else with `__fr.look`. The drawn arm is left out while it is held: it
     * hangs off the camera, and the camera is then somewhere else.
     */
    freeze: (on = true) => {
      if (!on) { beltEye = null; return null; }
      const f = camera.getWorldDirection(new THREE.Vector3());
      beltEye = [camera.position.x, camera.position.y, camera.position.z, f.x, f.y, f.z];
      return beltEye.map((v) => +v.toFixed(3));
    },
    /** Debug: the tip against her bottom, sampled for `ms` after a swing — closest approach, m. */
    trace: async (ms = 900, every = 15) => {
      const out = [];
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        const b = jadrija && jadrija.butt ? jadrija.butt() : null, e = belt ? belt.ends() : null;
        if (b && e) {
          const mx = (b[0].x + b[1].x) / 2, my = (b[0].y + b[1].y) / 2, mz = (b[0].z + b[1].z) / 2;
          out.push([Math.round(performance.now() - t0), beltPh, +Math.hypot(e.tip[0] - mx, e.tip[1] - my, e.tip[2] - mz).toFixed(3),
            +(e.tip[1] - my).toFixed(3), belt.stats.onHer, +belt.stats.tip.toFixed(1)]);
        }
        await new Promise((r) => setTimeout(r, every));
      }
      return out;
    },
    /** Debug: the same, a paused world stepped `frames` film frames — every link's nearest to her bottom. */
    traceFilm: async (frames = 60) => {
      const out = [];
      for (let f = 0; f < frames; f++) {
        await __fr.filmStep();
        const b = jadrija && jadrija.butt ? jadrija.butt() : null;
        if (!b || !belt) continue;
        const mx = (b[0].x + b[1].x) / 2, my = (b[0].y + b[1].y) / 2, mz = (b[0].z + b[1].z) / 2;
        let best = 9, bi = -1;
        belt.links().forEach((p, i) => { const d = Math.hypot(p[0] - mx, p[1] - my, p[2] - mz); if (d < best) { best = d; bi = i; } });
        const e = belt.ends();
        out.push([f, beltPh, +best.toFixed(3), bi, +(e.tip[1] - my).toFixed(3), belt.stats.onHer, +belt.stats.tip.toFixed(1),
          +beltAt.distanceTo(new THREE.Vector3(mx, my, mz)).toFixed(2)]);
      }
      return out;
    },
    links: () => (belt ? belt.links().map((p) => p.map((v) => +v.toFixed(3))) : null),
    ends: () => (belt ? belt.ends() : null),
    heat: (v) => { if (v != null) beltHeat = +v; return beltHeat; },
    lock: (v) => { if (v != null) beltLock = +v; return beltLock; },
    /** BELT_HAND's numbers, merged — `hand({ hold: [0.05, -0.35, 0.55] })`. */
    hand: (o) => Object.assign(BELT_HAND, o || {}),
    lashes: () => (typeof apprenticeLashState === 'function' ? apprenticeLashState() : null),
    tune: (o) => { for (const [k, v] of Object.entries(o || {})) { if (v && typeof v === 'object' && !Array.isArray(v) && BELT[k]) Object.assign(BELT[k], v); else BELT[k] = v; } return BELT; },
    look: (side = 1, d = 0.55, pitch = -0.75, along = 0) => {
      const b = jadrija && jadrija.butt ? jadrija.butt() : null;
      const w = jadrija && jadrija.beltWorld ? jadrija.beltWorld() : null;
      if (!b || !w || !w.boxes) return null;
      const mx = (b[0].x + b[1].x) / 2, mz = (b[0].z + b[1].z) / 2;
      const yaw = w.boxes[6], cx = w.boxes[0], cz = w.boxes[2], hx = w.boxes[3];
      // The mattress's own axes, world: local x = wx·c − wz·s and z = wx·s +
      // wz·c (see the world boxes in 43-avbd.js), so its x is (c, −s) and
      // its z, along the cot, (s, c).
      const ax = Math.cos(yaw), az = -Math.sin(yaw);
      const ux = Math.sin(yaw), uz = Math.cos(yaw);
      const off = (mx - cx) * ax + (mz - cz) * az;
      const s0 = side > 0 ? 1 : -1;
      const px = mx + ax * (s0 * (hx + d) - off) + ux * along, pz = mz + az * (s0 * (hx + d) - off) + uz * along;
      ground.put(px, pz, Math.atan2(px - mx, pz - mz), pitch);
      // A teleport is not a swing: hang the strap afresh where the hand is next.
      beltRehang = true;
      return [+px.toFixed(2), +pz.toFixed(2)];
    },
  },
  stats: () => ({
    build: BUILD.v + ' (' + BUILD.date + ')',
    fps: Math.round(state.fps), burning: fire ? fire.burningCount() : 0,
    tiles: terrain ? terrain.stats() : null,
    trees: trees ? trees.stats() : null,
    landmarks: landmarks ? landmarks.list.length + '/' + LANDMARKS.length : null,
    city: city ? {
      built: city.built, skipped: city.skipped, tris: city.tris, tagged: city.tagged,
      forms: city.forms && { gable: city.forms[0], hip: city.forms[1], flat: city.forms[2],
        pyramid: city.forms[3], skillion: city.forms[4], round: city.forms[5] },
    } : null,
    roads: roads ? { runs: roads.drawn, km: Math.round(roads.km), tris: roads.tris } : null,
    backlane: backlane ? {
      tris: Math.round(backlane.tris), blockers: backlane.blockers,
      dressed: backlane.dressed,
      cars: backlaneCars ? backlaneCars.count : 0,
      models: backlaneCars ? backlaneCars.counts : null,
    } : null,
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
      // The row in the wood: how many of each of the five, and what the whole
      // car park costs to draw. Not part of `tris` above, which counts only
      // what is baked into the shore's own buffers — these are instanced.
      cars: jadrija.cars,
      // The bicycles and scooters on the promenade. Not in `tris` either.
      riders: jadrija.wheels ? jadrija.wheels.stats() : null,
      testFigure: jadrija.testFigure || 'none',
      apprentice: apprenticeStats(),
    } : null,
    rail: rail ? { ways: rail.ways, km: +rail.km.toFixed(1), cars: rail.cars,
      lineKm: +rail.lineKm.toFixed(2), tris: Math.round(rail.tris) } : null,
    ground: ground ? ground.stats() : null,
    swim: swim && swim.active ? swim.stats() : null,
    under: under ? under.stats() : null,
    seabed: seabed ? seabed.stats() : null,
    ride: ride && ride.active ? { ...ride.stats(), point: ride.point() } : null,
    arms: arms ? arms.stats() : null,
    belt: beltStats(),
    collar: collarStats(),
    mask: mask ? mask.stats() : null,
    shadow: shadow ? shadow.stats() : null,
    ao: ao ? ao.stats() : null,
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
    /** Seconds recorded — what a press of L would write out right now. */
    held: () => +clipHeld().toFixed(2),
    /** What L does on an armed recorder: stop, write the file, disarm. */
    end: () => clipEnd(),
    /** A snapshot WITHOUT stopping. No key does this; tests do. */
    save: () => clipSave(),
    grab: () => clipGrab(),
    /** A copy of the next frame the recorder films — see `clipShotNext`. */
    shot: () => clipShotNext(),
    /** Does the mirror wrap where the browser wraps? See `clipWrapCheck`. */
    wrap: () => clipWrapCheck(),
    /** Paint the terminal into any 2-D context — for timing it. */
    mirror: (ctx, k) => crtMirror(ctx, k),
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
    shore: () => audio.shoreStats(),
    /** Step the shore bed at a given range without flying there. */
    at: (d, inside = false) => { audio.shore(d, inside); return audio.shoreStats(); },
    /** Likewise the water at the edge, which is metres to the coastline. */
    lap: (d) => { audio.lapping(d); return audio.shoreStats(); },
    /** And the rows: 0 out on the promenade, 1 in the alley. */
    rows: (k) => { audio.kabine(k); return audio.shoreStats(); },
    beds: () => audio.beds(),
    fire: () => audio.fireStats(),
    /** The beat on its own, without having to soak her for sixteen seconds. */
    beat: (g = 1) => { audio.firestarter(g); return audio.fireStats(); },
    /**
     * The birds in the pines: what has loaded, how far off they are, how many
     * phrases have been sung and when. `perchRun(300)` runs five minutes of
     * bouts through the real ticker in a few milliseconds and hands back the
     * firing times, which is the only way to see the interval distribution
     * without sitting through it.
     */
    perch: () => audio.perchStats(),
    perchRun: (secs = 300, step) => audio.perchRun(secs, step),
    /**
     * The radio on the shelf downstairs at the vikendica: which mixes decoded,
     * how far off it is, what the slab is doing to it, and the dBFS an
     * analyser measured off the finished voice. `songRun(1800, 4)` runs half
     * an hour of passes past somebody standing in the yard in a few
     * milliseconds and hands back the gaps, which is the only way to see the
     * interval distribution without sitting through it.
     */
    song: () => audio.songStats(),
    songRun: (secs = 1800, d = 4, step) => audio.songRun(secs, d, step),
    /** And the switch a control recording is taken against. */
    songMute: (v) => audio.songMute(v),
    /** And the four in the air: whether each has its recording yet. */
    voices: () => audio.voiceStats(),
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
   * The crabs — src/44-crabs.js.
   *
   *   __fr.crabs.stats()          patches baked, crabs made and live, ms, draws
   *   __fr.crabs.list()           every crab: where, which mode, how far
   *   __fr.crabs.flee(i, x, z)    send crab i (or every live one, i < 0) off from (x, z)
   *   __fr.crabs.mode(i, 'guard') claws up; 'hide', 'idle', 'walk'
   *   __fr.crabs.look(i, d, az, el)  pin the eye on crab i from d metres
   *   __fr.crabs.feet(i)          each foot, and how far it is off the surface
   *   __fr.crabs.freeze(true)     stop them (they are still drawn)
   *   __fr.crabs.stand(x, z)      put the walker there (they run from you, not the eye)
   *   __fr.crabs.jet(x, y, z, s)  pretend the hose is landing there for s seconds
   */
  crabs: {
    raw: () => crabs,
    stats: () => (crabs ? crabs.stats() : null),
    list: () => (crabs ? crabs.list() : null),
    flee: (i = -1, x, z) => {
      if (!crabs) return null;
      const p = x != null ? [x, z] : [camera.position.x, camera.position.z];
      return crabs.flee(i, p[0], p[1]);
    },
    mode: (i, m, secs) => (crabs ? crabs.mode(i, m, secs) : null),
    feet: (i) => (crabs ? crabs.feet(i) : null),
    surf: (x, z) => (crabs ? crabs.surf(x, z) : null),
    freeze: (on = true) => (crabs ? crabs.freeze(on) : null),
    /** Pretend the hose is landing at (x, y, z) for `secs`. */
    jet: (x, y, z, secs = 1) => { crabJet = { at: [x, y, z], t: secs }; return true; },
    /** Stand the walker at (x, z) — what the crabs run from is you, not the eye. */
    stand: (x, z, yaw = 0) => { if (ground) ground.put(x, z, yaw, 0); return ground ? [ground.you.x, ground.you.y, ground.you.z] : null; },
    look: (i, d, az, el) => {
      const e = crabs ? crabs.raw().all[i] && crabs.eye(i, d, az, el) : null;
      if (e) camOverride = e;
      return e;
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
    /**
     * E beside a hosed-off rider's machine, or on one (1.550.0): what it did,
     * what is in reach, and what you are on. See `rideKey`.
     */
    rideKey: () => ({ did: rideKey(), near: stealNear(), riding: riding() }),
    ride: () => ({ near: stealNear(), riding: riding(), body: bodyCam,
      mounted: !!(ground && ground.mounted && ground.mounted()) }),
    /**
     * Re-lathe her beanie without a rebuild.
     *
     * `__fr.jad.youHat({ fa: 1.5, lean: -0.10 })`, or with a whole `prof`.
     * Seven releases went into this shape one page-rebuild at a time; this is
     * so the eighth disagreement can be settled in the console.
     */
    youHat: (o) => (you ? you.beanie(o || {}) : null),
    /**
     * Aim one of her bones and report where the leg went.
     *
     * Exists because "the knees bend sideways" took two releases to believe:
     * the jump's tuck was written on axis (1, 0, 0) copied from Baye's
     * somersault, and this figure's fore-aft is x while its lateral is z, so
     * a rotation about x is ABDUCTION. The measurement that should have caught
     * it was taken and then read with the axes swapped.
     *
     * `__fr.jad.youAim('legUL', 0,0,1, 0.6)` and look at where the knee is.
     */
    youAim: (b, ax, ay, az, ang) => {
      if (!you) return null;
      you.fig.aim(b, ax, ay, az, ang);
      you.fig.update(0);
      const v = new THREE.Vector3(), o = {};
      for (const n of ['legLL', 'footL', 'legLR', 'footR', 'handL', 'handR']) {
        const i = you.fig.bones.findIndex((x) => x.name === n);
        you.fig.boneAt(i, v);
        o[n] = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
      }
      return o;
    },
    youFreeze: (v) => (you ? you.freeze(v) : null),
    /**
     * Shift, from a probe: `crouch(true)` down, `crouch(false)` up, nothing to
     * read. `snap` skips the ease, so a still can be taken on the next frame.
     * Answers the solve — see `crouchSolve`.
     */
    crouch: (v, snap = false) => {
      if (!ground || !ground.you) return null;
      const g = ground.you;
      if (v != null) g.crouch = !!v;
      if (snap) { g.low = g.crouch ? 1 : 0; g.eye = g.crouch ? GROUND.kneel : GROUND.eye; }
      const cr = crouchSolve(g.low);
      return { crouch: g.crouch, low: +g.low.toFixed(3), eye: +g.eye.toFixed(3),
        solve: cr ? { aL: +cr.L.a.toFixed(3), aR: +cr.R.a.toFixed(3), nL: +cr.L.n.toFixed(3),
          drop: +cr.drop.toFixed(3), back: +cr.back.toFixed(3) } : null };
    },
    /** The threshold: where it thinks you are, and whether it is mid-cut. */
    dip: () => {
      const K = jadrija && jadrija.kabina;
      if (!K) return null;
      const [t, s] = jadrija.local(camera.position.x, camera.position.z);
      return { inRoom, phase: dipPhase, cool: +dipCool.toFixed(2),
        t: +t.toFixed(2), s: +s.toFixed(2), sill: +(K.face + DIP.sill).toFixed(2),
        // Where the room is, so a probe can walk into it without finding the
        // door by eye. `standIn` is the middle of the floor; `door` is the
        // threshold. Both are the numbers the crossing itself uses.
        standIn: K.standIn, standOut: K.standOut, door: K.door,
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
    /** The skakaonica's hybrid springboard dive, for inspection and repeatable tests. */
    dive: {
      start: () => (jadrija && jadrija.dive ? jadrija.dive.start() : false),
      stats: () => (jadrija && jadrija.dive ? jadrija.dive.stats() : null),
    },
    /**
     * The Slow Doodle — see src/43-doodle.js.
     *
     *   __fr.jad.doodle.stats()            where he is and what he is doing
     *   __fr.jad.doodle.skill('yawn')      do one now ('sway', 'gaze', ...)
     *   __fr.jad.doodle.place(t, s, head)  put him somewhere on the deck
     *   __fr.jad.doodle.go(t, s)           walk him there, if the line is clear
     *   __fr.jad.doodle.hold('walk', 0.3)  one frame of one clip, frozen
     *   __fr.jad.doodle.release()          and back to his own business
     *   __fr.jad.doodle.look(4, 1.2)       stand 4 m off him, 1.2 rad round
     *                                      from his nose, looking at him
     *   __fr.jad.doodle.lick('baye')       the slow lick, at her, at 'you',
     *                                      or at either; lickStats() after
     */
    doodle: {
      api: () => (jadrija && jadrija.doodle) || null,
      stats: () => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().stats() : null),
      skills: () => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().skills() : null),
      skill: (n, ...then) => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().skill(n, ...then) : null),
      place: (t, s, head) => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().place(t, s, head) : null),
      go: (t, s) => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().go(t, s) : null),
      hold: (clip, at) => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().hold(clip, at) : null),
      release: () => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().release() : null),
      peek: () => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().peek() : null),
      // The slow lick: `lick('baye')`, `lick('you')` or `lick()` for either,
      // exactly as the spoken command does it; `lickStats()` is where it has
      // got to, `lickTrace()` its whole run, frame by frame.
      lick: (who) => (jadrija && jadrija.doodleLick ? jadrija.doodleLick(who || null) : null),
      lickStats: () => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().lickStats() : null),
      lickTrace: () => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().lickTrace() : null),
      look: (dist = 4, ang = 1.2) => {
        const a = __fr.jad.doodle.api();
        if (!a) return null;
        const st = a.stats();
        const b = st.head + ang;
        const tc = st.t + Math.cos(b) * dist, sc = st.s + Math.sin(b) * dist;
        const w = jadrija.toWorld(tc, sc);
        return __fr.jad.stand(tc, sc, Math.atan2(w[0] - st.at[0], w[2] - st.at[2]));
      },
    },
    /**
     * The beach ball — see src/43-ball.js, and the fetch in 43-doodle.js.
     *
     *   __fr.jad.ball.stats()             where it is, the solver, ms a frame
     *   __fr.jad.ball.key()               the [ key: throw it, or pick it up
     *   __fr.jad.ball.aim(yaw, pitch)     turn your head first (radians)
     *   __fr.jad.ball.put(x, y, z, vx, vy, vz)  out of the bag, into the world
     *   __fr.jad.ball.stow()              and back into the bag from anywhere
     *   __fr.jad.ball.trace(clear)        its path, frame by frame
     *   __fr.jad.ball.fetch('baye')       send him after it; fetchStats() after
     */
    ball: {
      api: () => (jadrija && jadrija.ball) || null,
      stats: () => (jadrija && jadrija.ball ? jadrija.ball.stats() : null),
      info: () => (jadrija && jadrija.ball ? jadrija.ball.info() : null),
      key: () => ballKey(),
      aim: (yaw, pitch = 0) => {
        if (!ground || !ground.you) return null;
        ground.you.yaw = yaw;
        ground.you.pitch = pitch;
        return true;
      },
      put: (x, y, z, vx = 0, vy = 0, vz = 0) => {
        const B = jadrija && jadrija.ball;
        if (!B) return null;
        if (B.where === 'bag') satchelTake('ball');
        B.drop(x, y, z, vx, vy, vz);
        return B.stats();
      },
      stow: () => {
        const B = jadrija && jadrija.ball;
        if (!B) return null;
        if (B.where !== 'bag') { B.stow(); satchelPut('ball'); }
        return B.where;
      },
      trace: (clear) => (jadrija && jadrija.ball ? jadrija.ball.trace(clear) : null),
      reset: () => (jadrija && jadrija.ball ? jadrija.ball.resetStats() : null),
      fetch: (who) => (jadrija && jadrija.doodleFetch ? jadrija.doodleFetch(who ? { who } : {}) : null),
      fetchStats: () => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().fetchStats() : null),
      fetchTrace: () => (__fr.jad.doodle.api() ? __fr.jad.doodle.api().fetchTrace() : null),
      said: () => ballFetchSaid,
    },
    /**
     * The hammock — see src/43-hammock.js, and `ham*` in 43-jadrija.js.
     *
     *   __fr.jad.hammock.stats()          sag, swing, stretch, her depth in it, ms
     *   __fr.jad.hammock.go()             stand beside it, looking at it
     *   __fr.jad.hammock.push()           the push, from where you are standing
     *   __fr.jad.hammock.gps()            where it is, in degrees and in the world
     */
    hammock: {
      api: () => (jadrija && jadrija.hammock) || null,
      stats: () => (jadrija && jadrija.hammock ? jadrija.hammock.stats() : null),
      go: (off = 1.6, side = 1) => {
        const H = jadrija && jadrija.hammock;
        if (!H || !ground || !ground.ok) return null;
        const F = H.frame();
        const x = F.M[0] + F.ez[0] * off * side, z = F.M[2] + F.ez[2] * off * side;
        ground.retarget(jadrija);
        ground.dropIn(x, z, Math.atan2(-(F.M[0] - x), -(F.M[2] - z)));
        return { at: [x, z], M: F.M };
      },
      push: () => hammockPush(true),
      /** Debug: whether a press here, looking where the camera looks, would push. */
      aim: () => !!hammockAim(false),
      /** Debug: a held press — `secs` of `hammockHold` on top of a push. */
      hold: (secs = 0.8) => {
        const r = hammockPush(true);
        if (!r) return null;
        let t = 0;
        const iv = setInterval(() => { t += 0.05; hammockHold(0.05, t <= secs); if (t > secs + 0.1) { hammockHold(0, false); clearInterval(iv); } }, 50);
        return r;
      },
      gps: () => {
        const H = jadrija && jadrija.hammock;
        if (!H) return null;
        const F = H.frame();
        const M_LAT = 111320.0, M_LON = 111320.0 * Math.cos(43.7150 * Math.PI / 180);
        const lat = 43.7280 - F.M[2] / M_LAT, lon = 15.8700 + F.M[0] / M_LON;
        return { lat: +lat.toFixed(6), lon: +lon.toFixed(6), world: F.M.map((v) => +v.toFixed(2)),
          ts: jadrija.local(F.M[0], F.M[2]).map((v) => +v.toFixed(2)), span: +F.D.toFixed(2) };
      },
    },
    /**
     * Debug: the four trampoline beds, and standing on one of them.
     *
     * The park is at s 51, eighteen metres behind the back row and up through
     * the pines, and walking there to test the bounce is forty seconds every
     * time. Same reasoning as `pose(clip, at, settle)` next door.
     *
     * `bounce()` is the Enter you would press once you were up there, and it
     * goes through `bounceOut` rather than round it — so a test that passes
     * here is a test of the key and not of a private copy of it.
     */
    beds: () => (jadrija && jadrija.beds ? jadrija.beds().map((b) => ({
      t: +b.t.toFixed(2), s: +b.s.toFixed(2), y: +b.y.toFixed(2),
      at: b.at.map((v) => +v.toFixed(1)),
    })) : null),
    tramp: (k = 1, yaw = null) => {
      if (!jadrija || !jadrija.beds) return null;
      const list = jadrija.beds();
      const b = list[clamp(Math.round(k), 0, list.length - 1)];
      if (!b) return null;
      return __fr.jad.stand(b.t, b.s, yaw);
    },
    bounce: () => bounceOut(),
    /** Debug: how far through the trampoline cut we are, or null. */
    flyCut: () => (flyCut ? { t: +flyCut.t.toFixed(2),
      spun: +flyCut.spun.toFixed(2),
      alt: eject && eject.active ? +eject.agl().toFixed(1) : null,
      chute: eject ? eject.phase : null } : null),
    probe: (t, s) => {
      const w = jadrija.toWorld(t, s);
      return { w: w.map((v) => +v.toFixed(2)), back: jadrija.local(w[0], w[2])
        .map((v) => +v.toFixed(2)), walkY: +jadrija.walkY(w[0], w[2]).toFixed(2) };
    },
    /** The performance, and a way to run it in a window that will not animate. */
    show: () => jadrija && jadrija.show(),
    /**
     * The last few people you walked into, newest last.
     *
     * `kind` is 'baye' or 'bather', `idx` is the casting order, and (t, s) is
     * where the contact happened — which is the shore frame and not world
     * metres, because that is the frame everybody on this beach was laid out
     * in and the frame a probe can read.
     */
    bumps: () => (jadrija && jadrija.bumps ? jadrija.bumps() : null),
    /**
     * How many of each tier of bather is within `r` metres of you.
     *
     * The one number that says whether the good figures are the ones you can
     * reach. See `tierCount` in 43-jadrija.js.
     */
    tiers: (r = 15) => (jadrija && jadrija.crowd.tiers
      ? jadrija.crowd.tiers(r) : null),
    /** The roving skinned cast: who is in a slot, and how tall they come out.
     *  An OBJECT keyed by slot, not an array — `.filter` on it throws. */
    cast: () => (jadrija && jadrija.crowd.cast ? jadrija.crowd.cast() : null),
    /**
     * WHERE THE PEOPLE ARE ALONG THE SHORE, in bins of `m` metres.
     *
     * This exists because the question "is this stretch of beach empty?" could
     * not be answered from the console, and two separate passes have gone
     * looking. `tiers(r)` counts who is within `r` of the PLAYER, which cannot
     * tell you about a stretch you are not standing on; `cast()` is an object
     * keyed by slot and not an array, so it does not filter; and `raw().people`
     * is the bathers array but a probe over it throws on the entries that carry
     * no `t`. So the honest answer took a photograph from 26 m up, which is
     * above the crowd's own promotion radius and therefore measures the LOD
     * rather than the beach — a 200 m stretch came back looking deserted while
     * `tiers(40)` said thirty-two people were standing in it.
     *
     * `total` is everybody the layout placed; `binned` is how many of those
     * carry a shore coordinate; the rest are on the Brod, in a shop or indoors.
     * A gap in `per` is a real gap. Nothing here reads the draw state, so it
     * answers about the BEACH and not about what is currently on screen.
     */
    spread: (m = 25) => {
      if (!jadrija || !jadrija.people) return null;
      const per = {};
      let binned = 0;
      for (const b of jadrija.people) {
        if (!b || typeof b.t !== 'number') continue;
        const k = Math.floor(b.t / m) * m;
        per[k] = (per[k] || 0) + 1;
        binned++;
      }
      return { total: jadrija.people.length, binned, bin: m, per };
    },
    /**
     * Who is saying hello to whom, and how many have since the page loaded.
     *
     * See `stepGreet` in 43-jadrija.js. The rate is the whole tuning of it and
     * a rate cannot be seen in a screenshot, so it is counted instead: step the
     * ground sim for a few minutes at a station and read `n`.
     */
    greets: () => (jadrija && jadrija.crowd.greets ? jadrija.crowd.greets()
      : null),
    /**
     * Force one, now, between the nearest pair — or `greetNow('you')` for
     * somebody to look up at you.
     *
     * A greeting lasts three seconds and happens every sixteen or so somewhere
     * on four hundred metres of shore, which is not odds a probe can shoot
     * against. Same reasoning as `pose(clip, at, settle)` next door: this goes
     * through `fireGreet` rather than round it, so what comes out is the real
     * thing.
     */
    greetNow: (mode) => (jadrija && jadrija.crowd.greetNow
      ? jadrija.crowd.greetNow(mode) : null),
    /**
     * And who is standing about TALKING to whom, which is the longer thing.
     *
     * `greets` is a hello — three seconds, a head and a hand. `chats` is a
     * conversation: two or three people angled at each other for up to
     * forty-six seconds, taking turns, nodding at whoever has the floor. See
     * 43-chatter.js. Same argument for counting it rather than photographing
     * it, and the same shape of answer.
     *
     * `chatNow(mode)` opens one between the nearest people who pass the tests,
     * so a cluster can be shot instead of waited for; `chatSay(kind, line, d)`
     * fires a single utterance on demand, which is how the synth gets levelled
     * against the bed; `chatWords(c, l, d)` does the same for one baked line of
     * one of the fifteen conversations, which is how the two halves get
     * levelled against EACH OTHER; `chatSurvey()` is the pair geometry of this
     * stretch, which is where every threshold in `CHAT` came from.
     */
    chats: () => (jadrija && jadrija.crowd.chats ? jadrija.crowd.chats() : null),
    chatNow: (mode) => (jadrija && jadrija.crowd.chatNow
      ? jadrija.crowd.chatNow(mode) : null),
    chatSay: (kind, line, d) => (jadrija && jadrija.crowd.chatSay
      ? jadrija.crowd.chatSay(kind, line, d) : null),
    chatWords: (c, l, d) => (jadrija && jadrija.crowd.chatWords
      ? jadrija.crowd.chatWords(c, l, d) : null),
    /** Both bather voices off, for the control half of a level measurement. */
    chatMute: (v) => (jadrija && jadrija.crowd.chatMute
      ? jadrija.crowd.chatMute(v) : null),
    chatLines: () => (jadrija && jadrija.crowd.chatLines
      ? jadrija.crowd.chatLines() : null),
    chatSurvey: () => (jadrija && jadrija.crowd.chatSurvey
      ? jadrija.crowd.chatSurvey() : null),
    /** Debug: who is standing close enough to be resolved against right now. */
    bodies: (pad = 1.2) => {
      if (!jadrija || !jadrija.bodies) return null;
      const p = camera.position;
      const n = jadrija.bodies(p.x, p.z, pad);
      const L = jadrija.bodyList();
      return L.slice(0, n).map((b) => ({ kind: b.kind, idx: b.idx,
        r: +b.r.toFixed(2), top: +b.top.toFixed(2),
        d: +Math.hypot(b.x - p.x, b.z - p.z).toFixed(2) }));
    },
    /**
     * Drive her routine forward by hand, `secs` of it.
     *
     * `camera.position`, not `camPos`: the smoothed follow position is written
     * once a frame by the render loop, and this exists precisely because the
     * render loop is not running often enough to be trusted.
     *
     * TWO THINGS THAT LOOK LIKE THIS BEING BROKEN AND ARE NOT, both of which
     * cost an hour on 4 Sep before they were written down here:
     *
     *   The routine only runs in GROUND phase. `stepShow` computes `withYou`
     *   as `state.phase === 'ground' && d < SHOW.lose`, and every branch of the
     *   performance hangs off it — from the cockpit there is nobody on the
     *   promenade to perform to. Stepping from the air advances nothing and
     *   looks exactly like a hang. `__fr.jad.stand(t, s)` first.
     *
     *   And the camera has to be NEAR HER. `updateCrowd` skips the whole pose
     *   past 250 m, and a probe that calls `__fr.look` and then steps in the
     *   same tick has not rendered a frame yet — so the camera is still
     *   wherever the aeroplane left it. Let a frame run in between.
     *
     * `cam` is honoured now rather than ignored, which is the third thing: it
     * used to take the argument and pass `camera.position` regardless.
     */
    step: (secs, cam) => {
      jadrija.step(secs, cam || camera.position);
      return jadrija.show();
    },
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
    /**
     * Ask her for one of her own numbers — 'wine', 'ballet', 'twerk',
     * 'shimmy', 'heart', 'note', 'wheel', 'joy', 'submit'. See `askShow`.
     *
     * Three answers, not two: `false` is a name she does not know, `true` is
     * armed, and a string is a reason there is nothing to do — 'poured' for a
     * glass that is already full, 'outside' for the kneel out on the deck.
     */
    ask: (name) => (jadrija ? jadrija.askShow(name) : null),
    asked: () => (jadrija && jadrija.asked ? jadrija.asked() : null),
    did: () => (jadrija ? jadrija.didShow() : null),
    why: () => (jadrija ? jadrija.whyShow() : null),
    /** The counter at a world point, for a test that cannot walk. */
    counter: (x, z) => (jadrija ? jadrija.counter(x, z) : null),
    signal: (key, on = true) => (jadrija && jadrija.signal ? jadrija.signal(key, on) : null),
    signals: () => (jadrija && jadrija.signals ? jadrija.signals() : null),
    props: () => (jadrija && jadrija.props ? jadrija.props() : null),
    /** What she has on, and the one of those that has a motor in it. */
    worn: () => (jadrija && jadrija.worn ? jadrija.worn() : null),
    /**
     * The cuff chain, measured — `chain('ankles')` for the one between her
     * ankles; its body's numbers; the cuffs (or the ankle cuffs) on or off,
     * now, without the errand.
     */
    chain: (which) => (jadrija && jadrija.chain ? jadrija.chain(which) : null),
    chainFit: () => (jadrija && jadrija.chainFit ? jadrija.chainFit() : null),
    ankleFit: (posed) => (jadrija && jadrija.ankleFit ? jadrija.ankleFit(posed) : null),
    cuffs: (on) => (jadrija && jadrija.cuffs ? jadrija.cuffs(on) : null),
    ankles: (on, o) => (jadrija && jadrija.ankles ? jadrija.ankles(on, o) : null),
    hairSim: () => (jadrija && jadrija.hairSim ? jadrija.hairSim() : null),
    toy: (o) => (jadrija && jadrija.toy ? jadrija.toy(o) : null),
    hair: (on) => (jadrija && jadrija.hair ? jadrija.hair(on) : null),
    coke: (u) => (jadrija && jadrija.coke ? jadrija.coke(u) : null),
    pose: (n, at, settle) => (jadrija && jadrija.pose ? jadrija.pose(n, at, settle) : null),
    plate: () => (jadrija && jadrija.plate ? jadrija.plate() : null),
    /** Debug: turn Baye v2.0 to an absolute yaw — see 46-apprentice.js. */
    apprFace: (yaw) => apprenticeFace(yaw),
    apprGape: (g, seal, lid) => apprenticeGape(g, seal, lid),
    apprDump: (r, at) => apprenticeDump(r, at),
    /** Where your thumb would go — her lower lip in world metres — or null. */
    thumbReach: () => (jadrija && jadrija.thumbReach ? jadrija.thumbReach() : null),
    petReach: () => (jadrija && jadrija.petReach ? jadrija.petReach() : null),
    petK: () => +petK.toFixed(3),
    /** Debug: your hand in her hair from behind — how far out, whether it has closed, where it is. */
    hairK: () => ({ k: +hairK.toFixed(3), held: hairHeld, kind: reachKind,
      at: hairAt ? [+hairAt.x.toFixed(3), +hairAt.y.toFixed(3), +hairAt.z.toFixed(3)] : null,
      miss: arms && arms.probe ? arms.probe()[1].missMm : null }),
    cupK: () => ({ k: +cupK.toFixed(3), kind: reachKind, side: cupSide,
      y: cupAt ? +cupAt.y.toFixed(3) : null, t: +thighT.toFixed(2),
      // The thigh stroke: where the palm is aimed on her, world, and how far
      // up the path, 0 the bottom of her thigh and 1 the top; and how much of
      // it there is room for (`thighOpen`).
      at: cupAt ? [cupAt.x, cupAt.y, cupAt.z] : null,
      n: cupAt && cupAt.fx != null ? [cupAt.fx, cupAt.fy, cupAt.fz] : null,
      along: cupAt && cupAt.along ? cupAt.along : null,
      up: cupAt && cupAt.up != null ? +cupAt.up.toFixed(3) : null,
      cap: cupAt && cupAt.cap != null ? +cupAt.cap.toFixed(3) : null }),
    /** Debug: hold the thigh stroke at `u` of the way up it; null lets it go. */
    thighHold: (u) => { thighHold = u == null ? null : +u; return thighHold; },
    camTrace: (on) => { if (on != null) { camTraceOn = !!on; camTrace.length = 0; } return camTrace.slice(); },
    slaps: () => buttSlaps,
    slapMark: () => apprenticeSlapState(),
    // Her hands to her cheeks, on the cot's edge — now, or with the coin when
    // `force` is false — and where it has got to. See `slapped` in
    // 43-jadrija.js.
    spreadNow: (force = true) => (jadrija && jadrija.slapped ? jadrija.slapped(force) : false),
    /**
     * Debug: a slap, the whole of it as the press does it — sound, mark, the
     * coin for the spread, and on the cot its weight, `k` N·s (dealt if
     * null). Whether the ragdoll took it; `cotRag()` is what it did.
     */
    spank: (side = 1, k = null) => buttSlap(side, k),
    /**
     * Debug: the press's spank, WITH the hand (1.553.2) — aimed down the
     * crosshair as the press aims it (`cotAim`), or at the cheek `side` when
     * `aim` is false or it is not on her. The slap goes when the hand lands;
     * `spankStats()` says when, and where the hand was.
     */
    spankHand: (side = 1, k = null, aim = true) => {
      const h = aim && jadrija && jadrija.cotAim
        ? jadrija.cotAim(camera.position, camera.getWorldDirection(new THREE.Vector3())) : null;
      return h && !h.miss ? spankStart(h.side, k, h) : spankStart(side, k, null);
    },
    spankStats: () => spankStats(),
    /** Debug: her two cheeks' points, and what the crosshair is on now (`cotAim`). */
    butt: () => (jadrija && jadrija.butt ? jadrija.butt() : null),
    cotAimNow: () => (jadrija && jadrija.cotAim
      ? jadrija.cotAim(camera.position, camera.getWorldDirection(new THREE.Vector3())) : null),
    /** Debug: the cot's long axis, world [x, z]. */
    cotAxisNow: () => {
      const w = jadrija && jadrija.beltWorld ? jadrija.beltWorld() : null;
      return w && w.boxes ? [Math.sin(w.boxes[6]), Math.cos(w.boxes[6])] : null;
    },
    spankTune: (o) => Object.assign(SPANK_HAND, o || {}),
    /** Debug: hold the gesture at `t` s into phase `ph` (null lets it go) — for stills. */
    spankStop: (ph, t = 0) => { spankStop = ph ? [ph, +t] : null; return spankStop; },
    /**
     * Debug: your hand against her as drawn this frame — each of its vertices
     * against her capsules (`beltWorld`, a hair inside her skin), the least
     * gap (m, − inside) and how many are inside, and which bone of the hand
     * the least is on (4 the palm, higher the fingers).
     */
    spankClear: () => {
      const H = arms && arms.hand ? arms.hand(true) : null;
      const w = jadrija && jadrija.beltWorld ? jadrija.beltWorld() : null;
      if (!H || !w || !w.caps) return null;
      const C = w.caps;
      let min = Infinity, bone = -1, inside = 0, arm = Infinity, armIn = 0;
      const per = {};
      for (const v of H.verts) {
        let g = Infinity;
        for (let i = 0; i < w.n; i++) {
          const o = 8 * i;
          const ex = C[o + 3] - C[o], ey = C[o + 4] - C[o + 1], ez = C[o + 5] - C[o + 2];
          const ee = ex * ex + ey * ey + ez * ez;
          const t = ee > 0 ? clamp(((v[0] - C[o]) * ex + (v[1] - C[o + 1]) * ey + (v[2] - C[o + 2]) * ez) / ee, 0, 1) : 0;
          const d = Math.hypot(v[0] - C[o] - ex * t, v[1] - C[o + 1] - ey * t, v[2] - C[o + 2] - ez * t)
            - (C[o + 6] + (C[o + 7] - C[o + 6]) * t);
          if (d < g) g = d;
        }
        if (per[v[3]] == null || g < per[v[3]]) per[v[3]] = g;
        if (v[3] < 4) { if (g < arm) arm = g; if (g < 0) armIn++; continue; }
        if (g < 0) inside++;
        if (g < min) { min = g; bone = v[3]; }
      }
      for (const kk in per) per[kk] = +(per[kk] * 1000).toFixed(1);
      return { n: H.verts.length, min: +(min * 1000).toFixed(1), inside, bone,
        arm: +(arm * 1000).toFixed(1), armIn, per };
    },
    /** What her voice is told the two of you are doing — see `sceneTalk`. */
    scene: () => sceneTalk(),
    cotRag: () => (jadrija && jadrija.cotRag ? jadrija.cotRag() : null),
    spreadState: () => ({ ...(jadrija && jadrija.spreadState ? jadrija.spreadState() : {}),
      k: typeof apprenticeSpreadK === 'function' ? apprenticeSpreadK() : null }),
    /**
     * Debug: stand `d` metres behind v2.0, looking down at her backside — to
     * photograph the slap's mark. `ground.put` rather than `jad.stand`, which
     * leaves you in the small kabina and not the one she is in.
     */
    slapLook: (d = 1.05, pitch = -0.42) => {
      const a = apprenticeAt();
      if (!a) return null;
      const cx = a.x - Math.cos(a.yaw) * d, cz = a.z + Math.sin(a.yaw) * d;
      ground.put(cx, cz, Math.atan2(cx - a.x, cz - a.z), pitch);
      return [+cx.toFixed(2), +cz.toFixed(2)];
    },
    reachAs: (kind, side = 0, still = false) => { reachForce = kind ? [kind, side, still] : null; return reachForce; },
    breasts: () => (jadrija && jadrija.breasts ? jadrija.breasts() : null),
    handsV2: () => (jadrija && jadrija.handsV2 ? jadrija.handsV2() : null),
    hips: () => (jadrija && jadrija.hips ? jadrija.hips() : null),
    kabinaTargets: () => (jadrija && jadrija.kabinaTargets ? jadrija.kabinaTargets() : null),
    /** Debug: what the last real right-click did — 'free', 'radio', 'tv', or null. */
    rightLast: () => rightLast,
    /** Debug: a right-click, as if the mouse had done it. */
    poke: () => (jadrija && jadrija.kabinaPoke
      ? jadrija.kabinaPoke(camera.position, camera.getWorldDirection(new THREE.Vector3())) : null),
    /**
     * Debug: stand `d` metres in front of Baye's face, looking at her mouth.
     * Only while her mouth is being held open, because that is the only time
     * her lip is published — which is also the only time this is wanted.
     */
    faceLook: (d = 0.6) => {
      const L = jadrija && jadrija.thumbReach ? jadrija.thumbReach() : null;
      if (!L || !jadrija) return null;
      const n = Math.hypot(L.fx, L.fz) || 1;
      const px = L.x + (L.fx / n) * d, pz = L.z + (L.fz / n) * d;
      const [t, s] = jadrija.local(px, pz);
      return __fr.jad.stand(t, s, Math.atan2(px - L.x, pz - L.z));
    },
    /** What the apprentice is doing, without building the whole of `stats`. */
    appr: () => apprenticeStats(),
    apprCheck: () => (jadrija && jadrija.apprCheck ? jadrija.apprCheck() : null),
    /**
     * Debug: stand in front of the apprentice, looking at her. One call,
     * because doing it by hand costs a screenshot a guess.
     *
     * The yaw is the one thing here worth writing down. `you.yaw`'s forward
     * is (−sin, −cos) — see the walker at `fx`/`fz` in 47-ground.js — so
     * looking AT a point is `atan2(x − lx, z − lz)`, with the subtraction the
     * way round that looks wrong. `look()` in that file already spells it
     * out; this is the same line and deliberately so. Getting the sign
     * backwards points the camera at the kabine, which is a perfectly
     * plausible photograph of the wrong thing.
     */
    apprLook: (back = 2.6, side = 0) => {
      const a = apprenticeAt();
      if (!a || !jadrija) return null;
      // Her own facing, so "in front of her" means in front of HER and not
      // on some compass bearing. Her forward is (cos y, -sin y); the camera
      // goes out along it and turns round.
      const fx = Math.cos(a.yaw), fz = -Math.sin(a.yaw);
      const sx = Math.sin(a.yaw), sz = Math.cos(a.yaw);
      const cx = a.x + fx * back + sx * side;
      const cz = a.z + fz * back + sz * side;
      const [t, s] = jadrija.local(cx, cz);
      return __fr.jad.stand(t, s, Math.atan2(cx - a.x, cz - a.z));
    },
    /** Blade, hand, and the gap between them — see `cokeReach`. */
    cokeHand: () => (jadrija && jadrija.cokeHand ? jadrija.cokeHand() : null),
    /** The line beat's every-frame numbers — see tools/coke_probe.mjs. */
    cokeProbe: () => (jadrija && jadrija.cokeProbe ? jadrija.cokeProbe() : null),
    cokeMarks: () => (jadrija && jadrija.cokeMarks ? jadrija.cokeMarks() : null),
    /** What she saw on the last recon, and what she brought back. */
    seen: () => (jadrija ? jadrija.seen() : null),
    told: () => (jadrija ? jadrija.told() : null),
    /**
     * Walk into her, without walking. This is the collider's own hook — see
     * `bumpReact` — so it is the same call the ground makes on the first
     * frame of contact, and the only way a probe can test being shoved.
     */
    bump: (kind = 'baye', idx = 0, t = 0, s = 0) => jadrija.bump(kind, idx, t, s),
    /** Hold the jet on her without a jet — see `douse` in 43-jadrija.js. */
    douse: (v) => jadrija.douse(v),
    /** The special kabina, in the resort's own frame — where `put` has to put
     *  her for anything that only happens in there. */
    kabina: () => (jadrija ? jadrija.kabina : null),
    bones: (...a) => jadrija.bones(...a),
    /**
     * The resort's own frame, both ways, so a probe can check a PLACEMENT.
     *
     * `bones` answers in world metres and every mark in that room — the cot,
     * its two long edges, the plate, the wine — is published in (t, s). With
     * no way across, a test of where she is lying can only assert heights, and
     * a pose can be a foot off the side of a bed with every height perfect.
     * Both directions, because the two questions are "where in the room is
     * this bone" and "where in the world is that mark".
     */
    local: (x, z) => (jadrija && jadrija.local ? jadrija.local(x, z) : null),
    toWorld: (t, s) => (jadrija && jadrija.toWorld ? jadrija.toWorld(t, s) : null),
    /**
     * How far into the special kabina the game thinks you are, 0 to 1 — the
     * number the light and the shore bed both hang off, which is the only way to
     * tell a door that is not working from a room that is not dark enough.
     */
    indoors: () => ({ v: +indoors.toFixed(3),
      dark: +roomDark.toFixed(3),
      exp: +renderer.toneMappingExposure.toFixed(3),
      // The near clip, which is what "I can see through that wall" actually is.
      near: +camera.near.toFixed(3),
      cam: [+camera.position.x.toFixed(1), +camera.position.z.toFixed(1)],
      // And the eye, which is the point the room is actually asked about.
      // Printed next to the camera on purpose: the gap between these two is
      // the bug this pair exists to catch, and it is invisible in any reading
      // that shows only one of them.
      eye: [+personAt().x.toFixed(1), +personAt().z.toFixed(1)],
      kab: jadrija && jadrija.kabina
        ? +jadrija.kabina.inside(personAt().x, personAt().z).toFixed(3) : null,
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
  brod: {
    stats: () => (brod ? brod.stats() : null),
    raw: () => brod,
    /** Get on her without walking out to the mole first. */
    go: () => {
      if (!brod || !brod.enter()) return null;
      if (ground && ground.ok && state.phase === 'ground') ground.bail();
      camOverride = null;
      state.phase = 'brod';
      clearModes('brod-hud');
      // The same three lines `boardBrod` runs, and they were missing here:
      // a probe that boards her through this door on a touch device got the
      // aeroplane's controls, and the stick that walks her deck was not on
      // the screen to be driven. A back door that lands you somewhere the
      // front door does not is a back door that tests the wrong game.
      if (IS_TOUCH) {
        $('touch').hidden = true; $('gtouch').hidden = true;
        $('stouch').hidden = false;
      }
      paintBrodHud();
      return brod.stats();
    },
    /**
     * Step the voyage without the frame loop, for the same reason the kite has
     * one: software GL runs at a few frames a second and this passage is nine
     * and a half minutes long, so nothing about it can be checked in real time.
     */
    tick: (secs, dtStep = 1 / 30, ctl = {}) => {
      if (!brod || !brod.active) return null;
      let out = null;
      for (let t = 0; t < secs; t += dtStep) out = brod.update(dtStep, ctl) || out;
      brod.pose(camera);
      paintBrodHud();
      return { ...brod.stats(), out };
    },
    /**
     * The clock, not the engine. `fast()` toggles, `fast(true)` sets — the same
     * thing T does on her deck, exposed because a nine-minute passage is not
     * something a probe can sit through.
     */
    fast: (v) => toggleBrodFast(v),
    /** Whether it is running itself right now, and whether anybody said so. */
    fastOn: () => ({ on: brodFast, want: brodWant }),
    /** Jump to a point on the passage, in metres run, and look at the world. */
    at: (m) => {
      if (!brod) return null;
      camOverride = null;
      if (!brod.active) {
        if (!brod.enter()) return null;
        if (ground && ground.ok && state.phase === 'ground') ground.bail();
        state.phase = 'brod';
        for (const id of ['hud', 'ground-hud', 'chute-hud', 'swim-hud', 'ride-hud'])
          $(id).hidden = true;
        $('brod-hud').hidden = false;
      }
      brod.seek(m);
      // Several steps rather than one: `place` *chases* the attitude, so a
      // single frame after a teleport of four kilometres leaves her flat.
      for (let i = 0; i < 30; i++) brod.update(0.05, {});
      brod.pose(camera);
      paintBrodHud();
      return brod.stats();
    },
    /** The two ends, so a shot can be set up against them. */
    marks: () => (brod ? { dock: brod.dock, berth: brod.berth, quay: brod.quay,
      total: brod.total } : null),
  },
  swim: {
    stats: () => (swim ? swim.stats() : null),
    raw: () => swim,
    /**
     * Third person, as the B key does it. See `poseSwimBody`.
     *
     * Left under `swim` although it is no longer only the swim's, because it
     * is what anybody who has used it types and moving it would break that for
     * the sake of a tidier tree. Note it TOGGLES when called with nothing:
     * `body()` in a probe flips the state it was meant to be reading, which
     * has now cost two wrong test runs. Pass `true` to read-and-set.
     */
    /**
     * THIS TOGGLES. It is not a getter, and calling it to "check" the state
     * flips the thing you are checking — which cost a measurement: set true,
     * read (flipped to false), read again after a frame (flipped back to
     * true), and the reading looked like the switch was being reset by the
     * frame loop. Use `bodyOn()` to read.
     */
    body: (v) => { bodyCam = v == null ? !bodyCam : !!v; syncBodyBtn(); return bodyCam; },
    /** Read it without changing it. */
    bodyOn: () => bodyCam,
    /**
     * THE ONE NUMBER THE B KEY HANGS ON: metres of clear air between the lens
     * and HER SKIN.
     *
     * Not from the camera to her origin, which is between her boots, and not
     * from the camera to her eye, which is what `thirdD` reports and what every
     * threshold in this game was written against. Misha, 7 Sep: *"the camera
     * sometimes is too close to Chloe, and it slices right through me so i see
     * sorta 'inside' myself"* — and that is a statement about her SURFACE and a
     * front plane, so it can only be settled by a number measured to the
     * surface. `thirdD` said 1.05 m at the moment the shot was of the inside of
     * her head, and 1.05 looks perfectly healthy next to a floor of 0.95.
     *
     * So the rig is skinned on the CPU, exactly as the vertex program skins it
     * — `uBones` is the same palette the GPU reads, three RGBA texels a bone
     * holding a 3x4, and `aBoneIdx`/`aBoneWt` are the same two attributes — and
     * the nearest of the seven thousand vertices to the lens is the answer.
     * Slow and correct: it is one pass over the buffer, off the frame loop,
     * asked by a probe and by nothing else.
     *
     * `cut` is the whole point: the front plane is at `camera.near`, so any gap
     * under it is a triangle of her thrown away and the back faces behind it
     * showing through the hole.
     *
     * `stride` skips vertices, for a sweep that asks this question ten thousand
     * times. At 8 it reads about a centimetre long — the spacing of her own
     * mesh — which is nothing next to the quarter of a metre this is used to
     * find. Leave it at 1 for a number that goes in a commit message.
     */
    bodyGap: (stride = 1) => {
      if (!you) return null;
      const fig = you.fig;
      const P = fig.uBones.value.image.data;
      const g = fig.mesh.geometry;
      const pos = g.attributes.position.array;
      const bi = g.attributes.aBoneIdx.array;
      const bw = g.attributes.aBoneWt.array;
      const n = pos.length / 3;
      fig.mesh.updateMatrixWorld();
      const m = fig.mesh.matrixWorld.elements;
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      let best = Infinity, bx = 0, by = 0, bz = 0;
      for (let v = 0; v < n; v += stride) {
        const px = pos[v * 3], py = pos[v * 3 + 1], pz = pos[v * 3 + 2];
        let sx = 0, sy = 0, sz = 0;
        for (let k = 0; k < 4; k++) {
          const w = bw[v * 4 + k];
          if (w === 0) continue;
          const q = w / 255, o = bi[v * 4 + k] * 12;
          sx += q * (P[o] * px + P[o + 1] * py + P[o + 2] * pz + P[o + 3]);
          sy += q * (P[o + 4] * px + P[o + 5] * py + P[o + 6] * pz + P[o + 7]);
          sz += q * (P[o + 8] * px + P[o + 9] * py + P[o + 10] * pz + P[o + 11]);
        }
        const wx = m[0] * sx + m[4] * sy + m[8] * sz + m[12];
        const wy = m[1] * sx + m[5] * sy + m[9] * sz + m[13];
        const wz = m[2] * sx + m[6] * sy + m[10] * sz + m[14];
        const d = (wx - cx) * (wx - cx) + (wy - cy) * (wy - cy)
          + (wz - cz) * (wz - cz);
        if (d < best) { best = d; bx = wx; by = wy; bz = wz; }
      }
      const gap = Math.sqrt(best);
      // And the number the fix is actually written against: how far the lens is
      // from the SEGMENT her body stands on — her root to her crown, 1.75 m of
      // it. A capsule and not a point, because a point is what `thirdD` already
      // is and a point is what let the lens end up beside her hip with a
      // perfectly healthy-looking 1.05 m on the clock.
      const ax = m[12], az = m[14];
      // 1.75 m: her crown in the bind pose, measured off this same buffer —
      // 1.742 in the idle, 1.707 mid-stride, 1.741 at the top of a jump.
      const ay = clamp(cy, m[13], m[13] + 1.75);
      const spine = Math.hypot(cx - ax, cy - ay, cz - az);
      return {
        gap: +gap.toFixed(3),
        spine: +spine.toFixed(3),
        near: +camera.near.toFixed(3),
        cut: gap < camera.near,
        seen: fig.mesh.visible,
        phase: state.phase,
        // What the mode thinks it managed, for the gap between the two.
        thirdD: state.phase === 'ground' && ground && ground.ok
          ? +ground.thirdD().toFixed(3)
          : (state.phase === 'brod' && brod ? +brod.thirdD().toFixed(3) : null),
        cam: [+cx.toFixed(2), +cy.toFixed(2), +cz.toFixed(2)],
        // The nearest vertex itself, so a reading that looks wrong can be
        // checked against the picture: a hit on her crown and a hit on her heel
        // are different bugs.
        hit: [+bx.toFixed(2), +by.toFixed(2), +bz.toFixed(2)],
      };
    },
    /** The changing station: dressed or not, and which cubicle she is in. */
    changed: (v) => {
      if (v != null) setDressed(!v);
      return { dressed, bay: inChg, at: chgStep };
    },
    driven: () => (you ? you.driven() : null),
    /**
     * The jump, and whether the rig has heard about it.
     *
     * `hit` is the answer to the only question that matters when the legs come
     * out straight: did `aim` find the bone. It returns false for a name the
     * rig does not carry and says nothing, so a jump posed against the wrong
     * skeleton looks exactly like a jump that was never posed at all.
     */
    jump: () => {
      if (!ground || !ground.ok || !you) return null;
      const g = ground.you;
      return { hop: +g.hop.toFixed(3), hopV: +g.hopV.toFixed(2),
        air: +(g.hop > 0 ? clamp(g.hop / JUMP.apex, 0, 1) : 0).toFixed(3),
        push: +jumpPush.toFixed(2), land: +jumpLand.toFixed(2),
        // Where the knee, the heel and the hand actually are in figure space.
        // Not decoration: the first cut of this posed nothing at all and
        // looked exactly like the second, which posed 0.25 m of knee travel
        // that nobody could see at four metres. A screenshot cannot tell those
        // two apart and this can — 0.47 to 0.65 of knee is a jump, 0.47 to
        // 0.53 is a rounding error with a comment over it.
        at: (() => {
          const v = new THREE.Vector3(); const o = {};
          for (const n of ['legLL', 'footL', 'handL']) {
            const i = you.fig.bones.findIndex((b) => b.name === n);
            if (i < 0) { o[n] = 'NO SUCH BONE'; continue; }
            you.fig.boneAt(i, v);
            o[n] = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
          }
          return o;
        })() };
    },
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
   * The fly on the gornji kat — src/44-vikendica.js.
   *
   *   __fr.vik.stand('living'); __fr.fly.go('ceiling'); __fr.fly.watch(0.5);
   *
   * `go` puts it where you want it — cruise, land, or a perch by name —
   * `step(s)` runs its own clock forward without waiting for the wall one, and
   * `watch(d)` stands the camera `d` metres off it and points at it. The lens
   * goes with the last of those, because a seven-millimetre animal at half a
   * metre through a 58 degree lens is nine pixels and there is no argument to
   * be had about nine pixels.
   */
  fly: {
    raw: () => (jadrija && jadrija.vik ? jadrija.vik.fly : null),
    stats: () => (jadrija && jadrija.vik ? jadrija.vik.fly.stats() : null),
    go: (what) => (jadrija && jadrija.vik ? jadrija.vik.fly.go(what) : null),
    hold: (on) => (jadrija && jadrija.vik ? jadrija.vik.fly.hold(on) : null),
    at: () => (jadrija && jadrija.vik ? jadrija.vik.fly.at() : null),
    perches: () => (jadrija && jadrija.vik ? jadrija.vik.fly.perches() : null),
    /**
     * Run the fly's clock. The person is handed in because that is what it
     * measures the buzz against — see `stepFly`.
     */
    step: (secs = 1) => {
      const v = jadrija && jadrija.vik;
      if (!v) return null;
      v.fly.step(secs, personAt());
      return v.fly.stats();
    },
    /**
     * Stand off it and look at it, on a long lens. `d` is metres, `fov` the
     * lens, and `__fr.free()` puts both back.
     *
     * The eye goes on the room side of the fly — toward the middle of the big
     * room, at (1.2, 4.6, 1.4) in the house's own metres — so that a fly on
     * the ceiling is photographed from underneath and one on the window from
     * inside, which are the two views there are.
     */
    watch: (d = 0.5, fov = 16) => {
      const v = jadrija && jadrija.vik;
      if (!v) return null;
      const p = v.fly.at();
      const mid = v.at([1.2, 4.60, 1.40]);
      let dx = mid[0] - p[0], dy = mid[1] - p[1], dz = mid[2] - p[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      dx /= len; dy /= len; dz /= len;
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camOverride = [p[0] + dx * d, p[1] + dy * d, p[2] + dz * d,
        p[0], p[1], p[2]];
      return { at: p.map((n) => +n.toFixed(2)), d, fov };
    },

    /**
     * ── the swat ──
     *
     * `swat()` is the hit itself, exactly as the water would deliver it: the
     * spiral, the camera, the cut, everything. `kill()` skips the whole
     * sequence and puts a corpse on the floor, which is what a test that wants
     * to photograph the tile rather than the shot wants.
     *
     *   __fr.vik.stand('living'); __fr.fly.swat(); __fr.fly.cutAt(2.4);
     *
     * `cutAt` is the scrub, and it exists for the reason `vik.cutAt` does: the
     * sequence is driven by wall time and a headless page runs about one frame
     * a second, so a screenshot of the close-up taken by waiting for it is a
     * screenshot of the first tenth of the spiral. It sets the time outright,
     * runs the fly's own clock up to the same point, and holds there.
     */
    swat: () => (startSwat() ? 'hit' : 'no'),
    kill: () => {
      const v = jadrija && jadrija.vik;
      return v ? v.fly.kill() : null;
    },
    revive: () => {
      const v = jadrija && jadrija.vik;
      return v ? v.fly.revive() : null;
    },
    corpses: () => {
      const v = jadrija && jadrija.vik;
      return v ? v.fly.dead() : null;
    },
    cutAt: (t) => {
      const v = jadrija && jadrija.vik;
      if (!v) return null;
      if (t == null) {
        swatHold = false; v.fly.hold(false); return 'released';
      }
      if (!swatCut && !startSwat()) return 'no fly';
      // Both clocks, together, and BOTH of them have to be taken off the frame
      // loop. The camera is pointed at wherever the animal has actually got
      // to, so a scrub that advanced the shot and let the room advance the fly
      // — which on a card is most of a second between two captures — frames an
      // empty room and photographs it.
      swatHold = true;
      v.fly.hold(true);
      const want = Math.max(0, t);
      const step = 1 / 60;
      // The WALKER, and not `personAt()`, and this cost an hour.
      //
      // `personAt` returns the camera whenever an override has the camera —
      // which a cut always does — and `camera.position` is written by the
      // frame loop. Scrubbing runs a hundred steps between two frames, so
      // every one of them after the first was handed a camera still standing
      // wherever it was before the shot started: two kilometres away, past the
      // 30 m gate `stepFly` uses to decide the flat is worth simulating. The
      // fly stopped dead on the first step and the shot arced round an empty
      // patch of ceiling, with `stats()` reporting a perfectly healthy spiral
      // because the frame loop had re-posed it in between.
      const who = ground && ground.ok
        ? { x: ground.you.x, y: ground.you.y + ground.you.eye, z: ground.you.z }
        : personAt();
      while (swatCut && swatCut.t < want) {
        v.fly.hold(false);
        v.fly.step(step, who);
        v.fly.hold(true);
        stepSwat(step);
      }
      return swatCut ? { t: +swatCut.t.toFixed(2), fly: v.fly.stats().mode }
        : 'over';
    },
    /**
     * Point the close-up's own camera by hand: metres out, radians above the
     * tile, radians round from the animal's nose. For looking at the corpse
     * from somewhere the shot itself never goes, which is how the anatomy gets
     * checked at all — the shot is one 3 cm arc and half the animal is behind
     * it.
     */
    frame: (d = 0.05, el = 0.4, az = 1.0) => {
      const v = jadrija && jadrija.vik;
      if (!v) return null;
      v.fly.shot().look(d, el, az);
      return { d, el, az };
    },
    /** How long the whole thing runs, so a recorder can size itself off it. */
    cutLen: () => {
      const v = jadrija && jadrija.vik;
      if (!v) return null;
      const Z = jadrija.zombies;
      const tail = Z && Z.room() ? SWAT.stillRise + v.fly.shot().riseLen() : SWAT.still;
      return +(v.fly.fallSecs() + SWAT.floor + SWAT.macro + tail).toFixed(2);
    },
    cut: () => (swatCut ? { t: +swatCut.t.toFixed(2) } : null),
  },

  /**
   * The Bucketeer — src/45-bucketeer.js.
   *
   * `ways()` is her route, `go(phase)` drops her on a beat of it and `tick(s)`
   * runs the loop forward without waiting for the wall clock. `watch` is the
   * one that gets a picture.
   *
   * THIS COMMENT USED TO SAY `watch(k, back)` — "stands you `back` metres
   * behind waypoint `k` looking at it" — and that is not what `watch` does or
   * has ever done. It takes `(back, side, aim)` and it frames HER, wherever she
   * is, off `b.where()`; the correct description has been on the function
   * itself the whole time and the two disagreed. Following the wrong one costs
   * about twenty minutes: `watch(1, 2.4)` reads as waypoint 1 at 2.4 m and
   * means 1 m in front and 2.4 m to her right, so the camera lands beside her
   * looking past her at a wall, and every frame comes back with no Bucketeer
   * in it. Which is exactly what happened.
   *
   *   __fr.buck.go('tip'); __fr.buck.tick(1.2); __fr.buck.watch(2.6, 0.8, 0.5);
   *
   * The phase names `go` accepts are the ones `stats().phase` reports:
   * fill, lift, down, tip, set, up — not the waypoint labels.
   */
  buck: {
    raw: () => jadrija && jadrija.bucketeer,
    stats: () => (jadrija && jadrija.bucketeer ? jadrija.bucketeer.stats() : null),
    ways: () => (jadrija && jadrija.bucketeer ? jadrija.bucketeer.ways() : null),
    go: (phase, leg) => (jadrija && jadrija.bucketeer
      ? jadrija.bucketeer.go(phase, leg) : null),
    tick: (secs = 1) => (jadrija && jadrija.bucketeer
      ? jadrija.bucketeer.tick(secs) : null),
    hold: (on) => (jadrija && jadrija.bucketeer
      ? jadrija.bucketeer.hold(on) : null),
    /**
     * Her voice, both of them.
     *
     * `hum(false)` and `say(false)` are the controls for an A/B recording, which
     * is the only honest way to say what she does to the bird calls — see the
     * note on each in 45-bucketeer.js. `say('ajme')` plays one Croatian line
     * where she stands without waiting out a five-minute clock, and takes a
     * suffix as well as a whole key so a plan on disk can ask for `'pomalo'`.
     */
    hum: (on) => (jadrija && jadrija.bucketeer
      ? jadrija.bucketeer.hum(on) : null),
    say: (v) => (jadrija && jadrija.bucketeer
      ? jadrija.bucketeer.say(v) : null),
    /**
     * Stand off her and look at her, on whichever floor she is on.
     *
     * `back` is metres in front of her, so the default is her face; negative is
     * over her shoulder. `side` is to her right. `aim` is what the camera is
     * pointed at, measured up from her feet — 0.35 for the bucket, 1.5 for her
     * face — and it is the only reason this is not `vik.stand`: her whole loop
     * is about a thing at ankle height, and a camera holding a 1.66 m eye level
     * cannot see one without a pitch.
     *
     * `yHint` is hers, which is what stops the camera dropping to the
     * prizemlje when she is standing in the flat above it.
     */
    watch: (back = 4, side = 0, aim = 1.0) => {
      const b = jadrija && jadrija.bucketeer;
      if (!b || !ground || !ground.ok) return null;
      const [hx, hy, hz] = b.where();
      const yaw = b.stats().yaw;
      const fx = Math.cos(yaw), fz = -Math.sin(yaw);
      const x = hx + fx * back + fz * side;
      const z = hz + fz * back - fx * side;
      ground.retarget(jadrija);
      ground.dropIn(x, z, 0);
      const a = Math.atan2(-(hx - x), -(hz - z));
      // THE FLOOR SHE IS ON, AND NOT THE ONE OVER HER HEAD. `put` has taken a
      // `yHint` since the prizemlje arrived and the note over it says exactly
      // why; `dropIn` has not, and asks `walkY` cold. Cold on the porch that
      // answers with the TERRACE — the porch is `terrasa 8` and there is a slab
      // 2.80 m over it — so `ground.you.y` here was the balcony, the eye was
      // computed 2.80 m too high, and every pitch taken off it looked down
      // through the underside of the terrace at her feet. Photographing the
      // pour from four sides in a row produced four pictures of paving.
      //
      // So the hint is applied first and the eye read back off it. Two `put`s
      // and not one, because the pitch needs the eye and the eye needs the
      // floor: the first lands her on the right storey, the second aims.
      ground.put(x, z, a, 0, hy);
      const eye = ground.you.y + 1.66;
      const p = Math.atan2(hy + aim - eye, Math.hypot(hx - x, hz - z));
      ground.put(x, z, a, p, hy);
      return { at: [+x.toFixed(1), +z.toFixed(1)], yaw: +a.toFixed(3),
        pitch: +p.toFixed(3), her: [+hx.toFixed(1), +hy.toFixed(2), +hz.toFixed(1)] };
    },
  },

  /**
   * The Bucketeer's pour, as a scene — the block over `POUR` above.
   *
   *   __fr.pour.frame(0.95)      the shot at 0.95 s, held for a screenshot
   *   __fr.pour.frame(6.60)      and at 6.60, which is the second one
   *   __fr.pour.go()             fire it for real, wherever you are standing
   *   __fr.pour.why()            which clause the live gate is sitting on
   *   __fr.pour.seen(false)      clear the cooldown; seen(true) parks it
   *   __fr.pour.free()           her loop and the camera back
   *
   * `frame` is the `__fr.fly.cutAt` of this cut and it exists for exactly the
   * same reason: a headless page runs about a frame a second and the shot is
   * nine and a bit seconds of a fifty second loop, so photographing it by
   * waiting for it is not photographing it. It scrubs HER — `go('tip')` and
   * then `tick` — and then asks the cut where its camera is at that time, which
   * is the only honest way to film a cut whose clock is hers. The letterbox and
   * the HUD go with it, so what comes back is the frame and not the frame with
   * a litre counter on it.
   */
  /**
   * The flies that got up — src/45-zombie.js. `stats()` is where each one is
   * and what it is doing; `spawn(x, y, z)` enrols one at a house-metre point
   * without a swat, which is what a probe of the pour insert needs.
   */
  /**
   * Ears — src/49-ears.js. `act('fly.drop')` does a command without a
   * microphone, which is how a probe checks the half of this that is not the
   * transcriber; `flyCam(t)` holds the corner shot at `t` for a screenshot.
   */
  ears: {
    stats: () => ears.stats(),
    toggle: () => ears.toggle(),
    act: (name, lang) => ears.act(name, lang),
    /**
     * The typing line — see the note where it is built in 49-ears.js.
     * `typing()` is whether the caret is in it, which is the question the
     * keydown handler asks before it reads a key as a control; `focus()` puts
     * it there the way ENTER does; `say(text)` sends a line without the box,
     * which is how a probe drives the typed path.
     */
    typing: () => (ears.typing ? ears.typing() : null),
    /** The microphone, which `I` no longer opens — see `typedOn` in 49-ears.js. */
    mic: () => (ears.mic ? ears.mic() : null),
    open: () => (ears.open ? ears.open() : null),
    focus: () => (ears.focusTyping ? ears.focusTyping() : null),
    say: (text) => (ears.say ? ears.say(text) : null),
    /**
     * `flyCam(t, mode)` holds the corner shot at `t` for a screenshot, and
     * `big` draws it over the whole frame instead of in its corner — which is
     * a debug switch and nothing else. A 460 pixel picture is the right size
     * to answer a question in while you play and the wrong size to check a
     * twelve second routine in, and the birthday number was framed in it.
     */
    flyCam: (t, mode = 'drop', big = false) => {
      flyCamBig = !!big;
      if (t == null) { flyCamHold = false; return flyCamT; }
      startFlyCam(mode); flyCamT = t; flyCamHold = true; return flyCamT;
    },
  },
  /**
   * Her own recorded noises — `noises` in src/80-audio.js. `noise('wet')`
   * plays one; `noise()` answers how many have been played, which is the only
   * way a probe can tell a clip that sounded from a clip that never decoded.
   */
  noise: (set, gain = 1) => {
    if (!audio || !audio.noises) return null;
    if (!set) return audio.noises(null, 0, 0, true);
    // `now` is which set is sounding and `stop` lets it go — the pair that
    // says whether the long take is still running, which is the whole
    // question about a recording that outlives the pose it belongs to.
    if (set === 'now') return audio.noiseNow();
    if (set === 'stop') return audio.noiseStop();
    audio.noiseWarm(set);
    return audio.noises(set, gain);
  },
  zombie: {
    drop: () => (jadrija && jadrija.zombies ? jadrija.zombies.drop() : null),
    dance: () => (jadrija && jadrija.zombies ? jadrija.zombies.dance() : null),
    birthday: () => (jadrija && jadrija.zombies ? jadrija.zombies.birthday() : null),
    brush: () => (jadrija && jadrija.zombies ? jadrija.zombies.brush() : null),
    /** What the close-up measured off the animal, in mm — see `metrics`. */
    metrics: () => (jadrija && jadrija.vik ? jadrija.vik.fly.shot().metrics() : null),
    /**
     * Run the birthday number past the lens without drawing it and report
     * the worst thing it does: how far a pail goes through the tile, and
     * where. A twelve second routine with two buckets swinging off a moving
     * animal cannot be checked by looking at eight frames of it.
     */
    bdaySweep: (step = 0.02) => {
      if (!jadrija || !jadrija.vik) return null;
      const S = jadrija.vik.fly.shot();
      let worst = 99, at = 0, near = 99, nearAt = 0;
      for (let t = 0; t < S.birthdayLen(); t += step) {
        S.birthdayShot(t);
        for (const p of S.pailAt()) {
          if (p[1] < worst) { worst = p[1]; at = t; }
          // And into the cake, which stands at the origin: 1.29 mm of radius
          // and 2.7 mm of it including the candle.
          if (p[1] < 2.7) {
            const d = Math.hypot(p[0], p[2]) - 1.29;
            if (d < near) { near = d; nearAt = t; }
          }
        }
      }
      S.reset();
      return { lowestPail: +worst.toFixed(3), at: +at.toFixed(2),
        pailToCake: +near.toFixed(3), cakeAt: +nearAt.toFixed(2) };
    },
    stats: () => (jadrija && jadrija.zombies ? jadrija.zombies.stats() : null),
    spawn: (x, y, z) => (jadrija && jadrija.zombies ? jadrija.zombies.spawn(x, y, z) : null),
    /** Everybody hum now; the answer is how many phrases the voice has started. */
    hum: () => {
      if (!jadrija || !jadrija.zombies) return null;
      jadrija.zombies.hum();
      return audio && audio.zombieHum ? audio.zombieHum(0, { probe: true }) : null;
    },
    heard: () => (audio && audio.zombieHum ? audio.zombieHum(0, { probe: true }) : null),
    /** How many birthday tunes the voice has started. See `zombieSong`. */
    sang: () => (audio && audio.zombieSong ? audio.zombieSong(0, { probe: true }) : null),
  },
  pour: {
    frame: (t = 0) => {
      const b = jadrija && jadrija.bucketeer;
      if (!b || !ground || !ground.ok) return null;
      // A scrub is not a performance. `go('tip')` below puts her on the first
      // frame of the roll, which is now the WHOLE of `checkPour` — so without
      // this the real cut starts a frame later and the two of them write the
      // camera on alternate frames, the one that wins being whichever ran last.
      // Take it down, and park the cooldown where the live path cannot reach
      // it; `seen(false)` hands it back.
      //
      // `pourSeen` used to be what this line set, and it was already a lie when
      // the latch became a clock — nothing has gated on `pourSeen` since. It is
      // still set, because the scrub HAS shown the cut and that is what the flag
      // means, but `pourAgain` is the half that does the work.
      if (pourCut) endPour(false);
      pourSeen = true;
      pourAgain = POUR.hold;
      b.hold(true);
      b.go('tip');
      // THE RIG BEFORE THE TICK, and it is the whole of what makes this a
      // picture of the cut rather than a picture of her. Both shots are locked
      // off to where she STARTS, and the last two seconds of the second one are
      // her walking out of it — so a rig taken after the scrub would follow her
      // down the porch and photograph a shot that does not exist.
      const R = pourRig(b);
      // `trace` and not `tick`, and it is not a preference. `tick` advances the
      // state machine and then places the pail and the water ONCE, at the end,
      // so every frame in between is a frame nobody drew — and the wet patch on
      // the paving is written by `placeWater` on the frames the water is
      // actually landing. Scrubbed with `tick`, the porch is bone dry for the
      // whole second half of the cut and the fault is in the scrub, not in the
      // game. `trace` draws every one of them; the rows it hands back are the
      // price and they are thrown away here.
      if (t > 0) b.trace(t, 1 / 60);
      const shot = pourPlace(R, t);
      pourInsertT = t;
      $('cine').hidden = false;
      $('cine').classList.remove('open');
      $('cine-skip').hidden = true;
      $('ground-hud').hidden = true;
      const k = b.beat();
      return { t: +t.toFixed(2), shot, beat: k.phase, into: +k.t.toFixed(2),
        clock: +pourClock().toFixed(2),
        eye: camOverride.slice(0, 3).map((n) => +n.toFixed(2)),
        fov: camera.fov };
    },
    go: () => (startPour() ? 'rolling' : 'no'),
    /**
     * Why it is not firing, clause by clause.
     *
     * `why` is the answer and the rest are the inputs it was read off, in the
     * order `checkPour` reads them. It is not recomputed here: it is the string
     * that function wrote on the last frame it ran, so this cannot list a
     * clause the game no longer has. The seven it USED to list — gap, rise,
     * indoors, house, dot, eyes and the arm window — are gone with the gate
     * they belonged to; only the arm window survives, as `clock` against `arm`.
     *
     *   fired         it started one, on that frame
     *   rolling       one is already running
     *   cooldown      `POUR.again`, or a probe's `seen(true)`
     *   noBucketeer   she has not been built
     *   notAfoot      you are flying, swimming, riding, dead or in the intro
     *   noGround      the walker has not been built
     *   paused        the menu is up
     *   owned         another cut or overlay has the camera
     *   notPouring    her clock is outside `arm` of the top of a tip
     *   sameTip       this tip has already been offered — see `pourEdge`
     *
     * `gap` is here to orient a probe and is NOT a clause: nothing about where
     * you are standing gates this cut any more. It is measured off `ground.you`
     * and not off `personAt()`, which during a cut is the cut's own camera two
     * and a half metres from her face — a probe reading that one mid-roll gets
     * a number about the shot and thinks it is about the player.
     */
    why: () => {
      const b = jadrija && jadrija.bucketeer;
      if (!b) return 'no bucketeer';
      const w = b.where();
      return {
        why: pourWhy, rolling: !!pourCut, seen: pourSeen,
        again: +pourAgain.toFixed(1), againFor: POUR.again,
        afoot: state.phase === 'ground', state: state.phase,
        ok: !!(ground && ground.ok), paused: !!state.paused,
        owned: !!(camOverride || swatCut || vikWalk || comp || dipPhase),
        clock: +pourClock().toFixed(2), arm: POUR.arm,
        edge: +pourEdge.toFixed(2), phase: b.beat().phase,
        gap: ground && ground.ok
          ? +Math.hypot(w[0] - ground.you.x, w[2] - ground.you.z).toFixed(2)
          : null,
      };
    },
    end: () => { endPour(false); return 'out'; },
    /** The camera, the letterbox and her loop, all three. */
    free: () => {
      endPour(false);
      const b = jadrija && jadrija.bucketeer;
      if (b) b.hold(false);
      $('cine').classList.add('open');
      $('cine').hidden = true;
      $('cine-skip').hidden = false;
      $('ground-hud').hidden = false;
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
      camOverride = null;
      return 'free';
    },
    /**
     * Has it ever played, and may it play now?
     *
     * `seen(false)` re-arms it NOW and clears the cooldown with it, which is
     * the whole use of it. `seen(true)` is the other half of the same tool: it
     * parks the cooldown at `POUR.hold` so that a control run which is supposed
     * to be without the cut is without it. That used to be a no-op in
     * everything but name — `POUR.again` was ten minutes and `seen(true)` set
     * the cooldown to it — and at `again: 0` it would have been a no-op in
     * name as well, so it names its own number.
     */
    seen: (v) => {
      if (v != null) { pourSeen = !!v; pourAgain = v ? POUR.hold : 0; }
      return pourSeen;
    },
    stats: () => ({ live: !!pourCut, seen: pourSeen, why: pourWhy,
      again: +pourAgain.toFixed(1), againFor: POUR.again,
      clock: +pourClock().toFixed(2), edge: +pourEdge.toFixed(2),
      arm: POUR.arm,
      len: +POUR.len.toFixed(2), cut: +POUR.cut.toFixed(2),
      ear: !!BUCK.ear }),
  },

  /**
   * Debug: the sea's two tuning vectors, live.
   *
   * Four of the five knobs added in 1.150.0 are thresholds on a distribution
   * whose shape is only knowable by looking at it — where on the slope curve a
   * wave starts to spill, how hard a backlit crest should glow — and each one
   * costs a two minute rebuild to try. So they are uniforms.
   *
   *   __fr.sea()                       read them back
   *   __fr.sea({ steepA: 0.11 })       one at a time
   *   __fr.sea({ micro: 0.45, backlit: 3.2 })
   */
  /**
   * Debug: move the sun. The one thing a backlit crest needs is a low sun, and
   * there was no way to ask for one from outside the closure.
   */
  /** Debug: the baked capillary tile. See rippleStats in 24-ripple.js. */
  ripple: () => rippleStats(renderer),

  hour: (h) => {
    if (h != null) { state.hour = +h; setSun(); }
    const d = U.uSunDir.value;
    return {
      hour: state.hour,
      elevDeg: +state.sunElev.toFixed(1),
      // The yaw that looks straight into it, which is the only thing anybody
      // ever wants this for.
      yaw: +headingToYaw(d.x, d.z).toFixed(3),
    };
  },

  sea: (o) => {
    const F = sea.mat.uniforms.uFoamK.value;
    const K = sea.mat.uniforms.uSeaK.value;
    const C = sea.mat.uniforms.uCapK.value;
    const map = {
      steepA: [F, 'x'], steepB: [F, 'y'], crestA: [F, 'z'], crestB: [F, 'w'],
      micro: [K, 'x'], microFade: [K, 'y'], backlit: [K, 'z'], windrow: [K, 'w'],
      capA: [C, 'x'], capB: [C, 'y'], capMin: [C, 'z'], waveFar: [C, 'w'],
    };
    const lod = sea.mat.uniforms.uWaveLod;
    const fsw = sea.mat.uniforms.uFarSwell;
    if (o && Number.isFinite(o.waveLod)) lod.value = o.waveLod;
    if (o && Number.isFinite(o.farSwell)) fsw.value = o.farSwell;
    // WIND, and it is here because a question about this sea could not be
    // asked without it. Wave amplitude is `0.34 * uWaveScale * (0.45 + 0.055 *
    // uWindSpeed)` and the whitecap gate is a threshold on SLOPE, so whether
    // this channel ever caps at all is a question about a number nothing could
    // reach from the console: a scouting pass came back with "no visible foam
    // offshore at the default 9.5, and no exposed knob to find out whether the
    // threshold is simply uncrossed or genuinely broken." That is a bad place
    // to leave a debug surface. It drives the sky's cloud drift and the swim
    // and ride models off the same uniform, so turning it up moves the whole
    // weather and not just the water, which is correct and is the point.
    //
    // `state.windSpeed` and NOT `U.uWindSpeed.value`, which was the first cut
    // and did nothing at all: line 5207 of the frame loop writes
    // `U.uWindSpeed.value = state.windSpeed * (0.8 + 0.4 * state.gust)` every
    // frame, so a uniform written from the console is gone before the next
    // picture. The measurement said so before the code did — amp came back
    // 0.337, 0.340, 0.343 for winds of 14, 20 and 32, which is the gust
    // wandering and not the knob working.
    if (o && Number.isFinite(o.wind)) state.windSpeed = Math.max(0, o.wind);
    for (const [k, v] of Object.entries(o || {})) {
      if (map[k] && Number.isFinite(v)) map[k][0][map[k][1]] = v;
    }
    const out = {};
    for (const [k, [vec, c]] of Object.entries(map)) out[k] = +vec[c].toFixed(4);
    out.waveLod = +lod.value.toFixed(3);
    out.farSwell = +fsw.value.toFixed(3);
    out.wind = +state.windSpeed.toFixed(2);
    out.windNow = +U.uWindSpeed.value.toFixed(2);   // after the gust
    // The two numbers the foam gate actually compares, so a reading can be
    // taken rather than a screenshot argued over: the wave amplitude this wind
    // gives, and the slope band `steep` smoothsteps across.
    out.amp = +(0.34 * sea.mat.uniforms.uWaveScale.value
      * (0.45 + 0.055 * U.uWindSpeed.value)).toFixed(3);
    return out;
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
  /**
   * What is on you and what you have bought — see POCKET.
   *
   * `bought` is a SNAPSHOT and not the live view: it is keyed by label, the
   * way the shops write it, and spreading it here means a probe that reads
   * this twice can compare the two. The live bag is `__fr.satchel`.
   */
  pocket: () => ({ eur: +POCKET.eur.toFixed(2), bought: { ...POCKET.bought } }),
  /** Buy by name, which is what the microphone does — see `buyAt`. */
  buy: (key) => buyAt(key || null),
  /**
   * The satchel — see src/62-satchel.js. Keyed by the shops' own keys
   * (`beer`, `cigarettes`) and a label works just as well: both
   * `__fr.satchel.put('beer')` and `__fr.satchel.put('a beer')` put a beer in.
   *
   *   put(key, n)    how many of it you now have
   *   take(key, n)   how many actually came out — 0 if you had none
   *   has(key)       how many you are carrying
   *   list()         every row, in the order the panel shows them
   *   show(v)        open or close the list; answers whether it is up
   *
   * No `clear()` on purpose: a handle that empties the bag is one mistyped
   * line away from resetting the state a test is measuring.
   */
  /**
   * The phone — see src/63-phone.js. `phone()` answers what it is doing,
   * `phone.out(true)` takes it out, `phone.app('coin')` opens one, and
   * `phone.press()` is the Lovense button.
   */
  phone: Object.assign(() => phoneStats(), {
    out: (v) => phoneToggle(v),
    /**
     * Open an app by key — `coin`, `love`, `cam`, or `home` for the icons.
     *
     * IT CHECKS THE KEY, and that is not tidiness. This took any string and
     * assigned it, so `app('baye')` — the app's *name*, which is what it says
     * on the icon — set `phoneApp` to something no branch matches, and the
     * screen went black: `phoneCamStep` tests `phoneApp !== 'cam'` and
     * correctly did nothing, `phoneDraw` found no app and drew nothing. From
     * outside it is indistinguishable from a broken live feed, which is what
     * it was taken for, twice, for ten minutes each time.
     *
     * Same lesson as `MODE_HUDS` next door and the same morning: a debug
     * handle that accepts a state the game cannot reach will eventually be
     * believed. Null and a console line, so the probe fails where the mistake
     * is rather than in the screenshot.
     */
    app: (k) => {
      if (k !== 'home' && !PHONE_APPS.some((a) => a.key === k)) {
        console.warn('[phone] no app "' + k + '" — try '
          + PHONE_APPS.map((a) => a.key).join(', ') + ' or home');
        return null;
      }
      phoneToggle(true); phoneApp = k; phoneDraw(); return phoneStats();
    },
    press: () => { phonePress(); return phoneStats(); },
  }),
  satchel: {
    put: (key, n) => satchelPut(key, n == null ? 1 : n),
    take: (key, n) => satchelTake(key, n == null ? 1 : n),
    has: (key) => satchelHas(key),
    list: () => satchelList(),
    count: () => satchelCount(),
    show: (v) => satchelToggle(v),
    open: () => satchelOpen(),
  },
  /** A swig, and what the bottle is doing — see 61-beer.js. */
  drink: () => drinkBeer(),
  bottle: () => ({ out: beer.out, left: beer.left, swigging: beer.t >= 0,
    at: beer.kit && beer.kit.group.visible
      ? [+beer.kit.group.position.x.toFixed(3),
        +beer.kit.group.position.y.toFixed(3),
        +beer.kit.group.position.z.toFixed(3)] : null,
    stow: null }),
  /**
   * The ice cream — see 61-cream.js.
   *
   * `cream(flavour)` is exactly what shore Baye calls when she hands you one,
   * so a probe can be handed one without her: it answers 'taken', 'have one'
   * or 'not now'. `lick()` is the ; key.
   *
   * `cone(secs)` is the read, and with a number it AGES the cone by that many
   * seconds of melting first and then reads it — because the melt is four
   * minutes long on purpose and no probe is going to sit through that. With no
   * argument it ages nothing and only reports, so it is safe to call twice.
   */
  cream: (flavour) => giveCream(flavour == null ? 'stracciatella' : flavour),
  lick: () => lickCream(),
  /** Bin it — which is also what she would do if she took it back off you. */
  dropCream: () => creamStow(),
  cone: (secs) => {
    if (cream.out && typeof secs === 'number' && secs > 0) {
      const sun = MELT.shade + (1 - MELT.shade) * sat(state.sunElev / MELT.peakElev);
      cream.melt = Math.min(1, cream.melt + secs * sun / MELT.full);
      cream.held += secs;
    }
    return { out: cream.out, flavour: cream.flavour, licks: cream.licks,
      licking: cream.t >= 0, melt: +cream.melt.toFixed(3),
      held: +cream.held.toFixed(2),
      at: cream.kit && cream.kit.group.visible
        ? [+cream.kit.group.position.x.toFixed(3),
          +cream.kit.group.position.y.toFixed(3),
          +cream.kit.group.position.z.toFixed(3)] : null,
      scoops: cream.kit
        ? [cream.kit.scoopA.visible, cream.kit.scoopB.visible] : null,
      drip: cream.kit ? +cream.kit.drips[0].scale.y.toFixed(4) : null };
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
    /**
     * Debug: the balcony jump, without having to be running when you ask.
     *
     * Still only the balcony jump, and since the plinth test it declines off
     * the house like the key does. A test that wants "whatever Enter would do
     * here" wants `enter()` below.
     */
    hop: (sp = 2.0) => {
      if (ground && ground.you) { ground.you.vx = -Math.sin(ground.you.yaw) * sp;
        ground.you.vz = -Math.cos(ground.you.yaw) * sp; }
      return hopOut();
    },
    /**
     * Debug: the Enter key on foot, through the ladder rather than round it,
     * and which of the three rungs answered — 'tramp', 'balcony' or 'jump'.
     * The thing worth asserting is nearly always which one: the bug this was
     * written for was a jump that came out as a parachute.
     */
    enter: () => jumpOut(),
    confine: (x, z, y) => ground.confine(x, z, y),
    walkY: (x, z, y) => ground.walkY(x, z, y),
    /** Debug: is the land cover at (x, z) water? The shoreline test. */
    sea: (x, z) => isSea(x, z),
    /**
     * Where E would put you from a point in the sea, without going there.
     *
     * The ladder in `landing` has four rungs and only the first one answers
     * anywhere near this coast, which is exactly the problem with it: the
     * other three are the floor under a key that must not fail, and a floor
     * nothing ever stands on is a floor nobody has weighed. This is how they
     * get weighed.
     */
    landing: (x, z, yaw = 0) => {
      const g = landing([x, z, yaw]);
      return { how: g.how, at: g.at ? [Math.round(g.at[0]), Math.round(g.at[1])] : null,
        loc: g.loc ? (g.loc.kind || (g.loc === jadrija ? 'jadrija' : 'airfield')) : null,
        sea: g.at ? (isSea(g.at[0], g.at[1]) ? 1 : 0) : null,
        y: g.at ? +groundAt(g.at[0], g.at[1]).toFixed(2) : null };
    },
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
        ground.setSpray(mouseDrop || (keys.has('Space') && !spaceLeapt)
      || TOUCH.gjet || debugJet);
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
  /**
   * The mode machine in one reading.
   *
   * Written for the transition tests, which have to be able to say "the swim
   * HUD is still up over a shot of somebody else's staircase" without looking
   * at a picture. Everything a mode leaves behind is in here: the phase, what
   * each water mode thinks it is doing, which HUDs are on the screen, and what
   * the shoreline handover is holding.
   */
  modes: () => ({
    phase: state.phase,
    swim: swim && swim.active ? 1 : 0,
    mask: mask && mask.on ? 1 : 0,
    ride: ride && ride.active ? 1 : 0,
    brod: brod && brod.active ? 1 : 0,
    // The one that has been lying to everybody: what `ground.wet()` is
    // reporting right now, whether or not anybody has walked anywhere.
    wet: ground && ground.wet ? ground.wet() : null,
    vikWalk: vikWalk ? vikWalk.leg : -1,
    cut: chaseCut ? 1 : 0,
    cam: camOverride ? 1 : 0,
    hud: ['hud', 'ground-hud', 'swim-hud', 'ride-hud', 'chase-hud',
      'brod-hud', 'chute-hud', 'under', 'stouch']
      .filter((id) => $(id) && !$(id).hidden),
    at: [+camera.position.x.toFixed(1), +camera.position.y.toFixed(2),
      +camera.position.z.toFixed(1)],
    sea: +seaHeightAt(camera.position.x, camera.position.z).toFixed(2),
    inSea: isSea(camera.position.x, camera.position.z) ? 1 : 0,
    toast: $('toast').textContent,
    wade: lastWade,
  }),
  /** Read the pause with no argument, set it with one. */
  pause: (on) => {
    if (on !== undefined) setPaused(on);
    // `shown` and `silent` are the two halves of the same question from
    // opposite sides: a silent pause is stopped with nothing on the screen, so
    // a probe that only asked `paused` could not tell it from an ordinary one.
    return { paused: state.paused, shown: !$('pause').hidden,
      silent: silentPause, t: +state.t.toFixed(2) };
  },
  /**
   * Hold a key down, or let it go, past the pause. For filming: `film.mjs`
   * steps a paused world, pausing clears `keys` and the keydown handler drops
   * everything while paused, so a scoop run could not be filmed with Space
   * held — the aeroplane flew the whole take over the water with the probes up.
   * Call it in the shot's `per`, not once in `setup`: every screenshot the
   * filmer takes costs the page its focus, and the blur handler lets go of
   * every key, so a key held once is held for exactly one frame.
   */
  hold: (code, on = true) => { if (on) keys.add(code); else keys.delete(code); return [...keys]; },
  setPos: (x, y, z) => flight.reset(x, z, 0, y),
  place: (x, y, z, yaw) => { flight.reset(x, z, yaw ?? 0, y); },
  cam: (i) => { camMode = i % CAMS.length; },
  /** Debug: a fixed eye [x, y, z, lookX, lookY, lookZ] over whatever mode you
   *  are in (the screenshot tool's `camOverride`); null gives it back. The
   *  walker and the hose carry on where they are. */
  eye: (a) => { camOverride = a ? a.slice(0, 6) : null; },
  /**
   * Pin the world's clock to a fixed step, for filming. 0 puts it back.
   *
   * `__fr.filmDt(1 / 16)` and then one capture per animation frame gives 16
   * frames a second of world time however long each frame took to draw, which
   * is what makes a headless page usable as a camera. See `frame()`.
   */
  filmDt: (v) => { filmDt = Math.max(0, +v || 0); return filmDt; },
  /** Fast-forward: the world `n` times a frame, drawn once — see `warp`. */
  warp: (n) => { warp = Math.max(1, Math.min(64, n | 0 || 1)); return warp; },
  /**
   * Run exactly one frame of a paused world and resolve when it is on screen.
   *
   * The pair of these is the whole camera: `filmDt` fixes how much world a
   * frame is worth and this takes one frame's worth. Await it, capture, repeat
   * — and what comes out is evenly spaced in world time no matter how long any
   * individual frame took to draw, which on this page is anywhere between a
   * thirtieth of a second and a third of one depending on where it is pointed.
   */
  filmStep: () => new Promise((res) => { filmDone = res; filmWant = 1; }),
  /**
   * Where you are in the real world, and how to get somewhere in it.
   *
   * `__fr.gps()` reads the position back as degrees. `__fr.gps(lat, lon)` puts
   * you there — on foot if you are on foot, and as a camera if you are not.
   *
   * This exists because of the Brod. Misha can stand on a quay at Jadrija and
   * I cannot, and the only thing either of us can hand the other is a pair of
   * numbers that mean the same in both places — so a survey frame with no GPS
   * in it stops being a dead end the moment somebody walks to the spot in the
   * game and reads the coordinates off.
   *
   * The projection is `tools/bake.py`'s, reduced. That file works in the DEM's
   * frame and then subtracts the offset to the game's origin, which cancels:
   * `x = (lon - ORIGIN_LON) * M_LON` and `z = -(lat - ORIGIN_LAT) * M_LAT`
   * exactly. The one number that is NOT the origin's is the longitude scale —
   * it is fixed at the *DEM's* centre latitude, 43.7150, because that is the
   * cosine bake.py used to lay every footprint down. Recomputing it at 43.7280
   * would be more correct and would put everything 15 m out, which is the kind
   * of wrong that looks right.
   *
   * Checked against Tvrđava svetog Nikole, whose OSM way centres at game
   * (-1237.2, 718.5): this returns 43.721546, 15.854624, and the fortress is
   * where OSM says it is.
   */
  gps: (lat, lon) => {
    const M_LAT = 111320.0;
    const M_LON = 111320.0 * Math.cos(43.7150 * Math.PI / 180);
    const OLAT = 43.7280, OLON = 15.8700;
    const toWorldLL = (la, lo) => [(lo - OLON) * M_LON, -(la - OLAT) * M_LAT];
    if (lat == null) {
      const c = camera.position;
      const p = (ground && ground.active && ground.you) ? ground.you : null;
      const rd = (v) => +v.toFixed(6);
      const one = (x, z) => ({
        lat: rd(OLAT - z / M_LAT), lon: rd(OLON + x / M_LON),
        world: [+x.toFixed(1), +z.toFixed(1)],
      });
      // On foot, your feet ARE the answer and the camera is not: in ground
      // mode the view can still be the aeroplane's for a frame or two after a
      // drop, and reporting both invites the wrong one to be read. Off foot
      // there is nothing to report but the camera.
      if (p) {
        const feet = one(p.x, p.z);
        return { feet, paste: feet.lat + ', ' + feet.lon, on: 'foot' };
      }
      const eye = one(c.x, c.z);
      return { eye, paste: eye.lat + ', ' + eye.lon, on: 'camera' };
    }
    const [x, z] = toWorldLL(lat, lon);
    if (Math.abs(x) > 6500 || Math.abs(z) > 6500) {
      return { error: 'outside the 13 km world', world: [+x.toFixed(1), +z.toFixed(1)] };
    }
    // On foot if the walk is up; otherwise a camera, 40 m up and looking down
    // at it, which is the only thing that can be done from a cockpit.
    // `lost: false`, because arriving by debug handle is not being stranded —
    // the default marks you as having lost the aeroplane, which is right when
    // you have bailed out and wrong when you have typed a coordinate.
    //
    // The locale comes from `localeAt`, which is the machinery a parachute
    // landing uses and the only thing that gets a far coordinate right.
    // `dropIn` runs `confine` against whatever locale is loaded, so arriving
    // three kilometres away with the resort still attached would clamp you
    // straight back into its walk box — which is what the first version of
    // this did, having decided the locale on a 1200 m radius of its own.
    if (ground && ground.ok && ground.dropIn) {
      const loc = localeAt(x, z, airfield, jadrija, city);
      if (loc && ground.retarget(loc)) {
        ground.dropIn(x, z, loc === jadrija ? jadrija.site.yaw : 0, false);
        return { walked: [+x.toFixed(1), +z.toFixed(1)],
          locale: loc.kind || (loc === jadrija ? 'jadrija' : 'airfield') };
      }
    }
    camOverride = [x, groundAt(x, z) + 40, z - 30, x, groundAt(x, z), z];
    return { flew: [+x.toFixed(1), +z.toFixed(1)] };
  },
  /**
   * Debug: the collar and the leash — see `collarCmd` and 43-leash.js.
   * `cmd('collar.on' | 'collar.off' | 'collar.stop')` as the typed line does
   * it; `tug(u)` a tug of that strength; `press(on)` the button; `walk(pts,
   * pitch, limit)` walks you through (t, s) points holding W, which is how a
   * probe leads her; `stats()`, `links()`, `fit()` (her neck in the strap).
   */
  collar: {
    cmd: (what) => collarCmd(what),
    key: () => collarCmd('collar.key'),
    tug: (u = 0.6, gest = null) => collarTug(u, gest),
    /** A firm yank flicked up / down (1.554.0) — the press's own path, `u` how hard. */
    yankUp: (u = 0.8) => collarTug(u, 'up'),
    yankDown: (u = 0.8) => collarTug(u, 'down'),
    /** A pose asked for in words: 'stand' | 'kneel' | 'fours' | 'cot'. */
    pose: (p) => collarCmd('collar.' + p),
    press: (on) => { collarPress(!!on); return colPressed; },
    walk: (pts, pitch = null, limit = 60, back = false) => {
      keys.delete('KeyW'); keys.delete('KeyS');
      colWalk = pts && pts.length ? { pts, i: 0, pitch, t: 0, limit, back } : null;
      return !!colWalk;
    },
    walking: () => (colWalk ? { i: colWalk.i, n: colWalk.pts.length, t: +colWalk.t.toFixed(1) } : null),
    /** You turned to face her collar, and `pitch` (rad) if given — for a probe's shot. */
    face: (pitch = null) => {
      const s = collarState(), Y = ground && ground.you;
      if (!s || !Y) return null;
      Y.yaw = Math.atan2(Y.x - s.neck.x, Y.z - s.neck.z);
      if (pitch != null) Y.pitch = pitch;
      return +Y.yaw.toFixed(3);
    },
    stats: () => collarStats(),
    links: () => (leashC ? leashC.links().map((q) => q.map((v) => +v.toFixed(3))) : null),
    measure: () => (leashC ? leashC.measure() : null),
    onFloor: () => (leashC ? leashC.onFloor() : null),
    fit: (at, back, lim) => (jadrija && jadrija.collarFit ? jadrija.collarFit(at, back, lim) : null),
    info: () => (jadrija && jadrija.leashInfo ? jadrija.leashInfo() : null),
    hand: () => colHand.toArray().map((v) => +v.toFixed(3)),
    tune: (o) => { for (const [k, v] of Object.entries(o || {})) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(COLLAR[k], v); else COLLAR[k] = v; } return COLLAR; },
    reset: () => { colLog.Fmax = 0; colMs.n = 0; colMs.sum = 0; colMs.max = 0;
      if (leashC) { leashC.stats.msMax = 0; leashC.stats.msSum = 0; leashC.stats.frames = 0; }
      if (jadrija && jadrija.leashRagReset) jadrija.leashRagReset(); return true; },
  },
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
    thumbAim: (o) => (arms ? arms.thumbAim(o) : null),
    hand: () => (arms ? arms.hand() : null),
    joints: () => (arms && arms.joints ? arms.joints() : null),
    thighAim: (o) => (arms ? arms.thighAim(o) : null),
    slapAim: (o) => (arms && arms.slapAim ? arms.slapAim(o) : null),
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
