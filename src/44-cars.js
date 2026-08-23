/**
 * The cars parked in the wood behind Jadrija.
 *
 * The geometry is baked by `tools/blender/cars.py` — five body types, two
 * blobs each — and everything in this file is about getting them onto the
 * ground facing the right way. The shore build in `src/43-jadrija.js` decides
 * *where* each one stands, because that is a question about the shore: which
 * bands of `t` are clear of the shops, how far inland a car can be before it is
 * standing in somebody's front room, and where the playground railing is. This
 * file decides what model turns up, what colour it is painted, and how the
 * whole row gets drawn in ten calls.
 *
 * ── two layers per model ──────────────────────────────────────────────────
 *
 * `SOLID_VERT` does `vColor = aInstColor` for an instanced draw and the
 * fragment stage does `base = uBase * vColor` and then `base *= vVCol`. So the
 * per-instance colour multiplies every vertex colour in the mesh, and one blob
 * per car would mean picking dark blue for a car and getting dark blue
 * headlamps, dark blue glass and dark blue tyres with it. `carNearProto` in
 * `src/37-props.js` has exactly that flaw and gets away with it because its
 * lamps are three boxes seen at 300 m; these are seen from two.
 *
 * So each model gets two instanced layers over the same instance list. The
 * `body` layer carries a mesh whose vertex colours are all white and an
 * `aInstColor` holding the paint. The `trim` layer carries glass, tyres, rims,
 * bumpers, lamps, plates, the underside and the roof furniture in their own
 * colours, with `aInstColor` left at 1.0 so nothing tints them.
 *
 * ── why it does not borrow the town's layer ───────────────────────────────
 *
 * `propLayer` itself is reused as-is: it takes a `BufferGeometry` carrying
 * position / normal / aVCol, which is exactly what `readFR3D` hands back. What
 * is not reused is the town's *car layer*, whose capacity is budgeted in
 * `PROPS` against the traffic on the coast road and has nothing spare for a
 * resort. Reusing the function is not the thing the comment in the shore build
 * warns about; reusing the layer is.
 *
 * ── the palettes ──────────────────────────────────────────────────────────
 *
 * Weighted off the footage rather than off a guess about what an old Dalmatian
 * car park holds. The nose-in row under the olives is overwhelmingly white,
 * with silver next and one or two dark cars in it; the van is white because
 * small panel vans are; and red belongs almost entirely to `oldhatch`, which is
 * the one older squarer car in either walk-through and the only red thing in
 * them. Rule 12: these are body types and colour weights, not marques.
 */

const CAR_PAINT = {
  white: [0.962, 0.958, 0.948],
  pearl: [0.918, 0.926, 0.930],
  silver: [0.748, 0.762, 0.780],
  grey: [0.548, 0.558, 0.572],
  slate: [0.262, 0.272, 0.288],
  blue: [0.148, 0.202, 0.328],
  red: [0.520, 0.128, 0.108],
  sand: [0.638, 0.608, 0.545],
  // Not a paint: the fitted cover on the car that is left for the season.
  //
  // The blue in it is measured OFF and not on, which is the same trap the
  // lavender bank fell into. Sampled across `a_087`, the cover's blue lean
  // runs 0.078 in full sun and 0.115 in the sky-lit midtones — but 0.030 in
  // the deep shade under the pine, where no sky reaches it. That last one is
  // the fabric; the other two are the sky, and the game puts the sky back by
  // itself. Mixed at 0.10 this would be a blue car cover.
  cover: [0.652, 0.668, 0.692],
};

/**
 * The five, with how often each turns up and what it is painted.
 *
 * `w` are shares of the row and they sum to one; the picker walks them in
 * order. `oldhatch` is deliberately the rarest of the cars — the footage has
 * exactly one of them against a dozen moderns, and a wood full of squarer old
 * hatchbacks would be a period piece rather than this August.
 */
