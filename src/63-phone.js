// ── the cellphone ────────────────────────────────────────────────────────────
//
// Misha, 19 Sep 2026: *"now that we have a satchel with our cellphone in it,
// should be able to pull out the cellphone somehow and we do, should see
// cellphone controls. the cellphone should have a simplified version of
// coinbase app which shows latest crypto prices of btc, ltc, eth, doge. and it
// should have the lovesens app which has a button if you press it sends a
// signal over to the lovesens device that baye is wearing, and it creates a
// vibration for 5 seconds. also on the cellphone we should be able to see a
// live view of the shore baye, so we can see her from a distance without
// having to go into the kabine per se"*.
//
// THE PHONE ALREADY EXISTED and had no face. It has been in the bag since
// 1.41x — `phone` in CARRY, src/62-satchel.js — as the SENDER: the thing that
// has to be on you before `signalCan()` in 43-jadrija.js will let a signal go
// anywhere, which is what makes the laptop up at the vikendica a second way to
// reach the Lovense rather than the only one. So none of the plumbing under
// these three apps is new. What is new is that you can now look at it.
//
// THREE APPS AND A HOME SCREEN, because three is what was asked for and a
// fourth would be a menu:
//
//   coin    the four quotes the bathers' own phones already show — see
//           `phoneQuotes` in 43-jadrija.js, one GET against /baye/world on
//           the first frame anything needs it, and the same numbers here.
//   love    one button, five seconds of it, straight down the path the typed
//           line and the laptop already use. Nothing new can go wrong.
//   cam     her, live, from three metres, in a render target — see
//           `phoneCamStep`, which is the only part of this that costs
//           anything and is the reason it is drawn at 20 Hz and not at 60.
//
// AND IT IS DOM AND NOT A TEXTURE, unlike every screen in the game so far (the
// TV, the laptop, the bathers' phones, all canvas). A thing in YOUR hand is
// part of the interface and not part of the world: it wants to be crisp at any
// resolution, to be a button you can actually tap on glass, and to cost
// nothing when it is shut. The one thing DOM cannot do is show the world, and
// that is exactly the one part of it that is rendered.

const PHONE = {
  /** Which app is up when it comes out of the bag. */
  home: 'home',
  /** Seconds of buzz one press of the Lovense button is worth. */
  buzz: 5.0,
  /**
   * The camera: metres in front of her, eye height, and what it looks at.
   *
   * FRAMED FOR A PHONE SCREEN, which is where this goes and which is 9:19.5.
   * `fov` is the VERTICAL angle, and at the 34 degrees this opened on the
   * lens saw 2·d·tan(17°) — 1.83 m at three metres, which is a person with
   * their head cut off, and 0.95 m at the 1.55 the indoor case used, which is
   * a torso. 50 degrees is also what the camera in a real phone is: they are
   * wide because what people photograph is a person in a place.
   *
   * At 3.2 m the frame is 2.98 m tall and the aim is 1.05, so it runs from
   * under her feet to half a metre over her head. Indoors at 2.3 it is 2.14 m
   * and she just fits — the kabina is four metres across and the lens can be
   * in the wall behind it without anybody minding, but it cannot be outside
   * the room looking at the back of one.
   */
  camAt: 3.2, camY: 1.62, camAim: 1.05,
  /** Indoors there is a wall three metres in front of her. */
  camIn: 2.3,
  /** And the lens, in degrees — vertical, on a screen that is all vertical. */
  fov: 50,
  /**
   * How often the live view is re-rendered, and how big it is drawn.
   *
   * IT IS A SECOND RENDER OF THE WHOLE WORLD, which is the one number in this
   * file worth arguing about: the terrain, the sea, the city and everybody on
   * the promenade, all of it again. At a 240 by 380 target the pixels are
   * nothing and the draw calls are the whole cost, so the saving has to come
   * out of the FRAME RATE of the view and not its size — 20 Hz on a phone
   * screen in somebody's hand is a live feed, and a third of the cost.
   */
  camHz: 20, camW: 240, camH: 380,
  /** The battery, which starts here and lasts about this long in minutes. */
  bat0: 86, batFor: 240,
};

