// -----------------------------------------------------------------------------
// What actually burns.
//
// The fire automaton has always read its fuel from the OSM land cover, so the
// hillside above Jadrija was pine and maquis in every sense except that you
// could not see it. This is the seeing part: instanced Aleppo pine, cypress,
// olive and maquis scrub, placed from the same cover map the fire reads, so a
// tree standing in a burning cell is a tree standing in a burning cell.
//
// Placement is deterministic per 512 m tile, so a tree is always in the same
// spot however you fly at it, and tiles are generated on demand and cached.
// Everything visible is repacked into four instance buffers — four draw calls
// for the whole landscape, whatever the density.
// -----------------------------------------------------------------------------

const VEG = {
  tile: 512,
  radius: 1500,          // beyond this there is nothing but the terrain colour
  maxTiles: 160,
  perTile: 1500,         // candidate samples per tile, before cover rejects them
  budget: 22000,         // hard ceiling on live instances
};

/**
 * How many of each species per candidate sample, by cover class. The numbers
 * are per-sample probabilities: a tile throws VEG.perTile darts and each one
 * either lands on something that grows or it does not.
 */
const GROWS = [
  /* SEA   */ null,
  /* ROCK  */ { bush: 0.05 },
  /* GRASS */ { bush: 0.10, olive: 0.02 },
  /* SCRUB */ { bush: 0.62, pine: 0.07, cypress: 0.01 },
  /* PINE  */ { pine: 0.55, bush: 0.22, cypress: 0.04 },
  /* OLIVE */ { olive: 0.40, bush: 0.10, cypress: 0.03 },
  /* URBAN */ { cypress: 0.05, olive: 0.03, bush: 0.03 },
  /* SAND  */ { bush: 0.02 },
  /* LAKE  */ null,
  /* VINE  */ { bush: 0.20, olive: 0.06 },
];

const SPECIES = ['pine', 'cypress', 'olive', 'bush'];

/** A ring of points, optionally made irregular so no two sides match. */
function vegRing(y, r, seg, jag = 0) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    const rr = r * (1 + jag * Math.sin(i * 2.37 + y * 6.1));
    pts.push(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr));
  }
  return pts;
}

/**
 * Build one species prototype, normalised to a height of 1 and a radius in the
 * same units, and paint the trunk and the canopy with vertex colours so a
 * single instanced draw can carry both.
 */
function vegGeo(rings, seg, split, barkCol, leafCol) {
  const g = loft(rings, { closed: true, caps: false });
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const ring = Math.floor(i / seg);
    const c = ring < split ? barkCol : leafCol;
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  g.setAttribute('aVCol', new THREE.BufferAttribute(col, 3));
  return g;
}

function vegPrototypes() {
  const bark = [0.30, 0.23, 0.17];
  const S = 5, B = 4;

  // Aleppo pine: bare leaning trunk, flat irregular umbrella. The shape that
  // reads as Dalmatia from a thousand feet.
  const pine = vegGeo([
    vegRing(0.00, 0.055, S), vegRing(0.26, 0.040, S), vegRing(0.48, 0.034, S),
    vegRing(0.50, 0.34, S, 0.22), vegRing(0.70, 0.44, S, 0.20),
    vegRing(0.88, 0.33, S, 0.18), vegRing(1.00, 0.09, S),
  ], S, 3, bark, [0.14, 0.24, 0.13]);

  // Cypress: the dark exclamation mark in every churchyard and windbreak.
  const cypress = vegGeo([
    vegRing(0.00, 0.045, S), vegRing(0.10, 0.070, S),
    vegRing(0.32, 0.105, S, 0.10), vegRing(0.66, 0.095, S, 0.10),
    vegRing(0.90, 0.060, S), vegRing(1.00, 0.010, S),
  ], S, 1, bark, [0.09, 0.17, 0.11]);

  // Olive: short, thick, gnarled, silver-green and much harder to set alight.
  const olive = vegGeo([
    vegRing(0.00, 0.14, S), vegRing(0.20, 0.10, S),
    vegRing(0.30, 0.44, S, 0.24), vegRing(0.58, 0.56, S, 0.22),
    vegRing(0.86, 0.40, S, 0.20), vegRing(1.00, 0.12, S),
  ], S, 2, [0.33, 0.29, 0.24], [0.36, 0.41, 0.30]);

  // Maquis: no trunk worth modelling, and the reason the whole coast goes up.
  const bush = vegGeo([
    vegRing(0.00, 0.42, B), vegRing(0.38, 0.58, B, 0.28),
    vegRing(0.74, 0.46, B, 0.26), vegRing(1.00, 0.10, B),
  ], B, 0, bark, [0.26, 0.30, 0.19]);

  return { pine, cypress, olive, bush };
}