const CAR_MODELS = [
  // Two of the fifty-two are put away under covers, and two is the number the
  // footage has: `a_048`-`a_050` and `a_086`-`a_089` in v595, both among the
  // pines. (There is a third behind a gate on the lane at `b_047`, which the
  // survey catalogued as a glass-recycling igloo and is not — see the note in
  // tools/blender/cars.py.)
  //
  // 0.05 is fitted to that count and not derived from it. `carModelFor` walks
  // these weights against `jit`, which is a sine hash over the station index
  // and not a uniform draw, so fifty-two of them do not land in proportion:
  // 0.04 gave one covered car, 0.06 gave four, 0.05 gives two. The weight is
  // the dial and the count on the built page is the reading, which is the same
  // way every other number on this shore was arrived at.
  //
  // The 0.05 comes off `supermini`, the commonest, so the rest of the mix
  // keeps its shape. Every car in the row changes model when this table
  // changes, and that is fine and is why the note on `carModelFor` exists: the
  // car loop takes no `rng()` calls, so nothing else on the beach moves with
  // it. Rule 4 is about the `rng` stream and this is not in it.
  { key: 'covered', w: 0.05, paint: ['cover'] },
  { key: 'supermini', w: 0.29,
    paint: ['white', 'white', 'white', 'white', 'pearl', 'silver', 'silver',
      'grey', 'slate', 'blue'] },
  { key: 'crossover', w: 0.25,
    paint: ['white', 'white', 'white', 'pearl', 'silver', 'silver', 'grey',
      'slate', 'blue'] },
  { key: 'estate', w: 0.17,
    paint: ['white', 'white', 'silver', 'silver', 'pearl', 'grey', 'slate',
      'sand'] },
  { key: 'van', w: 0.11,
    paint: ['white', 'white', 'white', 'white', 'white', 'pearl', 'silver'] },
  { key: 'oldhatch', w: 0.13,
    paint: ['red', 'red', 'red', 'white', 'blue', 'slate'] },
];

/**
 * What is parked at this station, from a hash the caller already has.
 *
 * `j` is `jit(t|0, 25)`, which is a sine hash and not a draw off `rng` — see
 * the note over `jit` in the shore build. That is the whole reason the number
 * of models here is free to change: the car loop takes no `rng()` calls at all,
 * so nothing downstream of it on the beach moves when this table does.
 */
function carModelFor(j) {
  let a = 0;
  for (const m of CAR_MODELS) {
    a += m.w;
    if (j < a) return m;
  }
  return CAR_MODELS[0];
}

/** Fallback extents, for a build whose payload was not baked. */
const CAR_FALLBACK = { x0: -1.95, x1: 2.05, hw: 0.86, h: 1.50 };

/**
 * The model's dimensions, in metres, read straight out of the sidecar.
 *
 * `build.py` inlines a `.json` payload verbatim, so `PAYLOAD.cars` is a plain
 * object and this is synchronous — which is what the shore build needs, since
 * it pushes the walk blockers for the row hundreds of lines before anything is
 * inflated. One source of truth: the numbers come off the same Blender specs
 * that produced the meshes, so a car and its blocker cannot drift apart.
 *
 * `x0`/`x1` are the tail and the nose in model space, with the origin at the
 * wheelbase centre; `hw` is the widest half-width, which is the car's extent
 * *along the shore* because the row is parked nose-in; `h` is the overall
 * height, roof box included.
 */
function carSize(key) {
  const table = (typeof PAYLOAD !== 'undefined' && PAYLOAD.cars) || null;
  return (table && table[key]) || CAR_FALLBACK;
}

/**
 * Draw the row.
 *
 * `sites` is what the shore build collected: `{ x, y, z, yaw, model, tint }`
 * per car, already in world space and already turned to face the water. Ten
 * instanced layers come out of it — a body and a trim for each of the five
 * models — and each one is given a real bounding sphere over the instances
 * that ended up in it, rather than `propLayer`'s 1e9 one, so the whole car park
 * culls as a unit the moment you are looking the other way.
 */
