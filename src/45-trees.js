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
  // 1500 m put the edge of the vegetation inside the frame on any level flight:
  // you could watch the hillside stop. 2200 pushes it into the haze instead.
  radius: 2200,
  maxTiles: 220,
  perTile: 2100,         // candidate samples per tile, before cover rejects them
  budget: 34000,         // hard ceiling on live instances
  // Where a tree stops being worth its polygons.
  //
  // The whole landscape has always been one model per species, and that model
  // had to be cheap enough to draw thirty-four thousand times — which meant it
  // had to be cheap at 2 km, which meant it was the same lofted lampshade at
  // two metres. A pine you walk past on the way to the fire is not the same
  // problem as a pine on a hillside in the haze, and it was being solved as if
  // it were.
  //
  // Two models, then, and a distance. 300 m is where a 10 m tree is about
  // fifteen pixels tall and there is nothing left to see: the swap is invisible
  // and everything in the ring is a fraction of a percent of a circle 2.2 km
  // across. Measured, on the hillside above Jadrija: about 500 of 20 000.
  //
  // 300 became 190 when the close-up models were grown rather than placed. A
  // grown pine is four times the triangles of the eleven blobs it replaced,
  // and the ring is an area: 190 gives back six tenths of that, and it gives
  // it back where nothing is lost. At 300 m a 10 m tree is fifteen pixels
  // tall; at 190 it is twenty-four, and the far model — which also got the
  // right crown width and the right trunk in this pass — is honest at both.
  // Measured on the hill above Jadrija, where the near ring is fullest: the
  // whole landscape came out lighter after this than it went in.
  near: 190,
  nearMax: 3000,         // and the ceiling on those, so the buffer is bounded
  // What the ring is actually allowed to hold, as against what the buffer can.
  // 420 grown trees is about 1.4 M triangles, which is a fifth of the frame and
  // is what the close-up model is worth; the buffer stays at 3 000 because it
  // is scaled by the density slider and a tablet at 1.4 may ask for more.
  // See the feedback at the end of `repack`.
  nearWant: 420,
  // And how far in it may be pulled before the answer is "draw fewer trees"
  // rather than "draw them simpler". At 45 m a 10 m pine is a hundred pixels
  // tall and the far model is honest at that: it has the right crown width and
  // the right trunk, which is what the near one buys back at ten.
  nearMin: 45,
  // Extra candidate samples over the Jadrija headland — see `makeTile`. 7 000
  // on top of the 2 100 takes the whole tile to 0.035 darts a square metre,
  // which at the wood's own 0.62 is a pine about every seven metres. The
  // reference is one every five: the peninsula is where the game spends its
  // time on foot, and a wood you can see the sea through is the point of it.
  groveMore: 7000,
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
// Two barks, and the gap between them is a marker the fragment shader reads.
// _344/_345/_347: Aleppo bark is "grey-brown plates with orange-red inner bark
// showing at the seams", and that is the wood the whole peninsula is made of.
// Cypress and olive are neither plated nor orange, so they get the grey one
// and the shader leaves them alone. The olive was already 0.33/0.29/0.24 on
// the far model and the shared brown on the near one, which is a species that
// changed colour at 300 m; DRYBARK is that far colour, used by both.
const PINEBARK = [0.315, 0.222, 0.158];
const DRYBARK = [0.330, 0.290, 0.240];

function vegGeo(rings, seg, split, barkCol, leafCol) {
  const g = loft(rings, { closed: true, caps: false });
  const n = g.attributes.position.count;
  const pos = g.attributes.position.array;
  const col = new Float32Array(n * 3);
  // The canopy takes the same shaded-under, sunlit-over gradient the close-up
  // models do. It is the one thing that carries at two kilometres: a hillside
  // of flat-green lampshades reads as painted card, and the same hillside with
  // the undersides dropped to half reads as depth.
  const [dk, lt] = vegShade(leafCol, 0.64, 1.22);
  let ylo = Infinity, yhi = -Infinity;
  for (let i = split * seg; i < n; i++) {
    const y = pos[i * 3 + 1];
    if (y < ylo) ylo = y;
    if (y > yhi) yhi = y;
  }
  for (let i = 0; i < n; i++) {
    const ring = Math.floor(i / seg);
    if (ring < split) {
      col[i * 3] = barkCol[0]; col[i * 3 + 1] = barkCol[1];
      col[i * 3 + 2] = barkCol[2];
      continue;
    }
    let t = (pos[i * 3 + 1] - ylo) / (yhi - ylo || 1);
    t = t * t * (3 - 2 * t);
    col[i * 3] = dk[0] + (lt[0] - dk[0]) * t;
    col[i * 3 + 1] = dk[1] + (lt[1] - dk[1]) * t;
    col[i * 3 + 2] = dk[2] + (lt[2] - dk[2]) * t;
  }
  g.setAttribute('aVCol', new THREE.BufferAttribute(col, 3));
  return g;
}

// ── the close-up models ──────────────────────────────────────────────────────
//
// Same silhouette, same height, same overall radius — everything below is built
// to the dimensions the far model already had, because a tree that changes size
// as you approach is worse than a tree with corners on it. What changes is what
// it is made of: a trunk that leans and bows, limbs that leave it and go
// somewhere, and a canopy that is three to five separate clumps rather than one
// surface of revolution. It is the gaps between the clumps that do the work,
// exactly as the gaps between the tongues do it on the ink.

/** Paint every vertex of a geometry one colour, ready to be merged. */
function vegPaint(g, col) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
  g.setAttribute('aVCol', new THREE.BufferAttribute(c, 3));
  return g;
}

/** Concatenate painted parts into one geometry, which is one prototype. */
function vegMerge(parts) {
  let nv = 0, ni = 0;
  for (const g of parts) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 3);
  const idx = new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nrm.set(g.attributes.normal.array, vo * 3);
    col.set(g.attributes.aVCol.array, vo * 3);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += n; io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('aVCol', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/**
 * A clump of foliage: a closed blob with its radius knocked about.
 *
 * The poles are left as very small rings rather than as points. A ring of
 * coincident vertices is a fan of zero-area triangles, and a zero-area triangle
 * has no normal — `computeVertexNormals` hands back a NaN and the top of every
 * tree comes out black. The material draws both sides, so the millimetre of
 * hole this leaves instead cannot be seen from anywhere.
 */
function vegClump(c, r, seg, rows, jag, rnd) {
  // `rows` is not a quality dial, it is a shape: the poles take a ring each
  // and leave `rows - 1` for the body, so rows=3 is a barrel with two caps and
  // rows=2 is a drum. That was invisible while a clump was 30 cm across and
  // very visible indeed once the crowns were made their real size — the olive
  // came out as a heap of hexagonal prisms. Anything you can see the sides of
  // wants 4.

  const ph = [];
  for (let i = 0; i < seg; i++) ph.push(rnd() * TAU);
  const rings = [];
  for (let k = 0; k <= rows; k++) {
    const v = k / rows;
    const th = (v - 0.5) * Math.PI * 0.97;
    const w = Math.cos(th), h = Math.sin(th);
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * TAU;
      const n = 1 + jag * (0.62 * Math.sin(a * 3 + ph[i])
        + 0.38 * Math.sin(v * 5.3 + ph[(i + 3) % seg]));
      ring.push(new THREE.Vector3(
        c[0] + Math.cos(a) * r[0] * w * n,
        c[1] + r[1] * h,
        c[2] + Math.sin(a) * r[2] * w * n));
    }
    rings.push(ring);
  }
  return loft(rings, { closed: true, caps: false });
}

/**
 * Foliage, lit as the soft mass it is meant to be rather than as the crumpled
 * tin it is actually made of.
 *
 * Two things, and both of them are about the normal rather than the shape.
 *
 * A clump is an ellipsoid with its radius knocked about by `jag`, and
 * `computeVertexNormals` faithfully reports every one of those dents. The
 * result is a canopy that sparkles: neighbouring facets catch the sun at
 * wildly different angles, the eye reads the high-frequency noise as *hard*,
 * and a tree ends up looking like screwed-up foil painted green. What a real
 * canopy does is the opposite — a hundred thousand leaves average out into one
 * broad soft gradient, dark underneath and bright on top, with the individual
 * detail far below the resolution of anything you can see from six metres.
 *
 * So the normal is thrown away and replaced by the one the *un-jagged*
 * ellipsoid would have had at that point, which is what makes each puff light
 * as a ball while its outline keeps every dent. That is the whole trick, and
 * it is the one from douges.dev — the shape stays noisy, the lighting does
 * not.
 *
 * The second half is the gradient. One flat green over a whole canopy has no
 * inside: paint the underside of the mass a good deal darker than the top and
 * the same geometry acquires depth, because now the clumps at the back of the
 * crown are darker than the ones in front of them and the crown has a volume
 * rather than a silhouette. It costs nothing — the vertex colours were already
 * there, they were simply all the same number.
 *
 * `span` is the height band the gradient runs over, in prototype units, and it
 * is the whole canopy's band and not the clump's: every clump has to be shaded
 * as part of one crown or they read as a bag of separate balls.
 */
function vegPuff(g, c, r, span, dark, lite, blend = 0.86) {
  const p = g.attributes.position.array;
  const nrm = g.attributes.normal.array;
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const ir = [1 / (r[0] * r[0]), 1 / (r[1] * r[1]), 1 / (r[2] * r[2])];
  const lo = span[0], hi = span[1];
  for (let i = 0; i < n; i++) {
    const dx = p[i * 3] - c[0], dy = p[i * 3 + 1] - c[1], dz = p[i * 3 + 2] - c[2];
    let ex = dx * ir[0], ey = dy * ir[1], ez = dz * ir[2];
    const el = Math.hypot(ex, ey, ez) || 1e-6;
    ex /= el; ey /= el; ez /= el;
    let nx = nrm[i * 3] * (1 - blend) + ex * blend;
    let ny = nrm[i * 3 + 1] * (1 - blend) + ey * blend;
    let nz = nrm[i * 3 + 2] * (1 - blend) + ez * blend;
    const nl = Math.hypot(nx, ny, nz) || 1e-6;
    nrm[i * 3] = nx / nl; nrm[i * 3 + 1] = ny / nl; nrm[i * 3 + 2] = nz / nl;
    let t = (p[i * 3 + 1] - lo) / (hi - lo || 1);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    t = t * t * (3 - 2 * t);
    col[i * 3] = dark[0] + (lite[0] - dark[0]) * t;
    col[i * 3 + 1] = dark[1] + (lite[1] - dark[1]) * t;
    col[i * 3 + 2] = dark[2] + (lite[2] - dark[2]) * t;
  }
  g.attributes.normal.needsUpdate = true;
  g.setAttribute('aVCol', new THREE.BufferAttribute(col, 3));
  return g;
}

/** The two ends of a leaf colour's gradient: shaded underside, sunlit top. */
function vegShade(col, under = 0.60, over = 1.28) {
  return [col.map((v) => v * under), col.map((v) => Math.min(1, v * over))];
}


