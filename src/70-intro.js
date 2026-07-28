// -----------------------------------------------------------------------------
// The intro.
//
// All of it is Šibenik now. Earlier versions took a detour through Zagreb in
// 1995 and Kherson in 2022 to make a point about the weapon, and the point was
// worth making, but it was somebody else's town twice over and it pulled the
// film away from the one place the game is actually about. The whole sequence
// runs Dalmatia → the war → what it left → 6 August 2024.
//
// The 3-D is drawn in engine and the paintings are paintings; there is no
// archive footage, because a real hillside going up with people underneath it
// is not something to re-enact for entertainment.
//
// Every claim in the captions is documented, and the documentation is the fire
// of 6 August 2024 at Rokići above Šibenik: reported at 12:52, three and a half
// hectares of aleppo pine, the coast road closed, detonations from Homeland-War
// cluster submunitions — "zvončići" — going off in the heat while the crews
// worked, and four Canadairs and an Air Tractor over the top of it.
//
// Two liberties, both deliberate. The game moves the fire across the channel to
// the hills above Jadrija, because a fire the ground crews genuinely cannot
// reach is the only kind that has to be fought from the air, and that is the
// game. And the bomblet that lights it is the game's own.
// -----------------------------------------------------------------------------

const INTRO = {
  bomblets: 288,          // what an M-87 Orkan warhead actually carries
  openAlt: 1000,          // and the altitude it opens at
};