async function buildJadrijaCars(scene, sites) {
  const layers = [];
  let tris = 0;
  const counts = {};
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();

  for (const model of CAR_MODELS) {
    const mine = sites.filter((s) => s.model === model.key);
    counts[model.key] = mine.length;
    if (!mine.length) continue;

    // Both halves or neither: a body with no trim is a car with no wheels and
    // no glass, which is worse than the boxes this replaces.
    const blobs = { body: null, trim: null };
    let bad = false;
    for (const [half, suffix] of [['body', ''], ['trim', '_trim']]) {
      const key = 'car_' + model.key + suffix + '_fr3d';
      const b64 = typeof PAYLOAD !== 'undefined' ? PAYLOAD[key] : null;
      if (!b64) { console.warn('no car payload:', key); bad = true; continue; }
      try {
        blobs[half] = readFR3D(await inflateBinary(b64));
      } catch (e) {
        console.warn('car failed:', key, e.message);
        bad = true;
      }
    }
    if (bad) continue;

    for (const half of ['body', 'trim']) {
      const geo = blobs[half];
      tris += (geo.index.count / 3) * mine.length;
      const L = propLayer(scene, geo, mine.length, { spec: 0.34, specPower: 60 });
      // The index used to be set here, because `propLayer` copied position,
      // normal and aVCol and stopped — every prototype it was written for comes
      // out of `propBuilder.geo()`, a raw triangle soup with no index at all,
      // whereas `readFR3D` deduplicates its vertices and keeps the triangles
      // entirely in the index buffer. Handing that over without the index draws
      // the vertex array in storage order, three at a time, which is not a car
      // with a fault in it but a heap of flat shards lying on the ground.
      //
      // `propLayer` carries the index itself now, on 23 Aug, so this is gone
      // rather than duplicated. The note stays because the failure is silent
      // and the next indexed prototype would have found it the same way.
      let lo = [1e9, 1e9, 1e9];
      let hi = [-1e9, -1e9, -1e9];
      mine.forEach((s, i) => {
        _e.set(0, s.yaw, 0, 'YXZ');
        _q.setFromEuler(_e);
        L.aPos.array[i * 3] = s.x;
        L.aPos.array[i * 3 + 1] = s.y;
        L.aPos.array[i * 3 + 2] = s.z;
        L.aRot.array[i * 4] = _q.x; L.aRot.array[i * 4 + 1] = _q.y;
        L.aRot.array[i * 4 + 2] = _q.z; L.aRot.array[i * 4 + 3] = _q.w;
        L.aScale.array[i * 3] = 1; L.aScale.array[i * 3 + 1] = 1;
        L.aScale.array[i * 3 + 2] = 1;
        // The trim is never tinted. That is the whole point of it being a
        // second layer: 1.0 through the multiply leaves the baked colours
        // exactly as Blender wrote them.
        const c = half === 'body' ? s.tint : [1, 1, 1];
        L.aColor.array[i * 3] = c[0]; L.aColor.array[i * 3 + 1] = c[1];
        L.aColor.array[i * 3 + 2] = c[2];
        for (let k = 0; k < 3; k++) {
          const v = [s.x, s.y, s.z][k];
          if (v < lo[k]) lo[k] = v;
          if (v > hi[k]) hi[k] = v;
        }
      });
      for (const a of [L.aPos, L.aRot, L.aScale, L.aColor]) a.needsUpdate = true;
      L.geo.instanceCount = mine.length;

      // A real bounding sphere, and frustum culling switched back on. The
      // instance positions are world positions and the layer's mesh carries no
      // transform, so the sphere is simply the box round them grown by the
      // model's own radius. Left at `propLayer`'s 1e9 default the row is drawn
      // on every frame of the game, including the ones spent over the channel
      // with the resort three kilometres behind the aeroplane.
      const c = new THREE.Vector3((lo[0] + hi[0]) * 0.5, (lo[1] + hi[1]) * 0.5,
        (lo[2] + hi[2]) * 0.5);
      const span = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 0.5;
      L.geo.boundingSphere = new THREE.Sphere(c,
        span + (geo.boundingSphere ? geo.boundingSphere.radius : 3));
      L.mesh.frustumCulled = true;
      layers.push(L);
    }
  }

  return {
    layers,
    /** For the shadow pass in src/90-app.js — instanced, near cascade only. */
    meshes: () => layers.map((L) => L.mesh),
    count: sites.length,
    counts,
    tris,
  };
}
