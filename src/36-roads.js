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
 * The one place on this coast that has no cars in it.
 *
 * OSM tags the strip behind Jadrija's terraces as a road, and the road layer
 * duly draped a 5 m carriageway down it and the prop layer duly parked on it.
 * It is not a road. It is the walk between the huts and the water, and putting
 * traffic on it is the single loudest wrong note in the whole locale — the
 * place is a bathing station you arrive at by boat or on foot, and the only
 * vehicles that ever reach it stop at the top of the lane by the pier.
 *
 * A capsule about the traced frontage rather than a circle about its middle:
 * the shore runs 31° off the x axis and a circle wide enough to cover both ends
 * would reach 60 m further inland than anything needs to. 62 m out from the
 * line covers the terraces, both rows of kabine, and the first lane behind
 * them, and leaves the rest of Srima's network alone — the village is meant to
 * be seen from the air with its streets in it.
 *
 * The two ends are `toWorld(0, 0)` and `toWorld(LEN, 0)` off the traced shore,
 * written here as constants because the road layer is built long before the
 * locale exists and a road that appears when you fly to Jadrija is worse than
 * one that was never drawn.
 */
const JAD_QUIET = { x0: -2296, z0: 260.4, x1: -2134, z1: 355.6, r: 62 };

function nearJadrija(x, z, extra = 0) {
  const ex = JAD_QUIET.x1 - JAD_QUIET.x0, ez = JAD_QUIET.z1 - JAD_QUIET.z0;
  const L2 = ex * ex + ez * ez;
  const u = clamp(((x - JAD_QUIET.x0) * ex + (z - JAD_QUIET.z0) * ez) / L2, 0, 1);
  const dx = x - (JAD_QUIET.x0 + ex * u), dz = z - (JAD_QUIET.z0 + ez * u);
  const r = JAD_QUIET.r + extra;
  return dx * dx + dz * dz < r * r;
}

/**
 * AND WHAT THE LANES AT JADRIJA ARE MADE OF, WHICH IS NOT ASPHALT.
 *
 * Misha, 1 Oct 2026: *"there are these black roads in the back of the
 * kabine, jadrija doesn't have black roads, everything is gravel road"*.
 * Every OSM way on this headland is named for it — "Jadrija I" to
 * "Jadrija IX", nineteen of them inside a kilometre of the huts and nothing
 * else in that box — and every one of them was drawn in the one asphalt the
 * whole coast gets, at 0.09-0.14, which is black. They are drawn now as what
 * the aerial (0:44-0:50) and his own stills have round the rows: pale warm
 * crushed limestone, two wheel tracks pressed darker and smoother, loose
 * stone heaped at the margins, dust over all of it. See `GRAVEL_GLSL`.
 *
 * ONE STAYS TARMAC, AND THE PHOTOGRAPH SAYS SO. `survey/4/1000150353` is
 * stood on the verge of the car park looking along the road past the
 * playground — that is "Jadrija IX", the through road from the village to the
 * marina — and it is asphalt: a crumbling edge, a kerb line, a car on it.
 * Not black, though: twenty summers have taken it to a mid grey, and the
 * aerial at 0:46 shows the same pale band. So it keeps the tarmac body and
 * takes that grey (`pale`). Take its name out of `tarmac` and it is gravel
 * like the rest.
 */
const JAD_GRAVEL = {
  name: /^Jadrija\b/,
  tarmac: new Set(['Jadrija IX']),
  // The stone, as albedo: the playground pad's raked gravel off `_349`
  // (0.470/0.440/0.378, see GROUNDS in 43-jadrija.js), a step paler — a lane
  // is swept by tyres and dried white where the pad is shaded by pines. The
  // first cut at 0.585 read as snow under this sun.
  col: [0.480, 0.442, 0.362],
  // And the through road's weathered asphalt.
  pale: [0.318, 0.310, 0.294],
};