/** A limb: a tapered tube from one point to another, optionally bowed. */
function vegLimb(p0, p1, r0, r1, seg, rows = 2, bow = 0) {
  const dir = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const L = dir.length() || 1e-4;
  dir.multiplyScalar(1 / L);
  const ref = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(ref, dir).normalize();
  const w = new THREE.Vector3().crossVectors(dir, u);
  const rings = [];
  for (let k = 0; k <= rows; k++) {
    const t = k / rows;
    const r = r0 + (r1 - r0) * t;
    const c = new THREE.Vector3(p0[0], p0[1], p0[2]).addScaledVector(dir, L * t);
    c.addScaledVector(u, bow * Math.sin(Math.PI * t));
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * TAU;
      const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      ring.push(new THREE.Vector3(
        c.x + u.x * ca + w.x * sa,
        c.y + u.y * ca + w.y * sa,
        c.z + u.z * ca + w.z * sa));
    }
    rings.push(ring);
  }
  return loft(rings, { closed: true, caps: false });
}

// ── growing one, instead of placing eleven ───────────────────────────────────
//
// Everything above this line places foliage by hand: a list of clump centres,
// tuned by eye until the silhouette was right. It got us a long way and it has
// a ceiling, which is that a hand-placed canopy has no *reason*. The clumps sit
// where they sit; nothing carries them; the outline is whatever the list said.
// Stand under one at four metres and it reads as a bunch of balloons on sticks,
// because that is what it is.
//
// So the last three species below are grown rather than arranged, and the model
// is Daniel Greenheck's ez-tree (MIT) — read, not imported. None of his code is
// here: it is built for leaf billboards with alpha-tested textures, and this
// whole game is solid vertex-coloured geometry in four instanced draws with not
// one texture in it. What transfers is the *skeleton*, and four ideas in it:
//
//   · A branch is not a tube, it is a chain of short sections, each one
//     stepping along its own orientation. Bends come free and cost nothing.
//   · Gnarliness scales with 1/√radius, so a thin branch curls hard and a
//     trunk barely wanders. One number, and it is the difference between a
//     tree and a diagram of a tree.
//   · A growth force rotates each section toward the light by strength/radius,
//     so the trunk resists it and the twigs are dragged. That is what makes an
//     Aleppo pine's umbrella happen rather than be sculpted.
//   · Children are stratified: spread along the parent in equal slots with
//     jitter, and given radial slots from a *shuffled* permutation so height
//     and bearing decorrelate. He documents the bug this fixes and he is
//     right — without it a conifer spirals its longest branches to one side.
//
// Two of his numbers are re-scaled because his trees are twenty metres tall in
// world units and these are normalised to a height of one: gnarliness uses
// √(r0/r) and force uses strength·r0/r, both of which are 1 at the trunk base,
// so the spec's numbers mean radians per section on the trunk and can be read.
//
// The leaves are ours. Where he hangs a billboard, this hangs a `vegClump`,
// which is the same puff the hand-placed canopies use — so a grown tree lights
// exactly like the ones round the vikendica and nothing else in the pipeline
// has to know the difference.

/** Fisher-Yates, so a child's height slot says nothing about its bearing. */
function vegShuffle(n, rnd) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(i);
  for (let k = n - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    const t = a[k]; a[k] = a[j]; a[j] = t;
  }
  return a;
}

/**
 * Grow a skeleton. Returns the branches as chains of sections — a point, an
 * orientation and a radius each — and the places foliage is to hang.
 *
 * Breadth-first off a queue rather than by recursion, which is his structure
 * and is the right one: every branch of a level is grown before any of the next
 * begins, so a spec change at one level cannot silently reorder another level's
 * draws on the seeded RNG.
 */
function vegGrow(spec, rnd) {
  const UP = new THREE.Vector3(0, 1, 0);
  const r0 = spec.radius;
  const force = new THREE.Vector3().fromArray(spec.force || [0, 1, 0]).normalize();
  const branches = [], tufts = [];
  const queue = [{
    p: new THREE.Vector3(0, 0, 0),
    q: new THREE.Quaternion(),
    len: spec.height,
    r: spec.radius,
    level: 0,
  }];

  const tmpQ = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const up = new THREE.Vector3();
  const step = new THREE.Vector3();

  while (queue.length) {
    const b = queue.shift();
    const lv = b.level;
    const last = lv === spec.levels;
    const nSec = spec.sections[lv];
    const secLen = b.len / nSec;
    const p = b.p.clone(), q = b.q.clone();
    const sections = [];

    for (let i = 0; i <= nSec; i++) {
      const t = i / nSec;
      // A branch that ends in foliage tapers to nothing; one that carries
      // children keeps something at the tip for them to leave from.
      let r = b.r * (1 - spec.taper[lv] * t);
      if (last && i === nSec) r = b.r * 0.06;
      sections.push({ p: p.clone(), q: q.clone(), r });
      if (i === nSec) break;

      step.set(0, secLen, 0).applyQuaternion(q);
      p.add(step);

      // Wander. Thin curls, thick does not.
      const g = spec.gnarl[lv] * Math.sqrt(r0 / Math.max(r, 1e-4));
      q.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0),
        (rnd() - 0.5) * 2 * g));
      q.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1),
        (rnd() - 0.5) * 2 * g));

      // And the light. Rotated about (branch up × force), so a section already
      // pointing at the force is left alone instead of being shoved sideways
      // by whatever direction the wander happened to leave it in.
      up.set(0, 1, 0).applyQuaternion(q);
      axis.crossVectors(up, force);
      const sin = axis.length();
      if (sin > 1e-6) {
        axis.divideScalar(sin);
        const full = Math.atan2(sin, up.dot(force));
        const want = spec.strength[lv] * (r0 / Math.max(r, 1e-4));
        q.premultiply(tmpQ.setFromAxisAngle(axis,
          Math.max(-full, Math.min(full, want))));
      }
    }

    branches.push({ sections, seg: spec.segments[lv] });

    if (last) {
      // Foliage along the last length of the last branch. `tuft` is where it
      // starts and how many, and the count is what turns a lollipop into a
      // spray: one puff at the tip is a bud, four down the length is a shoot.
      const [tStart, tCount] = spec.tuft;
      for (let i = 0; i < tCount; i++) {
        const f = tStart + (i + 0.3 + rnd() * 0.4) / tCount * (1 - tStart);
        const s = sections[Math.min(nSec, Math.floor(f * nSec))];
        tufts.push({
          c: [s.p.x, s.p.y, s.p.z],
          // This one's share of the leaf size, and where it sits off its
          // branch — both in units of its own radius, so they survive the fit.
          k: 0.70 + rnd() * 0.60,
          j: [(rnd() - 0.5) * spec.tuftJit, (rnd() - 0.5) * spec.tuftJit,
            (rnd() - 0.5) * spec.tuftJit],
        });
      }
      continue;
    }

    // Children, stratified up the parent and round it.
    const n = spec.children[lv];
    const startMin = spec.start[lv];
    const slot = (1 - startMin) / n;
    const bearing = vegShuffle(n, rnd);
    const spin = rnd() * TAU;
    for (let i = 0; i < n; i++) {
      const at = startMin + (i + rnd()) * slot;
      const si = Math.min(nSec, Math.floor(at * nSec));
      const s = sections[si];
      const a = spin + TAU * (bearing[i] + (rnd() - 0.5)) / n;
      const cq = s.q.clone()
        .multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a))
        .multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), spec.angle[lv]));
      queue.push({
        p: s.p.clone(),
        q: cq,
        // An evergreen's branches shorten as they go up it, which is the whole
        // outline of a conifer and is one multiplication.
        len: spec.length[lv] * (spec.evergreen ? 1 - at * spec.spire : 1),
        r: s.r * spec.thin[lv],
        level: lv + 1,
      });
    }
  }
  return { branches, tufts };
}

/** Skin one grown branch: a ring at every section, in that section's frame. */
function vegSkin(branch) {
  const rings = [];
  const v = new THREE.Vector3();
  for (const s of branch.sections) {
    const ring = [];
    for (let i = 0; i < branch.seg; i++) {
      const a = (i / branch.seg) * TAU;
      v.set(Math.cos(a) * s.r, 0, Math.sin(a) * s.r).applyQuaternion(s.q);
      ring.push(new THREE.Vector3(s.p.x + v.x, s.p.y + v.y, s.p.z + v.z));
    }
    rings.push(ring);
  }
  return loft(rings, { closed: true, caps: false });
}

/**
 * Fit a grown skeleton into the envelope the instancing was written against:
 * standing on y=0, one unit tall, and reaching `radius` at its widest.
 *
 * Doing it here rather than in the spec is the difference between a spec you
 * can read and a spec you have to solve. Nobody can say what trunk length and
 * branch angle add up to a height of exactly one — and if they could, changing
 * the branch angle would break it again. So the spec says what shape the tree
 * is and this says how big it is, which is the only division of those two that
 * survives editing.
 *
 * The scale is not uniform: height and spread are separate numbers because a
 * cypress and an olive disagree about both. A branch's own cross-section takes
 * only the horizontal factor, so a leaning limb's tube goes very slightly
 * elliptical — at five centimetres of radius that is under a pixel, and the
 * alternative is fitting one dimension and missing the other.
 */
function vegFit(sk, height, radius, bole, leaf, squash) {
  let ylo = Infinity, yhi = -Infinity, rmax = 1e-6;
  for (const b of sk.branches) {
    for (const s of b.sections) {
      if (s.p.y < ylo) ylo = s.p.y;
      if (s.p.y > yhi) yhi = s.p.y;
      const d = Math.hypot(s.p.x, s.p.z);
      if (d > rmax) rmax = d;
    }
  }
  // The wood is fitted a little inside the envelope and the foliage fills the
  // rest, because the foliage is what defines the outline: a puff hanging off
  // the outermost twig has to be inside the species' reach, not centred on it.
  const sy = height * (1 - leaf * squash * 0.85) / Math.max(yhi - ylo, 1e-6);
  const sxz = radius * (1 - leaf * 0.85) / rmax;
  for (const b of sk.branches) {
    for (const s of b.sections) {
      s.p.set(s.p.x * sxz, (s.p.y - ylo) * sy, s.p.z * sxz);
    }
  }
  // Leaf size as a fraction of the crown's own radius, which is a number you
  // can hold against a photograph — a pine's tufts are a fifth of its crown, a
  // maquis bush's are nearly half of it, and both of those are checkable. It
  // was a pre-fit length before, in units nothing else in the file used, and
  // that is how a puff on the olive ended up a metre and a half across.
  for (const t of sk.tufts) {
    const rx = leaf * radius * t.k;
    t.rx = rx;
    t.ry = rx * squash;
    t.c = [t.c[0] * sxz + t.j[0] * rx,
      (t.c[1] - ylo) * sy + t.j[1] * t.ry,
      t.c[2] * sxz + t.j[2] * rx];
  }
  // And the wood, which is fitted separately and has to be. Widening a crown
  // widens everything under it by the same factor, so the pine's trunk went
  // from a lamp post to a chimney the moment the crown was made the right size
  // — the two mistakes were one mistake, and correcting only the visible half
  // would have left a ten-metre tree with three-quarters of a metre of bole.
  // `bole` is the trunk radius the drawing wants, in the same units as the
  // spread, so the diameter in the world is `2 · bole · wide` and is a number
  // you can check against a real tree.
  const rk = bole / Math.max(sk.branches[0].sections[0].r, 1e-9);
  for (const b of sk.branches) for (const s of b.sections) s.r *= rk;
  return sk;
}