/** Height range and canopy width per species, in metres. */
const VEG_SIZE = {
  pine: [7, 13, 1.9],
  cypress: [7, 14, 1.0],
  olive: [3.4, 5.4, 1.7],
  bush: [0.9, 2.2, 1.5],
};

function buildTrees(scene, fire) {
  const protos = vegPrototypes();
  const T = VEG.tile;

  const layers = {};
  for (const s of SPECIES) {
    const src = protos[s];
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', src.attributes.position);
    geo.setAttribute('normal', src.attributes.normal);
    geo.setAttribute('aVCol', src.attributes.aVCol);
    geo.setIndex(src.index);
    // Placed entirely by instance attributes, so the prototype's bounds mean
    // nothing — culling is done per tile on the CPU.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

    const cap = VEG.budget;
    const aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const aRot = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const aScale = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const aColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    for (const [n, a] of [['aInstPos', aPos], ['aInstRot', aRot],
      ['aInstScale', aScale], ['aInstColor', aColor]]) {
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(n, a);
    }

    const mat = solidMaterial(0xffffff, {
      instanced: true,
      spec: 0.03,
      specPower: 12,
      side: THREE.DoubleSide,
      // The prototype carries bark and leaf in its vertex colours; the per
      // instance colour is the individual's own tint and its charring.
      body: 'base *= vVCol;\n  n = gl_FrontFacing ? n : -n;',
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    layers[s] = { geo, mesh, aPos, aRot, aScale, aColor, count: 0 };
  }

  // ── tile generation ────────────────────────────────────────────────────────

  const tiles = new Map();
  const order = [];

  function makeTile(tx, tz) {
    // Deterministic from the tile coordinate: the same tree in the same place
    // every time you come back round.
    const rng = mulberry32((tx * 73856093 ^ tz * 19349663) >>> 0);
    const ox = tx * T, oz = tz * T;
    const out = { pine: [], cypress: [], olive: [], bush: [], n: 0 };

    for (let i = 0; i < VEG.perTile; i++) {
      const x = ox + rng() * T, z = oz + rng() * T;
      const c = coverAt(x, z);
      const table = GROWS[c];
      if (!table) continue;

      const r = rng();
      let acc = 0, pick = null;
      for (const s in table) { acc += table[s]; if (r < acc) { pick = s; break; } }
      if (!pick) continue;

      const y = groundAt(x, z);
      if (y < 0.4) continue;                       // the waterline, near enough

      // Nothing much stands on a cliff, and the karst is full of them.
      const nrm = normalAt(x, z, 12);
      if (nrm.y < 0.62 && pick !== 'bush') continue;
      if (nrm.y < 0.42) continue;

      const [lo, hi, wide] = VEG_SIZE[pick];
      const h = lo + rng() * (hi - lo);
      out[pick].push({
        x, y, z,
        h,
        w: h * wide * (0.78 + rng() * 0.44) / ((lo + hi) * 0.5),
        yaw: rng() * TAU,
        // Individual tint: some are drier, some greener, and a flat forest of
        // identical trees reads as a texture rather than as trees.
        tint: 0.80 + rng() * 0.34,
        warm: rng() * 0.16,
      });
      out.n++;
    }
    return out;
  }

  function tileAt(tx, tz) {
    const key = tx * 100000 + tz;
    let t = tiles.get(key);
    if (!t) {
      t = makeTile(tx, tz);
      tiles.set(key, t);
      order.push(key);
      while (order.length > VEG.maxTiles) tiles.delete(order.shift());
    }
    return t;
  }

  // ── repacking ──────────────────────────────────────────────────────────────

  let density = 1;
  let acc = 0, lastTx = 1e9, lastTz = 1e9, live = 0;
  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);

  function repack(camPos) {
    const cursor = {};
    for (const s of SPECIES) cursor[s] = 0;
    const cap = Math.floor(VEG.budget * clamp(density, 0, 2));
    const R = VEG.radius * clamp(0.4 + density * 0.6, 0.4, 1.3);
    const R2 = R * R;
    const t0 = Math.floor((camPos.x - R) / T), t1 = Math.floor((camPos.x + R) / T);
    const u0 = Math.floor((camPos.z - R) / T), u1 = Math.floor((camPos.z + R) / T);

    for (let tx = t0; tx <= t1; tx++) {
      for (let tz = u0; tz <= u1; tz++) {
        // Nearest point of the tile to the camera — a corner test would keep
        // whole tiles that only touch the circle at one vertex.
        const cx = clamp(camPos.x, tx * T, tx * T + T);
        const cz = clamp(camPos.z, tz * T, tz * T + T);
        if ((cx - camPos.x) ** 2 + (cz - camPos.z) ** 2 > R2) continue;

        const tile = tileAt(tx, tz);
        for (const s of SPECIES) {
          const L = layers[s];
          const list = tile[s];
          for (let i = 0; i < list.length; i++) {
            const c = cursor[s];
            if (c >= cap) break;
            const t = list[i];
            const dx = t.x - camPos.x, dz = t.z - camPos.z;
            const d2 = dx * dx + dz * dz;
            if (d2 > R2) continue;
            // Shrink them into the ground over the last fifth of the radius.
            // A hard cutoff draws a visible ring of forest on the hillside and
            // the eye finds it immediately.
            const fade = 1 - sat((Math.sqrt(d2) - R * 0.80) / (R * 0.20));
            if (fade < 0.02) continue;

            // How far through burning this one is. The fire grid is the truth;
            // the trees just read it.
            const char = fire ? fire.charAt(t.x, t.z) : 0;
            const alight = fire ? fire.intensityAt(t.x, t.z) : 0;
            const shrink = (1 - 0.40 * char) * (0.35 + 0.65 * fade);

            L.aPos.array[c * 3] = t.x;
            L.aPos.array[c * 3 + 1] = t.y;
            L.aPos.array[c * 3 + 2] = t.z;

            _q.setFromAxisAngle(_up, t.yaw);
            L.aRot.array[c * 4] = _q.x; L.aRot.array[c * 4 + 1] = _q.y;
            L.aRot.array[c * 4 + 2] = _q.z; L.aRot.array[c * 4 + 3] = _q.w;

            L.aScale.array[c * 3] = t.w * shrink;
            L.aScale.array[c * 3 + 1] = t.h * shrink;
            L.aScale.array[c * 3 + 2] = t.w * shrink;

            // Green, through scorched, to a black stick. A tree that is
            // actually alight goes dark first — you see the flame, not the
            // leaves, and the flame is drawn by 38-flames.
            const burnt = Math.max(char, alight * 0.8);
            const g = t.tint * (1 - 0.88 * burnt);
            L.aColor.array[c * 3] = g * (1 + t.warm + 0.25 * burnt);
            L.aColor.array[c * 3 + 1] = g;
            L.aColor.array[c * 3 + 2] = g * (1 - t.warm * 0.5);

            cursor[s] = c + 1;
          }
        }
      }
    }

    live = 0;
    for (const s of SPECIES) {
      const L = layers[s];
      L.count = cursor[s];
      live += L.count;
      L.geo.instanceCount = L.count;
      L.aPos.needsUpdate = true;
      L.aRot.needsUpdate = true;
      L.aScale.needsUpdate = true;
      L.aColor.needsUpdate = true;
      L.mesh.visible = L.count > 0;
    }
  }

  function update(dt, camPos) {
    if (density <= 0.001) {
      for (const s of SPECIES) layers[s].mesh.visible = false;
      return;
    }
    acc += dt;
    const tx = Math.floor(camPos.x / T), tz = Math.floor(camPos.z / T);
    // Repack when the camera crosses a tile, and otherwise slowly — the only
    // thing that changes in between is how burnt everything is.
    if (tx !== lastTx || tz !== lastTz || acc > 0.4) {
      acc = 0; lastTx = tx; lastTz = tz;
      repack(camPos);
    }
  }

  return {
    update,
    setDensity: (v) => { density = v; acc = 99; lastTx = 1e9; },
    getDensity: () => density,
    stats: () => ({ live, tiles: tiles.size }),
  };
}