/**
 * GRAVEL, as a fragment body: `base` in, `base` out.
 *
 * Read by three meshes — the Jadrija lanes here, and the resort's own made
 * ground and paths in 43-jadrija.js — so it is a string and not a material:
 * each caller says where its position is (`gp`, world xz) and how worn the
 * spot is (`track` 0..1: pressed by tyres, darker and finer; `loose` 0..1:
 * thrown to the margin, paler and coarser).
 *
 * THREE SCALES AND NO GRATING. A sum of sines here would be the corduroy the
 * sea ripples were for eight months (see `no-varying-coefficient`, and
 * `nothing-beats-a-wrong-pattern` in the notes), so every layer is value
 * noise or cells, at constant frequency on the absolute position:
 *
 *   patches, 4-12 m: where the dust lies thick and where it has been swept;
 *   clumps, about a metre: stone gathered in the low spots;
 *   the stones themselves, ~4 cm cells, each its own tone with a dark joint
 *   between it and the next, and one in a dozen a white limestone chip.
 *
 * The stones fade out on their own pixel footprint (`fwidth`), toward their
 * MEAN rather than toward nothing, so a lane does not brighten or darken as
 * you walk away from it and nothing crawls at distance. Inline rather than a
 * function because `decl` lands above GLSL_NOISE in `solidFragment`, and the
 * noise is what it is built from. No backticks in here.
 */
