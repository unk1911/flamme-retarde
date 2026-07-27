// -----------------------------------------------------------------------------
// The game: renderer, loading, input, camera, mission and the frame loop.
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const canvas = $('stage-canvas');

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
});

// ── input ────────────────────────────────────────────────────────────────────

const keys = new Set();
const input = {
  scoop: false, drop: false, thrUp: false, thrDown: false,
  flaps: false, gear: false,
};
let pointerLocked = false;

addEventListener('keydown', (e) => {
  if (e.repeat) return;
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
  if (state.phase === 'fly' && !pointerLocked) canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
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
  input.scoop = keys.has('Space');
  input.drop = keys.has('KeyF') || mouseDrop;
  input.flaps = keys.has('ShiftLeft') || keys.has('ShiftRight');
  p.rudder = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);

  // The arrows are the honest control: held means held, no spring, no drift.
  // Anyone who cannot get on with a mouse stick can fly the whole game here.
  const kx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
  const ky = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
  p.kb.x = damp(p.kb.x, kx, 9, dt);
  p.kb.y = damp(p.kb.y, ky, 9, dt);

  // Z is the panic button: centre the stick and hold her level.
  p.levelling = keys.has('KeyZ');
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
        label: d < 700 ? 'over the fire — press F' : 'to the fire',
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
    label: onRun ? 'on the water — hold SPACE'
      : apOnRun ? 'on the approach' : 'lining up on the water',
  };
}

function toggleAutopilot() {
  if (!flight || state.phase !== 'fly') return;
  flight.p.autopilot = !flight.p.autopilot;
  if (flight.p.autopilot) { apRun = null; apOnRun = false; apFire = null; apFireT = 0;
    updateNavTarget(0.016); toast('autopilot engaged'); }
  else { flight.p.apNote = ''; toast('autopilot off'); }
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
}

// ── the world ────────────────────────────────────────────────────────────────

let terrain, sky, sea, fire, shadow, plane, flight, waterfx, city, wingmen, audio, intro,
  trees, landmarks;

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

async function boot() {
  // A painted plate behind the title, at low opacity under the gradient.
  const art = document.createElement('div');
  art.id = 'veil-art';
  $('veil').appendChild(art);
  if (PAYLOAD.panel_volley) art.style.backgroundImage = `url(${PAYLOAD.panel_volley})`;

  const bar = $('bar-fill');
  const stageEl = $('stage');
  const step = async (pct, label) => {
    bar.style.width = pct + '%';
    stageEl.textContent = label;
    await new Promise((r) => setTimeout(r, 16));
  };

  await step(6, 'unpacking Šibenik');
  await loadWorld((s) => { stageEl.textContent = s; });

  await step(34, 'the bura is the wrong wind for this');
  // Lebić — the south-westerly. It is what pushes a fire off Jadrija and up
  // the peninsula toward the town, and it is why today is a bad day.
  state.windDir = -0.35;
  state.windSpeed = 9.5;
  U.uWind.value.set(Math.cos(state.windDir), Math.sin(state.windDir));
  U.uWindSpeed.value = state.windSpeed;
  setSun();

  await step(44, 'raising the sky');
  sky = buildSky(scene);

  await step(52, 'lighting the cascade');
  shadow = buildShadow(renderer);

  await step(60, 'laying the karst');
  terrain = buildTerrain(scene);

  await step(70, 'filling the Adriatic');
  sea = buildSea(scene);

  await step(74, 'setting the stone of St James');
  resolveLandmarks();
  landmarks = await buildLandmarks(scene);

  await step(78, 'raising the old town');
  city = buildCity(scene);

  await step(82, 'counting the fuel');
  fire = buildFire(scene);

  await step(85, 'planting the maquis');
  trees = buildTrees(scene, fire);

  await step(88, 'rolling out the Canadair');
  plane = buildCanadair();
  scene.add(plane.root);
  waterfx = buildWaterFX(scene);
  flight = buildFlight(plane, fire);

  await step(92, 'briefing the other three');
  wingmen = buildWingmen(scene, fire, (who, text) => radio(who, text));

  await step(95, 'spooling the turboprops');
  audio = buildAudio();

  await step(97, 'threading the projector');
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

  await step(100, 'ready');
  $('enter').hidden = false;
  $('hint').hidden = false;
  stageEl.textContent = 'four aircraft, one afternoon';
}

// ── mission ──────────────────────────────────────────────────────────────────