let phoneEl = null;
let phoneOn = false;
let phoneApp = PHONE.home;
/** Seconds of buzz left on the Lovense button's own clock, or 0. */
let phoneBuzz = 0;
let phoneBat = PHONE.bat0;
/** The last thing the Lovense app was told, for the line under the button. */
let phoneSaid = 'tap to buzz';
/** The render target the live view is drawn into, and the quad that shows it. */
let phoneRT = null, phoneQuad = null, phoneQuadCam = null, phoneCamObj = null;
let phoneCamT = 0;
/** Wall seconds since the page loaded, for the once-a-second jobs. */
let phoneClock = 0;
/** Where the world thought the eye was, while the phone borrows that uniform. */
const _phCam = new THREE.Vector3();
let phoneSteps = 0, phoneBlits = 0, phoneRect = null;

/** The apps, in the order they sit on the home screen. */
const PHONE_APPS = [
  { key: 'coin', name: 'Coinbase', tint: '#1652f0', mark: '◎' },
  { key: 'love', name: 'Lovense', tint: '#d6336c', mark: '❥' },
  { key: 'cam', name: 'Baye', tint: '#2f9e6e', mark: '◉' },
];

/**
 * The slab. Built the first time it is wanted, like the satchel's panel and
 * for the same reason: this file loads while the world is still being made.
 */
function phonePanel() {
  if (phoneEl) return phoneEl;
  phoneEl = document.createElement('div');
  phoneEl.id = 'cell';
  phoneEl.hidden = true;
  const body = document.createElement('div');
  body.className = 'cell-body';
  const bar = document.createElement('div');
  bar.className = 'cell-bar';
  bar.innerHTML = '<span class="cell-clock">--:--</span>'
    + '<span class="cell-net">LTE</span><span class="cell-bat">86%</span>';
  const screen = document.createElement('div');
  screen.className = 'cell-screen';
  const chin = document.createElement('div');
  chin.className = 'cell-chin';
  const home = document.createElement('button');
  home.className = 'cell-home';
  home.title = 'home';
  home.addEventListener('click', (e) => {
    e.stopPropagation();
    if (phoneApp === 'home') phoneToggle(false);
    else { phoneApp = 'home'; phoneDraw(); }
  });
  chin.appendChild(home);
  body.append(bar, screen, chin);
  phoneEl.append(body);
  // The glass eats its own clicks: a tap on an app is not also a tap on the
  // world behind it, and on a phone that world is a walk in whatever
  // direction the thumb happened to be over.
  phoneEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.body.appendChild(phoneEl);
  return phoneEl;
}

/** One row of the Coinbase list. */
function coinRow(k, q) {
  const row = document.createElement('div');
  row.className = 'cell-coin';
  const name = document.createElement('span');
  name.className = 'cc-k';
  name.textContent = k.toUpperCase();
  const px = document.createElement('b');
  const chg = document.createElement('i');
  if (!q) {
    px.textContent = '—';
    chg.textContent = '';
  } else {
    // Four decimals on a coin worth eight cents and none on one worth eighty
    // thousand, which is what the bathers' own screens do — see `phoneScreen`
    // in 43-jadrija.js, where the rule was written first.
    const v = q.usd;
    px.textContent = '$' + (v >= 1000 ? Math.round(v).toLocaleString('en-US')
      : v >= 1 ? v.toFixed(2) : v.toFixed(4));
    const c = q.chg;
    if (c != null) {
      chg.textContent = (c >= 0 ? '+' : '') + c.toFixed(2) + '%';
      chg.className = c >= 0 ? 'up' : 'dn';
    }
  }
  row.append(name, px, chg);
  return row;
}

/**
 * The line under the picture: how far away she is and where.
 *
 * A live view of somebody is also a way of FINDING them, and the two numbers
 * that answers are already computed — `bayeGap` has the distance from you to
 * her and whether she is inside, because her voice needs both. Rounded the
 * way a person says a distance: to the metre up close and to five past fifty,
 * because nobody stands at 87 m and thinks "87".
 */
function phoneWhere() {
  const g = (typeof jadrija !== 'undefined' && jadrija && jadrija.bayeGap)
    ? jadrija.bayeGap() : null;
  if (!g) return 'LIVE';
  const m = g.m < 50 ? Math.round(g.m) : Math.round(g.m / 5) * 5;
  return 'LIVE · ' + m + ' m · ' + (g.indoors ? 'in the kabina' : 'the promenade');
}

