// -----------------------------------------------------------------------------
// The fire.
//
// A cellular automaton on a 256² grid — about 51 m to the cell — reading fuel
// straight off the OSM land cover, so what carries and what stops it is the
// real vegetation around Šibenik. Aleppo pine runs; bare karst does not.
//
// Three things drive spread, and they are the three things that drive it in a
// real Dalmatian fire: wind, slope, and how dry the fuel is. Water changes the
// third one, which is the whole game.
//
// The city is across the channel and cannot be reached by ground. It is reached
// by *spotting* — embers thrown a kilometre downwind — which is both how these
// fires actually jump water and the reason you are on a clock.
// -----------------------------------------------------------------------------

const FIRE = {
  UNBURNT: 0, BURNING: 1, BURNT: 2,
  maxFlames: 3000,
  maxSmoke: 900,
  spotEvery: 5.5,        // seconds between ember throws once the fire is big
  spotMinRun: 260,       // metres
  spotMaxRun: 1750,
};

function buildFire(scene) {
  const N = CONFIG.fireRes;
  const n2 = N * N;
  const cell = CONFIG.world / N;                  // metres per cell
  const rng = mulberry32(CONFIG.seed ^ 0x1f13e);

  const stateArr = new Uint8Array(n2);
  const inten = new Float32Array(n2);
  const fuel = new Float32Array(n2);
  const fuel0 = new Float32Array(n2);      // what was there before it burnt
  const wet = new Float32Array(n2);
  const heat = new Float32Array(n2);              // lingering warmth, for shimmer
  const coverOf = new Uint8Array(n2);
  const slopeUp = new Float32Array(n2 * 2);       // uphill direction per cell
  const groundY = new Float32Array(n2);

  // ── sample the world into the coarse grid ────────────────────────────────
  const cellToWorld = (i) => {
    const gx = i % N, gz = (i / N) | 0;
    return [(gx + 0.5) / N * CONFIG.world - HALF, (gz + 0.5) / N * CONFIG.world - HALF];
  };
  const worldToCell = (x, z) => {
    const gx = clamp(Math.floor(((x + HALF) / CONFIG.world) * N), 0, N - 1);
    const gz = clamp(Math.floor(((z + HALF) / CONFIG.world) * N), 0, N - 1);
    return gz * N + gx;
  };

  let totalFuel = 0;
  for (let i = 0; i < n2; i++) {
    const [x, z] = cellToWorld(i);
    const c = coverAt(x, z);
    coverOf[i] = c;
    const jitterIdx = gridIndex(x, z);
    const jn = world.grid;
    const j = world.fuelJitter[Math.round(jitterIdx.gz) * jn + Math.round(jitterIdx.gx)] / 255;
    fuel[i] = FUEL[c] * (0.72 + 0.56 * j);
    // The aerodrome is invented; the land-cover raster underneath it still says
    // scrub, and a cell is fifty metres square, so without this the fire walks
    // straight across eleven hundred metres of asphalt as if it were maquis —
    // which put the entire ground crew alight inside a minute and made the
    // rescue unwinnable for a reason nobody could see. A runway is a firebreak.
    // That is half of what a runway *is*.
    if (typeof airfield !== 'undefined' && airfield && airfield.onPaved
      && airfield.onPaved(x, z) != null) fuel[i] = 0;
    fuel0[i] = fuel[i];
    groundY[i] = groundAt(x, z);
    totalFuel += fuel[i];
    // Uphill unit vector — fire runs up a slope far faster than down one,
    // because the flames preheat the fuel above them.
    const hx = groundAt(x + cell, z) - groundAt(x - cell, z);
    const hz = groundAt(x, z + cell) - groundAt(x, z - cell);
    const m = Math.hypot(hx, hz) || 1e-6;
    slopeUp[i * 2] = hx / m;
    slopeUp[i * 2 + 1] = hz / m;
    heat[i] = Math.min(1, Math.hypot(hx, hz) / (2 * cell));   // reuse as steepness
  }
  const steep = heat.slice();
  heat.fill(0);

  // Which cells count as "the city" — the old town and its immediate quarters.
  const cath = placeNamed('katedrala') || { x: 1540, z: -847 };
  const cityMask = new Uint8Array(n2);
  let cityCells = 0;
  for (let i = 0; i < n2; i++) {
    const [x, z] = cellToWorld(i);
    const d = Math.hypot(x - cath.x, z - cath.z);
    if (d < 2100 && (coverOf[i] === COVER.URBAN || urbanAt(x, z) > 0.12)) {
      cityMask[i] = 1;
      cityCells++;
    }
  }

  // ── the texture the whole scene reads ────────────────────────────────────
  const tex = new Uint8Array(n2 * 4);
  const fireTex = new THREE.DataTexture(tex, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  fireTex.magFilter = fireTex.minFilter = THREE.LinearFilter;
  fireTex.wrapS = fireTex.wrapT = THREE.ClampToEdgeWrapping;
  fireTex.needsUpdate = true;
  U.uFire.value = fireTex;

  const burning = new Set();
  let burntCount = 0, cityBurnt = 0, spotTimer = 0, acc = 0;

  function ignite(i, strength = 1) {
    if (stateArr[i] !== FIRE.UNBURNT || fuel[i] < 0.06) return false;
    if (wet[i] > 0.55) return false;
    stateArr[i] = FIRE.BURNING;
    inten[i] = Math.max(inten[i], 0.25 * strength);
    burning.add(i);
    return true;
  }

  function igniteAt(x, z, strength = 1) { return ignite(worldToCell(x, z), strength); }

  /**
   * Ignite at the nearest cell that will actually take. A hand-placed
   * ignition point sitting fifty metres into the water starts no fire at all
   * and the whole mission quietly does nothing, which is exactly what it did.
   */
  function igniteNear(x, z, strength = 1, maxRing = 24) {
    if (igniteAt(x, z, strength)) return true;
    for (let r = 1; r <= maxRing; r++) {
      for (let k = 0; k < r * 8; k++) {
        const a = (k / (r * 8)) * Math.PI * 2;
        const px = x + Math.cos(a) * r * cell;
        const pz = z + Math.sin(a) * r * cell;
        if (Math.abs(px) > HALF || Math.abs(pz) > HALF) continue;
        if (igniteAt(px, pz, strength)) return true;
      }
    }
    return false;
  }

  // ── the automaton ────────────────────────────────────────────────────────
  const NB = [-1, 1, -N, N, -N - 1, -N + 1, N - 1, N + 1];
  const NBD = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

  function tick(dt) {
    const wx = Math.cos(state.windDir), wz = Math.sin(state.windDir);
    const windK = 0.55 + state.windSpeed * 0.115 + state.gust * 0.5;
    const dead = [];

    for (const i of burning) {
      // burn down the fuel
      const rate = CONFIG.fuelBurnRate * dt * (0.55 + 1.5 * inten[i]) * (1 - wet[i] * 0.7);
      fuel[i] -= rate;
      if (fuel[i] <= 0) {
        fuel[i] = 0;
        inten[i] -= dt * 0.55;
        if (inten[i] <= 0.02) {
          inten[i] = 0;
          stateArr[i] = FIRE.BURNT;
          dead.push(i);
          burntCount++;
          if (cityMask[i]) cityBurnt++;
          continue;
        }
      } else {
        // grow toward what the fuel and the damp will support
        const ceiling = Math.min(1, fuel[i] * 1.5) * (1 - wet[i]);
        inten[i] = damp(inten[i], ceiling, 0.9, dt);
        if (inten[i] < 0.03 && wet[i] > 0.4) {
          // knocked down by water rather than burnt out — the fuel survives
          inten[i] = 0;
          stateArr[i] = FIRE.UNBURNT;
          dead.push(i);
          continue;
        }
      }
      heat[i] = Math.min(1, heat[i] + dt * 0.8);

      if (inten[i] < 0.18) continue;              // too weak to throw fire

      const gx = i % N, gz = (i / N) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = gx + NBD[k][0], nz = gz + NBD[k][1];
        if (nx < 0 || nx >= N || nz < 0 || nz >= N) continue;
        const j = i + NB[k];
        if (stateArr[j] !== FIRE.UNBURNT || fuel[j] < 0.06) continue;

        // direction from i to j, normalised
        const dx = NBD[k][0], dz = NBD[k][1];
        const inv = 1 / Math.hypot(dx, dz);
        const ux = dx * inv, uz = dz * inv;

        // Downwind spread is many times faster than upwind. The exponent is
        // what makes the fire a long finger rather than a circle.
        const wdot = ux * wx + uz * wz;
        const windF = Math.exp(windK * wdot) * 0.55;

        // Uphill likewise — this is why it climbs to the ridge and sits there.
        const sdot = ux * slopeUp[i * 2] + uz * slopeUp[i * 2 + 1];
        const slopeF = Math.exp(2.6 * steep[i] * sdot);

        const p = CONFIG.fireSpreadBase * dt * 4
          * fuel[j] * windF * slopeF * inten[i]
          * (1 - wet[j]) * (1 - wet[j]);

        if (rng() < p) ignite(j, 0.55);
      }
    }
    for (const i of dead) burning.delete(i);

    // Water dries out; scorched ground cools.
    for (let i = 0; i < n2; i++) {
      if (wet[i] > 0) {
        const r = RETAIN[coverOf[i]];
        wet[i] = Math.max(0, wet[i] - dt * 0.010 / Math.max(0.2, r));
      }
      if (heat[i] > 0 && stateArr[i] !== FIRE.BURNING) heat[i] = Math.max(0, heat[i] - dt * 0.06);
    }
  }

  /** Embers, thrown downwind. This is the only way the fire reaches the city. */
  function spot(dt) {
    if (burning.size < 12) return;
    spotTimer -= dt;
    if (spotTimer > 0) return;
    spotTimer = FIRE.spotEvery * (0.6 + rng() * 0.8) / Math.min(3, 1 + burning.size / 300);

    const list = Array.from(burning);
    const src = list[(rng() * list.length) | 0];
    if (inten[src] < 0.45) return;
    const [sx, sz] = cellToWorld(src);

    const run = lerp(FIRE.spotMinRun, FIRE.spotMaxRun, Math.pow(rng(), 1.7))
      * (0.5 + state.windSpeed / 12);
    const spread = (rng() - 0.5) * 0.5;
    const a = state.windDir + spread;
    const tx = sx + Math.cos(a) * run;
    const tz = sz + Math.sin(a) * run;
    if (Math.abs(tx) > HALF || Math.abs(tz) > HALF) return;

    const j = worldToCell(tx, tz);
    if (fuel[j] > 0.25 && rng() < 0.62) {
      if (ignite(j, 0.4)) {
        events.push({ kind: 'spot', x: tx, z: tz,
          city: !!cityMask[j] || Math.hypot(tx - cath.x, tz - cath.z) < 2400 });
      }
    }
  }

  const events = [];

  // ── water ────────────────────────────────────────────────────────────────
  /**
   * Lay down `litres` in an ellipse — long along the flight path, narrow across
   * it, which is what a real drop leaves. Returns litres that landed on
   * something burning, for scoring.
   */
  function drop(x, z, dirX, dirZ, litres) {
    const len = 190, wide = 46;
    const ux = dirX, uz = dirZ;
    const vx = -uz, vz = ux;
    const area = Math.PI * len * wide * 0.25;
    const perM2 = litres / area;

    let onTarget = 0, knocked = 0;
    const r = Math.ceil(len / cell) + 2;
    const ci = worldToCell(x, z);
    const cgx = ci % N, cgz = (ci / N) | 0;

    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const gx = cgx + dx, gz = cgz + dz;
        if (gx < 0 || gx >= N || gz < 0 || gz >= N) continue;
        const j = gz * N + gx;
        const [wx2, wz2] = cellToWorld(j);
        const rx = wx2 - x, rz = wz2 - z;
        const along = rx * ux + rz * uz;
        const across = rx * vx + rz * vz;
        const e = (along / (len * 0.5)) ** 2 + (across / (wide * 0.5)) ** 2;
        if (e > 1) continue;

        const density = perM2 * (1 - e * 0.55);
        // Litres per m² needed to soak a cell, scaled by how well it holds.
        const soak = density * cell * cell / CONFIG.waterPerCell * RETAIN[coverOf[j]];
        const before = inten[j];
        wet[j] = Math.min(1, wet[j] + soak * 1.35);
        if (stateArr[j] === FIRE.BURNING) {
          inten[j] = Math.max(0, inten[j] - soak * 2.1);
          onTarget += density * cell * cell;
          if (before > 0.05 && inten[j] <= 0.03) knocked++;
        }
      }
    }
    events.push({ kind: 'drop', x, z, litres, onTarget, knocked });
    return { onTarget, knocked };
  }

  /**
   * A handline, not an air drop: a few metres of ground, and about three times
   * the effect per litre.
   *
   * That multiplier is not a favour to the player. Six tonnes released at ninety
   * metres over a Dalmatian afternoon loses a large fraction to evaporation,
   * drift and canopy interception before any of it reaches the fuel — which is
   * the entire reason a fire is not actually put out from the air. Aircraft buy
   * time; somebody standing in it with a branch is what puts it out.
   */
  function hose(x, z, litres) {
    const R = 24;                    // reach of the jet, well inside one cell
    const EFF = 3.0;
    const ci = worldToCell(x, z);
    const cgx = ci % N, cgz = (ci / N) | 0;
    const rr = Math.ceil(R / cell) + 1;

    // Weight by distance first, so pointing at a cell boundary wets both sides
    // instead of dumping everything into whichever cell won the rounding.
    const hits = [];
    let wsum = 0;
    for (let dz = -rr; dz <= rr; dz++) {
      for (let dx = -rr; dx <= rr; dx++) {
        const gx = cgx + dx, gz = cgz + dz;
        if (gx < 0 || gx >= N || gz < 0 || gz >= N) continue;
        const j = gz * N + gx;
        const [wx2, wz2] = cellToWorld(j);
        const w = 1 - Math.hypot(wx2 - x, wz2 - z) / (R + cell * 0.5);
        if (w <= 0) continue;
        hits.push(j, w); wsum += w;
      }
    }
    if (wsum <= 0) return { onTarget: 0, knocked: 0 };

    let onTarget = 0, knocked = 0;
    for (let k = 0; k < hits.length; k += 2) {
      const j = hits[k], share = litres * hits[k + 1] / wsum;
      const soak = share * EFF / CONFIG.waterPerCell * RETAIN[coverOf[j]];
      const before = inten[j];
      wet[j] = Math.min(1, wet[j] + soak * 1.35);
      if (stateArr[j] === FIRE.BURNING) {
        inten[j] = Math.max(0, inten[j] - soak * 2.1);
        onTarget += share;
        if (before > 0.05 && inten[j] <= 0.03) knocked++;
      }
    }
    return { onTarget, knocked };
  }

  // ── the texture ──────────────────────────────────────────────────────────
  function upload() {
    for (let i = 0; i < n2; i++) {
      const o = i * 4;
      tex[o] = (inten[i] * 255) | 0;
      // Fuel *remaining*, as a fraction of what this cell started with — which
      // is what the terrain shader means by `scorch = 1.0 - f.g`.
      //
      // This used to write the absolute fuel load, and absolute load is a
      // property of the land cover, not of the fire: bare karst carries 0.04
      // and sand 0.02, so the shader read them as 96% and 98% burnt and
      // painted them ash-black on a map where nothing had burned at all. Only
      // pine (1.00) and maquis (0.78) ever looked unburnt, which is why the
      // white limestone this whole coast is made of has never once been white.
      // A cell with nothing to burn is not a burnt cell.
      tex[o + 1] = fuel0[i] > 0.02 ? Math.min(255, (fuel[i] / fuel0[i]) * 255) | 0 : 255;
      tex[o + 2] = (wet[i] * 255) | 0;
      tex[o + 3] = (heat[i] * 255) | 0;
    }
    fireTex.needsUpdate = true;
  }
  // fuel starts full, so the terrain must see it before the first tick
  upload();

  // ── flames, embers, smoke ────────────────────────────────────────────────
  const flames = buildFlames(scene, FIRE.maxFlames);
  const smoke = buildSmoke(scene, FIRE.maxSmoke);

  let uploadAcc = 0;
  function update(dt) {
    acc += dt;
    let ticks = 0;
    while (acc >= CONFIG.fireStep && ticks < 4) {
      tick(CONFIG.fireStep);
      spot(CONFIG.fireStep);
      acc -= CONFIG.fireStep;
      ticks++;
    }
    uploadAcc += dt;
    if (uploadAcc > 0.1) { upload(); uploadAcc = 0; }

    // stats
    state.burning = burning.size;
    state.burnt = burntCount;
    state.cityHealth = cityCells ? 1 - cityBurnt / cityCells : 1;
    // Smoke pall follows the size of the fire, but saturates — past a point it
    // is already as brown as it is going to get.
    U.uSmokeAmt.value = damp(U.uSmokeAmt.value,
      Math.min(0.85, burning.size / 420), 0.35, dt);

    flames.update(dt, burning, inten, cellToWorld, groundY, cell);
    smoke.update(dt, burning, inten, cellToWorld, groundY);
  }

  return {
    update, ignite: igniteAt, igniteNear, drop, hose, events,
    burningCount: () => burning.size,
    burntArea: () => burntCount * cell * cell / 1e4,      // hectares
    totalArea: () => n2 * cell * cell / 1e4,
    cityCells: () => cityCells,
    fuelLeft: () => { let s = 0; for (let i = 0; i < n2; i++) s += fuel[i]; return s / totalFuel; },
    /** Nearest burning cell to a point, for the AI and the HUD arrow. */
    nearestFire(x, z) {
      let best = null, bd = Infinity;
      for (const i of burning) {
        if (inten[i] < 0.25) continue;
        const [cx, cz] = cellToWorld(i);
        const d = (cx - x) ** 2 + (cz - z) ** 2;
        if (d < bd) { bd = d; best = [cx, cz, groundY[i]]; }
      }
      return best;
    },
    /**
     * Where the next load should go. Scored by intensity and by how close the
     * cell is to the town, so the wingmen work the leading edge rather than
     * the middle. Deliberately *not* hottest(): that jumps to a new cell every
     * few seconds as fuel burns through, and an aeroplane with a 300 m turn
     * radius chasing it just flies circles.
     */
    priorityTarget() {
      let best = null, bs = -1;
      for (const i of burning) {
        if (inten[i] < 0.2) continue;
        const [x, z] = cellToWorld(i);
        const d = Math.hypot(x - cath.x, z - cath.z);
        const s2 = inten[i] * (1 + 2600 / (600 + d));
        if (s2 > bs) { bs = s2; best = i; }
      }
      if (best == null) return null;
      const [x, z] = cellToWorld(best);
      return [x, z, groundY[best]];
    },

    /** The hottest patch — where a drop does the most good. */
    hottest() {
      let best = null, bi = 0;
      for (const i of burning) {
        if (inten[i] > bi) { bi = inten[i]; best = i; }
      }
      if (best == null) return null;
      const [x, z] = cellToWorld(best);
      return [x, z, groundY[best]];
    },
    intensityAt(x, z) { return inten[worldToCell(x, z)]; },
    /** 0..1, how much of this cell's fuel the fire has already taken. */
    charAt(x, z) {
      const i = worldToCell(x, z);
      if (fuel0[i] < 0.02) return 0;
      return clamp(1 - fuel[i] / fuel0[i], 0, 1);
    },
    cell,
  };
}
