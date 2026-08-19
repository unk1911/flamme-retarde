// -----------------------------------------------------------------------------
// What is actually on the bottom.
//
// The seabed had a problem that no amount of shading was ever going to fix,
// and the last pass at it proved that by fixing everything else. It got ripple
// marks, boulder relief, weed mottling and a normal that the light moves
// across — and it still read flat, because every one of those is paint. The
// terrain under it is a 6.35 m height texel drawn at a 5 m quad: at swimming
// range that is one flat triangle underneath you, and a flat triangle with a
// beautiful picture on it is a floor with a rug.
//
// You cannot displace your way out of it either. Getting geometric relief at
// the scale a swimmer sees would mean a height field two orders of magnitude
// finer over the whole 13 km world, which is not a seabed, it is a second
// terrain system.
//
// So: put things on it. This is what actually makes a bottom read as a bottom,
// and it is what is genuinely down there off Jadrija — bare karst limestone
// broken into blocks, and between the blocks the posidonia, which is the thing
// that makes the Adriatic the Adriatic. Neither of them is subtle and neither
// of them is expensive: two hundred-odd lumps and three hundred-odd clumps,
// instanced, inside the twenty metres you can see through.
//
// Placed by hash off a fixed world grid rather than scattered around the
// camera, which is the one decision in here that matters. The fish may be
// re-placed behind you because a fish that moves is a fish; a rock that moves
// is the game admitting it. Look away from a boulder and back at it and it is
// the same boulder, in the same place, at the same angle, because its position
// is a function of the cell it is in and nothing else.
// -----------------------------------------------------------------------------

const BEDROCK = {
  // How far out to populate. The extinction has everything by about eighteen
  // metres, so twenty-six is a comfortable margin and the edge of the field is
  // never a place you can watch things arrive at.
  reach: 26,
  cell: 3.0,           // m — one candidate of each kind per cell
  // Stones. There are a great many more of these than there are boulders and
  // that is not a stylistic choice — a limestone bottom is broken rock, and
  // what it is mostly broken into is fist-sized. They are the layer that makes
  // the bed stop being a surface: a hundred small solids with their own
  // shadows, at the scale your eye uses to judge how far away a floor is.
  gravelCap: 620,
  // How far you may travel before the field is worked out again. Two metres of
  // swimming at 1.15 m/s is under two seconds, and a rebuild is a few hundred
  // height lookups — cheaper than one frame of the trees.
  refresh: 2.0,
  rockCap: 190,        // per variant
  weedCap: 1150,
  clump: 6,            // weed clumps per cell that grows any
};

/**
 * A boulder.
 *
 * An icosahedron pushed about by three lobes of trigonometry and then squashed,
 * because a rock on a seabed is wider than it is tall — it has been lying that
 * way since the last ice age and the sea has taken the top off it. Kept
 * non-indexed and re-normalled flat: karst breaks along bedding planes and
 * comes apart in blocks, so faceted is not a compromise here, it is the shape.
 *
 * Three of them are built with different seeds. Instancing gives one geometry
 * per draw, and one lump under every rotation in the world still reads as one
 * lump repeated — the eye finds the silhouette long before it finds the
 * colour. Three costs two extra draw calls and buys a beach.
 */