/**
 * Grow a species and hand back one merged, painted prototype: bark on the
 * wood, and the crown's own gradient over every puff, banded across the whole
 * canopy so it reads as one volume and not as a bag of separate balls.
 *
 * `squash` is a puff's height over its width in prototype units. Round in the
 * world is about 0.8 for every species here — an instance is scaled (w, h, w)
 * and each species' h/w now sits between 1.0 and 1.3 — so anything much under
 * that is a deliberately flat puff, which is what an Aleppo pine's foliage is
 * and what a cypress's very much is not.
 */
function vegGrown(spec, rnd, bark, leaf, shade) {
  const sk = vegGrow(spec, rnd);
  vegFit(sk, 1, spec.reach, spec.bole, spec.leaf, spec.squash);

  const parts = sk.branches.map((b) => vegPaint(vegSkin(b), bark));
  let lo = Infinity, hi = -Infinity;
  for (const t of sk.tufts) {
    if (t.c[1] - t.ry < lo) lo = t.c[1] - t.ry;
    if (t.c[1] + t.ry > hi) hi = t.c[1] + t.ry;
  }
  const [dk, lt] = vegShade(leaf, shade[0], shade[1]);
  for (const t of sk.tufts) {
    const r = [t.rx, t.ry, t.rx];
    parts.push(vegPuff(vegClump(t.c, r, spec.puffSeg, spec.puffRow, spec.puffJag, rnd),
      t.c, r, [lo + (hi - lo) * 0.10, hi], dk, lt));
  }
  return vegMerge(parts);
}

/**
 * The four close-up species, grown to the envelope the far models already had:
 * standing on the ground, one unit tall, and reaching the same radius, because
 * a tree that changes size or shape as you approach is worse than a tree with
 * corners on it.
 *
 * Seeded once and deterministically. These are four models, not four thousand
 * — the variation between individual trees is the instance's own scale, yaw
 * and tint, which is where it has always been.
 */
function vegNearPrototypes() {
  const rnd = mulberry32(0x7ee5);
  // Bark is now two colours and the difference between them is read by the
  // shader, not just by the eye. An Aleppo pine's trunk is plated, and the
  // plates part to show orange-red inner bark at the seams; a cypress is
  // stringy grey-brown and an olive is grey. `PINEBARK` is warm enough that
  // `vVCol.r - vVCol.g` clears 0.086 and `DRYBARK` is grey enough that it
  // does not reach 0.058, which is the whole of the species test. Do not
  // narrow the gap between them without moving the thresholds in the tree
  // fragment hook below.
  const bark = PINEBARK;

  // Aleppo pine. Long bare trunk, everything happening in the top third, and
  // the umbrella made by the growth force rather than by hand: five limbs
  // leave at sixty degrees and are then rotated back toward the light section
  // by section, hardest where they are thinnest, which is exactly the shape.
  // `spire` shortens them going up, so the crown is broad below and closes
  // over, and the tufts sit along the last third of the last branches so the
  // foliage is a spray at the ends and not a ball in the middle.
  //
  // The trunk stops well short of the top and tapers almost to nothing, which
  // is not a detail: the fit scales the tree by its tallest *section*, so a
  // leader that outlives its branches becomes a bare spike standing out of the
  // crown, and that is a telegraph pole with a bush tied to it. In a grown
  // pine the top of the tree is made of branches. Here it is too.
  const pine = vegGrown({
    levels: 2, evergreen: true, spire: 0.42,
    height: 0.66, radius: 0.055, reach: 0.45, bole: 0.023,
    children: [6, 3], start: [0.42, 0.26],
    angle: [1.16, 0.72], length: [0.42, 0.22], thin: [0.60, 0.58],
    taper: [0.88, 0.58, 0.70], gnarl: [0.018, 0.048, 0.105],
    strength: [0.0035, 0.013, 0.026], force: [0, 1, 0],
    sections: [7, 5, 3], segments: [7, 5, 3],
    tuft: [0.14, 3], tuftJit: 1.15, leaf: 0.18,
    squash: 0.50, puffSeg: 6, puffRow: 4, puffJag: 0.44,
  }, rnd, bark, [0.14, 0.24, 0.13], [0.60, 1.26]);

  // Cypress. A fastigiate tree is one whose branches are held almost against
  // its own trunk, and that is one number here and not a shape: leave at
  // fifteen degrees, then a growth force strong enough to pull every section
  // back to vertical. The wander is left high so the column is not a lathe.
  const cypress = vegGrown({
    levels: 1, evergreen: true, spire: 0.72,
    height: 0.94, radius: 0.030, reach: 0.105, bole: 0.010,
    children: [16], start: [0.05],
    angle: [0.30], length: [0.34], thin: [0.30],
    taper: [0.80, 0.70], gnarl: [0.012, 0.075],
    strength: [0.002, 0.055], force: [0, 1, 0],
    sections: [9, 4], segments: [6, 4],
    tuft: [0.05, 4], tuftJit: 1.30, leaf: 0.32,
    squash: 0.90, puffSeg: 5, puffRow: 3, puffJag: 0.46,
  }, rnd, DRYBARK, [0.09, 0.17, 0.11], [0.52, 1.42]);

  // Olive. Short thick trunk that divides low — three or four limbs off half a
  // metre of bole is the whole silhouette of the species, and it is `start`
  // low with `angle` wide and nothing else. No spire: an olive is broadest at
  // the top, which is what happens when the force is weak and the branches
  // keep the angle they left at.
  const olive = vegGrown({
    levels: 2, evergreen: false, spire: 0,
    height: 0.30, radius: 0.115, reach: 0.56, bole: 0.064,
    children: [4, 4], start: [0.30, 0.20],
    angle: [0.62, 0.66], length: [0.52, 0.30], thin: [0.62, 0.55],
    taper: [0.45, 0.55, 0.70], gnarl: [0.055, 0.075, 0.120],
    strength: [0.004, 0.007, 0.012], force: [0, 1, 0],
    sections: [4, 6, 3], segments: [8, 5, 4],
    tuft: [0.10, 3], tuftJit: 1.15, leaf: 0.16,
    squash: 0.80, puffSeg: 7, puffRow: 4, puffJag: 0.38,
  }, rnd, DRYBARK, [0.36, 0.41, 0.30], [0.62, 1.22]);

  // Maquis. No trunk worth the name — a stub, and everything from it. The
  // gnarliness is the highest here of anything: scrub is a tangle, and the
  // first version of this was three concentric blobs, which on open karst at
  // ten metres reads as a boulder. The outline has to be broken in several
  // places or the eye files it as stone.
  const bush = vegGrown({
    levels: 1, evergreen: false, spire: 0,
    height: 0.10, radius: 0.055, reach: 0.58, bole: 0.050,
    children: [7], start: [0.05],
    angle: [0.86], length: [0.62], thin: [0.72],
    taper: [0.35, 0.65], gnarl: [0.09, 0.190],
    strength: [0.004, 0.010], force: [0, 1, 0],
    sections: [3, 5], segments: [6, 4],
    tuft: [0.16, 3], tuftJit: 1.00, leaf: 0.40,
    squash: 0.88, puffSeg: 6, puffRow: 3, puffJag: 0.50,
  }, rnd, DRYBARK, [0.26, 0.30, 0.19], [0.60, 1.26]);

  return { pine, cypress, olive, bush };
}

function vegPrototypes() {
  // Both LODs have to agree about the bark as well as about the outline: the
  // plate test is a threshold on the vertex colour, so a far pine painted
  // 0.30/0.23 would lose its seams at exactly the distance the near model
  // hands over and the wood would change species as you walked into it.
  const bark = PINEBARK;
  // A pentagonal cross-section is what made the hillside read as faceted from
  // low down. Eight sides is the point where a canopy stops having corners; a
  // pine goes from 60 triangles to 96, and since the whole landscape is four
  // instanced draws whatever the count, that is the entire cost.
  const S = 8, B = 6;

  // Aleppo pine: bare leaning trunk, flat irregular umbrella. The shape that
  // reads as Dalmatia from a thousand feet.
  // The trunk radii here are the same correction VEG_SIZE got: they were
  // written when a pine's `wide` was 1.9 and are read against 7.78, so every
  // one of them is divided by about four. Both LODs have to agree about the
  // wood as well as about the outline, or a tree changes girth at 300 m.
  // And the crown is pushed up the trunk and flattened, which it could afford
  // not to be while it was a metre and a half across and could afford it no
  // longer at seven: a smooth dome on a stick is a mushroom, and a mushroom on
  // a hillside of them is what makes a landscape read as a toy. Higher, flatter
  // and with half again the irregularity — the far model is what almost every
  // tree in the frame actually is, so it is worth the six rings it costs.
  const pine = vegGeo([
    vegRing(0.00, 0.023, S), vegRing(0.30, 0.018, S), vegRing(0.55, 0.015, S),
    vegRing(0.57, 0.30, S, 0.34), vegRing(0.68, 0.43, S, 0.32),
    vegRing(0.80, 0.45, S, 0.30), vegRing(0.90, 0.38, S, 0.28),
    vegRing(0.97, 0.22, S, 0.24), vegRing(1.00, 0.06, S),
  ], S, 3, bark, [0.14, 0.24, 0.13]);

  // Cypress: the dark exclamation mark in every churchyard and windbreak.
  const cypress = vegGeo([
    vegRing(0.00, 0.017, S), vegRing(0.10, 0.070, S),
    vegRing(0.32, 0.105, S, 0.10), vegRing(0.66, 0.095, S, 0.10),
    vegRing(0.90, 0.060, S), vegRing(1.00, 0.010, S),
  ], S, 1, DRYBARK, [0.09, 0.17, 0.11]);

  // Olive: short, thick, gnarled, silver-green and much harder to set alight.
  const olive = vegGeo([
    vegRing(0.00, 0.064, S), vegRing(0.20, 0.050, S),
    vegRing(0.30, 0.44, S, 0.24), vegRing(0.46, 0.53, S, 0.23),
    vegRing(0.62, 0.56, S, 0.22), vegRing(0.80, 0.47, S, 0.21),
    vegRing(0.92, 0.32, S, 0.19), vegRing(1.00, 0.10, S),
  ], S, 2, DRYBARK, [0.36, 0.41, 0.30]);

  // Maquis: no trunk worth modelling, and the reason the whole coast goes up.
  const bush = vegGeo([
    vegRing(0.00, 0.42, B), vegRing(0.38, 0.58, B, 0.28),
    vegRing(0.74, 0.46, B, 0.26), vegRing(1.00, 0.10, B),
  ], B, 0, DRYBARK, [0.26, 0.30, 0.19]);

  return { pine, cypress, olive, bush };
}

/**
 * Height range in metres, and then the width number — which was wrong, in the
 * one way that is hard to see because it is wrong on every tree equally.
 *
 * An instance is scaled (w, h, w) and the third number here is w at the middle
 * of the height range, so a species' canopy comes out `2 · reach · wide` wide,
 * where `reach` is how far the prototype extends from its own axis. Nobody had
 * ever multiplied that out: the pine's was 2 · 0.45 · 1.9, which is a crown a
 * metre and seven across on a ten-metre tree. An Aleppo pine's crown is seven
 * metres across. Every conifer on this coast has been a lamp post with a bud
 * on it, and no amount of work on the model was ever going to fix that.
 *
 * So the numbers are now derived rather than dialled: the width in metres that
 * the species actually has, divided by twice the prototype's reach. Both LODs
 * are built to the same reach, which is what lets one number serve both.
 */
