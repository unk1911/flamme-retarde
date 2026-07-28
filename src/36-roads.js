// -----------------------------------------------------------------------------
// The road network, which was already in the payload and was never drawn.
//
// 1 535 ways and 14 200 points come out of Overpass, get baked into
// roads.json.gz, get inflated at load — and then nothing read them. From the
// air a town is its roofs and the lines between them, and without the lines
// Šibenik was a rash of tile with no circulation.
//
// Ribbons are draped on the terrain: resampled to a short enough step to follow
// the ground, mitred at the joints, and lifted a few tens of centimetres so the
// coarser terrain LOD at distance cannot swallow them.
// -----------------------------------------------------------------------------

const ROADS = {
  step: 8,              // metres between draped samples
  lift: 0.45,           // above the ground, to survive terrain LOD
  miterLimit: 2.6,      // beyond this a hairpin gets a blunt joint, not a spike
  width: [0, 5.0, 7.0, 9.5, 12.0],   // by OSM rank 1..4
};

/**
 * Resample a polyline so no step is longer than `step`, dropping any run that
 * crosses water.
 *
 * The Šibenik bridge and the Jadrija causeway both cross the channel, and both
 * would be draped onto the sea surface — a road lying flat on the water reads
 * as a bug, where a road that simply stops at the shore reads as a road going
 * somewhere you cannot see. So water spans are cut, not faked. A real bridge
 * deck is geometry, not a draped ribbon, and belongs with the landmarks.
 */
function drapeRuns(pts, step) {
  const runs = [];
  let run = [];
  const flush = () => { if (run.length >= 2) runs.push(run); run = []; };

  const emit = (x, z) => {
    if (isSea(x, z)) { flush(); return; }
    run.push({ x, z, y: groundAt(x, z) + ROADS.lift });
  };

  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) emit(lerp(x0, x1, k / n), lerp(z0, z1, k / n));
  }
  const last = pts[pts.length - 1];
  emit(last[0], last[1]);
  flush();
  return runs;
}