/** The submunitions: small, tumbling, and far too many of them. */
function buildBomblets(scene, max) {
  const g = new THREE.BoxGeometry(0.34, 0.34, 0.62);
  const mat = solidMaterial(0x6e6a63, { spec: 0.30, specPower: 40, vcol: false });
  const mesh = new THREE.InstancedMesh(g, mat, max);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.visible = false;
  scene.add(mesh);

  const P = {
    x: new Float32Array(max), y: new Float32Array(max), z: new Float32Array(max),
    vx: new Float32Array(max), vy: new Float32Array(max), vz: new Float32Array(max),
    sx: new Float32Array(max), sy: new Float32Array(max),
    landed: new Uint8Array(max), dud: new Uint8Array(max),
  };
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _s = new THREE.Vector3(1, 1, 1);
  const _p = new THREE.Vector3();
  let n = 0, rng = mulberry32(0x0bb1e7);

  function burstOpen(x, y, z, vx, vz) {
    n = max;
    mesh.count = max;
    mesh.visible = true;
    for (let i = 0; i < max; i++) {
      // A canister opening throws them into a shallow cone, which is why the
      // footprint on the ground is an ellipse a couple of hundred metres long.
      const a = rng() * TAU;
      const r = Math.sqrt(rng()) * 22;
      P.x[i] = x; P.y[i] = y; P.z[i] = z;
      P.vx[i] = vx + Math.cos(a) * r;
      P.vz[i] = vz + Math.sin(a) * r;
      P.vy[i] = -4 - rng() * 6;
      P.sx[i] = rng() * 8; P.sy[i] = rng() * 8;
      P.landed[i] = 0;
      // Roughly one in twenty of these never went off.
      P.dud[i] = rng() < 0.05 ? 1 : 0;
    }
  }

  function update(dt, onImpact) {
    if (!n) return;
    for (let i = 0; i < n; i++) {
      if (P.landed[i]) continue;
      P.vy[i] -= 9.81 * dt * 0.55;          // ribbon-retarded, so they fall slow
      P.vx[i] *= 1 - 1.1 * dt;
      P.vz[i] *= 1 - 1.1 * dt;
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
      P.z[i] += P.vz[i] * dt;
      const g0 = isSea(P.x[i], P.z[i]) ? 0 : groundAt(P.x[i], P.z[i]);
      if (P.y[i] <= g0 + 0.2) {
        P.y[i] = g0 + 0.18;
        P.landed[i] = 1;
        if (onImpact) onImpact(P.x[i], P.y[i], P.z[i], !!P.dud[i]);
      }
      P.sx[i] += dt * 5.5; P.sy[i] += dt * 4.1;
    }
    for (let i = 0; i < n; i++) {
      _e.set(P.sx[i], P.sy[i], 0);
      _q.setFromEuler(_e);
      _p.set(P.x[i], P.y[i], P.z[i]);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** Keep only the duds, lying where they fell. */
  function keepDudsOnly() {
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (!P.dud[i]) continue;
      _e.set(1.2, P.sy[i], 0.3);
      _q.setFromEuler(_e);
      _p.set(P.x[i], P.y[i], P.z[i]);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(c++, _m);
    }
    mesh.count = c;
    n = 0;
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { mesh, burstOpen, update, keepDudsOnly,
    hide() { mesh.visible = false; mesh.count = 0; n = 0; } };
}

function buildIntro(scene, camera, deps) {
  const { fire, audio, plane, flight, setGrade, caption } = deps;
  const [ix, iz] = CONFIG.ignitionPoint;
  const ground = groundAt(ix, iz);
  const bomblets = buildBomblets(scene, INTRO.bomblets);

  // A single canister, arcing in and opening overhead.
  const canister = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 3.4, 4, 8),
    solidMaterial(0x33302c, { spec: 0.4, emissive: 0.25, vcol: false }),
  );
  canister.frustumCulled = false;
  canister.visible = false;
  scene.add(canister);

  const flashes = [];
  function flash(x, y, z) {
    flashes.push({ x, y, z, t: 0 });
  }
  const flashMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 6),
    solidMaterial(0xffd9a0, { emissive: 3.2, spec: 0, vcol: false }),
    64,
  );
  flashMesh.frustumCulled = false;
  flashMesh.count = 0;
  scene.add(flashMesh);

  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ── the painted plates ───────────────────────────────────────────────────
  // Nine panels, generated from the reference photographs by tools/gen_panels.py
  // and inlined as WebP. They cross-fade over the 3-D on a slow push, which is
  // the difference between a slideshow and a title sequence.

  const plateHost = document.getElementById('panels');
  const plates = [document.getElementById('pan-a'), document.getElementById('pan-b')];
  let plateSlot = 0;

  /**
   * @param key   PAYLOAD key, or null to clear
   * @param mv    [scale0, x0%, y0%, scale1, x1%, y1%] — the Ken Burns move
   * @param secs  how long the move takes
   */
  function plate(key, mv, secs) {
    if (!plateHost) return;
    if (!key) {
      for (const p of plates) p.classList.remove('on');
      plateHost.classList.remove('showing');
      return;
    }
    const src = PAYLOAD['panel_' + key];
    if (!src) return;
    plateSlot ^= 1;
    const el = plates[plateSlot], other = plates[plateSlot ^ 1];
    el.style.transition = 'opacity 1.1s ease';
    el.style.transform = `scale(${mv[0]}) translate(${mv[1]}%, ${mv[2]}%)`;
    if (el.src !== src) el.src = src;
    // Two frames: one to land the start transform without animating into it,
    // one to start the move. One is not enough — the browser coalesces them.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = `opacity 1.1s ease, transform ${secs}s linear`;
      el.style.transform = `scale(${mv[3]}) translate(${mv[4]}%, ${mv[5]}%)`;
      el.classList.add('on');
      other.classList.remove('on');
      plateHost.classList.add('showing');
    }));
  }

  // ── the timeline ─────────────────────────────────────────────────────────
  // Each beat holds the camera on a slow move and one line of text. The grade
  // runs from near-monochrome at the start to full colour when the present day
  // arrives, because that is the only cut that should feel like relief.
  const BEATS = [
    {
      dur: 8,
      grade: { sat: 0.06, con: 1.35, bright: 0.42, tint: 'rgba(20,32,54,0.55)' },
      from: V(ix - 320, ground + 120, iz + 260), to: V(ix - 180, ground + 96, iz + 180),
      lookFrom: V(ix, ground + 40, iz), lookTo: V(ix + 60, ground + 30, iz - 40),
      key: 'cine.war',
      plate: ['war', [1.04, 0, 0, 1.14, -2, -1.5], 9],
      on() {
        state.hour = 21.4;
        if (audio) { audio.drone('dread', 0.10, 4.5); audio.shelling(8, 0.9); }
      },
    },
    {
      dur: 9,
      grade: { sat: 0.10, con: 1.30, bright: 0.50, tint: 'rgba(22,30,50,0.45)' },
      from: V(ix - 700, ground + 620, iz + 700), to: V(ix - 380, ground + 520, iz + 420),
      lookFrom: V(ix, ground + 900, iz), lookTo: V(ix, ground + 620, iz),
      key: 'cine.orkan',
      plate: ['orkan', [1.02, 0, 2, 1.13, 0, -3], 10],
      plateOut: 5.4,
      on() {
        canister.visible = true;
        if (audio) { audio.incoming(); audio.drone('dread', 0.13, 2.0); }
      },
      tick(t, dur) {
        const u = t / dur;
        canister.position.set(ix - 900 + u * 1800, ground + INTRO.openAlt + 240 - u * 240,
          iz + 500 - u * 900);
        canister.rotation.z = -0.5;
        canister.rotation.y = 0.9;
      },
    },
    {
      dur: 10,
      grade: { sat: 0.12, con: 1.28, bright: 0.55, tint: 'rgba(24,28,44,0.40)' },
      from: V(ix - 240, ground + 210, iz + 300), to: V(ix - 140, ground + 120, iz + 190),
      lookFrom: V(ix, ground + 300, iz), lookTo: V(ix, ground + 60, iz),
      key: 'cine.jingle',
      plate: ['jinglebell', [1.16, 2, 1, 1.02, -1, -1], 6],
      plateIn: 4.6,
      on() {
        canister.visible = false;
        bomblets.burstOpen(ix, ground + INTRO.openAlt * 0.34, iz, 26, -18);
        if (audio) { audio.jingle(3.2); audio.droneOff(3.0); }
      },
    },
    {
      dur: 9,
      grade: { sat: 0.14, con: 1.25, bright: 0.58, tint: 'rgba(26,26,38,0.38)' },
      from: V(ix - 60, ground + 26, iz + 70), to: V(ix - 22, ground + 9, iz + 30),
      lookFrom: V(ix, ground + 6, iz), lookTo: V(ix, ground + 1.5, iz),
      key: 'cine.duds',
      plate: ['karst', [1.02, -2, 0, 1.12, 2, -1], 7],
      plateIn: 2.2, plateOut: 7.6,
      on() {
        if (audio) { audio.rumble(); audio.drone('lament', 0.11, 3.5); }
      },
      out() { bomblets.keepDudsOnly(); },
    },
    {
      dur: 10,
      grade: { sat: 0.30, con: 1.15, bright: 0.78, tint: 'rgba(30,26,20,0.22)' },
      from: V(ix - 14, ground + 4.5, iz + 16), to: V(ix - 5, ground + 2.2, iz + 6),
      lookFrom: V(ix, ground + 0.6, iz), lookTo: V(ix, ground + 0.5, iz),
      key: 'cine.summers',
      // No plate here on purpose: thirty years of sun racing over the real
      // karst is the best thing the 3-D does, and a painting would cover it.
      on() {
        // Thirty Augusts in ten seconds, and every one of them sounded
        // exactly like this.
        if (audio) { audio.droneOff(2.0); audio.cicadas(true, 0.06); }
      },
      // Run the sun round fast: thirty years in ten seconds.
      tick(t, dur) { state.hour = 5.5 + ((t * 2.6) % 1) * 14.5; setSun(); },
      out() { state.hour = CONFIG.startHour; setSun(); },
    },
    {
      dur: 9,
      grade: { sat: 1.0, con: 1.0, bright: 1.0, tint: 'rgba(0,0,0,0)' },
      // The plate holds the first six seconds; when it lifts, the 3-D has to
      // have something to say. Looking along the ground at the scrub does not
      // — it reads as flat green nothing — so the shot starts wide with the
      // town away across the channel and settles onto the patch of hillside
      // the next beat is about.
      from: V(ix - 90, ground + 34, iz + 105), to: V(ix - 16, ground + 6, iz + 18),
      lookFrom: V(ix + 620, ground + 34, iz - 620), lookTo: V(ix, ground + 1, iz),
      key: 'cine.today',
      plate: ['today', [1.14, -2, 2, 1.02, 1, -1], 9],
      plateOut: 5.8,
      on() {
        state.hour = CONFIG.startHour; setSun();
        if (audio) { audio.droneOff(2.4); audio.cicadas(true, 0.05); }
      },
    },
    {
      dur: 8,
      grade: { sat: 1.0, con: 1.05, bright: 1.05, tint: 'rgba(60,10,0,0.10)' },
      from: V(ix - 12, ground + 4, iz + 12), to: V(ix - 90, ground + 70, iz + 90),
      lookFrom: V(ix, ground + 0.8, iz), lookTo: V(ix, ground + 12, iz),
      key: 'cine.ignition',
      plate: ['ignition', [1.02, 0, 0, 1.10, 1, -2], 5],
      plateOut: 4.0,
      on() {
        // The one that starts it.
        fire.igniteNear(ix, iz, 1);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU;
          fire.igniteNear(ix + Math.cos(a) * 70, iz + Math.sin(a) * 70, 0.85, 3);
        }
        flash(ix, ground + 1, iz);
        if (audio) { audio.cicadas(false); audio.detonate(); }
        bomblets.hide();
      },
    },
    {
      // The real afternoon: the hillside going off while the crews work it.
      dur: 9,
      grade: { sat: 1.0, con: 1.08, bright: 0.98, tint: 'rgba(70,16,0,0.16)' },
      from: V(ix - 90, ground + 70, iz + 90), to: V(ix - 300, ground + 150, iz + 320),
      lookFrom: V(ix, ground + 12, iz), lookTo: V(ix, ground + 40, iz),
      key: 'cine.ordnance',
      plate: ['rokici', [1.03, -1, 1, 1.13, 2, -2], 10],
      on() {
        // It is still going off out there, at intervals, in the smoke.
        if (audio) {
          audio.drone('lament', 0.10, 2.5);
          audio.shelling(8, 0.42);
        }
      },
    },
    {
      dur: 11,
      grade: { sat: 1.0, con: 1.0, bright: 1.0, tint: 'rgba(0,0,0,0)' },
      from: V(ix - 300, ground + 150, iz + 320), to: V(ix - 1500, 1250, iz + 1600),
      lookFrom: V(ix, ground + 40, iz), lookTo: V(ix + 500, 60, iz - 500),
      key: 'cine.launch',
      on() { if (audio) audio.drone('hope', 0.12, 4.0); },
      plate: ['canadair', [1.10, 3, 2, 1.00, -2, -1], 8],
      plateIn: 4.2,
    },
  ];

  let beat = -1, t = 0, running = false, done = false;
  let plateShown = false, plateDone = false;
  const _from = new THREE.Vector3(), _to = new THREE.Vector3();
  const _lf = new THREE.Vector3(), _lt = new THREE.Vector3();
  const _aim = new THREE.Vector3();

  function enter(i) {
    if (beat >= 0 && BEATS[beat].out) BEATS[beat].out();
    beat = i;
    t = 0;
    beatMs = performance.now();
    if (i >= BEATS.length) { finish(); return; }
    const b = BEATS[i];
    _from.copy(b.from); _to.copy(b.to);
    _lf.copy(b.lookFrom); _lt.copy(b.lookTo);
    setGrade(b.grade);
    caption(T(b.key));
    plateShown = false;
    plateDone = false;
    // A plate never outlives its beat: if this one comes in late, the cut
    // shows the 3-D first rather than leaving the previous painting up.
    if (b.plate && !b.plateIn) { plate(...b.plate); plateShown = true; }
    else plate(null);
    if (b.on) b.on();
  }

  let onDone = null;
  function finish() {
    if (done) return;
    done = true;
    running = false;
    setGrade({ sat: 1, con: 1, bright: 1, tint: 'rgba(0,0,0,0)' });
    caption('');
    if (audio) { audio.droneOff(3.5); audio.cicadas(false); }
    plate(null);
    if (plateHost) setTimeout(() => { plateHost.hidden = true; }, 1300);
    bomblets.hide();
    canister.visible = false;
    flashMesh.count = 0;
    if (onDone) onDone();
  }

  // Changing language mid-film redraws the line that is on screen, rather than
  // leaving the old one up until the cut.
  onLangChange(() => {
    if (running && beat >= 0 && BEATS[beat]) caption(T(BEATS[beat].key));
  });

  function start(cb) {
    onDone = cb; running = true; done = false; lastMs = 0; beatMs = performance.now();
    if (plateHost) plateHost.hidden = false;
    enter(0);
  }

  // Two clocks, and they are not the same clock.
  //
  // The beat position `t` is measured from when the beat *started*, against the
  // wall clock, and never accumulated. Accumulating a per-frame delta means
  // every clamp on that delta silently steals time: the first version summed
  // the frame loop's dt (capped at 50 ms) and a 20 fps machine played the whole
  // film at a third speed. Capping at 200 ms instead only moved the threshold —
  // a machine dropping to 4 fps, which is exactly what a software renderer does
  // while it cross-fades two 1280x720 plates, still ran three times slow.
  // Subtracting two timestamps cannot drift no matter how bad the frame rate is.
  //
  // `dt` is still needed for the bomblets and the flashes, which are a
  // simulation and do want a sane upper bound on a single step.
  let lastMs = 0;
  let beatMs = 0;

  function update() {
    if (!running) return;
    const b = BEATS[beat];
    const now = performance.now();
    const dt = lastMs ? Math.min(0.2, (now - lastMs) / 1000) : 0;
    lastMs = now;
    t = (now - beatMs) / 1000;
    // Ease so each beat settles rather than arriving at constant speed.
    const u = sat(t / b.dur);
    const e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(_from, _to, e);
    _aim.lerpVectors(_lf, _lt, e);
    camera.up.set(0, 1, 0);
    camera.lookAt(_aim);
    if (b.tick) b.tick(t, b.dur);

    // Plates come and go inside a beat, so a panel can hand over to the 3-D
    // exactly when the 3-D has something to say.
    if (b.plate) {
      if (!plateShown && b.plateIn != null && t >= b.plateIn) {
        plate(...b.plate); plateShown = true;
      } else if (plateShown && !plateDone && b.plateOut != null && t >= b.plateOut) {
        plate(null); plateShown = false; plateDone = true;
      }
    }

    bomblets.update(dt, (x, y, z, dud) => { if (!dud) flash(x, y, z); });

    // Detonation flashes: brief, and there are a great many of them.
    let c = 0;
    const _m2 = new THREE.Matrix4();
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.t += dt;
      if (f.t > 0.5) { flashes.splice(i, 1); continue; }
      if (c >= 64) continue;
      const r = 1.5 + f.t * 34;
      _m2.makeTranslation(f.x, f.y + f.t * 3, f.z);
      _m2.scale(new THREE.Vector3(r, r, r));
      flashMesh.setMatrixAt(c++, _m2);
    }
    flashMesh.count = c;
    flashMesh.instanceMatrix.needsUpdate = true;
    if (c) flashMesh.instanceMatrix.needsUpdate = true;

    if (t >= b.dur) enter(beat + 1);
  }

  return {
    start, update, finish, isRunning: () => running,
    /** Cut straight to a beat — for the screenshot tool, which cannot sit
        through eighty seconds of film for every frame it wants. */
    jump: (i) => { if (running) enter(clamp(i, 0, BEATS.length - 1)); },
    beats: BEATS.length,
    totalLength: BEATS.reduce((s, b) => s + b.dur, 0),
  };
}