const mission = {
  t: 0, radioQueue: [], radioTimer: 0, best: 0,
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

function radio(who, text, delay = 0) {
  mission.radioQueue.push({ who, text, delay });
}

function updateRadio(dt) {
  const el = $('radio');
  mission.radioTimer -= dt;
  if (mission.radioTimer <= 0 && mission.radioQueue.length) {
    const m = mission.radioQueue.shift();
    el.innerHTML = `<div class="line"><span class="who">${m.who}</span> &nbsp;${m.text}</div>`;
    if (audio) audio.squelch();
    mission.radioTimer = 3.6 + m.text.length * 0.035;
  } else if (mission.radioTimer <= 0) {
    el.innerHTML = '';
  }
}

// ── settings ─────────────────────────────────────────────────────────────────

const SETTINGS = [
  { key: 'sens', label: 'mouse sensitivity', min: 0.25, max: 2.5, step: 0.05,
    get: () => flight.p.sens, set: (v) => { flight.p.sens = v; },
    fmt: (v) => v.toFixed(2) + '×' },
  { key: 'assist', label: 'stability assist', min: 0, max: 1, step: 0.05,
    get: () => flight.p.assist, set: (v) => { flight.p.assist = v; },
    fmt: (v) => Math.round(v * 100) + '%' },
  { key: 'trees', label: 'vegetation', min: 0, max: 1.6, step: 0.05,
    get: () => trees.getDensity(), set: (v) => trees.setDensity(v),
    fmt: (v) => v <= 0.001 ? 'off' : Math.round(v * 100) + '%' },
  { key: 'fov', label: 'field of view', min: 45, max: 95, step: 1,
    get: () => camera.fov, set: (v) => { camera.fov = v; camera.updateProjectionMatrix(); },
    fmt: (v) => Math.round(v) + '°' },
  { key: 'exposure', label: 'exposure', min: 0.55, max: 1.4, step: 0.02,
    get: () => renderer.toneMappingExposure, set: (v) => { renderer.toneMappingExposure = v; },
    fmt: (v) => v.toFixed(2) },
];

function buildPanel() {
  const host = $('panel-rows');
  if (host._built) return;
  host._built = true;
  for (const s of SETTINGS) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<label>${s.label}<b></b></label>`
      + `<input type="range" min="${s.min}" max="${s.max}" step="${s.step}">`;
    const out = row.querySelector('b'), inp = row.querySelector('input');
    inp.value = s.get();
    out.textContent = s.fmt(s.get());
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      s.set(v);
      out.textContent = s.fmt(v);
      try { localStorage.setItem('fr.' + s.key, String(v)); } catch (e) { /* private mode */ }
    });
    host.appendChild(row);
  }
  // Whatever you settled on last time is what you get this time.
  for (const s of SETTINGS) {
    let v = null;
    try { v = localStorage.getItem('fr.' + s.key); } catch (e) { /* ignore */ }
    if (v == null) continue;
    const n = parseFloat(v);
    if (Number.isFinite(n)) {
      s.set(clamp(n, s.min, s.max));
      const row = host.children[SETTINGS.indexOf(s)];
      row.querySelector('input').value = n;
      row.querySelector('b').textContent = s.fmt(n);
    }
  }
}

function togglePanel() {
  if (!flight) return;
  buildPanel();
  const el = $('panel');
  el.hidden = !el.hidden;
  if (!el.hidden) document.exitPointerLock?.();
  else if (state.phase === 'fly') canvas.requestPointerLock();
}

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
  $('i-vsi').textContent = (p.vel.y >= 0 ? '+' : '') + p.vel.y.toFixed(1);

  const pct = p.water / CONFIG.tankCapacity;
  $('tank-fill').style.height = (pct * 100) + '%';
  $('t-litres').textContent = groupNum(p.water);

  const hint = $('tank-hint');
  if (p.water >= CONFIG.tankCapacity - 1) {
    hint.textContent = 'full — F to drop'; hint.className = 'ready';
  } else if (p.scoopValid) {
    hint.textContent = 'hold SPACE'; hint.className = 'hot';
  } else {
    hint.textContent = p.scoopReason || 'SPACE to scoop'; hint.className = '';
  }

  $('g-clock').firstElementChild.textContent = formatClock(state.t);
  $('g-score').firstElementChild.textContent = groupNum(state.score);

  const burntHa = fire.burntArea();
  const activeHa = fire.burningCount() * (fire.cell * fire.cell) / 1e4;
  $('fb-fire').style.width = Math.min(100, activeHa / 8) + '%';
  $('fb-fire-n').textContent = Math.round(burntHa) + ' ha';
  $('fb-city').style.width = (state.cityHealth * 100) + '%';
  $('fb-city-n').textContent = Math.round(state.cityHealth * 100) + '%';

  // warnings
  const w = [];
  if (state.speed < FLIGHT.vStall * 1.05 && state.altAgl > 3) w.push('<span class="pulse">stall</span>');
  if (state.altAgl < 25 && p.vel.y < -4) w.push('<span class="pulse">pull up</span>');
  if (p.water > CONFIG.tankCapacity * 0.99 && !state.dropping) w.push('tank full');
  $('warn').innerHTML = w.join(' &nbsp; ');

  $('ap').innerHTML = p.autopilot
    ? `autopilot <span>${p.apNote}</span>`
    : (p.levelling ? 'levelling' : '');

  $('reticle').classList.toggle('armed', p.water > 200 && state.altAgl < 260 && state.altAgl > 20);

  // wingmen
  if (wingmen) {
    const LABEL = { toWater: 'to water', scoop: 'scooping', toFire: 'to fire', drop: 'dropping' };
    $('wingmen').innerHTML = wingmen.status().map((w) =>
      `<div class="w"><i class="dot ${w.phase === 'scoop' ? 'scoop' : w.phase === 'drop' ? 'drop' : ''}"></i>`
      + `<span class="name">${w.call}</span>${LABEL[w.phase] || w.phase}`
      + ` <span style="opacity:.55">${Math.round(w.water / CONFIG.tankCapacity * 100)}%</span></div>`
    ).join('');
  }

  // compass tape
  const tape = $('compass-tape');
  if (!tape._built) {
    let h = '';
    for (let a = -180; a <= 540; a += 15) {
      const lbl = ((a % 360) + 360) % 360;
      const txt = lbl % 90 === 0 ? ['N', 'E', 'S', 'W'][lbl / 90] : (lbl % 45 === 0 ? String(lbl) : '·');
      h += `<span style="width:46px">${txt}</span>`;
    }
    tape.innerHTML = h;
    tape._built = true;
  }
  tape.style.left = `calc(50% - ${(hdg + 180) / 15 * 46 + 23}px)`;
}

/** Where the virtual stick is, drawn every frame — the HUD's 16 Hz is too
    coarse for something the hand is steering. */
function updateStickHUD() {
  const p = flight.p;
  const el = $('stick');
  const sx = clamp(p.stick.x + p.kb.x, -1, 1);
  const sy = clamp(p.stick.y + p.kb.y, -1, 1);
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
      radio('OSMATRAČ', 'Iskra je preskočila kanal — gori kod grada!');
      toast('spot fire near the old town', 'bad');
    }
  }
  fire.events.length = 0;

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
    state.phase = 'lost';
    showEnd(false, true);
  }
}

function showEnd(won, crashed = false) {
  const el = $('over');
  el.hidden = false;
  el.className = won ? 'win' : 'lose';
  $('over-title').textContent = crashed ? 'Pao si.' : won ? 'Vatra je ugašena.' : 'Grad gori.';
  $('over-sub').textContent = crashed
    ? 'The Adriatic is not a runway. The fire is still burning.'
    : won
      ? 'The last of it is out. Šibenik is still standing, and the stone of St James never felt the heat.'
      : 'It got into the old town. Eight hundred years of it, and it went in an afternoon.';
  $('over-stats').innerHTML = [
    ['time', formatClock(state.t)],
    ['dropped', groupNum(state.litresDropped) + ' l'],
    ['on target', Math.round(state.litresOnTarget / Math.max(1, state.litresDropped) * 100) + '%'],
    ['burnt', Math.round(fire.burntArea()) + ' ha'],
    ['city intact', Math.round(state.cityHealth * 100) + '%'],
    ['score', groupNum(state.score)],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
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
  const dt = Math.min(0.05, clock.getDelta());
  U.uTime.value += dt;
  if (!started) return;

  if (state.phase === 'fly') {
    readKeys(dt);
    flight.update(dt, input);
    updateMission(dt);
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
  sea.update(camera);
  fire.update(dt);
  if (state.phase === 'fly') wingmen.update(dt);
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
  radio('KRILO 1', 'Bomba je puknula iznad Jadrije. Idemo.');
  camPos.copy(camera.position);
  camAim.copy(flight.p.pos);
  setTimeout(() => canvas.requestPointerLock(), 250);
}

$('cine-skip').addEventListener('click', beginFlight);

frame();
boot().catch((e) => {
  $('stage').textContent = 'failed: ' + e.message;
  console.error(e);
});

// A small handle for the screenshot tool.
window.__fr = {
  stats: () => ({
    fps: Math.round(state.fps), burning: fire ? fire.burningCount() : 0,
    tiles: terrain ? terrain.stats() : null,
    trees: trees ? trees.stats() : null,
    landmarks: landmarks ? landmarks.list.length + '/' + LANDMARKS.length : null,
    city: city ? { built: city.built, tris: city.tris } : null,
    water: Math.round(flight ? flight.p.water : 0),
    wingmen: wingmen ? wingmen.debug() : null,
    runs: wingmen ? wingmen.runCount() : 0,
    aiLitres: wingmen ? Math.round(wingmen.litres()) : 0,
    burntHa: fire ? Math.round(fire.burntArea()) : 0,
    city: undefined,
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
  scene, camera, renderer,
};