/**
 * The phases with no signal in them, and it is a SHORT list on purpose.
 *
 * This used to be the other way round — ground and swim showed her and
 * everything else said *no signal · you are flying* — and the first thing
 * that broke was the ferry: you stand on her deck with a phone in your hand
 * four kilometres from the beach, which is the exact situation this feature
 * was asked for, and the app told you you were flying. The right rule is that
 * you are flying when you are flying: in the cockpit with two turboprops, on
 * the way down under a canopy, or in a cutscene. Everywhere else is a person
 * standing somewhere with a phone.
 */
const PHONE_NOSIG = { fly: 1, crashing: 1, chute: 1, intro: 1 };

/** What the live view has to say for itself when it cannot show her. */
function phoneCamWhy() {
  if (typeof jadrija === 'undefined' || !jadrija) return 'no signal';
  const s = jadrija.show && jadrija.show();
  if (!s) return 'no signal';
  if (typeof state !== 'undefined' && PHONE_NOSIG[state.phase]) {
    return 'no signal · you are flying';
  }
  return null;
}

/** Put the screen back, whatever is on it. */
function phoneDraw() {
  if (!phoneEl) return;
  const screen = phoneEl.querySelector('.cell-screen');
  screen.textContent = '';
  screen.dataset.app = phoneApp;
  if (phoneApp === 'home') {
    const grid = document.createElement('div');
    grid.className = 'cell-grid';
    for (const a of PHONE_APPS) {
      const b = document.createElement('button');
      b.className = 'cell-app';
      const ic = document.createElement('i');
      ic.style.background = a.tint;
      ic.textContent = a.mark;
      const nm = document.createElement('span');
      nm.textContent = a.name;
      b.append(ic, nm);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        phoneApp = a.key;
        phoneDraw();
      });
      grid.appendChild(b);
    }
    screen.appendChild(grid);
    return;
  }
  const head = document.createElement('div');
  head.className = 'cell-head';
  head.textContent = (PHONE_APPS.find((a) => a.key === phoneApp) || {}).name || '';
  screen.appendChild(head);

  if (phoneApp === 'coin') {
    const q = (typeof jadrija !== 'undefined' && jadrija && jadrija.quotes)
      ? jadrija.quotes() : null;
    const list = document.createElement('div');
    list.className = 'cell-coins';
    for (const k of ['btc', 'ltc', 'eth', 'doge']) list.appendChild(coinRow(k, q && q[k]));
    const foot = document.createElement('div');
    foot.className = 'cell-foot';
    foot.textContent = (q && q.at) || '';
    screen.append(list, foot);
    return;
  }

  if (phoneApp === 'love') {
    const wrap = document.createElement('div');
    wrap.className = 'cell-love';
    const dot = document.createElement('div');
    dot.className = 'cell-dot';
    const btn = document.createElement('button');
    btn.className = 'cell-buzz';
    btn.textContent = phoneBuzz > 0 ? Math.ceil(phoneBuzz) + 's' : 'BUZZ';
    if (phoneBuzz > 0) btn.classList.add('on');
    btn.addEventListener('click', (e) => { e.stopPropagation(); phonePress(); });
    const note = document.createElement('div');
    note.className = 'cell-note';
    note.textContent = phoneSaid;
    wrap.append(dot, btn, note);
    screen.appendChild(wrap);
    return;
  }

  if (phoneApp === 'cam') {
    // NOTHING IS DRAWN HERE. The picture is the renderer's — see
    // `phoneCamStep` — and what this leaves behind is the hole it goes in,
    // plus whatever has to be said when there is no picture to put in it.
    const why = phoneCamWhy();
    const hole = document.createElement('div');
    hole.className = 'cell-cam';
    if (why) hole.textContent = why;
    const foot = document.createElement('div');
    foot.className = 'cell-foot';
    foot.textContent = why ? '' : phoneWhere();
    screen.append(hole, foot);
  }
}

/**
 * The button. Five seconds, and it goes down the same path as the typed line
 * and the laptop — `signal` in 43-jadrija.js — so there is no second way for
 * this to be wrong.
 */