function gravelGLSL(gp, track, loose) {
  return /* glsl */ `
  {
    vec2 gp = ${gp};
    float gTrack = clamp(${track}, 0.0, 1.0);
    float gLoose = clamp(${loose}, 0.0, 1.0);
    float pm = fbm2(gp * 0.17 + vec2(3.1, 7.7), 3);
    float cl = vnoise2(gp * 1.25 + vec2(11.0, 2.0));
    // The stones, about 34 to the metre, on cells — and not every cell is
    // one: a third of them are the dust the stones sit in, which is what
    // stops the cells reading as a laid mosaic. They live only as long as a
    // pixel is smaller than about a third of one.
    vec2 fw = fwidth(gp);
    float foot = max(fw.x, fw.y) * 34.0;
    float sd = 1.0 - smoothstep(0.22, 0.85, foot);
    float st = 0.0, gap = 0.20;
    if (sd > 0.0) {
      vec2 q = gp * 34.0;
      vec2 ci = floor(q), cf = fract(q);
      float d1 = 9.0, d2 = 9.0, tone = 0.5;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 o = vec2(float(x), float(y));
          vec2 c = ci + o;
          vec2 r = o + 0.10 + 0.80 * vec2(h21(c), h21(c + 37.13)) - cf;
          float dd = dot(r, r);
          if (dd < d1) { d2 = d1; d1 = dd; tone = h21(c + 71.31); }
          else if (dd < d2) { d2 = dd; }
        }
      }
      float e = sqrt(d2) - sqrt(d1);
      float isStone = step(0.34, tone);
      gap = isStone * (1.0 - smoothstep(0.02, 0.13, e));
      st = isStone * ((tone - 0.67) * 1.6 + step(0.93, tone) * 0.55);
    }
    // Pressed stone is smaller, flatter and full of dust: less of every
    // kind of contrast, and a little darker. Loose stone the other way.
    float con = mix(1.0, 0.45, gTrack) * (1.0 + 0.55 * gLoose);
    float stone = sd * con * ((st - 0.03) * 0.22 - (gap - 0.20) * 0.16);
    vec3 g = base;
    g *= 0.84 + 0.30 * pm;
    g *= 0.92 + 0.16 * cl * (1.0 - 0.5 * gTrack);
    // AND THE GRAIN BETWEEN THE TWO, which is what a gravel reads as from
    // five to forty metres, where the stones are already under a pixel:
    // the tone of a hand's breadth of it, two octaves of value noise at a
    // sixth and a fifteenth of a metre, each out on its own footprint and
    // each a mean-zero term so nothing brightens as it fades.
    float k1 = 1.0 - smoothstep(0.30, 0.95, max(fw.x, fw.y) * 6.0);
    float k2 = 1.0 - smoothstep(0.30, 0.95, max(fw.x, fw.y) * 15.0);
    float gr = k1 * (vnoise2(gp * 6.0 + vec2(1.7, 5.3)) - 0.5) * 0.20
      + k2 * (vnoise2(gp * 15.0 + vec2(9.1, 0.4)) - 0.5) * 0.22;
    g *= 1.0 + gr * mix(1.0, 0.55, gTrack);
    g *= 1.0 + stone;
    g *= mix(1.0, 0.86, gTrack) * mix(1.0, 1.07, gLoose);
    // And dust over the lot: a little of the colour taken out toward its
    // own grey, more where it lies thick.
    float lum = dot(g, vec3(0.30, 0.50, 0.20));
    base = mix(g, vec3(lum) * vec3(1.08, 1.0, 0.86), 0.06 + 0.12 * smoothstep(0.45, 0.8, pm));
  }
  `;
}

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
  // OSM ways run past the edge of the box and bake.py keeps 400 m of margin, but
  // there is no terrain out there — groundAt() clamps to the edge texel and hands
  // back a height for ground that is not drawn, so a way leaving the world used
  // to carry on as a ribbon floating over the open sea plane.
  const EDGE = CONFIG.world / 2 - 40;

  const emit = (x, z) => {
    if (isSea(x, z) || Math.abs(x) > EDGE || Math.abs(z) > EDGE) { flush(); return; }
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
    // And the lanes of Jadrija, which are gravel — see JAD_GRAVEL.
    gravel: { pos: [], norm: [], col: [], uv: [] },
  };
  const rng = mulberry32(CONFIG.seed ^ 0x00b0ad);
  let drawn = 0, metres = 0;
  // Draping is the expensive part, so the runs are kept and handed to the prop
  // layer as lanes rather than being computed a second time for the traffic.
  const lanes = [];

  for (const way of world.roads) {
    const rank = clamp(way.r | 0, 1, 4);
    const halfW = ROADS.width[rank] * 0.5;
    const jad = !!(way.n && JAD_GRAVEL.name.test(way.n));
    const gravel = jad && !JAD_GRAVEL.tarmac.has(way.n);
    const B = gravel ? bufs.gravel : rank >= 2 ? bufs.major : bufs.minor;

    // Asphalt, but not one asphalt: resurfacing dates vary and a network in a
    // single grey reads as printed on. The draw is made for every way, the
    // gravel ones included, so no other way's grey moves.
    const g = 0.093 + rng() * 0.042;
    const col = gravel
      ? JAD_GRAVEL.col.map((c) => c * (0.97 + (g - 0.093) / 0.042 * 0.06))
      : jad ? JAD_GRAVEL.pale : [g * 1.06, g, g * 0.95];

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
      // Long enough to be worth putting a car on — and not in Jadrija, where a
      // wider berth than the tarmac gets: a car parked 70 m up the lane is
      // still a car you can see from the promenade.
      const quiet = run.some((p) => nearJadrija(p.x, p.z, 45));
      if (along > 55 && !quiet) lanes.push({ run, cum, len: along, rank });

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
        // Per quad rather than per way, so a lane that runs down into Jadrija
        // stops at the edge of the quiet zone instead of vanishing whole.
        const mx = (run[i].x + run[i + 1].x) * 0.5;
        const mz = (run[i].z + run[i + 1].z) * 0.5;
        if (nearJadrija(mx, mz)) continue;
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

  // The gravel lane. Two wheel tracks either side of a loose crown, the
  // margins heaped with what the tyres threw there, and an edge that is
  // where the stone gave out rather than a line somebody cut — see
  // `gravelGLSL`. The tracks are a fixed fraction of the width: every lane
  // here is rank 1, 5 m, and a car's track is 1.5 m.
  const gravelBody = /* glsl */ `
    base *= vVCol;
    float across = abs(vUv.x * 2.0 - 1.0);
    // The edge, ragged on a metre scale: past it, nothing is drawn and the
    // ground underneath is the edge.
    float rag = 0.90 + 0.10 * (vnoise2(vWorld.xz * 0.9 + vec2(4.0, 9.0)) - 0.5) * 2.0;
    if (across > rag) discard;
    float wob = 0.05 * (vnoise2(vec2(vUv.y * 0.11, 3.0)) - 0.5);
    float trk = 1.0 - smoothstep(0.09, 0.17, abs(across - 0.31 - wob));
    float lse = smoothstep(rag - 0.26, rag - 0.02, across)
      + 0.45 * (1.0 - smoothstep(0.05, 0.16, across));
    ${gravelGLSL('vWorld.xz', 'trk', 'lse')}
  `;

  const mk = (B, marked, gravel) => {
    if (!B.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(B.norm, 3));
    g.setAttribute('aVCol', new THREE.Float32BufferAttribute(B.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const m = new THREE.Mesh(g, solidMaterial(0xffffff, {
      spec: gravel ? 0.015 : 0.03, specPower: 16, body: gravel ? gravelBody : body(marked),
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
  const gravel = mk(bufs.gravel, false, true);
  return {
    minor, major, gravel, drawn, lanes,
    km: metres / 1000,
    tris: (bufs.minor.pos.length + bufs.major.pos.length + bufs.gravel.pos.length) / 9,
  };
}