const VEG_SIZE = {
  pine: [7, 13, 7.78],           // 7.0 m of crown  ÷ 2 × 0.45
  cypress: [7, 14, 9.05],        // 1.9 m           ÷ 2 × 0.105
  olive: [3.4, 5.4, 4.29],       // 4.8 m           ÷ 2 × 0.56
  bush: [0.9, 2.2, 1.47],        // 1.7 m           ÷ 2 × 0.58
};

// ── needles, not lumps ───────────────────────────────────────────────────────
//
// Misha, 27 Sep 2026: "improve the quality of the procedural trees". Put a
// frame of the stand behind the promenade beside `20260821_175032` and
// `_175924` and the difference is not the shape of the crowns any more — the
// grown skeleton and the boughs got those right — it is what the crowns are
// MADE of. In the photographs an Aleppo crown is a heap of separate needle
// tufts, each lit on its own: a bright yellow-green cap where the sun catches
// the tips, near-black in the pockets between them, and an outline that is
// nothing but tufts, with sky showing through it for a hand's breadth inside
// the edge. In the game it was a set of smooth green balloons with hard
// polygon rims — eight or nine corners each, visible against the sky from
// anywhere on the promenade — and one flat green on every one of them.
//
// Neither of those is a polygon problem, and adding polygons does not fix
// either: a sphere with three hundred faces is a smoother balloon. They are
// both answered per pixel, off world position, and the geometry does not
// change at all.
//
//   · THE TUFTS. Four octaves of value noise in world space — 3 m, 0.75 m,
//     0.28 m and 9 cm: the crown's sides, its lobes, the tuft and the needle
//     cluster — and the sum darkens the pockets to about three fifths and
//     lifts the caps two fifths,
//     with the brightest of them pushed towards the yellow the photographs
//     have on every sunlit tip. World space and not the model's, so the
//     instanced trees do not all wear the same pattern, and two puffs that
//     overlap agree about which tuft is where.
//   · THE NEEDLES. On a conifer and within about thirty metres, the tuft is
//     drawn as what it is: the nearest of a 3D scatter of tuft centres, seen
//     face on as a thirteen-spiked star — see `folCell` and the note on it
//     in foliageBody.
//   · THE OUTLINE. Where the surface turns away from you — the rim of a puff,
//     where a real crown is thin and you are looking through the edge of it —
//     a pixel whose tuft is weaker than the rim is steep is discarded. Square
//     on, almost nothing goes; at the silhouette, almost everything, so the
//     edge becomes the tufts themselves and the corners of the puff are never
//     drawn. Through the holes is the back of the same puff, darker, which is
//     what the inside of a crown looks like.
//   · THE LIGHT THROUGH IT. Against the sun a pine crown glows at its thin
//     edges — `_175032` is exactly that — and a solid surface cannot do it:
//     its far side is in its own shadow. So foliage takes a little of the
//     sun's light on the side AWAY from it, in proportion to how nearly you
//     are looking into the sun through it.
//
// Every one of these is faded by pixel footprint, the same rule the bark and
// the needle floor live by: an octave a pixel cannot resolve is not drawn
// fainter, it is not drawn, because a threshold under a pixel is a sparkle and
// a sparkle on forty thousand trees is the whole hillside crawling. The fine
// octave is gone by eight centimetres a pixel, the tuft by twenty-six, the
// lobes by a metre, and what the far hillside keeps is the three-metre one,
// which is the only one of the four that is visible from the air.
//
// Which pixels are foliage is read off the vertex colour, exactly as the bark
// is: every leaf colour in the game is greener than it is red (pine, cypress,
// olive, maquis, and the hand-planted crowns at Jadrija) and every bark is
// redder than it is green. One number, no second attribute and no second draw.

/**
 * Three-dimensional value noise with its own hash. Its own because this goes
 * into `decl`, which is in the vertex program as well as the fragment one, and
 * the vertex program does not have GLSL_NOISE — a call to `h31` in here was a
 * link failure and a black forest.
 */
const GLSL_FOLIAGE = /* glsl */ `
float folH(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float folN(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(folH(i), folH(i + vec3(1.0, 0.0, 0.0)), f.x),
                mix(folH(i + vec3(0.0, 1.0, 0.0)), folH(i + vec3(1.0, 1.0, 0.0)), f.x), f.y);
  float b = mix(mix(folH(i + vec3(0.0, 0.0, 1.0)), folH(i + vec3(1.0, 0.0, 1.0)), f.x),
                mix(folH(i + vec3(0.0, 1.0, 1.0)), folH(i + vec3(1.0, 1.0, 1.0)), f.x), f.y);
  return mix(a, b, f.z);
}
// The tuft field, about 0.5 and running roughly 0.1 to 0.9. fp is metres per
// pixel, and each octave hands back its mean once it is below the pixel. The
// middle octave is stretched along y by a third: an Aleppo tuft is a spray
// that stands up off its twig, and round cells read as a hedge.
//
// And a fourth octave under the other three, at three metres, which is the
// only one the hillside has left from the air: it is what turns a crown seen
// from four hundred metres from a dark green dome into a dark green dome with
// a lit side and a pocket in it. It lives until a pixel is four metres wide.
float folTuft(vec3 w, float fp){
  float kH = 1.0 - smoothstep(1.00, 4.00, fp);
  float kB = 1.0 - smoothstep(0.30, 1.10, fp);
  float kM = 1.0 - smoothstep(0.07, 0.26, fp);
  float kF = 1.0 - smoothstep(0.022, 0.080, fp);
  // Each octave only where it is drawn at all. Measured, not assumed: all
  // four unconditionally put 2 to 3 ms of GPU on the promenade, because the
  // far layer is most of the trees on the screen and it was paying for two
  // octaves it then multiplied by zero.
  float t = 0.5;
  if (kH > 0.0) t += (folN(w * 0.33 + 1.7) - 0.5) * 0.40 * kH;
  if (kB > 0.0) t += (folN(w * 1.33 + 4.1) - 0.5) * 0.60 * kB;
  if (kM > 0.0) t += (folN(vec3(w.x * 3.6, w.y * 2.7, w.z * 3.6)) - 0.5) * 0.95 * kM;
  if (kF > 0.0) t += (folN(w * 11.0 + 9.3) - 0.5) * 0.42 * kF;
  return t;
}
vec3 folH3(vec3 p){
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
// The nearest needle tuft: a point scattered in each cell of a 3D grid, and
// the one closest to here. xyz is the offset to its centre in cell units, w
// is the tuft's own random number. Twenty-seven cells, because the nearest
// point can be in any neighbour; it is only ever called where a tuft is
// several pixels across, so it is never called for more than the near crowns.
vec4 folCell(vec3 p){
  vec3 i = floor(p), f = fract(p);
  float best = 9.0;
  vec4 o = vec4(0.0);
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 h = folH3(i + g);
        vec3 r = g + 0.15 + h * 0.70 - f;
        float d = dot(r, r);
        if (d < best) { best = d; o = vec4(r, h.x + h.z); }
      }
    }
  }
  return o;
}
// The bark's mosaic, in 2D: x is F2 - F1 (zero on a crack), y the plate's
// own random shade, z F1. Nine cells; see the plates in treeMaterial.
vec3 barkCell(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0, id = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec3 h = folH3(vec3(i + g, 7.0));
      vec2 r = g + 0.10 + h.xy * 0.80 - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = h.z; } else if (d < d2) { d2 = d; }
    }
  }
  d1 = sqrt(d1);
  return vec3(sqrt(d2) - d1, id, d1);
}
`;

/**
 * The fragment half: after the bark, before the light. Declares `leaf` at the
 * top level of main so FOLIAGE_LIT can read it after the lighting.
 *
 * The derivative is taken before anything can discard, which is not style:
 * fwidth under non-uniform control flow is undefined, and on the one GPU that
 * cares about it the result is a checkerboard of tufts along every edge.
 */
function foliageBody(cut, needles = true, grain = 1) {
  return /* glsl */ `
  float leaf = smoothstep(0.004, 0.020, vVCol.g - vVCol.r);
  float folFp = length(fwidth(vWorld));
  if (leaf > 0.0) {
    float tuft = ${grain === 1 ? 'folTuft(vWorld, folFp)'
      : `folTuft(vWorld * ${grain.toFixed(2)}, folFp * ${grain.toFixed(2)})`};
    float lift = mix(0.58, 1.40, clamp(tuft, 0.0, 1.0));
    float warm = smoothstep(0.60, 0.88, tuft);
    ${cut ? `
    // rim is 0 square on and 1 edge on.
    vec3 V = normalize(uCamPos - vWorld);
    float rim = 1.0 - abs(dot(normalize(vNormal), V));
    // How well a needle tuft is resolved here: one is about a third of a
    // metre across, and it is worth drawing as a star while it is seven
    // pixels or more. Past that the value noise above answers alone.
    //
    // And only on a conifer. The pine and the cypress are much greener than
    // they are red — (g - r) / g is 0.29 to 0.47 on every one of them — and
    // the olive and the maquis are grey-greens at 0.12 to 0.15, so the same
    // ratio that finds the leaves finds the needles, and it does not care
    // how brightly the crown gradient has painted the vertex. The olive was
    // given the tufts too, at a finer grain and without spikes, and came out
    // a bunch of grapes: a broadleaf's leaves are far below a pixel at any
    // distance you see its crown from, and the value noise is the right
    // answer for it all the way in.
    float needle = smoothstep(0.20, 0.26, (vVCol.g - vVCol.r) / max(vVCol.g, 1e-3))
      * ${needles ? '1.0' : '0.0'};
    float kStar = (1.0 - smoothstep(0.030, 0.075, folFp)) * needle;
    if (kStar > 0.5) {
      // The tuft, seen face on: the offset to its centre flattened onto the
      // screen, and its bearing round that centre. Thirteen needles, and the
      // radius runs out along each of them and back between them, so the
      // edge of a tuft is spikes and not a disc.
      vec4 cc = folCell(vWorld * 3.1);
      vec3 Ux = normalize(cross(V, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));
      vec3 Wy = cross(Ux, V);
      vec2 q = vec2(dot(cc.xyz, Ux), dot(cc.xyz, Wy));
      float ang = atan(q.y, q.x);
      float nd = 0.5 + 0.5 * sin(ang * 13.0 + cc.w * 31.0);
      nd = nd * nd * nd;
      // The distance is the 3D one and the bearing the screen one. Measured
      // on the screen alone, nearly every pixel is within a tuft's radius of
      // some centre — depth is thrown away — and the first cut of this chewed
      // nothing: the puffs kept every one of their corners.
      float d = length(cc.xyz);
      float R = 0.34 + 0.22 * nd;
      float inT = R - d;
      // Discarded outside every tuft towards the rim, and only the cores of
      // them right at it, so the outline is needle tips; in the middle of
      // the crown only in the deep gaps, which is where the sky shows
      // through a real one.
      //
      // Over the outer HALF of the rim and not the last few pixels of it,
      // and that is the number that matters. A puff's straight edges are
      // half a metre long, and its normal is the smooth ellipsoid's while
      // its outline is jagged, so the rim only reaches one on the parts of
      // the outline that happen to stick out. Eroded over the last few
      // pixels, every one of those straight edges survived with a fringe on
      // it; eroded to the depth of a tuft, they are gone.
      float rimT = smoothstep(0.04, 0.55, rim);
      if (leaf > 0.5 && inT < mix(-0.30, 0.24, rimT) + (0.5 - tuft) * 0.7 * rimT) discard;
      // Inside a tuft its centre is the mass and the tips are lit; outside
      // one is the dark of the crown behind. And the needles themselves, as
      // a streak of light along each.
      float body = clamp(inT / R, -1.0, 1.0);
      float star = body > 0.0 ? mix(0.95, 1.30, nd) * (0.80 + 0.35 * body)
        : 0.50 + 0.35 * (1.0 + body);
      lift = mix(lift, lift * 0.35 + star * 0.75, kStar);
      warm = mix(warm, smoothstep(0.1, 0.9, nd) * step(0.0, inT), kStar * 0.7);
    }
    // Further out the value field does the chewing: a pixel whose tuft is
    // weaker than the rim is steep goes, over the same outer half of the rim
    // and for the same reason. Faded with the tuft octave, so an outline the
    // tuft cannot be resolved in keeps the polygon it has rather than
    // dissolving into noise. This is the one that matters from the
    // promenade: a pine in the stand is thirty to a hundred metres off for
    // most of the walk, and that is the range the old crowns showed their
    // corners at.
    float kCut = kStar > 0.5 ? 0.0 : 1.0 - smoothstep(0.07, 0.26, folFp);
    if (leaf > 0.5 && tuft < (0.10 + 0.72 * smoothstep(0.04, 0.60, rim)) * kCut) discard;` : ''}
    // Pockets to about three fifths, caps up two fifths: a little brighter
    // on the mean than the vertex colour, which the crown gradient had
    // already darkened for the underside.
    base *= mix(1.0, lift, leaf);
    // And the brightest caps towards the yellow on every sunlit tip in the
    // survey. Blue down and red up, so it is a warmer green and not a paler one.
    base *= mix(vec3(1.0), vec3(1.12, 1.07, 0.74), leaf * warm * 0.75);
    // 1.536.0: and from the air. The note the last pass left was that the
    // far wood "barely changed from the air — dark domes", and against the
    // drone reel it is the TOPS that are wrong: seen from above a sunlit
    // Aleppo canopy is a mid olive, yellowing on the crowns, with the dark
    // in the gaps between them; the game's was one bottle green over the
    // lot. So the upward faces of a crown seen from ABOVE — the eye looking
    // down on it by more than about ten degrees, which is never the crown
    // over your head and never the wood seen across the promenade — take
    // a third more light and a little yellow (two fifths turned the
    // resort's own brighter pines lime from forty metres). First cut keyed this off
    // pixel footprint instead, and from forty metres up a crown's pixel is
    // five centimetres: nothing changed where it was meant to.
    float crownTop = smoothstep(0.30, 0.90, n.y);
    vec3 eyeTo = uCamPos - vWorld;
    float fromAbove = smoothstep(0.12, 0.45, eyeTo.y / max(length(eyeTo), 1e-3));
    base *= mix(vec3(1.0), vec3(1.32, 1.26, 1.00), leaf * crownTop * fromAbove);
  }`;
}