function phonePress() {
  if (typeof jadrija === 'undefined' || !jadrija || !jadrija.signal) {
    phoneSaid = 'no device';
  } else if (phoneBuzz > 0) {
    // A second press stops it, which is what a button that is already lit
    // should do.
    jadrija.signal('lovense', false);
    phoneBuzz = 0;
    phoneSaid = 'stopped';
  } else {
    const r = jadrija.signal('lovense', true);
    if (r === 'on') {
      phoneBuzz = PHONE.buzz;
      phoneSaid = 'sending…';
    } else {
      phoneSaid = r === 'not out' ? 'device not found'
        : r === 'no sender' ? 'no phone on you' : String(r);
    }
  }
  phoneDraw();
}

/** Open it, close it, or set it. Answers whether it is now out. */
function phoneToggle(force) {
  const want = force == null ? !phoneOn : !!force;
  // It is in the bag, and a phone you have not got is a phone you cannot look
  // at. Everything else in this file assumes it is on you — `signalCan` most
  // of all, which is the same question asked one layer down.
  if (want && typeof satchelHas === 'function' && !satchelHas('phone')) {
    phoneOn = false;
    if (phoneEl) phoneEl.hidden = true;
    return false;
  }
  phoneOn = want;
  phonePanel();
  // What else has to get out of its way. The ears panel is bottom right and
  // the phone stands over its right-hand end — see `body.cell-out` in
  // styles.css, which is the whole of this.
  document.body.classList.toggle('cell-out', phoneOn);
  if (phoneOn && phoneApp !== 'home') phoneDraw();
  else if (phoneOn) { phoneApp = PHONE.home; phoneDraw(); }
  phoneEl.hidden = !phoneOn;
  // And the fly cam, which is drawn by the RENDERER into the same corner and
  // therefore cannot be moved by a class. Its box is pushed left by the slab's
  // measured width — see `push` in DROPCAM — and the `#flycam` frame that is
  // drawn round it follows through the class above.
  if (typeof DROPCAM !== 'undefined') {
    DROPCAM.push = phoneOn
      ? Math.round(phoneEl.getBoundingClientRect().width) + 14 : 0;
  }
  return phoneOn;
}

/**
 * The world has stopped, or started again.
 *
 * A LIVE VIEW OF A STOPPED WORLD IS NOT A LIVE VIEW, and while the game is
 * paused it cannot even be a still: the screen is a HOLE — see the note in
 * styles.css — the pause card lays a nine-pixel backdrop blur over
 * everything under it, and the canvas is under it. So a paused phone showed a
 * blurred, dimmed smear of the promenade where her picture had been, which
 * looks like a bug in the feed rather than like a game that is stopped.
 *
 * So the hole stops being a hole: the screen takes its own background back
 * and says what is true. Called from `setPaused` rather than from the tick,
 * because a paused frame loop does not run the tick — which is the same
 * reason the view cannot simply carry on.
 */
function phonePaused(on) {
  if (!phoneEl) return;
  const screen = phoneEl.querySelector('.cell-screen');
  screen.classList.toggle('froze', !!on);
  const hole = screen.querySelector('.cell-cam');
  if (hole && phoneApp === 'cam') hole.textContent = on ? 'paused' : '';
  // And the caption stops claiming to be live, since it is not. The distance
  // under it is still true, so it stays — and the tick puts the word back a
  // second after the world starts again.
  const foot = screen.querySelector('.cell-foot');
  if (foot && phoneApp === 'cam' && on) {
    foot.textContent = foot.textContent.replace(/^LIVE · /, '');
  }
}

/** Whether it is out, and which app is up — the render loop asks both. */
function phoneIsOut() { return phoneOn; }
function phoneAppNow() { return phoneOn ? phoneApp : null; }

/**
 * The clock, the battery, and the buzz's own five seconds.
 *
 * `dt` is wall time and not world time: a phone in your hand does not slow
 * down because the lens is zoomed.
 */