function buildRoads(scene) {
  // Two buffers: the lanes that carry markings and the ones that do not. A
  // painted centre line down every residential lane in Jadrija would be wrong,
  // and it is the cheapest possible way to tell a road from a street.
  const bufs = {
    minor: { pos: [], norm: [], col: [], uv: [] },
    major: { pos: [], norm: [], col: [], uv: [] },
  };
  const rng = mulberry32(CONFIG.seed ^ 0x00b0ad);
  let drawn = 0, metres = 0;
  // Draping is the expensive part, so the runs are kept and handed to the prop
  // layer as lanes rather than being computed a second time for the traffic.
  const lanes = [];

  for (const way of world.roads) {
    const rank = clamp(way.r | 0, 1, 4);
    const halfW = ROADS.width[rank] * 0.5;
    const B = rank >= 2 ? bufs.major : bufs.minor;

    // Asphalt, but not one asphalt: resurfacing dates vary and a network in a
    // single grey reads as printed on.
    const g = 0.093 + rng() * 0.042;
    const col = [g * 1.06, g, g * 0.95];

    for (const run of drapeRuns(way.p, ROADS.step)) {
      // Mitred offsets: at each point the ribbon edge follows the average of
      // the two adjacent segment normals, lengthened by 1/cos of the half
      // angle so the outer edge stays parallel through a bend.
      const L = [], R = [], cum = [];
      let along = 0;
      for (let i = 0; i < run.length; i++) {
        const p = run[i];
        const a = run[Math.max(0, i - 1)];
        const b = run[Math.min(run.length - 1, i + 1)];
        let dx = b.x - a.x, dz = b.z - a.z;
        const dl = Math.hypot(dx, dz) || 1;
        dx /= dl; dz /= dl;
        let nx = -dz, nz = dx;

        // Widen the offset through the corner.
        if (i > 0 && i < run.length - 1) {
          const p0 = run[i - 1], p1 = run[i + 1];
          let ax = p.x - p0.x, az = p.z - p0.z;
          let bx2 = p1.x - p.x, bz2 = p1.z - p.z;
          const al = Math.hypot(ax, az) || 1, bl = Math.hypot(bx2, bz2) || 1;
          ax /= al; az /= al; bx2 /= bl; bz2 /= bl;
          const cosHalf = Math.sqrt(Math.max(0.02, (1 + (ax * bx2 + az * bz2)) * 0.5));
          const m = Math.min(ROADS.miterLimit, 1 / cosHalf);
          nx *= m; nz *= m;
        }
        if (i > 0) along += Math.hypot(p.x - run[i - 1].x, p.z - run[i - 1].z);
        cum.push(along);
        L.push([p.x - nx * halfW, p.y, p.z - nz * halfW, along]);
        R.push([p.x + nx * halfW, p.y, p.z + nz * halfW, along]);
      }
      metres += along;
      // Long enough to be worth putting a car on.
      if (along > 55) lanes.push({ run, cum, len: along, rank });

      // uv.x runs 0..1 across the ribbon, uv.y is metres along it.
      const vert = (p, u) => {
        B.pos.push(p[0], p[1], p[2]);
        // Flat up-normal: the ribbon is thin enough that the terrain's own
        // shading under it is the wrong cue anyway, and a road should not go
        // dark on a north slope while the ground beside it stays lit.
        B.norm.push(0, 1, 0);
        B.col.push(col[0], col[1], col[2]);
        B.uv.push(u, p[3]);
      };
      for (let i = 0; i < run.length - 1; i++) {
        const l0 = L[i], r0 = R[i], l1 = L[i + 1], r1 = R[i + 1];
        // Two triangles, wound so the face points up.
        vert(l0, 0); vert(r0, 1); vert(r1, 1);
        vert(l0, 0); vert(r1, 1); vert(l1, 0);
      }
      drawn++;
    }
  }

  const body = (marked) => /* glsl */ `
    base *= vVCol;
    float across = abs(vUv.x * 2.0 - 1.0);
    // Worn pale at the edges where the tyres never run, and dusty at the very
    // margin where the karst blows across it.
    base *= 1.0 + 0.30 * smoothstep(0.30, 0.95, across);
    base = mix(base, vec3(0.30, 0.28, 0.25),
               smoothstep(0.88, 1.0, across) * 0.55);
    // Coarse aggregate, so a road is not a flat swatch when you fly low.
    base *= 0.88 + 0.24 * fbm2(vWorld.xz * 2.4, 2);
    ${marked ? `
    // A broken centre line: 3 m of paint, 6 m of gap.
    float dash = step(0.66, fract(vUv.y / 9.0));
    float centre = 1.0 - smoothstep(0.02, 0.10, across);
    base = mix(base, vec3(0.62, 0.60, 0.54), centre * dash * 0.85);` : ''}
  `;

  const mk = (B, marked) => {
    if (!B.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(B.norm, 3));
    g.setAttribute('aVCol', new THREE.Float32BufferAttribute(B.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const m = new THREE.Mesh(g, solidMaterial(0xffffff, {
      spec: 0.03, specPower: 16, body: body(marked),
    }));
    m.frustumCulled = false;
    // The ribbon and the terrain are two different tessellations of the same
    // hillside, so bias this one toward the camera as well as lifting it.
    m.material.polygonOffset = true;
    m.material.polygonOffsetFactor = -4;
    m.material.polygonOffsetUnits = -8;
    m.renderOrder = -1;
    scene.add(m);
    return m;
  };

  const minor = mk(bufs.minor, false);
  const major = mk(bufs.major, true);
  return {
    minor, major, drawn, lanes,
    km: metres / 1000,
    tris: (bufs.minor.pos.length + bufs.major.pos.length) / 9,
  };
}