/**
 * The crowns in the wind (1.536.0).
 *
 * Every tree in the game stood dead still in a nine-metre lebić, and the
 * grass at their feet now moves. What a crown does in a steady breeze is a
 * slow lean and return with the gusts, the whole crown together, and a
 * quicker shiver on top of it that differs from one bough to the next. So:
 * a gust wave travelling downwind, a slow sway phased by where the crown
 * is, and a small vertical shiver phased by height, together five to eight
 * centimetres at the default wind. Leaves only — the vertex colour's leaf
 * test, the same one the fragment uses — so a trunk stays planted and the
 * crown moves over it. The shadow pass does not sway: the crowns' shadows
 * are the far cascade's business and a few centimetres of lag in them is
 * nothing anybody can see.
 */
const GLSL_CROWN_WIND = /* glsl */ `
uniform vec2 uWind;
uniform float uWindSpeed;
uniform float uTime;
vec3 crownWind(vec3 wp, float k){
  if (k <= 0.0) return vec3(0.0);
  float ws = clamp(uWindSpeed, 0.0, 22.0);
  vec2 wd = normalize(uWind + vec2(1e-5));
  vec2 q = mod(wp.xz, 512.0);
  float along = dot(q, wd);
  float gust = 0.6 + 0.4 * sin(along * 0.05 - uTime * (0.4 + ws * 0.03));
  float sway = sin(uTime * 0.9 + dot(q, vec2(0.031, 0.027))) * 0.5
    + sin(uTime * 2.3 + q.x * 0.21 + wp.y * 0.35) * 0.22;
  float amp = (0.012 + 0.0045 * ws) * k;
  vec2 d = wd * amp * (gust + sway);
  return vec3(d.x, sin(uTime * 3.1 + q.y * 0.4 + wp.y * 1.3) * amp * 0.22, d.y);
}
`;

/**
 * After the light: the sun through the crown. viewDir runs from the eye to
 * the pixel, so it lines up with the sun exactly when you are looking into
 * it. Strongest where the surface faces away from the sun (that is the side
 * the light is coming out of) and still taken in the crown's own shadow at a
 * quarter, because the shadow map is a surface and a crown is not.
 */
const FOLIAGE_LIT = /* glsl */ `
  if (leaf > 0.0) {
    float into = pow(max(dot(viewDir, uSunDir), 0.0), 5.0);
    float thru = (1.0 - ndl * 0.7) * (0.25 + 0.75 * sh);
    col += base * uSunColor * uSunI * INV_PI * leaf * into * thru * 0.85;
  }
`;

/**
 * And the shadow, which has to be chewed as well, or it is the shadow of the
 * balloons. `20260821_175924` has the ground under the stand dappled rather
 * than shaded, and this is the whole of that: the depth pass discards the same
 * tuft field, thresholded low so it opens holes in the pockets and not across
 * the whole crown. The caster draws back faces only (see casterMaterial), so a
 * hole there is a hole in the far side of a closed puff, which is a hole the
 * sun gets through.
 *
 * Faded by texel footprint like everything else: fwidth in the depth pass is
 * the size of a shadow texel on the surface. 5.4 cm in the near cascade and
 * the holes are there; a metre and more in the far one and they are not,
 * because a hole the map cannot hold is a speckle that swims as the sun moves.
 */
const FOLIAGE_CASTER_VERT = /* glsl */ `
attribute vec3 aInstPos;
attribute vec4 aInstRot;
attribute vec3 aInstScale;
attribute vec3 aVCol;
uniform float uInstanced;
varying float vDepth;
varying vec3 vFolW;
varying vec3 vFolC;
vec3 qrot(vec4 q, vec3 v){
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
void main(){
  vec3 p = position;
  if (uInstanced > 0.5) {
    p *= aInstScale;
    p = qrot(aInstRot, p);
    p += aInstPos;
  } else {
    p = (modelMatrix * vec4(position, 1.0)).xyz;
  }
  vFolW = p;
  vFolC = aVCol;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vDepth = gl_Position.z / gl_Position.w * 0.5 + 0.5;
}
`;

const FOLIAGE_CASTER_FRAG = /* glsl */ `
precision highp float;
varying float vDepth;
varying vec3 vFolW;
varying vec3 vFolC;
${GLSL_PACK}
${GLSL_FOLIAGE}
void main(){
  float fp = length(fwidth(vFolW));
  float kM = 1.0 - smoothstep(0.07, 0.26, fp);
  if (vFolC.g - vFolC.r > 0.012 && kM > 0.0) {
    if (folTuft(vFolW, fp) < 0.34 * kM) discard;
  }
  gl_FragColor = packDepth(clamp(vDepth, 0.0, 1.0));
}
`;

const _treeCasters = {};
/**
 * The depth material for anything drawn with treeMaterial — one per kind,
 * shared, so registering every tree layer and the resort's own trees costs
 * two programs and nothing a caster.
 */
function treeCaster(shadow, instanced) {
  const k = instanced ? 'inst' : 'plain';
  if (!_treeCasters[k]) {
    _treeCasters[k] = shadow.casterMaterial(FOLIAGE_CASTER_VERT,
      { uInstanced: { value: instanced ? 1 : 0 } }, FOLIAGE_CASTER_FRAG);
  }
  return _treeCasters[k];
}

/**
 * The one material every tree in the game is drawn with — the instanced
 * landscape here, and since 1.534.0 the hand-planted pines and olives at
 * Jadrija as well (`arbor` in 43-jadrija.js), so a pine in the stand and a
 * pine in the wood behind it are the same bark and the same needles.
 *
 * `cut` is whether the foliage may chew its own outline — see GLSL_FOLIAGE.
 * The near models and the hand-planted trees may; the far model may not,
 * because a `discard` anywhere in a program switches off early depth for the
 * whole draw, and the far layer is thirty-odd thousand trees a frame whose
 * outline is under a pixel of tuft at the distances it is drawn at anyway.
 */
/**
 * `needles: false` (1.536.0) is for the broadleaved shrubs at Jadrija — the
 * clipped hedge, the evergreen mass behind the palisade, the lavender, the
 * ivy — which are green enough to pass the conifer test on colour alone and
 * came out as bushes of pine stars. Everything else about the crown is theirs
 * too: the tufts, the chewed outline, the light through the edge.
 *
 * `grain` scales the tuft field finer. A lavender mound is half a metre
 * across and a tree's tufts are sized for a crown of eight: at grain 1 the
 * 0.75 m octave cut each mound into three or four leaves the size of a hand,
 * and a bed of lavender became a bed of lettuce.
 */