function phoneTick(dt) {
  if (phoneBuzz > 0) {
    const was = Math.ceil(phoneBuzz);
    phoneBuzz = Math.max(0, phoneBuzz - dt);
    if (phoneBuzz <= 0) {
      if (typeof jadrija !== 'undefined' && jadrija && jadrija.signal) {
        jadrija.signal('lovense', false);
      }
      phoneSaid = 'tap to buzz';
      if (phoneOn && phoneApp === 'love') phoneDraw();
    } else if (phoneOn && phoneApp === 'love' && Math.ceil(phoneBuzz) !== was) {
      phoneDraw();
    }
  }
  // And she is let go of the moment the lens is not on her — on another app,
  // in the bag, or gone. `phoneCamStep` is not called at all then, so this is
  // the only place that can say so.
  if ((!phoneOn || phoneApp !== 'cam') && typeof jadrija !== 'undefined'
    && jadrija && jadrija.watch) {
    jadrija.watch(false);
  }
  if (!phoneOn || !phoneEl) return;
  phoneBat = Math.max(2, PHONE.bat0 - (performance.now() / 60000) * (PHONE.bat0 / PHONE.batFor));
  const d = new Date();
  const bar = phoneEl.querySelector('.cell-bar');
  bar.querySelector('.cell-clock').textContent =
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  bar.querySelector('.cell-bat').textContent = Math.round(phoneBat) + '%';
  // And the line under the live view, which is a distance and therefore moves
  // while you do. Once a second and not every frame: it is rounded to the
  // metre and a caption that flickers between 23 and 24 is worse than one
  // that is a second old.
  if (phoneApp === 'cam' && Math.floor(phoneClock) !== Math.floor(phoneClock + dt)) {
    const f = phoneEl.querySelector('.cell-foot');
    if (f && !phoneCamWhy()) f.textContent = phoneWhere();
  }
  phoneClock += dt;
  // The quotes, once, the first time anybody opens the app — the same single
  // GET the bathers' screens make, against the same cache.
  if (phoneApp === 'coin' && typeof jadrija !== 'undefined'
    && jadrija && jadrija.quotesRefresh) {
    jadrija.quotesRefresh();
  }
}

/**
 * ── THE LIVE VIEW ──────────────────────────────────────────────────────────
 *
 * Where the camera stands: three metres in front of her, at eye height,
 * looking at her chest. In front and not behind, because the point of it is
 * to see her; at eye height and not overhead, because a security camera is a
 * different joke; and closer INDOORS, because three metres in front of
 * somebody standing in a two-and-a-half metre hut is three metres of wall.
 */
function phoneCamPlace() {
  if (typeof jadrija === 'undefined' || !jadrija || !jadrija.show) return null;
  const s = jadrija.show();
  if (!s) return null;
  const t = jadrija.bayeTalk && jadrija.bayeTalk();
  if (!t || !t.at) return null;
  let d = PHONE.camAt;
  if (jadrija.kabina && jadrija.kabina.inside) {
    const w = jadrija.toWorld(s.t, s.s);
    if (jadrija.kabina.inside(w[0], w[2]) > 0.5) d = PHONE.camIn;
  }
  const e = jadrija.toWorld(s.t + d * Math.cos(s.ang), s.s + d * Math.sin(s.ang));
  return { eye: [e[0], t.at[1] + PHONE.camY, e[2]],
    at: [t.at[0], t.at[1] + PHONE.camAim, t.at[2]] };
}

/** The target and the quad that shows it, built the first time it is needed. */
function phoneCamRig() {
  if (phoneRT) return phoneRT;
  phoneRT = new THREE.WebGLRenderTarget(PHONE.camW, PHONE.camH, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: true,
  });
  // The world is drawn in sRGB and this quad puts it straight back on the
  // screen, so the texture has to say which space it is in or the blit runs
  // the conversion a second time and the picture comes back washed out.
  phoneRT.texture.colorSpace = THREE.SRGBColorSpace;
  // NEAR -1 AND NOT 0, which is the difference between a picture and a black
  // rectangle: the quad sits at z 0 and so does the camera, so a frustum that
  // starts at the camera has the only thing in the scene exactly on its near
  // plane and clips it away.
  phoneQuadCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1);
  phoneQuad = new THREE.Scene();
  phoneQuad.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: phoneRT.texture, depthTest: false })));
  phoneCamObj = new THREE.PerspectiveCamera(PHONE.fov,
    PHONE.camW / PHONE.camH, 0.4, 4000);
  return phoneRT;
}

/**
 * Draw the world into the target, at `PHONE.camHz` and not every frame.
 *
 * Called with the renderer and the scene by the render loop, which is the one
 * thing this file cannot reach for itself.
 */
