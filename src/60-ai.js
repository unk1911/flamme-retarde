// -----------------------------------------------------------------------------
// The other three.
//
// Krilo 2, 3 and 4 fly the same job you do, on the same rules: find open water
// long enough for a run, fill up, cross to the fire, drop on the hottest thing
// they can find, go back. They call fire.drop() exactly as you do, so the water
// they put down really does knock the fire back — leave them alone for five
// minutes and the burn map shows where they have been.
//
// Their flight is kinematic rather than forces-based. What has to be right is
// what you can see from the cockpit: the bank into a turn, the descent onto the
// water, the spray behind the hull, the climb out heavy.
// -----------------------------------------------------------------------------

const AI = {
  count: 3,
  cruiseSpeed: 92,
  scoopSpeed: 64,
  cruiseAlt: 230,
  dropAlt: 55,
  turnRate: 0.42,        // rad/s
  climbRate: 14,
  runLength: 1250,       // metres of water needed for a fill
};

const CALLSIGN = ['KRILO 2', 'KRILO 3', 'KRILO 4'];

/**
 * Find stretches of open water long enough to scoop along. Searched rather than
 * hand-placed, so the wingmen use the channel, the bay and the open sea
 * according to what is actually clear.
 */
function findScoopRuns(rng, want = 14) {
  const runs = [];
  for (let tries = 0; tries < 4000 && runs.length < want; tries++) {
    const x = (rng() * 2 - 1) * (HALF - 900);
    const z = (rng() * 2 - 1) * (HALF - 900);
    if (!isSea(x, z)) continue;
    const a = rng() * TAU;
    const dx = Math.cos(a), dz = Math.sin(a);
    if (!waterRunClear(x, z, dx, dz, AI.runLength, 40)) continue;
    // Reject anything hugging the shore — a run you could not fly in reality.
    if (!waterRunClear(x - dz * 90, z + dx * 90, dx, dz, AI.runLength, 60)) continue;
    if (!waterRunClear(x + dz * 90, z - dx * 90, dx, dz, AI.runLength, 60)) continue;
    runs.push({ x, z, dx, dz });
  }
  return runs;
}