function treeMaterial({ instanced = true, cut = false, emissive = 0, needles = true,
  grain = 1 } = {}) {
  return solidMaterial(0xffffff, {
    instanced,
    spec: 0.03,
    specPower: 12,
    emissive,
    side: THREE.DoubleSide,
    decl: GLSL_FOLIAGE,
    uniforms: { uWind: U.uWind, uWindSpeed: U.uWindSpeed },
    vdecl: GLSL_CROWN_WIND,
    // Instanced, p is the prototype's frame: the sway is found in the world
    // and turned back, and grows with height up the tree so the lowest
    // boughs barely move. The hand-planted trees are built in world metres.
    //
    // Not on the far layer. Measured, swapping the programs every twenty
    // frames in one page: on all of them it cost -0.1 ms at t 330 and
    // +0.4 at the verge, which is noise, so this is not about the budget —
    // the far layer is trees whose pixel is bigger than a five-centimetre
    // sway, and a vertex program that does nothing visible should not run.
    // The near layer and the resort's own trees (`cut`, the ones close
    // enough to have an outline) are where it shows.
    vert: !cut ? '' : instanced ? `
      {
        float lf = smoothstep(0.004, 0.020, aVCol.g - aVCol.r);
        if (lf > 0.0) {
          vec3 wp = aInstPos + qrot(aInstRot, p * aInstScale);
          float k = lf * smoothstep(0.5, 9.0, p.y * aInstScale.y);
          vec3 d = crownWind(wp, k);
          p += qrot(vec4(-aInstRot.xyz, aInstRot.w), d) / max(aInstScale, vec3(1e-3));
        }
      }` : `
      {
        float lf = smoothstep(0.004, 0.020, aVCol.g - aVCol.r);
        if (lf > 0.0) p += crownWind(p, lf);
      }`,
    // The prototype carries bark and leaf in its vertex colours; the per
    // instance colour is the individual's own tint and its charring.
    //
    // Then the bark, which is the one thing at Jadrija you stand right next
    // to. _344/_345/_347: grey-brown plates with orange-red inner bark at
    // the seams. Three things make this cheap enough to put on forty
    // thousand trees.
    //
    // It is masked by species, off the vertex colour rather than off a
    // second attribute or a second draw: only the pine is plated, and the
    // pine is the only bark warm enough to clear the threshold. It is
    // masked by pixel footprint, so a tree far enough away that a plate is
    // sub-pixel pays nothing at all and, more to the point, does not
    // shimmer — the same lesson as the whitecaps and the needle floor, that
    // a threshold the pixel cannot resolve is a mark and not a fainter
    // version of the thing. And the noise is two-plane rather than 3D,
    // blended by which way the surface faces, because a trunk is vertical
    // and the two planes that matter are the two vertical ones.
    //
    // The seam colour is multiplied by vColor so a charred tree gets
    // charred seams. Orange fissures on a black trunk would be embers.
    body: [
      'base *= vVCol;',
      'n = gl_FrontFacing ? n : -n;',
      'float plated = smoothstep(0.058, 0.086, vVCol.r - vVCol.g)',
      // 0.030 to 0.100, which is full strength to about eleven metres and
      // gone by thirty-six. The needle floor's 0.012/0.055 was copied here
      // first and it is a GROUND number: a floor is seen at a grazing angle
      // so its footprint runs away with distance, and a trunk is seen
      // square on. At those thresholds the plates died at four metres and
      // the only bark in the wood was the bottom of the nearest tree.
      '  * (1.0 - smoothstep(0.018, 0.060, length(fwidth(vWorld))));',
      'if (plated > 0.002) {',
      // Which plane a face is parameterised by is the OTHER two axes, not
      // the one it faces. Written the intuitive way round, a surface whose
      // normal is mostly +X samples noise in x and y, and x barely changes
      // across that face, so the plates collapse into horizontal bands
      // around the trunk. Every trunk in the wood was a stack of rings.
      '  vec2 nb = abs(normalize(vNormal).xz);',
      '  float wx = nb.x / (nb.x + nb.y + 1e-4);',
      // Value noise and not fbm2, and that is why the first three cuts of
      // this were invisible. A seam is a threshold and a threshold needs a
      // distribution wide enough to cut: fbm2 averages its octaves, so two
      // of them pile up around 0.5 with a spread of about 0.12 and a cut at
      // 0.36 catches almost nothing. Rendering f straight to the screen is
      // what showed it — grey trunks, one dark patch on one tree in ten.
      // A single vnoise2 uses the whole of 0 to 1; the second tap is
      // weighted a fifth, enough to break the lattice and not enough to
      // narrow the spread again. Plates run 0.16 m around the trunk and
      // 0.48 m up it, which is what the frames show.
      '  vec2 px = vec2(vWorld.x * 10.0, vWorld.y * 5.0);',
      '  vec2 pz = vec2(vWorld.z * 10.0, vWorld.y * 5.0) + 19.7;',
      // The second tap is ROTATED as well as scaled, which is the same
      // 1.71/-1.06 matrix fbm2 uses and for the same reason: two value
      // noises on the same axes share a lattice, and what came out was a
      // trunk of diagonal parallelograms. A regular pattern is worse than
      // no pattern.
      '  mat2 rot = mat2(1.71, -1.06, 1.06, 1.71);',
      '  float f = mix(vnoise2(px) * 0.80 + vnoise2(rot * px + 11.3) * 0.20,',
      '                vnoise2(pz) * 0.80 + vnoise2(rot * pz + 11.3) * 0.20, wx);',
      // ── 1.534.0: THE PLATES ARE CELLS, AND THE SEAMS ARE THEIR EDGES ──────
      //
      // What follows used to take a level set of `f` for the seams — the
      // distance to its half value, cut at a finger's width — and that is
      // right for a trunk you see at ten metres and wrong at one. A level set
      // of smooth noise is a family of closed round loops; on the old prism
      // trunks, which were seen from the promenade, that read as a network,
      // and on the round trunks of the stand at arm's length it read as
      // contour lines on a map, then (with the plates stretched) as a
      // giraffe. Held against the big trunk on the right of `_175924`, bark
      // is a MOSAIC: flat grey-brown plates, each a little lighter or darker
      // than its neighbour, three or four times as tall as they are wide, and
      // between them a narrow dark crack that is a shadow before it is a
      // colour. The orange is at the bottom of the deepest cracks and not
      // along every one of them.
      //
      // A mosaic is a Voronoi diagram, and the crack is where the nearest and
      // second-nearest cell centres are equally far: F2 - F1, under a tenth
      // of a cell. `barkCell` does it on the same two vertical planes as
      // above, stretched 7.5 round and 2.5 up so a plate is about 13 cm by
      // 40. `f` stays, as the weathering across a plate.
      '  vec3 cX = barkCell(vec2(vWorld.x * 7.5, vWorld.y * 2.5));',
      '  vec3 cZ = barkCell(vec2(vWorld.z * 7.5, vWorld.y * 2.5) + 19.7);',
      '  float edge = mix(cX.x, cZ.x, wx);',
      '  float pid = wx < 0.5 ? cX.y : cZ.y;',
      // Grey-brown plates, a good deal greyer than the vertex colour the
      // species test needs. Each its own shade, weathered across its face,
      // and rounded off into the crack rather than cut square.
      '  float lum = dot(base, vec3(0.36, 0.42, 0.22));',
      '  base = mix(base, vec3(lum) * vec3(1.10, 1.0, 0.90), 0.50 * plated);',
      '  base *= 1.0 + plated * ((pid - 0.5) * 0.30 + (f - 0.5) * 0.35',
      '    - 0.34 * (1.0 - smoothstep(0.0, 0.35, edge)));',
      '  base = mix(base, vec3(0.070, 0.050, 0.040) * vColor,',
      '             (1.0 - smoothstep(0.03, 0.12, edge)) * 0.85 * plated);',
      '  base = mix(base, vec3(0.330, 0.120, 0.055) * vColor,',
      '             (1.0 - smoothstep(0.0, 0.035, edge)) * step(0.62, f) * 0.60 * plated);',
      '}',
    ].join('\n  ') + '\n  ' + foliageBody(cut, needles, grain),
    lit: FOLIAGE_LIT,
  });
}

// ── the olive, leaf by leaf (1.537.1) ────────────────────────────────────────
//
// Misha, 27 Sep 2026, a frame from the hammock looking over the lane wall:
// "great job on the vegetation/trees, but i notice some trees like this one
// still looks like crap ... the tall trees look amaze". The tree was an
// olive, and it was the last thing at Jadrija still drawn the way the pines
// were drawn before 1.534.0: nine smooth puffs half a metre to a metre across
// on four straight sticks, one flat grey-green, with the pine's value noise
// on them. At grain 1 that noise's 0.75 m octave cuts a one-metre puff into
// three or four soft lobes, and a soft-shaded lobe that size is a leaf of
// lettuce — which is exactly what the frame showed: cabbages on poles, the
// ragged rim reading as crumpled paper.
//
// What an olive's crown IS, held against any tree on the Dalmatian coast: a
// great many small sprays of narrow leaves, five to eight centimetres by one
// and a half, dark grey-green on top and SILVER underneath, the sprays hung
// along crooked branches with daylight between them. The silver is the
// species: a crown of leaves each showing one face or the other at random is
// a two-tone speckle nothing else on this shore has, and in any breath of
// wind it shimmers. None of that can be a polygon at the number of olives
// here, so as with the needles it is drawn per pixel, and the geometry is
// only the clusters (small puffs, 43-jadrija.js `olive`) and the wood.
//
//   · THE LEAVES. The nearest spray centre on a 3D cell grid (`folCell`, the
//     needle tufts' own scatter, at 16 cm), seen face on, drawn as a twig
//     with three opposite pairs of lanceolate leaves up it and one at the end
//     — widest a third of the way out, pointed, one to four and a half wide,
//     five to eight centimetres long. The first cut fanned eight leaves round
//     a point at the golden angle, and looking up into the crown that was a
//     tree full of hands: a palmate leaf is a horse chestnut, or worse, and
//     not an olive. `oliveSpray` hands back which leaf, how far along it and
//     how far across, so a leaf can have a midrib, its own tilt of the normal
//     (the light breaks up leaf by leaf, which is what makes foliage read as
//     foliage and not as a surface) and its own face: about a quarter show
//     the silver side, over half seen from underneath, which is where the
//     undersides face, and a spray in three is turned over whole.
//   · RESOLVED OR NOT. A leaf is never drawn thinner than about a pixel: past
//     four metres (a pixel of six millimetres at 720p) the leaves THICKEN
//     rather than break up into sparks, so at ten metres a spray is a small
//     herringbone of them, which is the speckle the real tree is at ten
//     metres. The midrib and the tilted normal go at sixteen millimetres a
//     pixel, and the silver comes halfway back towards the top face's colour
//     between six and thirty — the first cut kept it at full strength and
//     from the vikendica's terrace the three olives were in white blossom.
//     Past five centimetres a pixel (about thirty metres) the value noise
//     alone, at 2.2x the pine's grain, and a two-tone mottle; the octave that
//     made the lettuce is gone with the grain.
//   · THE OUTLINE AND THE HOLES. Close to, only leaves are drawn: everything
//     between them is discarded, and what shows through is the far side of
//     the cluster, the next cluster, or sky. Further out a pixel between
//     sprays goes on the rim of a cluster or in a pocket of the tuft field,
//     and elsewhere is the dark inside of the crown. Olive crowns are open —
//     sky through them all over, not only at the edge — so this cuts deeper
//     than the pine's.
//
// The wood has its own bark, too. The plate shader in `treeMaterial` is keyed
// to PINEBARK's warmth and the olive was deliberately grey enough to miss it,
// which left it the one trunk at Jadrija with nothing on it at all: a smooth
// grey tube. An old olive's bark is grey and cut into small, twisted blocks by
// fissures that follow the spiral of the grain — so `barkCell` again, on
// three planes because olive limbs go every way, sheared so the cracks lean,
// and a few pale lichen blotches.
//
// Its own material rather than a mode of `treeMaterial`: every pixel of this
// mesh is olive, so nothing has to be told apart by colour, and the pines and
// the landscape's instanced olives — approved and far away respectively —
// are not recompiled or touched. It costs one draw and one caster.
const GLSL_OLIVE = /* glsl */ `
float olH(float a){ return fract(sin(a) * 43758.5453); }
// One spray, seen face on: a twig with its leaves in opposite pairs up it and
// one at the end, which is how an olive carries them. The first cut fanned
// eight leaves round a point, and from underneath that is a hand — a palmate
// leaf, horse chestnut or worse — not an olive. q is the offset from the
// spray's centre on the screen in cell units, seed its own number, thick a
// width added to every leaf so none is ever thinner than a pixel. x: signed
// distance to the nearest leaf's edge (negative inside, cell units); y: that
// leaf's own number, or -1 on the twig; z: how far along it, 0 at the stalk
// and 1 at the tip; w: across it, -1 to 1.
vec4 oliveSpray(vec2 q, float seed, float thick){
  vec4 o = vec4(9.0, 0.0, 0.0, 0.0);
  float ta = seed * 6.2831;
  vec2 t = vec2(cos(ta), sin(ta));
  vec2 tp = vec2(-t.y, t.x);
  float bend = (olH(seed * 5.1) - 0.5) * 0.9;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float h1 = olH(seed * 91.7 + fi * 37.13);
    float h2 = olH(seed * 13.3 + fi * 11.71 + 5.0);
    float side = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float pr = floor(fi * 0.5);
    float s0 = -0.30 + pr * 0.20;
    float a = i == 6 ? bend * 0.6 : side * (0.50 + 0.40 * h1) + bend * s0;
    vec2 d = t * cos(a) + tp * sin(a);
    vec2 r = q - (t * s0 + tp * bend * s0 * s0);
    float L = i == 6 ? 0.36 : 0.30 + 0.18 * h2;
    float u = dot(r, d) / L;
    if (u < 0.0 || u > 1.0) continue;
    float y = dot(r, vec2(-d.y, d.x));
    float w = L * 0.12 * pow(sin(3.14159 * pow(u, 0.72)), 0.8) + thick;
    float sd = abs(y) - w;
    if (sd < o.x) o = vec4(sd, h1 * 0.61 + h2 * 0.39, u, y / w);
  }
  float tu = dot(q, t);
  if (tu > -0.40 && tu < 0.32) {
    float sdT = abs(dot(q, tp) - bend * tu * tu) - (0.009 + thick * 0.5);
    if (sdT < 0.0 && sdT < o.x) o = vec4(sdT, -1.0, 0.0, 0.0);
  }
  return o;
}
`;