function phoneCamStep(renderer, scene, real) {
  if (!phoneOn || phoneApp !== 'cam') return false;
  const p = phoneCamPlace();
  if (!p) return false;
  // Keep her alive while the lens is on her. Both of the shore's range gates
  // are asked of the CAMERA, and at the vikendica that is four hundred metres
  // away while this lens is at three — see the note at the gate in
  // 43-jadrija.js. Without it the live feed is a still photograph.
  if (jadrija.watch) jadrija.watch(true);
  phoneCamRig();
  phoneCamT += real;
  if (phoneCamT >= 1 / PHONE.camHz) {
    phoneCamT = 0;
    // The lens takes the shape of the HOLE and not of the target: the hole is
    // whatever the phone's own width made it and the target is a fixed
    // 240 by 380, and a camera set up for the second one stretches her in the
    // first. `phoneRect` is last frame's, which is a frame stale and exactly
    // right — nothing moves it but a window resize.
    if (phoneRect && phoneRect[3] > 4) {
      const a = phoneRect[2] / phoneRect[3];
      if (Math.abs(a - phoneCamObj.aspect) > 0.002) {
        phoneCamObj.aspect = a;
        phoneCamObj.updateProjectionMatrix();
      }
    }
    phoneCamObj.position.set(p.eye[0], p.eye[1], p.eye[2]);
    phoneCamObj.lookAt(p.at[0], p.at[1], p.at[2]);
    // AND THE HAZE HAS TO BE HERS, which is the difference between a picture
    // and a smear. `U.uCamPos` is one shared uniform, written once a frame
    // with the main camera's position, and every haze and water term in the
    // game measures its distance from it — so a view rendered from a lens
    // three metres in front of her while YOU are two and a half kilometres
    // out across the channel came back with two and a half kilometres of
    // atmosphere laid over her. Photographed from the ferry before this line
    // existed: she was a pale grey outline in a white field.
    const wasCam = _phCam.copy(U.uCamPos.value);
    U.uCamPos.value.copy(phoneCamObj.position);
    const old = renderer.getRenderTarget();
    renderer.setRenderTarget(phoneRT);
    renderer.clear(true, true, false);
    renderer.render(scene, phoneCamObj);
    renderer.setRenderTarget(old);
    U.uCamPos.value.copy(wasCam);
    phoneSteps += 1;
  }
  return true;
}

/**
 * And put it on the glass: the quad, scissored into whatever rectangle the
 * DOM has put the hole in. CSS pixels out of `getBoundingClientRect`, which
 * is what `setViewport` takes, and the y axis flipped because the DOM counts
 * down from the top and GL counts up from the bottom.
 */
function phoneCamBlit(renderer) {
  if (!phoneOn || phoneApp !== 'cam' || !phoneRT || !phoneEl) return;
  const hole = phoneEl.querySelector('.cell-cam');
  if (!hole) return;
  const r = hole.getBoundingClientRect();
  phoneRect = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  if (r.width < 4 || r.height < 4) return;
  phoneBlits += 1;
  const h = window.innerHeight;
  const auto = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setScissorTest(true);
  renderer.setViewport(r.left, h - r.bottom, r.width, r.height);
  renderer.setScissor(r.left, h - r.bottom, r.width, r.height);
  renderer.render(phoneQuad, phoneQuadCam);
  renderer.setScissorTest(false);
  const size = renderer.getSize(new THREE.Vector2());
  renderer.setViewport(0, 0, size.x, size.y);
  renderer.autoClear = auto;
}

/** Debug: what is actually in the target, as one pixel from the middle. */
function phonePeek() {
  if (!phoneRT || typeof renderer === 'undefined' || !renderer) return null;
  try {
    const b = new Uint8Array(4);
    renderer.readRenderTargetPixels(phoneRT, PHONE.camW >> 1, PHONE.camH >> 1, 1, 1, b);
    return [b[0], b[1], b[2], b[3]];
  } catch (e) { return String(e); }
}

/** What a probe wants to know about it. */
function phoneStats() {
  return { out: phoneOn, app: phoneOn ? phoneApp : null, buzz: +phoneBuzz.toFixed(2),
    bat: Math.round(phoneBat), said: phoneSaid,
    cam: !!(phoneRT && phoneOn && phoneApp === 'cam'),
    steps: phoneSteps, blits: phoneBlits, rect: phoneRect,
    place: phoneCamPlace() };
}