function buildWingmen(scene, fire, onRadio) {
  const rng = mulberry32(CONFIG.seed ^ 0x0a1c3e);
  const runs = findScoopRuns(rng);
  const planes = [];

  for (let i = 0; i < AI.count; i++) {
    const model = buildCanadair();
    scene.add(model.root);
    const [fx, fz] = CONFIG.ignitionPoint;
    const a = (i / AI.count) * TAU;
    planes.push({
      id: i,
      call: CALLSIGN[i],
      model,
      pos: new THREE.Vector3(fx + Math.cos(a) * 2600, AI.cruiseAlt + i * 55, fz + Math.sin(a) * 2600),
      heading: a + Math.PI,
      bank: 0, pitch: 0,
      speed: AI.cruiseSpeed,
      water: i === 0 ? CONFIG.tankCapacity : 0,
      phase: i === 0 ? 'toFire' : 'toWater',
      run: runs.length ? runs[(i * 5) % runs.length] : null,
      target: new THREE.Vector3(),
      t: 0,
      dropTimer: 0,
      chatter: 4 + i * 3,
      litres: 0,
      phaseT: 0,
      hasTarget: false,
      aimAge: 0,
      lastD: Infinity,
    });
  }

  /** Every phase change goes through here so phaseT is always meaningful. */
  function setPhase(p, phase) {
    if (p.phase === phase) return;
    p.phase = phase;
    p.phaseT = 0;
  }

  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();

  /** Steer toward a point, banking into the turn. */
  function steer(p, tx, tz, dt, rate = AI.turnRate) {
    const want = Math.atan2(tx - p.pos.x, -(tz - p.pos.z));
    const d = angleDelta(p.heading, want);
    const turn = clamp(d, -rate * dt, rate * dt);
    p.heading += turn;
    // Bank proportional to how hard it is turning, eased so it does not snap.
    const wantBank = clamp(d, -1.1, 1.1) * 0.62;
    p.bank = damp(p.bank, wantBank, 2.2, dt);
    return Math.hypot(tx - p.pos.x, tz - p.pos.z);
  }

  function pickRun(p) {
    if (!runs.length) return null;
    // Prefer a run that is close, and downwind of nothing in particular — the
    // real consideration is time in the air, so nearest wins.
    let best = null, bd = Infinity;
    for (const r of runs) {
      const d = Math.hypot(r.x - p.pos.x, r.z - p.pos.z);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  function update(dt) {
    for (const p of planes) {
      p.t += dt;
      p.phaseT += dt;
      let targetAlt = AI.cruiseAlt;
      let targetSpeed = AI.cruiseSpeed;

      if (p.phase === 'toWater') {
        if (!p.run) p.run = pickRun(p);
        if (!p.run) { setPhase(p, 'toFire'); continue; }
        // Aim at the entry point of the run, a little before its start.
        const ex = p.run.x - p.run.dx * 700;
        const ez = p.run.z - p.run.dz * 700;
        const d = steer(p, ex, ez, dt);
        targetAlt = Math.min(AI.cruiseAlt, 40 + d * 0.12);
        if (d < 260) {
          setPhase(p, 'scoop');
          if (p.chatter < 0) { onRadio(p.call, 'zahvaćam vodu.'); p.chatter = 26 + rng() * 22; }
        }
      } else if (p.phase === 'scoop') {
        const tx = p.run.x + p.run.dx * AI.runLength;
        const tz = p.run.z + p.run.dz * AI.runLength;
        steer(p, tx, tz, dt, 0.14);
        targetAlt = 3;
        targetSpeed = AI.scoopSpeed;
        if (p.pos.y < 14 && isSea(p.pos.x, p.pos.z)) {
          p.water = Math.min(CONFIG.tankCapacity, p.water + CONFIG.scoopRate * dt);
          scoopSpray.emit(p.pos,
            { x: Math.sin(p.heading), z: -Math.cos(p.heading) },
            { x: Math.cos(p.heading), z: Math.sin(p.heading) },
            p.speed, dt);
        }
        const past = (p.pos.x - p.run.x) * p.run.dx + (p.pos.z - p.run.z) * p.run.dz;
        if (p.water >= CONFIG.tankCapacity - 1 || past > AI.runLength
            || !isSea(p.pos.x, p.pos.z)) {
          setPhase(p, p.water > 1200 ? 'toFire' : 'toWater');
          if (p.water <= 1200) p.run = null;
        }
      } else if (p.phase === 'toFire') {
        // Latch the drop point. Re-reading hottest() every frame gives a target
        // that hops between cells faster than a 307 m turn radius can follow,
        // so they orbit forever and never release — pick once, commit, and only
        // reassign if that patch goes out or the run has gone stale.
        p.aimAge -= dt;
        if (!p.hasTarget || p.aimAge <= 0) {
          const hot = fire.priorityTarget();
          if (hot) {
            p.target.set(hot[0], hot[2], hot[1]);
            p.hasTarget = true;
            p.aimAge = 30;
            p.lastD = Infinity;
          } else {
            p.hasTarget = false;
          }
        }
        if (!p.hasTarget) {
          // Nothing left alight: orbit the town and wait.
          const c = placeNamed('katedrala') || { x: 1540, z: -847 };
          steer(p, c.x + Math.cos(p.t * 0.12) * 2200, c.z + Math.sin(p.t * 0.12) * 2200, dt);
        } else {
          const d = steer(p, p.target.x, p.target.z, dt);
          targetAlt = p.target.y + Math.min(AI.cruiseAlt, AI.dropAlt + d * 0.16);
          // Release on the way in, or abeam if the approach was never going to
          // line up — a real crew would not go round a fifth time either.
          const abeam = d > p.lastD && d < 620;
          if (d < 260 || abeam) {
            setPhase(p, 'drop');
            p.dropTimer = 1.5;
            p.hasTarget = false;
            if (p.chatter < 0) { onRadio(p.call, 'izbacujem!'); p.chatter = 26 + rng() * 22; }
          }
          p.lastD = d;
        }
      } else if (p.phase === 'drop') {
        steer(p, p.target.x, p.target.z, dt, 0.18);
        targetAlt = p.target.y + AI.dropAlt;
        p.dropTimer -= dt;
        if (p.water > 0 && p.dropTimer > 0) {
          const out = Math.min(p.water, CONFIG.dropRate * dt);
          p.water -= out;
          p.litres += out;
          const fwdx = Math.sin(p.heading), fwdz = -Math.cos(p.heading);
          const fall = Math.sqrt(Math.max(0, 2 * AI.dropAlt / 9.81));
          const lx = p.pos.x + fwdx * p.speed * fall;
          const lz = p.pos.z + fwdz * p.speed * fall;
          fire.drop(lx, lz, fwdx, fwdz, out);
          dropSplashes.emit(lx, lz, out, { x: fwdx, z: fwdz });
        }
        if (p.water <= 0 || p.dropTimer <= -0.5) {
          setPhase(p, 'toWater');
          p.run = null;
        }
      }

      // Watchdogs. Navigation can always find a way to not converge — a target
      // just inside the turn circle, a run entry it keeps overshooting — and a
      // wingman that silently orbits for ever is worse than one that gives up
      // and drops. Bound every phase.
      if (p.phase === 'toFire' && p.phaseT > 40 && p.water > 500) {
        const near = fire.nearestFire(p.pos.x, p.pos.z);
        if (near) { p.target.set(near[0], near[2], near[1]); }
        setPhase(p, 'drop');
        p.dropTimer = 1.5;
        p.hasTarget = false;
      }
      if (p.phase === 'scoop' && p.phaseT > 34) {
        setPhase(p, p.water > 1200 ? 'toFire' : 'toWater');
        if (p.water <= 1200) p.run = null;
      }
      if (p.phase === 'toWater' && p.phaseT > 55) { p.run = pickRun(p); p.phaseT = 0; }

      p.chatter -= dt;

      // ── integrate ─────────────────────────────────────────────────────────
      p.speed = damp(p.speed, targetSpeed, 0.7, dt);
      const dy = targetAlt - p.pos.y;
      const vy = clamp(dy * 0.5, -AI.climbRate, AI.climbRate);
      p.pos.y += vy * dt;
      p.pitch = damp(p.pitch, clamp(vy / Math.max(p.speed, 20), -0.28, 0.28), 2.5, dt);
      p.pos.x += Math.sin(p.heading) * p.speed * dt;
      p.pos.z += -Math.cos(p.heading) * p.speed * dt;

      // Never fly through the karst — but a scooping run is *supposed* to be
      // on the deck, so the floor only applies over land, or when they are not
      // on the water. Applying it everywhere pinned them at 34 m and no
      // wingman ever filled a tank.
      if (p.phase === 'scoop' && isSea(p.pos.x, p.pos.z)) {
        p.pos.y = Math.max(p.pos.y, 1.6);
      } else {
        const g = isSea(p.pos.x, p.pos.z) ? 0 : groundAt(p.pos.x, p.pos.z);
        if (p.pos.y < g + 22) p.pos.y = damp(p.pos.y, g + 34, 3, dt);
      }

      // ── pose ──────────────────────────────────────────────────────────────
      _e.set(p.pitch, p.heading, p.bank, 'YXZ');
      _q.setFromEuler(_e);
      p.model.root.position.copy(p.pos);
      p.model.root.quaternion.copy(_q);

      const pr = p.model.parts;
      for (const h of pr.props) h.rotation.z += dt * 96;
      const doors = p.phase === 'drop' ? 1 : 0;
      for (const d of pr.doors) d.mesh.rotation.z = damp(d.mesh.rotation.z, d.side * doors * 1.15, 8, dt);
      const probes = p.phase === 'scoop' ? 1 : 0;
      for (const pb of pr.probes) pb.position.y = damp(pb.position.y, -1.12 - probes * 0.55, 6, dt);
      if (pr.discL) { pr.discL.material.uniforms.uOpacity.value = 0.30; pr.discL.material.transparent = true; }
      if (pr.discR) { pr.discR.material.uniforms.uOpacity.value = 0.30; pr.discR.material.transparent = true; }
      const bank = pr.aileronL;
      if (bank) bank.rotation.x = -p.bank * 0.5;
      if (pr.aileronR) pr.aileronR.rotation.x = p.bank * 0.5;
      pr.gear.visible = false;
    }
  }

  return {
    planes, runs, update,
    litres: () => planes.reduce((s, p) => s + p.litres, 0),
    status: () => planes.map((p) => ({
      call: p.call, phase: p.phase, water: p.water,
    })),
    debug: () => planes.map((p) => ({
      call: p.call, phase: p.phase, w: Math.round(p.water), pt: +p.phaseT.toFixed(1), aim: +p.aimAge.toFixed(1),
      pos: [Math.round(p.pos.x), Math.round(p.pos.y), Math.round(p.pos.z)],
      tgt: p.hasTarget ? [Math.round(p.target.x), Math.round(p.target.z)] : null,
      d: p.hasTarget ? Math.round(Math.hypot(p.target.x - p.pos.x, p.target.z - p.pos.z)) : -1,
      run: p.run ? [Math.round(p.run.x), Math.round(p.run.z)] : null,
      spd: Math.round(p.speed),
    })),
    runCount: () => runs.length,
    /** Nearest wingman to a point, for the engine audio mix. */
    nearest(v) {
      let bd = Infinity;
      for (const p of planes) bd = Math.min(bd, p.pos.distanceTo(v));
      return bd;
    },
  };
}