const OLIVE_BODY = /* glsl */ `
  base *= vVCol;
  float leaf = smoothstep(0.004, 0.020, vVCol.g - vVCol.r);
  // The discs inside a cluster (blue a shade over red in the vertex colour)
  // keep the ellipsoid normal they were given on both faces: flipped with the
  // face, half of every cluster's middle was lit as if from inside out. And
  // the blue marker is taken back out of the colour. How far over red it is
  // runs from 0.030 at a disc's middle to 0.006 at its rim, which is how the
  // edge is found below.
  float inner = leaf * step(vVCol.r + 0.003, vVCol.b);
  float discEdge = clamp(1.0 - (vVCol.b - vVCol.r - 0.006) / 0.024, 0.0, 1.0);
  if (inner > 0.5) base.b = base.r * 0.80;
  n = (gl_FrontFacing || inner > 0.5) ? n : -n;
  float folFp = length(fwidth(vWorld));
  // And the footprint of a pixel at this distance seen FACE ON, which is the
  // one the leaves' level of detail is keyed to. fwidth of the position is
  // constant across a triangle and depends on how obliquely it is seen, so
  // two neighbouring faces of a cluster could sit either side of a threshold
  // and draw the triangle's edge as a ruled line through the leaves — close
  // leaves on one face, the thickened far ones and the dark inside on the
  // next. The direction to the eye changes smoothly over the screen whatever
  // it lands on, so this does not.
  float folIso = length(uCamPos - vWorld) * length(fwidth(normalize(vWorld - uCamPos)));
  // ── the bark ──
  float kB = (1.0 - leaf) * (1.0 - smoothstep(0.014, 0.055, folFp));
  if (kB > 0.002) {
    vec3 an = abs(normalize(vNormal));
    vec3 wg = an / (an.x + an.y + an.z + 1e-4);
    // The planes each face is parameterised by are the OTHER two axes (see
    // the pine's plates), and the vertical one is sheared by height so the
    // fissures lean with the twist of the grain.
    // Cells 4 cm round and 20 tall: the blocks of an old olive's bark are
    // long, and 4.5 by 12 was a crocodile.
    vec3 cX = barkCell(vec2(vWorld.z * 25.0 + vWorld.y * 2.2, vWorld.y * 5.0));
    vec3 cZ = barkCell(vec2(vWorld.x * 25.0 - vWorld.y * 2.2, vWorld.y * 5.0) + 19.7);
    vec3 cY = barkCell(vec2(vWorld.x * 16.0, vWorld.z * 16.0) + 7.3);
    float edge = cX.x * wg.x + cY.x * wg.y + cZ.x * wg.z;
    float pid = wg.x > wg.z ? (wg.x > wg.y ? cX.y : cY.y) : (wg.z > wg.y ? cZ.y : cY.y);
    // And the furrows the blocks sit in: long soft streaks up the stem,
    // which is most of what the bark is from two metres.
    float fw = folN(vec3(vWorld.x * 13.0, vWorld.y * 1.5 + vWorld.x * 3.0, vWorld.z * 13.0));
    base *= 1.0 + kB * ((pid - 0.5) * 0.24 + (fw - 0.5) * 0.55
      - 0.30 * (1.0 - smoothstep(0.0, 0.32, edge)));
    base = mix(base, vec3(0.070, 0.064, 0.058) * vColor,
      (1.0 - smoothstep(0.02, 0.09, edge)) * 0.62 * kB);
    float lich = smoothstep(0.70, 0.84, folN(vWorld * 4.3 + 3.1));
    base = mix(base, vec3(0.56, 0.57, 0.47) * vColor, lich * 0.40 * kB);
  }
  // ── the leaves ──
  if (leaf > 0.0) {
    vec3 V = normalize(uCamPos - vWorld);
    float rim = 1.0 - abs(dot(normalize(vNormal), V));
    float rimT = smoothstep(0.04, 0.55, rim);
    float tuft = folTuft(vWorld * 2.2, folFp * 2.2);
    float lum = dot(base, vec3(0.30, 0.55, 0.15));
    // The underside is a pale felted grey-green, not white: past a few
    // metres, where one leaf is a pixel or two, a white one is a speck of
    // blossom and a crown of them is a tree in flower. So the silver comes
    // down towards the mean of the two faces as the leaves go sub-pixel.
    float silverK = mix(1.0, 0.55, smoothstep(0.006, 0.030, folIso));
    vec3 silverC = mix(base, vec3(lum) * vec3(1.34, 1.44, 1.36), silverK);
    // Paler and greyer than the pine beside it, which is how an olive grove
    // reads from anywhere: a quarter of the way to its own grey.
    vec3 topC = mix(base, vec3(lum), 0.25) * vec3(1.02, 1.08, 0.98);
    // Far: the two-tone mottle and the value field's lift.
    float mott = folN(vWorld * 17.0 + 2.7);
    vec3 farC = mix(topC, silverC, smoothstep(0.52, 0.74, mott) * 0.55)
      * mix(0.62, 1.28, clamp(tuft, 0.0, 1.0));
    vec3 leafCol = farC;
    float kSpray = 1.0 - smoothstep(0.026, 0.050, folIso);
    float kLeaf = 1.0 - smoothstep(0.0065, 0.016, folIso);
    float cut = 0.0;
    if (kSpray > 0.0) {
      vec4 cc = folCell(vWorld * 6.25);
      vec3 Ux = normalize(cross(V, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));
      vec3 Wy = cross(Ux, V);
      vec2 q = vec2(dot(cc.xyz, Ux), dot(cc.xyz, Wy));
      // Depth thrown away is every pixel near some centre (see the needles):
      // a centre well in front of or behind the surface gets a smaller spray.
      float dz = abs(dot(cc.xyz, V));
      q *= 1.0 + max(dz - 0.18, 0.0) * 2.2;
      // A leaf is never drawn thinner than about a pixel: past four metres
      // they thicken instead of breaking up into sparks, and by the time the
      // spray is a few pixels across it is a herringbone of them.
      float thick = max(folIso * 6.25 * 0.55 - 0.006, 0.0);
      vec4 lf = oliveSpray(q, cc.w, thick);
      float inL = lf.x < 0.0 ? 1.0 : 0.0;
      // Some two in five show their undersides — more seen from under the
      // crown, which is where the undersides face — and some whole sprays
      // are turned over.
      float silverSpray = step(0.70, fract(cc.w * 3.7));
      float fromBelow = clamp(-V.y / 0.8, 0.0, 1.0);
      float under = step(0.72 - 0.30 * fromBelow - 0.30 * silverSpray, fract(lf.y * 7.31));
      vec3 lc = mix(topC * (0.80 + 0.40 * fract(lf.y * 3.17)), silverC * (0.88 + 0.22 * lf.z), under);
      // The midrib, a thread of light down the middle of each.
      lc *= 1.0 + 0.16 * kLeaf * (1.0 - smoothstep(0.0, 0.22, abs(lf.w))) * (1.0 - lf.z);
      if (lf.y < 0.0) lc = vec3(0.20, 0.18, 0.15) * vColor;
      // Outside every leaf: the inside of the crown, darker, where it is not
      // cut away. Close to, it all is: only leaves are drawn.
      leafCol = mix(leafCol, inL > 0.5 ? lc : topC * 0.40, kSpray);
      float gap = (kLeaf > 0.5 || rimT > 0.20 || tuft < 0.42) ? 1.0 : 0.0;
      cut = inL < 0.5 ? gap : 0.0;
      // Leaves too, on the steep rim of a cluster's shell, each spray at its
      // own depth into it. Where a surface turns edge on there is a lot of
      // it per pixel, so the sprays crowd there: a cluster seen from under
      // was a ring of leaves round an empty middle, and one seen along its
      // flat bottom showed the polygon's straight edges drawn in leaves. Cut
      // on the smooth normal's rim, the edge is a curve and the crowd thins.
      if (inner < 0.5 && rim > 0.60 + 0.32 * fract(cc.w * 5.3)) cut = 1.0;
      if (inL > 0.5 && kLeaf > 0.5 && lf.y >= 0.0) {
        // Each leaf its own tilt, so the light breaks up leaf by leaf; the
        // tops are waxy and catch a highlight, the undersides are felt.
        vec3 tl = vec3(olH(lf.y * 51.3), olH(lf.y * 77.9), olH(lf.y * 23.1)) - 0.5;
        n = normalize(n + tl * 1.1);
        spec = mix(0.10, 0.015, under);
        env = 0.0;
      }
    }
    // And far out, the value field chews the outline as the pine's does.
    float kCut = 1.0 - smoothstep(0.08, 0.30, folIso);
    float farCut = tuft < (0.12 + 0.70 * smoothstep(0.04, 0.60, rim)) * kCut ? 1.0 : 0.0;
    cut = mix(farCut, cut, kSpray);
    // And none within half a metre of the eye. A camera that ends up in a
    // cluster anyway (third person, the swing of the hammock) sees its far
    // wall as loose sprays hung in the air, so the leaves go: all of them
    // under 0.35 m, a dithered fraction out to 0.6.
    // A disc's straight edge is eroded by the tuft field, leaves and all.
    if (inner > 0.5 && discEdge > 0.40 + 0.55 * tuft) cut = 1.0;
    float eyeD = length(uCamPos - vWorld);
    float nearK = smoothstep(0.35, 0.60, eyeD);
    if (nearK < 1.0 && olH(dot(floor(gl_FragCoord.xy), vec2(1.0, 57.0)) * 0.013) > nearK) cut = 1.0;
    if (leaf > 0.5 && cut > 0.5) discard;
    base = mix(base, leafCol, leaf);
  }
`;

/**
 * The olive's material — see the note above GLSL_OLIVE. The resort's olives
 * only (`olives` in 43-jadrija.js); it casts with `treeCaster` like `arbor`.
 */
