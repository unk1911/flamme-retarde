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

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 1.2, 42000);
camera.position.set(0, 600, 0);

const frustum = new THREE.Frustum();
const _pv = new THREE.Matrix4();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  // A paused frame loop draws nothing, so the resized canvas would sit there
  // stretched until you resumed. One frame costs nothing and keeps it honest.
  if (state.paused) renderer.render(scene, camera);
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
  if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); return; }
  // While the world is stopped, only the settings answer. Cycling the camera or
  // dropping the gear against a frozen simulation puts the picture and the
  // state out of step, and the HUD is not being redrawn to tell you.
  if (state.paused) { if (e.code === 'KeyM') togglePanel(); return; }
  keys.add(e.code);
  if (e.code === 'KeyC') cycleCamera();
  if (e.code === 'KeyH') $('hud').hidden = !$('hud').hidden;
  if (e.code === 'KeyG') input.gear = !input.gear;
  if (e.code === 'KeyX') flight.p.stick.set(0, 0);
  if (e.code === 'KeyM') togglePanel();
  if (e.code === 'KeyT') toggleAutopilot();
  if (['Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyZ',
       'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (flight) flight.p.kb.set(0, 0); });

canvas.addEventListener('click', () => {
  // Never on a touchscreen: there is no pointer to lock, and asking for it on
  // iOS throws up a permission bar over the top of the game.
  if (!IS_TOUCH && state.phase === 'fly' && !pointerLocked) grabPointer();
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
  if (had && !pointerLocked && $('panel').hidden) setPaused(true);
});
addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
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
  trees, landmarks, alerts, roads, rail, props, airfield;

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
  $('panel-foot').textContent = TK('set.foot', 'set.footTouch');
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

  await step(74, 'load.stone');
  resolveLandmarks();
  landmarks = await buildLandmarks(scene);

  await step(78, 'load.city');
  city = buildCity(scene);

  await step(80, 'load.streets');
  airfield = buildAirfield(scene);
  roads = buildRoads(scene);
  rail = buildRail(scene);
  props = buildProps(scene, roads.lanes);
  if (IS_SMALL) props.setDensity(0.45);

  await step(82, 'load.fuel');
  fire = buildFire(scene);

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

  await step(88, 'load.plane');
  plane = buildCanadair();
  scene.add(plane.root);
  waterfx = buildWaterFX(scene);
  flight = buildFlight(plane, fire);

  await step(92, 'load.brief');
  wingmen = buildWingmen(scene, fire, (who, text) => radio(who, text));

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
  { key: 'fov', label: 'set.fov', min: 45, max: 95, step: 1,
    get: () => camera.fov, set: (v) => { camera.fov = v; camera.updateProjectionMatrix(); },
    fmt: (v) => Math.round(v) + '°' },
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
  if (state.phase !== 'fly' && state.phase !== 'crashing') return;
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

$('resume').addEventListener('click', () => setPaused(false));
$('pause').addEventListener('click', (e) => { if (e.target.id === 'pause') setPaused(false); });

// A backgrounded tab stops getting frames anyway; this only makes the stop
// honest, so you do not come back to a city that burned down in another window.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
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

  const burntHa = fire.burntArea();
  const activeHa = fire.burningCount() * (fire.cell * fire.cell) / 1e4;
  $('fb-fire').style.width = Math.min(100, activeHa / 8) + '%';
  $('fb-fire-n').textContent = Math.round(burntHa) + ' ha';
  $('fb-city').style.width = (state.cityHealth * 100) + '%';
  $('fb-city-n').textContent = Math.round(state.cityHealth * 100) + '%';

  // warnings. Ground proximity is not here — it gets the middle of the screen
  // to itself (see 56-alerts.js), because it is the only one you must act on.
  const w = [];
  if (state.speed < FLIGHT.vStall * 1.05 && state.altAgl > 3) {
    w.push(`<span class="pulse">${T('warn.stall')}</span>`);
  }
  if (p.water > CONFIG.tankCapacity * 0.99 && !state.dropping) w.push(T('warn.tankFull'));
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

let scoredLitres = 0, lastBurning = 0, spotWarned = 0;

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
    if (ev.kind === 'spot' && ev.city && state.t - spotWarned > 12) {
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

  const burning = fire.burningCount();
  if (lastBurning > 25 && burning === 0) {
    state.phase = 'won';
    showEnd(true);
  }
  lastBurning = Math.max(lastBurning, burning);

  if (state.cityHealth < 0.55 && state.phase === 'fly') {
    state.phase = 'lost';
    showEnd(false);
  }
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
  const { won, crashed, onWater } = endState;
  $('over-title').textContent = crashed ? T('over.crashed') : won ? T('over.won') : T('over.lost');
  $('over-sub').textContent = crashed ? T(onWater ? 'over.crashedSub' : 'over.crashedLand')
    : won ? T('over.wonSub') : T('over.lostSub');
  $('over-stats').innerHTML = [
    ['over.time', formatClock(state.t)],
    ['over.dropped', groupNum(state.litresDropped) + ' l'],
    ['over.onTarget',
      Math.round(state.litresOnTarget / Math.max(1, state.litresDropped) * 100) + '%'],
    ['over.burnt', Math.round(fire.burntArea()) + ' ha'],
    ['over.intact', Math.round(state.cityHealth * 100) + '%'],
    ['over.score', groupNum(state.score)],
  ].map(([k, v]) => `<div><span>${T(k)}</span><b>${v}</b></div>`).join('');
}

function showEnd(won, crashed = false, onWater = false) {
  const el = $('over');
  el.hidden = false;
  el.className = won ? 'win' : 'lose';
  endState = { won, crashed, onWater };
  redrawEnd();
  $('touch').hidden = true;
  document.exitPointerLock?.();
}

$('again').addEventListener('click', () => location.reload());

// ── frame ────────────────────────────────────────────────────────────────────

const clock = new THREE.Clock();
let started = false;
let wasDropping = false;
let lastFrameMs = 0;

function frame() {
  requestAnimationFrame(frame);
  // Read the clock even when paused, and read it before anything can bail out.
  // getDelta() reports wall time since it was last read, so an interval that is
  // never read comes back as one enormous dt — and a pause you sat through for
  // thirty seconds would resume by integrating thirty seconds of flight in a
  // single step, straight through whichever hill you were over.
  const dt = Math.min(0.05, clock.getDelta());
  // Nothing else: not the sim, not uTime, not even the render. The canvas holds
  // the last frame it drew, which is exactly the picture a pause should show.
  if (state.paused) return;
  U.uTime.value += dt;
  if (!started) return;

  if (state.phase === 'fly') {
    readKeys(dt);
    flight.update(dt, input);
    updateMission(dt);
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

  if (state.phase !== 'intro') updateCamera(dt);
  U.uCamPos.value.copy(camera.position);

  camera.updateMatrixWorld();
  _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(_pv);

  terrain.update(camera, frustum);
  trees.update(dt, camera.position);
  props.update(dt);
  rail.update(dt);
  sea.update(camera);
  fire.update(dt);
  // The other three keep working while your wreck is still settling.
  if (state.phase === 'fly' || state.phase === 'crashing') wingmen.update(dt);
  if (state.phase === 'intro') shadow.update(camera.position);
  waterfx.update(dt);

  // Billboard bases for every instanced sprite system.
  const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  scene.traverse((o) => {
    const u = o.material && o.material.uniforms;
    if (u && u.uCamRight) { u.uCamRight.value.copy(camRight); u.uCamUp.value.copy(camUp); }
  });

  if (state.dropping && !wasDropping) audio.dropWhoosh();
  wasDropping = state.dropping;

  if (state.scooping) {
    const { fwd, right } = flight.axes();
    scoopSpray.emit(flight.p.pos, fwd, right, state.speed, dt);
  }

  shadow.update(flight.p.pos);
  shadow.render(renderer);

  // The mix: your own engines dominate unless you are watching from outside,
  // in which case the nearest wingman gets a say too.
  const nearestAI = wingmen ? wingmen.nearest(camera.position) : 1e9;
  const own = 1 - sat((camera.position.distanceTo(flight.p.pos) - 20) / 400);
  const nf = fire.nearestFire(camera.position.x, camera.position.z);
  audio.update(dt, {
    throttle: flight.p.throttle,
    speed: state.speed,
    alt: state.altAgl,
    inside: CAMS[camMode] === 'cockpit',
    near: Math.max(own, 0.55 * (1 - sat((nearestAI - 40) / 700))),
    scooping: state.scooping,
    overSea: isSea(flight.p.pos.x, flight.p.pos.z),
    fireDist: nf ? Math.hypot(nf[0] - camera.position.x, nf[1] - camera.position.z) : 1e9,
    burning: fire.burningCount(),
    stall: state.speed < FLIGHT.vStall * 1.05 && state.altAgl > 3 && state.phase === 'fly',
  });

  updateStickHUD();
  updateHUD(dt);
  updateRadio(dt);

  renderer.render(scene, camera);
  const now = performance.now();
  if (lastFrameMs) state.fps = damp(state.fps, 1000 / Math.max(1, now - lastFrameMs), 2, dt);
  lastFrameMs = now;
}

$('enter').addEventListener('click', () => {
  $('veil').classList.add('gone');
  started = true;
  audio.start();
  camPos.copy(flight.p.pos);
  camAim.copy(flight.p.pos);
  playIntro();
});

function playIntro() {
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
}

$('cine-skip').addEventListener('click', beginFlight);

frame();
boot().catch((e) => {
  $('stage').textContent = T('load.failed') + e.message;
  console.error(e);
});

// A small handle for the screenshot tool.
window.__fr = {
  stats: () => ({
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
    rail: rail ? { ways: rail.ways, km: +rail.km.toFixed(1), cars: rail.cars,
      lineKm: +rail.lineKm.toFixed(2), tris: Math.round(rail.tris) } : null,
    props: props ? props.counts : null,
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
    crashed: flight ? flight.p.crashed : false,
    ap: flight ? (flight.p.autopilot ? flight.p.apNote || 'on' : 'off') : null,
    scoop: flight ? (flight.p.scoopValid ? 'OK' : flight.p.scoopReason) : null,
    thr: flight ? Math.round(flight.p.throttle * 100) : 0,
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
  skipIntro: () => beginFlight(),
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
  free: () => { camOverride = null; },
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
  fire: () => fire,
  flight: () => flight,
  train: () => (rail ? rail.trainPos() : null),
  /** Runway geometry, so a test can put the aeroplane on an actual approach. */
  field: () => (airfield && airfield.site ? {
    centre: airfield.centre, apron: airfield.apron,
    thresholds: airfield.thresholds, axis: airfield.axis,
  } : null),
  scene, camera, renderer,
};
