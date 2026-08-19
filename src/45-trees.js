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
  const bark = [0.30, 0.23, 0.17];

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
  }, rnd, bark, [0.09, 0.17, 0.11], [0.52, 1.42]);

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
  }, rnd, [0.33, 0.29, 0.24], [0.36, 0.41, 0.30], [0.62, 1.22]);

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
  }, rnd, bark, [0.26, 0.30, 0.19], [0.60, 1.26]);

  return { pine, cypress, olive, bush };
}

function vegPrototypes() {
  const bark = [0.30, 0.23, 0.17];
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
  ], S, 1, bark, [0.09, 0.17, 0.11]);

  // Olive: short, thick, gnarled, silver-green and much harder to set alight.
  const olive = vegGeo([
    vegRing(0.00, 0.064, S), vegRing(0.20, 0.050, S),
    vegRing(0.30, 0.44, S, 0.24), vegRing(0.46, 0.53, S, 0.23),
    vegRing(0.62, 0.56, S, 0.22), vegRing(0.80, 0.47, S, 0.21),
    vegRing(0.92, 0.32, S, 0.19), vegRing(1.00, 0.10, S),
  ], S, 2, [0.33, 0.29, 0.24], [0.36, 0.41, 0.30]);

  // Maquis: no trunk worth modelling, and the reason the whole coast goes up.
  const bush = vegGeo([
    vegRing(0.00, 0.42, B), vegRing(0.38, 0.58, B, 0.28),
    vegRing(0.74, 0.46, B, 0.26), vegRing(1.00, 0.10, B),
  ], B, 0, bark, [0.26, 0.30, 0.19]);

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

    // Nothing grows off the edge of the world. coverAt() and groundAt() both
    // clamp to the border texel, so a tile beyond the boundary inherits whatever
    // the last row of the map happened to say and plants a forest on the open
    // sea plane where no terrain is drawn at all. Raising the draw radius from
    // 1 500 m to 2 200 m is what made this visible from inside the world.
    const EDGE = CONFIG.world / 2 - 20;

    for (let i = 0; i < VEG.perTile; i++) {
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
  let acc = 0, lastTx = 1e9, lastTz = 1e9, live = 0, closeUp = 0;
  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);

  function repack(camPos) {
    // Two cursors a species now: which model an instance is written into is a
    // function of its distance, and the species' share of the budget is the sum
    // of the two — a tree close enough to be worth its polygons is still a tree.
    const cursor = {}, used = {};
    for (const s of SPECIES) { cursor[s] = { near: 0, far: 0 }; used[s] = 0; }
    const nearR2 = VEG.near * VEG.near;
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