function oliveMaterial() {
  return solidMaterial(0xffffff, {
    instanced: false,
    spec: 0.03,
    specPower: 18,
    emissive: 0.10,
    side: THREE.DoubleSide,
    decl: GLSL_FOLIAGE + GLSL_OLIVE,
    uniforms: { uWind: U.uWind, uWindSpeed: U.uWindSpeed },
    vdecl: GLSL_CROWN_WIND,
    vert: `
      {
        float lf = smoothstep(0.004, 0.020, aVCol.g - aVCol.r);
        if (lf > 0.0) p += crownWind(p, lf);
      }`,
    body: OLIVE_BODY,
    lit: FOLIAGE_LIT,
  });
}

function buildTrees(scene, fire) {
  const protos = { far: vegPrototypes(), near: vegNearPrototypes() };
  const T = VEG.tile;

  const layers = {};
  for (const s of SPECIES) layers[s] = {};
  for (const lod of ['near', 'far']) for (const s of SPECIES) {
    const src = protos[lod][s];
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', src.attributes.position);
    geo.setAttribute('normal', src.attributes.normal);
    geo.setAttribute('aVCol', src.attributes.aVCol);
    geo.setIndex(src.index);
    // Placed entirely by instance attributes, so the prototype's bounds mean
    // nothing — culling is done per tile on the CPU.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

    const cap = lod === 'near' ? VEG.nearMax : VEG.budget;
    const aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const aRot = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const aScale = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    const aColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    for (const [n, a] of [['aInstPos', aPos], ['aInstRot', aRot],
      ['aInstScale', aScale], ['aInstColor', aColor]]) {
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(n, a);
    }

    const mat = treeMaterial({ instanced: true, cut: lod === 'near' });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    layers[s][lod] = { geo, mesh, aPos, aRot, aScale, aColor, cap, count: 0 };
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

    // Jadrija answers for its own headland — see `grove` in 43-jadrija.js. The
    // peninsula is baked URBAN and GROWS[URBAN] is a cypress every twenty
    // metres, which is a suburb; what is there is a pine wood with a village
    // in it. `grove` is consulted per dart below, and the tile is asked once,
    // up front, whether it is worth throwing the second handful at all.
    const grove = typeof jadrija !== 'undefined' && jadrija && jadrija.grove
      && jadrija.grove.tile(ox, oz, T) ? jadrija.grove : null;

    // Nothing grows off the edge of the world. coverAt() and groundAt() both
    // clamp to the border texel, so a tile beyond the boundary inherits whatever
    // the last row of the map happened to say and plants a forest on the open
    // sea plane where no terrain is drawn at all. Raising the draw radius from
    // 1 500 m to 2 200 m is what made this visible from inside the world.
    const EDGE = CONFIG.world / 2 - 20;

    // A second handful over the headland, and it has to be a second handful
    // rather than a bigger table, because a per-dart probability cannot exceed
    // one: at 2 100 darts over a 512 m tile the closest any species can be
    // planted is one every eleven metres, and the wood at Jadrija is one every
    // five or six. The extra darts are the wood's alone — past the tile's own
    // quota a point only plants if the headland claims it — so a tile that
    // overlaps the peninsula by a corner does not also thicken the hillside
    // behind it.
    const darts = VEG.perTile + (grove ? VEG.groveMore : 0);
    for (let i = 0; i < darts; i++) {
      const x = ox + rng() * T, z = oz + rng() * T;
      if (Math.abs(x) > EDGE || Math.abs(z) > EDGE) continue;
      // Not on the airfield. The land-cover raster has never heard of Rokići —
      // it is a fictitious field dropped onto real scrub — so without this the
      // apron grows cypresses and there is a pine through the runway.
      if (typeof airfield !== 'undefined' && airfield && airfield.inField
        && airfield.inField(x, z, 25)) continue;
      // Nor on the Jadrija concrete, for the same reason and one more: that
      // strip is the one place a tree is at eye height rather than under you,
      // so a pine standing in the middle of a bathing terrace is not a detail
      // you fly over and forgive. The pines that belong there are placed by
      // hand, in their planters, with the rest of the resort.
      if (typeof jadrija !== 'undefined' && jadrija && jadrija.inField
        && jadrija.inField(x, z, 6)) continue;
      const g = grove ? grove.at(x, z) : null;
      const table = g || (i < VEG.perTile ? GROWS[coverAt(x, z)] : null);
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
      const tree = {
        x, y, z,
        h,
        w: h * wide * (0.78 + rng() * 0.44) / ((lo + hi) * 0.5),
        yaw: rng() * TAU,
        // Individual tint: some are drier, some greener, and a flat forest of
        // identical trees reads as a texture rather than as trees.
        tint: 0.80 + rng() * 0.34,
        warm: rng() * 0.16,
      };
      // Ground the resort has cleared to build on (`GROUNDS` in
      // 43-jadrija.js) — asked only now, with every draw made, so that
      // dropping this tree leaves every other dart in the tile where it was.
      if (grove && grove.clear && grove.clear(x, z)) continue;
      out[pick].push(tree);
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
  let acc = 0, lastTx = 1e9, lastTz = 1e9, live = 0, closeUp = 0;
  // How far the grown model reaches this frame, which is not a constant any
  // more. See the note over VEG.nearWant.
  let nearR = VEG.near;
  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);

  function repack(camPos) {
    // Two cursors a species now: which model an instance is written into is a
    // function of its distance, and the species' share of the budget is the sum
    // of the two — a tree close enough to be worth its polygons is still a tree.
    const cursor = {}, used = {};
    for (const s of SPECIES) { cursor[s] = { near: 0, far: 0 }; used[s] = 0; }
    const nearR2 = nearR * nearR;
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
          const list = tile[s];
          for (let i = 0; i < list.length; i++) {
            if (used[s] >= cap) break;
            const t = list[i];
            const dx = t.x - camPos.x, dz = t.z - camPos.z;
            const d2 = dx * dx + dz * dz;
            if (d2 > R2) continue;
            // Close enough for the model with limbs on it, unless the ring is
            // already full — in which case it falls back to the far one rather
            // than being dropped, because a hole in the forest at 200 m is a
            // worse answer to a full buffer than a simpler tree is.
            const lod = d2 < nearR2 && cursor[s].near < layers[s].near.cap
              ? 'near' : 'far';
            const L = layers[s][lod];
            const c = cursor[s][lod];
            if (c >= L.cap) continue;
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

            cursor[s][lod] = c + 1;
            used[s]++;
          }
        }
      }
    }

    live = 0; closeUp = 0;
    for (const s of SPECIES) for (const lod of ['near', 'far']) {
      const L = layers[s][lod];
      L.count = cursor[s][lod];
      live += L.count;
      if (lod === 'near') closeUp += L.count;
      L.geo.instanceCount = L.count;
      L.aPos.needsUpdate = true;
      L.aRot.needsUpdate = true;
      L.aScale.needsUpdate = true;
      L.aColor.needsUpdate = true;
      L.mesh.visible = L.count > 0;
    }

    // ── how far the grown model reaches ──────────────────────────────────
    //
    // A near pine is 3 314 triangles and a far one is 128, so the ring is the
    // whole cost of the vegetation and a fixed radius cannot price it. On the
    // hillside above Rokići 190 m holds about fifty trees and is free. In the
    // wood at Jadrija the same 190 m holds three thousand, which is ten million
    // triangles for one species — and that only became possible when the
    // headland stopped being a suburb, so it has never had to be priced before.
    //
    // Capping the count alone would not do: which trees make the ring is
    // whatever order the tiles happen to iterate in, so a hard cap leaves a
    // far model at five metres and a grown one at a hundred and eighty. What
    // has to stay true is *nearest first*, and the only test that gives that
    // for free is the radius. So the radius is what moves: pull it in when the
    // ring is over its allowance, let it back out when there is room, and let
    // it pin at VEG.near wherever the country is open enough not to care.
    //
    // Solved rather than hunted. In a stand of anything the count inside the
    // ring goes as the square of its radius, so sqrt(want / got) is the whole
    // correction in one step and the loop is over in a repack or two — which
    // matters, because a repack is four tenths of a second and walking in off
    // the promenade must not cost eight seconds at seven million triangles.
    //
    // The step is clamped either way, and much tighter going out than coming
    // in: overshooting inwards costs a few trees their limbs for half a
    // second, overshooting outwards costs the frame.
    const want = Math.max(60, VEG.nearWant * clamp(density, 0.15, 1.4));
    nearR = clamp(nearR * clamp(Math.sqrt(want / Math.max(closeUp, 1)),
      0.72, 1.06), VEG.nearMin, VEG.near);
  }

  function update(dt, camPos) {
    if (density <= 0.001) {
      for (const s of SPECIES) for (const lod of ['near', 'far']) {
        layers[s][lod].mesh.visible = false;
      }
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
    update, layers,
    setDensity: (v) => { density = v; acc = 99; lastTx = 1e9; },
    getDensity: () => density,
    stats: () => ({ live, near: closeUp, tiles: tiles.size,
      tris: SPECIES.reduce((n, s) => n
        + layers[s].near.count * (protos.near[s].index.count / 3)
        + layers[s].far.count * (protos.far[s].index.count / 3), 0) | 0 }),
    /**
     * Debug: what one of each species costs, near and far. The near models are
     * grown and their cost is a consequence of a spec rather than of a list, so
     * it is not something you can count by reading the source any more.
     */
    /** How far the grown model currently reaches — see the feedback in repack. */
    nearR: () => +nearR.toFixed(1),
    /**
     * How wooded it is here, 0 to 1 — the fraction of a ring around (x, z)
     * that grows something with a trunk on it.
     *
     * Not a count of trees: it asks the same tables `makeTile` asks, so it is
     * a property of the *place* and not of whatever survived this frame's
     * instance budget. Sampled on a ring rather than at a point because what
     * it is for is a diffuse source — you are under a wood or you are not, and
     * standing in a gap between two pines does not stop the cicadas.
     */
    canopyAt: (x, z, r = 22) => {
      const grove = typeof jadrija !== 'undefined' && jadrija ? jadrija.grove : null;
      let hit = 0;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const table = (grove && grove.at(px, pz)) || GROWS[coverAt(px, pz)];
        if (table && (table.pine || table.olive || table.cypress)) {
          hit += Math.min(1, ((table.pine || 0) + (table.olive || 0)
            + (table.cypress || 0)) * 2.2);
        }
      }
      return clamp(hit / 6, 0, 1);
    },
    cost: () => Object.fromEntries(SPECIES.map((s) => [s,
      [protos.near[s].index.count / 3, protos.far[s].index.count / 3]])),
    /** Debug: the nearest planted tree of a species, for aiming a camera. */
    nearest: (species, x, z) => {
      let best = null, bd = Infinity;
      for (const t of tiles.values()) {
        for (const o of t[species] || []) {
          const d = (o.x - x) ** 2 + (o.z - z) ** 2;
          if (d < bd) { bd = d; best = o; }
        }
      }
      return best && { x: +best.x.toFixed(1), y: +best.y.toFixed(1),
        z: +best.z.toFixed(1), h: +best.h.toFixed(1), w: +best.w.toFixed(2),
        d: +Math.sqrt(bd).toFixed(1) };
    },
  };
}