function bedBoulder(seed) {
  // Two subdivisions rather than one. At one, a rock you can swim up to is
  // eighty facets across a metre and a half and the facets are the first
  // thing you see; karst is angular but it is not a d20.
  const g = new THREE.IcosahedronGeometry(0.5, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const l = Math.hypot(x, y, z) || 1;
    const nx = x / l, ny = y / l, nz = z / l;
    // Displacement is a function of the *direction* only, so the duplicated
    // vertices a non-indexed polyhedron shares along every edge all move to
    // the same place and the solid stays closed.
    let r = 1
      + 0.26 * Math.sin(nx * 3.1 + seed) * Math.cos(nz * 2.7 - seed * 1.7)
      + 0.17 * Math.sin(ny * 4.3 - seed * 2.1)
      + 0.11 * Math.sin((nx + nz) * 6.1 + seed * 3.3)
      + 0.07 * Math.cos((ny - nx) * 8.7 + seed * 5.1);
    // Flatter across the top and bottom than across the middle.
    r *= 1 - 0.24 * ny * ny;
    p.setXYZ(i, nx * r * 0.5, ny * r * 0.36, nz * r * 0.5);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * One clump of posidonia.
 *
 * Ribbon blades off a common root, each leaning a different way and arcing
 * over as it goes up — a blade is not a spike, it is a strap that stands up
 * because it is buoyant and lies over because it is long. Fourteen of them,
 * which is about what one shoot carries, with the root end dark and half
 * buried in its own litter and the tip end the pale olive that the light
 * actually reaches.
 *
 * Vertex colour carries root-to-tip; the instance colour carries clump-to-
 * clump, so a meadow is not one shade of anything.
 */
function bedWeed(seed) {
  const S = 4, BL = 30;
  const pos = [], col = [], idx = [];
  let n = 0;
  // Its own generator, so a clump is the same clump every time the file loads
  // and the two builds of the same seed agree.
  let st = seed * 9301 + 49297;
  const rnd = () => ((st = (st * 9301 + 49297) % 233280) / 233280);

  const ROOT = [0.116, 0.128, 0.070], TIP = [0.360, 0.430, 0.180];

  for (let b = 0; b < BL; b++) {
    const a = rnd() * Math.PI * 2;
    const lean = 0.30 + rnd() * 0.70;
    // Shorter and many more of them. The first pass ran to eighty centimetres
    // on fourteen blades off a root the size of a coin, and eighty centimetres
    // of anything at that spacing is not a meadow, it is a stand of bamboo —
    // you could see the bottom between every blade. Posidonia off this coast
    // is knee-high at most and grows in a mat you cannot see through.
    const h = 0.17 + rnd() * 0.27;
    const rr = Math.sqrt(rnd()) * 0.10;
    const ca = Math.cos(a), sa = Math.sin(a);
    // Across the blade, square to the plane it bends in.
    const wx = -sa, wz = ca;
    let cx = rr * ca, cy = 0, cz = rr * sa, dir = 0;
    const step = h / S;
    const first = n;
    for (let s = 0; s <= S; s++) {
      const t = s / S;
      const w = 0.0195 * (1 - 0.48 * t);
      for (const sgn of [-1, 1]) {
        pos.push(cx + wx * w * sgn, cy, cz + wz * w * sgn);
        col.push(ROOT[0] + (TIP[0] - ROOT[0]) * t,
          ROOT[1] + (TIP[1] - ROOT[1]) * t,
          ROOT[2] + (TIP[2] - ROOT[2]) * t);
        n++;
      }
      if (s < S) {
        const o = first + s * 2;
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
      // Integrated rather than solved: the tangent turns by a fixed amount per
      // station, which is a blade of constant stiffness and is why the arc
      // tightens toward the tip instead of being a circle.
      dir += lean / S;
      cx += Math.sin(dir) * step * ca;
      cz += Math.sin(dir) * step * sa;
      cy += Math.cos(dir) * step;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aVCol', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A stable hash for a cell. Integer in, 0..1 out, and the same answer for the
 * same cell for the lifetime of the world.
 */
function bedHash(i, j, k) {
  let h = (i * 374761393 + j * 668265263 + k * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function buildBed(scene) {
  const uSway = { value: 0 };

  const rockGeos = [bedBoulder(1.7), bedBoulder(4.9), bedBoulder(8.3)];
  const rockMat = solidMaterial(new THREE.Color(1, 1, 1), {
    instanced: true, vcol: false, spec: 0.05, specPower: 18,
    // Karst underwater is not grey. It is pale where it is bare, and where it
    // is not bare it is under a film of turf algae that goes brown-green and
    // sits on the up-faces, because that is where the light is. So the tint is
    // hung off the world normal rather than painted on: the top of every rock
    // in the field darkens and the overhangs stay pale, which is most of what
    // tells you a rock is a solid and not a decal.
    body: `
      float up = clamp(vNormal.y, 0.0, 1.0);
      // Browner and a good deal lighter-handed than the first pass, which took
      // pale limestone all the way to 0.46,0.56,0.36 and then had the water
      // put another green over the top of that. The result was jade. Turf
      // algae is a brown film, and the rock under it is meant to keep winning.
      base = mix(base, base * vec3(0.60, 0.58, 0.40), up * up * 0.40);
      base *= 0.88 + 0.24 * fract(sin(dot(floor(vWorld.xz * 3.0),
        vec2(12.9898, 78.233))) * 43758.5453);
    `,
  });
  const weedMat = solidMaterial(new THREE.Color(1, 1, 1), {
    instanced: true, spec: 0.16, specPower: 30,
    side: THREE.DoubleSide,
    uniforms: { uSway },
    decl: 'uniform float uSway;',
    // The surge, and it is a surge and not a breeze. Weather moves air in
    // gusts that travel; a swell moves the whole column back and forth
    // together, so a meadow leans one way, stops, and leans the other, and
    // every clump in sight does it at once. The phase offset off the instance
    // position is small on purpose — enough that the field is not a single
    // rigid object, not so much that it stops being one water.
    vert: `
      float hgt = clamp(p.y / 0.42, 0.0, 1.0);
      float ph = dot(aInstPos.xz, vec2(0.021, 0.017));
      float s = sin(uSway * 0.62 + ph) * 0.62 + sin(uSway * 0.37 + ph * 1.9) * 0.28;
      // Quadratic in height, so the root stays where it is planted and the tip
      // does all the travelling — which is what being anchored looks like.
      p.x += s * hgt * hgt * 0.13;
      p.z += s * 0.62 * hgt * hgt * 0.13;
    `,
    body: 'base *= vVCol;',
  });

  const layers = [];
  const mk = (geo, mat, cap) => {
    const g = new THREE.InstancedBufferGeometry();
    for (const k of ['position', 'normal', 'aVCol']) {
      if (geo.attributes[k]) g.setAttribute(k, geo.attributes[k]);
    }
    g.setIndex(geo.index);
    // Never culled: the field is placed around the camera and the bounding
    // sphere of an instanced geometry is the *source* geometry's, which for a
    // half-metre rock is half a metre at the origin.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const a = {
      pos: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
      rot: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4),
      scl: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
      col: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
    };
    for (const [n2, at] of [['aInstPos', a.pos], ['aInstRot', a.rot],
      ['aInstScale', a.scl], ['aInstColor', a.col]]) {
      at.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(n2, at);
    }
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = -1;
    scene.add(mesh);
    const L = { geo: g, mesh, a, cap, n: 0 };
    layers.push(L);
    return L;
  };

  const rocks = rockGeos.map((g) => mk(g, rockMat, BEDROCK.rockCap));
  // Twenty faces each and six hundred of them: twelve thousand triangles for
  // the whole gravel field, which is four thousandths of one frame. There is
  // no argument against having it.
  const gravel = [0, 1, 2].map((i) =>
    mk(new THREE.IcosahedronGeometry(0.5, 0),
      rockMat, BEDROCK.gravelCap / 3 | 0));
  const weed = mk(bedWeed(3.1), weedMat, BEDROCK.weedCap);

  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();

  function put(L, x, y, z, qx, qy, qz, qw, sx, sy, sz, r, g, b) {
    if (L.n >= L.cap) return;
    const i = L.n++;
    L.a.pos.array[i * 3] = x; L.a.pos.array[i * 3 + 1] = y;
    L.a.pos.array[i * 3 + 2] = z;
    L.a.rot.array[i * 4] = qx; L.a.rot.array[i * 4 + 1] = qy;
    L.a.rot.array[i * 4 + 2] = qz; L.a.rot.array[i * 4 + 3] = qw;
    L.a.scl.array[i * 3] = sx; L.a.scl.array[i * 3 + 1] = sy;
    L.a.scl.array[i * 3 + 2] = sz;
    L.a.col.array[i * 3] = r; L.a.col.array[i * 3 + 1] = g;
    L.a.col.array[i * 3 + 2] = b;
  }

  let builtX = 1e9, builtZ = 1e9;

  function rebuild(cx, cz) {
    for (const L of layers) L.n = 0;
    const C = BEDROCK.cell, R = BEDROCK.reach;
    const i0 = Math.floor((cx - R) / C), i1 = Math.floor((cx + R) / C);
    const j0 = Math.floor((cz - R) / C), j1 = Math.floor((cz + R) / C);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        // Jittered off the lattice, or the whole bottom is a chessboard.
        const px = (i + 0.5 + (bedHash(i, j, 1) - 0.5) * 0.9) * C;
        const pz = (j + 0.5 + (bedHash(i, j, 2) - 0.5) * 0.9) * C;
        if (Math.hypot(px - cx, pz - cz) > R) continue;
        const bed = groundAt(px, pz);
        // Nothing above the waterline and nothing in the wash: the first half
        // metre is where the swell scours and it is bare sand there in life.
        if (bed > -0.8) continue;

        // Two samples rather than four. The bottom is smooth at this scale by
        // construction — that is the whole complaint — so the gradient is
        // worth having and worth having cheaply.
        const sl = Math.hypot(groundAt(px + 1.5, pz) - bed,
          groundAt(px, pz + 1.5) - bed) / 1.5;

        // Where the meadow is. A coarse hash on nine-metre blocks, which is
        // roughly the scale posidonia actually grows at — beds with sand
        // channels between them, not a lawn.
        const patch = bedHash(Math.floor(i / 3), Math.floor(j / 3), 7);
        // Rock likes slope and likes the shallows; weed wants the flats and
        // will not grow past the light, which off here is about fifteen metres.
        const rocky = Math.min(1, sl * 2.6) * 0.55 + 0.22
          + 0.30 * Math.max(0, 1 + bed / 9);
        const grassy = (1 - Math.min(1, sl * 3.4))
          * Math.max(0, Math.min(1, (-bed - 0.9) / 1.4))
          * Math.max(0, Math.min(1, (16 + bed) / 5));

        // Gravel first, and nearly everywhere. Four to twenty-five
        // centimetres, which is the size range that reads as ground rather
        // than as objects sitting on ground.
        for (let k = 0; k < 3; k++) {
          const hg = bedHash(i * 11 + k, j * 5, 20);
          if (hg > 0.72) continue;
          const gx = px + (bedHash(i, j * 9 + k, 21) - 0.5) * C;
          const gz = pz + (bedHash(i * 5 + k, j, 22) - 0.5) * C;
          const gb = groundAt(gx, gz);
          if (gb > -0.6) continue;
          const gs = 0.13 + 0.34 * hg * hg;
          _e.set((bedHash(i + k, j, 23) - 0.5) * 1.4,
            bedHash(i, j + k, 24) * Math.PI * 2,
            (bedHash(i * 2, j + k, 25) - 0.5) * 1.4, 'YXZ');
          _q.setFromEuler(_e);
          // Sat proud, plus a flat six centimetres, which is the opposite of
          // what a stone does and is right anyway. The height this is placed
          // against is the sampled bed; what gets drawn is a five-metre quad
          // cutting through it, and on any slope the two disagree by more than
          // a small stone is tall — so the first pass placed six hundred
          // stones and you could see none of them. The boulders never noticed
          // because a boulder is bigger than the error. A proportional lift
          // does not fix it either: the error does not get smaller when the
          // stone does, which is the whole of why it eats the small ones.
          const gp = 0.38 + 0.22 * bedHash(i * 3, j + k, 26);
          put(gravel[(bedHash(i, j + k, 27) * 3) | 0],
            gx, gb + gs * 0.34 + 0.14, gz, _q.x, _q.y, _q.z, _q.w,
            gs * 1.25, gs * 0.68, gs * 1.10, gp, gp * 0.99, gp * 0.91);
        }

        if (bedHash(i, j, 3) < rocky * 0.72) {
          const h4 = bedHash(i, j, 4), h5 = bedHash(i, j, 5);
          const L = rocks[(bedHash(i, j, 9) * 3) | 0];
          // Blocks, not pebbles: 0.35 m to about 2 m across, weighted small,
          // because a bottom of uniformly big rocks is a quarry.
          // 0.28 m to about 1.1 m, weighted small. The first pass went to two
          // metres before the per-axis stretch and then to nearly three after
          // it, and a three-metre boulder at arm's length is not a seabed, it
          // is a wall you have swum into.
          const s = 0.26 + 0.68 * h4 * h4;
          _e.set((h5 - 0.5) * 0.7, bedHash(i, j, 6) * Math.PI * 2,
            (bedHash(i, j, 8) - 0.5) * 0.7, 'YXZ');
          _q.setFromEuler(_e);
          // Sunk by a third. Every rock that has been there any length of time
          // has silted in, and a rock resting exactly on a surface is the
          // oldest tell in the business.
          // Darker than it looks in air. Nine metres down there is a tenth of
          // the surface light left and limestone at a tenth of the light is a
          // grey-green solid, not the white it is on the shore — the first
          // pass had them at 0.6 to 0.86 and they came out as jade cliffs.
          const pale = 0.36 + 0.22 * bedHash(i, j, 10);
          put(L, px, bed + s * 0.36 * 0.62 - s * 0.13, pz,
            _q.x, _q.y, _q.z, _q.w,
            s * (0.78 + 0.38 * h5), s * (0.62 + 0.42 * h4), s * (0.78 + 0.38 * h4),
            pale, pale * 0.99, pale * 0.90);
        }

        if (patch > 0.24 && grassy > 0.04) {
          for (let k = 0; k < BEDROCK.clump; k++) {
            const hk = bedHash(i * 7 + k, j, 11);
            if (hk > grassy * (patch - 0.15) * 3.1) continue;
            const ox = (bedHash(i, j * 5 + k, 12) - 0.5) * C * 0.9;
            const oz = (bedHash(i * 3 + k, j, 13) - 0.5) * C * 0.9;
            const bx = px + ox, bz = pz + oz;
            const by = groundAt(bx, bz);
            if (by > -0.8) continue;
            _e.set(0, bedHash(i + k, j, 14) * Math.PI * 2, 0, 'YXZ');
            _q.setFromEuler(_e);
            const sc = 0.72 + 0.55 * bedHash(i, j + k, 15);
            const tint = 0.82 + 0.34 * bedHash(i * 2, j + k, 16);
            put(weed, bx, by - 0.04, bz, _q.x, _q.y, _q.z, _q.w,
              sc, sc * (0.85 + 0.4 * hk), sc,
              tint, tint * 1.04, tint * 0.86);
          }
        }
      }
    }
    for (const L of layers) {
      L.geo.instanceCount = L.n;
      for (const k of ['pos', 'rot', 'scl', 'col']) L.a[k].needsUpdate = true;
    }
    builtX = cx; builtZ = cz;
  }

  function update(camera, on) {
    for (const L of layers) L.mesh.visible = on;
    if (!on) return;
    const cx = camera.position.x, cz = camera.position.z;
    if (Math.hypot(cx - builtX, cz - builtZ) > BEDROCK.refresh) rebuild(cx, cz);
    uSway.value = U.uTime.value;
  }

  return {
    update,
    stats: () => ({
      rocks: rocks.reduce((n, L) => n + L.n, 0),
      gravel: gravel.reduce((n, L) => n + L.n, 0),
      weed: weed.n,
      at: [Math.round(builtX), Math.round(builtZ)],
    }),
  };
}
