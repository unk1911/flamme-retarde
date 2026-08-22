// -----------------------------------------------------------------------------
// Jadrija.
//
// Everything else in this world is generated from data — the DEM, the land
// cover, thirteen thousand OpenStreetMap footprints — and that is the right way
// to build a coastline you fly over at three hundred metres. It is the wrong way
// to build somewhere you can now stand. From eye height the procedural town is a
// grey box with black rectangles painted on it, and the ground is a beige plane,
// because none of it was ever authored to be looked at from 1.62 m.
//
// So this one place is authored. Jadrija is the bathing resort on the tip of the
// Srima peninsula, at the seaward end of the St Anthony channel, and what makes
// it Jadrija is not its houses: it is the concrete. Terraces stepping down to the
// water, ladders bolted into the quay, and behind them the *kabine* — the rows of
// little wooden changing huts that have stood there since the 1920s and are a
// protected monument. There is nothing else like them in the bay and nothing else
// like them in this game.
//
// The whole thing is laid out in a frame that follows the real water's edge:
// `t` metres along the shore, `s` metres inland from the waterline. That frame is
// traced from `isSea` at load time rather than typed in, so the promenade cannot
// drift off the coast if the terrain is ever re-baked — and it is the same
// (along, across) shape the aerodrome uses, which is what lets the on-foot mode
// walk here without knowing where "here" is.
//
// OSM maps nothing within 39 m of the water along this stretch. That empty ribbon
// is exactly what the resort occupies in life, and it is what is built here.
// -----------------------------------------------------------------------------

const JAD = {
  // The built stretch of shore, as world x, centred on the `place=Jadrija` node
  // at x −2214. Beyond these the coast carries on and is left to the land cover,
  // which is correct: the resort is a couple of hundred metres of frontage, not
  // the whole peninsula.
  //
  // It used to be −2372…−2016, which traced out 411 m of shore, and that was
  // wrong by a factor of two. The measure of Jadrija is its kabine, and there
  // are about a hundred of them: two rows of fifty at 2.15 m of frontage each is
  // 107 m of hut per row, and with the alleys between the runs and the hole left
  // for the jetty that wants roughly 190 m of shore to stand on. 411 m gave room
  // for three hundred and twenty huts, and building three hundred and twenty of
  // them is not a bigger Jadrija, it is a different and imaginary place — one
  // you cross in a minute and a half at a dead run, past a wall of huts that
  // never ends. The shore runs about 31° off the x axis here, so 164 m of x is
  // the 191 m of frontage wanted.
  from: -2296,
  to: -1846,
  step: 6,                 // shore samples this far apart
  // The z window to hunt the waterline in, and how far back from the last
  // station the hunt is allowed to start.
  //
  // 640 was enough for the 164 m of x the trace used to cover and is not enough
  // now: by x -1816 the waterline is at z 616 and the next station would fall
  // out of the window and be dropped. `follow` is the other half of the same
  // problem and the more dangerous one — see `traceShore`.
  probe: [140, 700],
  follow: 60,

  // The cross-section, in metres inland from the water's edge. Trimmed with the
  // frontage — the terraces are the identity of the place and are not cut hard,
  // but 38 m of unbroken concrete between the sea and the huts was reading as an
  // esplanade, and what is actually there is three steps and a walk.
  lip: 3.6,                // the lowest bathing platform, the one you sit on
  mid: 8.4,                // the middle terrace
  deck: 15.2,              // the promenade proper
  rowA: 17.2,              // seaward face of the front row of kabine
  // The open kabina projects 5.4 m behind the front row. At the old 24.0 m
  // offset, its collision clearance met the back row's, sealing the lane at
  // exactly the place the player is invited to enter. Keep 2 m clear there.
  rowB: 26.1,              // seaward face of the back row
  back: 33.1,              // where the concrete stops
  bleed: 8.0,              // and blends back into the hillside

  // Height of the one terrace riser. It was 0.62 and it was spent twice, which
  // put 1.24 m of steps between the water and the promenade. The survey has one
  // kerb in it, 0.15-0.20 m, photographed square on across 1480 px of frame.
  drop: 0.22,
  quay: 1.9,               // how far the quay wall carries on below the water

  cabW: 2.15,              // one cabin's frontage
  cabD: 2.90,              // and its depth
  // Wall height at the eaves. 2.18 was short by a quarter of a metre and it
  // showed the moment the facade got a real door in it: a 1.98 m opening with a
  // vent over it needs 2.4 m of wall, and at 2.18 there was nowhere to put the
  // vent that was not through the roof. It is also why the row read as sheds —
  // a kabina is a small building, not a low one.
  cabH: 2.44,
  // Ridge above the eaves, and the overhang.
  //
  // There is not one pitched kabina roof in thirty-nine photographs or a
  // hundred and thirty-two frames. What is there is a flat slab with a coping
  // 0.17 m thick projecting a hand's breadth past the render — 55 px against
  // 660 px for a 2.05 m opening, straight on. A rise of zero collapses the two
  // slopes onto each other and leaves exactly that slab.
  cabRise: 0,
  cabEave: 0.10,
  plinth: 0.22,            // the concrete pad the rows stand on

  // How far inland you may walk. This used to be 135 m, and 135 m of Srima is
  // not a place you walk through, it is a place you are lost in: the houses are
  // real OSM footprints at their real spacing, which on this peninsula means a
  // median of 1.5 m between one wall and the next — 0.4 m of clearance once the
  // 0.55 m you occupy is taken off. A flood fill says every square metre of it
  // is in fact connected to the shore, so it was never sealed; it just cannot be
  // *read* from eye height, because from down there a hundred and sixty-nine
  // rendered houses are one continuous grey wall with the sea somewhere behind
  // it. 68 m keeps the front lane, the one that faces the water and is the only
  // one anybody at a bathing station has business on, and leaves the rest of the
  // village to be looked at rather than walked into.
  //
  // 68 m did not keep the front lane. It kept the front lane and three behind
  // it, because the lanes here are 12 m apart, and the failure mode is not that
  // you cannot get out — it is that you land in the middle of it and everything
  // in every direction is a wall four metres away. The resort is 15 m of concrete
  // and 9 m of huts; 38 m is that, plus the one lane of houses that faces it,
  // plus a metre of doorstep. Past that is the town builder's job, seen from the
  // deck rather than walked into.
  reachIn: 38,

  // Where the rows begin, measured from the western end of the frontage.
  //
  // It was 8, which put kabine along the whole 189 m, and that is not how the
  // aerial reads: the huts are packed round the jetty and the eastern spit, and
  // the western end is beach — bathers, a few pines, and the first row of houses
  // looking straight out at the channel. Starting at 52 gives that back, and it
  // is what makes room for the vikendica to stand where a first-row house
  // stands. It costs about a fifth of the huts, which still leaves the eighty
  // that carry the row.
  // Where the mole comes ashore, and the anchor half the resort is placed
  // against.
  //
  // It was `LEN * 0.5` — 94.5 m on the 189 m shore, and therefore
  // indistinguishable from a constant until the shore got longer, at which
  // point the jetty, the dog's beat, the man looking out to sea, the pine
  // wood's centre and the reported site centre all set off east together.
  //
  // 94 was also *invented*. Nothing in OSM constrains it: there is no pier,
  // slipway or terminal anywhere in the window, and the field survey never
  // photographed the mole with a landmark that fixed it. The aerial does fix
  // it, and it is nowhere near 94: the mole runs out from the seam where the
  // sand of Strand Jadrija gives way to the concrete, west of Beach bar Mini
  // (t 279 by GPS) and east of Pizzeria F2 (t 246). 258 is that seam.
  jetty: 258,

  // Where the built resort begins. West of this is Strand Jadrija: sand and
  // pale shingle running into the water with no quay, no terraces and no steps
  // — the aerial shows it plainly and so does the west end of the walk. The
  // game laid poured concrete along the whole 572 m, which put a bathing
  // station's engineering across two hundred metres of beach.
  beachTo: 205,
  // And how far it takes to become one: the two profiles are blended over this
  // many metres so there is no line across the shore where one becomes other.
  beachFade: 34,

  // Where the kabine stand, as explicit windows.
  //
  // This used to be `rowFrom: 52` and an implicit far end at `LEN - 14`, which
  // meant hut *count* was a consequence of shore *length* and the two could not
  // be argued about separately. The comment above `from` argues at length that
  // three hundred and twenty huts is "a different and imaginary place" — and it
  // is right, and it is entirely about count. Measured on the extended shore
  // with the old rule: 348 huts and 267k triangles, worse than the number that
  // comment was written to prevent.
  //
  // So the two are separated — and then the aerial said where they go, which no
  // photograph in the survey could, because the walk never reached t 0-189.
  //
  // There is one run of kabine at Jadrija and it is at the eastern end. West of
  // it, in order going west: the plaza, Slasticarnica Jadrija, Caffee bar H2O,
  // Beach bar Mini, the mole, Pizzeria F2, and then the sand of Strand Jadrija
  // all the way to the end. Not a hut on any of it. The old `rowFrom: 52` put
  // eighty of them along that beach and through the middle of the businesses,
  // which is the single largest thing this model had wrong about the place.
  //
  // 396 to 557 is where OSM maps its three `building=changing_rooms` polygons
  // and where the aerial shows the runs, the parking between them, and the
  // circled hut at the western end of the block that carries the gull.
  rows: [[396, 557]],
};

/**
 * Trace the waterline.
 *
 * March seaward at each station until `isSea` flips, then bisect. Sampling z as
 * a function of x works here and would not work everywhere: this shore runs
 * about 31° off the x axis and never doubles back, so every x has exactly one
 * edge. A station that finds no water at all — which would mean the coast has
 * moved — is dropped rather than guessed at.
 */
function traceShore() {
  const raw = [];
  const [z0, z1] = JAD.probe;
  // Start each march just behind where the last one finished, rather than at
  // the top of the window every time.
  //
  // This is not an optimisation. Marching from z0 finds the *first* water at
  // this x, and over the western 164 m that is the only water there is — but
  // carry the trace east along the spit and the inlet on the north side comes
  // into the window and is found first. The line then leaves the coast it was
  // following and crosses the headland, and because it is still finding sea at
  // every station nothing anywhere complains. Measured: `to: -1834` reports a
  // 915 m shore ending at world z 137 instead of 565 — 428 m north — and the
  // only symptom is a resort built across a hillside.
  let prev = -1;
  for (let x = JAD.from; x <= JAD.to + 0.01; x += JAD.step) {
    const lo = prev < 0 ? z0 : Math.max(z0, prev - JAD.follow);
    let hit = -1;
    for (let z = lo; z < z1; z += 3) if (isSea(x, z)) { hit = z; break; }
    if (hit < 0) continue;
    let a = hit - 3, c = hit;
    for (let i = 0; i < 16; i++) {
      const m = (a + c) * 0.5;
      if (isSea(x, m)) c = m; else a = m;
    }
    raw.push([x, c]);
    prev = c;
  }
  // And the second lock on the same door. `follow` keeps the march on the coast
  // it was on; this notices if it ever leaves anyway. A real shoreline sampled
  // every 6 m of x does not jump four sample steps in z between two stations —
  // this one runs about 31 degrees off the x axis, so a step of 4 m is typical
  // and 24 m is not a coast. The guard in `buildJadrija` catches a coast that
  // vanished and has never been able to catch one that folded.
  // And a tripwire, because `follow` above is the thing actually preventing the
  // fold and a silent geometric assumption deserves an assertion next to it.
  //
  // The threshold is measured, not chosen. The largest honest step on this
  // shore is 38.1 m in z across 6 m of x, at world x -1852, where the spit
  // turns its tip and the waterline runs very nearly across the sampling
  // direction. 24 m sounded generous and was not: it rejected the real coast,
  // `buildJadrija` bailed, and there was no resort at all. 72 m clears the turn
  // with room and is still an order of magnitude under a march that has jumped
  // to a different body of water.
  for (let i = 1; i < raw.length; i++) {
    if (Math.abs(raw[i][1] - raw[i - 1][1]) > JAD.step * 12) return [];
  }
  // The DEM is 12.7 m per sample and the coast mask is a raster, so the traced
  // edge comes back with a metre or two of stair-stepping on it. A quay built to
  // follow that would read as damage. Three passes of a 1-2-1 kernel take it out
  // without moving the line anywhere it matters.
  for (let pass = 0; pass < 3; pass++) {
    const sm = raw.map((p) => p[1]);
    for (let i = 1; i < raw.length - 1; i++) {
      raw[i][1] = (sm[i - 1] + 2 * sm[i] + sm[i + 1]) * 0.25;
    }
  }
  return raw;
}

/**
 * Turn the traced edge into stations: a point, an along-shore unit vector, an
 * inland unit normal, and the arc length to get there. Everything the resort is
 * made of is placed in (arc length, inland offset), so this is the only place
 * that has to know which way the sea is.
 */
function shoreStations(raw) {
  const ST = [];
  let run = 0;
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    const a = raw[Math.max(0, i - 1)], c = raw[Math.min(raw.length - 1, i + 1)];
    let ux = c[0] - a[0], uz = c[1] - a[1];
    const L = Math.hypot(ux, uz) || 1;
    ux /= L; uz /= L;
    if (i > 0) run += Math.hypot(p[0] - raw[i - 1][0], p[1] - raw[i - 1][1]);
    // Sea is to larger z along this coast, so inland is the normal that turns
    // the other way. Asserting it against `isSea` would be tidier; measuring it
    // once here and getting it wrong would be visible from the first screenshot.
    ST.push({ x: p[0], z: p[1], ux, uz, nx: uz, nz: -ux, t: run, deck: 0 });
  }
  return ST;
}

async function buildJadrija(scene) {
  // The one building on this shore you can go inside. Built near the end,
  // once the shore frame exists; declared here because walkY asks it for the
  // floor and walkY is a hundred lines further up than the build.
  let vik = null;
  const raw = traceShore();
  if (raw.length < 8) return null;             // the coast moved; build nothing
  const ST = shoreStations(raw);
  const LEN = ST[ST.length - 1].t;
  const rng = mulberry32(CONFIG.seed ^ 0x1ad21a);

  // ── the three levels ───────────────────────────────────────────────────────
  /**
   * How high each terrace runs. Not constants, and not one deck height with the
   * others hung off it at a fixed drop — that was the first version and it put
   * the lowest platform at 0.78 m along a shore whose natural ground is already
   * at 1.4 m six metres in. The hillside came straight up through the concrete
   * and the promenade had a beach growing out of the middle of it.
   *
   * So each level is fitted to the worst of the terrain it has to cover: the
   * highest ground under that band, plus a slab's thickness. Then the levels are
   * forced apart so there is always a step between them, because three terraces
   * that converge to the same height are one terrace with two seams in it.
   */
  const gAt = (st, s) => Math.max(groundAt(st.x + st.nx * s, st.z + st.nz * s), 0);
  for (const st of ST) {
    let hl = 0, hm = 0, hd = 0;
    for (let s = 0.5; s <= JAD.lip; s += 1.0) hl = Math.max(hl, gAt(st, s));
    for (let s = JAD.lip; s <= JAD.mid; s += 1.0) hm = Math.max(hm, gAt(st, s));
    for (let s = JAD.mid; s <= JAD.back; s += 1.5) hd = Math.max(hd, gAt(st, s));
    // Fitted to the terrain, and then capped by what the place actually is.
    //
    // The floors under these numbers were guesses and they were all too high.
    // Measured off the survey: a swimmer 1.75 m tall is 232 px against a
    // deck-to-water face of 0.25 m in the same frame, and a hundred metres of
    // bathing edge with no wall on it anywhere; the quay face reads 0.83 m
    // (150 px against a 230 px man) and the jetty deck 0.72 m. So the lowest
    // platform sits half a metre over the water, not two, and the promenade
    // sits a metre over that rather than three and a half. What the old
    // numbers built was a sea wall, and Jadrija does not have one — you step
    // off the concrete into the water, which is the whole point of it.
    st.lip = Math.max(0.45, hl + 0.22);
    // Held for the beach blend below.
    st.hl = hl;
    // No forced step between the lip and the middle terrace. There is one kerb
    // on this shore and it is 0.15-0.20 m; `drop` used to be spent twice, which
    // built a second full-length riser that appears in no photograph and in no
    // frame of the walk-through. Where the ground is flat these two now come
    // out level and the riser between them degenerates to nothing, which is
    // what a single-step promenade looks like.
    st.mid = Math.max(st.lip, hm + 0.22);
    st.deck = Math.max(st.mid + JAD.drop, Math.min(hd + 0.26, st.lip + 1.10));
  }
  // Concrete poured in one campaign follows the hill but not every lump in it.
  // Smoothing can only ever lower a level below the ground it was fitted to, so
  // the fit is re-imposed afterwards — take the smoothed line or the terrain,
  // whichever is higher, and re-open the steps.
  for (const k of ['lip', 'mid', 'deck']) {
    for (let pass = 0; pass < 5; pass++) {
      const sm = ST.map((s) => s[k]);
      for (let i = 1; i < ST.length - 1; i++) {
        ST[i][k] = (sm[i - 1] + 2 * sm[i] + sm[i + 1]) * 0.25;
      }
    }
  }
  for (const st of ST) {
    let hl = 0, hm = 0, hd = 0;
    for (let s = 0.5; s <= JAD.lip; s += 1.0) hl = Math.max(hl, gAt(st, s));
    for (let s = JAD.lip; s <= JAD.mid; s += 1.0) hm = Math.max(hm, gAt(st, s));
    for (let s = JAD.mid; s <= JAD.back; s += 1.5) hd = Math.max(hd, gAt(st, s));
    st.lip = Math.max(st.lip, 0.45, hl + 0.20);
    st.mid = Math.max(st.mid, st.lip, hm + 0.20);
    st.deck = Math.max(st.deck, st.mid + JAD.drop * 0.8, hd + 0.24);
  }
  // ── the beach end ──────────────────────────────────────────────────────────
  // Flatten the three terraces into one slope west of `beachTo`, so the risers
  // between them close to nothing and the quay wall goes with them. A beach is
  // not a terrace with different paint on it; it is the absence of the steps.
  for (const st of ST) {
    if (st.t > JAD.beachTo) continue;
    const k = 1 - sat((JAD.beachTo - st.t) / JAD.beachFade);   // 1 at the join
    const flat = Math.max(0.28, (st.hl || 0) + 0.12);
    st.lip = flat + (st.lip - flat) * k;
    st.mid = Math.max(st.lip, flat + 0.10 + (st.mid - flat - 0.10) * k);
    st.deck = Math.max(st.mid, flat + 0.30 + (st.deck - flat - 0.30) * k);
    st.beach = 1 - k;
  }

  const midOf = (st) => st.mid;
  const lipOf = (st) => st.lip;

  /** Station at an arbitrary arc length, extrapolating past either end. */
  function at(t) {
    if (t <= 0) {
      const a = ST[0];
      return { x: a.x + a.ux * t, z: a.z + a.uz * t, ux: a.ux, uz: a.uz,
        nx: a.nx, nz: a.nz, lip: a.lip, mid: a.mid, deck: a.deck };
    }
    if (t >= LEN) {
      const e = ST[ST.length - 1], d = t - LEN;
      return { x: e.x + e.ux * d, z: e.z + e.uz * d, ux: e.ux, uz: e.uz,
        nx: e.nx, nz: e.nz, lip: e.lip, mid: e.mid, deck: e.deck };
    }
    let i = 0;
    while (i < ST.length - 2 && ST[i + 1].t < t) i++;
    const a = ST[i], c = ST[i + 1];
    const k = (t - a.t) / ((c.t - a.t) || 1);
    const lerp = (p, q) => p + (q - p) * k;
    return {
      x: lerp(a.x, c.x), z: lerp(a.z, c.z),
      ux: lerp(a.ux, c.ux), uz: lerp(a.uz, c.uz),
      nx: lerp(a.nx, c.nx), nz: lerp(a.nz, c.nz),
      lip: lerp(a.lip, c.lip), mid: lerp(a.mid, c.mid), deck: lerp(a.deck, c.deck),
    };
  }

  /** The height of whatever you are standing on, in locale coordinates. */
  function surfaceY(t, s) {
    const st = at(t);
    const d = st.deck;
    if (s < JAD.lip) return st.lip;
    if (s < JAD.mid) return st.mid;
    if (s < JAD.back) return d;
    // Past the back edge the concrete ramps into the hill over `bleed` metres,
    // so there is no step to trip over where the resort ends.
    const k = sat((s - JAD.back) / JAD.bleed);
    const x = st.x + st.nx * s, z = st.z + st.nz * s;
    return d + (Math.max(groundAt(x, z), 0) - d) * k;
  }

  // ── geometry ───────────────────────────────────────────────────────────────
  // Two buffers: the ground, and everything standing on it. They differ in two
  // ways and both of them matter.
  //
  // Light. The concrete is horizontal and takes the sun square on. Anything
  // upright is vertical and — on this shore, at this hour — faces 107° away from
  // the sun and would be lit by ambient alone. What actually lights it in life is
  // the terrace underneath: a vertical surface sees the deck over half its
  // hemisphere, so it collects about `deckAlbedo * sunI * cos / 2π` ≈ 0.22 of its
  // own albedo back. That is what `emissive` is set to here. It is a bounce, not
  // a fudge — it scales with albedo, which is what a bounce does — and it is why
  // a beach hut with its back to the sun still photographs bright.
  //
  // Shadow. The terraces are single quads with no thickness, so registering them
  // as casters makes them shadow themselves: the depth test compares a surface
  // against its own depth and the promenade comes out chequered with acne and
  // striped with a black band. Ground receives and does not cast — which is why
  // the aerodrome casts its hangars and its objects and never its apron.
  const deck = propBuilder();
  const up = propBuilder();
  let b = deck;
  const pt = (st, s, y) => [st.x + st.nx * s, y, st.z + st.nz * s];
  const W = (t, s, y) => pt(at(t), s, y);

  /**
   * A box in the shore frame. Curvature over a two-metre hut is nothing, so the
   * four uprights are taken from the frame at their own corners and the faces
   * are allowed to be a hair non-planar rather than being carefully unwarped.
   */
  function boxIn(P, t0, t1, s0, s1, y0, y1, col, topCol) {
    const A = P(t0, s0, y0), B = P(t1, s0, y0), C = P(t1, s1, y0), D = P(t0, s1, y0);
    const a = [A[0], y1, A[2]], q = [B[0], y1, B[2]];
    const c = [C[0], y1, C[2]], d = [D[0], y1, D[2]];
    b.quad(a, q, c, d, topCol || col);
    b.quad(D, C, B, A, col);
    b.quad(A, B, q, a, col);
    b.quad(C, D, d, c, col);
    b.quad(B, C, c, q, col);
    b.quad(D, A, a, d, col);
  }
  const boxTS = (t0, t1, s0, s1, y0, y1, col, topCol) =>
    boxIn(W, t0, t1, s0, s1, y0, y1, col, topCol);

  /**
   * A tapered, leaning box: a rectangle at `y0` joined to a different rectangle
   * at `y1`. Each end is `[centre t, centre s, half t, half s]`, so the two may
   * differ in both size and position — which between them is every limb on a
   * body. A thigh is thicker at the hip than at the knee and does not hang
   * plumb; `boxIn` can express neither, which is why everyone on this beach
   * used to be assembled from nine rectangular prisms.
   *
   * Vertex order is `boxIn`'s, so the winding and the normals match everything
   * else built on this shore.
   */
  /**
   * `frustum` with the axis laid on its side: a rectangle at `s0` joined to one
   * at `s1`, each given as `[centre t, centre y, half t, half y]`.
   *
   * Needed because `frustum` can only stack rectangles *upwards*, and a body on
   * a lounger runs along the ground. Building one with `frustum` gives a stack
   * of two-centimetre sheets lying in the deck, which is exactly what the first
   * attempt produced and what it looked like.
   */
  function frustumS(P, s0, r0, s1, r1, col) {
    const R = ([ct, cy, ht, hy], s) => [
      P(ct - ht, s, cy - hy), P(ct - ht, s, cy + hy),
      P(ct + ht, s, cy + hy), P(ct + ht, s, cy - hy),
    ];
    const A = R(r0, s0), B = R(r1, s1);
    b.quad(B[0], B[1], B[2], B[3], col);
    b.quad(A[3], A[2], A[1], A[0], col);
    b.quad(A[0], A[1], B[1], B[0], col);
    b.quad(A[2], A[3], B[3], B[2], col);
    b.quad(A[1], A[2], B[2], B[1], col);
    b.quad(A[3], A[0], B[0], B[3], col);
  }

  function frustum(P, y0, r0, y1, r1, col, topCol) {
    const R = ([ct, cs, ht, hs], y) => [
      P(ct - ht, cs - hs, y), P(ct + ht, cs - hs, y),
      P(ct + ht, cs + hs, y), P(ct - ht, cs + hs, y),
    ];
    const A = R(r0, y0), B = R(r1, y1);
    b.quad(B[0], B[1], B[2], B[3], topCol || col);
    b.quad(A[3], A[2], A[1], A[0], col);
    b.quad(A[0], A[1], B[1], B[0], col);
    b.quad(A[2], A[3], B[3], B[2], col);
    b.quad(A[1], A[2], B[2], B[1], col);
    b.quad(A[3], A[0], B[0], B[3], col);
  }

  /**
   * A bar running along the shore whose cross-section is an arbitrary convex
   * quad in the (inland, up) plane, given as four `[s, y]` corners.
   *
   * `boxIn` cannot do this and structurally never could: it takes the four
   * bottom corners from the frame and then builds the top by copying them with
   * `y1` substituted, so the top face is always level and the sides are always
   * plumb. That is right for a hut and useless for anything raked — a bench
   * back, a seat that falls away, a sloped arm — which is why everything at eye
   * height in here used to be a box stood on end.
   *
   * The vertex order is `boxIn`'s, corner for corner, so the winding and hence
   * the normals come out identical to every other solid on this shore. Corners
   * run (near, bottom) → (far, bottom) → (far, top) → (near, top) as seen along
   * increasing `t`, which is the same cycle `boxIn` walks.
   */
  /** `frustum` in the shore frame, which is the only frame anything uses it in. */
  const frustumTS = (y0, r0, y1, r1, col, topCol) =>
    frustum(W, y0, r0, y1, r1, col, topCol);

  function bar(t0, t1, sec, col, topCol) {
    const [P0, P1, P2, P3] = sec;
    const A = W(t0, P0[0], P0[1]), B = W(t1, P0[0], P0[1]);
    const D = W(t0, P1[0], P1[1]), C = W(t1, P1[0], P1[1]);
    const d = W(t0, P2[0], P2[1]), c = W(t1, P2[0], P2[1]);
    const a = W(t0, P3[0], P3[1]), q = W(t1, P3[0], P3[1]);
    b.quad(a, q, c, d, topCol || col);
    b.quad(D, C, B, A, col);
    b.quad(A, B, q, a, col);
    b.quad(C, D, d, c, col);
    b.quad(B, C, c, q, col);
    b.quad(D, A, a, d, col);
  }

  /** The commonest cross-section of all: an upright rectangle. */
  const rect = (s0, s1, y0, y1) => [[s0, y0], [s1, y0], [s1, y1], [s0, y1]];

  /**
   * And a rectangle rotated in the (inland, up) plane — a slat lying at `ang`
   * from vertical, `long` along its own length and `thick` across it, centred
   * on `(cs, cy)`. The perpendicular is the axis turned the same way `rect`
   * turns `(0,1)` into `(1,0)`, so a zero angle reproduces `rect` exactly.
   */
  function slat(cs, cy, ang, long, thick) {
    const ax = [Math.sin(ang), Math.cos(ang)];
    const nm = [ax[1], -ax[0]];
    const hl = long / 2, ht = thick / 2;
    const c = (i, j) => [cs + nm[0] * ht * i + ax[0] * hl * j,
      cy + nm[1] * ht * i + ax[1] * hl * j];
    return [c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)];
  }

  /** A strip of surface running the whole shore, between two inland offsets. */
  function ribbon(s0, s1, yOf, col) {
    for (let i = 0; i < ST.length - 1; i++) {
      const a = ST[i], c = ST[i + 1];
      b.quad(pt(a, s0, yOf(a)), pt(c, s0, yOf(c)),
        pt(c, s1, yOf(c)), pt(a, s1, yOf(a)), col(i));
    }
  }

  /**
   * The same, but broken into irregular flags.
   *
   * The promenade is not one surface. Filmed along it: a band of poured,
   * power-floated slab next to the water with saw-cut bays in it, and inland of
   * that — under the trees, in front of the terraces — old crazy paving in
   * irregular limestone flags with wide mortar joints between them. The seam
   * between the two is dead straight and runs the length of the shore, which is
   * the detail that makes it read as two campaigns of concrete rather than as
   * one texture.
   *
   * The cut lines are jittered per station rather than per quad, and both quads
   * either side of a station read the same cut, so the flags tile without gaps.
   * A sine hash rather than `rng`, because this is drawn in the middle of the
   * shore build and taking draws off that stream would move every parasol,
   * bather and hut on the beach.
   */
  const jit = (i, k) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  function paving(s0, s1, yOf, cols, nS = 5, step = 2.2) {
    // Subdivided along the shore as well as across it. The stations are six
    // metres apart, so cutting only in `s` gives six-metre flags — which reads
    // as decking, not as paving. `at()` interpolates a station anywhere, so the
    // grid can be as fine as the stone actually is.
    const cut = (i, k) => (k === 0 ? s0 : k === nS ? s1
      : s0 + (s1 - s0) * (k / nS)
        + (jit(i, k) - 0.5) * ((s1 - s0) / nS) * 0.66);
    const n = Math.floor(LEN / step);
    for (let i = 0; i < n; i++) {
      const a = at(i * step), c = at((i + 1) * step);
      for (let k = 0; k < nS; k++) {
        const a0 = cut(i, k), a1 = cut(i, k + 1);
        const c0 = cut(i + 1, k), c1 = cut(i + 1, k + 1);
        b.quad(pt(a, a0, yOf(a)), pt(c, c0, yOf(c)),
          pt(c, c1, yOf(c)), pt(a, a1, yOf(a)),
          cols(i * 7 + k * 3 + ((jit(i, k) * 5) | 0)));
      }
    }
  }

  /** The vertical face of a terrace, high side inland. */
  function riser(s, loOf, hiOf, col) {
    for (let i = 0; i < ST.length - 1; i++) {
      const a = ST[i], c = ST[i + 1];
      b.quad(pt(a, s, loOf(a)), pt(c, s, loOf(c)),
        pt(c, s, hiOf(c)), pt(a, s, hiOf(a)), col(i));
    }
  }

  // Poured concrete, weathered. Three greys a shade apart, walked along the
  // shore in a fixed order: real slabs were poured in bays and you can see every
  // joint from a hundred metres, whereas one flat colour is the beige plane this
  // whole file exists to get rid of.
  //
  // The absolute level is not a taste question. A horizontal surface here takes
  // the sun square on and comes out around 1.1× its albedo in linear light, so
  // anything much past 0.5 clips to white and takes the bay joints with it —
  // which is exactly what the first build of this did at 0.76. The aerodrome
  // apron is 0.42 and reads as concrete; Jadrija sits a little above it because
  // its aggregate is local limestone and it has ninety years of salt on it.
  //
  // And warm, which took a photograph to settle. The albedo below has always
  // been warm — R over B by 0.046 — and it was still coming out of the renderer
  // *cool*, at rgb(157, 165, 169), because a horizontal slab on this shore is
  // lit by a very blue sky over half its hemisphere and the ambient wins. The
  // terrace in the reference frames is rgb(160, 155, 145). That is a 27-point
  // error in the wrong direction across the largest surface in Jadrija, and it
  // is what made the resort read as municipal paving rather than as ninety
  // years of salt on local limestone aggregate. The ratio between the two
  // measurements, 1.019 / 0.939 / 0.858, is applied here rather than to the
  // light, because it is this concrete that is warm and not the afternoon.
  const CONC = [[0.479, 0.427, 0.364], [0.450, 0.402, 0.341], [0.507, 0.451, 0.383]];
  // The flags of the old promenade: warm pale limestone, five shades, measured
  // off the paving in the walk-through where it runs into full afternoon sun.
  const FLAG = [[0.545, 0.500, 0.408], [0.512, 0.470, 0.382], [0.578, 0.530, 0.432],
    [0.498, 0.455, 0.372], [0.560, 0.512, 0.418]];
  const SALT = [0.336, 0.308, 0.268];        // the wet band at the waterline
  const STONE = [0.393, 0.347, 0.292];       // the quay wall
  // Dead Aleppo needles over limestone dust, which is what the ground is
  // everywhere behind the huts. Same measurement, the other way round: the
  // reference floor is rgb(181, 139, 105) and this albedo is what this
  // renderer needs to land there. See the needle floor in TERRAIN_FRAG, which
  // is the same colour arrived at the same way — the seam between the resort's
  // own ground and the terrain runs right through the wood and must not show.
  const LITTER = [[0.542, 0.383, 0.263], [0.512, 0.362, 0.249],
    [0.570, 0.404, 0.278]];
  // Pale washed shingle: bigger and greyer than sand, which is what is actually
  // on this beach — broken limestone rolled round by the swell, not silica.
  const SHINGLE = [[0.560, 0.520, 0.442], [0.596, 0.556, 0.472],
    [0.524, 0.488, 0.414], [0.578, 0.536, 0.454]];
  // Blended per station rather than switched, so the concrete does not end on a
  // line. `st.beach` is 1 out on the sand and 0 by the time the quay starts.
  const mixc = (a, c, k) => [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k,
    a[2] + (c[2] - a[2]) * k];
  const beachAt = (i) => (ST[Math.min(i, ST.length - 1)].beach || 0);
  const bay = (i) => mixc(CONC[i % 3], SHINGLE[i % 4], beachAt(i));
  const bayIn = (i) => mixc(CONC[(i + 2) % 3], SHINGLE[(i + 1) % 4], beachAt(i));
  const duff = (i) => LITTER[i % 3];

  // The three levels, seaward to inland, then the quay wall down into the water.
  ribbon(0, JAD.lip, lipOf, bay);
  riser(JAD.lip, lipOf, midOf, bayIn);
  ribbon(JAD.lip, JAD.mid, midOf, bayIn);
  riser(JAD.mid, midOf, (st) => st.deck, bay);
  // The promenade, and then the ground behind the back row, which is not
  // promenade. The concrete on this shore stops a stride behind the last hut
  // and everything past it is wood: needles, dust and pine. Running the slab
  // all the way to `back` was what put a hard grey line across the reference
  // view — the terrain beyond had gone to needle floor and the resort's own
  // ground had not.
  // The concrete stops a stride behind the *front* row, not the back one. The
  // alley between the two runs is a crushed-limestone track in every frame that
  // looks down it — 6.0 m of it, which is what `rowB - rowA - cabD` already
  // says — and paving it was what carried the slab twelve metres too far.
  const walkTo = JAD.rowA + JAD.cabD + 1.0;
  // Poured slab by the water, flags inland of it, and a straight seam between.
  const PAVE = Math.min(walkTo - 1.5, JAD.mid + 7.5);
  ribbon(JAD.mid, PAVE, (st) => st.deck, bay);
  paving(PAVE, walkTo, (st) => st.deck, (i) => FLAG[i % FLAG.length], 5);
  ribbon(walkTo, JAD.back, (st) => st.deck, duff);
  for (let i = 0; i < ST.length - 1; i++) {
    const a = ST[i], c = ST[i + 1];
    b.quad(pt(a, 0, -JAD.quay), pt(c, 0, -JAD.quay),
      pt(c, 0, lipOf(c)), pt(a, 0, lipOf(a)), STONE);
    // A darker band just above the water, where it is never quite dry.
    b.quad(pt(a, 0.02, 0.05), pt(c, 0.02, 0.05),
      pt(c, 0.02, 0.62), pt(a, 0.02, 0.62), SALT);
  }
  // The blend into the hill, and end walls so the slab is not a floating shelf.
  for (let i = 0; i < ST.length - 1; i++) {
    const a = ST[i], c = ST[i + 1];
    const s0 = JAD.back, s1 = JAD.back + JAD.bleed;
    const ya = surfaceY(a.t, s1), yc = surfaceY(c.t, s1);
    b.quad(pt(a, s0, a.deck), pt(c, s0, c.deck), pt(c, s1, yc), pt(a, s1, ya), duff(i));
  }
  for (const [st, out] of [[ST[0], -1], [ST[ST.length - 1], 1]]) {
    const s0 = 0, s1 = JAD.back;
    const y = st.deck;
    const A = pt(st, s0, -JAD.quay), B = pt(st, s1, -JAD.quay);
    const c = pt(st, s1, y), d = pt(st, s0, lipOf(st));
    if (out > 0) b.quad(A, B, c, d, STONE); else b.quad(d, c, B, A, STONE);
  }

  // ── steps and ladders into the sea ─────────────────────────────────────────
  /**
   * Four steps down off the lip. Every bathing place on this coast has them and
   * they are the one piece of it that tells you, from the top, that the concrete
   * is for getting into the water rather than for parking on.
   */
  function seaSteps(t) {
    const st = at(t), lip = st.lip;
    const w = 1.35;
    for (let k = 0; k < 4; k++) {
      const y1 = lip - k * 0.34;
      boxTS(t - w, t + w, 0.35 + k * 0.42, JAD.lip, y1 - 0.34, y1, bay(k), CONC[0]);
    }
  }

  /**
   * A ladder: two galvanised uprights bent over the coping, and rungs. Half a
   * dozen boxes, and the thing they buy is scale — you cannot look at a quay
   * with a ladder on it and misjudge how high above the water you are.
   */
  function ladder(t) {
    const st = at(t), lip = st.lip;
    const GALV = [0.60, 0.62, 0.63];
    // The handrail arches *over* the coping and down the face, which is a
    // different object from the one that was here.
    //
    // What was here returned inland along the deck, as a lido's does. Every
    // ladder in the survey is an inverted U: bolted to the concrete 0.42 m
    // back from the edge, up to 0.90 m, over the lip, and down the seaward face
    // to a metre under the water. Rail height measured at 0.94 m — 125 px
    // against a 232 px bather — so the 0.92 that was already here is right and
    // is the one number in this function that does not move.
    for (const o of [-0.28, 0.28]) {
      const a = t + o - 0.035, c = t + o + 0.035;
      boxTS(a, c, 0.38, 0.46, lip, lip + 0.90, GALV);          // inland leg
      boxTS(a, c, -0.24, 0.46, lip + 0.82, lip + 0.90, GALV);  // over the coping
      boxTS(a, c, -0.24, -0.16, -1.05, lip + 0.90, GALV);      // and down
    }
    for (let k = 0; k < 5; k++) {
      const y = lip + 0.30 - k * 0.36;
      boxTS(t - 0.30, t + 0.30, -0.23, -0.17, y - 0.03, y + 0.03, GALV);
    }
  }

  // ── the kabine ─────────────────────────────────────────────────────────────
  //
  // The wall is white and the doors are not.
  //
  // This had it exactly backwards for a while: every hut was a coloured box
  // with a darker rectangle on the front, so the run read as a stripe of pastel
  // sheds. It is not. A run of kabine is one long whitewashed masonry wall —
  // limewash over rough render, patched and re-patched, grey at the bottom
  // where the winter sea gets at it — with a row of doors cut into it, and the
  // doors are the only colour in the thing. Yellow, orange, cobalt, bottle
  // green, oxide red, one to a family, repainted whenever somebody gets round
  // to it. That is the whole picture: white wall, coloured doors, and a vent
  // slot over each one because a sealed box full of wet towels in August is a
  // box nobody opens twice.
  //
  // So `CAB` is the *door* palette now, and it is saturated on purpose. These
  // are the only strong colours anywhere on the promenade and they have to
  // carry a hundred metres of white wall between them.
  const CAB = [
    [0.855, 0.660, 0.115], [0.760, 0.290, 0.135], [0.150, 0.345, 0.660],
    [0.155, 0.375, 0.235], [0.605, 0.155, 0.125], [0.415, 0.610, 0.725],
    [0.130, 0.430, 0.425], [0.715, 0.510, 0.170], [0.235, 0.290, 0.360],
  ];
  /**
   * And the limewash. Barely different from each other — this is one wall, not
   * nine — but not identical either: a hut gets re-rendered when its own owner
   * gets round to it, so the patch is a shade off whatever is next to it and
   * stays that way for twenty years. Picked off the bay index rather than out
   * of `rng`, so adding it moves nothing else on the beach.
   */
  // And it is not limewash. That was the assumption and the photographs do not
  // support it: what is on these walls is bare cement render, floated by hand,
  // grey-brown and streaked. Measured in full afternoon sun it is rgb(134, 126,
  // 111) against rgb(165, 153, 142) for the new concrete of the plaza in the
  // same frame — the render is twenty per cent *darker* than the paving, where
  // the old albedos here made it twice as bright. That one number is most of
  // why the row read as a lido and not as ninety years of Adriatic weather.
  const WASH = [
    [0.400, 0.368, 0.312], [0.372, 0.342, 0.292], [0.428, 0.394, 0.334],
    [0.386, 0.355, 0.302], [0.414, 0.381, 0.323],
  ];
  const washAt = (k) => WASH[((k * 7 + ((k * k) >> 1)) % WASH.length + WASH.length)
    % WASH.length];
  // Three greys. The red pantile that used to sit in the middle of this list
  // belongs on Caffe Trampulin and on the pizzeria, and on nothing on this row:
  // the only pitched red roof anywhere in the survey is on a restaurant.
  const ROOFS = [[0.385, 0.372, 0.350], [0.352, 0.344, 0.330],
    [0.345, 0.338, 0.326]];
  const TRIM = [0.340, 0.300, 0.252];

  /**
   * One of them is not a changing hut.
   *
   * Every other kabina on this shore is a solid box with a door painted on it,
   * and that is right: there are a hundred of them, nobody has any business in
   * anybody else's, and a resort where every door opens is a resort nobody ever
   * finds anything in. So exactly one opens, it is the one with the sign over
   * it, and it goes back five and a half metres into the alley behind the row
   * — which is space the front row does not use and the back row does not want.
   *
   * `door` is the number everything else here is arranged around, and it is
   * wide for a changing hut on purpose. `confine` inflates every blocker by
   * `GROUND.girth`, so a doorway costs 1.10 m of clear width before anybody
   * gets through it at all, and a 0.9 m door — the width of a real one — is a
   * wall. The jambs are given back some of that inflation (see `SNUG`); the
   * door is still 1.45 m, because a threshold you have to aim at is a threshold
   * you conclude is shut.
   */
  const KAB = {
    // Two bays of the row wide, and that is the fix for standing in it and
    // feeling like a giant. One bay is 2.15 m, which leaves 1.89 m of interior
    // and — once `confine` has held you 0.22 m off each wall and the cot has
    // taken 0.70 m of the middle — a walkway 0.77 m across. Measured, not
    // guessed: you were edging down a gap narrower than your own shoulders
    // with your eye 1.62 m up in a 2.10 m box, which is not a room you are in,
    // it is a wardrobe you are stuck in.
    //
    // Two bays is 4.30 m of frontage, 4.04 m of interior and a walkway of 2.78
    // m with everything pushed out against the walls where it belongs. It also
    // costs the row nothing it cannot afford: a hundred huts with one double
    // unit in them is what every one of these rows actually looks like, and
    // the one that is twice as wide being the one with the sign over it is a
    // second, quieter way of finding the door.
    bays: 2,
    depth: 5.40,           // how far back it goes from the seaward face
    door: 1.45,            // clear width of the opening
    head: 1.98,            // and its head height above the floor
    wall: 0.10,            // interior wall thickness
    // Under the eave, which is at 2.18, and not over it. A ceiling higher than
    // the wall it sits on is a 6 cm slot of August daylight running right round
    // the top of a room whose whole job is to be dark.
    ceil: 2.10,
    step: 0.30,            // the doorstep, seaward of the face
    // Where it is: the third door of the first front-row run past the jetty,
    // so the way to find it is the way you already walk — out to the boat
    // landing, then turn along the row.
    nth: 2,
  };
  // Taken back off the special kabina's own walls. `GROUND.girth` is 0.55, and
  // a room 1.95 m across with 0.55 held off each wall leaves an 0.85 m strip to
  // stand in, which is not a room, it is a slot. Its walls hold you off 0.22 m
  // instead — close enough to brush the boards, which is what a hut this size
  // is supposed to feel like. Nothing outside this building is affected.
  const SNUG = GROUND.girth - 0.22;
  let special = null;
  // The blank end of the run that has the open kabina in it, kept as it is laid
  // so the tourist board can be hung on it. It is the only large flat wall on
  // this promenade with nothing on it: every other face in the resort is either
  // a door, a vent or the back of a hut in an alley nobody walks down.
  let gable = null;
  // And the one at the other end of the same run, which the sign argument above
  // gave up on and the gull gets: a mural is not a thing you walk towards to
  // read, it is a thing you notice as you come round the corner of the block,
  // and the near end is the corner you come round.
  let nearGable = null;

  const runs = [];        // for the blockers, later
  /**
   * Everything standing on the concrete that you should not be able to walk
   * through, collected as it is placed and folded into `blockers` at the end.
   *
   * Note `GROUND.girth` is 0.55 and gets added to every half-extent, so these
   * are deliberately smaller than the thing they stand for — a figure at its
   * true 0.25 m half-width would hold you off at 0.80 m from its centre, and
   * the promenade pairs stand 0.7 m apart.
   */
  const furniture = [];
  const solid = (t, s, a, c, h) => furniture.push({ t, s, a, c, h, y: 0 });

  /**
   * How a hut is finished.
   *
   * Limewash over render, which is flat — and a flat white wall 350 m long is a
   * slab. What actually breaks it up on the real thing is not relief, it is
   * *tone*: the render is patched in rectangles a shade off their neighbours,
   * and the bottom half-metre is grey with salt and shoe-black. Both are drawn
   * as paint rather than as geometry standing proud, because 5 mm of proud
   * render is invisible at any range that matters and the tone is not.
   *
   * Three boxes to a bay. The old board-and-batten took twelve and was wrong
   * anyway: these are masonry.
   */
  const shade = (col, k) => [col[0] * k, col[1] * k, col[2] * k];
  function plaster(a, front, floor, eave, col, k, dc, half) {
    const c = a + JAD.cabW, h = (half || DOORW * 0.5) + 0.075;
    // The skirt. Not a plinth and not a moulding — just the strip of wall that
    // gets splashed, kicked and scrubbed, so it reads greyer and slightly warm.
    //
    // In two runs either side of the opening, for the same reason as the eave
    // band below and then some: this is drawn 6 mm *proud* of the wall face and
    // the door leaf hangs 90 mm behind it, so a single band across the bay
    // walled up the bottom half-metre of every door on the beach. The doors
    // looked like they stopped short of the ground. They did not — they were
    // behind the skirt.
    const skirt = [col[0] * 0.900, col[1] * 0.908, col[2] * 0.908];
    for (const [t0, t1] of [[a, dc - h], [dc + h, c]]) {
      if (t1 - t0 > 0.02) {
        boxTS(t0, t1, front - 0.006, front - 0.001, floor, floor + 0.46, skirt);
      }
    }
    // A patch of newer render, and the line where the last one stopped. Kept
    // clear of the opening and kept *quiet*: at four per cent off its
    // surroundings the first version read as sheets of paper taped to the wall.
    // Rendering patches are a tone, not a poster. Sized and placed off the bay
    // index rather than out of `rng`, so nothing here moves the beach.
    const side = (k % 2) ? [dc + h, c - 0.06] : [a + 0.06, dc - h];
    const w = Math.min(0.42 + 0.26 * ((k * 5) % 4) / 3, side[1] - side[0] - 0.04);
    if (w > 0.20) {
      const x = side[0] + ((k * 3) % 3) * 0.11;
      const y = floor + 0.62 + 0.22 * ((k * 11) % 3);
      boxTS(x, Math.min(x + w, side[1]), front - 0.010, front - 0.002,
        y, y + 0.34 + 0.22 * ((k * 7) % 3), shade(col, k % 2 ? 1.014 : 0.985));
    }
    // And the shadow the eave throws down the wall, which on a white wall in
    // August is the strongest line on the building. In two runs either side of
    // the opening: drawn straight across it stands proud of the vent and puts a
    // white bar through the one dark thing on the facade.
    for (const [t0, t1] of [[a, dc - h], [dc + h, c]]) {
      if (t1 - t0 > 0.02) {
        boxTS(t0, t1, front - 0.008, front - 0.001, eave - 0.22, eave,
          shade(col, 0.885));
      }
    }
  }

  /**
   * A door, shut, in its hole.
   *
   * The thing that makes these read is that the door is *behind* the wall
   * plane, not painted on it: the opening is a reveal 60 mm deep, the leaf
   * hangs at the back of it, and what you actually see from down the row is a
   * coloured rectangle with a hard shadow up one side of it. Two styles, both
   * off the reference: louvred, which is most of them, and planked, which is
   * the rest. Louvres are horizontal slats at alternating depth — `boxTS`
   * cannot lean, and a slat that cannot lean has to sell itself on the shadow
   * between it and the one below.
   */
  const DOORW = 0.90, DOORH = 1.98;
  const REVEAL = 0.09;             // how deep the opening is cut into the render
  function door(dc, front, floor, col, louvred) {
    const h = DOORW * 0.5;
    // No hole is cut here — `frontSkin` did that, and it is why any of this is
    // visible at all. The first version of this drew the leaf at `front + 0.04`
    // inside a wall that ran from `front` to the back of the hut, which is to
    // say it drew a door in the middle of a solid block of masonry: what came
    // out was a row of white walls with coloured picture frames on them.
    const face = front + 0.045;
    boxTS(dc - h + 0.012, dc + h - 0.012, face, face + 0.032,
      floor + 0.010, floor + DOORH - 0.010, shade(col, 0.90));
    // Stiles up both edges, standing a little proud of whatever fills between
    // them. Every real one of these has them and they are what stops a louvred
    // door reading as a radiator.
    for (const o of [-1, 1]) {
      boxTS(dc + o * (h - 0.012) - o * 0.075, dc + o * (h - 0.012),
        face - 0.014, face + 0.032, floor + 0.010, floor + DOORH - 0.010, col);
    }
    if (louvred) {
      const n = 12, y0 = floor + 0.08, y1 = floor + DOORH - 0.08;
      const sp = (y1 - y0) / n;
      for (let i = 0; i < n; i++) {
        const y = y0 + i * sp;
        // Alternating depth, and alternating tone with it: the near edge of a
        // slat catches the sun and the throat under it does not.
        boxTS(dc - h + 0.082, dc + h - 0.082, face - (i % 2 ? 0.019 : 0.009), face,
          y + 0.004, y + sp - 0.010, shade(col, i % 2 ? 1.08 : 0.84));
      }
    } else {
      // Planked: five boards up the leaf with a seam between each, and two
      // ledges across them, which is how a door like this is actually made.
      const n = 5, sp = (DOORW - 0.164) / n;
      for (let i = 0; i < n; i++) {
        const x = dc - h + 0.082 + i * sp;
        boxTS(x + 0.006, x + sp - 0.006, face - 0.012, face,
          floor + 0.045, floor + DOORH - 0.045, shade(col, i % 2 ? 1.05 : 0.95));
      }
      for (const y of [floor + 0.34, floor + DOORH - 0.42]) {
        boxTS(dc - h + 0.075, dc + h - 0.075, face - 0.019, face - 0.010,
          y, y + 0.105, shade(col, 1.10));
      }
    }
  }

  /**
   * The architrave, and the reason the door is a hole and not a sticker: a band
   * of paint on the render round the opening, in the door's own colour. Whoever
   * painted the door had the tin open and did the frame with it. It is also the
   * only thing tying the door to the vent above it.
   */
  function surround(dc, front, floor, col, half, head) {
    const m = 0.055;
    for (const o of [-1, 1]) {
      boxTS(dc + o * half, dc + o * (half + m), front - 0.007, front - 0.001,
        floor, head + m, shade(col, 0.92));
    }
    boxTS(dc - half - m, dc + half + m, front - 0.007, front - 0.001,
      head, head + m, shade(col, 0.92));
  }

  /**
   * The vent over the door. Every kabina on this shore has one and it is the
   * detail that says *changing hut* rather than *shed*: a slot the width of the
   * door, a painted frame round it, and a few bars across it. Behind the bars
   * is the same nothing the door has behind it.
   */
  const VENTH = 0.235;
  function vent(dc, front, y0, w, col) {
    const h = w * 0.5, hh = VENTH;
    // Frame: a lintel over and a sill under, in the door's colour.
    for (const [a0, a1] of [[y0 - 0.045, y0], [y0 + hh, y0 + hh + 0.045]]) {
      boxTS(dc - h - 0.045, dc + h + 0.045, front - 0.030, front - 0.001, a0, a1,
        shade(col, 0.88));
    }
    for (const o of [-1, 1]) {
      boxTS(dc + o * h, dc + o * (h + 0.045), front - 0.030, front - 0.001,
        y0, y0 + hh, shade(col, 0.88));
    }
    // And the grille, which on half of them is chicken wire and on the other
    // half is three bits of bar. Three bits of bar.
    const GRILLE = [0.255, 0.245, 0.230];
    for (let i = 1; i <= 3; i++) {
      const x = dc - h + (w * i) / 4;
      boxTS(x - 0.011, x + 0.011, front - 0.008, front + 0.012, y0, y0 + hh, GRILLE);
    }
  }

  /**
   * The seaward render, with the opening cut out of it.
   *
   * A hut is a solid box and you cannot recess anything into a solid box —
   * whatever you draw inside it is inside it. So the body is set back by the
   * depth of the reveal and the face is rebuilt as three panels around the
   * hole, which costs two boxes a bay and buys the one thing the facade was
   * missing: a door with a wall in front of its edges, throwing a hard shadow
   * down one jamb all morning.
   *
   * The hole runs the full height of the joinery — door, transom rail and vent
   * together — because that is one opening with a rail across it in every
   * building of this kind, and because cutting two holes costs four more panels
   * for a rail that is 120 mm tall.
   */
  const OPENH = 2.335;             // door, rail and vent, floor to head
  function frontSkin(a, c, dc, front, floor, eave, wash) {
    const h = DOORW * 0.5, y1 = floor + OPENH;
    boxTS(a, dc - h, front, front + REVEAL, floor, eave, wash);
    boxTS(dc + h, c, front, front + REVEAL, floor, eave, wash);
    boxTS(dc - h, dc + h, front, front + REVEAL, y1, eave, wash);
    // And the dark at the back of it. Behind this is the body of the hut, which
    // is white, and a white rectangle behind a louvred door is a lightbox.
    boxTS(dc - h - 0.02, dc + h + 0.02, front + REVEAL - 0.006, front + REVEAL,
      floor, y1, [0.045, 0.041, 0.038]);
  }

  /**
   * The ironmongery. Three boxes and a plate, and the reason a door in this row
   * stops being a dark rectangle painted on a wall: hinges give it a side it
   * opens from, and a hasp gives it an owner who locks it.
   *
   * `depth` is how far back in the reveal the leaf hangs, so the hardware lands
   * on the door rather than floating in front of the wall.
   */
  function doorKit(dc, front, floor, half, depth) {
    const IRON = [0.190, 0.178, 0.166];
    const f = front + depth;
    for (const y of [floor + 0.42, floor + 1.62]) {
      boxTS(dc - half + 0.03, dc - half + 0.20, f - 0.021, f - 0.004, y, y + 0.075, IRON);
    }
    // Hasp and staple on the swinging side, at the height a hand finds it.
    boxTS(dc + half - 0.20, dc + half - 0.05, f - 0.024, f - 0.004,
      floor + 1.00, floor + 1.07, IRON);
    boxTS(dc + half - 0.13, dc + half - 0.09, f - 0.061, f - 0.022,
      floor + 0.99, floor + 1.09, IRON);
  }

  /**
   * One run of joined huts: individual boxes so each can be its own colour, one
   * continuous roof over the lot, and a door on every seaward face. Joined is
   * how they are built — a party wall each side and a gable only at the ends —
   * and it is also why they survive: eighty huts is one long building.
   */
  function cabinRun(t0, n, front, roofCol) {
    const back = front + JAD.cabD;
    const t1 = t0 + n * JAD.cabW;
    const st = at(t0 + n * JAD.cabW * 0.5);
    const y0 = st.deck;
    // The pad they stand on is concrete and belongs to the deck buffer, or it
    // would pick up the hut bounce and show as a bright rectangle in the middle
    // of the promenade.
    b = deck;
    boxTS(t0 - 0.5, t1 + 0.5, front - 0.55, back + 0.45,
      y0 - 0.4, y0 + JAD.plinth, CONC[1], CONC[2]);
    b = up;
    const eave = y0 + JAD.plinth + JAD.cabH;
    const ridge = eave + JAD.cabRise;
    // Which hut in this run — if any — is the one that opens: the third door of
    // the first front-row run past the jetty. Stated as an ordinal rather than
    // as a position along the shore, because the runs are laid out by `rng` and
    // a fixed `t` lands in the alley between two of them as often as not.
    // Costs no draw of `rng` either way, so the rest of the beach comes out of
    // the seed exactly as it did before there was a door in it anywhere.
    const sk = front === JAD.rowA && !special && t0 > gapAt
      ? Math.min(KAB.nth, n - KAB.bays) : -1;
    for (let k = 0; k < n; k++) {
      const a = t0 + k * JAD.cabW, c = a + JAD.cabW;
      const col = CAB[Math.floor(rng() * CAB.length)];
      const wash = washAt(k + (t0 | 0));
      // Drawn after the colour is picked and not before, so the special one
      // takes its own colour out of the same sequence its neighbours do.
      if (k === sk) {
        // Two bays, not one — see the note on the width in `KAB`. The second
        // bay's colour is still drawn and then thrown away, so everything
        // downstream comes out of the seed exactly where it did when this hut
        // was half the size: the beach behind it does not move because a room
        // in front of it got bigger.
        for (let i = 1; i < KAB.bays; i++) rng();
        kabina(a, a + JAD.cabW * KAB.bays, front, y0, eave, ridge, col, wash, roofCol);
        k += KAB.bays - 1;
        continue;
      }
      // One wall, not n boxes with grooves between them. They touch: the party
      // faces end up coincident inside the masonry where nothing can see them,
      // and the alternative is a 30 mm black slot every 2.15 m down a wall that
      // in life is continuous render from one end of the run to the other.
      const dc = (a + c) * 0.5;
      const fl = y0 + JAD.plinth;
      boxTS(a, c, front + REVEAL, back, fl, eave, wash);
      frontSkin(a, c, dc, front, fl, eave, wash);
      plaster(a, front, fl, eave, wash, k + (t0 | 0), dc);
      // Louvred or planked, two thirds to one — off the bay index, not `rng`,
      // so the beach behind it stays where the seed put it.
      door(dc, front, fl, col, (k * 5 + (t0 | 0)) % 3 !== 0);
      doorKit(dc, front, fl, DOORW * 0.5, 0.045);
      // The rail between the door head and the vent, filling the last of the
      // opening. Painted with the door, because it was.
      boxTS(dc - DOORW * 0.5, dc + DOORW * 0.5, front + 0.010, front + REVEAL,
        fl + DOORH, fl + OPENH - VENTH, shade(col, 0.86));
      vent(dc, front, fl + OPENH - VENTH, DOORW - 0.06, col);
      surround(dc, front, fl, col, DOORW * 0.5, fl + OPENH + 0.045);
    }
    // One roof: two slopes to a ridge running along the row, with an overhang
    // and a fascia under it so the eave has a shadow line.
    const mid = (front + back) * 0.5;
    const e0 = front - JAD.cabEave, e1 = back + JAD.cabEave;
    const T0 = t0 - JAD.cabEave, T1 = t1 + JAD.cabEave;
    for (const [sa, sb, ya, yb] of [[e0, mid, eave, ridge], [mid, e1, ridge, eave]]) {
      b.quad(W(T0, sa, ya), W(T1, sa, ya), W(T1, sb, yb), W(T0, sb, yb), roofCol);
      b.quad(W(T0, sb, yb - 0.09), W(T1, sb, yb - 0.09),
        W(T1, sa, ya - 0.09), W(T0, sa, ya - 0.09), [0.145, 0.135, 0.125]);
    }
    for (const [T, o] of [[T0, -1], [T1, 1]]) {
      const A = W(T, e0, eave), B = W(T, mid, ridge), C = W(T, e1, eave);
      if (o > 0) b.tri(A, B, C, TRIM); else b.tri(C, B, A, TRIM);
      boxTS(T - 0.05 * o, T + 0.05 * o, front, back,
        y0 + JAD.plinth, eave, [0.760, 0.745, 0.700]);
    }
    // The far end of this run, if this is the run with the door in it. The far
    // end and not the near one: the near one is four bays from the sign and the
    // far one is the wall you are looking at while you walk the row towards it.
    if (sk >= 0) {
      gable = { t: T1 + 0.05, front, back, floor: y0 + JAD.plinth, eave };
      // And the near one, which is the same wall at the other end of the same
      // run and is the only other blank face on this promenade. It faces the
      // other way down t, which is the whole of the difference: `o` is −1 here
      // where it is +1 there, and everything hung on it needs the same sign.
      nearGable = { t: T0 - 0.05, o: -1, front, back,
        floor: y0 + JAD.plinth, eave };
    }

    // The run is one blocker, except where a door was cut in it: then it is the
    // huts either side of the special one, and the special one puts up its own
    // walls. A single box over the lot would be a sign hung on a wall.
    const h = ridge - y0;
    if (sk < 0) {
      runs.push({ t0: t0 - 0.5, t1: t1 + 0.5, s0: front - 0.55, s1: back + 0.45,
        y: y0, h });
    } else {
      // Pulled back by `SNUG` where they meet the door, and only there. Left
      // alone, each neighbour's blocker grows 0.55 m into the opening when
      // `confine` inflates it, and the two of them between them close 1.10 m of
      // a 1.45 m doorway from the outside — a door you can see through and
      // cannot walk through, which is the worst of both.
      // Both bays of it — the hut is `KAB.bays` wide and the neighbour on the
      // far side starts after the second one. Left at a single bay this ran a
      // solid blocker up the middle of the room, and the right-hand half of a
      // 4 m floor was a wall you could see across and not walk across.
      const a = t0 + sk * JAD.cabW, c = a + JAD.cabW * KAB.bays;
      if (a > t0) {
        runs.push({ t0: t0 - 0.5, t1: a - SNUG, s0: front - 0.55, s1: back + 0.45,
          y: y0, h });
      }
      if (c < t1) {
        runs.push({ t0: c + SNUG, t1: t1 + 0.5, s0: front - 0.55, s1: back + 0.45,
          y: y0, h });
      }
    }
    b = deck;
  }

  /**
   * A box you are inside: the same six quads as `boxIn` with every winding
   * reversed, so the faces point in at you rather than out. A room is not a hut
   * with the camera moved, and a hut seen from within is six invisible
   * back-faces and a view of the sea through its own wall.
   */
  function roomTS(t0, t1, s0, s1, y0, y1, wallCol, floorCol, ceilCol, openFront) {
    const A = W(t0, s0, y0), B = W(t1, s0, y0), C = W(t1, s1, y0), D = W(t0, s1, y0);
    const a = [A[0], y1, A[2]], q = [B[0], y1, B[2]];
    const c = [C[0], y1, C[2]], d = [D[0], y1, D[2]];
    b.quad(d, c, q, a, ceilCol);
    b.quad(A, B, C, D, floorCol);
    if (!openFront) b.quad(a, q, B, A, wallCol);
    b.quad(c, d, D, C, wallCol);
    b.quad(q, c, C, B, wallCol);
    b.quad(d, a, A, D, wallCol);
  }
  /** One inward-facing wall panel at `s`, wound to be seen from further in. */
  const inFace = (t0, t1, y0, y1, s, col) =>
    b.quad(W(t0, s, y1), W(t1, s, y1), W(t1, s, y0), W(t0, s, y0), col);

  /**
   * The one that opens.
   *
   * Built as walls rather than as a box, because the difference between a hut
   * and a room is that a room has an inside — and the inside is drawn as a
   * second, inverted shell inset by the wall thickness, so the boards you see
   * from the cot are boards and not the back of the siding.
   *
   * It keeps its neighbours' facade exactly: same limewash, same plinth, same
   * eave, same painted architrave round the opening, same vent over it, and its
   * colour comes off the same table theirs does. What it does not keep is the
   * back wall — it runs 5.4 m into the alley, which is dead ground between the
   * rows, under a lean-to hung off the run's rear eave. From the promenade the
   * only thing wrong with it is the sign and the fact that the door is missing.
   */
  function kabina(a, c, front, y0, eave, ridge, col, wash, roofCol) {
    const floor = y0 + JAD.plinth;
    const s1 = front + KAB.depth;
    const dc = (a + c) * 0.5;
    const dj = KAB.door * 0.5;
    const wl = a, wr = c;                    // the render, continuous with the row
    const dark = [wash[0] * 0.30, wash[1] * 0.25, wash[2] * 0.21];

    // The pad carries on under the annex. In the deck buffer with the rest of
    // the concrete, or it picks up the hut bounce and reads as a lit rectangle
    // in the middle of the alley.
    b = deck;
    boxTS(wl - 0.13, wr + 0.13, front + JAD.cabD + 0.45, s1 + 0.30,
      y0 - 0.4, floor, CONC[1], CONC[2]);
    b = up;

    const top = floor + KAB.ceil;
    const w = KAB.wall;
    // Sides, back, and the two jambs. The lintel closes the wall over the door.
    boxTS(wl, wl + w, front, s1, floor, eave, wash);
    boxTS(wr - w, wr, front, s1, floor, eave, wash);
    boxTS(wl, wr, s1 - w, s1, floor, eave, wash);
    boxTS(wl, dc - dj, front, front + w, floor, eave, wash);
    boxTS(dc + dj, wr, front, front + w, floor, eave, wash);
    // Over the opening: the rail, then the vent's own hole, then the wall over
    // it. Four panels rather than one, for the same reason the plain huts get
    // three — a vent drawn on unbroken masonry is a grille in front of a white
    // wall, which is a lightbox with bars on it.
    const vh = KAB.door * 0.62 * 0.5;
    const v0 = floor + OPENH - VENTH, v1 = floor + OPENH;
    boxTS(dc - dj, dc + dj, front, front + w, floor + KAB.head, v0, wash);
    boxTS(dc - dj, dc - vh, front, front + w, v0, v1, wash);
    boxTS(dc + vh, dc + dj, front, front + w, v0, v1, wash);
    boxTS(dc - dj, dc + dj, front, front + w, v1, eave, wash);
    // The vent opens into the void over the ceiling, not into the room, so it
    // needs its own back or it is a slot with the roof timbers behind it.
    boxTS(dc - vh - 0.02, dc + vh + 0.02, front + w, front + w + 0.008, v0, v1,
      [0.045, 0.041, 0.038]);
    // Rendered and painted exactly like its neighbours, which is the whole
    // trick: from fifty metres down the row this is a hut with its door taken
    // off, not a set piece. The one thing that is not the same is that the
    // architrave has nothing inside it.
    //
    // There used to be a shuttered window either side of the opening here, on
    // the reasoning that a double kabina would have one. It would not. Every
    // one of these on this shore is a blind box with a door and a vent in it —
    // a window is somewhere for the beach to look in, which is the one thing a
    // changing hut is for not having.
    for (let i = 0; i < KAB.bays; i++) {
      // Both bays measure their clear wall from the *hut's* opening, which is
      // in the middle of the pair rather than in the middle of either — so on
      // each bay one of the two clear runs comes out empty and is skipped.
      plaster(a + i * JAD.cabW, front, floor, eave, wash, i * 3 + (a | 0), dc, dj);
    }
    doorKit(dc, front, floor, dj, 0.040);
    vent(dc, front, floor + 2.10, KAB.door * 0.62, col);
    surround(dc, front, floor, col, dj, floor + 2.38);

    // Inside. Everything from here is seen only from within, and is dark
    // because no light gets into a wooden box with one door in it — which is
    // the whole reason this room is worth walking into on a white afternoon.
    // Held 4 mm clear of the walls it lines. Flush, the shell's faces and the
    // inward faces of the wall boxes are the same plane, and the depth test
    // picks between them per triangle: what you get is not a dark room, it is
    // a dark room with the *outside* colour showing through it in wedges that
    // swim as you walk.
    const IN = 0.004;
    roomTS(wl + w + IN, wr - w - IN, front + w + IN, s1 - w - IN,
      floor + 0.01, top - IN,
      dark, [0.190, 0.158, 0.126], [0.052, 0.046, 0.042], true);
    // The front wall from within, in three panels around the opening — because
    // the sixth face of the shell is the one the door is in, and drawn whole it
    // seals the only way into the only room at Jadrija. Which is exactly what it
    // did: the doorway read as one more painted-on door and the room behind it
    // was a rumour.
    const fs = front + w + IN;
    inFace(wl + w, dc - dj, floor, top, fs, dark);
    inFace(dc + dj, wr - w, floor, top, fs, dark);
    inFace(dc - dj, dc + dj, floor + KAB.head, top, fs, dark);
    // And the reveals: slivers standing in the thickness of the opening, so the
    // door is a hole through 10 cm of wall rather than a rectangle cut in paper.
    for (const o of [-1, 1]) {
      boxTS(dc + o * dj, dc + o * (dj + 0.014), front, fs, floor, floor + KAB.head, dark);
    }
    boxTS(dc - dj, dc + dj, front, fs, floor + KAB.head, floor + KAB.head + 0.014, dark);
    // The ceiling is a slab and not a plane, so the lean-to overhead has
    // something to sit on and the room does not open into the roof void.
    boxTS(wl, wr, front, s1, top, top + 0.06, dark);

    // The lean-to over the annex, hung off the run's rear eave. A shallower
    // pitch than the roof it comes off, which is what a lean-to is.
    const r0 = front + JAD.cabD + JAD.cabEave, r1 = s1 + 0.24;
    const y1 = eave - 0.30;
    b.quad(W(wl - 0.16, r0, eave), W(wr + 0.16, r0, eave),
      W(wr + 0.16, r1, y1), W(wl - 0.16, r1, y1), roofCol);
    b.quad(W(wl - 0.16, r1, y1 - 0.08), W(wr + 0.16, r1, y1 - 0.08),
      W(wr + 0.16, r0, eave - 0.08), W(wl - 0.16, r0, eave - 0.08),
      [0.145, 0.135, 0.125]);

    // ── what you cannot walk through ──────────────────────────────────────
    //
    // Published from here, as rectangles rather than as boxes, because the
    // collision has to be the same shape as the room and the room is going to
    // change shape again. Each entry is the region in (t, s) you must not be
    // able to stand in; `blockers` takes `GROUND.girth` back off so that
    // `confine` adds it again to the same answer.
    //
    // `HOLD` is how close the boards let you stand, and it is 0.22 rather than
    // the 0.55 everything else on this shore holds you off at: a room 1.89 m
    // across with half a metre held off each wall is not a room, it is a slot.
    //
    // `REACH` is the one that was missing and it is the whole of "I can walk
    // through the back wall and end up on the other side of it". A wall 10 cm
    // thick with 0.22 of hold-off either side is a barrier 0.54 m deep, and
    // behind this one is the open alley: at six metres a second on a phone
    // holding fifteen frames, one step is 0.40 m and two is straight through.
    // The measurement was worse than that even at rest — the far side of the
    // barrier sat at s 22.82 and the next thing behind it began at 22.90, so
    // there was a seven-centimetre band you could simply stand in. Every wall
    // now reaches three quarters of a metre into whatever is behind it, which
    // for three of them is the solid hut next door and for the back one is a
    // yard of alley nobody has any business standing in anyway.
    const HOLD = 0.22, REACH = 0.75;
    const T0 = wl + w, T1 = wr - w, S0 = front + w, S1 = s1 - w;
    special = {
      t0: T0, t1: T1, s0: S0, s1: S1,
      shell: [
        [wl - REACH, T0 + HOLD, front - HOLD, S1 + HOLD],   // left
        [T1 - HOLD, wr + REACH, front - HOLD, S1 + HOLD],   // right
        [wl - REACH, wr + REACH, S1 - HOLD, s1 + REACH],    // back
        [wl - REACH, dc - dj, front - HOLD, S0 + HOLD],     // front, left of the door
        [dc + dj, wr + REACH, front - HOLD, S0 + HOLD],     // front, right of it
      ],
      face: front, dc, dj, floor, top, y0, eave,
      // Where you are standing when you are in it, for the audio and the light.
      // A metre of the doorway is included on purpose: the room should have
      // gone quiet by the time you are through the frame, not a stride later.
      pad: 0.95,
    };
  }

  /**
   * Lay the rows out. Runs of seven to thirteen with an alley between, and a
   * deliberate hole left in the middle of both rows where the jetty comes ashore
   * — a resort has a way through it to the water, and two unbroken 350 m walls
   * of hut would be a corridor rather than a place.
   */
  const gapAt = JAD.jetty;
  for (const [front, phase] of [[JAD.rowA, 0], [JAD.rowB, JAD.cabW * 0.5]]) {
   for (const [tA, tB] of JAD.rows) {
    let t = tA + phase;
    while (t < tB) {
      // Five to ten. Seven to thirteen was right when the shore was 411 m long
      // and is not now: the count that matters is the total, which wants to come
      // out near the hundred huts that are really there.
      const n = 5 + Math.floor(rng() * 6);
      const span = n * JAD.cabW;
      const clearOfGap = t + span < gapAt - 9 || t > gapAt + 9;
      if (clearOfGap) cabinRun(t, n, front, ROOFS[Math.floor(rng() * ROOFS.length)]);
      // A run's pad projects 0.5 m beyond each end and `confine` holds the
      // walker 0.55 m off it. The old 2.6 m minimum left a 0.5 m pinch point
      // once both runs' clearance was accounted for. Keep at least 2 m free so
      // the alleys are routes through the kabine, not gaps to squeeze through.
      t += span + 4.1 + rng() * 1.5;
    }
   }
  }

  /**
   * The sign, which is the only thing wrong with the facade and is therefore the
   * whole of how you find it.
   *
   * Drawn on a canvas rather than built out of tube geometry, because neon is
   * not a shape, it is a shape and the halo around it — and a halo is what a
   * canvas with `shadowBlur` gives you for nothing and what a hundred extruded
   * cylinders give you never. Three passes a stroke: a wide dim bloom, a middle
   * pass, then a near-white core, which is what a glass tube full of gas
   * actually photographs like.
   *
   * It projects square out from the wall over the promenade, which is how every
   * bar sign on this coast is hung and, more to the point, is the only way it
   * can be read by somebody walking the row rather than standing in front of it.
   * There is no room for it flat on the facade: the door frame stops 2 cm under
   * the eave.
   */
  function neonSign(K) {
    /**
     * One face of it. `flip` mirrors the composition so the lettering can
     * counter-mirror itself and still read from the far side.
     *
     * The arrow points DOWN, and that is the fix rather than a style. A sign
     * hung square out from a wall is seen from both ends of the promenade, and
     * a horizontal arrow is right for exactly one of them: mirror it and it
     * points away from the door, do not mirror it and it points away from the
     * door on the other side. There is no orientation of a sideways arrow that
     * works, which is two builds' worth of finding out. A vertical one is the
     * same arrow in a mirror, so it hangs over the doorway and points at it,
     * and every viewer on the deck is on its good side.
     */
    const neonFace = (flip) => {
      const cv = document.createElement('canvas');
      cv.width = 460; cv.height = 400;
      const g = cv.getContext('2d');

      const tube = (path, col, w) => {
        for (const [blur, lw, style] of [[26, w + 7, col], [12, w + 2, col],
          [5, w * 0.42, '#fff6ee']]) {
          g.save();
          g.shadowBlur = blur; g.shadowColor = col;
          g.strokeStyle = style; g.lineWidth = lw;
          g.lineJoin = 'round'; g.lineCap = 'round';
          g.beginPath(); path(); g.stroke();
          g.restore();
        }
      };
      // Drawn inside the mirror and immediately un-mirrored about its own
      // anchor, which is how you get upright words in a reversed picture.
      const glowText = (text, x, y, font, col) => {
        g.save();
        g.translate(x, y);
        if (flip) g.scale(-1, 1);
        g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const [blur, style] of [[24, col], [10, col], [4, '#fff6ee']]) {
          g.shadowBlur = blur; g.shadowColor = col; g.fillStyle = style;
          g.fillText(text, 0, 0);
        }
        g.restore();
      };

      const RED = '#ff2d17', PINK = '#ff5f9e', GOLD = '#ffc11e';
      g.clearRect(0, 0, cv.width, cv.height);
      g.save();
      if (flip) { g.translate(cv.width, 0); g.scale(-1, 1); }

      glowText('Jadrija', 158, 32, 'italic 34px Georgia, serif', PINK);
      // OPEN, in a box, over the arrow.
      tube(() => {
        g.moveTo(26, 62); g.lineTo(292, 62); g.lineTo(292, 140);
        g.lineTo(26, 140); g.closePath();
      }, RED, 8);
      glowText('OPEN', 159, 102, 'bold 66px Helvetica, Arial, sans-serif', RED);

      // The pole, and the girl on it. Six strokes and no more — a neon figure
      // is a line drawing by construction, and the ones that read are the ones
      // that gave up early.
      tube(() => { g.moveTo(388, 30); g.lineTo(388, 318); }, GOLD, 7);
      tube(() => {
        g.moveTo(388, 96); g.bezierCurveTo(344, 92, 328, 122, 350, 142);
        g.bezierCurveTo(376, 162, 340, 188, 322, 216);
        g.moveTo(350, 142); g.bezierCurveTo(384, 152, 394, 188, 384, 230);
        g.moveTo(384, 230); g.bezierCurveTo(428, 238, 432, 270, 406, 288);
        g.moveTo(338, 118); g.lineTo(384, 104);
      }, PINK, 6);
      tube(() => {
        g.moveTo(388, 318); g.bezierCurveTo(350, 288, 342, 322, 388, 344);
        g.bezierCurveTo(434, 322, 426, 288, 388, 318);
      }, GOLD, 6);

      // And the arrow, straight down at the door it is bolted over.
      tube(() => {
        g.moveTo(159, 178); g.lineTo(159, 310);
        g.moveTo(101, 256); g.lineTo(159, 314); g.lineTo(217, 256);
      }, RED, 10);

      g.restore();
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      return tex;
    };

    // Over the middle of the doorway, standing proud of the roof, on an arm
    // that runs back into the wall between the two faces.
    const p = W(K.dc, K.face - 0.80, K.floor + 2.40);
    const st = at(K.dc);
    const faces = [];
    for (const [flip, yaw] of [[false, Math.atan2(st.ux, st.uz)],
      [true, Math.atan2(-st.ux, -st.uz)]]) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.86, 0.75),
        new THREE.MeshBasicMaterial({ map: neonFace(flip), transparent: true,
          side: THREE.FrontSide, depthWrite: false }));
      mesh.position.set(p[0], p[1], p[2]);
      mesh.rotation.y = yaw;
      mesh.renderOrder = 2;
      scene.add(mesh);
      faces.push(mesh);
    }
    // The bracket, which has to hold the sign up without standing in front of
    // it. The first one did exactly that: an arm along the top and a "stay"
    // under it that was a solid 0.53 by 0.44 m plate, and since the panel hangs
    // in the same plane as its own bracket the plate sat squarely over Jadrija,
    // the left third of the OPEN box and most of the girl. A brace you can read
    // the sign through is not a brace.
    //
    // So it is hung rather than propped: one arm clear above the panel's top
    // edge, two short drop links down to it, and the only heavy piece is a
    // backplate at the wall, which is inboard of the panel's inner edge and
    // therefore in front of nothing. The panel is 0.86 by 0.75 centred 0.80 out
    // from the face, so it runs face−1.23 to face−0.37 and tops out at
    // floor + 2.775; every number below is measured off that.
    const AR = K.floor + 2.84;                 // underside of the arm
    boxTS(K.dc - 0.03, K.dc + 0.03, K.face - 1.30, K.face - 0.02,
      AR, AR + 0.06, TRIM);
    for (const s of [K.face - 1.20, K.face - 0.40]) {
      boxTS(K.dc - 0.022, K.dc + 0.022, s - 0.04, s + 0.04,
        K.floor + 2.74, AR + 0.01, TRIM);
    }
    // And a mast down through the roof at the arm's inner end. The arm clears
    // the tiles by better than half a metre, so ending it at the wall line ends
    // it in the sky: a sign has to be bolted to something you can see it bolted
    // to. It goes ten centimetres past the eave, which the roof hides.
    boxTS(K.dc - 0.055, K.dc + 0.055, K.face - 0.11, K.face - 0.02,
      K.eave - 0.10, AR + 0.10, TRIM);
    return faces;
  }


  // ── the boardwalk ──────────────────────────────────────────────────────────
  //
  // Ten businesses, west to east, between the mole and the kabine. Every one of
  // them is in the August 2026 field survey and every name below was read off a
  // sign; the four with `name: null` had no legible sign in any of the thirty-
  // nine photographs or the hundred and thirty-two frames, and they ship
  // unnamed rather than invented. A parade where every unit is named reads as a
  // shopping street, which this is not.
  //
  // `t0/t1` are along the shore and `s0/s1` inland, both in the resort's own
  // frame, taken from the GPS of the photograph that shows each front and — for
  // the pizzeria and Caffe Trampulin — from the OSM polygon, which for those two
  // is better than the GPS because it is the building and not the photographer.
  //
  // Kinds, and what each is made of:
  //   box     a body with a flat oversailing canopy on posts — the commonest
  //   kiosk   a small body with a lean-to and a serving hatch
  //   canopy  posts and a roof and no walls at all
  //   fence   posts and rails and a stipple quad for the mesh
  const SHOPS = [
    { key: 'f2', kind: 'box', t0: 200, t1: 213, s0: 30, s1: 37.2, h: 2.6,
      name: 'PIZZERIA', sub: 'F2', roof: [0.430, 0.252, 0.180],
      body: [0.560, 0.535, 0.487], awn: 0, fg: '#b03024', bg: '#efeade' },
    { key: 'konoba', kind: 'canopy', t0: 240, t1: 252, s0: 10, s1: 19, h: 2.7,
      name: null, roof: [0.330, 0.285, 0.205], post: [0.055, 0.150, 0.115],
      body: [0.075, 0.290, 0.250] },
    // 175806: the walls are pale render and glass and the GREEN is the
    // joinery — the door frames, the mullions, the trim. A body of 0.36 green
    // painted the whole twelve metres of it and read as a hoarding.
    { key: 'mini', kind: 'box', t0: 272, t1: 284, s0: 18, s1: 23.4, h: 2.45,
      name: 'beach bar MINI', roof: [0.560, 0.535, 0.478],
      body: [0.520, 0.528, 0.508], awn: 2.6, fg: '#1a2a3a', bg: '#ded7c7',
      pier: [0.075, 0.290, 0.140],
      plinth: [0.520, 0.430, 0.270] },
    { key: 'kiosk', kind: 'kiosk', t0: 290, t1: 293, s0: 20, s1: 23, h: 2.4,
      name: null, roof: [0.430, 0.252, 0.180], body: [0.130, 0.400, 0.130] },
    { key: 'tisak', kind: 'kiosk', t0: 305.5, t1: 309, s0: 22, s1: 24.2, h: 2.7,
      name: 'TISAK', roof: [0.470, 0.090, 0.070], body: [0.560, 0.535, 0.487],
      fg: '#ffffff', bg: '#c8201c' },
    { key: 'h2o', kind: 'box', t0: 312, t1: 325, s0: 22, s1: 27.0, h: 2.8,
      name: 'Caffee bar H2O', roof: [0.470, 0.462, 0.440],
      body: [0.505, 0.528, 0.545], awn: 3.0, fg: '#1c2b33', bg: '#e9eced',
      pier: [0.430, 0.405, 0.360] },
    { key: 'slast', kind: 'box', t0: 328, t1: 343, s0: 22, s1: 27.2, h: 2.95,
      name: 'Slastičarnica', sub: 'JADRIJA', roof: [0.590, 0.578, 0.545],
      body: [0.560, 0.535, 0.487], awn: 3.0, fg: '#a8221c', bg: '#eeece6',
      vitrine: true, cooler: true, scallop: true },
    { key: 'tramp', kind: 'fence', t0: 348, t1: 362, s0: 46, s1: 56, h: 2.2,
      name: null, post: [0.640, 0.520, 0.060], body: [0.055, 0.075, 0.062],
      rail: [0.660, 0.545, 0.075], skirt: [0.545, 0.075, 0.065] },
    { key: 'maslina', kind: 'kiosk', t0: 352, t1: 358, s0: 28, s1: 30.5, h: 2.6,
      name: 'Maslina', roof: [0.100, 0.108, 0.115], body: [0.075, 0.082, 0.088],
      flag: [0.185, 0.075, 0.165], fg: '#f0e8f0', bg: '#4e2c48' },
    { key: 'tramp2', kind: 'box', t0: 469, t1: 475, s0: 21, s1: 26.6, h: 2.55,
      name: 'Caffe TRAMPULIN', roof: [0.430, 0.252, 0.180],
      body: [0.560, 0.535, 0.487], awn: 3.2, fg: '#33302c', bg: '#e8e0cf',
      pergola: [0.075, 0.230, 0.140], bench: [0.330, 0.145, 0.095] },
  ];
  // What the promenade's own loops have to keep out of. A lamp coming up
  // through an awning and a bench standing inside a shop are the two failures
  // this prevents, and both of them look like a bug rather than like furniture.
  const clearOfShops = (t) => !SHOPS.some((S) => t > S.t0 - 2.5 && t < S.t1 + 2.5);

  // Hoisted, and this is the third time this file has taught the same lesson.
  // The playground is BUILT down beside the wood, but the car loop and the
  // tree loop both have to keep out of it and both of them run earlier — so a
  // `const` declared at the build site is in the temporal dead zone when they
  // read it, the whole resort throws, and the only symptom is a page that
  // never finishes loading. See the note on `facing`.
  const PLAY = { t0: 157, t1: 176, s0: 28.9, s1: 37.4 };
  const SAN = { t0: 347.4, t1: 357.2, s0: 32.0, s1: 36.6 };
  const TRAMP = { t0: 346.4, t1: 363.6, s0: 44.4, s1: 57.6 };

  /**
   * A painted sign, on a canvas.
   *
   * Basic rather than lit, for the same reason `mapBoard` is: the one job this
   * surface has is to be read, and a fascia in August with the eave's shadow
   * across half of it is correct and useless. Croatian diacritics come through
   * the same font stack the wall map already proves them on.
   */
  function shopSign(S, t, s, y, w, h) {
    // Sized off the HEIGHT, not the width, and this is the whole of why none of
    // these could be read.
    //
    // It was a 512-wide canvas with the height derived from the aspect, so a
    // 6.4 m by 0.38 m fascia got a canvas thirty pixels tall carrying a
    // fifteen-pixel font, and that was then stretched across six metres of
    // geometry. Every sign on the boardwalk was a fifteen-pixel word blown up
    // forty times. Fixing the height at 128 and deriving the width instead
    // gives about 320 texels a metre, which puts a 0.19 m capital at sixty
    // pixels — readable from the promenade, which is the whole job.
    const C = document.createElement('canvas');
    C.height = 128;
    C.width = Math.min(2048, Math.max(128, Math.round(128 * w / h)));
    const g = C.getContext('2d');
    g.fillStyle = S.bg || '#eeece6';
    g.fillRect(0, 0, C.width, C.height);
    g.fillStyle = S.fg || '#1a1a18';
    g.textAlign = 'center';
    // Fitted both ways, which the first version was not: it only ever shrank.
    //
    // The canvas is now as wide as the board is long — 2048 px for a 6.4 m
    // fascia — and a name set at a height-derived size lands in the middle of
    // it at three hundred pixels, so "Slastičarnica" came out a metre wide on a
    // six-metre sign with two and a half metres of blank either side. Solve for
    // the size that fills the board instead, and let the height cap it.
    const fit = (text, capPx, y) => {
      g.font = `600 100px "Helvetica Neue", Arial, sans-serif`;
      const at100 = g.measureText(text).width || 1;
      const size = Math.min(capPx, 100 * (C.width * 0.88) / at100);
      g.font = `600 ${size}px "Helvetica Neue", Arial, sans-serif`;
      g.fillText(text, C.width / 2, y);
    };
    fit(S.name, S.sub ? C.height * 0.44 : C.height * 0.60,
      S.sub ? C.height * 0.46 : C.height * 0.70);
    if (S.sub) fit(S.sub, C.height * 0.46, C.height * 0.95);
    const tex = new THREE.CanvasTexture(C);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    // A board with a face on it, not a decal on a wall.
    //
    // The first version was a bare plane six centimetres proud of whatever it
    // was mounted on, and the awning's gutter and rafters — added afterwards —
    // sat in front of it. Nothing z-fought, which is the confusing part: the
    // sign was simply behind a pipe. So the tray is drawn here, the face stands
    // clear of the tray by two centimetres, and both are placed relative to the
    // front of the sign rather than to the building, so nothing bolted on later
    // can get between them.
    const back = b;
    b = up;
    boxTS(t - w * 0.5 - 0.05, t + w * 0.5 + 0.05, s + 0.02, s + 0.10,
      y - h * 0.5 - 0.04, y + h * 0.5 + 0.04, [0.300, 0.296, 0.288]);
    b = back;
    const st = at(t), p = W(t, s, y);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    mesh.position.set(p[0], p[1], p[2]);
    // Facing the sea, which is ninety degrees off what this was doing.
    //
    // The rotation was copied from `mapBoard`, and `mapBoard` is on a *gable* —
    // an end wall, which faces along the shore, so `atan2(ux, uz)` is right for
    // it. A shopfront faces across the shore. Every sign on the boardwalk was
    // therefore mounted edge-on to the promenade and rendered as a hairline,
    // which is why they read as missing rather than as wrong: there was nothing
    // to see from any angle a walker ever stands at.
    //
    // The seaward direction is the inland normal turned round.
    mesh.rotation.y = Math.atan2(-st.nx, -st.nz);
    scene.add(mesh);
  }


  /**
   * The parts that make a frontage read as one, rather than as a box with a
   * name on it.
   *
   * A shop at forty metres is a silhouette and a colour; at four metres it is
   * an awning with rafters under it, a counter with something on it, a step, a
   * downpipe and a condenser on the roof that somebody bolted there in 2009.
   * None of it is individually worth modelling and all of it together is the
   * difference — the promenade is walked at eye height, which is the one
   * distance a plain extrusion cannot survive.
   */
  function shopKit(S, y0, top, fs) {
    const body = S.body || [0.520, 0.492, 0.430];
    const DARK = [0.045, 0.041, 0.038];
    const STEEL = [0.480, 0.486, 0.480];
    const oa = S.t0 + (S.t1 - S.t0) * 0.18, oc = S.t1 - (S.t1 - S.t0) * 0.18;
    // Rafters under the canopy, and the gutter along its front edge.
    if (fs != null) {
      for (let t = S.t0 - 0.2; t <= S.t1 + 0.21; t += 1.15) {
        boxTS(t - 0.035, t + 0.035, fs + 0.10, S.s0 - 0.05,
          top - 0.22, top - 0.17, shade(S.roof, 0.82));
      }
      // Along the *top* of the canopy edge. Across its face is where the sign
      // is, and a gutter there is a gutter over the name of the shop.
      boxTS(S.t0 - 0.45, S.t1 + 0.45, fs - 0.06, fs + 0.06,
        top + 0.02, top + 0.11, STEEL);
      boxTS(S.t0 - 0.42, S.t0 - 0.34, fs - 0.05, fs + 0.05, y0, top + 0.02, STEEL);
    }
    // The serving counter, and the mullions standing in the opening.
    boxTS(oa - 0.10, oc + 0.10, S.s0 - 0.34, S.s0 + 0.06, y0 + 0.98, y0 + 1.06,
      shade(body, 0.72), shade(body, 0.92));
    boxTS(oa, oc, S.s0 - 0.28, S.s0 - 0.02, y0 + 0.10, y0 + 0.98, shade(body, 0.62));
    const nmul = Math.max(2, Math.round((oc - oa) / 1.5));
    for (let k = 1; k < nmul; k++) {
      const t = oa + (oc - oa) * (k / nmul);
      boxTS(t - 0.035, t + 0.035, S.s0 - 0.03, S.s0 + 0.07, y0 + 1.06, top - 0.34,
        shade(body, 0.78));
    }
    // The threshold, a boot-worn strip of a different concrete.
    boxTS(S.t0 + 0.3, S.t1 - 0.3, S.s0 - 0.55, S.s0 - 0.05, y0, y0 + 0.06,
      CONC[2], CONC[0]);
    // What is on the roof: a condenser, a flue, and the strap over both.
    boxTS(S.t1 - 1.9, S.t1 - 1.1, S.s1 - 1.3, S.s1 - 0.5, top + 0.02, top + 0.46,
      STEEL, shade(STEEL, 0.86));
    post(W, S.t0 + 1.1, S.s1 - 0.9, top, top + 0.72, 0.055, [0.320, 0.316, 0.305], 6);
    // Two boards flanking the opening — menus, prices, a beer plaque. Panels
    // rather than lettering: the survey could read three prices on the whole
    // boardwalk and inventing the rest would be the one thing worth not doing.
    for (const [t, w] of [[oa - 0.42, 0.34], [oc + 0.42, 0.30]]) {
      boxTS(t - w * 0.5, t + w * 0.5, S.s0 - 0.05, S.s0 + 0.02,
        y0 + 1.15, y0 + 1.85, DARK, shade(body, 0.9));
    }
    // A downpipe off the back corner and a pair of pots at the front ones.
    post(W, S.t1 - 0.12, S.s1 - 0.10, y0, top, 0.045, STEEL, 5);
    for (const t of [S.t0 + 0.35, S.t1 - 0.35]) {
      post(W, t, S.s0 - 0.75, y0, y0 + 0.42, 0.24, [0.415, 0.300, 0.230], 7);
      dome(W, t, S.s0 - 0.75, y0 + 0.42, 0.34, 0.26, [0.180, 0.330, 0.165], 6);
    }
  }

  /**
   * Where the chairs of a terrace stand, in the resort's frame.
   *
   * Shared, because two passes a thousand lines apart both need it: the one
   * that draws the furniture and the one that puts somebody in it. Derived
   * twice, they drift, and what you get is a cafe where everybody is sitting
   * half a metre to the left of a chair.
   */
  function terraceSeats(S) {
    const out = [];
    if (!S.awn) return out;
    const fs = S.s0 - S.awn;
    for (let k = 0; k < 4; k++) {
      const t = S.t0 + 0.9 + k * ((S.t1 - S.t0 - 1.8) / 3);
      const s = fs - 1.9 + (k % 2) * 0.5;
      const ang = (k % 2) * 0.5 - 0.25;
      for (const [dt, ds] of [[0, 0], [0.62, 0.10], [0.30, 0.74]]) {
        out.push([t + dt * Math.cos(ang) - ds * Math.sin(ang),
          s + dt * Math.sin(ang) + ds * Math.cos(ang), ang]);
      }
    }
    return out;
  }

  /**
   * What people leave on the concrete.
   *
   * There is nothing on the floor of this resort — grep the file for a towel or
   * a sandal and you get comments. One photograph has flip-flops, slides, a
   * child's sandals, a towel, a hi-vis top and a pair of goggles within two
   * metres of a single lamp foot, and that is the ordinary state of a bathing
   * station in August. It is also the cheapest thing in this file: four
   * prototypes at forty triangles each, scattered where people actually stop —
   * the foot of a ladder, the foot of a lamp, the edge of a towel.
   */
  function clutter(t, s, y, n, seed) {
    // A local frame, rather than `facing`.
    //
    // `facing` is a `const` arrow declared four hundred lines below the two
    // places this is called from, so reaching for it here is the temporal dead
    // zone and the whole resort fails to build — with the only symptom being a
    // page that never finishes loading. Six lines of the same arithmetic is
    // cheaper than moving a declaration everything else already depends on.
    const frame = (ct, cs, ang) => (dt, ds, yy) => {
      const c = Math.cos(ang), sn = Math.sin(ang);
      return W(ct + dt * c - ds * sn, cs + dt * sn + ds * c, yy);
    };
    const SAND = [[0.520, 0.180, 0.190], [0.130, 0.200, 0.400],
      [0.700, 0.640, 0.180], [0.180, 0.190, 0.200], [0.820, 0.780, 0.740]];
    const TOWEL = [[0.620, 0.180, 0.200], [0.180, 0.420, 0.620],
      [0.780, 0.700, 0.220], [0.240, 0.520, 0.340]];
    for (let k = 0; k < n; k++) {
      const j0 = jit(seed + k, 1), j1 = jit(seed + k, 2), j2 = jit(seed + k, 3);
      const ct = t + (j0 - 0.5) * 2.6, cs = s + (j1 - 0.5) * 2.0;
      const a = j2 * TAU;
      const kind = ((j2 * 97) | 0) % 4;
      if (kind === 0 || kind === 1) {
        // A sandal: a sole and a strap, and always a pair a little apart.
        for (const o of [-0.09, 0.09]) {
          const P = frame(ct + o * Math.cos(a), cs + o * Math.sin(a), a);
          boxIn(P, -0.125, 0.125, -0.042, 0.042, y + 0.002, y + 0.026,
            SAND[((j0 * 53) | 0) % SAND.length]);
          boxIn(P, -0.02, 0.055, -0.045, 0.045, y + 0.026, y + 0.038,
            SAND[((j1 * 31) | 0) % SAND.length]);
        }
      } else if (kind === 2) {
        // A towel, dropped rather than laid: folded over on itself.
        const P = frame(ct, cs, a);
        boxIn(P, -0.34, 0.34, -0.22, 0.22, y + 0.002, y + 0.030,
          TOWEL[((j0 * 71) | 0) % TOWEL.length]);
        boxIn(P, -0.30, 0.10, -0.18, 0.18, y + 0.030, y + 0.052,
          TOWEL[((j1 * 41) | 0) % TOWEL.length]);
      } else {
        // A bag, slumped, with a strap over it.
        const P = frame(ct, cs, a);
        boxIn(P, -0.20, 0.20, -0.13, 0.13, y + 0.002, y + 0.24,
          SAND[((j1 * 67) | 0) % SAND.length]);
        boxIn(P, -0.06, 0.06, -0.15, 0.15, y + 0.24, y + 0.28,
          [0.140, 0.140, 0.145]);
      }
    }
  }

  /** A moulded chair and a café table, which is all the terraces need. */
  /**
   * What is on top of a shop.
   *
   * Filmed from the wood, which is uphill of the whole boardwalk, the roofs
   * are the largest surface any of these buildings shows you — and every one
   * of them was one flat white plane. A flat roof on this coast is never that:
   * it is grey screed laid in bays with a kerb round the edge, a plastic water
   * tank on a stand, a dish, an aerial, and the block somebody put on the
   * cable so the bora would not take it.
   */
  function shopRoof(S, y0, top) {
    const ry = top + 0.06;
    const SCREED = [0.455, 0.448, 0.428];
    const KERB = [0.520, 0.512, 0.488];
    const a = S.t0 - 0.30, c = S.t1 + 0.30;
    const s0 = (S.awn ? S.s0 - S.awn : S.s0) + 0.30, s1 = S.s1 + 0.30;
    const key = S.t0 | 0;

    // The screed, in bays, each one a shade off its neighbour — which is what
    // a roof laid in a morning by two people with a bucket looks like.
    for (let t = a; t < c; t += 1.9) {
      const t1 = Math.min(t + 1.9, c);
      for (let k = 0; k < 2; k++) {
        const b0 = s0 + (s1 - s0) * (k / 2), b1 = s0 + (s1 - s0) * ((k + 1) / 2);
        const g = 0.93 + 0.14 * ((jit(t | 0, 320 + k) * 5) | 0) / 4;
        boxTS(t, t1, b0, b1, ry, ry + 0.02,
          [SCREED[0] * g, SCREED[1] * g, SCREED[2] * g]);
      }
    }
    // The kerb: a low upstand all the way round, which is the one line that
    // tells you it is a roof and not a lid.
    boxTS(a, c, s0, s0 + 0.16, ry, ry + 0.13, KERB, shade(KERB, 1.08));
    boxTS(a, c, s1 - 0.16, s1, ry, ry + 0.13, KERB, shade(KERB, 1.08));
    boxTS(a, a + 0.16, s0, s1, ry, ry + 0.13, KERB, shade(KERB, 1.08));
    boxTS(c - 0.16, c, s0, s1, ry, ry + 0.13, KERB, shade(KERB, 1.08));

    // The water tank, on its stand, with the pipe going down through the roof.
    const wt = S.t0 + 1.9 + jit(key, 321) * 1.2, ws = S.s1 - 1.1;
    for (const [ot, os] of [[-0.52, -0.52], [0.52, -0.52], [-0.52, 0.52], [0.52, 0.52]]) {
      post(W, wt + ot, ws + os, ry, ry + 0.34, 0.05, [0.400, 0.406, 0.400], 5);
    }
    boxTS(wt - 0.62, wt + 0.62, ws - 0.62, ws + 0.62, ry + 0.30, ry + 0.38,
      [0.360, 0.366, 0.360]);
    const TANK = jit(key, 322) < 0.5 ? [0.140, 0.175, 0.230] : [0.115, 0.115, 0.125];
    post(W, wt, ws, ry + 0.38, ry + 1.46, 0.56, TANK, 10);
    post(W, wt, ws, ry + 1.46, ry + 1.58, 0.20, shade(TANK, 1.25), 8);
    post(W, wt, ws + 0.60, ry + 0.10, ry + 0.44, 0.035, [0.520, 0.516, 0.500], 5);

    // A dish on a short cranked post, pointed the way every dish on this coast
    // is pointed, and an aerial beside it.
    const dt = S.t1 - 1.5, ds = S.s1 - 0.9;
    post(W, dt, ds, ry, ry + 0.86, 0.035, [0.420, 0.424, 0.420], 5);
    post(W, dt, ds - 0.22, ry + 0.80, ry + 0.86, 0.035, [0.420, 0.424, 0.420], 5);
    frustumTS(ry + 0.78, [dt, ds - 0.34, 0.30, 0.06],
      ry + 0.96, [dt, ds - 0.44, 0.34, 0.10],
      [0.680, 0.676, 0.660], [0.700, 0.696, 0.680]);
    post(W, dt, ds - 0.46, ry + 0.86, ry + 0.92, 0.04, [0.300, 0.300, 0.310], 5);
    post(W, dt - 0.8, ds, ry, ry + 1.70, 0.022, [0.360, 0.362, 0.360], 4);
    for (let i = 0; i < 5; i++) {
      boxTS(dt - 0.82, dt - 0.78, ds - 0.26 + i * 0.02, ds + 0.26 - i * 0.02,
        ry + 1.10 + i * 0.13, ry + 1.13 + i * 0.13, [0.360, 0.362, 0.360]);
    }

    // And the blocks somebody put on the cable, because the bora takes
    // anything that is only lying there.
    for (let i = 0; i < 3; i++) {
      const bt = S.t0 + 4.0 + i * 2.6;
      if (bt > S.t1 - 0.6) break;
      boxTS(bt - 0.20, bt + 0.20, s1 - 1.9, s1 - 1.5, ry, ry + 0.11,
        [0.500, 0.492, 0.470], [0.530, 0.522, 0.498]);
      boxTS(bt - 0.03, bt + 0.03, s1 - 1.9, s1 - 1.5, ry + 0.10, ry + 0.13,
        [0.180, 0.180, 0.188]);
    }
  }

  /**
   * The back of a shop, and the yard it stands in.
   *
   * Every box on this boardwalk was a rendered front with five blank faces
   * behind it. That was survivable while nobody stood behind them — and then
   * the wood got cars parked in it, which means the player walks the whole
   * length of the rear elevation on the way in from the lane. Filmed from
   * there, `h2o` was a ten-metre-deep unbroken slab of near-black: the one
   * object in the resort you could see from the trees and the one nobody had
   * drawn a single feature on.
   *
   * What is actually behind a Dalmatian beach kiosk is a service yard. A steel
   * door with a step up to it, a meter cabinet, the condenser that runs the
   * cold cabinet, a downpipe off the eaves, and whatever the delivery left
   * standing against the wall. None of it is invented: it is the same kit on
   * the back of every one of them, and it is the reason the front can be
   * clean.
   */
  function shopBack(S, y0, top) {
    const back = S.s1;
    const body = S.body || [0.520, 0.492, 0.430];
    // A brand colour is a front, not a building. Maslina's body is 0.08 grey
    // — right for the face the name is on, and from the wood it was a hole in
    // the world. Anything this dark gets a plain render skin on the back,
    // which is what is actually there: nobody paints the service side.
    const lum = body[0] * 0.2126 + body[1] * 0.7152 + body[2] * 0.0722;
    const REND = lum < 0.16 ? [0.470, 0.452, 0.420] : shade(body, 0.93);
    if (lum < 0.16) {
      boxTS(S.t0 - 0.01, S.t1 + 0.01, back - 0.04, back + 0.03,
        y0 - 0.35, top, REND, shade(REND, 1.06));
    }
    const DARK = shade(REND, 0.62);
    const STEEL = [0.318, 0.324, 0.330];
    const GREY = [0.470, 0.472, 0.468];
    const len = S.t1 - S.t0;
    const key = (S.t0 | 0);

    // The render does not run to the ground: there is a plinth course, and it
    // is grubbier than the wall above it.
    boxTS(S.t0 - 0.04, S.t1 + 0.04, back - 0.05, back + 0.09, y0, y0 + 0.44,
      shade(REND, 0.80), shade(REND, 0.88));

    // A gutter along the eaves with a downpipe at each end. Two boxes and a
    // post, and it is the difference between a wall and a building.
    boxTS(S.t0 - 0.2, S.t1 + 0.2, back + 0.04, back + 0.16, top - 0.14, top - 0.02,
      GREY, shade(GREY, 1.08));
    for (const dt of [0.5, len - 0.5]) {
      post(W, S.t0 + dt, back + 0.10, y0, top - 0.12, 0.045, GREY, 6);
      // The shoe at the bottom, kicked out over a concrete splash pad.
      boxTS(S.t0 + dt - 0.07, S.t0 + dt + 0.07, back + 0.10, back + 0.34,
        y0 + 0.02, y0 + 0.16, GREY);
      b = deck;
      boxTS(S.t0 + dt - 0.30, S.t0 + dt + 0.30, back + 0.06, back + 0.50,
        y0 - 0.04, y0 + 0.03, CONC[2], CONC[1]);
      b = up;
    }

    // The service door: a reveal cut into the render, a leaf standing 60 mm
    // behind it, a kick plate and a lever. Steel, because every one of them is.
    const td = S.t0 + len * (0.26 + jit(key, 61) * 0.14);
    boxTS(td - 0.48, td + 0.48, back - 0.02, back + 0.12, y0, y0 + 2.06, DARK);
    boxTS(td - 0.42, td + 0.42, back + 0.02, back + 0.08, y0 + 0.02, y0 + 2.00,
      STEEL, shade(STEEL, 1.06));
    boxTS(td - 0.42, td + 0.42, back + 0.06, back + 0.10, y0 + 0.02, y0 + 0.34,
      shade(STEEL, 0.86));
    boxTS(td + 0.28, td + 0.36, back + 0.08, back + 0.16, y0 + 1.02, y0 + 1.10,
      [0.560, 0.556, 0.540]);
    // And the step, which is what tells you the floor inside is not the yard.
    b = deck;
    boxTS(td - 0.62, td + 0.62, back + 0.08, back + 0.72, y0 - 0.10, y0 + 0.06,
      CONC[1], CONC[0]);
    b = up;

    // The meter cabinet and, above it, the box the whole street's phone line
    // comes into. Both are grey plastic and both are always beside the door.
    boxTS(td + 0.72, td + 1.28, back + 0.02, back + 0.24, y0 + 0.90, y0 + 1.66,
      GREY, shade(GREY, 1.10));
    boxTS(td + 0.76, td + 1.24, back + 0.24, back + 0.26, y0 + 0.94, y0 + 1.62,
      shade(GREY, 0.88));
    boxTS(td + 0.86, td + 1.14, back + 0.02, back + 0.14, y0 + 1.76, y0 + 2.04,
      shade(GREY, 0.94));

    // The condenser. A cold cabinet at the front is a fan unit at the back —
    // on two brackets, clear of the ground, with a louvred face and the pipe
    // run going back in through the wall in its own lagging.
    const tc = S.t1 - 1.6 - jit(key, 62) * 0.8;
    const cy = y0 + 1.28;
    boxTS(tc - 0.52, tc + 0.52, back + 0.06, back + 0.46, cy, cy + 0.72,
      [0.545, 0.548, 0.545], [0.575, 0.578, 0.575]);
    for (let i = 0; i < 7; i++) {
      const yy = cy + 0.10 + i * 0.078;
      boxTS(tc - 0.46, tc + 0.46, back + 0.46, back + 0.48, yy, yy + 0.045,
        [0.235, 0.240, 0.245]);
    }
    for (const o of [-0.42, 0.42]) {
      boxTS(tc + o - 0.04, tc + o + 0.04, back + 0.04, back + 0.44,
        cy - 0.10, cy, STEEL);
      boxTS(tc + o - 0.05, tc + o + 0.05, back + 0.02, back + 0.10,
        cy - 0.10, cy + 0.74, STEEL);
    }
    post(W, tc - 0.30, back + 0.20, cy + 0.72, top - 0.16, 0.045,
      [0.620, 0.615, 0.600], 6);

    // A vent hood over the servery, and its duct.
    const tv = S.t0 + len * 0.62;
    boxTS(tv - 0.34, tv + 0.34, back + 0.02, back + 0.30, top - 0.86, top - 0.42,
      [0.505, 0.508, 0.505], [0.535, 0.538, 0.535]);
    boxTS(tv - 0.20, tv + 0.20, back + 0.06, back + 0.26, top - 0.42, top + 0.34,
      [0.505, 0.508, 0.505]);
    post(W, tv, back + 0.16, top + 0.34, top + 0.52, 0.24,
      [0.470, 0.472, 0.470], 8);

    // A high window with a security grille, because the store room has one and
    // it is the only opening in the whole elevation that is not the door.
    const tw = S.t0 + len * 0.80;
    boxTS(tw - 0.44, tw + 0.44, back - 0.02, back + 0.10, y0 + 1.36, y0 + 2.02,
      DARK);
    boxTS(tw - 0.38, tw + 0.38, back + 0.04, back + 0.07, y0 + 1.42, y0 + 1.96,
      [0.090, 0.105, 0.115]);
    for (let i = 0; i < 4; i++) {
      const a = tw - 0.30 + i * 0.20;
      boxTS(a - 0.015, a + 0.015, back + 0.07, back + 0.10, y0 + 1.40, y0 + 1.98,
        [0.240, 0.238, 0.230]);
    }

    // What is standing in the yard. Crates go in a stack against the wall,
    // the bin goes where it can be wheeled out, and the gas is in a pair by
    // the door with a chain round it.
    const CRATE = [[0.560, 0.230, 0.130], [0.130, 0.290, 0.480],
      [0.180, 0.400, 0.200], [0.520, 0.480, 0.180]];
    const tb = S.t0 + len * 0.44;
    for (let i = 0; i < 5; i++) {
      const c = CRATE[((jit(key, 70 + i) * 97) | 0) % CRATE.length];
      const off = (jit(key, 80 + i) - 0.5) * 0.14;
      const yy = y0 + i * 0.31;
      boxTS(tb - 0.28 + off, tb + 0.28 + off, back + 0.14, back + 0.66,
        yy, yy + 0.29, c, shade(c, 1.10));
      // The stacking rim, which is what stops a crate reading as a brick.
      boxTS(tb - 0.29 + off, tb + 0.29 + off, back + 0.13, back + 0.67,
        yy + 0.25, yy + 0.29, shade(c, 0.86));
    }
    // The wheelie bin: a tapered body, a lid with a lip, and two wheels.
    const tn = S.t0 + len * 0.44 + 0.98;
    frustumTS(y0 + 0.10, [tn, back + 0.62, 0.32, 0.28],
      y0 + 1.06, [tn, back + 0.58, 0.36, 0.32],
      [0.150, 0.230, 0.165], [0.170, 0.255, 0.185]);
    boxTS(tn - 0.38, tn + 0.38, back + 0.24, back + 0.94, y0 + 1.06, y0 + 1.16,
      [0.115, 0.185, 0.130], [0.135, 0.210, 0.150]);
    for (const o of [-0.28, 0.28]) {
      post(W, tn + o, back + 0.34, y0, y0 + 0.11, 0.055, [0.075, 0.075, 0.080], 6);
    }
    // Two gas bottles by the door, and the bar across them.
    for (let i = 0; i < 2; i++) {
      const tg = td - 0.72 - i * 0.36;
      post(W, tg, back + 0.34, y0, y0 + 0.62, 0.16, [0.640, 0.230, 0.120], 8);
      post(W, tg, back + 0.34, y0 + 0.62, y0 + 0.74, 0.09, [0.470, 0.170, 0.090], 7);
    }
    boxTS(td - 1.16, td - 0.56, back + 0.18, back + 0.22, y0 + 0.46, y0 + 0.52,
      STEEL);

    runs.push({ t0: S.t0 - 0.2, t1: S.t1 + 0.2, s0: back, s1: back + 1.0,
      y: y0, h: 1.3 });
  }

  function terraceSet(t, s, y, ang, col) {
    const seat = [0.230, 0.235, 0.240];
    for (const [dt, ds] of [[0, 0], [0.62, 0.10], [0.30, 0.74]]) {
      const ct = t + dt * Math.cos(ang) - ds * Math.sin(ang);
      const cs = s + dt * Math.sin(ang) + ds * Math.cos(ang);
      boxTS(ct - 0.24, ct + 0.24, cs - 0.23, cs + 0.23, y + 0.40, y + 0.46,
        col || seat);
      boxTS(ct - 0.24, ct + 0.24, cs + 0.17, cs + 0.23, y + 0.46, y + 0.86,
        col || seat);
      for (const [ot, os] of [[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.17], [0.19, 0.17]]) {
        boxTS(ct + ot - 0.022, ct + ot + 0.022, cs + os - 0.022, cs + os + 0.022,
          y, y + 0.40, shade(col || seat, 0.8));
      }
    }
    boxTS(t + 0.18, t + 0.78, s + 0.14, s + 0.74, y + 0.70, y + 0.75,
      [0.520, 0.512, 0.492]);
    post(W, t + 0.48, s + 0.44, y, y + 0.70, 0.035, [0.330, 0.334, 0.330], 6);
  }

  /**
   * A hundred years of Jadrija, printed on a board.
   *
   * The single most repeated image in the survey. It turns up three times
   * independently — a PVC hoarding on galvanised legs beside the container
   * kiosk, a panel standing on the plaza, and the end panels of the cabins at
   * the west end, which are the only legible Jadrija signage in a hundred and
   * thirty-two frames of the walk. Every one of them is the same idea: a grid
   * of kabina doors in four colours, a big 100 whose zeroes are hut fronts, and
   * "od 1922." underneath.
   *
   * It earns its triangles twice over, because the motif is *already* the thing
   * this resort is built out of — eight hundred coloured doors in two rows —
   * so the board reads as the place explaining itself.
   */
  function centenary(t, s, w, h, y, opts = {}) {
    const DOOR = ['#cf3b2e', '#3f9a56', '#6cb2dd', '#e3b23c'];
    const PX = 1024, C = document.createElement('canvas');
    C.width = PX; C.height = Math.round(PX * h / w);
    const g = C.getContext('2d');
    g.fillStyle = opts.bg || '#efe6c4';
    g.fillRect(0, 0, C.width, C.height);
    // The door grid: four across, six down, rounded like the real openings.
    const cols = 4, rows = 6;
    const gw = C.width * 0.40, gh = C.height * 0.74;
    const gx = C.width * 0.045, gy = (C.height - gh) * 0.5;
    const cw = gw / cols, ch = gh / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle = DOOR[(r * cols + c + (r % 3)) % DOOR.length];
        const x = gx + c * cw + cw * 0.10, yy = gy + r * ch + ch * 0.10;
        const ww = cw * 0.80, hh = ch * 0.80, rr = Math.min(ww, hh) * 0.18;
        g.beginPath();
        g.moveTo(x + rr, yy);
        g.arcTo(x + ww, yy, x + ww, yy + hh, rr);
        g.arcTo(x + ww, yy + hh, x, yy + hh, rr);
        g.arcTo(x, yy + hh, x, yy, rr);
        g.arcTo(x, yy, x + ww, yy, rr);
        g.closePath();
        g.fill();
      }
    }
    // And the words, to the right of the grid.
    const tx = gx + gw + (C.width - gx - gw) * 0.48;
    g.textAlign = 'center';
    g.fillStyle = opts.fg || '#20364a';
    g.font = `800 ${C.height * 0.46}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(opts.big || '100', tx, C.height * 0.56);
    g.font = `600 ${C.height * 0.15}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText('JADRIJA', tx, C.height * 0.75);
    g.font = `400 ${C.height * 0.13}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText('od 1922.', tx, C.height * 0.91);
    const tex = new THREE.CanvasTexture(C);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const st = at(t), p = W(t, s, y);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    mesh.position.set(p[0], p[1], p[2]);
    // Seaward, like the shop signs — and for the same reason `mapBoard`'s
    // rotation is wrong here: that one is on a gable.
    mesh.rotation.y = Math.atan2(-st.nx, -st.nz);
    scene.add(mesh);
    // The box behind it, and the legs under it.
    const back4 = b;
    b = up;
    boxTS(t - w * 0.5, t + w * 0.5, s + 0.03, s + 0.42,
      y - h * 0.5, y + h * 0.5, [0.560, 0.540, 0.470], [0.600, 0.578, 0.505]);
    if (opts.legs !== false) {
      for (const o of [-w * 0.42, w * 0.42]) {
        for (const ds of [0.08, 0.38]) {
          post(W, t + o, s + ds, at(t).deck, y - h * 0.5 + 0.05, 0.035,
            [0.520, 0.528, 0.522], 6);
        }
      }
    }
    b = back4;
    runs.push({ t0: t - w * 0.5, t1: t + w * 0.5, s0: s - 0.05, s1: s + 0.45,
      y: at(t).deck, h: y + h * 0.5 - at(t).deck });
  }

  /**
   * The lit wall behind the counter.
   *
   * The Slasticarnica's name is not on its awning. It is on a back-lit panel
   * inside, in a row with the price boards and a strip of product light-boxes
   * above them — which is how every kiosk of this kind on the coast is signed,
   * and why the awning itself is plain white with a scalloped edge and nothing
   * written on it anywhere.
   *
   * Only the three prices the survey could actually read go on the board.
   * Six back-lit panels were legible enough to place and only three of the
   * words on them could be made out; the rest are drawn as the flame-orange
   * blocks they are rather than lettered with guesses.
   */
  function menuWall(S, y0, top) {
    const PX = 1024, C = document.createElement('canvas');
    C.width = PX; C.height = 512;
    const g = C.getContext('2d');
    g.fillStyle = '#f2f4f6'; g.fillRect(0, 0, C.width, C.height);
    // The product strip along the top: orange flame grounds with a pale block
    // where the photograph of the thing is.
    for (let i = 0; i < 6; i++) {
      const x = 8 + i * (C.width - 16) / 6, w = (C.width - 16) / 6 - 8;
      const grd = g.createLinearGradient(x, 0, x + w, 0);
      grd.addColorStop(0, '#f0a03c'); grd.addColorStop(0.5, '#e8641c');
      grd.addColorStop(1, '#f0a03c');
      g.fillStyle = grd; g.fillRect(x, 8, w, 150);
      g.fillStyle = '#efe7dc'; g.fillRect(x + w * 0.18, 26, w * 0.64, 108);
    }
    // Three boards below it. Left and right are blue price lists; the middle
    // is the name.
    const bw = (C.width - 32) / 3;
    for (let i = 0; i < 3; i++) {
      const x = 8 + i * (bw + 8);
      g.fillStyle = i === 1 ? '#ffffff' : '#dceaf6';
      g.fillRect(x, 172, bw, C.height - 190);
      g.textAlign = i === 1 ? 'center' : 'left';
      if (i === 1) {
        g.fillStyle = '#1f4f96';
        g.font = '600 44px "Helvetica Neue", Arial, sans-serif';
        g.fillText('Slastičarnica', x + bw / 2, 236);
        g.fillStyle = '#b3242a';
        g.font = '800 76px "Helvetica Neue", Arial, sans-serif';
        g.fillText('JADRIJA', x + bw / 2, 312);
      } else {
        g.fillStyle = '#1f4f96';
        g.font = '600 34px "Helvetica Neue", Arial, sans-serif';
        // Left board: the drinks that were legible. Right: the prices, and
        // only the three that could be read.
        const rows = i === 0
          ? [['LIMUNADA', ''], ['SPRITE', ''], ['SLADOLED', ''], ['KRAFNE', '']]
          : [['KUPOVI', '8.00 €'], ['FRAPPE', '7.00 €'], ['ESPRESSO', '2.00 €'],
            ['MACCHIATO', '']];
        rows.forEach(([k, v], r) => {
          g.fillText(k, x + 18, 226 + r * 56);
          if (v) {
            g.textAlign = 'right';
            g.fillText(v, x + bw - 18, 226 + r * 56);
            g.textAlign = 'left';
          }
        });
      }
    }
    const tex = new THREE.CanvasTexture(C);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    // On the front face, not behind it. The first cut put this at s0 + 0.30 —
    // thirty centimetres *into* a solid body box — so the whole wall was inside
    // the building and the shop had no signage at all from the promenade. In
    // life these boards are on the back wall of an open serving recess; the
    // recess is a dark panel here rather than a hole, so the honest place for
    // them is the frontage itself, which is where they read from anyway.
    // Between the counter and the underside of the canopy, which is a narrower
    // band than it sounds: at 0.70 of the wall height the boards sat behind the
    // awning from any viewpoint lower than the awning itself, which is every
    // viewpoint a walker has. The photograph has them filling the upper half of
    // the opening and stopping well clear of the fascia.
    const t = (S.t0 + S.t1) * 0.5, sIn = S.s0 - 0.55;   // was -0.06
    const st = at(t), p = W(t, sIn, y0 + (top - y0) * 0.60);
    const w = (S.t1 - S.t0) * 0.80, h = (top - y0) * 0.38;
    const back8 = b;
    b = up;
    boxTS(t - w * 0.5 - 0.04, t + w * 0.5 + 0.04, sIn + 0.02, sIn + 0.10,
      p[1] - h * 0.5 - 0.03, p[1] + h * 0.5 + 0.03, [0.300, 0.296, 0.288]);
    b = back8;

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    mesh.position.set(p[0], p[1], p[2]);
    mesh.rotation.y = Math.atan2(-st.nx, -st.nz);
    scene.add(mesh);
  }

  /** One business. Everything upright goes in `up`; pads stay in `deck`. */
  /**
   * What one shop has that the others do not.
   *
   * `shopKit` is the kit every frontage on the boardwalk shares — counter,
   * mullions, rafters, downpipe, pots. This is the other half: the thing in
   * each photograph that could not be anywhere else, and the reason the
   * businesses were reading as one business drawn four times.
   */
  function shopExtras(S, y0, top) {
    const STEEL = [0.480, 0.486, 0.480];
    const TIMB = [0.235, 0.150, 0.105];

    if (S.key === 'konoba') {
      // 175856. The counter stands on a limestone rubble base course, the top
      // is teal, and the stools are scarlet and lime — which is the whole
      // colour of the place and the one thing in the frame you could not
      // guess.
      const cs = S.s1 - 1.5;
      for (let t = S.t0 + 1.1; t < S.t0 + 7.3; t += 0.42) {
        const g = 0.90 + jit(t * 7 | 0, 130) * 0.20;
        frustumTS(y0, [t + 0.21, cs + 0.5, 0.21, 0.52],
          y0 + 0.34 + jit(t * 7 | 0, 131) * 0.10,
          [t + 0.20, cs + 0.5, 0.18, 0.49],
          [0.560 * g, 0.535 * g, 0.485 * g]);
      }
      const SCAR = [0.620, 0.115, 0.095], LIME = [0.400, 0.640, 0.120];
      for (let k = 0; k < 5; k++) {
        const t = S.t0 + 1.9 + k * 1.15, s = cs - 0.78;
        const col = k % 2 ? LIME : SCAR;
        for (const [ot, os] of [[-0.15, -0.15], [0.15, -0.15],
          [-0.15, 0.15], [0.15, 0.15]]) {
          post(W, t + ot, s + os, y0, y0 + 0.72, 0.018, [0.560, 0.566, 0.560], 5);
        }
        // The foot ring, which is what stops a bar stool reading as a stick.
        for (const os of [-0.17, 0.17]) {
          boxTS(t - 0.17, t + 0.17, s + os - 0.015, s + os + 0.015,
            y0 + 0.24, y0 + 0.27, [0.560, 0.566, 0.560]);
        }
        boxTS(t - 0.20, t + 0.20, s - 0.20, s + 0.20, y0 + 0.72, y0 + 0.79,
          col, shade(col, 1.12));
        // A low back, on the ones that have one.
        if (k % 2 === 0) {
          boxTS(t - 0.19, t + 0.19, s + 0.17, s + 0.21, y0 + 0.79, y0 + 1.10,
            shade(col, 0.92));
        }
      }
      // The concrete collar somebody poured round the pine that comes up
      // through this terrace. The tree itself is planted in `shopPlanting`,
      // below: `pine` is fine to call from here — it is a declaration and it
      // hoists — but `greens` is a `const` a thousand lines further down and
      // reading it from here is the temporal dead zone all over again.
      post(W, S.t1 - 1.6, S.s0 + 2.2, y0 - 0.05, y0 + 0.16, 0.62,
        [0.520, 0.505, 0.470], 9);
      return;
    }

    if (S.key === 'mini') {
      // 175806. The awning over this terrace is not on the building: it is a
      // cantilever on a grey steel mast with a stack of pebble-aggregate
      // ballast slabs at its foot, and the ballast is the memorable half.
      const mt = S.t1 - 1.2, ms = S.s0 - 5.2;
      for (let i = 0; i < 3; i++) {
        const r = 0.78 - i * 0.07;
        boxTS(mt - r, mt + r, ms - r, ms + r,
          y0 + i * 0.15, y0 + 0.15 + i * 0.15,
          [0.520, 0.500, 0.455], [0.548, 0.528, 0.482]);
      }
      post(W, mt, ms, y0 + 0.45, y0 + 3.45, 0.085, [0.400, 0.406, 0.410], 8);
      // The arm, cranked out over the tables, and the canopy hanging off it.
      boxTS(mt - 0.06, mt + 0.06, ms, ms + 2.9, y0 + 3.30, y0 + 3.45,
        [0.400, 0.406, 0.410]);
      for (let i = 0; i < 4; i++) {
        const a0 = (i / 4) * TAU + 0.4, a1 = ((i + 1) / 4) * TAU + 0.4;
        const R = 2.15;
        b.quad(W(mt, ms + 2.6, y0 + 3.34),
          W(mt + Math.cos(a0) * R, ms + 2.6 + Math.sin(a0) * R, y0 + 2.88),
          W(mt + Math.cos(a1) * R, ms + 2.6 + Math.sin(a1) * R, y0 + 2.88),
          W(mt, ms + 2.6, y0 + 3.34),
          i % 2 ? [0.585, 0.570, 0.530] : [0.555, 0.540, 0.502]);
      }
      // The planter on legs. What grows in it is planted in `shopPlanting`,
      // and so are the yellow deckchairs.
      const pt = S.t0 + 6.4, ps = S.s0 - 3.6;
      for (const [ot, os] of [[-0.62, -0.22], [0.62, -0.22], [-0.62, 0.22], [0.62, 0.22]]) {
        post(W, pt + ot, ps + os, y0, y0 + 0.52, 0.045, TIMB, 5);
      }
      boxTS(pt - 0.72, pt + 0.72, ps - 0.30, ps + 0.30, y0 + 0.52, y0 + 0.86,
        TIMB, [0.300, 0.255, 0.190]);
      boxTS(pt - 0.66, pt + 0.66, ps - 0.25, ps + 0.25, y0 + 0.84, y0 + 0.88,
        [0.230, 0.330, 0.180]);
      // And the diagonal timber lattice that screens the far end of it.
      for (let k = 0; k < 9; k++) {
        const a = S.t1 - 0.4 - k * 0.24;
        b.quad(W(a, S.s0 - 0.35, y0 + 0.10), W(a + 0.10, S.s0 - 0.35, y0 + 0.10),
          W(a + 0.72, S.s0 - 0.35, y0 + 1.90), W(a + 0.62, S.s0 - 0.35, y0 + 1.90),
          TIMB);
        b.quad(W(a + 0.72, S.s0 - 0.33, y0 + 0.10), W(a + 0.62, S.s0 - 0.33, y0 + 0.10),
          W(a, S.s0 - 0.33, y0 + 1.90), W(a + 0.10, S.s0 - 0.33, y0 + 1.90),
          shade(TIMB, 1.14));
      }
      return;
    }

    if (S.key === 'tramp2') {
      // 174947. The canopy is on green steel with a diagonal brace at every
      // head, and there is a yellow ice-cream cart standing under it with
      // pressed panels on the side.
      const fs = S.s0 - (S.awn || 3.2);
      for (let t = S.t0; t <= S.t1 + 0.01; t += 3.0) {
        for (const d of [-0.55, 0.55]) {
          b.quad(W(t + d * 0.1, fs + 0.30, y0 + 1.86),
            W(t + d, fs + 0.30, y0 + 2.36),
            W(t + d, fs + 0.36, y0 + 2.36),
            W(t + d * 0.1, fs + 0.36, y0 + 1.86), S.pergola);
        }
      }
      const ct = S.t0 + 1.6, cs = fs + 1.05;
      boxTS(ct - 0.78, ct + 0.78, cs - 0.44, cs + 0.44, y0 + 0.34, y0 + 1.02,
        [0.660, 0.600, 0.320], [0.700, 0.640, 0.360]);
      boxTS(ct - 0.72, ct + 0.72, cs - 0.46, cs - 0.42, y0 + 0.44, y0 + 0.92,
        [0.560, 0.500, 0.240]);
      boxTS(ct - 0.80, ct + 0.80, cs - 0.46, cs + 0.46, y0 + 1.02, y0 + 1.08,
        [0.760, 0.755, 0.740]);
      for (const [ot, os] of [[-0.62, 0.30], [0.62, 0.30], [0.62, -0.30]]) {
        post(W, ct + ot, cs + os, y0, y0 + 0.34, 0.09, [0.120, 0.120, 0.125], 7);
      }
      return;
    }
  }

  /**
   * Where the lane meets the resort: a lift barrier and the sign that goes
   * with it.
   *
   * 174947 has both, ten metres east of Trampulin — the red and white boom
   * across the tarmac and the round "except permit holders" plate on its own
   * post. It is the edge of the place, and the game simply stopped.
   */
  function laneGate(t, s) {
    const y = surfaceY(t, s);
    const RED = [0.620, 0.110, 0.090], WHT = [0.760, 0.755, 0.740];
    // The two uprights, one at each side of the lane.
    for (const os of [-3.1, 3.1]) {
      for (let i = 0; i < 4; i++) {
        post(W, t, s + os, y + i * 0.28, y + 0.28 + i * 0.28, 0.055,
          i % 2 ? WHT : RED, 6);
      }
      boxTS(t - 0.22, t + 0.22, s + os - 0.22, s + os + 0.22, y - 0.05, y + 0.08,
        [0.505, 0.500, 0.482]);
    }
    // The boom, banded, hinged at the left post and dropped across.
    for (let i = 0; i < 12; i++) {
      const a = s - 3.0 + i * 0.5;
      boxTS(t - 0.05, t + 0.05, a, a + 0.5, y + 1.00, y + 1.14,
        i % 2 ? RED : WHT);
    }
    // And the sign: a white plate with a red rim on its own post.
    const st = t + 1.9;
    post(W, st, s + 3.6, y, y + 2.30, 0.038, [0.500, 0.505, 0.500], 6);
    post(W, st, s + 3.6, y + 2.30, y + 2.34, 0.34, RED, 12);
    post(W, st, s + 3.6, y + 2.34, y + 2.37, 0.27, WHT, 12);
    boxTS(st - 0.20, st + 0.20, s + 3.55, s + 3.58, y + 2.30, y + 2.36,
      [0.140, 0.140, 0.145]);
  }

  function shopfront(S) {
    const tc = (S.t0 + S.t1) * 0.5;
    const y0 = at(tc).deck;
    const body = S.body || [0.520, 0.492, 0.430];

    // The pad, in the deck buffer so it does not pick up the upright bounce.
    b = deck;
    boxTS(S.t0 - 0.6, S.t1 + 0.6, S.s0 - (S.awn || 0) - 0.8, S.s1 + 0.4,
      y0 - 0.35, y0 + 0.02, CONC[1], CONC[2]);
    b = up;

    if (S.kind === 'fence') {
      // The trampoline park, and 175447 says what it is made of: a frame of
      // YELLOW tube, dark mesh netting between, and a continuous red padded
      // skirt round the foot of the whole thing. It stands on a pad of
      // limestone gravel among the pines with red and black plastic chairs
      // outside it, and there are four beds in it.
      //
      // The first cut was a grey chain-link fence with a yellow top rail and a
      // red kicker — the right three colours in the wrong three places, and
      // two sides instead of four, so from any angle but square on it read as
      // a pair of hoardings standing in a wood.
      const YEL = S.rail, MESH = S.body, RED = S.skirt;
      const gravel = [0.545, 0.512, 0.452];
      b = deck;
      for (let t = S.t0 - 1.4; t < S.t1 + 1.4; t += 2.2) {
        const t1 = Math.min(t + 2.2, S.t1 + 1.4);
        const g = 0.93 + 0.14 * ((jit(t | 0, 300) * 5) | 0) / 4;
        b.quad(W(t, S.s0 - 1.4, surfaceY(t, S.s0 - 1.4) + 0.04),
          W(t1, S.s0 - 1.4, surfaceY(t1, S.s0 - 1.4) + 0.04),
          W(t1, S.s1 + 1.4, surfaceY(t1, S.s1 + 1.4) + 0.04),
          W(t, S.s1 + 1.4, surfaceY(t, S.s1 + 1.4) + 0.04),
          [gravel[0] * g, gravel[1] * g, gravel[2] * g]);
      }
      b = up;
      // Four sides, not two. Uprights, a top rail and a mid rail in tube, the
      // mesh hung between them, and the red pad wrapping the bottom.
      const side = (a, c, sc, along) => {
        const P = (u, y) => (along ? W(u, sc, y) : W(sc, u, y));
        const yAt = (u) => (along ? surfaceY(u, sc) : surfaceY(sc, u));
        for (let u = a; u <= c + 0.01; u += 2.35) {
          if (along) post(W, u, sc, yAt(u), yAt(u) + S.h + 0.10, 0.055, YEL, 6);
          else post(W, sc, u, yAt(u), yAt(u) + S.h + 0.10, 0.055, YEL, 6);
        }
        for (let u = a; u < c; u += 1.1) {
          const u1 = Math.min(u + 1.1, c);
          const y = yAt(u), y1 = yAt(u1);
          // The red pad, which is the loudest thing in the photograph.
          b.quad(P(u, y), P(u1, y1), P(u1, y1 + 0.82), P(u, y + 0.82), RED);
          b.quad(P(u1, y1), P(u, y), P(u, y + 0.82), P(u1, y1 + 0.82),
            shade(RED, 0.90));
          // The mesh: one dark quad a bay, which at the twenty metres this is
          // ever seen from is indistinguishable from netting.
          b.quad(P(u, y + 0.82), P(u1, y1 + 0.82), P(u1, y1 + S.h), P(u, y + S.h),
            MESH);
          b.quad(P(u1, y1 + 0.82), P(u, y + 0.82), P(u, y + S.h), P(u1, y1 + S.h),
            shade(MESH, 1.10));
          // Top rail and mid rail in tube.
          for (const hy of [S.h, S.h * 0.62]) {
            b.quad(P(u, y + hy - 0.05), P(u1, y1 + hy - 0.05),
              P(u1, y1 + hy + 0.05), P(u, y + hy + 0.05), YEL);
          }
        }
      };
      side(S.t0, S.t1, S.s0, true);
      side(S.t0, S.t1, S.s1, true);
      side(S.s0, S.s1, S.t0, false);
      side(S.s0, S.s1, S.t1, false);
      // The beds. A black mat in a red pad ring, sunk a hand below the frame,
      // four of them in a row — which is the whole reason anybody walks up
      // here.
      for (let k = 0; k < 4; k++) {
        const bt = S.t0 + 2.0 + k * ((S.t1 - S.t0 - 4.0) / 3);
        const bs = (S.s0 + S.s1) * 0.5;
        const by = surfaceY(bt, bs);
        // A RING of pad, not a slab of it. The first cut drew the pad as one
        // 3.1 m box with the mat inside it, and a box has a top: every bed
        // came out a plain red square with the black bed buried under it.
        for (const [a, c, s0b, s1b] of [
          [bt - 1.55, bt + 1.55, bs - 1.55, bs - 1.22],
          [bt - 1.55, bt + 1.55, bs + 1.22, bs + 1.55],
          [bt - 1.55, bt - 1.22, bs - 1.22, bs + 1.22],
          [bt + 1.22, bt + 1.55, bs - 1.22, bs + 1.22]]) {
          boxTS(a, c, s0b, s1b, by + 0.30, by + 0.44, RED, shade(RED, 1.14));
        }
        boxTS(bt - 1.24, bt + 1.24, bs - 1.24, bs + 1.24, by + 0.34, by + 0.39,
          [0.075, 0.075, 0.082], [0.098, 0.098, 0.106]);
        for (const [ot, os] of [[-1.45, -1.45], [1.45, -1.45],
          [-1.45, 1.45], [1.45, 1.45]]) {
          post(W, bt + ot, bs + os, by, by + 0.32, 0.045, YEL, 5);
        }
      }
      // And the chairs outside it, red and black, which is where the parents
      // are.
      for (let k = 0; k < 5; k++) {
        terraceSet(S.t0 + 1.6 + k * 2.9, S.s0 - 2.4, surfaceY(S.t0, S.s0 - 2.4),
          (k % 2) * 0.6 - 0.3,
          k % 2 ? [0.560, 0.135, 0.110] : [0.130, 0.130, 0.138]);
      }
      runs.push({ t0: S.t0, t1: S.t1, s0: S.s0, s1: S.s1, y: y0, h: S.h });
      b = deck;
      return;
    }

    if (S.kind === 'canopy') {
      // No walls. The reed roof sits on eight posts and there is a counter
      // under one end of it — the best walk-in business on the boardwalk
      // precisely because there is nothing to walk through.
      for (let t = S.t0; t <= S.t1 + 0.01; t += 3.0) {
        post(W, t, S.s0 + 0.4, y0, y0 + S.h, 0.075, S.post, 6);
        post(W, t, S.s1 - 0.4, y0, y0 + S.h, 0.075, S.post, 6);
      }
      boxTS(S.t0 - 0.5, S.t1 + 0.5, S.s0 - 0.5, S.s1 + 0.5,
        y0 + S.h, y0 + S.h + 0.28, S.roof, shade(S.roof, 1.12));
      // The band of yellow roof panelling under the eave.
      boxTS(S.t0 - 0.5, S.t1 + 0.5, S.s0 - 0.5, S.s0 - 0.32,
        y0 + S.h - 0.16, y0 + S.h, [0.620, 0.545, 0.185]);
      // The counter, an L round two sides, with its teal top.
      boxTS(S.t0 + 1.2, S.t0 + 7.2, S.s1 - 1.4, S.s1 - 0.6, y0, y0 + 1.02, body);
      boxTS(S.t0 + 1.1, S.t0 + 7.3, S.s1 - 1.5, S.s1 - 0.5,
        y0 + 1.02, y0 + 1.08, shade(body, 1.2));
      runs.push({ t0: S.t0 + 1.1, t1: S.t0 + 7.3, s0: S.s1 - 1.5, s1: S.s1 - 0.5,
        y: y0, h: 1.08 });
      shopExtras(S, y0, y0 + S.h);
      // Only the counter blocks; the rest is a roof you walk under.
      b = deck;
      return;
    }

    const h = S.h, top = y0 + h;
    const awn = S.awn || 0;
    // The body.
    boxTS(S.t0, S.t1, S.s0, S.s1, y0, top, body, shade(body, 0.9));
    // The serving front: a dark backing panel behind the opening, which is the
    // whole trick — a bright interior behind a shaded front reads as a lightbox
    // and nothing else about the shop can recover from it.
    const oa = S.t0 + (S.t1 - S.t0) * 0.18, oc = S.t1 - (S.t1 - S.t0) * 0.18;
    boxTS(oa, oc, S.s0 - 0.02, S.s0 + 0.10, y0 + 0.95, top - 0.35,
      [0.045, 0.041, 0.038]);
    boxTS(oa, oc, S.s0 - 0.10, S.s0 + 0.04, y0 + 0.86, y0 + 0.98,
      shade(body, 1.15));
    if (S.plinth) boxTS(S.t0 - 0.1, S.t1 + 0.1, S.s0 - 0.1, S.s1 + 0.1,
      y0, y0 + 0.50, S.plinth);
    if (S.pier) for (const t of [S.t0 + 0.4, (S.t0 + S.t1) * 0.5, S.t1 - 0.4]) {
      boxTS(t - 0.30, t + 0.30, S.s0 - 0.15, S.s0 + 0.35, y0, top, S.pier);
    }
    // The canopy, oversailing on slim posts, and its valance. `bar` is the one
    // helper in this file that can rake a section; a flat box could not.
    if (awn > 0) {
      const fs = S.s0 - awn;
      bar(S.t0 - 0.4, S.t1 + 0.4,
        [[fs, top - 0.18], [S.s1, top - 0.06], [S.s1, top + 0.06], [fs, top - 0.06]],
        S.roof, shade(S.roof, 1.10));
      bar(S.t0 - 0.4, S.t1 + 0.4,
        [[fs - 0.02, top - 0.42], [fs + 0.10, top - 0.42],
          [fs + 0.10, top - 0.16], [fs - 0.02, top - 0.16]],
        shade(S.roof, 0.94));
      // Stopping at top - 0.44 and not top - 0.20, which is what put a post
      // straight through the middle of "Slastičarnica". The valance hangs from
      // top - 0.42 down, and the name is on it: a prop that reaches into that
      // band is a prop standing in front of the one thing the shop is called.
      for (let t = S.t0 - 0.2; t <= S.t1 + 0.21; t += (S.t1 - S.t0 + 0.4) / 3) {
        post(W, t, fs + 0.20, y0, top - 0.44, 0.055, [0.560, 0.552, 0.530], 6);
      }
      if (S.menu) menuWall(S, y0, top);
      // Stood 0.40 m off the valance rather than 0.16, and 0.46 m deep
      // rather than 0.38.
      //
      // Every canvas on this boardwalk has ink on it — measured, by counting
      // dark pixels in the texture at build time: h2o 11 771, mini 12 194,
      // Trampulin 15 075. And three of those five boards were not on the
      // building. At 0.16 m the face sits inside the depth the awning edge,
      // its gutter, its rafters and the scallop fascia all occupy, and which
      // of them wins is decided by a centimetre. Slasticarnica read and the
      // three beside it did not, with identical code and identical canvases.
      // Stood 0.40 m off the valance rather than 0.16, and 0.46 m deep
      // rather than 0.38 — which did not fix what it was meant to fix, but is
      // the right depth for the board anyway.
      else if (S.name) shopSign(S, (S.t0 + S.t1) * 0.5, fs - 0.40, top - 0.34,
        Math.min(6.4, (S.t1 - S.t0) * 0.72), 0.46);
      // The scalloped fascia. The photograph has one on this awning whether or
      // not the name is up there with it.
      if (S.scallop || S.menu) {
        for (let t = S.t0 - 0.4; t < S.t1 + 0.4; t += 0.42) {
          post(W, t, fs + 0.04, top - 0.30, top - 0.16, 0.115,
            shade(S.roof, 0.98), 7);
        }
      }
    } else {
      // A pitched roof and the name straight on the render, which is what the
      // pizzeria and the café at the far end both have.
      bar(S.t0 - 0.35, S.t1 + 0.35,
        [[S.s0 - 0.35, top], [S.s1 + 0.35, top],
          [S.s1 + 0.35, top + 0.10], [S.s0 - 0.35, top + 0.10]],
        S.roof, shade(S.roof, 1.08));
      bar(S.t0 - 0.35, S.t1 + 0.35,
        [[S.s0 + 1.2, top + 0.10], [S.s1 - 1.2, top + 0.10],
          [S.s1 - 1.2, top + 0.62], [S.s0 + 1.2, top + 0.62]],
        S.roof, shade(S.roof, 1.14));
      // Not for a kiosk: those get the fascia board below, and drawing both
      // put two names on Tisak and two on Maslina, twenty centimetres apart.
      if (S.name && S.kind !== 'kiosk') {
        shopSign(S, (S.t0 + S.t1) * 0.5, S.s0 - 0.14, top - 0.52,
          Math.min(5.6, (S.t1 - S.t0) * 0.70), 0.66);
      }
    }
    if (S.kind === 'kiosk' && S.name && !awn && !S.flag) {
      shopSign(S, (S.t0 + S.t1) * 0.5, S.s0 - 0.14, top - 0.28,
        (S.t1 - S.t0) * 0.86, 0.40);
    }
    // The vitrine: a canted glass case with the flavours in it, which is the
    // single most Jadrija-specific object on this boardwalk.
    if (S.cooler) {
      // The glass-front drinks fridge at the left end, with its white header.
      const ct = S.t0 + 1.1, cs = S.s0 - 0.55;
      boxTS(ct - 0.45, ct + 0.45, cs - 0.32, cs + 0.32, y0, y0 + 1.94,
        [0.560, 0.556, 0.548], [0.590, 0.586, 0.578]);
      boxTS(ct - 0.40, ct + 0.40, cs - 0.34, cs - 0.29, y0 + 0.22, y0 + 1.58,
        [0.120, 0.150, 0.180]);
      boxTS(ct - 0.45, ct + 0.45, cs - 0.34, cs - 0.28, y0 + 1.62, y0 + 1.90,
        [0.930, 0.930, 0.925]);
      runs.push({ t0: ct - 0.5, t1: ct + 0.5, s0: cs - 0.4, s1: cs + 0.4,
        y: y0, h: 1.94 });
    }
    if (S.vitrine) {
      const va = S.t0 + 2.0, vc = S.t0 + 9.0;
      boxTS(va, vc, S.s0 - 1.5, S.s0 - 0.4, y0, y0 + 0.92, [0.300, 0.296, 0.288]);
      const PANS = [[0.520, 0.500, 0.330], [0.610, 0.520, 0.220],
        [0.470, 0.540, 0.320], [0.590, 0.420, 0.400], [0.230, 0.150, 0.105]];
      for (let k = 0; k < 14; k++) {
        const a = va + 0.15 + k * ((vc - va - 0.3) / 14);
        boxTS(a + 0.02, a + ((vc - va - 0.3) / 14) - 0.02, S.s0 - 1.36, S.s0 - 0.56,
          y0 + 0.92, y0 + 0.99, PANS[k % PANS.length]);
      }
      boxTS(va, vc, S.s0 - 1.5, S.s0 - 0.4, y0 + 1.02, y0 + 1.16,
        [0.620, 0.640, 0.650]);
      runs.push({ t0: va, t1: vc, s0: S.s0 - 1.5, s1: S.s0 - 0.4, y: y0, h: 1.16 });
    }
    // The pergola and the plank bench at Trampulin, which is exactly what the
    // promenade benches are already built out of.
    if (S.pergola) {
      const fs = S.s0 - (S.awn || 3.0);
      for (let t = S.t0; t <= S.t1 + 0.01; t += 3.0) {
        post(W, t, fs + 0.3, y0, y0 + 2.4, 0.07, S.pergola, 6);
      }
      boxTS(S.t0 - 6, S.t1 + 6, fs - 0.35, fs - 0.05, y0 + 0.44, y0 + 0.50,
        S.bench);
      for (let t = S.t0 - 5; t <= S.t1 + 5; t += 1.8) {
        boxTS(t - 0.04, t + 0.04, fs - 0.32, fs - 0.08, y0, y0 + 0.44,
          [0.075, 0.230, 0.140]);
      }
    }
    // The feather flag, which is all the branding Maslina has.
    if (S.flag) {
      const ft = S.t1 + 0.9;
      post(W, ft, S.s0 - 0.6, y0, y0 + 3.1, 0.035, [0.500, 0.505, 0.500], 5);
      boxTS(ft - 0.02, ft + 0.02, S.s0 - 1.35, S.s0 - 0.58, y0 + 0.9, y0 + 3.0,
        S.flag);
      if (S.name) shopSign(S, ft, S.s0 - 1.42, y0 + 2.0, 0.66, 1.8);
    }
    // Maslina is a kiosk and six metres long, and from the lane its back was
    // the same void h2o's was. Short kiosks are skipped: the yard kit does not
    // fit in three and a half metres and comes out as a pile.
    if (S.kind === 'box' || (S.kind === 'kiosk' && S.t1 - S.t0 > 5)) {
      shopBack(S, y0, top);
    }
    if (S.kind === 'box') shopRoof(S, y0, top);
    shopKit(S, y0, top, awn > 0 ? S.s0 - awn : null);
    shopExtras(S, y0, top);
    // Chairs and tables under the awning, four sets to a frontage. Every café
    // in the survey has them and the game had not one chair on this shore.
    if (awn > 0) {
      const fs = S.s0 - awn;
      for (let k = 0; k < 4; k++) {
        const t = S.t0 + 0.9 + k * ((S.t1 - S.t0 - 1.8) / 3);
        terraceSet(t, fs - 1.9 + (k % 2) * 0.5, y0, (k % 2) * 0.5 - 0.25,
          k % 3 === 0 ? [0.190, 0.200, 0.210] : [0.560, 0.548, 0.512]);
      }
    }
    // And the cafe's own parasols: cream, on a pebble-aggregate disc, one to a
    // pair of tables. Furled and tied after five, which is how every frame shot
    // at ten to six in the survey has them.
    if (awn > 0) {
      const fs = S.s0 - awn;
      const furled = (CONFIG.hour || 14) > 17;
      const CREAM = [0.560, 0.545, 0.508];
      for (let k = 0; k < 2; k++) {
        const t = S.t0 + 2.6 + k * ((S.t1 - S.t0 - 5.2) || 1);
        const s2 = fs - 3.1;
        const yy = at(t).deck;
        // The ballast, and it is a WHEEL. b_181 catches one from two metres:
        // a car rim laid flat with exposed-aggregate concrete poured into it,
        // the pebbles standing proud of the steel and the rim rusting round
        // them. It is the standard parasol base on this coast and it was a
        // plain grey disc. The rim first, then the fill standing above it.
        post(W, t, s2, yy, yy + 0.15, 0.44, [0.140, 0.128, 0.118], 12);
        post(W, t, s2, yy + 0.02, yy + 0.19, 0.375, [0.520, 0.492, 0.442],
          [0.548, 0.518, 0.466], 12);
        dome(W, t, s2, yy + 0.19, 0.05, 0.375, [0.545, 0.516, 0.464], 12);
        // The nut on the collar, which is the only bright thing on it.
        post(W, t, s2, yy + 0.19, yy + 0.27, 0.075, [0.480, 0.472, 0.452], 6);
        post(W, t, s2, yy + 0.10, yy + 2.42, 0.035, [0.520, 0.512, 0.492], 6);
        if (furled) {
          // Tied: a long thin cone of cloth up the pole.
          post(W, t, s2, yy + 0.95, yy + 2.62, 0.11, CREAM, 7);
        } else {
          for (let i = 0; i < 8; i++) {
            const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU;
            const R = 1.42;
            b.quad(W(t, s2, yy + 2.42),
              W(t + Math.cos(a0) * R, s2 + Math.sin(a0) * R, yy + 2.04),
              W(t + Math.cos(a1) * R, s2 + Math.sin(a1) * R, yy + 2.04),
              W(t, s2, yy + 2.42), i % 2 ? CREAM : shade(CREAM, 0.94));
          }
        }
        runs.push({ t0: t - 0.5, t1: t + 0.5, s0: s2 - 0.5, s1: s2 + 0.5,
          y: yy, h: 0.10 });
      }
    }
    void terraceSeats;
    runs.push({ t0: S.t0 - 0.1, t1: S.t1 + 0.1, s0: S.s0 - 0.1, s1: S.s1 + 0.1,
      y: y0, h: h + 0.1 });
    b = deck;
  }
  for (const S of SHOPS) shopfront(S);
  // The three placements, all photographed. The hoarding beside Maslina, the
  // panel out on the plaza, and the pair at the west end by the cabins.
  // 349 / 33.2 was inside the sanitary block once that was built. East of
  // Maslina and clear of it, which is the same piece of open ground.
  centenary(361.5, 31.4, 4.4, 2.2, at(361.5).deck + 1.35);
  centenary(346, 6.0, 3.2, 1.8, at(346).deck + 1.25,
    { bg: '#cfe4d8', fg: '#1d3b30', big: '100' });
  centenary(212, 22.0, 2.6, 1.5, at(212).deck + 1.15, { bg: '#e8e2cc' });
  laneGate(486, 30.6);

  if (special) special.sign = neonSign(special);

  /**
   * A yellow-legged gull, painted on a wall.
   *
   * The one on the real block is a fresco and not a poster, and every choice
   * here follows from that. It is drawn on transparent ground rather than on a
   * rectangle of its own colour, so what shows between the feathers is the
   * render itself with the render's own light on it — a mural does not have a
   * background, it has a wall. The blue behind the bird is a wash and not a
   * panel: soft-edged, off-centre, and nowhere near the edges of the texture,
   * because the moment it has a straight side it is a sign somebody bolted up.
   *
   * And it is painted badly on purpose. The strokes are laid down in two passes
   * with the second offset and thinned, the whites are four different whites,
   * and a scatter of the wall's own colour is dabbed back over the top at the
   * end — which is what a fresco on lime render looks like after ten summers,
   * and is the difference between this and clip art.
   */
  function gullMural() {
    const W = 1024, H = 592;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    // Rolled off a fixed table rather than Math.random, so the wall is the same
    // wall every time the page loads. Everything else in this file that draws
    // to a canvas is deterministic and this is not the one to break it in.
    let seed = 20240806;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff)
      / 0x7fffffff;

    // ── the sky behind it ──────────────────────────────────────────────
    // An ellipse of thin blue, sat high and left of the bird the way a
    // brushful of wash lands when somebody is painting the sky in after the
    // gull rather than before it — which, from the way it runs out under the
    // near wingtip on the real one, is what happened.
    g.save();
    // Thin, and that is the correction and not the first guess. At 0.62 in the
    // middle it came out a grey-blue oval a metre across with a bird sitting on
    // it — a bruise on the wall, and the eye reads it as a stain long before it
    // reads it as sky. A wash is a wash: you should have to be told it is there.
    g.translate(W * 0.50, H * 0.40);
    g.scale(1.16, 0.60);
    const sky = g.createRadialGradient(-18, -10, 30, 0, 0, W * 0.46);
    sky.addColorStop(0.00, 'rgba(156,180,196,0.34)');
    sky.addColorStop(0.48, 'rgba(162,184,198,0.24)');
    sky.addColorStop(0.80, 'rgba(168,188,200,0.10)');
    sky.addColorStop(1.00, 'rgba(170,190,202,0)');
    g.fillStyle = sky;
    g.beginPath(); g.arc(0, 0, W * 0.46, 0, Math.PI * 2); g.fill();
    g.restore();

    const PALE = '#f2efe6';      // the bird, which is not white but limewash
    const LIT = '#fbf9f3';       // and the top of a wing, which nearly is
    const SHADE = '#c4c3bd';     // the underside, in the grey the render goes
    const DEEP = '#9d9c96';
    const DARK = '#37373a';      // the primaries
    const SOOT = '#5a5a5e';
    const YELL = '#cfa832';      // beak and feet
    const shY = H * 0.44;        // where the wings leave the body

    /**
     * One wing. `d` is −1 for the far one and +1 for the near, and the whole
     * thing is drawn in the mirror so the two are the same wing twice — which
     * they are on the wall, near enough, and the tilt below is what stops that
     * reading as a stencil.
     */
    function wing(d) {
      g.save();
      g.translate(W * 0.5, shY);
      g.scale(d, 1);

      // The membrane: out along the leading edge, round the wrist, and back
      // along the trailing one. The tip finishes above the shoulder, because a
      // gull holding a glide has its wings bowed up and this is the only line
      // in the drawing that says so.
      //
      // Broad, and held broad most of the way out. The first pass tapered from
      // the shoulder and what it drew was a blade — a gull's wing is deep at
      // the arm and stays deep to the wrist, and only then goes to fingers.
      // Half the width of the reference bird is in that flat middle section.
      g.beginPath();
      g.moveTo(-12, -46);
      g.bezierCurveTo(-142, -94, -280, -98, -374, -62);
      g.bezierCurveTo(-394, -52, -396, -26, -372, -18);
      g.bezierCurveTo(-262, 28, -136, 58, -18, 50);
      g.closePath();
      g.fillStyle = PALE; g.fill();

      // Grey along the underside of it, thrown from the trailing edge upward,
      // which is where the light is not.
      const uw = g.createLinearGradient(0, -62, 0, 56);
      uw.addColorStop(0, 'rgba(255,255,255,0)');
      uw.addColorStop(0.55, 'rgba(180,179,173,0.30)');
      uw.addColorStop(1, 'rgba(150,149,143,0.70)');
      g.fillStyle = uw; g.fill();

      // The secondaries, as strokes across the trailing half rather than as
      // shapes: a feather drawn as an outline is a leaf, and twenty of them is
      // a fern. What reads as plumage is the *ends* of them, so only the ends
      // are drawn.
      g.lineCap = 'round';
      for (let i = 0; i < 17; i++) {
        const u = i / 16;
        const x = -60 - u * 296;
        const y0 = -22 - u * 28, y1 = 46 - u * 40;
        g.beginPath();
        g.moveTo(x, y1);
        g.quadraticCurveTo(x + 14, (y0 + y1) * 0.5, x + 8, y0 + 12);
        g.strokeStyle = i % 2 ? 'rgba(120,119,114,0.34)'
          : 'rgba(146,145,140,0.22)';
        g.lineWidth = 2.4 + rnd() * 1.6;
        g.stroke();
      }

      // And the primaries, which are the black fingers and are most of what a
      // gull is from below. Fanned back off the wrist, longest inboard, each
      // one a lens rather than a stripe — a primary is wide at the base and
      // comes to a point, and drawn as a stripe it reads as a comb.
      // They also have to be *long*. At 128 px they were a black smudge on the
      // end of each wing; the fingers on the wall are a good third of the span
      // and the gaps between them are what tell you the bird is gliding.
      for (let i = 0; i < 6; i++) {
        const u = i / 5;
        const len = 176 - u * 60;
        const wd = 15.0 - u * 4.0;
        g.save();
        g.translate(-336 + u * 42, -50 + u * 58);
        g.rotate(-0.34 + u * 0.86);
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(-len * 0.55, -wd, -len, -1.5);
        g.quadraticCurveTo(-len * 0.55, wd, 0, 0);
        g.closePath();
        g.fillStyle = i < 4 ? DARK : SOOT; g.fill();
        g.restore();
      }

      // A dry-brush highlight along the leading edge, which is the only part of
      // a wing seen from underneath that catches anything.
      g.beginPath();
      g.moveTo(-16, -44);
      g.bezierCurveTo(-142, -90, -274, -94, -366, -60);
      g.strokeStyle = 'rgba(252,250,244,0.85)';
      g.lineWidth = 8; g.stroke();
      g.restore();
    }

    // The far wing first, then the body, then the near one over the top of it,
    // which is the whole of the depth in the picture.
    g.save();
    g.translate(W * 0.5, shY); g.rotate(-0.055); g.translate(-W * 0.5, -shY);
    wing(-1);
    g.restore();

    // ── the tail and the feet ──────────────────────────────────────────
    g.save();
    g.translate(W * 0.5, shY);
    g.beginPath();
    g.moveTo(-30, 30);
    g.bezierCurveTo(-46, 96, -40, 140, -20, 158);
    g.bezierCurveTo(0, 168, 20, 168, 40, 156);
    g.bezierCurveTo(58, 138, 62, 96, 44, 30);
    g.closePath();
    g.fillStyle = PALE; g.fill();
    // Dark along the very end of it, and ragged, because the last centimetre of
    // a gull's tail is where the fresco has worn as well as where the bird is
    // dark, and the two are indistinguishable at this range.
    // Only the last inch of it, and as separate feathers with render showing
    // between them. Twenty-one pixels of half-height ran them into each other
    // and the tail came out a solid black paddle with two yellow lines drawn on
    // top of it — the tail on the wall is white with a dark fringe, and the
    // fringe is fringe because you can see through it.
    for (let i = 0; i < 7; i++) {
      const u = i / 6, x = -20 + u * 60;
      g.beginPath();
      g.ellipse(x, 152 - Math.abs(u - 0.5) * 30, 7.5, 15, (u - 0.5) * 0.6,
        0, Math.PI * 2);
      g.fillStyle = i % 2 ? DARK : SOOT; g.fill();
    }
    g.restore();

    // ── the body ───────────────────────────────────────────────────────
    g.save();
    g.translate(W * 0.5, shY);
    g.beginPath();
    g.moveTo(0, -128);
    g.bezierCurveTo(38, -110, 54, -40, 50, 34);
    g.bezierCurveTo(46, 76, 28, 98, 4, 100);
    g.bezierCurveTo(-24, 98, -42, 74, -46, 32);
    g.bezierCurveTo(-50, -40, -34, -110, 0, -128);
    g.closePath();
    g.fillStyle = LIT; g.fill();
    // Down the near side of it, so the breast is round rather than a paddle.
    const bs = g.createLinearGradient(-46, 0, 54, 0);
    bs.addColorStop(0, 'rgba(150,149,143,0.42)');
    bs.addColorStop(0.42, 'rgba(255,255,255,0)');
    bs.addColorStop(0.86, 'rgba(163,162,156,0.36)');
    g.fillStyle = bs; g.fill();

    // The head, on a neck that is barely a neck: it is one line from the
    // shoulder to the crown on a gliding gull and drawing a neck on it is what
    // makes a painted bird look like a goose.
    g.beginPath();
    g.ellipse(6, -148, 34, 38, 0.10, 0, Math.PI * 2);
    g.fillStyle = LIT; g.fill();
    // Beak, up and out — the real one has its head turned across the wall and
    // that turn is most of why the thing looks alive rather than pinned.
    g.beginPath();
    g.moveTo(30, -166);
    g.quadraticCurveTo(74, -186, 96, -196);
    g.quadraticCurveTo(76, -170, 34, -152);
    g.closePath();
    g.fillStyle = YELL; g.fill();
    g.beginPath();
    g.moveTo(32, -160);
    g.quadraticCurveTo(66, -178, 92, -193);
    g.strokeStyle = 'rgba(120,96,26,0.55)'; g.lineWidth = 2; g.stroke();
    // And the eye, which is four pixels of a two-metre wall and is the
    // difference between a bird and a shape.
    g.beginPath(); g.arc(23, -160, 5.2, 0, Math.PI * 2);
    g.fillStyle = '#2c2c2e'; g.fill();
    g.restore();

    // The feet, after the body and the tail so they hang in front of both.
    // Tucked but not stowed, and clear of the tail's fringe: on the wall they
    // dangle past it, which is what says the bird is coming down onto something
    // rather than crossing over it.
    g.save();
    g.translate(W * 0.5, shY);
    g.lineCap = 'round';
    for (const o of [-1, 1]) {
      g.beginPath();
      g.moveTo(o * 12, 92);
      g.quadraticCurveTo(o * 18, 138, o * 16, 176);
      g.strokeStyle = YELL; g.lineWidth = 12; g.stroke();
      g.beginPath();
      g.moveTo(o * 12, 96);
      g.quadraticCurveTo(o * 17, 134, o * 15, 168);
      g.strokeStyle = 'rgba(232,206,120,0.65)'; g.lineWidth = 4; g.stroke();
    }
    g.restore();

    // The near wing last, tilted the other way.
    g.save();
    g.translate(W * 0.5, shY); g.rotate(0.030); g.translate(-W * 0.5, -shY);
    wing(1);
    g.restore();

    // ── ten summers ────────────────────────────────────────────────────
    // Lime render is not a canvas: it is a coarse, sucking surface that takes
    // the brush unevenly and then loses it in patches. Two hundred dabs of the
    // wall's own cream, thrown at the bird and nothing else, and the paint
    // stops being a decal.
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 260; i++) {
      const x = W * 0.5 + (rnd() - 0.5) * W * 0.86;
      const y = H * 0.44 + (rnd() - 0.5) * H * 0.78;
      g.beginPath();
      g.ellipse(x, y, 2 + rnd() * 9, 2 + rnd() * 6, rnd() * 3.1, 0,
        Math.PI * 2);
      g.fillStyle = `rgba(0,0,0,${0.10 + rnd() * 0.26})`;
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 8;
    return tex;
  }

  /**
   * The fish on the sanitary block.
   *
   * 175447 catches it side-on from the plaza and 175149 has it again from the
   * lane: a fat yellow fish with a crown on its head, painted on the pink
   * render beside a green door. It is somebody's, it is signed in the corner,
   * and it is the only thing on that whole elevation that anybody looks at.
   *
   * Painted the way `gullMural` is painted, and for the same reasons: on
   * transparent ground so what shows between the strokes is the render with
   * the render's own weather on it, in two passes with the second thinned and
   * offset, and with a scatter of the wall's colour dabbed back over at the
   * end. A clean vector fish is clip art. This is a fish somebody did with a
   * tin of yellow and half an hour.
   */
  function fishMural() {
    const W = 768, H = 768;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    let seed = 19220701;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff)
      / 0x7fffffff;

    const YEL = ['#e8c032', '#d9ae22', '#f0cd48', '#c99a1c'];
    const INK = 'rgba(96, 72, 30, 0.82)';

    // The body: an egg lying on its side, drawn as a closed curve with the
    // radius wobbling, so no two summers of it are the same shape.
    const body = (cx, cy, rx, ry, fill, jitter) => {
      g.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const w = 1 + (rnd() - 0.5) * jitter;
        const x = cx + Math.cos(a) * rx * w;
        const y = cy + Math.sin(a) * ry * w;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    };

    // Two passes. The under-pass is wider and darker and shows at the edges
    // the way a second coat that was not quite laid over the first does.
    body(400, 400, 214, 168, YEL[3], 0.055);
    body(396, 396, 206, 160, YEL[0], 0.045);
    body(388, 384, 168, 122, YEL[2], 0.05);

    // The tail, two strokes off the back.
    g.fillStyle = YEL[1];
    g.beginPath();
    g.moveTo(196, 400); g.lineTo(64, 300); g.lineTo(96, 404);
    g.lineTo(60, 508); g.closePath(); g.fill();
    g.fillStyle = YEL[3];
    g.beginPath();
    g.moveTo(200, 404); g.lineTo(78, 322); g.lineTo(104, 402); g.closePath();
    g.fill();

    // Dorsal spines and the pelvic fin.
    g.fillStyle = YEL[1];
    for (let i = 0; i < 5; i++) {
      const x = 330 + i * 46;
      g.beginPath();
      g.moveTo(x, 268 + i * 4); g.lineTo(x + 18, 214 + i * 10);
      g.lineTo(x + 40, 262 + i * 5); g.closePath(); g.fill();
    }
    g.beginPath();
    g.moveTo(360, 540); g.lineTo(408, 604); g.lineTo(452, 534); g.closePath();
    g.fill();

    // The crown. Three points and a band, sitting on top and slightly askew,
    // which is the whole joke of the thing.
    g.save();
    g.translate(452, 236); g.rotate(-0.16);
    g.fillStyle = YEL[0];
    g.beginPath();
    g.moveTo(-84, 4);
    g.lineTo(-64, -62); g.lineTo(-34, -14); g.lineTo(0, -78);
    g.lineTo(34, -14); g.lineTo(64, -62); g.lineTo(84, 4);
    g.closePath(); g.fill();
    g.fillStyle = YEL[3];
    g.fillRect(-86, 2, 172, 22);
    g.restore();

    // The eye: a ring, a pupil, and a highlight put in with the corner of the
    // brush.
    g.fillStyle = '#f6ecd4'; g.beginPath();
    g.arc(516, 374, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2b2418'; g.beginPath();
    g.arc(524, 378, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath();
    g.arc(514, 366, 7, 0, Math.PI * 2); g.fill();

    // The mouth, the gill, and the outline — all one loose line.
    g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 9;
    g.beginPath(); g.moveTo(576, 424); g.quadraticCurveTo(600, 444, 570, 462);
    g.stroke();
    g.lineWidth = 7;
    g.beginPath(); g.moveTo(452, 306); g.quadraticCurveTo(430, 400, 456, 494);
    g.stroke();
    g.lineWidth = 8;
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const w = 1 + (rnd() - 0.5) * 0.05;
      const x = 396 + Math.cos(a) * 208 * w, y = 396 + Math.sin(a) * 162 * w;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();

    // Spots, and then the wall dabbed back over the top of all of it.
    g.fillStyle = 'rgba(150, 112, 34, 0.35)';
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 0.8;
      g.beginPath();
      g.arc(392 + Math.cos(a) * 180 * r, 396 + Math.sin(a) * 138 * r,
        6 + rnd() * 13, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 260; i++) {
      const x = rnd() * W, y = rnd() * H;
      g.globalAlpha = 0.05 + rnd() * 0.16;
      g.beginPath(); g.arc(x, y, 2 + rnd() * 11, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * And hanging it: a quad six millimetres off the render, lit like everything
   * else and transparent everywhere the brush did not go.
   *
   * Six millimetres is not a frame, it is z-fighting clearance. The mural has
   * no thickness and wants none — the moment it stands proud enough to cast an
   * edge it is a board, and the whole point of the thing is that it is paint.
   */
  function endMural(gb) {
    const sc = (gb.front + gb.back) * 0.5;
    const mw = 1.90, mh = mw * 592 / 1024;
    const yc = gb.floor + 1.46;
    const st = at(gb.t);
    const p = W(gb.t + 0.006 * gb.o, sc, yc);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh),
      solidMaterial(0xffffff, {
        spec: 0.02, vcol: false, transparent: true, depthWrite: false,
        decl: 'uniform sampler2D uMuralMap;',
        body: 'vec4 mu = texture2D(uMuralMap, vUv);\nbase = mu.rgb;\nalpha = mu.a;',
        uniforms: { uMuralMap: { value: gullMural() } },
      }));
    mesh.position.set(p[0], p[1], p[2]);
    // This end faces back down t, which the board on the far gable does not —
    // hence the sign. Get it wrong and the gull is painted on the inside.
    mesh.rotation.y = Math.atan2(st.ux * gb.o, st.uz * gb.o);
    scene.add(mesh);
    return { mesh, at: [gb.t, sc] };
  }

  /**
   * The tourist board, on the blank end of that run.
   *
   * The map itself is `jadrijaMapTexture` in src/44-board.js, which knows about
   * cartography and nothing about carpentry. This is the other half: a frame,
   * four bolts and a quad, and the one number that connects them — the board's
   * own world position, which is what the red tag on the map points at. Hang it
   * somewhere else and the tag follows, because it is derived rather than drawn.
   */
  function mapBoard(gb) {
    // Centred across the gable and set at reading height. The wall is 2.90 m of
    // s and 2.44 m of it stands above the pad, so a 2.10 by 1.44 panel leaves
    // 0.40 m of render either side and 0.30 m under the eave — which is the
    // proportion every one of these boards is bolted up in, and is not an
    // accident: any less margin and the frame fouls the fascia.
    const sc = (gb.front + gb.back) * 0.5;
    const yc = gb.floor + 1.42;
    const wp = W(gb.t, sc, 0);
    const panel = jadrijaMapTexture([wp[0], wp[2]]);
    const h = 2.10 / panel.aspect;

    // The frame first, in the huts' own buffer so it takes their light. Three
    // pieces: a surround standing 30 mm off the wall, and a lip top and bottom,
    // because a printed panel on this coast is always in an aluminium tray with
    // a drip edge — without one the rain runs down the wall behind it and the
    // render below goes green in a season.
    b = up;
    const half = 2.10 * 0.5, vhalf = h * 0.5, m = 0.055;
    boxTS(gb.t - 0.005, gb.t + 0.035, sc - half - m, sc + half + m,
      yc - vhalf - m, yc + vhalf + m, [0.415, 0.425, 0.440],
      [0.300, 0.310, 0.325]);
    for (const [y0, y1] of [[yc + vhalf + m, yc + vhalf + m + 0.030],
      [yc - vhalf - m - 0.030, yc - vhalf - m]]) {
      boxTS(gb.t - 0.005, gb.t + 0.060, sc - half - m, sc + half + m,
        y0, y1, [0.500, 0.510, 0.520]);
    }
    b = deck;

    // And the print, on a quad standing a whisker proud of the tray. Basic
    // rather than lit, and that is a decision: this is the one surface in the
    // resort whose whole job is to be *read*, and a laminated panel in August
    // does not go the colour of the wall behind it — it glares. Ten centimetres
    // of the eave's shadow crossing the legend would be correct and unreadable.
    const st = at(gb.t);
    const p = W(gb.t + 0.036, sc, yc);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.10, h),
      new THREE.MeshBasicMaterial({ map: panel.tex, side: THREE.FrontSide }));
    // PlaneGeometry looks down +z; the run's own +t is (ux, uz), which is the
    // way the wall faces. Its local +x then lands on the inland normal, so the
    // map's east edge is the one nearer the back row — which is why the canvas
    // is laid out with north up and read from the promenade side.
    mesh.position.set(p[0], p[1], p[2]);
    mesh.rotation.y = Math.atan2(st.ux, st.uz);
    scene.add(mesh);
    return { mesh, at: [gb.t, sc], tex: panel.tex, aspect: panel.aspect,
      houses: panel.houses, lanes: panel.lanes };
  }
  const board = gable ? mapBoard(gable) : null;
  const mural = nearGable ? endMural(nearGable) : null;

  // ── the bead curtain ───────────────────────────────────────────────────────
  //
  // What actually hangs in a Dalmatian doorway in August. The door is off its
  // hinges from June to September and a curtain goes up in its place: it keeps
  // the flies out, it lets the draught through, and it tells you somebody is in
  // without anybody having to say so. This one is the tourist-shop kind — flat
  // printed tiles on forty-odd strings, with a dolphin across them, which is
  // sold on every second stall between here and Split.
  //
  // Every strand is a rigid pendulum hung off the head of the opening, and that
  // is the whole model: two angles, an angular rate each, a spring that is
  // gravity and a damper that is the string. What makes it read as a *curtain*
  // rather than as forty independent pendulums is `link` — each strand pulls on
  // the two beside it, so a shove in the middle runs outward as a wave and the
  // whole thing settles together. Walking through drives the strands you are
  // touching toward *your* speed rather than adding an impulse, which is the
  // difference between parting a curtain and detonating one; it also makes the
  // result the same at 15 fps and 144.
  const BEAD = {
    wide: 0.021,           // m, one strand across
    drop: 1.90,            // m, how far it hangs from the head of the opening
    seg: 14,               // segments down a strand, for the swing
    rows: 76,              // tiles down a strand, for the canvas
    px: 8,                 // and how many pixels each of those gets
    swing: 1.05,           // rad, the furthest a strand will be thrown
    spring: 24.0,          // rad/s² per rad of tilt — this is gravity
    damp: 2.1,             // and this is the string
    link: 12.0,            // how hard a strand pulls on the two beside it
    reach: 0.36,           // m either side of you that a strand is pushed
    grip: 16.0,            // how fast a strand you are touching takes your speed
    push: 0.9,             // rad/s per m/s of you
    // A doorway is a hole between a hot terrace and a cold room, so there is
    // always a little air going through it. Small — this is what stops the
    // thing reading as a painted board when nobody has touched it for a while.
    stir: 0.020,
    din: 0.55,             // rad/s of total movement that counts as a rattle
  };

  /**
   * The printed face of it, one canvas for the whole curtain.
   *
   * Laid out so that strand `i` owns the column `[i/N, (i+1)/N]` of the image:
   * the picture is not on any one string, it is *across* them, which is why a
   * bead curtain with a design on it falls apart into stripes the moment
   * anybody walks through and puts itself back together afterwards. That effect
   * is free here and it is most of the reason to draw the design this way.
   *
   * The tiles are drawn last, over the top of the picture, as a seam every
   * `px` rows plus a little shading within each one — light at the top edge,
   * dark at the bottom — and a soft highlight down the middle of every strand,
   * which is the one thing that stops flat tiles reading as flat tape.
   */
  function beadSkin(n) {
    const cv = document.createElement('canvas');
    const W = n * BEAD.px, H = BEAD.rows * BEAD.px;
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');

    // The sea, top to bottom: sky over haze over water over depth.
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0.00, '#dceaf4');
    sky.addColorStop(0.26, '#a8d0e6');
    sky.addColorStop(0.48, '#5aa3cf');
    sky.addColorStop(0.78, '#2e77ad');
    sky.addColorStop(1.00, '#1b5487');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // A few bands of swell, so the water is not a gradient.
    g.globalAlpha = 0.16;
    for (let k = 0; k < 9; k++) {
      const y = H * (0.52 + k * 0.052);
      g.fillStyle = k & 1 ? '#ffffff' : '#0f3f6b';
      g.fillRect(0, y, W, H * 0.012);
    }
    g.globalAlpha = 1;

    // The dolphin, over the horizon and coming down. Drawn as one closed path
    // in unit coordinates so the shape survives whatever the opening turns out
    // to be — the curtain is sized off the doorway, not the other way round.
    const X = (u) => u * W, Y = (v) => v * H;
    g.beginPath();
    g.moveTo(X(0.075), Y(0.545));                                  // the snout
    g.bezierCurveTo(X(0.20), Y(0.415), X(0.40), Y(0.330), X(0.575), Y(0.352));
    g.lineTo(X(0.640), Y(0.212));                                  // dorsal fin
    g.lineTo(X(0.712), Y(0.372));
    g.bezierCurveTo(X(0.81), Y(0.412), X(0.878), Y(0.474), X(0.902), Y(0.556));
    g.lineTo(X(0.995), Y(0.466));                                  // the fluke
    g.lineTo(X(0.955), Y(0.618));
    g.lineTo(X(0.995), Y(0.736));
    g.bezierCurveTo(X(0.855), Y(0.700), X(0.700), Y(0.632), X(0.545), Y(0.596));
    g.lineTo(X(0.470), Y(0.790));                                  // pectoral
    g.lineTo(X(0.398), Y(0.578));
    g.bezierCurveTo(X(0.26), Y(0.578), X(0.145), Y(0.570), X(0.075), Y(0.545));
    g.closePath();
    g.fillStyle = '#1c4c78';
    g.fill();

    // The belly, which is what makes it a dolphin and not a shark: a pale
    // crescent clipped to the body and set low in it.
    g.save();
    g.clip();
    const pale = g.createLinearGradient(0, Y(0.40), 0, Y(0.74));
    pale.addColorStop(0, 'rgba(255,255,255,0)');
    pale.addColorStop(1, 'rgba(244,250,253,0.95)');
    g.fillStyle = pale;
    g.fillRect(0, Y(0.40), W, Y(0.40));
    g.restore();

    // The eye, three pixels of it, which at forty-five strands is one strand.
    g.fillStyle = '#f2f7fa';
    g.beginPath();
    g.arc(X(0.195), Y(0.478), Math.max(2, W * 0.010), 0, 7);
    g.fill();

    // ── the tiles ────────────────────────────────────────────────────────────
    // A seam every tile, and a gradient within each: this is the difference
    // between a printed banner and forty strings of plastic.
    const p = BEAD.px;
    for (let r = 0; r < BEAD.rows; r++) {
      const y = r * p;
      const sh = g.createLinearGradient(0, y, 0, y + p);
      sh.addColorStop(0.00, 'rgba(255,255,255,0.30)');
      sh.addColorStop(0.35, 'rgba(255,255,255,0.04)');
      sh.addColorStop(1.00, 'rgba(0,0,0,0.30)');
      g.fillStyle = sh;
      g.fillRect(0, y, W, p);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, y + p - 1, W, 1);
    }
    // And the round of each strand, across the columns.
    for (let i = 0; i < n; i++) {
      const x = i * p;
      const rd = g.createLinearGradient(x, 0, x + p, 0);
      rd.addColorStop(0.00, 'rgba(0,0,0,0.34)');
      rd.addColorStop(0.34, 'rgba(255,255,255,0.20)');
      rd.addColorStop(0.62, 'rgba(255,255,255,0.06)');
      rd.addColorStop(1.00, 'rgba(0,0,0,0.34)');
      g.fillStyle = rd;
      g.fillRect(x, 0, p, H);
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Hang it, and give it back something that can be stepped.
   *
   * The whole curtain is one buffer geometry rewritten on the CPU each frame:
   * forty-five strands of fifteen rows is 1 350 vertices, which is less than a
   * single parasol and is not worth a shader. It is *not* a blocker and never
   * will be — the point of the thing is that you walk through it.
   */
  function beadCurtain(K) {
    const span = K.dj * 2;
    const n = Math.max(8, Math.round(span / 0.032));
    const gap = span / n;
    const hw = BEAD.wide * 0.5;
    const seg = BEAD.seg;
    // One station for the whole curtain. The doorway is 1.45 m of a shore
    // traced in 4 m steps, so the frame does not turn measurably across it and
    // asking `at()` for it 765 times a frame would be 765 binary searches to
    // arrive back at the same four numbers.
    const st = at(K.dc);
    // Just inside the head of the opening, and just inside the wall: this hangs
    // off the frame, not off the render.
    const yTop = K.floor + KAB.head - 0.035;
    const sHang = K.face + 0.075;

    const nv = n * (seg + 1) * 2;
    const pos = new Float32Array(nv * 3);
    const nrm = new Float32Array(nv * 3);
    const uvs = new Float32Array(nv * 2);
    const idx = new Uint16Array(n * seg * 6);
    // Seaward, because that is the side anybody looks at it from and a 21 mm
    // ribbon has no business claiming a normal of its own.
    for (let v = 0; v < nv; v++) {
      nrm[v * 3] = -st.nx; nrm[v * 3 + 1] = 0.16; nrm[v * 3 + 2] = -st.nz;
    }
    let k = 0;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      for (let j = 0; j <= seg; j++) {
        const v = (i * (seg + 1) + j) * 2;
        uvs[v * 2] = u0; uvs[v * 2 + 1] = 1 - j / seg;
        uvs[v * 2 + 2] = u1; uvs[v * 2 + 3] = 1 - j / seg;
      }
      for (let j = 0; j < seg; j++) {
        const a = (i * (seg + 1) + j) * 2;
        idx[k++] = a; idx[k++] = a + 1; idx[k++] = a + 3;
        idx[k++] = a; idx[k++] = a + 3; idx[k++] = a + 2;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(...pt(st, sHang, yTop - BEAD.drop * 0.5)), 2.6);

    const mesh = new THREE.Mesh(g, solidMaterial(0xffffff, {
      spec: 0.10,
      // A good deal more bounce than the huts get, and it is not a fudge: this
      // hangs in a doorway facing four metres of white concrete in full August
      // sun, with its own back to the shade. Almost everything that lights it
      // from the promenade side arrives off the terrace. At 0.16 it read as a
      // navy screen; the thing you actually see in a doorway here is pale.
      emissive: 0.40,
      vcol: false,
      side: THREE.DoubleSide,
      decl: 'uniform sampler2D uBeadMap;',
      body: 'base = texture2D(uBeadMap, vUv).rgb;',
      uniforms: { uBeadMap: { value: beadSkin(n) } },
    }));
    mesh.frustumCulled = false;
    scene.add(mesh);

    const angS = new Float32Array(n);      // swing through the doorway
    const angT = new Float32Array(n);      // and sideways along it
    const velS = new Float32Array(n);
    const velT = new Float32Array(n);
    const tmp = new Float32Array(n);
    let prevT = null, prevS = null, cool = 0, phase = 0;

    function write() {
      let o = 0;
      for (let i = 0; i < n; i++) {
        const t0 = K.dc - K.dj + gap * (i + 0.5);
        const sa = Math.sin(angS[i]), ca = Math.cos(angS[i]);
        const sb = Math.sin(angT[i]), cb = Math.cos(angT[i]);
        for (let j = 0; j <= seg; j++) {
          const L = BEAD.drop * (j / seg);
          const bt = t0 + L * sb - K.dc, bs = sHang + L * sa;
          const x = st.x + st.ux * bt + st.nx * bs;
          const z = st.z + st.uz * bt + st.nz * bs;
          const y = yTop - L * ca * cb;
          pos[o] = x - st.ux * hw; pos[o + 1] = y; pos[o + 2] = z - st.uz * hw;
          pos[o + 3] = x + st.ux * hw; pos[o + 4] = y; pos[o + 5] = z + st.uz * hw;
          o += 6;
        }
      }
      g.attributes.position.needsUpdate = true;
    }
    write();

    /**
     * @param t,s  where you are, in the resort's frame
     * @param d    how far away you are, for the sound and for the gate
     */
    function step(t, s, d, dt) {
      if (d > 26) { prevT = prevS = null; return 0; }
      const h = Math.min(dt, 0.05);
      const vs = prevS == null ? 0 : (s - prevS) / h;
      const vt = prevT == null ? 0 : (t - prevT) / h;
      prevT = t; prevS = s;
      // Are you in the doorway at all. Half a metre either side of the strands,
      // which is a shoulder and an arm.
      const through = s > sHang - 0.55 && s < sHang + 0.55;
      phase += h;
      const air = BEAD.stir * Math.sin(phase * 1.7);
      let din = 0;
      for (let i = 0; i < n; i++) tmp[i] = angS[i];
      for (let i = 0; i < n; i++) {
        if (through) {
          const t0 = K.dc - K.dj + gap * (i + 0.5);
          const dd = Math.abs(t - t0);
          if (dd < BEAD.reach) {
            // Driven toward your speed while you are against it, rather than
            // kicked once per frame — which is both what contact does and the
            // only way the result does not depend on the frame rate.
            const w = Math.min(1, (1 - dd / BEAD.reach) * 1.6) * Math.min(1, h * BEAD.grip);
            velS[i] += (clamp(vs, -5, 5) * BEAD.push - velS[i]) * w;
            velT[i] += (clamp(vt, -5, 5) * BEAD.push * 0.5 - velT[i]) * w;
          }
        }
        const l = i > 0 ? tmp[i - 1] : tmp[i];
        const r = i < n - 1 ? tmp[i + 1] : tmp[i];
        velS[i] += (-BEAD.spring * Math.sin(angS[i] - air)
          - BEAD.damp * velS[i] + BEAD.link * (l + r - 2 * tmp[i])) * h;
        velT[i] += (-BEAD.spring * Math.sin(angT[i]) - BEAD.damp * velT[i]) * h;
        angS[i] = clamp(angS[i] + velS[i] * h, -BEAD.swing, BEAD.swing);
        angT[i] = clamp(angT[i] + velT[i] * h, -BEAD.swing * 0.4, BEAD.swing * 0.4);
        din += Math.abs(velS[i]) + Math.abs(velT[i]);
      }
      din /= n;
      write();
      // The sound is the *movement*, not the crossing: a curtain someone has
      // walked through goes on clattering for a couple of seconds after they
      // have gone, and that tail is most of what the noise is for.
      cool = Math.max(0, cool - h);
      if (audio && din > BEAD.din && cool <= 0) {
        audio.rattle(Math.min(1, din / 2.6), d);
        cool = 0.16 + 0.22 * Math.random();
      }
      return din;
    }

    return { mesh, step, strands: n, gap, at: [K.dc, sHang],
      swing: () => +Math.max(...Array.from(angS, Math.abs)).toFixed(3) };
  }
  const beads = special ? beadCurtain(special) : null;

  // The steps belong to the ground — you walk down them — and are cut into the
  // terrace they come off, so they stay in the deck buffer where their concrete
  // matches. Everything after this stands up.
  // No steps into the sea. There are none anywhere in the survey — you get out
  // of this water on a ladder, which is why there are now fifty of them — and
  // the flight the photographs *do* show runs the other way, three shallow
  // risers five metres wide dropping from the gravel down onto the promenade.
  // That one is a builder rather than a number and belongs with the plaza.
  void seaSteps;
  b = up;

  // ── the jetty, the lamps, the fittings ─────────────────────────────────────
  /**
   * The jetty the taxi boat from Šibenik comes alongside. It runs out from the
   * gap in the rows, on piles, and it is the only thing here that stands over
   * open water — which makes it the thing you walk to the end of.
   */
  // It is a mole, not a jetty: eleven metres across, forty-two out, and poured
  // solid to the sea bed. There is not a pile under it.
  //
  // What stood here was a 4.8 m catwalk on twelve legs, which is a landing
  // stage for a taxi boat — and no boat comes: there is no bollard, no fender
  // and no moored hull anywhere in thirty-nine photographs or a hundred and
  // thirty-two frames, and one of them looks down the whole frontage at ten to
  // six on an August evening at empty water. What the photographs do show is
  // twenty-odd people spread out *on* it, sunbathing, with 0.72 m of freeboard
  // under them. So it is a place, not a fitting, and it is built like one.
  const JET = { t: gapAt, out: 42, w: 5.5 };
  {
    const st = at(JET.t), lip = st.lip;
    const top = Math.max(lip, 0.72);
    boxTS(JET.t - JET.w, JET.t + JET.w, -JET.out, 0.4,
      -2.4, top, [0.720, 0.706, 0.664], CONC[2]);
    // The armour at the head, which is the one thing on it that is not flat.
    boxTS(JET.t - JET.w - 0.5, JET.t + JET.w + 0.5, -JET.out - 1.1, -JET.out,
      -1.6, top - 0.30, STONE, CONC[1]);
    JET.top = top;
  }
  // And the walk surface over it, which is a separate question from the
  // geometry and was not answered when the mole was made solid: `walkY` falls
  // through to the terrain for anything seaward of s = -3, and the terrain out
  // there is the sea bed, so you walked off the concrete and into the water on
  // a structure you could see under your feet. `bounds` said the same thing
  // from the other side — a flat `s0` of 1.1 for the whole shore.
  // ── the plaza ──────────────────────────────────────────────────────────────
  // The largest single surface at the real Jadrija, and there was no equivalent
  // here at all.
  //
  // Between the Slasticarnica and the kabine the aerial shows a great apron of
  // poured concrete running out over deep water — power-floated, saw-cut into
  // bays, with a hard square edge and no railing on it anywhere, and people
  // lying on it in the frames of the walk. It is not a terrace and it is not a
  // quay: it is the piece of ground the whole eastern half of the resort is
  // arranged around, and the game had water there.
  const PLAZA = { t0: 344, t1: 400, out: 34, bay: 4.5 };
  const onPlazaT = (t) => t > PLAZA.t0 - 0.5 && t < PLAZA.t1 + 0.5;
  const onPlaza = (t, s) => onPlazaT(t) && s > -PLAZA.out - 0.8 && s < 1.2;
  {
    const back3 = b;
    b = deck;
    // New concrete, and it reads as new: paler and cooler than the ninety-year
    // -old bays of the promenade beside it, which is the whole reason the joint
    // between them is visible from the far end of the beach.
    const NEWC = [[0.585, 0.560, 0.512], [0.560, 0.536, 0.490],
      [0.606, 0.580, 0.530]];
    // One continuous surface, not a row of slabs.
    //
    // Drawing a box per bay gave each bay the average of its own two ends, so
    // adjacent bays sat at slightly different heights and the whole apron came
    // out stepped, with a ragged edge over the water and daylight in the
    // joints. A poured slab is poured in one go and saw-cut afterwards, so:
    // one deck at 1.5 m resolution taking its height from the shore, and the
    // cuts laid on top of it as lines.
    const STEP = 1.5;
    for (let t = PLAZA.t0; t < PLAZA.t1 - 0.01; t += STEP) {
      const t2 = Math.min(t + STEP, PLAZA.t1);
      const a = at(t), c2 = at(t2);
      const ya = a.lip, yc = c2.lip;
      const col = NEWC[((t / STEP) | 0) % 3];
      b.quad(pt(a, -PLAZA.out, ya), pt(c2, -PLAZA.out, yc),
        pt(c2, 1.0, yc), pt(a, 1.0, ya), col);
      // The seaward face, square and unrailed, down into the water.
      b.quad(pt(a, -PLAZA.out, ya - 2.6), pt(c2, -PLAZA.out, yc - 2.6),
        pt(c2, -PLAZA.out, yc), pt(a, -PLAZA.out, ya), STONE);
    }
    // The ends of it, and then the saw cuts across.
    for (const [te, dir] of [[PLAZA.t0, -1], [PLAZA.t1, 1]]) {
      const e = at(te);
      b.quad(pt(e, -PLAZA.out, e.lip - 2.6), pt(e, 1.0, e.lip - 2.6),
        pt(e, 1.0, e.lip), pt(e, -PLAZA.out, e.lip), STONE);
      void dir;
    }
    for (let t = PLAZA.t0 + PLAZA.bay; t < PLAZA.t1 - 0.5; t += PLAZA.bay) {
      const a = at(t - 0.035), c2 = at(t + 0.035);
      b.quad(pt(a, -PLAZA.out, a.lip + 0.004), pt(c2, -PLAZA.out, c2.lip + 0.004),
        pt(c2, 1.0, c2.lip + 0.004), pt(a, 1.0, a.lip + 0.004),
        [0.360, 0.348, 0.325]);
    }
    b = back3;
  }

  const onMoleT = (t) => t > JET.t - JET.w - 0.6 && t < JET.t + JET.w + 0.6;
  // Two ranges, and they are deliberately different.
  //
  // `onMoleY` is where the mole's *deck* is, for `walkY`. `onMoleWalk` is where
  // you are allowed to stand, and it has no seaward-facing upper bound at all,
  // because the first version did and that was a hole you fell through.
  //
  // `standable` reads "below s = 1.0 is water" for the whole shore, and the
  // mole exemption stopped at s = 0.6 — so between 0.6 and 1.0 there was a
  // 0.4 m band, right at the root of the mole, where nothing was standable. A
  // step into it registers as a refused step, and a refused step with sea a
  // metre and a half ahead is the shoreline handover: you did not fall off the
  // mole, you were put in the water on purpose, by the code that exists to stop
  // you walking on it. Overlap the two ranges and the band cannot exist.
  const onMoleY = (t, s) => onMoleT(t) && s > -JET.out - 1.2 && s < 0.45;
  const onMoleWalk = (t, s) => onMoleT(t) && s > -JET.out - 1.2;

  // ── the skakaonica ─────────────────────────────────────────────────────────
  /**
   * The diving platform, fourteen metres off the head of the jetty.
   *
   * Every bathing beach on this coast has one and Jadrija's is the thing the
   * whole shore is arranged around in August: a concrete slab on four piles
   * with a board off the front, far enough out that the water under it is
   * deep, near enough that somebody on the promenade can see who has climbed
   * up and who has not.
   *
   * It is also the far end of the swim. The chase in src/61-chase.js starts at
   * the jetty steps and finishes here, which is why it is placed off the
   * jetty head rather than anywhere prettier: the two ends of the race have to
   * be in the same shot from the start, or the first thing you do in a chase
   * is look for what you are chasing toward.
   */
  //
  // 108 m out, which is eighty-five past the head of the jetty. The first cut
  // put it at 42 and the swim to it was sixteen metres — a race you win by
  // pressing a key twice. Eighty-five metres at a decent crawl is a minute,
  // which is a race; it is also about as far off this shore as anybody would
  // moor something you are meant to climb on to.
  // `top` was lip + 1.02 and the photographs put the deck 1.2 m over the water
  // against a 1.05 m handrail — 170 px to 140 px — which with the lip now where
  // the survey puts it comes out at about half a metre of slab. `s` does not
  // move: 108 m out is a stated design decision with its reasoning below, and
  // it sets the length of the race in src/61-chase.js. Change the height, leave
  // the distance, and stop calling the distance surveyed.
  // Across from the kabine, forty metres out.
  //
  // It used to hang off the head of the mole because the two ends of the race
  // had to be in one shot, and 108 m out was chosen to stop the swim being over
  // in two keystrokes. The aerial puts it somewhere else entirely: off the
  // eastern block, a short way off the concrete rather than a hundred metres
  // into the channel. The race is longer for it, not shorter — 175 m from the
  // mole head to the board instead of 66 — because the distance is now along
  // the shore rather than straight out from it.
  const DIVE = { t: 430, s: -40.0, w: 2.1, top: at(430).lip + 0.55 };
  {
    const D = DIVE, y = D.top;
    // Built from the photograph, and the photograph says something quite
    // different from what used to stand here.
    //
    // What was here was a slab on four piles with a handrail round three sides
    // and a ladder down the fourth — which is a lido diving stage, and is not
    // this one. Jadrija's is a lump of poured concrete: two masses side by
    // side, the big one *flaring outward as it rises* out of the water like an
    // upturned trough, the smaller one squarer and whiter and newer, and a
    // single long plank laid across the top of both and cantilevered well past
    // the end of them. There is no rail at all. The only ironwork on it is two
    // pipes standing up out of the deck with their tops bent over, which is
    // what you haul yourself up on and is the silhouette everybody on the
    // promenade recognises it by from four hundred metres.
    //
    // Three colours, because the concrete is not one colour: the old mass has
    // gone green with forty years of it, the newer block is still nearly
    // white, and there is a dark tidal band round the bottom of both that is
    // the single strongest thing telling you it is standing in the sea.
    const OLD = [0.664, 0.694, 0.672];
    const NEW = [0.786, 0.784, 0.756];
    const WET = [0.352, 0.408, 0.396];
    const PLANK = [0.744, 0.726, 0.668];
    const PIPE = [0.796, 0.800, 0.792];

    // ── the big mass ─────────────────────────────────────────────────────────
    // Below the water it is a plain shaft — nobody sees it and the sea bed here
    // is eight metres down. Above it, the flare, which is the whole shape.
    frustumTS(-8.0, [D.t - 0.62, D.s, 1.02, 0.98],
      -0.55, [D.t - 0.62, D.s, 1.02, 0.98], WET);
    frustumTS(-0.55, [D.t - 0.62, D.s, 1.02, 0.98],
      y - 0.26, [D.t - 0.62, D.s, 1.92, 1.34], OLD);
    // The cap: a slab a little proud of the flare all round, which is where
    // the shuttering stopped and is the one hard horizontal on the thing.
    frustumTS(y - 0.26, [D.t - 0.62, D.s, 1.96, 1.38],
      y, [D.t - 0.62, D.s, 1.98, 1.40], [0.712, 0.730, 0.702], CONC[2]);

    // ── the smaller, newer block ─────────────────────────────────────────────
    // Squarer, whiter, a hand lower, and set half a metre further out. In the
    // photograph it reads as a separate pour that arrived later, which is what
    // happens to every one of these on this coast.
    frustumTS(-8.0, [D.t + 2.06, D.s - 0.16, 0.70, 0.74],
      -0.50, [D.t + 2.06, D.s - 0.16, 0.70, 0.74], WET);
    frustumTS(-0.50, [D.t + 2.06, D.s - 0.16, 0.70, 0.74],
      y - 0.46, [D.t + 2.06, D.s - 0.16, 0.94, 0.92], NEW);
    frustumTS(y - 0.46, [D.t + 2.06, D.s - 0.16, 0.96, 0.94],
      y - 0.26, [D.t + 2.06, D.s - 0.16, 0.98, 0.96], [0.808, 0.806, 0.778],
      [0.836, 0.834, 0.804]);

    // A run of dark down the face of the big one, which is what forty years of
    // wet feet coming up a ladder does to a wall and is most of why the thing
    // does not read as a new casting.
    for (const [ot, wt, sh] of [[-1.30, 0.30, 0.62], [-0.34, 0.19, 0.44],
      [0.42, 0.24, 0.55]]) {
      boxTS(D.t - 0.62 + ot - wt, D.t - 0.62 + ot + wt,
        D.s - 1.36, D.s - 1.30, y - 0.26 - sh * 1.5, y - 0.26,
        [0.520, 0.552, 0.532]);
    }

    // ── the board ────────────────────────────────────────────────────────────
    // One plank, laid across both masses along the shore and running a long
    // way past the small one. It is the thinnest thing out here and it is the
    // thing you see first: a dark line against the channel with nothing under
    // the far end of it.
    bar(D.t - 2.42, D.t + 5.10,
      [[D.s - 0.40, y + 0.015], [D.s + 0.40, y + 0.015],
       [D.s + 0.40, y + 0.105], [D.s - 0.40, y + 0.105]], PLANK,
      [0.796, 0.780, 0.722]);
    // And the two bearers under it where it crosses each mass, which is what
    // stops it reading as a decal on the top of the concrete.
    for (const ot of [-0.62, 2.06]) {
      boxTS(D.t + ot - 0.36, D.t + ot + 0.36, D.s - 0.30, D.s + 0.30,
        y - 0.05, y + 0.015, [0.560, 0.548, 0.512]);
    }

    // ── the two pipes ────────────────────────────────────────────────────────
    // The whole of the ironwork, and the silhouette. They stand out of the
    // deck a little inboard of the shoreward edge, go up a metre and a bit,
    // and then bend over toward the ladder — which is what your hands are
    // reaching for when you come up it, and is why they lean that way and not
    // some other.
    for (const ot of [-1.28, -0.20]) {
      const bt = D.t + ot, bs = D.s - 0.86;
      const prof = [[y - 0.06, 0.036, 0, 0]];
      for (let k = 0; k <= 5; k++) {
        // A quarter of a circle of radius 0.30, walked in five steps: straight
        // up to y+1.16 and then over, finishing horizontal and 30 cm shoreward.
        const a = (k / 5) * (Math.PI / 2);
        prof.push([y + 1.34 + Math.sin(a) * 0.30, 0.036,
          0, -(1 - Math.cos(a)) * 0.30]);
      }
      lathe(W, bt, bs, prof, PIPE, 8);
      // The foot: a collar where it goes into the concrete, because a pipe
      // that simply stops at a surface reads as sunk into mud.
      post(W, bt, bs, y - 0.02, y + 0.07, 0.062, [0.612, 0.616, 0.606], 8);
    }

    // ── the ladder ───────────────────────────────────────────────────────────
    // Down the shoreward face, under the pipes, which is where the two of them
    // are bending to. Six rungs to the water and two more under it, because
    // the last one you can see is never the last one there is.
    for (const ot of [-1.28, -0.20]) {
      boxTS(D.t + ot - 0.030, D.t + ot + 0.030,
        D.s - 1.40, D.s - 1.33, y - 2.55, y - 0.10, PIPE);
    }
    for (let k = 0; k < 8; k++) {
      const yy = y - 0.34 - k * 0.30;
      boxTS(D.t - 1.31, D.t - 0.17, D.s - 1.42, D.s - 1.35,
        yy, yy + 0.036, PIPE);
    }
  }

  // Lamps down the promenade. A post and a lantern; at this scale a lantern is
  // a box, and the post is what does the work of spacing the walk out.
  // A 4.8 m column with a cranked arm, not a 3.2 m post with a box on it.
  //
  // The head reads at about 4.6 m against a 1.75 m bather in one frame and at
  // 5.0-5.5 in another, and it is carried out over the walk on an arm rather
  // than sitting on top of the post — which is most of why the old one looked
  // like a bollard that had grown. The 27 m spacing was right and stays.
  const LAMP = { post: 4.80, arm: 0.90, s: JAD.mid + 1.20 };
  for (let t = 12; t < LEN - 8; t += 27) {
    if (!clearOfShops(t)) continue;
    const st = at(t), y = st.deck, top = y + LAMP.post;
    if (t > JAD.beachTo) clutter(t + 1.1, LAMP.s - 1.4, y, 3, (t | 0) * 7 + 1);
    boxTS(t - 0.075, t + 0.075, LAMP.s - 0.075, LAMP.s + 0.075, y, top,
      [0.190, 0.186, 0.178]);
    // The arm, cranked seaward over the promenade.
    boxTS(t - 0.045, t + 0.045, LAMP.s - LAMP.arm, LAMP.s, top - 0.09, top,
      [0.190, 0.186, 0.178]);
    boxTS(t - 0.11, t + 0.11, LAMP.s - LAMP.arm - 0.20, LAMP.s - LAMP.arm + 0.35,
      top - 0.18, top - 0.09,
      [0.620, 0.612, 0.586], [0.215, 0.210, 0.202]);
  }

  // Ladders. Not "one within sight" — one every ten metres, in pairs.
  //
  // 44 m put four of them along the whole old shore. The survey counts four
  // positions in 45 m of a single jetty flank, and photographs two of them
  // 1.4 m apart; this is a bathing station and the ladders are how you get out
  // of the water, so they are as dense as the people using them.
  for (let t = 16; t < LEN - 10; t += 11) {
    // Not on the beach. A ladder is how you get out of water you cannot stand
    // up in, bolted to a quay; where the shingle runs in you simply walk out,
    // and there is not one in any frame of the west end.
    if (t < JAD.beachTo + 8) continue;
    ladder(t);
    if (((t / 11) | 0) % 3 === 0) ladder(t + 1.4);
    // And what got left at the top of it. The foot of a ladder is where people
    // take things off, which is why it is the densest small mess on the shore.
    if (jit(t | 0, 11) < 0.62) {
      clutter(t + 0.4, JAD.lip + 0.9, at(t).lip, 2 + ((jit(t | 0, 12) * 3) | 0),
        (t | 0) * 3);
    }
  }

  // ── benches ────────────────────────────────────────────────────────────────
  /**
   * Along the back of the promenade, facing the water.
   *
   * These used to be four boxes — a slab seat, a slab back, two rectangular
   * legs — and from three hundred metres up that is a bench. From a metre away
   * it is a plank on two bricks, which is the distance you actually meet it at
   * once there is a mode where you walk. The slab back was the worst of it: a
   * solid 1.7 × 0.56 m panel of flat colour at eye level with no gap in it,
   * which reads as a hoarding rather than as furniture.
   *
   * So: slats. What makes a bench legible up close is that you can see through
   * it — daylight between the boards, the sea behind them — and that nothing on
   * it is plumb. The seat falls away to the back, the back leans, and the end
   * frame is one bent piece of iron rather than two posts.
   */
  const BENCH = {
    len: 1.74,          // along the shore
    seatY: 0.45,        // top of the seat at its front edge
    fall: 0.035,        // and how much it drops by the back, so you sit *in* it
    front: 2.42,        // inland offset of the front of the seat, from rowA
    depth: 0.44,        // front of seat to the foot of the back
    rake: 0.30,         // rad the back leans from vertical — 17°
    backTop: 0.88,      // above the deck
    seats: 5,           // slats in the seat
    backs: 4,           // and in the back
    slat: 0.072,
    thick: 0.032,
    iron: 0.042,        // the end frame, across the shore
  };
  for (let t = 18; t < LEN - 10; t += 33) {
    if (!clearOfShops(t)) continue;
    const st = at(t), y = st.deck;
    const B = BENCH;
    const sF = JAD.rowA - B.front;           // front of the seat, inland offset
    const sB = sF + B.depth;                 // where the back springs from
    const IRON = [0.196, 0.204, 0.196];      // weathered dark green, not black
    const half = B.len / 2;

    // The seat, falling 35 mm over its depth. Each slat is laid flat but the
    // run of them is tilted, so the fall is in where they sit rather than in
    // each board being a wedge — which is how a real one is built.
    const tilt = Math.atan2(B.fall, B.depth);
    for (let i = 0; i < B.seats; i++) {
      const f = (i + 0.5) / B.seats;
      const cs = sF + f * B.depth;
      const cy = y + B.seatY - f * B.fall - B.thick / 2;
      // A little colour per board. Timber left in this much sun does not come
      // out of the weather all one shade, and identical slats read as a print.
      const k = 0.94 + 0.12 * ((i * 7) % 5) / 4;
      bar(t - half, t + half,
        slat(cs, cy, tilt + Math.PI / 2, B.slat, B.thick),
        [0.520 * k, 0.400 * k, 0.280 * k]);
    }

    // The back. Springs from just behind the seat and leans away from the sea.
    const cr = Math.cos(B.rake), sr = Math.sin(B.rake);
    const y0b = y + B.seatY - B.fall + 0.06;
    const run = (y + B.backTop - y0b) / cr;    // length along the lean
    for (let i = 0; i < B.backs; i++) {
      const f = (i + 0.5) / B.backs;
      const cs = sB - 0.04 + sr * run * f;
      const cy = y0b + cr * run * f;
      const k = 0.94 + 0.12 * ((i * 3) % 5) / 4;
      bar(t - half, t + half, slat(cs, cy, B.rake, B.slat, B.thick),
        [0.520 * k, 0.400 * k, 0.280 * k]);
    }

    // The end frames. One piece each: a foot on the ground, a front leg, and a
    // rear leg that carries on past the seat to become the back support — which
    // is what an iron bench end actually is, and why it needs no armrest to
    // look finished.
    for (const o of [-half + B.iron, half - B.iron]) {
      const t0 = t + o - B.iron / 2, t1 = t + o + B.iron / 2;
      // The foot: a runner front to back, so it stands on the concrete rather
      // than balancing on two points.
      bar(t0, t1, rect(sF + 0.02, sB + 0.10, y, y + 0.045), IRON);
      // Front leg, very slightly splayed out toward the sea as it comes down.
      bar(t0, t1, [[sF + 0.055, y + 0.03], [sF + 0.125, y + 0.03],
        [sF + 0.105, y + B.seatY], [sF + 0.035, y + B.seatY]], IRON);
      // Rear leg, carried on up into the back at the same lean.
      const topS = sB - 0.04 + sr * run, topY = y + B.backTop;
      bar(t0, t1, [[sB + 0.005, y + 0.03], [sB + 0.075, y + 0.03],
        [topS + 0.038, topY], [topS - 0.032, topY]], IRON);
      // And the rail the seat slats land on, tying the two legs together.
      bar(t0, t1, slat((sF + sB) / 2, y + B.seatY - B.fall / 2 - 0.055,
        tilt + Math.PI / 2, B.depth + 0.06, 0.05), IRON);
    }
    // Front of the seat to the back of the foot runner, which is the whole of
    // what your shins would meet.
    solid(t, (sF + sB + 0.10) / 2, half, (B.depth + 0.10) / 2, 0.9);
  }

  // ── the life in it ─────────────────────────────────────────────────────────
  /**
   * Everything up to here is the resort with nobody in it: correct concrete,
   * correct huts, and the atmosphere of a place that has been evacuated. Which
   * is wrong twice over — it is the sixth of August, it is a bathing station,
   * and the whole point of the fire is that there are people under it.
   *
   * The furniture — parasols, loungers, benches, dinghies — is static geometry
   * in the same buffer as the huts, and that is right: nobody expects a sun
   * lounger to move.
   *
   * The people are not. They used to be, and the argument for it was that at
   * three hundred metres and a hundred and eighty knots a still figure in a
   * plausible pose reads as a person. That is true, and it stopped being the
   * only distance this place is seen from the day you could stand on the
   * promenade. From 1.62 m a beach of statues does not read as a beach; it
   * reads as an evacuation that everybody attended in their swimming costume.
   *
   * So the figures come out of the static buffer and into src/42-crowd.js:
   * Blender-authored rigs — tools/blender/bather.py — instanced eleven parts at
   * a time, walking the promenade on the same gait as the aerodrome crew. The
   * cost is twenty-two draw calls and a hundred-odd matrix decompositions a
   * frame, which is a fraction of what the fire spends and buys the one thing
   * this whole file exists for.
   */
  const SKIN = [
    [0.760, 0.585, 0.450], [0.690, 0.505, 0.375],
    [0.845, 0.680, 0.560], [0.520, 0.370, 0.270],
  ];
  const SWIM = [
    [0.780, 0.220, 0.240], [0.140, 0.300, 0.560], [0.930, 0.870, 0.300],
    [0.900, 0.900, 0.910], [0.180, 0.480, 0.420], [0.850, 0.470, 0.620],
  ];
  const HAIR = [[0.120, 0.095, 0.080], [0.300, 0.200, 0.110], [0.560, 0.470, 0.360]];
  const pick = (a) => a[Math.floor(rng() * a.length) % a.length];

  /**
   * A frame rotated within the shore's own (t, s) plane, so a figure can face
   * any way without any of the code below knowing about world axes. Feeds
   * straight into `boxIn`, which asks only for something that turns three
   * numbers into a point.
   */
  const facing = (t0, s0, ang) => {
    const c = Math.cos(ang), sn = Math.sin(ang);
    return (dt, ds, y) => W(t0 + dt * c - ds * sn, s0 + dt * sn + ds * c, y);
  };

  /**
   * A solid of revolution from a profile, which is what a bottle and a turned
   * leg actually are.
   *
   * `post` is one radius from top to bottom and `frustum` — despite the name —
   * has a *rectangular* cross-section, four faces and four corners. Stacking
   * them was fine for everything at arm's length or further, and the two
   * objects in this game you stand over and look straight down at are the
   * bottle on the tabouret and the tabouret under it. On those the seams show:
   * a burgundy shoulder built as one `frustum` is a four-sided pyramid, and
   * from above it is unmistakably a pyramid.
   *
   * `prof` is a list of `[y, r]` rings, bottom to top, optionally `[y, r, dt,
   * ds]` to lean the axis over — which is how a splayed leg gets built as one
   * call rather than as a stack of cones nobody can line up. Rings of zero
   * radius close the end; anything else is left open, so a caller can butt two
   * lathes together without paying for two invisible caps.
   */
  function lathe(P, dt, ds, prof, col, sides = 14) {
    const at = (k, i) => {
      const [y, r, ot = 0, os = 0] = prof[k];
      const a = (i % sides / sides) * TAU;
      return P(dt + ot + Math.cos(a) * r, ds + os + Math.sin(a) * r, y);
    };
    for (let k = 0; k < prof.length - 1; k++) {
      if (prof[k][1] <= 0 && prof[k + 1][1] <= 0) continue;
      for (let i = 0; i < sides; i++) {
        // A ring of zero radius is a point, and a quad with two coincident
        // corners is a triangle with a degenerate one in it — flat shading
        // reads the normal off the cross product, so the degenerate half comes
        // out black. Emit the triangle instead.
        if (prof[k][1] <= 0) b.tri(at(k, i), at(k + 1, i), at(k + 1, i + 1), col);
        else if (prof[k + 1][1] <= 0) b.tri(at(k, i), at(k, i + 1), at(k + 1, i), col);
        else b.quad(at(k, i), at(k, i + 1), at(k + 1, i + 1), at(k + 1, i), col);
      }
    }
  }

  /** A vertical n-sided prism. Poles, trunks, pot rims. */
  function post(P, dt, ds, y0, y1, r, col, sides = 6) {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * TAU, a1 = ((i + 1) / sides) * TAU;
      const A = P(dt + Math.cos(a0) * r, ds + Math.sin(a0) * r, y0);
      const B = P(dt + Math.cos(a1) * r, ds + Math.sin(a1) * r, y0);
      b.quad(A, B, [B[0], y1, B[2]], [A[0], y1, A[2]], col);
    }
  }

  /**
   * A dome, cut off at `squash` of a hemisphere. Two rings of quads and a fan is
   * enough — these are read as foliage and as shoulders, never as spheres, and a
   * third ring doubles the triangle count for something nobody can see.
   */
  function dome(P, dt, ds, y0, h, r, col, sides = 7) {
    const RINGS = [0, 0.45, 0.80];
    for (let k = 0; k < RINGS.length - 1; k++) {
      const p0 = RINGS[k] * Math.PI * 0.5, p1 = RINGS[k + 1] * Math.PI * 0.5;
      const r0 = Math.cos(p0) * r, r1 = Math.cos(p1) * r;
      const h0 = y0 + Math.sin(p0) * h, h1 = y0 + Math.sin(p1) * h;
      for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * TAU, a1 = ((i + 1) / sides) * TAU;
        b.quad(
          P(dt + Math.cos(a0) * r0, ds + Math.sin(a0) * r0, h0),
          P(dt + Math.cos(a1) * r0, ds + Math.sin(a1) * r0, h0),
          P(dt + Math.cos(a1) * r1, ds + Math.sin(a1) * r1, h1),
          P(dt + Math.cos(a0) * r1, ds + Math.sin(a0) * r1, h1), col);
      }
    }
    const rt = Math.cos(RINGS[2] * Math.PI * 0.5) * r;
    const ht = y0 + Math.sin(RINGS[2] * Math.PI * 0.5) * h;
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * TAU, a1 = ((i + 1) / sides) * TAU;
      b.tri(P(dt + Math.cos(a0) * rt, ds + Math.sin(a0) * rt, ht),
        P(dt + Math.cos(a1) * rt, ds + Math.sin(a1) * rt, ht),
        P(dt, ds, y0 + h), col);
    }
  }

  /**
   * A person.
   *
   * Boxes, and deliberately so — the crew rig in 47-ground.js is a jointed thing
   * that walks, and it costs what a jointed thing that walks costs. Nobody on
   * this shore is doing anything but standing, sitting or lying down.
   *
   * `pose` is the whole vocabulary: `stand`, `sit` (on a terrace edge, legs over
   * the water), `lie` (on a lounger), `wade` (in to the knees, which is drawn by
   * simply starting the legs below the waterline and letting the sea clip them).
   */
  /**
   * A figure, built from joints and tapered segments.
   *
   * The first version was nine rectangular prisms, which is a fair silhouette
   * at three hundred metres and a shop dummy at two: square shoulders, slab
   * arms hanging plumb against the ribs, a cube for a head, and legs of one
   * thickness from hip to floor. What actually makes a low-poly body read as a
   * body is not detail — it is that **nothing on it is the same width twice and
   * nothing on it is vertical**. A thigh is half again a calf, shoulders are
   * wider than a waist, an upper arm hangs a few degrees out from the body and
   * the forearm comes back in.
   *
   * So everything below is a chain of `frustum` calls between named joints. It
   * costs about 200 triangles a head against 108, and there are forty of them
   * on the whole beach — which is why these can simply be better, where the
   * 2 120 cars needed a second model and a range test.
   */
  /** A parasol: a pole and a shallow eight-panel cone, tilted a few degrees. */
  /**
   * A hired beach parasol.
   *
   * Eight flat triangles from the tip to the rim is a cone, and a cone is what
   * it looked like. A canopy is not flat in either direction: along a rib it is
   * domed, nearly level at the crown and steepening to the edge, and *between*
   * ribs the cloth sags under its own weight. Those two curvatures are the
   * whole thing — the sag puts a crease down every rib without a single rib
   * being modelled, which is what tells you it is cloth over a frame.
   *
   * Everything is drawn from both sides. You spend most of your time on this
   * beach underneath one.
   */
  function parasol(t, s, y, col) {
    const P = facing(t, s, rng() * TAU);
    const POLE = [0.560, 0.545, 0.520];
    const WHITE = [0.930, 0.920, 0.895];
    const R = 1.18, tip = y + 2.26, rim = y + 1.84;
    post(P, 0, 0, y, y + 2.36, 0.030, POLE, 6);
    // The foot is the same wheel rim the terrace parasols stand in, poured
    // full of exposed aggregate — see the note on the cafe ones.
    post(P, 0, 0, y, y + 0.13, 0.38, [0.140, 0.128, 0.118], 10);
    post(P, 0, 0, y + 0.02, y + 0.17, 0.325, [0.520, 0.492, 0.442],
      [0.548, 0.518, 0.466], 10);
    post(P, 0, 0, y + 1.94, y + 2.02, 0.058, POLE, 6);            // the hub

    // `u` runs out along a rib, `v` across a panel between two of them.
    const SEG = 3, CRS = 2;
    const pt3 = (a, u, v) => {
      const r = R * u;
      // Zero at both ribs, deepest mid-panel, and growing with radius because
      // there is more unsupported cloth further out.
      const sag = 0.085 * Math.sin(Math.PI * v) * u * u;
      return P(Math.cos(a) * r, Math.sin(a) * r,
        tip - (tip - rim) * Math.pow(u, 1.5) - sag);
    };
    for (let i = 0; i < 8; i++) {
      // Alternating panels, which is what every hired parasol on this coast is,
      // and the one detail that stops a field of them looking like mushrooms.
      const c = i % 2 ? col : WHITE;
      const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU;
      for (let k = 0; k < CRS; k++) {
        const v0 = k / CRS, v1 = (k + 1) / CRS;
        const A0 = a0 + (a1 - a0) * v0, A1 = a0 + (a1 - a0) * v1;
        for (let j = 0; j < SEG; j++) {
          const u0 = j / SEG, u1 = (j + 1) / SEG;
          const p00 = pt3(A0, u0, v0), p01 = pt3(A0, u1, v0);
          const p11 = pt3(A1, u1, v1), p10 = pt3(A1, u0, v1);
          b.quad(p00, p01, p11, p10, c);
          b.quad(p10, p11, p01, p00, c);
        }
        // The valance: a hand's width of cloth hanging off the rim, which every
        // one of these has and which is most of the silhouette from underneath.
        const e0 = pt3(A0, 1, v0), e1 = pt3(A1, 1, v1);
        const d0 = [e0[0], e0[1] - 0.12, e0[2]], d1 = [e1[0], e1[1] - 0.12, e1[2]];
        b.quad(e0, d0, d1, e1, c);
        b.quad(e1, d1, d0, e0, c);
      }
    }
  }

  /** A lounger: a frame, a back raked up at one end, and four short legs. */
  /**
   * A sunlounger: slatted deck on a tubular frame, flat to the knee and raked
   * from there to the head.
   *
   * The back used to be a staircase of three thin slabs, and the comment on it
   * said why — "a genuinely raked quad here needs its own frame". It has one
   * now. `frustumS` runs along the bed rather than up it, so the whole profile
   * from the foot to the top of the back is one polyline and the slats simply
   * follow it.
   */
  function lounger(t, s, y, ang, col) {
    const P = facing(t, s, ang);
    const FRAME = [0.720, 0.715, 0.700];
    // [inland offset, height above the concrete]. Flat from the foot to the
    // knee, then up. The last two put the back at about 35° off the deck.
    const PR = [[-0.92, 0.335], [-0.30, 0.352], [0.36, 0.360],
      [0.60, 0.492], [0.86, 0.676]];

    // Walk the profile by arc length so the slats stay evenly spaced across the
    // bend instead of bunching where it turns.
    const segLen = [];
    let total = 0;
    for (let i = 0; i < PR.length - 1; i++) {
      const L = Math.hypot(PR[i + 1][0] - PR[i][0], PR[i + 1][1] - PR[i][1]);
      segLen.push(L);
      total += L;
    }
    const along = (d) => {
      let k = 0;
      while (k < segLen.length - 1 && d > segLen[k]) { d -= segLen[k]; k++; }
      const f = clamp(d / segLen[k], 0, 1);
      return [PR[k][0] + (PR[k + 1][0] - PR[k][0]) * f,
        PR[k][1] + (PR[k + 1][1] - PR[k][1]) * f];
    };

    // The slats. Daylight between them is the whole reason a lounger reads as
    // furniture rather than as a painted plank on legs.
    for (let d = 0.03; d < total - 0.04; d += 0.118) {
      const [s0, y0] = along(d), [s1, y1] = along(Math.min(d + 0.076, total));
      frustumS(P, s0, [0, y + y0 - 0.014, 0.285, 0.014],
        s1, [0, y + y1 - 0.014, 0.285, 0.014], col);
    }
    // Side rails, carrying the slats and standing a little proud of them.
    for (const o of [-0.30, 0.30]) {
      for (let i = 0; i < PR.length - 1; i++) {
        frustumS(P, PR[i][0], [o, y + PR[i][1] + 0.004, 0.026, 0.030],
          PR[i + 1][0], [o, y + PR[i + 1][1] + 0.004, 0.026, 0.030], FRAME);
      }
    }
    // Four legs, splayed a little so it does not read as a table.
    for (const dt of [-0.27, 0.27]) {
      for (const [ds, hy] of [[-0.78, 0.335], [0.22, 0.358]]) {
        frustum(P, y, [dt * 1.10, ds * 1.06, 0.022, 0.022],
          y + hy - 0.03, [dt, ds, 0.019, 0.019], FRAME);
      }
    }
  }

  /**
   * A puff of foliage: a knocked-about ellipsoid, lit as a smooth one.
   *
   * `dome` builds a hemisphere from three rings of seven sides and stops at
   * 80 % of the way up. That is exactly right for a shoulder or a bollard and
   * it is why the trees on this shore read as painted card: an Aleppo pine
   * drawn as three squat heptagonal plates is three squat heptagonal plates.
   *
   * Two things make it a tree instead, and neither is more triangles.
   *
   * The first is the normal. The radius here is knocked about by `jag`, so the
   * face normals report every dent and the canopy sparkles — the eye reads
   * high-frequency lighting noise as *hard*, and a hard canopy is tin. What a
   * real crown does is the opposite: a hundred thousand leaves average into one
   * broad soft gradient with the detail far below anything you can resolve. So
   * the normal handed to the shader is the one the *un-jagged* ellipsoid would
   * have had at that point. The silhouette keeps every dent; the shading does
   * not see them. It is the trick from douges.dev and it is most of the effect.
   *
   * The second is that gradient, which the vertex colours were always able to
   * carry and never did: dark on the underside of the crown, sunlit on top,
   * over a band that belongs to the whole tree and not to the single puff — or
   * a canopy of six of these reads as a bag of separate balls rather than as
   * one mass with a light side and a dark side.
   */
  function puff(P, dt, ds, cy, ry, r, dark, lite, band,
                sides = 8, rows = 3, jag = 0.32, seed = 0) {
    // The local frame's two horizontal axes, in world xz. Positions go through
    // P so they follow the shore's curve; directions are rotated by this, once,
    // because probing P a metre out along a curve is not a rotation.
    const O = P(0, 0, 0), EX = P(1, 0, 0), EZ = P(0, 1, 0);
    const ux = EX[0] - O[0], uz = EX[2] - O[2];
    const vx = EZ[0] - O[0], vz = EZ[2] - O[2];
    const ph = [];
    for (let i = 0; i < sides; i++) ph.push((seed * 7 + i) * 2.3999632);
    const lo = band[0], hi = band[1];
    const grid = [];
    for (let k = 0; k <= rows; k++) {
      const v = k / rows;
      const th = (v - 0.5) * Math.PI * 0.98;
      const w = Math.cos(th), hgt = Math.sin(th);
      const ring = [];
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * TAU;
        const n = 1 + jag * (0.62 * Math.sin(a * 3 + ph[i])
          + 0.38 * Math.sin(v * 5.3 + ph[(i + 3) % sides]));
        const q = P(dt + Math.cos(a) * r * w * n, ds + Math.sin(a) * r * w * n, 0);
        const yy = cy + ry * hgt * (1 + jag * 0.22 * Math.sin(a * 2 + ph[i]));
        // The smooth ellipsoid's normal, taken to the world through the frame.
        const lx = Math.cos(a) * w / r, lz = Math.sin(a) * w / r, ly = hgt / ry;
        let nx = lx * ux + lz * vx, ny = ly, nz = lx * uz + lz * vz;
        const L = Math.hypot(nx, ny, nz) || 1;
        let g = (yy - lo) / (hi - lo || 1);
        g = g < 0 ? 0 : g > 1 ? 1 : g;
        g = g * g * (3 - 2 * g);
        ring.push({
          p: [q[0], yy, q[2]],
          n: [nx / L, ny / L, nz / L],
          c: [dark[0] + (lite[0] - dark[0]) * g,
            dark[1] + (lite[1] - dark[1]) * g,
            dark[2] + (lite[2] - dark[2]) * g],
        });
      }
      grid.push(ring);
    }
    for (let k = 0; k < rows; k++) {
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        const A = grid[k][i], B = grid[k][j], C = grid[k + 1][j], D = grid[k + 1][i];
        b.smooth(A.p, B.p, C.p, A.n, B.n, C.n, A.c, B.c, C.c);
        b.smooth(A.p, C.p, D.p, A.n, C.n, D.n, A.c, C.c, D.c);
      }
    }
  }

  /**
   * An Aleppo pine at eye height.
   *
   * The land cover draws these by the hundred thousand and draws them right for
   * three hundred metres: a billboard with a green top. Standing under one, what
   * you actually see is a bare leaning trunk carrying almost nothing until well
   * above your head, and then a flat, broken umbrella — the shade is in patches
   * and the sky comes through it. That is the tree; the cone the distance layer
   * draws is a fir, and there are no firs on this coast.
   */
  function pine(t, s, y, h, leanTo) {
    // The trunk is the thing the wood is made of, and it was wrong in three
    // ways at once. Filmed in the stand behind the promenade: the stems are
    // bare to better than half their height and often two thirds, they are
    // 0.30-0.60 m through rather than 0.40, and they *all lean the same way* —
    // out of the shade of each other, towards the open water — at ten to
    // twenty-five degrees. A uniform random lean is a wood nobody planted; a
    // shared bias is a wood that grew somewhere.
    const P = facing(t, s, rng() * TAU);
    const lean = leanTo == null ? (rng() - 0.5) * 0.9
      : leanTo * (0.55 + rng() * 0.85);
    const rad = 0.15 + rng() * 0.14;
    post(P, 0, 0, y, y + h * 0.34, rad, [0.330, 0.270, 0.215], 7);
    post(P, lean * 0.34, 0, y + h * 0.32, y + h * 0.76, rad * 0.74,
      [0.360, 0.295, 0.235], 7);
    const cx = lean, top = y + h * 0.78;
    // Three limbs leaving the trunk under the crown, so the umbrella is
    // carried rather than balanced on the end of a stick.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + rng();
      post(P, cx * 0.6 + Math.cos(a) * h * 0.09, Math.sin(a) * h * 0.09,
        y + h * 0.70, top + h * 0.02, 0.075, [0.360, 0.295, 0.235], 5);
    }
    // Nine puffs on a shallow disc rather than three plates stacked on each
    // other. An Aleppo pine is a broken ceiling; a ceiling needs holes, and a
    // hole needs an edge on both sides of it.
    const band = [top - h * 0.11, top + h * 0.15];
    const DK = [0.118, 0.178, 0.100], LT = [0.250, 0.350, 0.195];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rng() * 0.55;
      const d = (i ? 0.38 + rng() * 0.62 : 0) * h * 0.25;
      const rr = h * (i ? 0.082 + rng() * 0.058 : 0.135);
      puff(P, cx + Math.cos(a) * d, Math.sin(a) * d,
        top + (rng() - 0.40) * h * 0.075, rr * 0.60, rr,
        DK, LT, band, 9, 3, 0.46, i + 1);
    }
  }

  /** An olive: a short trunk that forks low, and a silver-grey crown. */
  function olive(t, s, y, h) {
    const P = facing(t, s, rng() * TAU);
    post(P, 0, 0, y, y + h * 0.36, 0.19, [0.400, 0.360, 0.300], 5);
    for (const o of [-0.16, 0.18]) {
      post(P, o, o * 0.4, y + h * 0.30, y + h * 0.58, 0.10, [0.420, 0.380, 0.315], 4);
    }
    // Five lobes with light between them, which is what makes an olive read as
    // an olive: you can see the sky through the middle of one.
    const band = [y + h * 0.40, y + h * 0.92];
    const DK = [0.205, 0.240, 0.162], LT = [0.392, 0.448, 0.302];
    const olC = [[0, 0, 0.33, 0.60], [-0.52, 0.38, 0.24, 0.50],
      [0.50, -0.32, 0.23, 0.48], [0.26, 0.50, 0.21, 0.68],
      [-0.32, -0.44, 0.20, 0.66]];
    for (let i = 0; i < olC.length; i++) {
      const [dx, dz, r, hy] = olC[i];
      puff(P, dx * h * 0.5, dz * h * 0.5, y + h * hy, h * r * 0.74, h * r,
        DK, LT, band, 10, 4, 0.44, i + 3);
    }
  }

  /** Oleander: a mound of dark leaf with the flowers sitting on top of it. */
  function oleander(t, s, y, r) {
    const P = facing(t, s, rng() * TAU);
    const band = [y, y + r * 1.9];
    const DK = [0.098, 0.158, 0.094], LT = [0.220, 0.350, 0.208];
    // A mound of four, because one dome the size of a whole shrub is a dome.
    puff(P, 0, 0, y + r * 0.78, r * 0.86, r * 0.92, DK, LT, band, 8, 3, 0.32, 11);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + rng();
      puff(P, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55,
        y + r * (0.52 + rng() * 0.35), r * 0.52, r * 0.58,
        DK, LT, band, 7, 3, 0.36, 13 + i);
    }
    // Oleander in August is more flower than leaf.
    const flower = rng() < 0.5 ? [0.880, 0.480, 0.600] : [0.945, 0.930, 0.910];
    const fdk = flower.map((v) => v * 0.62);
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, d = rng() * r * 0.86;
      puff(P, Math.cos(a) * d, Math.sin(a) * d,
        y + r * (1.05 + rng() * 0.55), r * 0.13, r * 0.16,
        fdk, flower, [y + r * 0.9, y + r * 1.8], 6, 2, 0.30, 17 + i);
    }
  }

  /** Agave: no trunk, no crown, just blades out of the ground in a rosette. */
  function agave(t, s, y, r) {
    const P = facing(t, s, rng() * TAU);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rng() * 0.3;
      const up2 = 0.55 + rng() * 0.75;
      const c = Math.cos(a) * r, sn2 = Math.sin(a) * r;
      const col = [0.400, 0.470, 0.360];
      b.tri(P(-Math.sin(a) * r * 0.22, Math.cos(a) * r * 0.22, y),
        P(Math.sin(a) * r * 0.22, -Math.cos(a) * r * 0.22, y),
        P(c, sn2, y + r * up2), col);
      b.tri(P(Math.sin(a) * r * 0.22, -Math.cos(a) * r * 0.22, y),
        P(-Math.sin(a) * r * 0.22, Math.cos(a) * r * 0.22, y),
        P(c, sn2, y + r * up2), col);
    }
  }

  /**
   * A dinghy, floating. Flat bottom, flared sides, two thwarts.
   *
   * Open, which is the whole of whether it reads as a boat. Capped across the
   * top it is a lozenge — from the promenade it looked like a painted plank
   * lying on the sea. So: an outer skin, a gunwale, and an inner skin down to a
   * floor you can see, which costs six more quads and is the difference.
   */
  function dinghy(t, s, ang, col) {
    const P = facing(t, s, ang);
    const L = 1.70, Bm = 0.64;
    // Waterline at 0. A dinghy this size floats with about a third of her
    // freeboard under, which is what stops her sitting on the sea like a toy.
    const keel = -0.26, rimY = 0.44, floor = 0.04;
    const ring = (k, y) => [
      [-Bm * 0.55 * k, -L], [Bm * 0.55 * k, -L], [Bm * k, 0],
      [Bm * 0.72 * k, L * 0.92], [-Bm * 0.72 * k, L * 0.92], [-Bm * k, 0],
    ].map(([a, c]) => P(a, c * (0.55 + 0.45 * k), y));
    const low = ring(0.62, keel), top = ring(1, rimY), inn = ring(0.88, rimY);
    const bed = ring(0.55, floor);
    const WOOD = [0.700, 0.615, 0.480];
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      b.quad(low[i], low[j], top[j], top[i], col);            // outside
      b.quad(top[j], top[i], inn[i], inn[j], [col[0] * 0.9, col[1] * 0.9, col[2] * 0.9]);
      b.quad(inn[j], inn[i], bed[i], bed[j], WOOD);           // inside
      b.tri(bed[i], bed[j], P(0, 0, floor), WOOD);            // and the floor
    }
    for (const ds of [-0.40, 0.50]) {
      boxIn(P, -Bm * 0.72, Bm * 0.72, ds - 0.06, ds + 0.06,
        rimY - 0.10, rimY - 0.03, [0.660, 0.600, 0.500]);
    }
  }

  // ── and where all of it goes ───────────────────────────────────────────────
  // `pose` is what they are doing; `beat` is the stretch of promenade a walker
  // patrols, and is null for everybody who has settled somewhere.
  //
  // `TURNOUT` is how many of the people the layout asks for actually turn up.
  // It sits on `B` rather than on the strides that call it, deliberately: the
  // strides also place the parasols, the loungers and the ladders, and thinning
  // the beach by walking the loop less often empties the furniture along with
  // the people. Forty-six figures on 186 m of shore is one every four metres,
  // which is a crowded August Saturday; the same layout at half strength is a
  // Tuesday, and a Tuesday is what you can walk through.
  //
  // Rejecting inside `B` costs one draw of `rng` per candidate whether or not
  // they appear, so the whole layout downstream shifts. That is fine — it is
  // still the same seed and still the same beach every time — but it does mean
  // this is not the old crowd with half of them deleted.
  // (Not `CROWD` — that name is already the walkers' gait table 1800 lines down,
  // and every file in src/ shares one lexical scope, so this shadowed it and the
  // whole resort failed to build at 78%.)
  // It was a flat 0.5, and a flat turnout is the one thing a beach never has.
  //
  // The survey is unambiguous about this: thirty people under one cafe canopy
  // in seventeen metres of frontage, and two on sixty metres by fifty of open
  // plaza sixty metres away. People at a bathing station are where the shade,
  // the drink and the water are, and the ground between those is empty — so
  // spreading them evenly reads as a stadium crowd rather than as an afternoon.
  //
  // Weighted two ways. Along the shore, a bump at every business and at the
  // root of the mole. Across it, toward the water: the far side of the
  // promenade is a place you walk through on the way to somewhere.
  const ATTRACT = SHOPS.map((S) => (S.t0 + S.t1) * 0.5).concat([JAD.jetty]);
  const TURNOUT = 0.5;                     // kept as the flat rate's old name
  const turnoutAt = (t, s) => {
    let w = 0.20;
    for (const a of ATTRACT) {
      const d = (t - a) / 26;
      w = Math.max(w, 0.20 + 1.35 * Math.exp(-d * d));
    }
    // And a general lift over the bathing edge, so the water is never deserted
    // even where there is nothing to buy.
    const edge = 1 - sat((s - JAD.mid) / 18);
    return Math.min(0.96, w * (0.52 + 0.74 * edge));
  };
  const bathers = [];
  const B = (t, s, y, ang, pose, k = 1, beat = null) => {
    if (rng() >= turnoutAt(t, s)) return null;
    const b = { t, s, y, ang, pose, k, beat };
    bathers.push(b);
    return b;
  };

  // The middle terrace is the shelf people actually lay their towels on: wide
  // enough for a parasol and a pair of loungers, and one step above the water.
  for (let t = 9; t < LEN - 9; t += 7.4 + rng() * 5.0) {
    const st = at(t), y = st.mid;
    if (Math.abs(t - gapAt) < 5) continue;                  // keep the jetty clear
    // Free-standing parasols belong on the sand, not on the concrete.
    //
    // In thirty-nine photographs and a hundred and thirty-two frames of the
    // built stretch there is not one parasol standing on the promenade, the
    // quay, the mole or the plaza — every single one belongs to a cafe
    // terrace, cream, on a pebble-aggregate disc. What was here put a striped
    // beach parasol every ten metres along a concrete bathing station.
    //
    // West of `beachTo` they stay, and deliberately: that is sand, no survey
    // photograph reaches it, and a beach with nothing on it would be a
    // different mistake made for the same reason. Absence of evidence is not a
    // licence in either direction.
    if (t < JAD.beachTo && rng() < 0.62) {
      const s = 5.4 + rng() * 3.6;
      parasol(t, s, y, pick(SWIM));
      // The pole only. The canopy is at 1.9 m and being stopped by shade you
      // are walking under is worse than walking through it.
      solid(t, s, 0.09, 0.09, 2.3);
      // Loungers point at the water, which is the one thing everybody here
      // agrees about.
      const n = 1 + (rng() < 0.55 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const lt = t + (i - (n - 1) * 0.5) * 1.5;
        lounger(lt, s - 1.5, y, Math.PI, pick([[0.900, 0.890, 0.870],
          [0.240, 0.420, 0.560], [0.860, 0.560, 0.300]]));
        // Turned through Math.PI, so its local −0.92…+0.87 lands seaward of the
        // placement point rather than inland of it.
        solid(lt, s - 1.5 + 0.025, 0.32, 0.895, 0.7);
        // Centred on the lounger, not 0.46 m seaward of it. The figure spans
        // local s −0.90…+0.98 and the lounger −0.92…+0.87, so at `s - 1.9` the
        // head hung half a metre off the end in mid-air — invisible while the
        // body was four flat boxes, obvious the moment it had any depth.
        // Feet seaward, head inland. The rig lies down by tipping about its
        // own root, so the anchor is the soles and `ang` points from the head
        // towards the feet — see the `lie` case in src/42-crowd.js.
        if (rng() < 0.5) B(lt, s - 2.30, y + 0.52, -Math.PI / 2, 'lie', 1);
      }
    } else if (rng() < 0.5) {
      B(t, 5.0 + rng() * 4.0, y, Math.PI + (rng() - 0.5) * 1.4, 'stand', 1);
    }
  }

  // Along the lowest platform: sitting on the edge with their feet over the
  // water, which is what that step is for and the reason it is 4.2 m wide.
  for (let t = 6; t < LEN - 6; t += 5.2 + rng() * 6.5) {
    if (Math.abs(t - gapAt) < 4) continue;
    const st = at(t), y = st.lip;
    const r = rng();
    // 0.55 m in, not 1.25: the thigh reaches about 0.43 m forward of the hip,
    // so this is where the knee lands on the lip of the quay and the shins
    // genuinely hang over the water rather than over more concrete.
    if (r < 0.44) B(t, 0.55, y, Math.PI, 'sit', r < 0.10 ? 0.66 : 1);
    else if (r < 0.60) B(t, 2.2 + rng() * 1.4, y, rng() * TAU, 'stand', 1);
    else if (r < 0.70) B(t, -0.9, -0.55, Math.PI, 'wade', r < 0.655 ? 0.66 : 1);
  }

  // The promenade: people who are not bathing at all — walking it, standing at
  // the rail, waiting for the boat. Most of these walk, and they are the reason
  // any of this was worth doing: the deck is the one strip of Jadrija that runs
  // unbroken for three hundred metres, so it is the one place a figure can go
  // somewhere without immediately arriving.
  //
  // The stride is shorter here, and the odds of walking rather than standing
  // are higher, and both are only here. `TURNOUT` halves everybody, but the
  // promenade started with the fewest to halve — ten candidates over 186 m —
  // and the walkers are the whole reason this strip was built, so half of them
  // is five, which is a resort that has closed. The two knobs do different
  // jobs: the shorter stride puts the candidate count back, and the higher walk
  // odds spend those candidates on walkers instead of on more people standing
  // about, which is the thing there was already too much of. Fifteen walkers
  // became seven and forty-six figures became twenty-two, which is the halving
  // asked for, in the place where halving it is worth the least.
  for (let t = 10; t < LEN - 10; t += 8 + rng() * 9) {
    const st = at(t), y = st.deck;
    const lane = JAD.mid + 1.6 + rng() * 6.0;
    let lead;
    if (rng() < 0.84) {
      // A beat of 30–90 m, clamped inside the resort. Short beats read as
      // pacing and long ones mean you never see the same person twice, and
      // neither is what a promenade looks like.
      const half = 15 + rng() * 30;
      lead = B(t, lane, y, 0, 'walk', 1,
        { t0: Math.max(4, t - half), t1: Math.min(LEN - 4, t + half) });
    } else {
      lead = B(t, lane, y, rng() * TAU, 'stand', 1);
    }
    // Two together, half the time. People come here in pairs — and a pair walks
    // the same beat at the same speed, a metre apart, or it is not a pair.
    //
    // Off the figure `B` handed back, not off the end of the array: with the
    // crowd thinned, the person this one came with may not have turned up, and
    // the last entry is then somebody forty metres away whose beat and heading
    // this one would have copied. A pair standing apart is two people; a pair
    // walking a beat neither of them is on is a bug you would have to watch for
    // a minute to see.
    if (lead && rng() < 0.5) {
      B(t + 0.7, lane + 1.1, y, lead.ang, lead.pose,
        rng() < 0.28 ? 0.68 : 1, lead.beat && { ...lead.beat });
    }
  }

  // ── the armouring, and the boats on the bank ───────────────────────────────
  // Where the poured concrete gives out and the shingle takes over, the bank is
  // held with rough limestone blocks — 0.6 to 1.2 m, tipped rather than laid,
  // with the gaps left open. It is the one place on this shore with no straight
  // line in it, which is exactly why the join reads as a join and not as a
  // change of paint.
  {
    const back7 = b;
    b = up;
    const ROCK = [[0.510, 0.478, 0.418], [0.548, 0.514, 0.448],
      [0.472, 0.442, 0.386], [0.528, 0.492, 0.430]];
    for (const [t0, t1] of [[JAD.beachTo - 16, JAD.beachTo + 14]]) {
      // 0.62 m apart and a third of them dropped, so the blocks overlap and
      // the gaps are uneven. Marching them along at an even pitch, all one
      // size, gave a row of tidy grey cubes along the water — which is a kerb,
      // not armouring. Tipped rock is dumped, not laid.
      let k = 0;
      for (let t = t0; t < t1; t += 0.62, k++) {
        const j0 = jit(k, 31), j1 = jit(k, 32), j2 = jit(k, 33);
        if (jit(k, 34) < 0.34) continue;
        const sc = 0.55 + j2 * 1.15;
        // Straddling the waterline, not tucked under the lip. The first cut put
        // the tops at lip - 0.25 and the whole bank vanished behind the edge of
        // the deck: correct for armouring that is doing its job and useless as
        // a thing to look at. What the frames show is a tumble of rock standing
        // proud of the water with the shingle running up between the blocks.
        const ss = -0.9 + j0 * 3.4;
        const y = at(t).lip - 0.85 - j1 * 0.55;
        const w2 = (0.30 + j2 * 0.26) * sc, d2 = (0.28 + j0 * 0.30) * sc;
        const h2 = (0.85 + j1 * 0.70) * sc;
        // Each block turned on its own axis and tapering off-square, so no two
        // present the same face. One `frustumS` per rock rather than a box:
        // a box has four parallel sides and reads as masonry however it is
        // coloured.
        const ang = j1 * TAU;
        const P2 = (dt, ds, yy) => {
          const c = Math.cos(ang), sn = Math.sin(ang);
          return W(t + dt * c - ds * sn, ss + dt * sn + ds * c, yy);
        };
        frustumS((dt, ds, yy) => P2(dt, ds, yy), -h2 * 0.5,
          [0, y + h2 * 0.5, w2, d2],
          h2 * 0.5, [(j2 - 0.5) * w2 * 0.7, y + h2 * 0.5 + (j0 - 0.5) * d2 * 0.6,
            w2 * (0.42 + j0 * 0.34), d2 * (0.40 + j2 * 0.36)],
          ROCK[((j2 * 89) | 0) % ROCK.length]);
      }
    }
    // And the hire boats: kayaks and a pedalo, stacked on the bank at the top
    // of the beach in red and yellow, which is the only place on this shore
    // anything with a hull actually is.
    {
      const bt = JAD.beachTo - 26, bs = JAD.mid + 5.0;
      const HULL = [[0.520, 0.120, 0.110], [0.700, 0.560, 0.110],
        [0.140, 0.240, 0.480]];
      for (let k = 0; k < 7; k++) {
        const row = k % 3, tier = (k / 3) | 0;
        const t = bt + row * 0.86 + tier * 0.30;
        const y = surfaceY(t, bs) + 0.10 + tier * 0.34;
        const c = HULL[(k + tier) % HULL.length];
        // A kayak on its side: a long shallow wedge, nose tapered.
        frustumS((dt, ds, yy) => W(t + dt, bs + ds, yy),
          -1.90, [0, 0, 0.06, 0.05], 0.0, [0, 0, 0.33, 0.16], c);
        frustumS((dt, ds, yy) => W(t + dt, bs + ds, yy),
          0.0, [0, 0, 0.33, 0.16], 1.90, [0, 0, 0.07, 0.05], c);
      }
      runs.push({ t0: bt - 0.6, t1: bt + 2.4, s0: bs - 2.1, s1: bs + 2.1,
        y: surfaceY(bt, bs), h: 1.1 });
    }
    b = back7;
  }

  // ── what is parked in the wood ─────────────────────────────────────────────
  // Both walk-throughs film cars standing among the pines — nose-in, in loose
  // rows on the bare needle floor, with no marked bay anywhere. That is what
  // the stand behind a Dalmatian bathing station is in August: half wood, half
  // car park, and the game had a wood with nobody's car in it.
  //
  // Built here rather than borrowed from 37-props.js: `carNearProto` is drawn
  // through an instanced prop layer owned by the town, and reaching into that
  // from the resort would mean sharing a layer whose capacity is budgeted
  // somewhere else entirely.
  {
    const back6 = b;
    b = up;
    const GLASS = [0.100, 0.125, 0.150];
    const TYRE = [0.070, 0.070, 0.080];
    const LAMP2 = [0.780, 0.760, 0.690];
    const PAINT = [[0.700, 0.700, 0.695], [0.560, 0.570, 0.585],
      [0.230, 0.235, 0.245], [0.115, 0.115, 0.125], [0.380, 0.130, 0.115],
      [0.140, 0.200, 0.340], [0.480, 0.470, 0.430]];
    let n = 0;
    for (let t = JAD.beachTo - 40; t < LEN - 30; t += 4.0) {
      if (!clearOfShops(t)) continue;
      // Dense: the aerial shows the whole back of the wood given over to it in
      // August, and one car every fourteen metres reads as a lay-by rather than
      // as a car park.
      // Tightened from 5.6 m to 4.0 m when the second row came out: one row
      // at the old spacing is a lay-by, and the aerial has the whole back of
      // the wood given over to it in August.
      const j = jit(t | 0, 21);
      if (j > 0.80) continue;
      // Inside 39 m of the water, and that is not a taste call: the note over
      // the house thinning records that OSM maps nothing at all within 39 m of
      // this shore, which makes it the one band where a car cannot end up
      // parked in somebody's front room. The first cut put two rows at 37 and
      // 50 and the second row stood inside the houses — invisible from the
      // promenade and unmissable the moment the camera was in one.
      // And the clamp was on the NOSE. `s0` is where the front bumper stands
      // and the car is 4.3 m long *inland* of it, so the second row started at
      // 37.1-38.5 and ended at 42.8 — inside the OSM footprints, which is the
      // exact failure the 38 m rule was written down for. One nose-in row on
      // the lane's seaward side is what fits, and it fits with its tail at
      // 35.5 rather than with its nose there.
      // Not inside the playground railing. The car loop starts at
      // `beachTo - 40` = 165, which is the middle of the compound, and three
      // of them were standing on the turf with the swing frame over them.
      if (t > PLAY.t0 - 3 && t < PLAY.t1 + 3) continue;
      if (t > SAN.t0 - 3 && t < SAN.t1 + 3) continue;
      const s0 = JAD.rowB + 5.0 + jit(t | 0, 23) * 1.4;
      const y = surfaceY(t, s0 + 2.0);
      const col = PAINT[((jit(t | 0, 24) * 97) | 0) % PAINT.length];
      // Nose-in: the long axis runs inland, so `s` is the length of the car.
      const P = (dt, ds, yy) => W(t + dt, s0 + ds, yy);
      // Body, in two masses so it has a bonnet and a cabin.
      boxIn(P, -0.86, 0.86, 0.10, 4.30, y + 0.34, y + 0.98, col, shade(col, 1.05));
      boxIn(P, -0.80, 0.80, 1.05, 3.25, y + 0.98, y + 1.44,
        shade(col, 0.94), shade(col, 1.02));
      // Glass, inset a little all round so it reads as glazing and not paint.
      boxIn(P, -0.74, 0.74, 1.12, 3.18, y + 1.00, y + 1.40, GLASS);
      boxIn(P, -0.81, 0.81, 1.05, 3.25, y + 1.03, y + 1.37, shade(col, 0.90));
      // Bumpers and lights.
      boxIn(P, -0.84, 0.84, 0.02, 0.16, y + 0.42, y + 0.72, [0.180, 0.180, 0.190]);
      boxIn(P, -0.84, 0.84, 4.24, 4.38, y + 0.42, y + 0.72, [0.180, 0.180, 0.190]);
      for (const o of [-0.58, 0.58]) {
        boxIn(P, o - 0.20, o + 0.20, 0.10, 0.20, y + 0.74, y + 0.92, LAMP2);
        boxIn(P, o - 0.20, o + 0.20, 4.20, 4.30, y + 0.74, y + 0.90,
          [0.420, 0.090, 0.080]);
      }
      // Wheels.
      for (const [ot, os] of [[-0.80, 0.95], [0.80, 0.95], [-0.80, 3.45], [0.80, 3.45]]) {
        boxIn(P, ot - 0.11, ot + 0.11, os - 0.32, os + 0.32, y, y + 0.62, TYRE);
        boxIn(P, ot - 0.13, ot + 0.13, os - 0.19, os + 0.19,
          y + 0.13, y + 0.49, [0.520, 0.528, 0.540]);
      }
      runs.push({ t0: t - 0.95, t1: t + 0.95, s0: s0 - 0.1, s1: s0 + 4.5,
        y, h: 1.44 });
      n++;
    }
    void n;
    b = back6;
  }

  // ── the wall along the back, and the playground behind it ─────────────────
  // Both from the approach lane, and both recurring: a low rendered wall capped
  // with dressed limestone blocks runs the length of it with planters standing
  // on the cap, and behind that a fenced children's playground on a pad of
  // limestone gravel. The wall is the boundary element of the whole resort —
  // it is in every frame that looks inland — and there was nothing here at all.
  {
    const back5 = b;
    b = up;
    const REND = [0.545, 0.522, 0.470];       // white render, sun-greyed
    const CAP = [0.610, 0.578, 0.512];        // dressed limestone coping
    const MESH = [0.115, 0.245, 0.150];       // dark green fence mesh
    const GALV = [0.520, 0.528, 0.522];
    const PLAY = [[0.720, 0.330, 0.090], [0.130, 0.320, 0.620],
      [0.180, 0.470, 0.220], [0.640, 0.130, 0.130], [0.760, 0.640, 0.130]];
    const ws = JAD.back + 3.2;
    for (let t = JAD.beachTo - 30; t < LEN - 24; t += 2.4) {
      if (!clearOfShops(t)) continue;
      const y = surfaceY(t, ws);
      boxTS(t, t + 2.34, ws - 0.16, ws + 0.16, y, y + 0.78, REND,
        shade(REND, 1.04));
      boxTS(t - 0.02, t + 2.36, ws - 0.22, ws + 0.22, y + 0.78, y + 0.92, CAP,
        shade(CAP, 1.07));
      // A planter on the cap every few bays, which is what they are for.
      if (((t / 2.4) | 0) % 4 === 0) {
        const pt2 = t + 1.17;
        boxTS(pt2 - 0.28, pt2 + 0.28, ws - 0.26, ws + 0.26, y + 0.92, y + 1.28,
          [0.470, 0.400, 0.330], [0.500, 0.428, 0.352]);
        dome(W, pt2, ws, y + 1.28, 0.30, 0.30, [0.170, 0.330, 0.160], 6);
      }
    }
    // The playground: a fenced pad with a frame, a slide and a swing on it.
    {
      const pt0 = JAD.beachTo - 22, pt1 = pt0 + 16;
      const ps0 = ws + 2.0, ps1 = ps0 + 12;
      const y = surfaceY((pt0 + pt1) * 0.5, (ps0 + ps1) * 0.5);
      b = deck;
      boxTS(pt0 - 0.4, pt1 + 0.4, ps0 - 0.4, ps1 + 0.4, y - 0.10, y + 0.02,
        [0.560, 0.530, 0.470], [0.590, 0.558, 0.494]);
      b = up;
      // Mesh fence: posts and a stipple panel, two triangles a bay.
      for (const [a, c, sA, sC] of [[pt0, pt1, ps0, ps0], [pt0, pt1, ps1, ps1],
        [pt0, pt0, ps0, ps1], [pt1, pt1, ps0, ps1]]) {
        const n = Math.max(2, Math.round(Math.hypot(c - a, sC - sA) / 2.5));
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          post(W, a + (c - a) * u, sA + (sC - sA) * u, y, y + 1.35, 0.035,
            GALV, 6);
        }
        boxTS(Math.min(a, c) - 0.02, Math.max(a, c) + 0.02,
          Math.min(sA, sC) - 0.02, Math.max(sA, sC) + 0.02,
          y + 0.05, y + 1.30, MESH);
      }
      // The frame: four legs, a deck, a ladder and a slide off one side.
      const ft = pt0 + 5.0, fs = ps0 + 5.0;
      for (const [ot, os] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
        post(W, ft + ot, fs + os, y, y + 1.90, 0.055, PLAY[1], 6);
      }
      boxTS(ft - 1.2, ft + 1.2, fs - 1.2, fs + 1.2, y + 1.16, y + 1.28,
        PLAY[0], shade(PLAY[0], 1.08));
      boxTS(ft - 1.2, ft + 1.2, fs - 1.2, fs + 1.2, y + 1.90, y + 2.06,
        PLAY[3], shade(PLAY[3], 1.08));
      // The slide, a raked plane from the deck down to the gravel.
      b.quad(W(ft + 1.2, fs - 0.45, y + 1.16), W(ft + 1.2, fs + 0.45, y + 1.16),
        W(ft + 4.2, fs + 0.45, y + 0.06), W(ft + 4.2, fs - 0.45, y + 0.06),
        PLAY[4]);
      // A swing frame beside it.
      const st3 = pt0 + 11.0;
      for (const o of [-1.6, 1.6]) {
        post(W, st3 + o, fs - 1.0, y, y + 2.10, 0.05, PLAY[2], 6);
        post(W, st3 + o, fs + 1.0, y, y + 2.10, 0.05, PLAY[2], 6);
      }
      boxTS(st3 - 1.7, st3 + 1.7, fs - 0.06, fs + 0.06, y + 2.04, y + 2.14,
        PLAY[2]);
      for (const o of [-0.8, 0.8]) {
        boxTS(st3 + o - 0.03, st3 + o + 0.03, fs - 0.02, fs + 0.02,
          y + 0.62, y + 2.04, [0.240, 0.240, 0.245]);
        boxTS(st3 + o - 0.22, st3 + o + 0.22, fs - 0.13, fs + 0.13,
          y + 0.56, y + 0.62, PLAY[3]);
      }
      runs.push({ t0: pt0, t1: pt1, s0: ps0, s1: ps1, y, h: 1.35 });
    }
    b = back5;
  }

  // ── street furniture ───────────────────────────────────────────────────────
  // Three things the promenade has and this file did not: a bin, a shower and
  // the concrete bench that is nothing like the timber one already here.
  {
    const back2 = b;
    b = up;
    const AGG = [0.470, 0.450, 0.412];        // pebble aggregate, washed
    const STAIN = [0.560, 0.566, 0.560];      // the stainless collar
    const COBALT = [0.075, 0.180, 0.470];     // the shower post
    const MINT = [0.400, 0.600, 0.500];       // the privacy screen
    const SLAT = [0.330, 0.190, 0.115];       // dark timber
    const PLINTH = [0.560, 0.548, 0.522];     // precast, pale

    // The bench on the promenade is not the backed timber one in the tree line.
    // It is a six-metre precast plinth with two metres of slats inset flush at
    // one end, and it reads as part of the paving rather than as a chair.
    for (let t = JAD.beachTo + 24; t < LEN - 20; t += 61) {
      if (!clearOfShops(t)) continue;
      const y = at(t).deck, sb = JAD.mid + 2.6;
      boxTS(t - 3.0, t + 3.0, sb - 0.30, sb + 0.30, y, y + 0.45, PLINTH,
        shade(PLINTH, 1.06));
      boxTS(t + 0.9, t + 2.9, sb - 0.27, sb + 0.27, y + 0.45, y + 0.49, SLAT,
        shade(SLAT, 1.12));
      runs.push({ t0: t - 3.0, t1: t + 3.0, s0: sb - 0.30, s1: sb + 0.30,
        y, h: 0.49 });
      // A bin within three metres of every bench, which is where they are.
      const bt = t + 3.9;
      post(W, bt, sb, y, y + 0.86, 0.25, AGG, 9);
      post(W, bt, sb, y + 0.86, y + 0.94, 0.27, STAIN, 9);
      post(W, bt, sb, y + 0.94, y + 0.99, 0.10, [0.480, 0.120, 0.110], 7);
      runs.push({ t0: bt - 0.3, t1: bt + 0.3, s0: sb - 0.3, s1: sb + 0.3,
        y, h: 0.99 });
      clutter(t - 3.6, sb - 1.1, y, 2, (t | 0) * 13 + 5);
    }

    // Two beach showers. A cobalt post with two roses, and a mint screen beside
    // it — both of them photographed, and both of them the only saturated
    // colour on this stretch of concrete.
    for (const t of [JAD.beachTo + 46, JAD.jetty + 96]) {
      const y = at(t).deck, ss = JAD.mid + 1.0;
      post(W, t, ss, y, y + 2.20, 0.055, COBALT, 8);
      for (const hh of [1.40, 1.62]) {
        boxTS(t - 0.045, t + 0.045, ss - 0.34, ss - 0.02, y + hh, y + hh + 0.05,
          [0.640, 0.648, 0.640]);
        post(W, t, ss - 0.34, y + hh - 0.09, y + hh, 0.055, [0.640, 0.648, 0.640], 7);
      }
      boxTS(t - 0.06, t + 0.06, ss - 0.10, ss + 0.10, y, y + 0.06, STAIN);
      // The screen: a panel on two legs, a gooseneck over the top of it.
      const st2 = t + 1.5;
      boxTS(st2 - 0.80, st2 + 0.80, ss + 0.30, ss + 0.38, y + 0.30, y + 2.10,
        MINT, shade(MINT, 1.08));
      for (const o of [-0.72, 0.72]) {
        post(W, st2 + o, ss + 0.34, y, y + 0.34, 0.045, STAIN, 6);
      }
      post(W, st2, ss + 0.34, y + 2.10, y + 2.24, 0.04, STAIN, 6);
      boxTS(st2 - 0.04, st2 + 0.04, ss - 0.02, ss + 0.34, y + 2.20, y + 2.24, STAIN);
      runs.push({ t0: st2 - 0.85, t1: st2 + 0.85, s0: ss + 0.26, s1: ss + 0.42,
        y, h: 2.10 });
    }
    b = back2;
  }

  // Somebody in the chairs, which had every table on the boardwalk laid and
  // nobody at any of them.
  //
  // The bather generators walk the shore lanes and never go near a shop, so the
  // terraces came out as furniture showrooms — and the Slasticarnica alone has
  // thirty people at it in the survey. Placed off `terraceSeats`, the same list
  // the chairs themselves are drawn from, so nobody sits half a metre to the
  // left of one.
  //
  // Not every chair: a full terrace at four in the afternoon still has empty
  // seats at the ends of it, and a cafe with every single chair taken reads as
  // a stadium. Two in three, which is what the photographs show.
  for (const S of SHOPS) {
    for (const [t, s2, ang] of terraceSeats(S)) {
      if (rng() < 0.34) continue;
      B(t, s2, at(t).deck, ang + Math.PI * 0.5, 'sit', 1);
    }
  }

  // Somebody halfway down every other ladder, which is the one place on this
  // shore where a still figure reads unambiguously as mid-movement.
  for (let t = 22; t < LEN - 12; t += 88) {
    const st = at(t);
    B(t + 0.34, -0.28, st.lip - 0.95, 0, 'stand', 1);
  }

  // And the people — but only the ones who have settled somewhere.
  //
  // This restores the note that used to sit on the tree blockers, that a
  // parasol is stepped over and a person gets out of your way. It was reversed
  // when nobody on this beach could move, because a figure you walk straight
  // through is worse than one that holds you off. Now the ones on the deck do
  // move, and they steer around you — see `avoid` in the update below — so a
  // static box where one of them used to be standing would be a wall in the
  // middle of the promenade with nobody in it.
  //
  // `lie` is already covered by the lounger underneath it, and `wade` is
  // standing in the sea nearly two metres outside the seaward bound.
  // ── eight of them, and only eight ──────────────────────────────────────────
  //
  // The cast is cut here rather than at `B`, and that is the point: `TURNOUT`
  // rejects a candidate before it is placed, so lowering it would empty the
  // parasols and the loungers along with the people. A bathing station with
  // forty towels and eight bodies is a Tuesday afternoon. One with eight towels
  // is closed.
  //
  // Eight because each of them is now a whole person — its own mesh, its own
  // skeleton, its own build — instead of one of two silhouettes repainted, and
  // eight who are different beat twenty-four who are not for a fraction of the
  // triangles. See `makeSkinCrowd` in 42-crowd.js.
  //
  // `lie` and `sit` go first because there is no clip for either: the bake in
  // tools/blender/bathers_mh.py carries six, and lying down is not one of them.
  // Their loungers stay, and an empty lounger on a beach is not a missing
  // person, it is somebody who has gone in the water.
  // How many people are at Jadrija.
  //
  // Eight, on five hundred and seventy metres of shore, against a survey that
  // counts thirty of them under one cafe canopy in seventeen metres of frontage
  // and forty-eight in a single frame. Eight was never a judgement about the
  // beach — it was the number of skinned meshes in BATHER_CAST, arriving as a
  // constant. With the instanced tier back in play the constant can mean what
  // it says.
  //
  // 84 over 572 m is about one person every seven metres, which is what the
  // photographs support once the density is weighted toward the cafes and the
  // bathing edge rather than spread flat.
  const CAST = 84;
  // Of those, how many are the good meshes. The rest are the instanced pair.
  const SKIN_CAST = 8;
  {
    // Three of the scripted ones, not all of them.
    //
    // There are exactly eight figures carrying a beat and every one of them is
    // a promenade walker, so keeping the lot filled the cast before anybody on
    // the sand was considered — which is how the second attempt produced eight
    // walkers as well, for a completely different reason than the first. Three
    // is enough that the scripted business still happens and leaves five places
    // for people who are actually at the beach.
    const BEATS = 3;
    const keep = bathers.filter((b) => b.beat).slice(0, BEATS);
    // Round-robin across the poses, not just along the shore.
    //
    // Spreading by position alone was the first attempt and it gave eight
    // walkers: the promenade has more people on it than the sand does, so a
    // pass that takes every nth figure takes the promenade eight times. What
    // came out was a bathing station where nobody was bathing — eight strangers
    // walking past forty empty towels.
    // `sit` and `lie` are back in, and they are the reason the beach was empty.
    //
    // They were dropped because the skinned blobs have no clip for either and
    // land on `idle` — a person standing where they should be sitting. But the
    // *instanced* rig poses both properly, with a measured pelvis drop and a
    // whole-figure roll for the sunbather; read the `sit` and `lie` cases in
    // 42-crowd.js. So the exclusion was never about the beach, it was about
    // which tier drew them, and with two tiers it stops being a choice at all:
    // they go to the instances, which is where they look right.
    //
    // This was also the cap that bound. Only stand, wade and walk were
    // eligible, there were eighteen of those, and raising CAST past eighteen
    // did nothing whatever.
    const pool = ['stand', 'wade', 'walk', 'sit', 'lie'].map((mode) => {
      const g = bathers.filter((b) => !b.beat && b.pose === mode);
      // Within a pose, still spread along the shore, or the three who are
      // standing are standing together.
      return g.map((b, i) => [i * 9973 % Math.max(1, g.length), b])
        .sort((a, c) => a[0] - c[0]).map((x) => x[1]);
    });
    for (let round = 0; keep.length < CAST && round < 40; round++) {
      for (const g of pool) {
        if (keep.length >= CAST) break;
        const b = g.shift();
        if (b) keep.push(b);
      }
    }
    bathers.length = 0;
    for (const b of keep.slice(0, CAST)) bathers.push(b);
  }

  for (const b of bathers) {
    if (b.pose === 'lie' || b.pose === 'wade' || b.beat) continue;
    solid(b.t, b.s, 0.16 * b.k, 0.16 * b.k, 1.8 * b.k);
  }

  // Dinghies: two alongside the jetty and a few on their own moorings off the
  // shelf. None of them is going anywhere — this is a bathing station, and the
  // boats belong to whoever walked down to it.
  // None. They used to float five to fifteen metres off the bathing edge, which
  // is the middle of the water everybody swims in, and the survey has no moored
  // boat at Jadrija at all — not against the mole, not on the shelf, not in the
  // frame that looks down the whole frontage. What is out there instead is the
  // swim line: white floats on a rope at three-metre centres, thirty-eight
  // metres out, with one orange marker on it. Anything with a hull goes beyond
  // that or on the grass, and both are the boardwalk's job.
  {
    const FLOAT = [0.930, 0.925, 0.905], MARK = [0.870, 0.400, 0.130];
    for (let t = 8; t < LEN - 8; t += 3.0) {
      const c = Math.abs(t - DIVE.t) < 1.6 ? MARK : FLOAT;
      const r = c === MARK ? 0.22 : 0.06;
      boxTS(t - r, t + r, -38 - r, -38 + r, -r, r, c);
    }
  }
  void dinghy;

  // Green. Pines and olives go behind the back row where there is soil and where
  // they will not be standing in the middle of the promenade; oleander runs
  // along the back of the walk, which is where every Dalmatian resort puts it
  // because it takes salt and nothing eats it; agave on the rough slope past the
  // concrete, which is exactly where it grows without being planted.
  const greens = [];
  // ── the sanitary block ─────────────────────────────────────────────────────
  //
  // Photographed straight on at t 355: the flat-roofed rendered block behind
  // Maslina, in two masses, with a thick concrete roof slab oversailing the
  // render by a hand's breadth on every side. Lime render gone salmon and
  // grey in patches, damp staining up from the ground, three dark green
  // louvred doors, and a red fire cabinet with two white H's on it bolted to
  // the wall beside them. A washing line is strung across the right-hand half
  // with a row of painted garments on it — that is a mural, not laundry, and
  // it is on the wall in the photograph.
  //
  // It is the single most-used building on the shore and the game had a wood
  // where it stands. Nobody puts a bathing station on a peninsula without one.
  {
    const back9 = b;
    b = up;
    const y = surfaceY((SAN.t0 + SAN.t1) * 0.5, SAN.s0);
    const PINK = [0.520, 0.408, 0.352];        // the main mass
    const GREY = [0.468, 0.432, 0.398];        // the wing, greyer
    const SLAB = [0.505, 0.492, 0.462];        // the roof slab
    const DOOR = [0.075, 0.215, 0.130];        // louvred, dark green
    const RED = [0.600, 0.095, 0.075];
    const tm = 350.4;                          // where the wing meets the block

    // The concrete apron it stands on, cracked and patched.
    b = deck;
    for (let t = SAN.t0 - 1.6; t < SAN.t1 + 1.6; t += 2.1) {
      const t1 = Math.min(t + 2.1, SAN.t1 + 1.6);
      for (let k = 0; k < 2; k++) {
        const a0 = SAN.s0 - 2.2 + k * 3.6, a1 = a0 + 3.6;
        const g = 0.93 + 0.14 * ((jit(t | 0, 100 + k) * 5) | 0) / 4;
        b.quad(W(t, a0, surfaceY(t, a0) + 0.05), W(t1, a0, surfaceY(t1, a0) + 0.05),
          W(t1, a1, surfaceY(t1, a1) + 0.05), W(t, a1, surfaceY(t, a1) + 0.05),
          [0.545 * g, 0.528 * g, 0.492 * g]);
      }
    }
    b = up;

    // The two masses. The wing is lower and greyer, and its slab is thinner.
    const mass = (a, c, s0, s1, h, col, cap) => {
      boxTS(a, c, s0, s1, y - 0.35, y + h, col, shade(col, 0.94));
      // The slab. Oversailing on all four sides, which is the whole silhouette
      // of this building: without it the block is a shed.
      boxTS(a - 0.30, c + 0.30, s0 - 0.30, s1 + 0.30, y + h, y + h + cap,
        SLAB, shade(SLAB, 1.10));
      // And the drip: a darker line under the slab where the water runs off it.
      boxTS(a - 0.30, c + 0.30, s0 - 0.31, s0 - 0.24, y + h - 0.07, y + h,
        shade(SLAB, 0.78));
    };
    mass(tm, SAN.t1, SAN.s0, SAN.s1, 2.42, PINK, 0.24);
    mass(SAN.t0, tm + 0.02, SAN.s0 + 0.55, SAN.s1 - 0.55, 2.14, GREY, 0.18);

    // The damp band. Render this old is two colours from the ground up, and
    // the join is a stain and not a line.
    for (const [a, c, s, col] of [[tm, SAN.t1, SAN.s0, PINK],
      [SAN.t0, tm, SAN.s0 + 0.55, GREY]]) {
      for (let t = a; t < c; t += 0.9) {
        const t1 = Math.min(t + 0.9, c);
        const hh = 0.42 + jit(t | 0, 110) * 0.30;
        boxTS(t, t1, s - 0.025, s + 0.01, y - 0.35, y + hh, shade(col, 0.80));
      }
    }

    // Three louvred doors. A reveal, a leaf set back in it, and the louvres —
    // which are what make a door on a wall like this read at thirty metres.
    for (const td of [349.2, 352.3, 353.5]) {
      boxTS(td - 0.46, td + 0.46, SAN.s0 - 0.04, SAN.s0 + 0.14,
        y - 0.35, y + 2.06, [0.185, 0.150, 0.128]);
      boxTS(td - 0.40, td + 0.40, SAN.s0 + 0.02, SAN.s0 + 0.09,
        y - 0.02, y + 2.00, DOOR, shade(DOOR, 1.12));
      for (let i = 0; i < 16; i++) {
        const yy = y + 0.10 + i * 0.115;
        boxTS(td - 0.38, td + 0.38, SAN.s0 - 0.015, SAN.s0 + 0.03,
          yy, yy + 0.055, shade(DOOR, i % 2 ? 1.22 : 0.86));
      }
      // The frame, proud of the leaf on three sides.
      for (const o of [-0.42, 0.42]) {
        boxTS(td + o - 0.035, td + o + 0.035, SAN.s0 - 0.03, SAN.s0 + 0.06,
          y - 0.02, y + 2.06, shade(DOOR, 0.72));
      }
      boxTS(td - 0.46, td + 0.46, SAN.s0 - 0.03, SAN.s0 + 0.06,
        y + 2.00, y + 2.06, shade(DOOR, 0.72));
      // The step, worn hollow in the middle.
      b = deck;
      boxTS(td - 0.52, td + 0.52, SAN.s0 - 0.62, SAN.s0 + 0.02,
        y - 0.14, y + 0.02, shade(SLAB, 0.94), shade(SLAB, 1.04));
      b = up;
    }

    // The fire cabinet. Red, projecting, with two white squares on the doors
    // and a black hinge line down the middle.
    {
      const tf = 355.6;
      boxTS(tf - 0.56, tf + 0.56, SAN.s0 - 0.18, SAN.s0 + 0.02,
        y + 0.52, y + 1.66, RED, shade(RED, 1.14));
      boxTS(tf - 0.02, tf + 0.02, SAN.s0 - 0.19, SAN.s0 - 0.16,
        y + 0.54, y + 1.64, shade(RED, 0.55));
      for (const o of [-0.30, 0.30]) {
        boxTS(tf + o - 0.13, tf + o + 0.13, SAN.s0 - 0.20, SAN.s0 - 0.185,
          y + 1.24, y + 1.50, [0.860, 0.858, 0.848]);
      }
      // The handle, and the pipe stub coming out of the wall beside it.
      boxTS(tf + 0.44, tf + 0.50, SAN.s0 - 0.24, SAN.s0 - 0.18,
        y + 1.02, y + 1.14, [0.220, 0.220, 0.225]);
      post(W, tf + 0.86, SAN.s0 - 0.06, y + 0.30, y + 0.62, 0.045,
        [0.400, 0.402, 0.398], 6);
    }

    // The painted washing line. Six garments on a catenary, and it is painted
    // ON the wall — so it is flat against the render, a hair proud of it.
    {
      const a = 354.2, c = 357.0, top = y + 2.02, sag = 0.20;
      const yl = (u) => top - Math.sin(Math.PI * u) * sag;
      const N = 14;
      for (let i = 0; i < N; i++) {
        const u0 = i / N, u1 = (i + 1) / N;
        const t0 = a + (c - a) * u0, t1 = a + (c - a) * u1;
        boxTS(t0, t1, SAN.s0 - 0.022, SAN.s0 - 0.012, yl(u0) - 0.018, yl(u0) + 0.018,
          [0.290, 0.245, 0.220]);
      }
      const GARM = [[0.760, 0.735, 0.700], [0.700, 0.520, 0.520],
        [0.640, 0.612, 0.560], [0.560, 0.470, 0.520],
        [0.720, 0.700, 0.660], [0.600, 0.545, 0.505]];
      for (let i = 0; i < 6; i++) {
        const u = 0.10 + i * 0.155;
        const tg = a + (c - a) * u, ty = yl(u);
        const w = 0.16 + jit(i, 120) * 0.09, h = 0.30 + jit(i, 121) * 0.22;
        boxTS(tg - w, tg + w, SAN.s0 - 0.021, SAN.s0 - 0.014,
          ty - h, ty - 0.02, GARM[i]);
        // The peg.
        boxTS(tg - 0.03, tg + 0.03, SAN.s0 - 0.026, SAN.s0 - 0.016,
          ty - 0.05, ty + 0.07, [0.545, 0.470, 0.360]);
      }
    }

    // A high vent grille in the return, and the soil pipe on the back.
    boxTS(SAN.t1 - 0.05, SAN.t1 + 0.06, SAN.s0 + 1.4, SAN.s0 + 2.1,
      y + 1.70, y + 2.06, [0.150, 0.145, 0.138]);
    for (let i = 0; i < 5; i++) {
      boxTS(SAN.t1 + 0.02, SAN.t1 + 0.07, SAN.s0 + 1.44, SAN.s0 + 2.06,
        y + 1.74 + i * 0.07, y + 1.77 + i * 0.07, shade(PINK, 1.10));
    }
    post(W, SAN.t1 - 0.6, SAN.s1 + 0.14, y - 0.3, y + 2.60, 0.055,
      [0.400, 0.396, 0.386], 7);

    // The fish. Hung the way `endMural` hangs the gull — a quad a few
    // millimetres off the render with the paint's own alpha — and rotated the
    // way `shopSign` is, because this is a face across the shore and not a
    // gable along it.
    {
      const ft = 348.35, fs = SAN.s0 + 0.55;
      const st = at(ft), p = W(ft, fs - 0.008, y + 1.16);
      const mw = 1.55;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mw, mw),
        solidMaterial(0xffffff, {
          spec: 0.02, vcol: false, transparent: true, depthWrite: false,
          decl: 'uniform sampler2D uMuralMap;',
          body: 'vec4 mu = texture2D(uMuralMap, vUv);\nbase = mu.rgb;\nalpha = mu.a;',
          uniforms: { uMuralMap: { value: fishMural() } },
        }));
      mesh.position.set(p[0], p[1], p[2]);
      mesh.rotation.y = Math.atan2(-st.nx, -st.nz);
      scene.add(mesh);
    }

    runs.push({ t0: SAN.t0 - 0.4, t1: SAN.t1 + 0.4, s0: SAN.s0 - 0.4,
      s1: SAN.s1 + 0.4, y, h: 2.7 });
    b = back9;
  }
  // ── the playground ─────────────────────────────────────────────────────────
  //
  // a_160 films it from the top of the approach lane: a fenced compound on the
  // inland side, green artificial turf inside a dark green tubular railing,
  // and a climbing frame in blue steel with a red slide off it — orange, blue,
  // green and red, all of it, against the one green pad in five hundred metres
  // of limestone. It is the loudest object on the approach and the game had
  // nothing there.
  //
  // The railing in the frame is not mesh. It is tube: a top rail, a bottom
  // rail, uprights at a hand's width, and a row of loops welded along the foot
  // — the standard Croatian municipal park railing, and the loops are the half
  // of it anybody would recognise.
  {
    const back8 = b;
    const GRN = [0.055, 0.230, 0.130];        // the railing
    const TURF = [0.130, 0.330, 0.145];
    const BLUE = [0.075, 0.235, 0.520];
    const RED = [0.560, 0.115, 0.085];
    const YEL = [0.640, 0.500, 0.075];
    const ORA = [0.640, 0.320, 0.060];
    // The ground here, and not `surfaceY`.
    //
    // `surfaceY` returns the promenade deck for anything inside s = 33.1 and
    // only starts blending to the hill past that. Out at the west end the hill
    // has already come up by then, so a pad laid on `surfaceY` at s 29 is
    // laid a metre and a half UNDER the wood — which is where the first turf
    // went, visible only as a green sliver where the camera looked down a
    // slope. The higher of the two is what "on the ground" means out here.
    const yg = (t, s) => {
      const st = at(t);
      return Math.max(surfaceY(t, s),
        groundAt(st.x + st.nx * s, st.z + st.nz * s));
    };

    // The pad. Turf inside, and the limestone gravel apron the frame's feet
    // are actually bedded in.
    b = deck;
    for (let t = PLAY.t0; t < PLAY.t1; t += 2.2) {
      const t1 = Math.min(t + 2.2, PLAY.t1);
      for (let k = 0; k < 3; k++) {
        const a0 = PLAY.s0 + (PLAY.s1 - PLAY.s0) * (k / 3);
        const a1 = PLAY.s0 + (PLAY.s1 - PLAY.s0) * ((k + 1) / 3);
        const g = 0.94 + 0.12 * ((jit(t | 0, 90 + k) * 5) | 0) / 4;
        b.quad(W(t, a0, yg(t, a0) + 0.04), W(t1, a0, yg(t1, a0) + 0.04),
          W(t1, a1, yg(t1, a1) + 0.04), W(t, a1, yg(t, a1) + 0.04),
          [TURF[0] * g, TURF[1] * g, TURF[2] * g]);
      }
    }
    b = up;

    // The railing. Posts, two rails, uprights, and the loops.
    const rail = (t0, t1, s, gapT) => {
      const h = 1.06;
      for (let t = t0; t <= t1 + 0.01; t += 2.4) {
        if (gapT && Math.abs(t - gapT) < 1.5) continue;
        post(W, t, s, yg(t, s) - 0.2, yg(t, s) + h + 0.06, 0.045, GRN, 6);
      }
      for (const yy of [0.30, h]) {
        for (let t = t0; t < t1; t += 1.2) {
          const t1b = Math.min(t + 1.2, t1);
          if (gapT && t > gapT - 1.5 && t < gapT + 1.5) continue;
          boxTS(t, t1b, s - 0.028, s + 0.028,
            yg(t, s) + yy - 0.028, yg(t, s) + yy + 0.028, GRN);
        }
      }
      for (let t = t0 + 0.12; t < t1; t += 0.145) {
        if (gapT && t > gapT - 1.5 && t < gapT + 1.5) continue;
        boxTS(t - 0.016, t + 0.016, s - 0.016, s + 0.016,
          yg(t, s) + 0.30, yg(t, s) + h, GRN);
      }
      // The loop row: a half-round in each bay, standing on the bottom rail.
      for (let t = t0 + 0.6; t < t1 - 0.3; t += 1.2) {
        if (gapT && t > gapT - 1.5 && t < gapT + 1.5) continue;
        const y = yg(t, s);
        for (let i = 0; i < 7; i++) {
          const a0 = Math.PI * (i / 7), a1 = Math.PI * ((i + 1) / 7);
          const R = 0.30;
          boxTS(t + Math.cos(a0) * R - 0.02, t + Math.cos(a0) * R + 0.02,
            s - 0.02, s + 0.02,
            y + 0.30 - Math.sin(a0) * R * 0.0,
            y + 0.30 - 0.0, GRN);
          b.quad(W(t + Math.cos(a0) * R, s - 0.022, y + 0.30 - Math.sin(a0) * R),
            W(t + Math.cos(a1) * R, s - 0.022, y + 0.30 - Math.sin(a1) * R),
            W(t + Math.cos(a1) * R, s + 0.022, y + 0.30 - Math.sin(a1) * R),
            W(t + Math.cos(a0) * R, s + 0.022, y + 0.30 - Math.sin(a0) * R), GRN);
        }
      }
    };
    const railS = (s0, s1, t) => {
      const h = 1.06;
      for (let s = s0; s <= s1 + 0.01; s += 2.4) {
        post(W, t, s, yg(t, s) - 0.2, yg(t, s) + h + 0.06, 0.045, GRN, 6);
      }
      for (const yy of [0.30, h]) {
        boxTS(t - 0.028, t + 0.028, s0, s1,
          yg(t, s0) + yy - 0.028, yg(t, s0) + yy + 0.028, GRN);
      }
      for (let s = s0 + 0.12; s < s1; s += 0.145) {
        boxTS(t - 0.016, t + 0.016, s - 0.016, s + 0.016,
          yg(t, s) + 0.30, yg(t, s) + h, GRN);
      }
    };
    rail(PLAY.t0, PLAY.t1, PLAY.s0, PLAY.t0 + 5.5);
    rail(PLAY.t0, PLAY.t1, PLAY.s1, null);
    railS(PLAY.s0, PLAY.s1, PLAY.t0);
    railS(PLAY.s0, PLAY.s1, PLAY.t1);

    // The climbing frame. Four blue legs, a deck at 1.30, a red pitched roof
    // over it, a ladder up one side and the slide off the other.
    const ct = PLAY.t0 + 8.5, cs = PLAY.s0 + 3.2;
    const cy = yg(ct, cs);
    for (const [ot, os] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) {
      post(W, ct + ot, cs + os, cy - 0.25, cy + 2.34, 0.058, BLUE, 6);
    }
    boxTS(ct - 0.92, ct + 0.92, cs - 0.92, cs + 0.92, cy + 1.24, cy + 1.32,
      YEL, [0.700, 0.560, 0.110]);
    // The rails round three sides of the deck, so it is a platform and not a
    // shelf.
    for (const [a, c, s0, s1] of [[ct - 0.92, ct + 0.92, cs - 0.92, cs - 0.86],
      [ct - 0.92, ct - 0.86, cs - 0.92, cs + 0.92],
      [ct + 0.86, ct + 0.92, cs - 0.92, cs + 0.92]]) {
      boxTS(a, c, s0, s1, cy + 1.32, cy + 1.86, ORA, shade(ORA, 1.10));
    }
    frustumTS(cy + 2.34, [ct, cs, 1.06, 1.06], cy + 2.86, [ct, cs, 0.10, 0.10],
      RED, shade(RED, 1.12));
    // The ladder, on the inland face.
    for (const o of [-0.34, 0.34]) {
      post(W, ct + o, cs + 1.55, cy, cy + 1.34, 0.035, GRN, 5);
    }
    for (let i = 0; i < 4; i++) {
      const yy = cy + 0.28 + i * 0.30;
      boxTS(ct - 0.36, ct + 0.36, cs + 1.50, cs + 1.60, yy, yy + 0.05, YEL);
    }
    boxTS(ct - 0.38, ct + 0.38, cs + 0.90, cs + 1.58, cy + 1.30, cy + 1.36,
      shade(YEL, 0.92));
    // The slide: a bed falling from the deck to the turf, with a rail either
    // side and a kick at the bottom. Quads, because a box cannot fall.
    {
      const sa = cs - 0.90, sb = cs - 3.30;
      const ya = cy + 1.26, yb = cy + 0.30;
      const q = (o0, o1, col) => b.quad(
        W(ct + o0, sa, ya), W(ct + o1, sa, ya),
        W(ct + o1, sb, yb), W(ct + o0, sb, yb), col);
      q(-0.34, 0.34, RED);
      for (const o of [-0.36, 0.36]) {
        b.quad(W(ct + o, sa, ya), W(ct + o, sa, ya + 0.22),
          W(ct + o, sb, yb + 0.22), W(ct + o, sb, yb), shade(RED, 0.88));
        b.quad(W(ct + o, sb, yb), W(ct + o, sb, yb + 0.22),
          W(ct + o, sa, ya + 0.22), W(ct + o, sa, ya), shade(RED, 1.10));
      }
      boxTS(ct - 0.38, ct + 0.38, sb - 0.55, sb + 0.02, cy + 0.24, cy + 0.32,
        RED, shade(RED, 1.14));
      for (const o of [-0.30, 0.30]) {
        post(W, ct + o, sb - 0.30, cy, cy + 0.26, 0.035, BLUE, 5);
      }
    }
    // The monkey bars, running off the frame to a second pair of legs.
    {
      const mt = ct + 3.4;
      for (const os of [-0.62, 0.62]) {
        post(W, mt, cs + os, cy - 0.25, cy + 2.10, 0.052, BLUE, 6);
        boxTS(ct + 0.85, mt, cs + os - 0.035, cs + os + 0.035,
          cy + 2.02, cy + 2.10, GRN);
      }
      for (let t = ct + 1.15; t < mt; t += 0.36) {
        boxTS(t - 0.022, t + 0.022, cs - 0.64, cs + 0.64,
          cy + 2.02, cy + 2.06, YEL);
      }
    }

    // The swing frame: two A-legs, a top bar and two seats on chains.
    {
      const st = PLAY.t1 - 4.6, ss = PLAY.s0 + 4.6, sy = yg(st, ss);
      for (const ot of [-1.55, 1.55]) {
        for (const os of [-0.95, 0.95]) {
          frustumTS(sy - 0.2, [st + ot + (os > 0 ? 0.02 : -0.02), ss + os, 0.05, 0.05],
            sy + 2.24, [st + ot, ss, 0.045, 0.045], BLUE);
        }
      }
      boxTS(st - 1.70, st + 1.70, ss - 0.055, ss + 0.055,
        sy + 2.20, sy + 2.30, GRN, shade(GRN, 1.14));
      for (const ot of [-0.72, 0.72]) {
        for (const o2 of [-0.19, 0.19]) {
          post(W, st + ot + o2, ss, sy + 0.56, sy + 2.20, 0.012,
            [0.480, 0.484, 0.480], 4);
        }
        boxTS(st + ot - 0.24, st + ot + 0.24, ss - 0.10, ss + 0.10,
          sy + 0.52, sy + 0.58, ot < 0 ? RED : YEL);
      }
    }

    // A spring rider, which is the one thing on a Croatian park pad that is
    // never the same twice and is always yellow.
    {
      const rt = PLAY.t0 + 3.2, rs = PLAY.s0 + 6.4, ry = yg(rt, rs);
      post(W, rt, rs, ry, ry + 0.40, 0.075, [0.500, 0.505, 0.500], 6);
      boxTS(rt - 0.62, rt + 0.62, rs - 0.20, rs + 0.20, ry + 0.40, ry + 0.62,
        YEL, shade(YEL, 1.10));
      boxTS(rt - 0.10, rt + 0.10, rs - 0.30, rs + 0.30, ry + 0.62, ry + 0.94,
        ORA);
      boxTS(rt - 0.26, rt + 0.26, rs - 0.10, rs + 0.10, ry + 0.88, ry + 0.94,
        [0.500, 0.505, 0.500]);
    }

    // And a bench inside the railing, facing the frame, because somebody has
    // to sit there for two hours.
    solid(PLAY.t0 + 13.5, PLAY.s1 - 1.4, 0, [0.330, 0.145, 0.095], 0.9);
    b = back8;
  }

  // The stand behind the promenade, which the second walk-through films from
  // the inside and which was, until now, a hedge.
  //
  // Four numbers, all of them wrong together. It was one tree every six to
  // fifteen metres in a five-metre strip — a line of trees along the back of a
  // beach. What is there is thirty to forty metres deep, open enough to walk
  // through in any direction, and dense enough that the crowns close over you:
  // no undergrowth at all, bare needle floor with cones on it, and the trunks
  // going up like columns. Roughly one tree per fifty square metres, which is
  // about four times what stood here.
  //
  // And the mix was wrong. The olive appears exactly twice as a tree in 260 m
  // of promenade, both times inside a cafe's own lawn; the tree at the edge of
  // the concrete is tamarisk. `olive()` is retuned rather than replaced —
  // the shape is close and a second builder is a second thing to keep in step.
  for (let t = 5; t < LEN - 5; t += 3.4 + rng() * 3.6) {
    if (!clearOfShops(t)) continue;
    for (let row = 0; row < 3; row++) {
      if (row && rng() < 0.28) continue;
      // Also held inside the 39 m band. Three rows at 10.5 m spacing reached
      // s 59, which is well into the OSM footprints, and a pine growing up
      // through a roof is the same bug as a car parked in a hall.
      const s = JAD.rowB + 2.2 + row * 3.4 + rng() * 3.0;
      // Not inside the playground railing either — a pine growing up through
      // the climbing frame is the same bug as one growing through a roof.
      if (t > PLAY.t0 - 1.5 && t < PLAY.t1 + 1.5
        && s > PLAY.s0 - 1.5 && s < PLAY.s1 + 1.5) continue;
      if (t > SAN.t0 - 1.5 && t < SAN.t1 + 1.5
        && s > SAN.s0 - 1.5 && s < SAN.s1 + 1.5) continue;
      // Not through the vikendica, which stands out here now and is 6.8 by 7.7
      // of the strip these were planted along.
      if (Math.hypot(t - VIK.t, s - VIK.s) < 8.5) continue;
      const y = surfaceY(t, s);
      const r = rng();
      if (r < 0.72) {
        // Leaning seaward — negative s is the water — by a shared bias.
        pine(t, s, y, 9.0 + rng() * 5.5, -1);
        greens.push([t, s, 0.42, 9]);
      } else if (r < 0.86) {
        olive(t, s, y, 3.8 + rng() * 1.8);
        greens.push([t, s, 0.50, 5]);
      } else {
        oleander(t, s, y, 0.85 + rng() * 0.55);
      }
    }
  }
  // The young ones, staked in a gravel square cut through the concrete. Four
  // photographs and two frames of the walk have these, continuing east as an
  // avenue, and they are the one piece of planting on this shore that somebody
  // is clearly still looking after.
  for (let t = 26; t < LEN - 26; t += 34 + rng() * 22) {
    if (!clearOfShops(t)) continue;
    const s = JAD.mid + 2.2;
    const y = surfaceY(t, s);
    b = deck;
    boxTS(t - 0.60, t + 0.60, s - 0.60, s + 0.60, y - 0.05, y + 0.02,
      [0.470, 0.430, 0.360], [0.505, 0.462, 0.388]);
    b = up;
    pine(t, s, y, 4.2 + rng() * 0.8, -1);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.4;
      post(facing(t, s, 0), Math.cos(a) * 0.45, Math.sin(a) * 0.45,
        y, y + 2.5, 0.035, [0.620, 0.520, 0.360], 5);
    }
    greens.push([t, s, 0.30, 4]);
  }
  // ── the lane wall ──────────────────────────────────────────────────────────
  //
  // b_090 and a_160 both open on it and a_030 has it again behind the houses:
  // a low white rendered wall with a dressed limestone coping, 0.8-1.0 m, with
  // planters standing on it. a_160 calls it what it is — "the boundary element
  // of the whole approach" — and the game had nothing at all between the back
  // of the shops and the trees. Filmed from the wood that band was one bare
  // orange expanse five hundred metres long.
  //
  // It runs at s 29.2, which is where it can run: the shop rears now stop at
  // 27.2 and the first cars stand at 31.5, so the wall divides the two the way
  // it does in the footage — the resort on one side of it, what you arrived in
  // on the other.
  const WALL = { s: 29.2, w: 0.135, h: 0.86, cap: 0.115, capOut: 0.075 };
  {
    const REND = [0.615, 0.600, 0.568];
    const CAP = [0.545, 0.528, 0.482];
    // The higher of the concrete and the hill, and this is the THIRD time this
    // datum has bitten in this file — the playground turf went under the wood
    // for exactly the same reason. `surfaceY` returns the promenade deck for
    // anything inside s 33.1, and west of the businesses the hill has already
    // come up by s 29.2, so a wall built on it is a wall buried in the bank.
    const yAt = (t) => {
      const st = at(t);
      return Math.max(surfaceY(t, WALL.s),
        groundAt(st.x + st.nx * WALL.s, st.z + st.nz * WALL.s));
    };
    // Where it stops.
    //
    // Not "at every shop", which is what the first cut said and which took
    // forty metres of wall out in one piece: h2o and the Slasticarnica stand
    // end to end and `clearOfShops` opens two and a half metres either side of
    // each, so the whole middle of the resort — the part everybody looks at —
    // came out with no wall at all. A wall stops where something is standing
    // ON it, and the shop rears now stop at s 27.2, which is two metres clear.
    // So the test is whether the building crosses the line, plus a delivery
    // opening opposite each back door, plus the mole and the plaza, which are
    // where the crowd crosses the band.
    const crosses = (t) => SHOPS.some((S) => t > S.t0 - 1.8 && t < S.t1 + 1.8
      && S.s0 - (S.awn || 0) - 1.0 < WALL.s + 0.7 && S.s1 + 1.0 > WALL.s - 0.7);
    const doorway = (t) => SHOPS.some((S) => S.kind === 'box'
      && Math.abs(t - (S.t0 + (S.t1 - S.t0) * 0.33)) < 2.2);
    const gap = (t) => crosses(t) || doorway(t)
      || (t > JET.t - 12 && t < JET.t + 12)
      || (t > PLAZA.t0 - 8 && t < PLAZA.t1 + 8)
      || (t > VIK.t - 12 && t < VIK.t + 12);
    const step = 2.4;
    let run0 = null;
    for (let t = 300; t < LEN - 14 + step; t += step) {
      const t1 = Math.min(t + step, LEN - 14);
      const open = gap(t) || gap(t1) || t >= LEN - 14;
      if (!open) {
        const y0 = yAt(t), y1 = yAt(t1);
        const sa = WALL.s - WALL.w, sb = WALL.s + WALL.w;
        // Panel. Built as quads rather than as a box per bay, for the reason
        // the plaza was: a box takes the average of its own two ends and the
        // run comes out stepped over ground that falls a metre in fifty.
        const q = (s, ya, yb, ha, hb, col) => b.quad(
          W(t, s, ya), W(t1, s, yb), W(t1, s, hb), W(t, s, ha), col);
        q(sa, y0 - 0.30, y1 - 0.30, y0 + WALL.h, y1 + WALL.h, REND);
        b.quad(W(t1, sb, y1 - 0.30), W(t, sb, y0 - 0.30),
          W(t, sb, y0 + WALL.h), W(t1, sb, y1 + WALL.h), shade(REND, 0.93));
        // The coping: a course of dressed blocks, proud of the render on both
        // faces, laid one to a bay so the joints read.
        const ca = WALL.s - WALL.w - WALL.capOut, cb = WALL.s + WALL.w + WALL.capOut;
        const k = 0.96 + 0.08 * ((t | 0) % 5) / 4;
        const C2 = [CAP[0] * k, CAP[1] * k, CAP[2] * k];
        b.quad(W(t, ca, y0 + WALL.h), W(t1, ca, y1 + WALL.h),
          W(t1, cb, y1 + WALL.h), W(t, cb, y0 + WALL.h), shade(C2, 0.92));
        b.quad(W(t, ca, y0 + WALL.h + WALL.cap), W(t1, ca, y1 + WALL.h + WALL.cap),
          W(t1, cb, y1 + WALL.h + WALL.cap), W(t, cb, y0 + WALL.h + WALL.cap),
          shade(C2, 1.06));
        b.quad(W(t, ca, y0 + WALL.h), W(t1, ca, y1 + WALL.h),
          W(t1, ca, y1 + WALL.h + WALL.cap), W(t, ca, y0 + WALL.h + WALL.cap), C2);
        b.quad(W(t1, cb, y1 + WALL.h), W(t, cb, y0 + WALL.h),
          W(t, cb, y0 + WALL.h + WALL.cap), W(t1, cb, y1 + WALL.h + WALL.cap),
          shade(C2, 0.95));
        if (run0 === null) run0 = t;
      } else if (run0 !== null) {
        // A return at each end, so the run stops on a face and not on a hole.
        for (const te of [run0, t]) {
          boxTS(te - 0.16, te + 0.16, WALL.s - 0.24, WALL.s + 0.24,
            yAt(te) - 0.3, yAt(te) + WALL.h + WALL.cap + 0.06,
            shade(REND, 0.97), shade(CAP, 1.02));
        }
        runs.push({ t0: run0, t1: t, s0: WALL.s - 0.4, s1: WALL.s + 0.4,
          y: yAt(run0), h: WALL.h });
        run0 = null;
      }
    }

    // The track itself. a_075 films the floor of the stand: bare needle litter,
    // orange-brown, with white limestone chips through it — and where the cars
    // stand it is worn down to the dust. Drawn into the ground buffer at three
    // centimetres, because it is a wear pattern and not a pavement: nobody
    // laid this, it is simply where everybody drives.
    {
      const back7 = b;
      b = deck;
      const DUST = [[0.520, 0.470, 0.392], [0.545, 0.492, 0.410],
        [0.498, 0.452, 0.378], [0.560, 0.508, 0.428]];
      const s0 = WALL.s + 1.6, s1 = WALL.s + 7.4;
      const step = 2.6, nS = 3;
      for (let t = 214; t < LEN - 14; t += step) {
        const t1 = Math.min(t + step, LEN - 14);
        for (let k = 0; k < nS; k++) {
          const a0 = s0 + (s1 - s0) * (k / nS)
            + (jit(t | 0, 40 + k) - 0.5) * 0.9;
          const a1 = k === nS - 1 ? s1 : s0 + (s1 - s0) * ((k + 1) / nS)
            + (jit(t | 0, 41 + k) - 0.5) * 0.9;
          const c = DUST[((jit(t | 0, 50 + k) * 97) | 0) % DUST.length];
          b.quad(W(t, a0, surfaceY(t, a0) + 0.03),
            W(t1, a0, surfaceY(t1, a0) + 0.03),
            W(t1, a1, surfaceY(t1, a1) + 0.03),
            W(t, a1, surfaceY(t, a1) + 0.03), c);
        }
      }
      // And the chips. White limestone, the size of a fist, thrown up out of
      // the dust wherever a tyre has turned on it.
      b = up;
      for (let t = 215; t < LEN - 15; t += 1.35) {
        if (jit(t | 0, 55) > 0.62) continue;
        const s = s0 + jit(t * 3 | 0, 56) * (s1 - s0);
        const y = surfaceY(t, s);
        const r = 0.055 + jit(t | 0, 57) * 0.055;
        const g = 0.760 + jit(t | 0, 58) * 0.110;
        post(W, t + jit(t | 0, 59) * 0.6, s, y - r * 0.4, y + r * 0.9, r,
          [g, g * 0.985, g * 0.930], 5);
      }
      b = back7;
    }

    // ── and west of t 300 it is not a wall at all ────────────────────────
    //
    // b_061 films the approach lane straight up it, and what stands along the
    // edge there is a RUN OF SHORT DRY-STONE PIERS: two metres of rubble
    // limestone, a gap of a metre and a half, then the next one, each capped
    // with its own dressed slab oversailing on both faces. Not render, and not
    // continuous. 175447 has the smooth white rendered wall with the flat cap
    // — but that is up by Maslina, three hundred metres east of here, and both
    // are on this shore.
    //
    // So the run is rubble piers west of 300 and rendered wall east of it, and
    // the join is where the businesses start, which is where the resort stops
    // being an approach and starts being a promenade.
    for (let t = 216; t < 299; t += 3.5) {
      const a = t, c = t + 2.0;
      if (gap(a) || gap(c)) continue;
      const y0 = yAt(a), y1 = yAt(c);
      const h = 0.82 + jit(t | 0, 60) * 0.10;
      // The core, which is only ever seen through the gaps between the stones.
      // Dark, because what shows between the stones is mortar in shadow and
      // not more wall: at 0.47 the gaps read as the same surface and the whole
      // pier came out a flat grey band.
      const core = [0.330, 0.315, 0.288];
      boxTS(a, c, WALL.s - 0.16, WALL.s + 0.16, y0 - 0.30,
        Math.max(y0, y1) + h - 0.02, core, shade(core, 1.06));
      // The rubble. Every stone turned on its own axis and none of them the
      // same size — a course of identical blocks is masonry, and this is a
      // field wall somebody built out of what was lying there.
      for (let k = 0; k < 40; k++) {
        const u = jit(t * 7 + k, 61);
        const st2 = a + 0.10 + u * (c - a - 0.20);
        const face = k % 2 ? WALL.s + 0.14 : WALL.s - 0.14;
        // 0.055 m of relief is nothing at three metres. A rubble wall stands
        // a hand's breadth proud of its own mortar.
        const out = k % 2 ? 0.105 : -0.105;
        const yy = y0 - 0.22 + jit(t * 7 + k, 62) * (h + 0.18);
        const r = 0.105 + jit(t * 7 + k, 63) * 0.095;
        const g = 0.78 + jit(t * 7 + k, 64) * 0.44;
        // A frustum, not a box: a box has four parallel sides and reads as
        // brick however it is coloured. Same lesson as the rip-rap.
        frustumTS(yy, [st2, face + out * 0.30, r * 0.92, 0.075],
          yy + r * 1.4, [st2 + (jit(t * 7 + k, 65) - 0.5) * 0.07,
            face + out, r * 0.70, 0.085],
          [0.575 * g, 0.556 * g, 0.508 * g],
          [0.605 * g, 0.586 * g, 0.535 * g]);
      }
      // The dressed cap, oversailing both faces, which is the one straight
      // line on the whole thing.
      const cy = Math.max(y0, y1) + h;
      boxTS(a - 0.08, c + 0.08, WALL.s - 0.29, WALL.s + 0.29, cy - 0.04,
        cy + 0.11, [0.585, 0.566, 0.518], [0.625, 0.606, 0.556]);
      runs.push({ t0: a, t1: c, s0: WALL.s - 0.32, s1: WALL.s + 0.32,
        y: y0, h });
    }

    // ── and west of the piers it is a retaining wall ──────────────────────
    //
    // b_016 films the west end from inside the pine stand, and it settles what
    // happens where the resort runs out. The wood floor is a good metre below
    // the lane behind it, and what holds the one off the other is a wall of
    // SAWN limestone blocks: coursed, four or five courses, joints straight
    // and level, a wide flat top — and it comes down the slope in STEPS. That
    // last part is the whole character of it. A wall that follows a falling
    // grade is a ramp with a face on it; a mason building a retaining wall
    // levels each length and steps at the joint, and the steps are what you
    // see from below.
    //
    // So the boundary is three treatments along one edge and every one of them
    // is in the footage: ashlar in the wood, rubble piers on the approach,
    // rendered wall with a coping through the businesses. That is not
    // inconsistency, it is a place that was built in three goes.
    {
      const RUN = 6.4, AW = 0.175;
      const gAt = (t, s) => {
        const st = at(t);
        return Math.max(surfaceY(t, s),
          groundAt(st.x + st.nx * s, st.z + st.nz * s));
      };
      const CORE = [0.352, 0.330, 0.288];
      for (let t0 = 24; t0 < 214; t0 += RUN) {
        const t1 = Math.min(t0 + RUN - 0.22, 214);
        if (gap(t0) || gap(t1)) continue;
        // The top is level over the run and steps at the joint: the highest
        // ground it retains, taken in 0.18 m stages so the step reads as a
        // step and not as a wobble.
        let hi = -1e9, lo = 1e9;
        for (let u = t0; u <= t1; u += 0.7) {
          hi = Math.max(hi, gAt(u, WALL.s + 1.5));
          lo = Math.min(lo, gAt(u, WALL.s - 1.7));
        }
        const base = lo - 0.30;
        // A floor under the height, and this is the difference between a wall
        // and nothing at all. Taking the top purely off the ground it retains
        // meant that wherever the deck was flat — which is most of the wood —
        // the run came out under half a metre and was skipped, and the whole
        // west end shipped with a kerb. b_016 has a wall there whatever the
        // grade does: it is a BOUNDARY that also retains, and it stands 0.9 m
        // out of the needle floor even where there is no bank behind it.
        const top = Math.min(
          Math.max(Math.round(hi / 0.18) * 0.18 + 0.07, base + 0.80),
          base + 2.0);
        // The core, seen only through the joints, and dark for the reason the
        // piers' was: at anything paler the joints read as more wall.
        boxTS(t0, t1, WALL.s - 0.10, WALL.s + 0.10, base, top - 0.02,
          CORE, shade(CORE, 1.05));
        // The courses. Sawn blocks ARE the thing a box is right for — the
        // frustum rule is for rubble, where four parallel sides read as brick.
        // Here they are supposed to.
        // 0.21 m courses came out as three fat bands. The frame has four or
        // five courses in under a metre, so the course is 0.17 and the joint
        // between them is a fifth of it — a joint you cannot see is a wall
        // with lines painted on it.
        let course = 0;
        for (let y = base; y < top - 0.09; y += 0.172, course++) {
          const yt = Math.min(y + 0.136, top - 0.02);
          // Half-lap: every second course starts on a half block, which is how
          // the joints in the frame break and the one thing that stops a wall
          // of equal blocks reading as a printed texture.
          let u = t0 + (course % 2 ? 0.28 : 0.0);
          for (let k = 0; u < t1 - 0.06; k++) {
            const L = 0.40 + jit(course * 31 + k + (t0 | 0), 70) * 0.30;
            const u1 = Math.min(u + L, t1);
            // +-8% was not enough to tell one block from the next at eight
            // metres and the run came out as one grey surface. Limestone cut
            // out of the same quarry still varies by more than that, and the
            // colour is WARM: the first cut was grey and sat in the shot
            // looking like poured concrete.
            const g = 0.86 + jit(course * 31 + k + (t0 | 0), 71) * 0.30;
            const col = [0.618 * g, 0.566 * g, 0.452 * g];
            // A hair of relief per block, in and out, so the face is not a
            // plane with lines drawn on it.
            const o = (jit(course * 31 + k + (t0 | 0), 72) - 0.5) * 0.035;
            boxTS(u + 0.055, u1 - 0.055, WALL.s - AW - o, WALL.s + AW + o,
              y + 0.018, yt, col, shade(col, 1.07));
            u = u1;
          }
        }
        // The flat top, oversailing the face, which is the line the eye
        // follows down the steps.
        boxTS(t0 - 0.06, t1 + 0.06, WALL.s - AW - 0.085, WALL.s + AW + 0.085,
          top - 0.055, top + 0.055,
          [0.575, 0.542, 0.468], [0.640, 0.605, 0.525]);
        runs.push({ t0, t1, s0: WALL.s - 0.34, s1: WALL.s + 0.34,
          y: base, h: top - base });
      }
    }

    // The planters. Terracotta, standing ON the coping, with something in
    // flower in them — which is the detail that makes it a wall somebody
    // maintains rather than a barrier somebody poured.
    // East of 300 only: the piers on the approach are bare in b_061, and a
    // planter standing in one of the gaps between them would be standing on
    // nothing.
    for (let t = 303; t < LEN - 18; t += 11.4) {
      if (gap(t)) continue;
      const y = yAt(t) + WALL.h + WALL.cap;
      const kind = jit(t | 0, 31);
      const POT = kind < 0.6 ? [0.545, 0.290, 0.180] : [0.505, 0.492, 0.462];
      frustumTS(y, [t, WALL.s, 0.20, 0.20], y + 0.34, [t, WALL.s, 0.26, 0.26],
        POT, shade(POT, 1.08));
      boxTS(t - 0.27, t + 0.27, WALL.s - 0.27, WALL.s + 0.27,
        y + 0.34, y + 0.40, shade(POT, 1.12), shade(POT, 0.72));
      if (kind < 0.45) oleander(t, WALL.s, y + 0.36, 0.30 + jit(t | 0, 32) * 0.14);
      else agave(t, WALL.s, y + 0.38, 0.26 + jit(t | 0, 33) * 0.10);
    }

    // Ivy over the wall. b_181 has a whole green wall of it behind the
    // Slasticarnica's terrace — creeper grown right over a rendered wall and
    // hanging past the coping — and it is the only large soft mass anywhere on
    // this side of the resort. Two runs, because a creeper is a plant and not
    // a treatment: it is where somebody planted one and nowhere else.
    for (const [ia, ic] of [[300.5, 311.0], [326.0, 339.0], [404.0, 413.5]]) {
      const IDK = [0.062, 0.130, 0.058], ILT = [0.170, 0.320, 0.145];
      // Stepped at 0.28 m with radii of 0.34-0.54, which is the whole of
      // whether this reads as creeper or as a row of Christmas trees. The
      // first cut stepped at 0.62 with r 0.24 and every puff stood alone: a
      // creeper is one continuous mass with lumps in it, so the puffs have to
      // overlap by more than half.
      for (let t = ia; t < ic; t += 0.28) {
        if (gap(t)) continue;
        const y = yAt(t) + WALL.h + WALL.cap;
        const k = (t * 11) | 0;
        const r = 0.27 + jit(k, 34) * 0.15;
        const P = facing(t, WALL.s - 0.04, 0);
        // `puff` takes the VERTICAL radius before the horizontal one, and
        // getting that round the wrong way is what turned the first two
        // attempts into a row of Christmas trees: a creeper is flatter than it
        // is wide by a factor of three, so ry is a third of r and not double.
        puff(P, 0, (jit(k, 35) - 0.5) * 0.26, y + r * 0.10,
          r * 0.40, r * 1.30, IDK, ILT, [y - 1.0, y + r * 0.6],
          6, 2, 0.42, k);
        // And down the seaward face, in two courses, which is the half you
        // see from the promenade.
        for (let d = 0; d < 2; d++) {
          const drop = 0.24 + d * 0.30 + jit(k, 36 + d) * 0.18;
          puff(P, (jit(k, 38 + d) - 0.5) * 0.30, -0.12, y - drop,
            r * 0.40, r * 0.58, IDK, ILT, [y - 1.2, y + 0.2],
            5, 2, 0.38, k + 3 + d);
        }
      }
    }

    // The other lamp. a_160 films two types and the game had only the tall
    // cranked column: this is the short post with the white sphere on it, and
    // it belongs on the lane side rather than over the walk.
    for (let t = 226; t < LEN - 20; t += 24.5) {
      if (gap(t)) continue;
      const s = WALL.s + 1.15;
      const y = surfaceY(t, s);
      post(W, t, s, y, y + 0.16, 0.115, [0.300, 0.302, 0.298], 8);
      post(W, t, s, y + 0.16, y + 2.92, 0.052, [0.300, 0.302, 0.298], 7);
      // A sphere is two hemispheres, and a negative height on `dome` is the
      // bottom one.
      const gy = y + 3.12;
      dome(W, t, s, gy, 0.20, 0.20, [0.760, 0.752, 0.720], 9);
      dome(W, t, s, gy, -0.20, 0.20, [0.700, 0.694, 0.668], 9);
      post(W, t, s, y + 2.92, gy, 0.055, [0.300, 0.302, 0.298], 7);
    }
  }

  // ── towels, cones, flags, bicycles ─────────────────────────────────────────
  //
  // Four small things the survey keeps showing and the shore did not have.
  // Placed off `jit` rather than `rng` for the reason `clutter` and `paving`
  // are: this runs after the whole beach has been laid out and taking draws
  // off that stream would move every bather, parasol and hut on it.
  {
    const back11 = b;

    // A towel on bare concrete is the commonest thing in the whole survey.
    // Not a lounger — a towel, laid straight on the slab, with somebody on it
    // or their things on it, and it is what the middle terrace is for.
    const TOWEL = [[0.600, 0.180, 0.160], [0.155, 0.330, 0.560],
      [0.700, 0.640, 0.240], [0.720, 0.716, 0.690],
      [0.190, 0.460, 0.350], [0.660, 0.400, 0.520]];
    for (let t = JAD.beachTo + 5; t < LEN - 8; t += 4.6) {
      const k = t | 0;
      if (jit(k, 200) > 0.72) continue;
      if (!clearOfShops(t) || onMoleT(t) || onPlazaT(t)) continue;
      const s = 1.5 + jit(k, 201) * 5.4;
      const y = surfaceY(t, s);
      const ang = (jit(k, 202) - 0.5) * 0.5;
      const col = TOWEL[((jit(k, 203) * 97) | 0) % TOWEL.length];
      // Three panels at slightly different heights and widths, so it lies on
      // the slab like cloth rather than like a mat somebody cut out.
      b = deck;
      for (let i = 0; i < 3; i++) {
        const ds = -0.62 + i * 0.42;
        const wob = (jit(k, 210 + i) - 0.5) * 0.10;
        const P = facing(t, s, ang);
        const q = (dt, ds2, yy) => P(dt, ds2, yy);
        const hw = 0.34 + wob;
        b.quad(q(-hw, ds, y + 0.012 + wob * 0.05),
          q(hw, ds, y + 0.012 - wob * 0.05),
          q(hw, ds + 0.44, y + 0.012 + wob * 0.04),
          q(-hw, ds + 0.44, y + 0.012 - wob * 0.04),
          i === 1 ? col : shade(col, 0.92));
      }
      b = up;
      // And what is on it. Somebody on four out of ten, their bag on the rest.
      if (jit(k, 204) < 0.42) {
        B(t, s - 0.55, y + 0.06, -Math.PI / 2 + ang, 'lie', 1);
      } else {
        clutter(t + 0.5, s + 0.55, y, 2, k * 5 + 3);
      }
    }

    // Under the pines: cones and the coarse litter that is not needles. The
    // floor of that stand is the best reference photograph in the survey and
    // it is not bare — it is orange-brown duff with cones and white limestone
    // chips lying in it.
    b = up;
    for (let t = 8; t < LEN - 8; t += 1.9) {
      const k = t | 0;
      if (jit(k, 220) > 0.55) continue;
      const s = JAD.rowB + 2.4 + jit(k, 221) * 10.5;
      if (t > PLAY.t0 - 2 && t < PLAY.t1 + 2
        && s > PLAY.s0 - 2 && s < PLAY.s1 + 2) continue;
      if (t > SAN.t0 - 2 && t < SAN.t1 + 2
        && s > SAN.s0 - 2 && s < SAN.s1 + 2) continue;
      const y = surfaceY(t, s);
      const n = 1 + ((jit(k, 222) * 3) | 0);
      for (let i = 0; i < n; i++) {
        const dt = (jit(k, 230 + i) - 0.5) * 1.6;
        const ds = (jit(k, 240 + i) - 0.5) * 1.6;
        const r = 0.036 + jit(k, 250 + i) * 0.022;
        const g = 0.30 + jit(k, 260 + i) * 0.13;
        // A cone is a stack, not a ball: wide at the base, tapering, and lying
        // on its side as often as not.
        frustumTS(y, [t + dt, s + ds, r * 1.15, r * 1.15],
          y + r * 2.2, [t + dt, s + ds, r * 0.35, r * 0.35],
          [g, g * 0.80, g * 0.52], [g * 1.1, g * 0.86, g * 0.56]);
      }
    }

    // The flags on the quay column at the root of the mole. Lifeguard yellow
    // and scarlet, the pair that is up on every frame of the survey, held out
    // by the wind that is always across this channel.
    {
      const ft = JET.t - JET.w - 3.2, fs = JAD.mid + 1.2;
      const y = surfaceY(ft, fs);
      post(W, ft, fs, y, y + 0.14, 0.13, [0.300, 0.302, 0.298], 8);
      post(W, ft, fs, y + 0.14, y + 5.40, 0.048, [0.560, 0.556, 0.540], 7);
      const FLAG = [[0.720, 0.600, 0.090], [0.620, 0.115, 0.095]];
      for (let f = 0; f < 2; f++) {
        const y0f = y + 4.70 - f * 1.15;
        // Six panels, each a little further out and a little lower, which is
        // what a flag in a steady breeze does and what a single quad cannot.
        for (let i = 0; i < 6; i++) {
          const a0 = i / 6, a1 = (i + 1) / 6;
          const w0 = 0.90 * a0, w1 = 0.90 * a1;
          const sag = (u) => -Math.sin(u * 2.2) * 0.13;
          b.quad(W(ft + 0.05, fs - w0, y0f + sag(a0)),
            W(ft + 0.05, fs - w1, y0f + sag(a1)),
            W(ft + 0.05, fs - w1, y0f - 0.58 + sag(a1) * 0.6),
            W(ft + 0.05, fs - w0, y0f - 0.58 + sag(a0) * 0.6),
            i % 2 ? FLAG[f] : shade(FLAG[f], 0.90));
        }
      }
    }




    // ── what is set into the quay, and what is out in front of it ────────────
    //
    // b_151 is the quay flank straight down. Three things in it the shore did
    // not have.

    // One: the mooring rings. A rusted iron eye lying in a pocket cast into
    // the slab, flush with the walking surface so nothing catches on it. They
    // are the only ironwork on the whole edge and they are every few metres of
    // it, because this quay was a working quay before it was a bathing one.
    b = deck;
    for (let t = JAD.beachTo + 7; t < LEN - 6; t += 17.5) {
      if (onMoleT(t) || onPlazaT(t)) continue;
      const s = 0.62 + jit(t | 0, 600) * 0.22;
      const y = surfaceY(t, s);
      // The pocket: a shallow dish of shadow, which is what you actually see.
      // Sized to the ring and not to the eye: at 0.60 by 0.52 the pocket read
      // as a black square with a small ring lying in the middle of it.
      b.quad(W(t - 0.22, s - 0.20, y + 0.004), W(t + 0.22, s - 0.20, y + 0.004),
        W(t + 0.22, s + 0.20, y + 0.004), W(t - 0.22, s + 0.20, y + 0.004),
        [0.268, 0.250, 0.228]);
      b = up;
      // The ring, eight chords of rusted iron lying in it.
      const RUST = [0.230, 0.140, 0.092];
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU;
        const R = 0.175, w = 0.030;
        const p = (a, rr, yy) => W(t + Math.cos(a) * rr, s + Math.sin(a) * rr, yy);
        b.quad(p(a0, R - w, y + 0.012), p(a1, R - w, y + 0.012),
          p(a1, R + w, y + 0.012), p(a0, R + w, y + 0.012),
          i % 2 ? RUST : [0.280, 0.175, 0.110]);
        b.quad(p(a1, R + w, y + 0.012), p(a0, R + w, y + 0.012),
          p(a0, R + w, y - 0.020), p(a1, R + w, y - 0.020), [0.170, 0.105, 0.070]);
      }
      // And the staple it is shackled to, at the inland side of the pocket.
      boxTS(t - 0.06, t + 0.06, s + 0.20, s + 0.28, y - 0.02, y + 0.05,
        [0.200, 0.125, 0.085]);
      b = deck;
    }
    b = up;

    // Two: the line of floats marking the bathing water. It runs across the
    // whole west bay in the frame, small dark buoys on a rope, and it is the
    // one thing out there that tells you where the swimming stops and the
    // boats start.
    {
      const s = -64;
      let prev = null;
      // Every 2.2 m, not every 7.4. A swim line reads as a dotted line because
      // the floats are close enough to make one; at seven metres apart and
      // seventy metres out each float is two pixels and there is no line.
      for (let t = 24; t < 268; t += 2.2) {
        const wob = (jit(t | 0, 610) - 0.5) * 2.6;
        const st2 = s + wob;
        const BUOY = ((t / 2.2) | 0) % 4 === 0 ? [0.760, 0.330, 0.075]
          : [0.740, 0.735, 0.720];
        post(W, t, st2, -0.10, 0.14, 0.135, BUOY, 6);
        dome(W, t, st2, 0.14, 0.11, 0.135, shade(BUOY, 1.12), 6);
        // The rope between them, riding just clear of the water.
        if (prev) {
          const [pt2, ps] = prev;
          for (let k = 0; k < 2; k++) {
            const u0 = k / 2, u1 = (k + 1) / 2;
            const sag = (u) => 0.04 - Math.sin(u * Math.PI) * 0.05;
            const q = (u) => W(pt2 + (t - pt2) * u, ps + (st2 - ps) * u, sag(u));
            const a = q(u0), c = q(u1);
            b.quad(a, c, [c[0], c[1] + 0.030, c[2]], [a[0], a[1] + 0.030, a[2]],
              [0.700, 0.680, 0.630]);
          }
        }
        prev = [t, st2];
      }
    }

    // Three: the folded loungers. b_151 has them stacked and leaning against
    // the wall at the top of the quay, which is where every one of them lives
    // when it is not being sat on — and the game had them all deployed.
    for (const [st3, ss3] of [[292, 4.6], [396, 4.2], [452, 5.0]]) {
      const y = surfaceY(st3, ss3);
      const P = facing(st3, ss3, 0.22);
      for (let i = 0; i < 5; i++) {
        const lean = 0.30 + i * 0.055;
        const off = i * 0.085;
        const g = 0.94 + 0.10 * (i % 3) / 2;
        const FR = [0.760 * g, 0.752 * g, 0.732 * g];
        // A folded lounger is a flat frame standing on its foot and leaning
        // back: two rails, five slats and a foot, all in one plane.
        const q = (u, v) => {
          // u along the frame from the foot, v across it
          const yy = y + Math.cos(lean) * u;
          const ds = off + Math.sin(lean) * u;
          return P(v, ds, yy);
        };
        for (const v of [-0.30, 0.30]) {
          const a = q(0.02, v - 0.03), c = q(1.72, v - 0.03);
          const a2 = q(0.02, v + 0.03), c2 = q(1.72, v + 0.03);
          b.quad(a, c, c2, a2, FR);
          b.quad([a[0], a[1] + 0.04, a[2]], [c[0], c[1] + 0.04, c[2]],
            [c2[0], c2[1] + 0.04, c2[2]], [a2[0], a2[1] + 0.04, a2[2]],
            [FR[0] * 1.08, FR[1] * 1.08, FR[2] * 1.08]);
        }
        for (let k = 0; k < 5; k++) {
          const u = 0.20 + k * 0.34;
          b.quad(q(u, -0.30), q(u + 0.20, -0.30), q(u + 0.20, 0.30), q(u, 0.30),
            [FR[0] * 0.92, FR[1] * 0.92, FR[2] * 0.92]);
        }
      }
      runs.push({ t0: st3 - 0.6, t1: st3 + 0.6, s0: ss3 - 0.6, s1: ss3 + 0.9,
        y, h: 1.5 });
    }

    // ── the concrete is cracked ──────────────────────────────────────────────
    //
    // b_121 is two thirds slab, straight down, and the slab is a map of it:
    // one big crack running diagonally across the whole frame with a dozen
    // branches off it, a patch where somebody has made good in a different
    // mix, pitting, and a place near the water where the concrete has broken
    // away to the shingle underneath. The promenade here is the largest
    // surface in the resort and it was clean poured bays.
    //
    // Cracks are drawn as walked polylines rather than as straight cuts. A
    // crack does not know where it is going: it turns a little at every step
    // and turns more where it has just turned, which is why a random walk with
    // momentum reads as fracture and a jittered straight line reads as a seam.
    b = deck;
    for (let n = 0; n < 190; n++) {
      let t = 4 + jit(n, 500) * (LEN - 8);
      let s = 0.6 + jit(n, 501) * (JAD.back - 2.0);
      if (onMoleT(t) && s > -2) { /* the mole gets them too */ }
      let a = jit(n, 502) * TAU;
      let turn = 0;
      // 0.018-0.048 m was the honest width of the crack itself and it was
      // invisible: at fifteen metres a three-centimetre line is a pixel and a
      // half and falls between the samples. What you actually see at that
      // range is not the crack, it is the weathering halo either side of it —
      // so the quad is that, six to fifteen centimetres, at low contrast.
      const w = 0.032 + jit(n, 503) * 0.042;
      const steps = 3 + ((jit(n, 504) * 6) | 0);
      for (let k = 0; k < steps; k++) {
        const len = 0.8 + jit(n, 510 + k) * 2.6;
        turn = turn * 0.55 + (jit(n, 520 + k) - 0.5) * 1.15;
        a += turn;
        const t1 = t + Math.cos(a) * len, s1 = s + Math.sin(a) * len;
        if (s1 < 0.4 || s1 > JAD.back - 0.4) break;
        const y0 = surfaceY(t, s) + 0.012, y1 = surfaceY(t1, s1) + 0.012;
        // Broadside offset, so the line has width across its own direction and
        // not across the shore.
        const nx = -Math.sin(a) * w, ns = Math.cos(a) * w;
        const g = 0.66 + jit(n, 530 + k) * 0.16;
        b.quad(W(t - nx, s - ns, y0), W(t1 - nx, s1 - ns, y1),
          W(t1 + nx, s1 + ns, y1), W(t + nx, s + ns, y0),
          [CONC[1][0] * g, CONC[1][1] * g, CONC[1][2] * g]);
        t = t1; s = s1;
      }
    }
    // And the made-good patches: a rectangle of a different mix, laid a
    // millimetre proud, with its own crack across it more often than not.
    for (let n = 0; n < 26; n++) {
      const t = 6 + jit(n, 540) * (LEN - 12);
      const s = 1.2 + jit(n, 541) * (JAD.back - 3.0);
      const ht = 0.5 + jit(n, 542) * 1.5, hs = 0.4 + jit(n, 543) * 1.2;
      if (s - hs < 0.4 || s + hs > JAD.back - 0.4) continue;
      const g = 0.88 + jit(n, 544) * 0.26;
      const y = surfaceY(t, s) + 0.010;
      b.quad(W(t - ht, s - hs, y), W(t + ht, s - hs, y),
        W(t + ht, s + hs, y), W(t - ht, s + hs, y),
        [CONC[2][0] * g, CONC[2][1] * g, CONC[2][2] * g]);
    }
    b = up;

    // ── moored off the beach ─────────────────────────────────────────────────
    //
    // b_031 films the west bay over the litter bins: a scatter of small open
    // boats lying to their moorings thirty to sixty metres out, white hulls
    // with a coloured sheer stripe, all of them lying the same way because the
    // wind in this channel only comes from two directions.
    //
    // `dinghy` has been in this file since the first pass and has never once
    // been called. The bay was empty water in front of a bathing station on a
    // peninsula full of people who all own a boat.
    b = up;
    for (let i = 0; i < 11; i++) {
      const t = 52 + i * 13.5 + jit(i, 400) * 6.0;
      const s = -22 - jit(i, 401) * 34;
      // Lying to the mooring, so they all point within a few degrees of each
      // other — a bay where every boat lies a different way is a bay with no
      // wind in it.
      const ang = 1.24 + (jit(i, 402) - 0.5) * 0.42;
      const HULL = [[0.760, 0.752, 0.730], [0.740, 0.735, 0.715],
        [0.700, 0.700, 0.690], [0.560, 0.180, 0.150]];
      const col = HULL[((jit(i, 403) * 97) | 0) % HULL.length];
      dinghy(t, s, ang, col);
      const P = facing(t, s, ang);
      // The stripe along the sheer, which is the only thing you can read on a
      // hull this size at this distance.
      const STRIPE = jit(i, 404) < 0.5 ? [0.480, 0.120, 0.105]
        : [0.130, 0.220, 0.400];
      for (const o of [-0.60, 0.60]) {
        boxIn(P, o - 0.05, o + 0.05, -1.55, 1.50, 0.30, 0.38, STRIPE);
      }
      // An outboard on the transom for two in three of them.
      if (jit(i, 405) < 0.66) {
        boxIn(P, -0.13, 0.13, 1.36, 1.62, 0.16, 0.62, [0.140, 0.140, 0.150],
          [0.180, 0.180, 0.192]);
        boxIn(P, -0.06, 0.06, 1.42, 1.56, -0.22, 0.16, [0.180, 0.180, 0.192]);
      }
      // And the buoy she is lying to, with the painter running to it.
      const bt = t + Math.cos(ang + Math.PI) * 3.4;
      const bs = s + Math.sin(ang + Math.PI) * 3.4;
      const BUOY = jit(i, 406) < 0.5 ? [0.760, 0.330, 0.075]
        : [0.740, 0.740, 0.730];
      post(W, bt, bs, -0.10, 0.26, 0.17, BUOY, 8);
      dome(W, bt, bs, 0.26, 0.14, 0.17, shade(BUOY, 1.10), 8);
      const q = (u) => W(t + (bt - t) * u, s + (bs - s) * u, 0.16 - u * 0.10);
      for (let k = 0; k < 5; k++) {
        const p0 = q(k / 5), p1 = q((k + 1) / 5);
        b.quad(p0, p1, [p1[0], p1[1] + 0.035, p1[2]],
          [p0[0], p0[1] + 0.035, p0[2]], [0.660, 0.630, 0.560]);
      }
    }

    // The pair of green bins on the bank, which b_031 opens on: two dark
    // green plastic drums with hooded tops, hung side by side off one black
    // steel post, standing in the needles at the top of the beach.
    for (const bt of [128, 176, 198]) {
      const bs = JAD.mid + 3.6;
      const y = surfaceY(bt, bs);
      post(W, bt, bs, y, y + 1.42, 0.055, [0.180, 0.180, 0.188], 6);
      for (const o of [-0.34, 0.34]) {
        const GRN = [0.115, 0.240, 0.130];
        post(W, bt + o, bs, y + 0.30, y + 1.06, 0.28, GRN, 9);
        // The hood, and the slot under it.
        dome(W, bt + o, bs, y + 1.06, 0.22, 0.30, shade(GRN, 1.16), 9);
        boxTS(bt + o - 0.20, bt + o + 0.20, bs - 0.31, bs - 0.26,
          y + 0.92, y + 1.04, [0.055, 0.100, 0.062]);
        // The bracket back to the post.
        boxTS(bt + Math.min(o, 0), bt + Math.max(o, 0), bs - 0.04, bs + 0.04,
          y + 0.78, y + 0.86, [0.180, 0.180, 0.188]);
      }
      clutter(bt + 0.9, bs - 0.8, y, 3, (bt | 0) * 11 + 5);
    }

    // Bicycles at the gate. 174947 has four of them leaning on the barrier,
    // which is where every bicycle in Dalmatia is left.
    for (let i = 0; i < 4; i++) {
      const bt = 484.2 + i * 0.62, bs = 27.6 + (i % 2) * 0.30;
      const y = surfaceY(bt, bs);
      const FR = [[0.560, 0.140, 0.115], [0.145, 0.230, 0.430],
        [0.180, 0.180, 0.190], [0.520, 0.505, 0.470]][i];
      const lean = 0.16;
      const P = facing(bt, bs, Math.PI * 0.5);
      // Two wheels, each a ring of short chords — a bicycle is legible from
      // its wheels and from nothing else.
      for (const wd of [-0.52, 0.52]) {
        for (let j = 0; j < 12; j++) {
          const a0 = (j / 12) * TAU, a1 = ((j + 1) / 12) * TAU;
          const R = 0.33;
          const p0 = P(wd + Math.cos(a0) * R * 0.18, lean * Math.cos(a0) * R,
            y + 0.34 + Math.sin(a0) * R);
          const p1 = P(wd + Math.cos(a1) * R * 0.18, lean * Math.cos(a1) * R,
            y + 0.34 + Math.sin(a1) * R);
          b.quad(p0, p1,
            P(wd + Math.cos(a1) * R * 0.18 + 0.03, lean * Math.cos(a1) * R,
              y + 0.34 + Math.sin(a1) * R),
            P(wd + Math.cos(a0) * R * 0.18 + 0.03, lean * Math.cos(a0) * R,
              y + 0.34 + Math.sin(a0) * R),
            [0.120, 0.120, 0.128]);
        }
      }
      // The frame: a down tube, a seat tube, a top tube and the bars.
      const tube = (t0, y0t, t1, y1t, r) => {
        const A = P(t0, 0, y + y0t), Bq = P(t1, 0, y + y1t);
        const d = [Bq[0] - A[0], Bq[1] - A[1], Bq[2] - A[2]];
        const L = Math.hypot(d[0], d[1], d[2]) || 1;
        const n = [-d[2] / L * r, 0, d[0] / L * r];
        b.quad([A[0] + n[0], A[1], A[2] + n[2]], [Bq[0] + n[0], Bq[1], Bq[2] + n[2]],
          [Bq[0] - n[0], Bq[1], Bq[2] - n[2]], [A[0] - n[0], A[1], A[2] - n[2]], FR);
        b.quad([A[0], A[1] + r, A[2]], [Bq[0], Bq[1] + r, Bq[2]],
          [Bq[0], Bq[1] - r, Bq[2]], [A[0], A[1] - r, A[2]], shade(FR, 1.12));
      };
      tube(-0.52, 0.34, 0.10, 0.86, 0.022);
      tube(0.52, 0.34, 0.10, 0.30, 0.022);
      tube(0.10, 0.30, 0.10, 0.92, 0.020);
      tube(0.10, 0.92, -0.52, 0.34, 0.020);
      tube(-0.44, 0.92, 0.10, 0.86, 0.018);
      boxTS(bt + 0.02, bt + 0.18, bs - 0.06, bs + 0.06, y + 0.90, y + 0.96,
        [0.100, 0.100, 0.110]);
      boxTS(bt - 0.50, bt - 0.38, bs - 0.16, bs + 0.16, y + 0.92, y + 0.96,
        [0.100, 0.100, 0.110]);
    }
    b = back11;
  }

  // The half of the shop extras that cannot run with the shops.
  //
  // `shopfront` is called at line 2600 and `pine`, `lounger` and `agave` are
  // all fine from there — they are declarations and they hoist — but what they
  // WRITE to is not: `greens` is a `const` declared with the wood. So the
  // furniture and the planting of a terrace are built here, in the resort's
  // frame, off the same table the frontage was.
  {
    const back10 = b;
    b = up;
    for (const S of SHOPS) {
      if (S.key === 'konoba') {
        const y0 = at((S.t0 + S.t1) * 0.5).deck;
        pine(S.t1 - 1.6, S.s0 + 2.2, y0 + 0.10, 11.5, -1);
        greens.push([S.t1 - 1.6, S.s0 + 2.2, 0.55, 9]);
      }
      if (S.key === 'mini') {
        const y0 = at((S.t0 + S.t1) * 0.5).deck;
        // Yellow sling deckchairs. Every frame of this terrace has them and
        // nothing else on the shore is that colour.
        for (let k = 0; k < 3; k++) {
          lounger(S.t0 + 1.4 + k * 1.5, S.s0 - 4.4 - (k % 2) * 0.7, y0,
            -0.22 + k * 0.18, [0.680, 0.560, 0.075]);
        }
        for (let k = 0; k < 5; k++) {
          agave(S.t0 + 5.9 + k * 0.25, S.s0 - 3.6, y0 + 0.86,
            0.13 + jit(k, 140) * 0.06);
        }
      }
    }
    b = back10;
  }

  // Two pines beside the vikendica's terrace — the only thing that is allowed
  // to be in that view, and the thing that is in it in life. Beside and not in
  // front: at ±8 m along the shore they frame the water rather than stand in it.
  for (const dt of [-8.2, 8.6]) {
    const t = VIK.t + dt, s = VIK.s - 3.4 + (dt > 0 ? 1.1 : 0);
    pine(t, s, surfaceY(t, s), 8.4 + rng() * 2.2);
    greens.push([t, s, 0.55, 9]);
  }

  // The back of the plot, which is the side everybody actually arrives on: a
  // gate in a wall, an oleander either side of it in flower, a fig hanging
  // over the east retaining wall and one big pine on the corner of the
  // forecourt. Placed off the vikendica's own frame — t is its t plus the
  // model's x, s is its s plus the model's y — because these belong to the
  // house and not to the shore, and the house is the thing they are measured
  // against in the photographs.
  //
  // The front is the other half of the same list: the two raised beds either
  // side of the path are planted, because a kerbed bed with nothing in it is a
  // trough. No pine went in with them: there are already two either side of
  // the terrace and a third in the forecourt closed the house off from the
  // water, which is the one view the house exists for.
  for (const [bx, by, kind, size] of [
    [0.10, 7.50, 'ole', 1.35], [4.85, 7.10, 'ole', 1.05],
    [-1.30, 5.60, 'ole', 0.95],
    [6.40, 8.10, 'pine', 10.5], [-3.20, 7.60, 'pine', 8.8],
    [5.60, 4.90, 'olive', 3.1],
    [-3.14, -8.60, 'ole', 0.95], [-3.14, -6.95, 'olive', 2.1],
    [0.36, -8.95, 'ole', 0.88], [0.36, -7.20, 'ole', 0.74],
  ]) {
    const t = VIK.t + bx, s2 = VIK.s + by, yy = surfaceY(t, s2);
    if (kind === 'pine') { pine(t, s2, yy, size); greens.push([t, s2, 0.55, 9]); }
    else if (kind === 'olive') { olive(t, s2, yy, size); greens.push([t, s2, 0.60, 4]); }
    else oleander(t, s2, yy, size);
  }

  // And a few more out in front of the terrace, between the house and the
  // water, which is where they were asked for.
  //
  // Past the seaward lip of the terrace, which is at z 6.07 — inside that and
  // they grow up through the slab, which is where the first attempt put them.
  // Beyond it there is no clearance anybody guarantees: the rule in this
  // builder is only that no other *house* is placed within 7.5 m of the
  // vikendica, and the blockers that would answer the question properly are
  // all pushed a thousand lines below this. So these are eyeballed off the
  // terrace edge and then looked at.
  //
  // Clearing the slab is not the same as clearing the view, which is what the
  // second attempt found out: a nine-metre pine standing 60 cm off the lip is
  // not in front of the terrace, it is over it. These stand a good two metres
  // further out again, far enough that the crowns are something you look at
  // rather than something you are under.
  //
  // The two big ones are off to the sides. The three near the middle are
  // olives: four metres and open-crowned, so from the terrace you are looking
  // at the sea through a tree rather than at a tree.
  for (const [dt, ds, tall] of [[-5.8, 9.0, 1], [6.0, 9.3, 1], [-3.0, 9.9, 0],
                                [3.3, 10.1, 0], [0.4, 10.8, 0]]) {
    const t = VIK.t + dt, s = VIK.s - ds;
    const y = surfaceY(t, s);
    if (tall) {
      pine(t, s, y, 7.8 + rng() * 1.8);
      greens.push([t, s, 0.55, 9]);
    } else {
      olive(t, s, y, 4.0 + rng() * 1.1);
      greens.push([t, s, 0.60, 5]);
    }
  }

  // There used to be a second run of oleander tight against the front row's
  // doors, at rowA − 1.15, one every four or five metres for the whole length.
  // It came off. Real cabin rows on this coast have nothing planted along them
  // — the doors open outward and the strip in front of them is the walk — and
  // the mounds sat right where you stand to look at a door, so the row read as
  // a hedge with kabine behind it rather than as a row of kabine. Green stays
  // where there is soil for it: behind the back row, above.
  for (let t = 4; t < LEN - 4; t += 3.2 + rng() * 6) {
    if (!clearOfShops(t)) continue;
    const s = JAD.back + 1.5 + rng() * 7;
    agave(t, s, surfaceY(t, s), 0.55 + rng() * 0.55);
  }

  // ── what is in the kabina ──────────────────────────────────────────────────
  /**
   * Four things, and they are the only furniture in this game anybody is meant
   * to look at closely.
   *
   * Everything else on this shore is seen from three metres or from three
   * hundred and is built accordingly — a lounger is nine boxes and a parasol is
   * a cone, and that is the right amount of lounger. These are seen from
   * arm's length in a room 1.95 m across, so the two that have faces on them
   * get canvases: a 1960s set's front panel and a valve radio's dial are
   * *printed* objects, and printing them is both cheaper and better than
   * modelling a speaker grille out of triangles.
   *
   * The screen and the dial are the only light in here. That is why the room
   * was made dark, and it is why they are `MeshBasicMaterial`: a cathode ray
   * tube and a dial lamp emit, they are not lit.
   */
  const KIT = {
    wood: [0.400, 0.255, 0.140], woodT: [0.470, 0.310, 0.175],
    dark: [0.180, 0.115, 0.065],
    steel: [0.290, 0.300, 0.315], chrome: [0.660, 0.680, 0.700],
    tick: [0.700, 0.680, 0.615], sheet: [0.780, 0.760, 0.700],
    rug: [0.330, 0.185, 0.190],
    blue: [0.545, 0.650, 0.720], gold: [0.700, 0.575, 0.300],
    glass: [0.050, 0.120, 0.062], cream: [0.850, 0.810, 0.690],
    foil: [0.330, 0.075, 0.095],
    // The glass she pours into, and what goes in it. Nothing in this renderer
    // is transparent, so a wine glass has to be a *bright* solid — an unlit
    // pane of glass reads as a pane of glass by being the lightest thing on the
    // table, not by being see-through.
    crystal: [0.760, 0.800, 0.815], wine: [0.300, 0.045, 0.072],
    // The wrap, off. `SCARF_DARK` and `SCARF_LITE` out of human_mh.py, split
    // the difference — on the floor it is a heap and not a net, and there is
    // no pattern left to be dark and light halves of.
    wrap: [0.185, 0.176, 0.200],
  };

  /**
   * The print on the wall over the tabouret.
   *
   * A bar poster, which is the one thing a room with a bottle of Pelješac and
   * two glasses in it was missing — and it goes on the wall the bottle stands
   * against, so it is behind the wine from wherever in the room you are looking
   * at the wine from.
   *
   * Drawn rather than shipped. The alternative was a photograph, and a
   * photograph of a poster is a JPEG somebody else owns; this is four hundred
   * lines of canvas that costs the build nothing and is ours. It is also the
   * only way to be sure of it in a room this dark: every value in here is
   * chosen against the one lamp-free hemisphere that lights the place, not
   * against a white page.
   *
   * The type is fitted rather than set. A headless Chrome and a Windows laptop
   * do not have the same fonts, and a title that overruns its own paper is
   * worse than a title a size down — so each line is measured and stepped down
   * until it fits the margin it was given.
   */
  function posterSkin() {
    const CW = 480, CH = 640;
    const cv = document.createElement('canvas');
    cv.width = CW; cv.height = CH;
    const g = cv.getContext('2d');
    const RED = '#e42d22';
    const FACE = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';

    const fit = (text, px, y, weight, margin) => {
      let n = px;
      for (;;) {
        g.font = weight + ' ' + n + 'px ' + FACE;
        if (n <= 7 || g.measureText(text).width <= CW - margin * 2) break;
        n -= 1;
      }
      g.fillText(text, CW * 0.5, y);
    };

    // Paper, and the plate area on it. Not white: a poster is off-white, and
    // white here would be the brightest thing in the room by a mile.
    g.fillStyle = '#f7f2ea'; g.fillRect(0, 0, CW, CH);
    g.textAlign = 'center';
    g.fillStyle = RED;
    fit('SEX ON THE BEACH', 66, 84, '900', 22);
    fit('Ingredients: 1½ oz vodka, ¾ oz peach schnapps, '
      + '1½ oz orange juice, 1½ oz cranberry juice', 15, 112, '700', 20);

    const X0 = 30, Y0 = 128, X1 = CW - 30, Y1 = CH - 78;
    g.fillStyle = '#efe6d6'; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);

    // The wash behind the glass. Two blobs rather than one, because a
    // watercolour is a wet edge over a dry one and a single radial gradient is
    // an airbrush.
    for (const [cx, cy, r, col] of [[236, 356, 178, '250, 186, 74'],
      [300, 300, 132, '245, 148, 52'], [176, 430, 104, '243, 130, 96']]) {
      const w = g.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      w.addColorStop(0, 'rgba(' + col + ', 0.80)');
      w.addColorStop(0.72, 'rgba(' + col + ', 0.42)');
      w.addColorStop(1, 'rgba(' + col + ', 0)');
      g.fillStyle = w;
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    }

    // The straws, behind the glass so the rim cuts them off.
    g.lineCap = 'round';
    g.strokeStyle = '#2f9ad6'; g.lineWidth = 11;
    g.beginPath(); g.moveTo(214, 300); g.lineTo(178, 176); g.stroke();
    g.strokeStyle = '#f2b21e'; g.lineWidth = 11;
    g.beginPath(); g.moveTo(236, 300); g.lineTo(250, 172); g.stroke();
    g.strokeStyle = 'rgba(255, 255, 255, 0.85)'; g.lineWidth = 4;
    for (let i = 0; i < 9; i++) {
      const u = i / 9, v = u + 0.05;
      g.beginPath();
      g.moveTo(236 + 14 * u, 300 - 128 * u);
      g.lineTo(236 + 14 * v + 5, 300 - 128 * v);
      g.stroke();
    }

    // The umbrella: a canopy of alternating panels and a stick under it.
    g.strokeStyle = '#cfd6da'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(372, 196); g.lineTo(398, 300); g.stroke();
    for (let i = 0; i < 8; i++) {
      const a0 = Math.PI + i * Math.PI / 8, a1 = a0 + Math.PI / 8;
      g.fillStyle = i % 2 ? '#8e1720' : '#e0403a';
      g.beginPath(); g.moveTo(372, 200);
      g.lineTo(372 + Math.cos(a0) * 76, 200 + Math.sin(a0) * 34);
      g.lineTo(372 + Math.cos(a1) * 76, 200 + Math.sin(a1) * 34);
      g.closePath(); g.fill();
    }

    // The glass. One path for the bowl, filled with the drink itself — the
    // sunrise, which is the whole reason anybody orders this.
    const bowl = () => {
      g.beginPath();
      g.moveTo(190, 288);
      g.bezierCurveTo(178, 372, 196, 440, 240, 440);
      g.bezierCurveTo(284, 440, 302, 372, 290, 288);
      g.closePath();
    };
    const drink = g.createLinearGradient(0, 288, 0, 440);
    drink.addColorStop(0, '#f6a91d');
    drink.addColorStop(0.42, '#f2701f');
    drink.addColorStop(1, '#cf1a2b');
    bowl(); g.fillStyle = drink; g.fill();
    // The meniscus, and a highlight down the left of the bowl.
    g.fillStyle = '#f8bb3a';
    g.beginPath(); g.ellipse(240, 289, 50, 11, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255, 255, 255, 0.55)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(200, 306); g.bezierCurveTo(192, 356, 200, 400, 216, 424);
    g.stroke();
    bowl(); g.strokeStyle = 'rgba(60, 40, 30, 0.55)'; g.lineWidth = 3; g.stroke();
    // Stem and foot.
    g.fillStyle = '#e8eef1';
    g.fillRect(231, 440, 18, 46);
    g.beginPath(); g.ellipse(240, 492, 48, 13, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(60, 40, 30, 0.45)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(240, 492, 48, 13, 0, 0, TAU); g.stroke();
    g.beginPath(); g.ellipse(240, 486, 40, 9, 0, 0, TAU); g.stroke();

    // The orange on the rim, half over the glass and half off it.
    g.fillStyle = '#f6c46a';
    g.beginPath(); g.arc(306, 282, 48, 0, TAU); g.fill();
    g.fillStyle = '#f0603a';
    g.beginPath(); g.arc(306, 282, 40, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255, 240, 220, 0.9)'; g.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10;
      g.beginPath(); g.moveTo(306, 282);
      g.lineTo(306 + Math.cos(a) * 39, 282 + Math.sin(a) * 39);
      g.stroke();
    }

    // Splashes. Fixed, not random: this texture is built once and has to come
    // out the same on every machine that builds it.
    g.fillStyle = 'rgba(214, 34, 40, 0.85)';
    for (const [x, y, r] of [[92, 470, 13], [128, 512, 7], [396, 452, 11],
      [418, 500, 6], [76, 330, 6], [412, 372, 5], [180, 528, 5]]) {
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }

    // The footer rule, broken for the line of type that sits in it.
    g.strokeStyle = RED; g.lineWidth = 4;
    g.beginPath();
    g.moveTo(36, CH - 44); g.lineTo(168, CH - 44);
    g.moveTo(CW - 168, CH - 44); g.lineTo(CW - 36, CH - 44);
    g.stroke();
    g.fillStyle = RED;
    fit('USA 1998', 30, CH - 34, '900', 180);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 8;
    return tex;
  }

  /** The canvas on the front of the television. */
  function tvPanel() {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 448;
    const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    // The tube, in canvas pixels. Everything else on the panel is furniture
    // around it.
    const SX = 34, SY = 26, SW = 444, SH = 304;

    const round = (x, y, w, h, r) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };

    // Static. Real snow, drawn into an ImageData rather than faked with a few
    // hundred rectangles — at this size the cheat is visible as a grid and the
    // honest version is one pass over 130k pixels a sixth of a second.
    const snow = g.createImageData(SW >> 1, SH >> 1);
    const buf = document.createElement('canvas');
    buf.width = snow.width; buf.height = snow.height;
    const bg = buf.getContext('2d');
    const hiss = (seed) => {
      const d = snow.data;
      let x = seed | 1;
      for (let i = 0; i < d.length; i += 4) {
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x |= 0;
        const v = 40 + ((x >>> 24) & 0xff) * 0.62;
        d[i] = v; d[i + 1] = v * 1.02; d[i + 2] = v * 1.06; d[i + 3] = 255;
      }
      bg.putImageData(snow, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(buf, SX, SY, SW, SH);
    };

    const draw = (price, seed, label = 'BTC / USD') => {
      // The cabinet's front, and the cream surround the tube sits in.
      g.fillStyle = '#3a2513'; g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#d8cdb4';
      round(SX - 16, SY - 16, SW + 32, SH + 32, 46); g.fill();
      // The tube itself: a rounded rectangle, and the corners are the whole
      // reason anybody knows what decade this is from.
      g.save();
      round(SX, SY, SW, SH, 62); g.clip();
      g.fillStyle = '#0a1410'; g.fillRect(SX, SY, SW, SH);
      if (price == null) {
        hiss(seed);
        g.fillStyle = 'rgba(230,240,235,0.30)';
        g.font = 'bold 34px Helvetica, Arial, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('NO SIGNAL', SX + SW / 2, SY + SH / 2);
      } else {
        g.fillStyle = '#0d1f18'; g.fillRect(SX, SY, SW, SH);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.shadowColor = '#79ffbe'; g.shadowBlur = 18;
        g.fillStyle = '#9dffcf';
        g.font = '30px Helvetica, Arial, sans-serif';
        g.fillText(label, SX + SW / 2, SY + 74);
        // Sized to fit: DOGE at four decimal places is twice the string BTC is,
        // and at 92 px it walks off both sides of a 444 px tube.
        g.font = 'bold ' + (price.length > 8 ? 68 : 92)
          + 'px Helvetica, Arial, sans-serif';
        g.fillText(price, SX + SW / 2, SY + 168);
        g.font = '26px Helvetica, Arial, sans-serif';
        g.fillStyle = 'rgba(157,255,207,0.62)';
        g.fillText('J A D R I J A', SX + SW / 2, SY + 250);
      }
      // Scanlines and a little vignette, over whatever is underneath.
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(0,0,0,0.20)';
      for (let y = SY; y < SY + SH; y += 4) g.fillRect(SX, y, SW, 2);
      g.restore();
      // The speaker grille and the two knobs, which on the real thing live in a
      // brass plate under the tube.
      g.fillStyle = '#c9bda0';
      round(SX + 74, SY + SH + 36, SW - 148, 62, 30); g.fill();
      g.fillStyle = '#6d6047';
      for (let i = 0; i < 9; i++) {
        g.fillRect(SX + 96 + i * 26, SY + SH + 48, 9, 38);
      }
      for (const kx of [SX + 30, SX + SW - 30]) {
        g.fillStyle = '#e6dcc2';
        g.beginPath(); g.arc(kx, SY + SH + 67, 27, 0, TAU); g.fill();
        g.fillStyle = '#8a7a5a';
        g.beginPath(); g.arc(kx, SY + SH + 67, 9, 0, TAU); g.fill();
      }
      tex.needsUpdate = true;
    };

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.402),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    return { mesh, draw };
  }

  /** And the one on the front of the radio. Only the dial is alight. */
  function radioPanel() {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;

    // `lit` is 0 for a dead set and 1 for a dial lamp that has warmed up. The
    // tuning knob will move `f` in a later pass; the drawing already takes it.
    const draw = (f = 0.30, lit = 0.55) => {
      g.fillStyle = '#4d6b7e'; g.fillRect(0, 0, cv.width, cv.height);
      // The grille: horizontal bars behind a gold surround, which is what the
      // whole front of one of these is.
      g.fillStyle = '#8a7238';
      g.fillRect(18, 30, 250, 150);
      g.fillStyle = '#2a2118';
      g.fillRect(28, 40, 230, 130);
      g.fillStyle = '#6b5c3e';
      for (let i = 0; i < 11; i++) g.fillRect(34, 47 + i * 11, 218, 5);
      // The dial. Amber behind glass, a scale in MHz, and a red pointer.
      const dx = 288, dy = 30, dw = 206, dh = 92;
      g.fillStyle = '#8a7238'; g.fillRect(dx - 8, dy - 8, dw + 16, dh + 16);
      const glow = g.createLinearGradient(dx, dy, dx, dy + dh);
      glow.addColorStop(0, `rgba(255,206,110,${0.30 + 0.55 * lit})`);
      glow.addColorStop(1, `rgba(150,96,26,${0.25 + 0.45 * lit})`);
      g.fillStyle = '#241a10'; g.fillRect(dx, dy, dw, dh);
      g.fillStyle = glow; g.fillRect(dx, dy, dw, dh);
      g.strokeStyle = `rgba(60,38,14,${0.55 + 0.3 * lit})`;
      g.fillStyle = `rgba(52,32,12,${0.70 + 0.25 * lit})`;
      g.font = '15px Helvetica, Arial, sans-serif';
      g.textAlign = 'center';
      for (let i = 0; i <= 10; i++) {
        const x = dx + 12 + (dw - 24) * (i / 10);
        const tall = i % 2 === 0;
        g.lineWidth = tall ? 2 : 1;
        g.beginPath(); g.moveTo(x, dy + dh - 10);
        g.lineTo(x, dy + dh - (tall ? 30 : 22)); g.stroke();
        if (tall) g.fillText(String(88 + i * 2), x, dy + 24);
      }
      g.strokeStyle = '#d8342a'; g.lineWidth = 3;
      const px = dx + 12 + (dw - 24) * sat(f);
      g.beginPath(); g.moveTo(px, dy + 4); g.lineTo(px, dy + dh - 4); g.stroke();
      // Knobs: two big ones on the right, three small ones under the grille.
      for (const [kx, ky, r] of [[400, 190, 40], [478, 196, 30]]) {
        g.fillStyle = '#c9a758';
        g.beginPath(); g.arc(kx, ky, r, 0, TAU); g.fill();
        g.strokeStyle = '#5c4a20'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(kx, ky); g.lineTo(kx, ky - r + 6); g.stroke();
      }
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#b99b52';
        g.beginPath(); g.arc(52 + i * 44, 212, 15, 0, TAU); g.fill();
      }
      tex.needsUpdate = true;
    };

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.30, 0.15),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    return { mesh, draw };
  }

  /**
   * Stand the four of them up.
   *
   * Laid out against the two long walls with a walkway down the middle, which
   * is not a style choice — it is the only layout a long narrow room has. Only
   * the cot and the television's stand are blockers. The tabouret and the
   * radio table are 40 cm deep against a wall and holding you off them costs
   * more of the walkway than walking into one costs in dignity.
   *
   * Every piece is placed off `dc` and so moved outward on its own when the
   * hut went to two bays. It had to: at one bay the cot sat 0.27 m from the
   * middle of the floor, because there was no wall to put it against that was
   * not already touching it. Now the walls are 2.02 m out and the furniture is
   * on them, which is what leaves 2.78 m of clear floor down the centre.
   */
  function kabinaKit(K) {
    const f = K.floor, dc = K.dc;
    const tv = tvPanel(), radio = radioPanel();

    // ── the cot ──
    const c0 = dc + 1.20, c1 = dc + 1.90, cs0 = 18.55, cs1 = 20.45;
    for (const [t, s] of [[c0 + 0.06, cs0 + 0.07], [c1 - 0.06, cs0 + 0.07],
      [c0 + 0.06, cs1 - 0.07], [c1 - 0.06, cs1 - 0.07]]) {
      post(facing(t, s, 0), 0, 0, f, f + 0.30, 0.022, KIT.steel, 6);
    }
    boxTS(c0, c1, cs0, cs0 + 0.05, f + 0.28, f + 0.46, KIT.steel);
    boxTS(c0, c1, cs1 - 0.05, cs1, f + 0.28, f + 0.40, KIT.steel);
    boxTS(c0, c0 + 0.04, cs0, cs1, f + 0.28, f + 0.34, KIT.steel);
    boxTS(c1 - 0.04, c1, cs0, cs1, f + 0.28, f + 0.34, KIT.steel);
    // The mattress, tucked in top and bottom so it is not a slab.
    const cm = (c0 + c1) * 0.5, cms = (cs0 + cs1) * 0.5;
    frustum(W, f + 0.32, [cm, cms, 0.325, 0.900],
      f + 0.36, [cm, cms, 0.343, 0.930], KIT.tick);
    frustum(W, f + 0.36, [cm, cms, 0.343, 0.930],
      f + 0.44, [cm, cms, 0.330, 0.912], KIT.tick, KIT.sheet);
    // A pillow at the inland end and a blanket folded over the foot, because a
    // bare mattress is a store room and this is somewhere somebody sleeps.
    frustum(W, f + 0.44, [cm, cs1 - 0.30, 0.230, 0.160],
      f + 0.53, [cm, cs1 - 0.31, 0.205, 0.135], KIT.sheet, KIT.sheet);
    frustum(W, f + 0.43, [cm, cs0 + 0.36, 0.336, 0.290],
      f + 0.50, [cm, cs0 + 0.35, 0.330, 0.275], KIT.rug, KIT.rug);
    furniture.push({ t: cm, s: cms, a: 0.35 - SNUG, c: 0.95 - SNUG,
      h: 0.5, y: f });

    // ── the television, on its stand against the back wall ──
    const vt = dc - 1.10, vs = 22.10;
    for (const o of [[-0.31, -0.15], [0.31, -0.15], [-0.31, 0.15], [0.31, 0.15]]) {
      post(facing(vt + o[0], vs + o[1], 0), 0, 0, f, f + 0.50, 0.028, KIT.dark, 5);
    }
    frustum(W, f + 0.50, [vt, vs, 0.380, 0.210],
      f + 0.55, [vt, vs, 0.380, 0.210], KIT.wood, KIT.woodT);
    boxTS(vt - 0.36, vt + 0.36, vs - 0.19, vs + 0.19, f + 0.16, f + 0.24, KIT.dark);
    // The set. Splayed legs, a cabinet that tucks in at both ends, and the
    // front is the canvas — see `tvPanel`.
    const gy = f + 0.55;
    for (const o of [[-0.19, -0.14], [0.19, -0.14], [-0.19, 0.14], [0.19, 0.14]]) {
      frustum(W, gy, [vt + o[0], vs + o[1], 0.016, 0.016],
        gy + 0.11, [vt + o[0] * 0.82, vs + o[1] * 0.82, 0.013, 0.013], KIT.dark);
    }
    frustum(W, gy + 0.10, [vt, vs, 0.222, 0.176],
      gy + 0.15, [vt, vs, 0.248, 0.196], KIT.wood);
    frustum(W, gy + 0.15, [vt, vs, 0.248, 0.196],
      gy + 0.47, [vt, vs, 0.248, 0.196], KIT.wood);
    frustum(W, gy + 0.47, [vt, vs, 0.248, 0.196],
      gy + 0.52, [vt, vs, 0.220, 0.170], KIT.wood, KIT.woodT);
    {
      const p = W(vt, vs - 0.198, gy + 0.31);
      tv.mesh.position.set(p[0], p[1], p[2]);
      const st = at(vt);
      tv.mesh.rotation.y = Math.atan2(-st.nx, -st.nz);
      scene.add(tv.mesh);
    }
    // Rabbit ears: a chromed base and two rods in a V, which is the one detail
    // that dates the thing from across a dark room.
    dome(facing(vt, vs, 0), 0, 0, gy + 0.52, 0.055, 0.075, KIT.chrome, 8);
    for (const o of [-1, 1]) {
      frustum(W, gy + 0.56, [vt + o * 0.02, vs, 0.008, 0.008],
        gy + 1.02, [vt + o * 0.34, vs + 0.10, 0.005, 0.005], KIT.chrome);
    }

    // ── the tabouret, and the Pelješac on it ──
    // Turned, because you look straight down at it from half a metre and a
    // four-sided leg seen from directly above is four sides. Each leg is one
    // `lathe` with the axis leaned over — a splay of 0.34 of the top spacing
    // across 0.68 m — with the swell a turner leaves at the knee and the taper
    // above it. Eight sides is enough at this size; the seat gets sixteen
    // because its rim is the one circle in the room at eye level.
    const bt = dc - 1.58, bs = 18.20;
    const LEG = [[0.000, 0.0140], [0.030, 0.0170], [0.072, 0.0146],
      [0.250, 0.0184], [0.430, 0.0150], [0.610, 0.0134], [0.680, 0.0126]];
    for (const o of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) {
      lathe(W, bt + o[0] * 1.34, bs + o[1] * 1.34,
        LEG.map(([h, r]) => [f + h, r, -0.34 * o[0] * (h / 0.68),
          -0.34 * o[1] * (h / 0.68)]), KIT.dark, 8);
    }
    // Stretchers. Four bars in a square a third of the way up, which is what
    // stops a stool this light from racking — and, more to the point here, what
    // the eye reads as a stool rather than as four sticks under a disc.
    const q = 0.11 * (1.34 - 0.34 * (0.221 / 0.68));
    for (const sg of [-1, 1]) {
      frustum(W, f + 0.212, [bt, bs + sg * q, q, 0.009],
        f + 0.230, [bt, bs + sg * q, q, 0.009], KIT.dark);
      frustum(W, f + 0.212, [bt + sg * q, bs, 0.009, q],
        f + 0.230, [bt + sg * q, bs, 0.009, q], KIT.dark);
    }
    // The seat: an underside, a rounded edge, and a top dished the two
    // millimetres that thirty summers of people put into one.
    lathe(W, bt, bs, [
      [f + 0.658, 0.000], [f + 0.658, 0.148], [f + 0.664, 0.162],
      [f + 0.702, 0.168], [f + 0.716, 0.162], [f + 0.721, 0.150],
    ], KIT.wood, 16);
    lathe(W, bt, bs, [
      [f + 0.721, 0.150], [f + 0.7225, 0.108], [f + 0.7215, 0.055],
      [f + 0.7200, 0.000],
    ], KIT.woodT, 16);
    // ── the glass, on the near edge of the same stool ──
    // On her side of the bottle and a hand's width off it: she stands at
    // `wine`, which is out past +t and +s, so this is the thing between her and
    // the bottle and the thing the bottle comes down over.
    //
    // 17 cm of stemware in two lathes — the vessel, and the wine — because the
    // wine is the one part that is not there until she has poured it. Sixteen
    // sides: this is 8 cm across and you look straight down into it from half a
    // metre, which is where a twelve-sided rim shows its corners.
    // These two numbers are not free. `WINE_POUR` in tools/blender/human_mh.py
    // puts her wrist 0.36 m in front of her, 0.29 m out to her right and
    // 1.08 m up, and this is where a glass has to be for the line from that
    // wrist to it to be a bottle pouring rather than a bottle held over
    // something: 0.30 m ahead of her standing mark, a hand's width to her
    // right, on a stool 0.72 m high. Move the stool, the mark or the pose and
    // the wine goes on the floor.
    // The height of the seat, which both of the things standing on it need.
    const by = f + 0.722;
    const gt = bt + 0.085, gs = bs + 0.090;
    lathe(W, gt, gs, [
      [by + 0.000, 0.0000], [by + 0.000, 0.0380], [by + 0.005, 0.0380],
      [by + 0.009, 0.0300], [by + 0.013, 0.0090],
      [by + 0.020, 0.0058], [by + 0.074, 0.0053],
      [by + 0.082, 0.0180], [by + 0.093, 0.0320], [by + 0.109, 0.0398],
      [by + 0.130, 0.0425], [by + 0.152, 0.0398], [by + 0.168, 0.0350],
      // and back down the inside, which exists because the material draws both
      // faces and a bowl with no inside is a lump.
      [by + 0.170, 0.0342], [by + 0.152, 0.0380], [by + 0.130, 0.0407],
      [by + 0.109, 0.0380], [by + 0.093, 0.0302], [by + 0.083, 0.0160],
      [by + 0.081, 0.0000],
    ], KIT.crystal, 16);

    // The bottle. A Dingač is a burgundy bottle — sloped shoulder, no punt you
    // can see, dark glass — and the shoulder is the whole silhouette.
    //
    // Its own mesh and not part of the room, because it is the one object in
    // here that moves: she picks it up. Built about its own base at the origin
    // so that a position and a yaw are all it ever needs, which is what lets it
    // sit on a tabouret one second and hang off a wrist the next.
    const bbuf = propBuilder();
    const keep = b;
    b = bbuf;
    const O = (dt, ds, y) => [dt, y, ds];
    // One profile, sixteen sides, and the shoulder sampled across five rings
    // rather than being one straight cone. The shoulder is the whole silhouette
    // of a burgundy bottle and it was a four-sided pyramid: `frustum` has a
    // rectangular section, which nobody notices on a chair leg and everybody
    // notices on the one object she holds up next to her face.
    //
    // Numbers off a real 0.75 l Dingač: 306 mm tall, 77 mm across the body, the
    // shoulder falling over about 85 mm to an 29 mm neck, and a lip that stands
    // proud of it. The mouth is left open — a bottle with a lid on it is a
    // skittle.
    lathe(O, 0, 0, [
      [0.000, 0.0000], [0.000, 0.0300], [0.005, 0.0368], [0.014, 0.0385],
      [0.146, 0.0385], [0.158, 0.0380], [0.171, 0.0364], [0.186, 0.0326],
      [0.201, 0.0266], [0.215, 0.0203], [0.229, 0.0162], [0.243, 0.0146],
      [0.286, 0.0144], [0.294, 0.0158], [0.303, 0.0160], [0.306, 0.0152],
      [0.299, 0.0112],
    ], KIT.glass, 16);
    // The label, and the band across it. Half a millimetre proud, which is
    // paper on glass and is also enough to keep it off the z-buffer's coin toss.
    lathe(O, 0, 0, [[0.048, 0.0390], [0.128, 0.0390]], KIT.cream, 16);
    lathe(O, 0, 0, [[0.112, 0.0393], [0.126, 0.0393]], KIT.foil, 16);
    // The capsule over the neck, down to where it is cut.
    lathe(O, 0, 0, [
      [0.256, 0.0148], [0.260, 0.0152], [0.290, 0.0152], [0.294, 0.0166],
      [0.303, 0.0168], [0.306, 0.0160], [0.300, 0.0118],
    ], KIT.foil, 16);
    // And the wrap, once it is on the floor: four soft folds of cloth and no
    // more. It is never skinned and never was — the game stops drawing the one
    // she is wearing on the frame she reaches the tug and starts drawing this,
    // which is the right way round for something that spends a second falling
    // and the rest of the afternoon lying there.
    const sbuf = propBuilder();
    b = sbuf;
    for (let i = 0; i < 4; i++) {
      const a0 = i * 0.6 + 0.35, r0 = 0.17 - i * 0.022;
      frustum(O, 0.004 + i * 0.011,
        [Math.cos(a0) * 0.05, Math.sin(a0) * 0.05, r0, r0 * 0.62],
        0.014 + i * 0.011,
        [Math.cos(a0) * 0.06, Math.sin(a0) * 0.06, r0 * 0.86, r0 * 0.50],
        KIT.wrap, KIT.wrap);
    }
    // What ends up in the glass, and what gets it there. Both are their own
    // meshes for the same reason the bottle is: they are not always there.
    // The wine is a lid on the bowl rather than a filled bowl — you can only
    // ever see its surface and the ring of it against the crystal — and it sits
    // a fraction inside the glass so the two do not argue about the z-buffer.
    const wbuf = propBuilder();
    b = wbuf;
    lathe(O, 0, 0, [
      [0.0810, 0.0000], [0.0830, 0.0148], [0.0930, 0.0290],
      [0.1090, 0.0368], [0.1220, 0.0380], [0.1220, 0.0000],
    ], KIT.wine, 16);
    // And the stream, built one metre long about its own base so that a scale
    // and a position are all it needs. Six sides at 3 mm: it is on screen for
    // about a second and it is 3 mm across.
    const jbuf = propBuilder();
    b = jbuf;
    lathe(O, 0, 0, [[0, 0.0032], [1, 0.0028]], KIT.wine, 6);
    b = keep;
    const inner = { spec: 0.05, specPower: 14, side: THREE.DoubleSide,
      emissive: 0.22, body: 'n = gl_FrontFacing ? n : -n; base *= vVCol;' };
    const bottle = new THREE.Mesh(bbuf.geo(), solidMaterial(0xffffff, inner));
    const bp = W(bt, bs, by);
    bottle.position.set(bp[0], bp[1], bp[2]);
    scene.add(bottle);
    const scarf = new THREE.Mesh(sbuf.geo(), solidMaterial(0xffffff, inner));
    scarf.visible = false;
    scene.add(scarf);
    const poured = new THREE.Mesh(wbuf.geo(), solidMaterial(0xffffff, inner));
    const gp = W(gt, gs, by);
    poured.position.set(gp[0], gp[1], gp[2]);
    poured.visible = false;
    scene.add(poured);
    const stream = new THREE.Mesh(jbuf.geo(), solidMaterial(0xffffff, inner));
    stream.visible = false;
    scene.add(stream);

    // ── the radio, on a small table against the near wall ──
    const rt = dc - 1.66, rs = 19.90;
    for (const o of [[-0.16, -0.12], [0.16, -0.12], [-0.16, 0.12], [0.16, 0.12]]) {
      post(facing(rt + o[0], rs + o[1], 0), 0, 0, f, f + 0.58, 0.020, KIT.dark, 5);
    }
    frustum(W, f + 0.58, [rt, rs, 0.200, 0.160],
      f + 0.62, [rt, rs, 0.200, 0.160], KIT.wood, KIT.woodT);
    const ry = f + 0.62;
    frustum(W, ry, [rt, rs, 0.150, 0.070], ry + 0.02, [rt, rs, 0.158, 0.076], KIT.gold);
    frustum(W, ry + 0.02, [rt, rs, 0.158, 0.076],
      ry + 0.17, [rt, rs, 0.158, 0.076], KIT.blue);
    frustum(W, ry + 0.17, [rt, rs, 0.158, 0.076],
      ry + 0.20, [rt, rs, 0.138, 0.060], KIT.blue, KIT.blue);
    // The carry handle over the top, and the aerial, which on these folds down
    // and is never folded down.
    for (const o of [-1, 1]) {
      frustum(W, ry + 0.19, [rt + o * 0.075, rs, 0.010, 0.010],
        ry + 0.255, [rt + o * 0.062, rs, 0.009, 0.009], KIT.gold);
    }
    boxTS(rt - 0.072, rt + 0.072, rs - 0.009, rs + 0.009,
      ry + 0.248, ry + 0.264, KIT.gold);
    frustum(W, ry + 0.19, [rt - 0.140, rs + 0.02, 0.006, 0.006],
      ry + 0.46, [rt - 0.170, rs + 0.05, 0.003, 0.003], KIT.chrome);
    {
      const p = W(rt, rs - 0.0765, ry + 0.095);
      radio.mesh.position.set(p[0], p[1], p[2]);
      const st = at(rt);
      radio.mesh.rotation.y = Math.atan2(-st.nx, -st.nz);
      scene.add(radio.mesh);
    }

    // ── the poster, on the wall the tabouret stands against ──
    // Behind the bottle and the glass, which is the whole brief: the wall at
    // `t0` is the one the stool is pushed up against, so anything hung on it
    // at the stool's own `s` is behind the wine from anywhere you can stand.
    // Six millimetres proud of the inner shell — the room's boards are already
    // held four clear of the walls they line, and two more keeps the frame off
    // the depth test's coin toss.
    const pt = K.t0 + 0.006, ps = bs, py = f + 1.34;
    const pw = 0.42, ph = 0.56, pb = 0.026, pd = 0.022;
    // Four bars and a hole, not a panel with a print stuck on it. A backing
    // board puts a second surface two millimetres behind the paper, and two
    // millimetres over a half-metre diagonal is half a degree — so the first
    // version of this buried half the poster in its own frame the moment the
    // wall and the plane disagreed by less than a degree. With nothing behind
    // it the paper hangs in the opening and the only thing it can argue with
    // is the wall, a centimetre back.
    const FRAME = [0.052, 0.048, 0.045];
    const s0 = ps - pw * 0.5, s1 = ps + pw * 0.5;
    const y0 = py - ph * 0.5, y1 = py + ph * 0.5;
    boxTS(pt, pt + pd, s0 - pb, s1 + pb, y1, y1 + pb, FRAME);
    boxTS(pt, pt + pd, s0 - pb, s1 + pb, y0 - pb, y0, FRAME);
    boxTS(pt, pt + pd, s0 - pb, s0, y0, y1, FRAME);
    boxTS(pt, pt + pd, s1, s1 + pb, y0, y1, FRAME);
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph),
      solidMaterial(0xffffff, {
        // Paper, so barely any specular — and emissive, for the same reason
        // the curtain is: this room has one doorway and no lamp, and a print
        // lit correctly for it is a print nobody will ever see.
        spec: 0.03, emissive: 0.46, vcol: false, side: THREE.DoubleSide,
        decl: 'uniform sampler2D uPosterMap;',
        body: 'base = texture2D(uPosterMap, vUv).rgb;',
        uniforms: { uPosterMap: { value: posterSkin() } },
      }));
    {
      const p = W(pt + pd * 0.5, ps, py);
      poster.position.set(p[0], p[1], p[2]);
      const st = at(pt);
      poster.rotation.y = Math.atan2(st.ux, st.uz);
      scene.add(poster);
    }

    radio.draw(0.30, 0.0);
    tv.draw(null, 0x2545);
    return {
      tv, radio, bottle, scarf, poured, stream,
      // Where the set is, for the jet to knock the knob on. The table top plus
      // a hand's width: aiming at a radio means aiming at the thing on the
      // table, not at the table.
      set: [rt, rs, ry + 0.02, 0.22, 0.26],
      // And where the tube is, for the same reason. A hair narrower than the
      // cabinet, so that a jet clipping the corner of the wood does not count
      // as changing the channel.
      screen: [vt, vs - 0.10, gy + 0.31, 0.24, 0.40],
      // Where the bottle lives when nobody is holding it, and where she has to
      // stand to be able to reach it: 0.55 m off it, turned to face it, which
      // is one pace and an arm.
      rest: [bt, bs, by],
      wine: [bt + 0.372, bs + 0.191, Math.atan2(-0.191, -0.372)],
      // The cot, for the dog: where he lies on it, how high the mattress is,
      // and where he stands on the floor to get up. Off `cm`/`cs0` rather than
      // typed, because the furniture moved outward on its own when the hut went
      // to two bays and this would have stayed where the hut used to be.
      cot: [cm, cms - 0.10, f + 0.44],
      cotFoot: [cm - 0.62, cms - 0.10],
      // Where the neck of the bottle has to end up. Not the rim: a lip resting
      // on the rim is a bottle being emptied by somebody who has never poured
      // one, so this is six centimetres over it, and the stream covers the gap.
      pourAt: [gt, gs, by + 0.230],
      // And where the stream stops, which is the surface of what is already in
      // the glass whether or not any of it is there yet.
      cupAt: [gt, gs, by + 0.122],
    };
  }

  /**
   * The set is on, and what it is showing is whatever the network will admit
   * to.
   *
   * One fetch when you walk in and another every `POLL` seconds you stay, and
   * the failure case is not an error message — it is snow, which is what a set
   * with no aerial signal does and is the honest answer to a game whose whole
   * disposition is that it opens off a memory stick with the wifi off. So this
   * is the one place in the build that touches the network, it degrades to
   * something better than what it degrades from, and nothing anywhere waits on
   * it.
   *
   * A price is never invented. Showing a plausible made-up number as though it
   * came off an exchange is worse than showing nothing, because it is the one
   * thing on this screen a player might act on.
   */
  const TVSET = { poll: 45, hiss: 0.16 };
  /**
   * The channels, in the order the knob goes round: four tickers and then the
   * gap at the end of the band.
   *
   * There is no fifth station to find, and that is the point of it. A knob you
   * can turn is a knob worth turning twice, and a set that goes round to snow
   * and then back to the beginning is what every television in every rented
   * room on this coast has always done. The last position is deliberately the
   * dead one rather than the best one: the reward for going all the way round
   * is finding out where the end is.
   *
   * `dp` is decimal places, because DOGE at nought decimal places is `$0` and
   * BTC at four is a number nobody can read across a dark room.
   */
  const TVCH = [
    { k: 'BTC', pair: 'BTC-USD', dp: 0 },
    { k: 'LTC', pair: 'LTC-USD', dp: 2 },
    { k: 'ETH', pair: 'ETH-USD', dp: 0 },
    { k: 'DOGE', pair: 'DOGE-USD', dp: 4 },
    null,                                   // and the end of the band
  ];
  let tvAsk = 0, tvHiss = 0, tvSeed = 1, tvBusy = false;
  // Which channel is on, and what each one last came back with. Cached per
  // ticker rather than as one live price, so that going round the dial a second
  // time puts the number straight back up instead of showing snow for however
  // long Coinbase takes to answer.
  let tvChan = 0;
  let tvRoll = 0;                           // seconds of snow after a knock
  let tvCool = 0;                           // and the latch on the knock itself
  const tvSeen = {};

  /** What the tube should be showing this instant, or null for snow. */
  function tvNow() {
    const c = TVCH[tvChan];
    if (!c || tvRoll > 0) return null;
    return tvSeen[c.pair] || null;
  }

  function tvPaint() {
    if (!kit) return;
    const c = TVCH[tvChan], p = tvNow();
    kit.tv.draw(p, tvSeed, c ? c.k + ' / USD' : '');
  }

  function tvFetch() {
    const c = TVCH[tvChan];
    if (tvBusy || !c || typeof fetch !== 'function') return;
    tvBusy = true;
    const want = c.pair;
    fetch('https://api.coinbase.com/v2/prices/' + want + '/spot', { mode: 'cors' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const v = j && j.data && parseFloat(j.data.amount);
        if (v > 0) {
          const d = TVCH.find((q) => q && q.pair === want).dp;
          tvSeen[want] = '$' + v.toLocaleString('en-US',
            { minimumFractionDigits: d, maximumFractionDigits: d });
          // Only if it is still the channel that is on: a slow answer for BTC
          // must not paint itself over DOGE forty seconds after you turned the
          // knob past it.
          if (TVCH[tvChan] && TVCH[tvChan].pair === want) tvPaint();
        }
      })
      .catch(() => {})
      .then(() => { tvBusy = false; });
  }

  /**
   * Where the tube is, for the jet — and only from inside the room, exactly as
   * the radio is gated. See `radioProbe`.
   */
  function tvProbe() {
    if (!kit || !special || !SET.near || !kit.screen) return null;
    const [vt, vs, vy, r, h] = kit.screen;
    const p = W(vt, vs, vy);
    return { x: p[0], y: p[1], z: p[2], r, h };
  }

  /** The jet has found the television: the knob goes round one. */
  function tvWet() {
    if (!kit || tvCool > 0) return;
    // The same latch the radio has, and for the same reason: `spray` calls this
    // every frame it is on target, and four hundred litres a minute without one
    // is not a channel change, it is a channel blur.
    tvCool = 0.85;
    tvChan = (tvChan + 1) % TVCH.length;
    // Half a second of snow on the way in. Every valve set does this and it is
    // the whole of why a channel change feels like one — without it the number
    // simply becomes a different number and nothing has happened.
    tvRoll = 0.42;
    tvAsk = 0;
    tvPaint();
    if (audio) audio.radioClick(!!TVCH[tvChan]);
  }

  let kit = null;
  /**
   * The set on the little table, and what it takes to get it going.
   *
   * `band` is -1 for a dead radio and an index into the dial otherwise. Water
   * is the switch. That is not a joke about Croatian wiring: this is a 1960s
   * valve set that has been sitting in a shut wooden box for thirty summers,
   * and the one interaction the room offers is a firefighting branch. Give the
   * player a hose and one thing in the room worth pointing it at, and what they
   * will do is point it — so the thing has to answer. Each further hit knocks
   * the tuning knob round to the next station and the last one turns it off,
   * which makes the knob worth turning more than once.
   */
  const SET = { band: -1, lit: 0, cool: 0, near: false };
  // `audio` is a module-level binding in 90-app.js that is filled in after this
  // file has already built the resort, so every call through it here is guarded.
  // The mixer is also the one subsystem allowed to be absent entirely — a
  // browser that will not give us an AudioContext still gets a beach.
  const setDial = () => (audio && audio.radioDial ? audio.radioDial()
    : [0.22, 0.53, 0.81]);

  /**
   * Where the radio is, for the jet — or nothing, if you are not in the room
   * with it. The gate is the point: without it the parabola reaches straight
   * through the seaward wall from the promenade and the one hidden thing at
   * Jadrija turns itself on for somebody who never found the door.
   */
  function radioProbe() {
    if (!kit || !special || !SET.near) return null;
    const [rt, rs, ry, r, h] = kit.set;
    const p = W(rt, rs, ry);
    return { x: p[0], y: p[1], z: p[2], r, h };
  }

  /** The jet has found it. */
  function radioWet() {
    if (!kit || SET.cool > 0) return;
    // A branch puts out four hundred litres a minute and `spray` calls this
    // every frame it is on target, which without a latch is thirty station
    // changes a second — a knob being spun, not a knob being knocked.
    SET.cool = 0.85;
    SET.band = SET.band + 1 >= setDial().length ? -1 : SET.band + 1;
    if (audio) audio.radioClick(SET.band >= 0);
  }

  function stepKabina(pt, ps, dt) {
    if (!kit || !special) return;
    const K = special;
    // Before the near gate, and with its own: the curtain is the one thing in
    // this room you can hear and see from the promenade, and it is still moving
    // for a second or two after you have gone through and stopped being near.
    if (beads) {
      beads.step(pt, ps,
        Math.hypot(pt - K.dc, ps - (K.face + 0.075)), dt);
    }
    // Kept outside the near gate below, because a radio you can hear from the
    // promenade is most of what makes anybody walk over and look through the
    // door. Only the *aiming* is confined to the room.
    const [rt, rs] = kit.set;
    const dr = Math.hypot(pt - rt, ps - rs);
    SET.near = pt > K.t0 - 1.0 && pt < K.t1 + 1.0
      && ps > K.face - 0.6 && ps < K.s1 + 0.6;
    SET.cool = Math.max(0, SET.cool - dt);
    if (audio) audio.radioTune(SET.band >= 0, Math.max(0, SET.band), dr < 40 ? dr : null);
    // The dial lamp takes a moment to come up and a moment to die, because a
    // valve does.
    const want = SET.band >= 0 ? 1 : 0;
    if (Math.abs(SET.lit - want) > 0.002) {
      SET.lit += (want - SET.lit) * Math.min(1, dt * 2.2);
      kit.radio.draw(setDial()[Math.max(0, SET.band)], SET.lit);
    }
    // Only while you are in the room, or near enough to see into it. A
    // television redrawing a canvas six times a second on the far side of a
    // shut door is a texture upload nobody is looking at.
    tvCool = Math.max(0, tvCool - dt);
    if (pt < K.t0 - 3 || pt > K.t1 + 3 || ps < K.face - 4 || ps > K.s1 + 2) return;
    tvAsk -= dt;
    if (tvAsk <= 0) { tvAsk = TVSET.poll; tvFetch(); }
    // The snow after a knock, and the settle at the end of it. The settle is a
    // repaint of one frame and has to happen even when the channel is showing a
    // price — otherwise the roll never clears and the set stays on static.
    if (tvRoll > 0) {
      tvRoll -= dt;
      if (tvRoll <= 0) { tvRoll = 0; tvPaint(); }
    }
    if (tvNow() != null) return;
    tvHiss -= dt;
    if (tvHiss <= 0) {
      tvHiss = TVSET.hiss;
      tvSeed = (tvSeed * 1103515245 + 12345) | 0;
      tvPaint();
    }
  }

  if (special) kit = kabinaKit(special);

  // ── the village ────────────────────────────────────────────────────────────
  /**
   * The houses behind the promenade, rebuilt from their own footprints.
   *
   * These are real buildings — OpenStreetMap has 286 of them in this box — and
   * the town builder already draws every one. What it draws is right for three
   * hundred metres and wrong for two: an extruded outline, a pitched cap, and
   * windows painted on by the facade shader as flat rectangles with no depth in
   * them. At eye height the giveaway is not the window, it is that nothing on
   * the whole building projects: no eave, no sill, no shutter, no plinth, so
   * there is not one shadow anywhere on it and it reads as a photograph of a
   * house rather than a house.
   *
   * So the ones you can get near are taken out of the town and built again with
   * the things that stick out. Same footprints, same heights, same roof pitch —
   * nothing here invents a building that is not there.
   */
  const HOUSE = {
    // How far inland a house is worth rebuilding. A house is worth rebuilding
    // when you can walk up to it, so this tracks `reachIn` and sits a little
    // outside it — the far side of the lane you are standing in still has to
    // have eaves on it.
    // 48 m, and now 64: with half as many of them left there is room to
    // rebuild the far side of the second lane as well, and the far side of the
    // second lane is most of what you see over the roofs of the first.
    reach: 64,
    over: 0.42,          // eave overhang
    win: 1.16,           // window width
    winH: 1.42,
    storey: 3.05,
  };
  const RENDER = [
    [0.760, 0.726, 0.648], [0.800, 0.762, 0.672], [0.726, 0.688, 0.606],
    [0.782, 0.730, 0.618], [0.742, 0.716, 0.664], [0.796, 0.740, 0.634],
    [0.712, 0.692, 0.640],
  ];
  const TILE = [
    [0.452, 0.238, 0.156], [0.505, 0.272, 0.176], [0.398, 0.212, 0.148],
    [0.470, 0.286, 0.198], [0.428, 0.246, 0.180],
  ];
  const SHUT = [
    [0.196, 0.268, 0.204], [0.235, 0.212, 0.168],
    [0.180, 0.226, 0.262], [0.286, 0.252, 0.196],
  ];
  const SURR = [0.815, 0.795, 0.742];        // the painted surround round an opening
  const PLINTH = [0.560, 0.540, 0.492];
  const GLASS = [0.070, 0.082, 0.092];
  const FASCIA = [0.640, 0.620, 0.575];

  const vil = propBuilder();
  const taken = new Set();
  const houses = [];
  const census = { seen: 0, thin: 0, plain: 0, rich: 0 };
  /** Footprints that survived the thinning, for the wood to keep out of. */
  const standing = [];

  /**
   * One house. Walls follow the real polygon, because the silhouette is what you
   * read at eye height; the roof and the plinth are built on the footprint's
   * bounding box in its own principal axes, because a hip needs a rectangle and
   * the overhang covers the difference on the handful that are L-shaped.
   */
  /**
   * One slope of a roof, drawn as courses of tile rather than as one plane.
   *
   * `e0,e1` are the two ends of the eave and `r0,r1` the two ends of the ridge
   * — pass the same point twice for `r0` and `r1` and you get a hip end, which
   * is a triangle, without a second code path for it.
   *
   * Each course is lapped: proud at its lower edge, flush at its upper one, so
   * the riser between one course and the next is a real face with a real
   * normal and catches a real shadow. Seven of them is enough — the eighth is
   * below the resolution of anything you can stand near.
   */
  function tiledSlope(e0, e1, r0, r1, col, riserCol, K = 7) {
    const L = (a, q, t) => [a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t,
      a[2] + (q[2] - a[2]) * t];
    const up = (q, d) => [q[0], q[1] + d, q[2]];
    const lap = 0.052;
    for (let k = 0; k < K; k++) {
      const t0 = k / K, t1 = (k + 1) / K;
      const a0 = L(e0, r0, t0), a1 = L(e1, r1, t0);
      const b0 = L(e0, r0, t1), b1 = L(e1, r1, t1);
      // A hip end closes to a point, and the last band of one is a triangle.
      const degen = Math.abs(b0[0] - b1[0]) < 1e-4 && Math.abs(b0[2] - b1[2]) < 1e-4;
      if (degen) vil.tri(up(a0, lap), up(a1, lap), b0, col);
      else vil.quad(up(a0, lap), up(a1, lap), b1, b0, col);
      vil.quad(a0, a1, up(a1, lap), up(a0, lap), riserCol);
    }
  }

  /**
   * A ridge or hip cap: a shallow prism laid along a line, gable-side up.
   *
   * Written against world up rather than against the slope's own normal, which
   * is wrong by the pitch angle and invisible at a hundred and ninety
   * millimetres wide.
   */
  function capLine(p, q, w, h, col) {
    const dx = q[0] - p[0], dz = q[2] - p[2];
    const L = Math.hypot(dx, dz) || 1;
    const ox = (dz / L) * w * 0.5, oz = (-dx / L) * w * 0.5;
    const A = [p[0] - ox, p[1], p[2] - oz], B = [p[0] + ox, p[1], p[2] + oz];
    const C = [q[0] + ox, q[1], q[2] + oz], D = [q[0] - ox, q[1], q[2] - oz];
    const P0 = [p[0], p[1] + h, p[2]], Q0 = [q[0], q[1] + h, q[2]];
    vil.quad(A, B, Q0, P0, col);
    vil.quad(C, D, P0, Q0, col);
    vil.tri(B, A, P0, col);
    vil.tri(D, C, Q0, col);
  }

  function detailHouse(poly, hTag, r) {
    const n = poly.length;
    let cx = 0, cz = 0;
    for (const p of poly) { cx += p[0]; cz += p[1]; }
    cx /= n; cz /= n;
    // The vikendica stands on this lane, and one of the footprints out of OSM
    // stands exactly where it does — a generated grey box through the middle of
    // the living room, and a blocker with it that ejects you the moment you are
    // put inside. Whichever is real, the modelled one wins.
    {
      const [ht, hs] = local(cx, cz);
      if (Math.hypot(ht - VIK.t, hs - VIK.s) < 7.5) return;
    }
    const [ax, az] = principalAxis(poly, cx, cz);
    // The cross product of these two has to come out +Y or every box built in
    // this frame is inside out. (az, -ax) does; (-az, ax) does not.
    const bx = az, bz = -ax;
    const P = (u, v, y) => [cx + ax * u + bx * v, y, cz + az * u + bz * v];
    let a0 = 1e9, a1 = -1e9, v0 = 1e9, v1 = -1e9, gLo = 1e9, gHi = -1e9;
    for (const p of poly) {
      const du = (p[0] - cx) * ax + (p[1] - cz) * az;
      const dv = (p[0] - cx) * bx + (p[1] - cz) * bz;
      a0 = Math.min(a0, du); a1 = Math.max(a1, du);
      v0 = Math.min(v0, dv); v1 = Math.max(v1, dv);
      const g = Math.max(groundAt(p[0], p[1]), 0);
      gLo = Math.min(gLo, g); gHi = Math.max(gHi, g);
    }
    const base = gHi;
    const sink = gLo - 1.6;                  // buried on the uphill side
    const top = base + Math.max(hTag, 4.6);
    const rise = Math.min((v1 - v0) * 0.26, 1.9);
    const eave = top - rise;
    const wall = RENDER[(r() * RENDER.length) | 0];
    const tile = TILE[(r() * TILE.length) | 0];
    const shut = SHUT[(r() * SHUT.length) | 0];

    // Plinth: the footprint pushed out from its own centre. Scaling about the
    // centroid rather than offsetting the edges is wrong by a few centimetres on
    // a long thin plan and exactly right on a square one, which is what these are.
    const swell = 1 + 0.16 / Math.max(2, Math.hypot(a1 - a0, v1 - v0) * 0.25);
    for (let i = 0; i < n; i++) {
      const p = poly[i], q = poly[(i + 1) % n];
      const px = cx + (p[0] - cx) * swell, pz = cz + (p[1] - cz) * swell;
      const qx = cx + (q[0] - cx) * swell, qz = cz + (q[1] - cz) * swell;
      vil.quad([px, sink, pz], [qx, sink, qz],
        [qx, base + 0.46, qz], [px, base + 0.46, pz], PLINTH);
      // Wall above it, on the true outline.
      vil.quad([p[0], base + 0.46, p[1]], [q[0], base + 0.46, q[1]],
        [q[0], eave, q[1]], [p[0], eave, p[1]], wall);
    }

    // A string course between the ground floor and the first, on the houses
    // that have two. It is a two-centimetre band of render and it is why a
    // Dalmatian street front does not read as one flat sheet from the far side
    // of a lane — the shadow under it cuts the wall in half.
    const bands = Math.floor((eave - base) / HOUSE.storey);
    if (bands >= 2 && r() < 0.72) {
      const by = base + HOUSE.storey - 0.28;
      for (let i = 0; i < n; i++) {
        const p = poly[i], q = poly[(i + 1) % n];
        let ox = (q[1] - p[1]), oz = -(q[0] - p[0]);
        const Ln = Math.hypot(ox, oz) || 1; ox /= Ln; oz /= Ln;
        const mx = (p[0] + q[0]) * 0.5, mz = (p[1] + q[1]) * 0.5;
        if ((mx - cx) * ox + (mz - cz) * oz < 0) { ox = -ox; oz = -oz; }
        const o = 0.075;
        vil.quad([p[0] + ox * o, by, p[1] + oz * o], [q[0] + ox * o, by, q[1] + oz * o],
          [q[0] + ox * o, by + 0.17, q[1] + oz * o], [p[0] + ox * o, by + 0.17, p[1] + oz * o],
          SURR);
        vil.quad([p[0], by + 0.17, p[1]], [q[0], by + 0.17, q[1]],
          [q[0] + ox * o, by + 0.17, q[1] + oz * o], [p[0] + ox * o, by + 0.17, p[1] + oz * o],
          SURR);
      }
    }

    // Dressed corners, on about half of them. One pilaster of pale stone up
    // each corner of the footprint: the cheapest thing on this whole list and
    // the one that most reliably stops a house reading as an extruded outline,
    // because it is the only vertical relief on the building.
    if (r() < 0.52) {
      for (let i = 0; i < n; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % n], o = poly[(i + n - 1) % n];
        // Skip the corners that are barely corners — an OSM footprint has
        // plenty of 175-degree ones and a pilaster on a straight wall is a
        // stripe.
        const a1x = q[0] - p[0], a1z = q[1] - p[1];
        const a2x = o[0] - p[0], a2z = o[1] - p[1];
        const L1 = Math.hypot(a1x, a1z) || 1, L2 = Math.hypot(a2x, a2z) || 1;
        if ((a1x * a2x + a1z * a2z) / (L1 * L2) < -0.90) continue;
        const dx = (p[0] - cx), dz = (p[1] - cz);
        const L = Math.hypot(dx, dz) || 1;
        const px = p[0] + (dx / L) * 0.05, pz = p[1] + (dz / L) * 0.05;
        boxIn((u, v, y) => [px + u, y, pz + v], -0.19, 0.19, -0.19, 0.19,
          base + 0.46, eave - 0.02, SURR);
      }
    }

    // Openings, walked along each wall so a long face gets a rhythm and a short
    // one gets one window rather than a squeezed pair.
    const storeys = Math.max(1, Math.min(3, Math.floor((eave - base) / HOUSE.storey)));
    // One of these openings is a door, and until now none of them was — which
    // is a strange thing to be able to say about fourteen houses you can walk
    // right up to. It goes on the longest wall, because that is the one facing
    // the lane on nearly all of them, and it takes over whichever ground-floor
    // slot is nearest the middle of it rather than being squeezed in beside
    // them: a door between two windows is a door, a door under a window is a
    // mistake.
    let doorWall = -1, doorBest = 3.6;
    for (let i = 0; i < n; i++) {
      const p = poly[i], q = poly[(i + 1) % n];
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (L > doorBest) { doorBest = L; doorWall = i; }
    }
    for (let i = 0; i < n; i++) {
      const p = poly[i], q = poly[(i + 1) % n];
      const ex = q[0] - p[0], ez = q[1] - p[1];
      const L = Math.hypot(ex, ez);
      if (L < 2.4) continue;
      const ux = ex / L, uz = ez / L;
      // Outward normal of this edge. Which of the two perpendiculars is outward
      // depends on the winding of the footprint, and OSM does not promise one —
      // so it is decided per edge by asking which way points away from the
      // centroid. Guessing put every sill, lintel and shutter *inside* the house
      // on about half of them, and the only symptom was walls that had gone
      // blank again with a few white dashes where a 2 cm lip poked back out.
      let ox = uz, oz = -ux;
      const mx = (p[0] + q[0]) * 0.5, mz = (p[1] + q[1]) * 0.5;
      if ((mx - cx) * ox + (mz - cz) * oz < 0) { ox = -ox; oz = -oz; }
      const E = (d, w, y) => [p[0] + ux * d + ox * w, y, p[1] + uz * d + oz * w];
      const slots = Math.max(1, Math.floor((L - 1.4) / 2.65));
      const gap = L / (slots + 1);
      const doorSlot = i === doorWall ? Math.max(1, Math.round((slots + 1) / 2)) : -1;
      for (let k = 1; k <= slots; k++) {
        const d = k * gap;
        for (let st = 0; st < storeys; st++) {
          const sill = base + 0.95 + st * HOUSE.storey;
          if (sill + HOUSE.winH + 0.35 > eave) continue;
          const hw = HOUSE.win / 2;
          if (st === 0 && k === doorSlot) {
            // The door: a leaf set back in its own reveal, a painted surround
            // round three sides of it, and a step. The step is the half of it
            // that matters — it is the one thing on the whole building that
            // meets the ground, and without it the wall simply stops at the
            // lane like a sheet of card pushed into sand.
            const dw = 0.52, dh = 2.10;
            boxIn((d2, w, y) => E(d + d2, w, y),
              -dw, dw, 0.02, 0.09, base + 0.10, base + 0.10 + dh,
              [0.276, 0.226, 0.168]);
            for (const sgn of [-1, 1]) {
              boxIn((d2, w, y) => E(d + d2, w, y),
                sgn * dw, sgn * (dw + 0.15), -0.02, 0.12,
                base + 0.10, base + 0.24 + dh, SURR);
            }
            boxIn((d2, w, y) => E(d + d2, w, y),
              -dw - 0.15, dw + 0.15, -0.02, 0.12,
              base + 0.10 + dh, base + 0.24 + dh, SURR);
            boxIn((d2, w, y) => E(d + d2, w, y),
              -dw - 0.24, dw + 0.24, -0.02, 0.46, base - 0.20, base + 0.10,
              PLINTH, SURR);
            // And a handle, which is four faces and is the thing that tells
            // you which way the door opens.
            boxIn((d2, w, y) => E(d + d2, w, y),
              dw - 0.16, dw - 0.10, 0.09, 0.145,
              base + 1.02, base + 1.10, [0.520, 0.470, 0.300]);
            continue;
          }
          // Glass, barely proud of the render so it never z-fights it.
          boxIn((d2, w, y) => E(d + d2, w, y),
            -hw, hw, 0.015, 0.05, sill, sill + HOUSE.winH, GLASS);
          // The sill is the piece that does the work: it is the only horizontal
          // face on the whole wall, so it is the only thing that catches the sun
          // and puts a line of shadow under itself.
          boxIn((d2, w, y) => E(d + d2, w, y),
            -hw - 0.14, hw + 0.14, -0.02, 0.17, sill - 0.11, sill, SURR);
          boxIn((d2, w, y) => E(d + d2, w, y),
            -hw - 0.12, hw + 0.12, -0.02, 0.10, sill + HOUSE.winH, sill + HOUSE.winH + 0.11,
            SURR);
          // Jambs, to close the surround. Four sides of relief round an opening
          // is the whole difference between a window and a rectangle of paint.
          for (const s of [-1, 1]) {
            boxIn((d2, w, y) => E(d + d2, w, y),
              s * hw, s * (hw + 0.12), -0.02, 0.09, sill, sill + HOUSE.winH, SURR);
          }
          const roll = r();
          if (roll < 0.42) {
            // Shut against the afternoon, which is most of them at this hour.
            boxIn((d2, w, y) => E(d + d2, w, y),
              -hw - 0.03, hw + 0.03, 0.05, 0.115, sill + 0.02, sill + HOUSE.winH - 0.02, shut);
          } else if (roll < 0.86) {
            for (const s of [-1, 1]) {
              boxIn((d2, w, y) => E(d + d2, w, y),
                s * hw, s * (hw + 0.56), 0.05, 0.115,
                sill + 0.02, sill + HOUSE.winH - 0.02, shut);
            }
          }
        }
      }
    }

    // Roof: a hip on the bounding box, overhanging, with a fascia under the eave
    // so there is a shadow line all the way round.
    const A0 = a0 - HOUSE.over, A1 = a1 + HOUSE.over;
    const V0 = v0 - HOUSE.over, V1 = v1 + HOUSE.over;
    const hipIn = Math.min((V1 - V0) * 0.5, (A1 - A0) * 0.34);
    const R0 = A0 + hipIn, R1 = A1 - hipIn, VM = (V0 + V1) * 0.5;
    const Q = (u, v, y) => P(u, v, y);
    // Four flat quads is what this used to be, and four flat quads is a roof
    // you believe from an aeroplane and from nowhere else. What you actually
    // read on a Dalmatian roof at fifteen metres is not its colour and not its
    // pitch: it is that it is made of *courses*, each one lapped over the one
    // below, so the whole slope is a stack of horizontal shadow lines running
    // out to a capped ridge. That is what `tiledSlope` draws, and it is the
    // single biggest thing on this pass.
    const darker = [tile[0] * 0.72, tile[1] * 0.70, tile[2] * 0.70];
    tiledSlope(Q(A0, V0, eave), Q(A1, V0, eave), Q(R0, VM, top), Q(R1, VM, top),
      tile, darker);
    tiledSlope(Q(A1, V1, eave), Q(A0, V1, eave), Q(R1, VM, top), Q(R0, VM, top),
      tile, darker);
    tiledSlope(Q(A0, V1, eave), Q(A0, V0, eave), Q(R0, VM, top), Q(R0, VM, top),
      tile, darker);
    tiledSlope(Q(A1, V0, eave), Q(A1, V1, eave), Q(R1, VM, top), Q(R1, VM, top),
      tile, darker);
    // The ridge and the four hips, capped. Half-round ridge tile is the piece
    // that finishes every one of these roofs and it is the piece you see from
    // furthest away, because it is the only bit of the building that is a line
    // against the sky.
    const cap = [tile[0] * 1.06, tile[1] * 1.04, tile[2] * 1.02];
    capLine(Q(R0, VM, top), Q(R1, VM, top), 0.19, 0.10, cap);
    capLine(Q(A0, V0, eave), Q(R0, VM, top), 0.17, 0.09, cap);
    capLine(Q(A1, V0, eave), Q(R1, VM, top), 0.17, 0.09, cap);
    capLine(Q(A0, V1, eave), Q(R0, VM, top), 0.17, 0.09, cap);
    capLine(Q(A1, V1, eave), Q(R1, VM, top), 0.17, 0.09, cap);
    boxIn(P, A0, A1, V0, V0 + 0.10, eave - 0.20, eave, FASCIA);
    boxIn(P, A0, A1, V1 - 0.10, V1, eave - 0.20, eave, FASCIA);
    boxIn(P, A0, A0 + 0.10, V0, V1, eave - 0.20, eave, FASCIA);
    boxIn(P, A1 - 0.10, A1, V0, V1, eave - 0.20, eave, FASCIA);
    // A gutter under two of them, and a pipe off one end of it. Half-round in
    // life, a box here, and the reason it earns its four faces is that it is
    // the one thing on the building that is *away* from the wall: it throws a
    // hard line of shadow down the render all afternoon.
    for (const [vv, out] of [[V0, -1], [V1, 1]]) {
      boxIn(P, A0 + 0.06, A1 - 0.06, vv + out * 0.02, vv + out * 0.14,
        eave - 0.30, eave - 0.19, [0.560, 0.556, 0.532]);
    }
    {
      const du = r() < 0.5 ? A0 + 0.24 : A1 - 0.24;
      const vv = r() < 0.5 ? V0 : V1;
      boxIn(P, du - 0.055, du + 0.055,
        vv + (vv === V0 ? -0.10 : 0.02), vv + (vv === V0 ? 0.02 : 0.10),
        base, eave - 0.24, [0.560, 0.556, 0.532]);
    }

    // A chimney, and a satellite dish or an air-conditioner, because every one
    // of these houses has been let out to somebody for the last thirty summers.
    const chu = a0 + (a1 - a0) * (0.22 + r() * 0.56);
    boxIn(P, chu - 0.28, chu + 0.28, VM - 0.28, VM + 0.28,
      top - 0.4, top + 0.85, PLINTH, [0.22, 0.20, 0.19]);
    if (r() < 0.62) {
      const du = a0 + (a1 - a0) * r();
      boxIn(P, du - 0.30, du + 0.30, v1 + 0.02, v1 + 0.28,
        eave - 1.5, eave - 0.95, [0.78, 0.77, 0.74]);
    }

    // The terrace, on whichever long side faces the water, with a railing. It is
    // the single most Dalmatian thing on the building and it is where everybody
    // in the house actually is.
    if (r() < 0.55 && eave - base > 5.2) {
      const sea = jadSeaward(cx, cz, bx, bz) ? v1 : v0;
      const out = sea === v1 ? 1 : -1;
      const y = base + HOUSE.storey - 0.15;
      const u0 = a0 + (a1 - a0) * 0.12, u1 = a0 + (a1 - a0) * 0.88;
      boxIn(P, u0, u1, sea, sea + out * 1.7, y - 0.22, y, PLINTH, FASCIA);
      const rail = sea + out * 1.62;
      boxIn(P, u0, u1, rail - 0.05, rail + 0.05, y + 0.92, y + 1.02, FASCIA);
      for (let k = 0; k <= 6; k++) {
        const u = u0 + (u1 - u0) * (k / 6);
        boxIn(P, u - 0.045, u + 0.045, rail - 0.04, rail + 0.04, y, y + 0.95, FASCIA);
      }
    }

    houses.push({ cx, cz, ax, az, a: (a1 - a0) * 0.5 + 0.15, c: (v1 - v0) * 0.5 + 0.15 });
  }

  /** Does the local +v axis point out to sea? Used to face terraces the right way. */
  function jadSeaward(cx, cz, bx, bz) {
    const [, s] = local(cx, cz);
    const [, s2] = local(cx + bx * 6, cz + bz * 6);
    return s2 < s;
  }

  {
    const hr = mulberry32(CONFIG.seed ^ 0x0ba5e1);
    // Counted rather than guessed at. "Too many houses" is a judgement made
    // from the promenade and the only way to answer it honestly is to know how
    // many of the things are in the box, how many were thinned out of it, and
    // how many of the survivors were near enough the water to be worth
    // building properly. See `stats()`.
    census.seen = census.thin = census.plain = census.rich = 0;
    for (const bl of world.town) {
      const poly = bl.p;
      if (!poly || poly.length < 3 || poly.length > 12) continue;
      let cx = 0, cz = 0;
      for (const p of poly) { cx += p[0]; cz += p[1]; }
      cx /= poly.length; cz /= poly.length;
      const [t, s] = local(cx, cz);
      // The box the thinning is allowed to work in.
      //
      // It used to be the strip behind the beach — 80 m either end of the
      // 189 m promenade and 130 m deep — and that is why halving the rate
      // twice changed the view so little. Only 142 of the headland's
      // footprints were ever inside it; the rest were the city builder's and
      // had never been thinned at all, so 121 houses came out of a strip you
      // can walk in twenty seconds while the hillside behind it stayed a solid
      // roof. Fixing the rate was fixing the wrong number.
      //
      // Jadrija is a peninsula and this now covers it: 300 m either end and
      // 340 m back off the water, which runs out to the neck. Past the neck is
      // Zablaće and the road to Šibenik, and those are somebody else's houses.
      if (t < -300 || t > 700 || s < -6 || s > 340) continue;
      census.seen++;
      // Thinning.
      //
      // OSM has 286 footprints in this box and the aerial does not. Some of
      // that is real — the mapper has traced every shed, terrace roof and lean-
      // to as its own building — and some of it is that a footprint drawn at
      // full height is a house whether it is one or not. Whatever the cause,
      // what you see standing on the promenade is a solid grey mass where the
      // photograph shows separate houses with gaps and olive between them.
      //
      // So a bit under half of them come out, deterministically, and they come
      // out of the town builder too rather than being merely undrawn here: the
      // gap is the point. Nothing near the water is thinned, because there is
      // nothing there to thin — OSM maps nothing within 39 m of this shore.
      // The rate, over the box above.
      //
      // It has been raised twice before now — 0.44, then 0.72 — on the same
      // report each time, and each time the view barely moved, because the box
      // it applied to held 142 of the peninsula's 436 footprints and the other
      // 294 were never in the argument. Widening the box is what makes the rate
      // mean anything; with it wide, the rate can come back down.
      //
      // 0.62 was arithmetic and not taste. What stood on this headland before
      // was 40 houses out of the old box plus all 294 outside it — 334. Half of
      // 334 is 167, and 0.62 over 436 leaves 166. That is the halving that was
      // asked for, measured against what was actually standing rather than
      // against the number in the source line.
      //
      // 0.75 is the same arithmetic run once more. Seen from the promenade the
      // 166 still read as a solid wall of roof, so a third of them come out
      // again: 0.38 of the box surviving becomes 0.38 x 0.67 = 0.25, which is a
      // rate of 0.75. The aerial is the argument — behind this shore is pine
      // wood with houses scattered *in* it, and the wood has to be able to show
      // through.
      if (hr() < 0.75) { taken.add(bl); census.thin++; continue; }
      // A survivor. Whatever is drawn where it stands, nothing is planted
      // there — see `grove` below, which needs this list and is the reason it
      // is gathered here rather than derived again from `world.town`.
      standing.push(poly);
      if (s > HOUSE.reach) { census.plain++; continue; }
      taken.add(bl);
      census.rich++;
      detailHouse(poly, bl.h || 6, hr);
    }
  }

  // ── the wood the village stands in ─────────────────────────────────────────
  //
  // Jadrija is not a village with trees in it. It is an Aleppo pine wood with a
  // village in it, and the difference is the whole character of the place: from
  // anywhere on the peninsula you are under a broken ceiling of pine, standing
  // on a floor of dead needles, looking at the channel through bare trunks.
  //
  // The cover map does not know this and cannot be made to. The peninsula is
  // baked URBAN — correctly, because it *is* built up, and because URBAN is
  // what the fuel model and the fire want it to be — and `GROWS[URBAN]` is a
  // cypress every twenty metres, which is a suburb. So the wood is answered
  // here, by the locale that owns the headland, and 45-trees.js asks.
  //
  // Everything else about a tree stays the tile system's job: the two LODs, the
  // instance budget, the density slider a phone turns down, the shadow pass.
  // This only says what grows.
  const GROVE = {
    // The peninsula, in the resort's own frame — the same box the thinning
    // above works in, and for the same reason. Past the neck is Zablaće and
    // somebody else's trees.
    t0: -300, t1: 300, s0: -6, s1: 340,
    // How close to a standing house is still its garden. Two metres of pad on
    // the footprint's own bounding box: OSM traces the walls, and what is not
    // wanted is a thirteen-metre pine coming up through a roof.
    pad: 2.0,
    // And the grid the footprints are bucketed into, so the test above is a
    // constant-time lookup and not a scan of a hundred and sixty polygons per
    // dart. 24 m is a little over the longest footprint on the headland.
    cell: 24,
  };

  // And the colour of the ground it stands on. The terrain shader owns the
  // pixels — see the needle floor in TERRAIN_FRAG — and all it needs is where
  // the headland is: a centre, the shore's own direction, and how far the wood
  // reaches along it and back off it. Written once, here, because this is the
  // only thing in the game that knows.
  {
    const c = toWorld(gapAt, 130);
    const a = toWorld(gapAt + 40, 130);
    const dx = a[0] - c[0], dz = a[2] - c[2];
    const inv = 1 / Math.max(1e-6, Math.hypot(dx, dz));
    U.uLitterAx.value.set(dx * inv, dz * inv);
    U.uLitter.value.set(c[0], c[2], gapAt + 300, 190);
  }

  const grove = (() => {
    // Bucket every surviving footprint by its bounding box.
    const grid = new Map();
    const key = (i, k) => i * 65536 + k;
    let n = 0;
    for (const poly of standing) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of poly) {
        if (p[0] < x0) x0 = p[0];
        if (p[0] > x1) x1 = p[0];
        if (p[1] < z0) z0 = p[1];
        if (p[1] > z1) z1 = p[1];
      }
      const box = [x0 - GROVE.pad, x1 + GROVE.pad, z0 - GROVE.pad, z1 + GROVE.pad];
      for (let i = Math.floor(box[0] / GROVE.cell); i <= Math.floor(box[1] / GROVE.cell); i++) {
        for (let k = Math.floor(box[2] / GROVE.cell); k <= Math.floor(box[3] / GROVE.cell); k++) {
          const kk = key(i, k);
          let list = grid.get(kk);
          if (!list) grid.set(kk, list = []);
          list.push(box);
        }
      }
      n++;
    }

    // And out of the three compounds, which are not OSM footprints and so are
    // not in `standing`. A pine coming up through the trampoline park is the
    // same bug as one coming up through a roof, and the aerial had one right
    // in the middle of the beds.
    for (const K of [PLAY, SAN, TRAMP]) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let u = 0; u <= 1.001; u += 0.125) {
        for (const [tt, ss] of [[K.t0 + (K.t1 - K.t0) * u, K.s0],
          [K.t0 + (K.t1 - K.t0) * u, K.s1],
          [K.t0, K.s0 + (K.s1 - K.s0) * u], [K.t1, K.s0 + (K.s1 - K.s0) * u]]) {
          const w = toWorld(tt, ss);
          if (w[0] < x0) x0 = w[0];
          if (w[0] > x1) x1 = w[0];
          if (w[2] < z0) z0 = w[2];
          if (w[2] > z1) z1 = w[2];
        }
      }
      const box = [x0 - 1.2, x1 + 1.2, z0 - 1.2, z1 + 1.2];
      for (let i = Math.floor(box[0] / GROVE.cell); i <= Math.floor(box[1] / GROVE.cell); i++) {
        for (let k = Math.floor(box[2] / GROVE.cell); k <= Math.floor(box[3] / GROVE.cell); k++) {
          const kk = key(i, k);
          let list = grid.get(kk);
          if (!list) grid.set(kk, list = []);
          list.push(box);
        }
      }
    }

    /** Is (x, z) inside a standing house, or close enough to be its wall? */
    function built(x, z) {
      const list = grid.get(key(Math.floor(x / GROVE.cell), Math.floor(z / GROVE.cell)));
      if (!list) return false;
      for (const b of list) {
        if (x > b[0] && x < b[1] && z > b[2] && z < b[3]) return true;
      }
      return false;
    }

    // The world box the peninsula occupies, so a 512 m vegetation tile can ask
    // whether it is worth throwing the extra darts at all before it throws any.
    // Walked rather than cornered: the shore is a polyline, so the four
    // corners of the (t, s) box do not bound the world quad it maps to.
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
    for (let t = GROVE.t0; t <= LEN + GROVE.t1; t += 20) {
      for (const sv of [GROVE.s0, GROVE.s1 * 0.5, GROVE.s1]) {
        const w = toWorld(t, sv);
        if (w[0] < bx0) bx0 = w[0];
        if (w[0] > bx1) bx1 = w[0];
        if (w[2] < bz0) bz0 = w[2];
        if (w[2] > bz1) bz1 = w[2];
      }
    }

    // The two mixes, and they are read off the footage rather than invented.
    // Near the water and through the village it is pine and almost nothing
    // else — bare orange floor, trunks you see the sea through, no undergrowth
    // whatever, which is what an Aleppo stand on limestone actually looks like
    // once the summer has had it. Back towards the neck the pines give way to
    // the olive terraces and the car park under them, so olive comes up and
    // pine comes down.
    //
    // `bush` stays low everywhere and that is the correction that matters most.
    // Maquis is what the hillside *behind* Jadrija is; the wood on the
    // peninsula is swept — the needles are the only thing on the ground.
    const WOOD = { pine: 0.62, olive: 0.05, bush: 0.03 };
    const NECK = { pine: 0.30, olive: 0.34, bush: 0.06 };

    return {
      houses: n,
      /** Does this vegetation tile touch the headland at all? */
      tile: (ox, oz, T) => ox < bx1 && ox + T > bx0 && oz < bz1 && oz + T > bz0,
      /**
       * What grows at (x, z) — or null, which means "not mine, ask the cover
       * map". Null is also the answer over the resort's own concrete, which is
       * the one place on this shore a tree is at eye height rather than
       * something you fly over.
       */
      at: (x, z) => {
        // The world-space box first. `local` is a scan of thirty-odd shore
        // stations and this is called nine thousand times per vegetation tile;
        // two compares reject almost all of them before it ever runs.
        if (x < bx0 || x > bx1 || z < bz0 || z > bz1) return null;
        const [t, sv] = local(x, z);
        if (t < GROVE.t0 || t > LEN + GROVE.t1 || sv < GROVE.s0 || sv > GROVE.s1) {
          return null;
        }
        if (inField(x, z, 4)) return null;
        if (built(x, z)) return null;
        return sv > 180 ? NECK : WOOD;
      },
    };
  })();

  const FACE = 'n = gl_FrontFacing ? n : -n; base *= vVCol;';
  const deckMesh = new THREE.Mesh(deck.geo(), solidMaterial(0xffffff, {
    spec: 0.07, specPower: 22, side: THREE.DoubleSide, body: FACE,
  }));
  const upMesh = new THREE.Mesh(up.geo(), solidMaterial(0xffffff, {
    spec: 0.05, specPower: 14, side: THREE.DoubleSide, emissive: 0.22, body: FACE,
  }));
  // The village gets a bounce too but a much smaller one — a house forty metres
  // inland is standing on limestone and a lane, not on the terrace.
  const vilMesh = new THREE.Mesh(vil.geo(), solidMaterial(0xffffff, {
    spec: 0.05, specPower: 16, side: THREE.DoubleSide, emissive: 0.07, body: FACE,
  }));
  for (const m of [deckMesh, upMesh, vilMesh]) { m.frustumCulled = false; scene.add(m); }

  // ── the locale ─────────────────────────────────────────────────────────────
  /**
   * World point to (along, across). The nearest segment wins; past either end
   * the projection is allowed to run off the end station's own frame rather than
   * being clamped, so `t` is a real coordinate outside the resort too and
   * `confine` can pull a walker back in along the shore instead of sideways.
   */
  function local(x, z) {
    let best = null;
    for (let i = 0; i < ST.length - 1; i++) {
      const a = ST[i], c = ST[i + 1];
      const ex = c.x - a.x, ez = c.z - a.z;
      const L2 = ex * ex + ez * ez || 1;
      const u = clamp(((x - a.x) * ex + (z - a.z) * ez) / L2, 0, 1);
      const px = a.x + ex * u, pz = a.z + ez * u;
      const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (!best || d2 < best.d2) best = { d2, i, u, t: a.t + (c.t - a.t) * u };
    }
    let t = best.t;
    if (best.i === 0 && best.u <= 0) {
      const a = ST[0];
      t = (x - a.x) * a.ux + (z - a.z) * a.uz;
    } else if (best.i === ST.length - 2 && best.u >= 1) {
      const e = ST[ST.length - 1];
      t = e.t + (x - e.x) * e.ux + (z - e.z) * e.uz;
    }
    // The nearest segment is only a seed. `toWorld` builds a point from the
    // frame at `t` — a station and its normal — whereas projecting onto the
    // polyline measures against the chord between two stations, and those two
    // disagree by the angle between the chord and the interpolated normal. On
    // the promenade that is centimetres and invisible. Ninety metres inland,
    // where the village is, the same angle came out as two metres: `local` and
    // `toWorld` stopped being inverses, and a walker held against a wall by
    // `confine` was re-measured somewhere else the next frame.
    //
    // Newton, on arc length. The along-shore residual is the step, because the
    // curve is parameterised by its own length, and it lands in two.
    for (let k = 0; k < 3; k++) {
      const c = at(t);
      t += (x - c.x) * c.ux + (z - c.z) * c.uz;
    }
    const st = at(t);
    return [t, (x - st.x) * st.nx + (z - st.z) * st.nz];
  }

  function toWorld(t, s) {
    const st = at(t);
    return [st.x + st.nx * s, standY(t, s), st.z + st.nz * s];
  }

  /**
   * What you stand on at (t, s): the terraces, plus the one floor that is not
   * one of them.
   *
   * The kabine stand on a 0.22 m pad that `surfaceY` knows nothing about, and
   * for eighty shut huts that was free — you walk past a hut, not into it. One
   * of them opens now, and everything placed by `toWorld` inside it was placed
   * 22 cm low: her feet went through the floorboards to the ankle, which is
   * exactly how deep the pad is.
   *
   * Ramped over the half-metre in front of the face rather than stepped,
   * because a 22 cm pop on the doorstep reads as the floor giving way — and
   * shared with `walkY` so that the floor she stands on and the floor you stand
   * on are the same floor. They were not, and only one of them was right.
   */
  function standY(t, s) {
    const y = surfaceY(clamp(t, 0, LEN), s);
    const K = special;
    if (K && t > K.t0 - 0.30 && t < K.t1 + 0.30
        && s > K.face - 0.55 && s < K.s1 + 0.10) {
      return y + (K.floor - y) * sat((s - (K.face - 0.55)) / 0.55);
    }
    return y;
  }

  /**
   * Ground height in world space. Off the concrete this has to fall through to
   * the terrain, or standing one step past the back wall would put you on an
   * invisible shelf at promenade height.
   */
  function walkY(x, z, yHint) {
    const [t, s] = local(x, z);
    // The vikendica first: its upper floor is 2.9 m over the ground it
    // stands on, the flight up the outside is a ramp between the two, and the
    // mezzanine is a third floor over the second. `yHint` is where whoever is
    // asking is standing now, which is the only thing that can tell the floor
    // from the deck three metres above it.
    if (vik) {
      const f = vik.floorAt(t, s, yHint);
      if (f != null) return f;
    }
    if (onMoleY(t, s)) return JET.top;
    if (onPlaza(t, s) && s < 0.6) return at(t).lip;
    if (t < -5 || t > LEN + 5 || s < -3 || s > JAD.back + JAD.bleed) {
      return Math.max(groundAt(x, z), 0);
    }
    return standY(t, s);
  }

  const inField = (x, z, pad = 0) => {
    const [t, s] = local(x, z);
    return t > -pad && t < LEN + pad && s > -4 - pad && s < JAD.reachIn + pad;
  };

  // Blockers are the huts, in locale coordinates, which is the frame they were
  // laid out in — so they are axis-aligned boxes here for free, which is exactly
  // what `confine` wants and exactly why the aerodrome uses runway-local axes
  // for the same job.
  const blockers = runs.map((r) => ({
    t: (r.t0 + r.t1) * 0.5, s: (r.s0 + r.s1) * 0.5,
    a: (r.t1 - r.t0) * 0.5, c: (r.s1 - r.s0) * 0.5,
    h: r.h, y: r.y,
  }));
  // The trees. Squared off to the trunk, not to the crown — being stopped by
  // foliage two metres over your head is worse than walking through it.
  for (const [t, s, r, h] of greens) blockers.push({ t, s, a: r, c: r, h, y: 0 });

  // The furniture and the people: benches, loungers, parasol poles and everyone
  // standing or sitting on the concrete.
  for (const f of furniture) blockers.push(f);

  // The special kabina's own walls, as the room itself drew them — see `shell`
  // in `kabina()`. Nothing else on this shore is built this way, and nothing
  // else on this shore is a room.
  if (special) {
    for (const [t0, t1, s0, s1] of special.shell) {
      blockers.push({
        t: (t0 + t1) * 0.5, s: (s0 + s1) * 0.5,
        a: (t1 - t0) * 0.5 - GROUND.girth, c: (s1 - s0) * 0.5 - GROUND.girth,
        h: KAB.ceil, y: special.y0,
      });
    }
  }

  // The houses were laid out to their lanes rather than to the shore, so each
  // carries the angle between the two and `confine` turns into it. Reducing them
  // to axis-aligned boxes instead grew a square house by half its width in each
  // direction, which is more than the gap between two of them.
  for (const hs of houses) {
    const [t, s] = local(hs.cx, hs.cz);
    const st = at(t);
    blockers.push({
      t, s, a: hs.a, c: hs.c, h: 8, y: 0,
      rot: Math.atan2(hs.ax * st.nx + hs.az * st.nz, hs.ax * st.ux + hs.az * st.uz),
    });
  }

  // ── the vikendica ──────────────────────────────────────────────────────────
  // Behind the back row, in the trees. Its walls join the same blocker list
  // as the kabine, in the same locale axes, because it was placed with its
  // own +X along the shore precisely so that they could.
  vik = await buildVikendica(scene, { toWorld, local });
  if (vik) for (const b of vik.blockers()) blockers.push(b);

  // ── the crowd ──────────────────────────────────────────────────────────────
  /**
   * Hand everybody placed above to the instanced rig renderer.
   *
   * Two rigs, because a man and a woman are different silhouettes and one mesh
   * tinted twice is not a crowd. They share a joint tree bone for bone, so both
   * are driven by the same `stride` and the split costs nothing but a second
   * set of instanced layers.
   *
   * Height is per-instance rather than baked, which is also where the children
   * come from: the same two meshes at 0.66.
   */
  const crowds = {};
  {
    // One mesh per person, in the order they were cast. Loaded in parallel —
    // eight inflates and eight parses of 150 KB apiece is worth doing at once,
    // and they are independent.
    const figs = (await Promise.all(BATHER_CAST.map((name) => {
      const key = 'bather_' + name + '_fr3d';
      if (!PAYLOAD[key]) return Promise.resolve(null);
      return loadSkin(key, {
        spec: 0.09,
        specPower: 24,
        // Literal colours: skin tone and swimwear are baked per figure, which
        // is what having eight blobs buys. The marker palette in 42-crowd.js
        // is for a crowd that is two meshes wearing different paint.
        body: 'base *= vVCol;',
      });
    }))).filter(Boolean);
    if (figs.length) crowds.skin = makeSkinCrowd(scene, figs, bathers.length);
    // And the instanced pair as well, which used to be the *fallback* for a
    // payload with no blobs in it and is now the second tier of a crowd.
    //
    // `makeSkinCrowd` is one mesh per person and there are eight of them, so
    // `CAST` could be raised to any number and eight people would turn up: the
    // cap that binds is the length of BATHER_CAST, not the constant. That is
    // the whole reason this shore has been empty. The instanced rigs carry a
    // hundred and twenty at twenty-two draw calls — see the note over
    // `makeCrowd` — so the answer is both: the blobs where you can see a face,
    // the instances everywhere else.
    for (const [sex, key] of [['m', 'bather_m_fr3d'], ['f', 'bather_f_fr3d']]) {
      const rig = await loadRig(key);
      if (rig) crowds[sex] = makeCrowd(scene, rig, bathers.length);
    }
  }

  /**
   * A yaw for the rig, from an angle in the shore's own (t, s) frame.
   *
   * The rig's forward is +X and a Three.js object with rotation.y = θ points
   * its local +X at (cos θ, 0, −sin θ), hence the negated z. Everything above
   * is written in (t, s) and this is the only place that has to know it is
   * really a bearing on a coastline that runs 31° off the world axis.
   */
  const rigYaw = (t, ang) => {
    const st = at(t);
    const c = Math.cos(ang), sn = Math.sin(ang);
    return Math.atan2(-(st.uz * c + st.nz * sn), st.ux * c + st.nx * sn);
  };

  /**
   * One figure from the new pipeline — tools/blender/human_mh.py.
   *
   * She started here as a frozen mesh with no bones at all, which was the right
   * first step: scale, palette, lighting and placement are the cheap questions
   * and they got answered before any of the skinning work was written. They
   * came back clean — a 1.75 m figure measures 1.75 m against a bather standing
   * next to her — so she is now the skinned one, twenty-eight bones deep, and
   * the clips are the thing that gets iterated on rather than the mesh.
   *
   * Placed on the middle terrace a little east of the jetty, facing the water.
   */
  let testFigure = null;
  let skinFig = null;
  let show = null;
  let banner = null;

  // ── the note ───────────────────────────────────────────────────────────────
  /**
   * What she writes on it.
   *
   * Not in 02-i18n.js, and that is a decision rather than an oversight. Every
   * string in that file is the *game* talking — a HUD label, a key hint, a
   * wingman on the radio — and all of it should arrive in the language the
   * player picked. This is not the game talking, it is her, and it is the first
   * time she has used words at all: everything else she has ever said is a
   * squeak out of 80-audio.js, which nobody translates either. "Herro" is also a
   * joke that only exists in one language, and a French build that solemnly
   * corrected it to "Bonjour" would have translated away the whole content.
   */
  const NOTES = ['herro!', "what's up, duck?", 'meaw!'];

  // And the two she only holds up while she is alight. Not in `NOTES`, because
  // a girl on a beach in the sun announcing she is a firestarter is a non
  // sequitur, and the same card held up by a woman with flames climbing her
  // arms while the deck burns behind her is the joke. It is the one thing here
  // that is a quotation rather than something she thought of.
  //
  // Two cards rather than two lines on one card, which is what it was first.
  // The card is 512 px wide and about 30 cm tall in the world, and the fitter
  // has to shrink a twenty-two character line to fit across it — put two of
  // those on the same card and each is half the height as well, which at four
  // metres through a 30-degree lens is a grey smear. One line a card is twice
  // the letter height for nothing, and it is better comic timing besides: the
  // second card is a beat, and a beat is what makes the line land.
  const FIRE_NOTES = ['i am a firestarter!', 'a twisted firestarter!'];

  // ── and the lines on it she did not make up ────────────────────────────────
  /**
   * What the world outside says, if there is an internet and it feels like
   * answering. A price, and the temperature on the beach she is standing on.
   *
   * These are the only requests this program makes. Everything else — the
   * terrain, the land cover, thirteen thousand footprints, her mesh, her clips,
   * the whole twelve megabytes — is baked into the file, and the file opens off
   * a memory stick with the wifi off. That property is worth more than anything
   * written on a card, so this is built so that losing a request costs nothing:
   *
   *   - each is asked for once at load and on its own interval after, never in
   *     a frame and never on the way to drawing one;
   *   - each is abandoned after six seconds, because a hung socket must not be
   *     something you can accumulate one of every five minutes;
   *   - and every way one can fail — no network, no DNS, CORS, a rate limit, a
   *     file:// origin, a shape of JSON nobody expected — lands in the same
   *     empty catch and leaves that line null, which simply means it is not one
   *     of the things she might hold up. There is no error state, no retry
   *     storm and no spinner; the card just says "meaw!" instead.
   *
   * A line that has arrived is kept when a later poll fails, deliberately. A
   * temperature from twenty minutes ago is still the temperature; a card that
   * blanks itself the first time a request times out is worse at its one job.
   *
   * The temperature is the whole point of the second one. The rest of this
   * program is August 2024 played back — the fire, the sun angle, the wind off
   * the Kornati — and the number on the card is Jadrija *now*, off a
   * thermometer, at the coordinates she is standing on. It is the only place
   * the two touch.
   *
   * Both endpoints are one hop, need no key, and send
   * `Access-Control-Allow-Origin: *`, which most of the alternatives do not.
   */
  const LIVE = [
    {
      key: 'btc',
      card: true,
      url: 'https://api.coinbase.com/v2/prices/BTC-USD/spot',
      every: 5 * 60 * 1000,
      // Kept only if it is a number and a plausible one. A price of NaN written
      // out in full on a card held up by a woman on a beach is a worse failure
      // than no card at all.
      read: (j) => {
        const n = Number(j.data.amount);
        return Number.isFinite(n) && n > 0
          ? 'btc: $' + Math.round(n).toLocaleString('en-US') : null;
      },
    },
    {
      // The dog's, not hers, which is what `card` is for: `card` entries go
      // into the pool she draws from and this one does not. A woman on a beach
      // holding up a card that says "doge" is a woman who has been handed
      // somebody else's joke. The dog gets it, over the dog's own head, and it
      // is the only thing the dog ever says.
      key: 'doge',
      card: false,
      url: 'https://api.coinbase.com/v2/prices/DOGE-USD/spot',
      every: 5 * 60 * 1000,
      // Every decimal the exchange quotes, and not a fixed count. Rounding it
      // the way the bitcoin line is rounded gives "doge: $0", which is a joke
      // about a different thing — but a fixed four was the same mistake one
      // step smaller, because it silently drops the fifth digit Coinbase
      // actually publishes and pads with a zero on the days it does not. What
      // the exchange sends is a decimal string it chose the precision of, so
      // the honest thing is to print that string and add nothing: the balloon
      // says what the exchange said. Clamped at eight so a bad day at the API
      // cannot put forty characters on a speech bubble.
      read: (j) => {
        const s = String(j.data.amount);
        const n = Number(s);
        if (!Number.isFinite(n) || n <= 0) return null;
        const dp = (s.split('.')[1] || '').length;
        return 'doge: $' + (dp > 8 ? n.toFixed(8) : s);
      },
    },
    {
      key: 'air',
      card: true,
      // 43.708 N, 15.826 E — the lighthouse at the end of her promenade, not
      // the world origin in 00-core.js, which sits four kilometres east between
      // here and the old town. Four kilometres is nothing to a weather model
      // and the difference is the point: the card names Jadrija, so it should
      // be Jadrija that was asked.
      url: 'https://api.open-meteo.com/v1/forecast?latitude=43.708'
        + '&longitude=15.826&current=temperature_2m',
      // Ten minutes rather than five. Open-Meteo publishes on a quarter hour
      // and the air over a beach does not move fast enough to be worth asking
      // more often than the source changes.
      every: 10 * 60 * 1000,
      read: (j) => {
        const c = Number(j.current.temperature_2m);
        // Šibenik's record low is −16 and its record high is 39. The window is
        // wide of both because the job here is to catch a null, a string or a
        // sentinel like −999, not to second-guess a thermometer.
        return Number.isFinite(c) && c > -40 && c < 60
          ? 'jadrija: ' + Math.round(c) + '°C' : null;
      },
    },
  ];
  const LIVE_TIMEOUT = 6000;
  const live = { btc: null, doge: null, air: null };

  async function poll(src) {
    if (typeof fetch !== 'function' || navigator.onLine === false) return;
    const ctl = new AbortController();
    const bail = setTimeout(() => ctl.abort(), LIVE_TIMEOUT);
    try {
      const r = await fetch(src.url, { signal: ctl.signal, cache: 'no-store' });
      if (!r.ok) return;
      const note = src.read(await r.json());
      if (note) live[src.key] = note;
    } catch { /* every failure is the same failure: she has nothing to report */ }
    finally { clearTimeout(bail); }
  }

  /**
   * Set a font size that fits `text` into `room` pixels, and leave it set.
   *
   * Shrunk to fit rather than wrapped: these are three or four words, and a
   * line break in the middle of "what's up, duck?" is a worse picture than a
   * slightly smaller one. The floor matters as much as the fit — below about a
   * third of the starting size the text is unreadable at the distance anyone
   * stands at, and a card you cannot read is worse than a card that overflows.
   */
  function fitText(g, text, room, start, floor = 28) {
    let px = start;
    do {
      g.font = `700 ${px}px "Trebuchet MS", "Segoe UI", sans-serif`;
      px -= 4;
    } while (px > floor && g.measureText(text).width > room);
  }

  /**
   * Her card, and the first texture in this project.
   *
   * Everything else here is vertex colours — the whole figure, the whole town —
   * because a colour per vertex costs nothing to author and nothing to sample.
   * Text is the one thing that argument breaks on: a legible glyph is a hard
   * edge, and a hard edge on a decimated mesh is either a thousand triangles
   * per letter or it is a texture. So it is a canvas, drawn once per string and
   * uploaded, on a quad two triangles big.
   *
   * The quad is a child of her mesh rather than a thing in the scene, so it goes
   * where she goes for free — including through the crossfade, the yaw easing
   * and the shore's curved frame, none of which it has to know about. All it
   * does per frame is sit between her two hands, and it reads those out of the
   * bone pass rather than being told where they are: the pose in
   * tools/blender/human_mh.py decides how she holds it, and if that pose moves,
   * the card moves with it and nothing here has to be told.
   */
  function makeBanner(fig) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 288;
    const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const write = (text) => {
      g.fillStyle = '#f4efe2';                    // sun-bleached card
      g.fillRect(0, 0, cv.width, cv.height);
      g.strokeStyle = '#cdc3ad';
      g.lineWidth = 6;
      g.strokeRect(3, 3, cv.width - 6, cv.height - 6);
      g.fillStyle = '#26333d';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      fitText(g, text, cv.width - 64, 96);
      g.fillText(text, cv.width / 2, cv.height / 2 + 4);
      tex.needsUpdate = true;
    };
    write(NOTES[0]);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    // PlaneGeometry faces +Z and her forward is +X, so a quarter turn puts the
    // writing where somebody standing in front of her can read it.
    mesh.rotation.y = Math.PI / 2;
    mesh.frustumCulled = false;
    mesh.visible = false;
    fig.mesh.add(mesh);

    const hl = fig.boneIndex('handL'), hr = fig.boneIndex('handR');
    const a = new THREE.Vector3(), b = new THREE.Vector3();

    return {
      mesh,
      say: write,
      // A live line joins the pool when there is one and is simply absent when
      // there is not, which is why they are concatenated here rather than kept
      // as slots in `NOTES` holding placeholders. There is no "btc: —".
      //
      // Which also means offline is not a degraded mode with a hole in it, it
      // is three notes instead of five, and every one of the five is equally
      // likely whenever it is up. With both lines answering she holds up
      // something real two times in five, which is what "occasionally" is worth
      // here: often enough to be noticed on a second visit, rare enough that it
      // is still a surprise.
      pick: () => {
        const pool = NOTES.concat(LIVE
          .filter((s) => s.card).map((s) => live[s.key]).filter(Boolean));
        write(pool[(Math.random() * pool.length) | 0]);
      },
      /**
       * Sit it between her hands.
       *
       * Sized off how far apart they are rather than fixed, so the card is
       * whatever the pose is holding — and clamped at both ends, because the
       * crossfade into the pose starts from wherever she was and an unclamped
       * card grows from nothing over a third of a second, which reads as a bug
       * rather than as a fade.
       *
       * And hung *below* the wrists rather than centred between them. Centred
       * put it across her mouth: her hands come up to about chin height in the
       * pose, and a card whose middle is at her hands is a card whose top is at
       * her nose. Below them she is holding it by its top corners, which is
       * where a person holds up a sign, and her face stays clear above it.
       */
      place: () => {
        if (hl < 0 || hr < 0) return;
        fig.boneAt(hl, a); fig.boneAt(hr, b);
        const w = clamp(a.distanceTo(b) * 0.95, 0.24, 0.32);
        mesh.scale.set(w, w * (288 / 512), 1);
        mesh.position.set(
          (a.x + b.x) * 0.5 + 0.07,       // clear of her palms, toward you
          (a.y + b.y) * 0.5 - 0.11,
          (a.z + b.z) * 0.5);
      },
    };
  }
  if (PAYLOAD.human_skin_fr3d) {
    try {
      skinFig = await loadSkin('human_skin_fr3d', {
        spec: 0.09,
        specPower: 24,
        face: true,
        // Literal colours, as the landmarks do. The marker palette in
        // 42-crowd.js is for figures the runtime recolours per instance, and
        // there is exactly one of these.
        body: 'base *= vVCol;',
      });
      if (!skinFig) throw new Error('no skinned figure');
      const mesh = skinFig.mesh;
      skinFig.play('idle', { fade: 0 });
      const ft = gapAt + 22, fs = JAD.mid + 1.4;
      const p = toWorld(ft, fs);
      mesh.position.set(p[0], p[1], p[2]);
      mesh.rotation.y = rigYaw(ft, -Math.PI * 0.5);  // looking out to sea
      mesh.updateMatrixWorld();
      scene.add(mesh);
      banner = makeBanner(skinFig);
      testFigure = { mesh, fig: skinFig, tris: skinFig.tris, at: [ft, fs] };

      // The survey pole that used to stand here is gone.
      //
      // It was a kilometre of red-and-white banding put up so that a 1.75 m
      // figure — about one pixel from the circuit — could be found from the air
      // at all while the skinning was being built. That job is done: she is no
      // longer a statue you have to be told where to look for, she is the thing
      // that happens when you walk up to her, and a 2.8 m mast standing 6 m away
      // put a red wall straight through the middle of the performance.
      show = {
        phase: 'idle', t: ft, s: fs, ang: -Math.PI / 2, want: -Math.PI / 2,
        tmr: 0, flips: 0, said: 0, home: [ft, fs],
        // The wander: the heading the random walk is on, seconds until it is
        // nudged again, the speed to take it at, and how long she has been
        // playing — which is separate from `tmr` because a somersault in the
        // middle of the wander resets one and must not reset the other.
        // `pace` starts at nothing rather than at a sensible speed on purpose:
        // `SHOW` is declared below this and would be in its dead zone here, and
        // nothing reads it before `showWander` has set it.
        wander: -Math.PI / 2, tick: 0, pace: 0, played: 0,
        // The cartwheel: how far into a run of them she is, and the quarter
        // turn that puts her shoulders across her course while she does them.
        // `side` is a yaw offset on the mesh alone — it never touches `ang`, so
        // she goes on travelling exactly where she was already going.
        wheels: 0, side: 0,
        // The three that carry momentum, so that nothing about how she moves
        // starts or stops on a frame boundary: how fast she is going, and the
        // two rates the yaw and the shoulder offset are turning at.
        vel: 0, rate: 0, sideRate: 0,
        // What is left of the opening routine. Filled when she gets up off the
        // deck and emptied one number at a time; empty means the dice are back
        // in charge.
        queue: [],
        // The water: seconds of grace left on the last time the jet was on
        // her, how soaked she is, how long she stays interested afterwards,
        // and which way round she is currently sweeping.
        hit: 0, owed: 0, wet: 0, lock: 0, spin: 1, faceAng: 0,
        // Chin up and mouth open, for the one place the jet gets that: 0 or 1
        // eased, and it drives both at once because they are one gesture.
        // `fill` is the slow one under it — not whether the water is on her
        // mouth but how long it has been.
        gape: 0, fill: 0,
        // And the turn. `soak` is the one number in here that is a *total*
        // rather than a state — how many seconds of jet she has taken, over
        // the whole session, forgotten only very slowly. `burn` is how much of
        // the routine is left once it has started, and `cast` is the count
        // down to the next fireball.
        soak: 0, burn: 0, cast: 0, boast: 0,
        // The one thing here that only ever goes one way. See the flare.
        turned: 0,
        // Indoors: which waypoint of the way in she is on, and whether the
        // wrap has come off. `shed` is a latch for the same reason `turned` is
        // — it is read every frame by the line that draws the wrap, and a
        // value read off state cannot be stranded by an event that never fires.
        leg: 0, shed: 0, held: 0, pour: 0,
      };
    } catch (e) {
      console.warn('test figure failed:', e.message);
    }
  }

  // ── the dog ────────────────────────────────────────────────────────────────
  /**
   * The seaward edge of the strip she performs on.
   *
   * Hoisted out of `SHOW` below, and only because two things now need it and
   * one of them runs before `SHOW` exists. Keeping it as a literal in both
   * places is how a dog ends up standing in her lane six months after somebody
   * widens the lane and forgets there was a second copy of the number.
   */
  const SHOW_LANE0 = JAD.mid - 2.0;

  /**
   * A pug on the deck, and a balloon over it with the price of a coin named
   * after a different dog.
   *
   * The only piece of geometry in this game that was not authored for it. Four
   * buildings, an aeroplane, a woman, thirteen thousand houses and a hundred and
   * sixty-nine square kilometres of karst are all built by something in tools/,
   * because all of them are *specific* — that cathedral, that channel, that
   * fire. A dog on a beach is not specific, and the effort is better spent on
   * where it stands than on modelling one. See tools/blender/assets/README.md.
   *
   * He keeps to a short stretch of deck near her spot, so that you meet the two
   * of them together, and to a line **outside her lane**, which is why his
   * position is written off `SHOW_LANE0` rather than off the middle of the
   * deck. She does not collide with anything — that is deliberate and
   * documented where the performance is — so anything standing in the strip she
   * plays on is something she walks through. A bather she walks through is a
   * shrug; a dog you are looking straight at is not.
   */
  let dog = null;

  /**
   * The stretch, the speed, and the size of him.
   *
   * `trot` is not a tuning number. The clip is solved in
   * tools/blender/dog.py against a paw that stays nailed to the deck while it
   * is down, and 0.93 m/s is the speed that makes that true — the file prints
   * it. Everything below divides by it to get a playback rate, so his legs and
   * the ground agree at whatever pace he happens to be going. Change the trot
   * there and this number changes with it or he moonwalks.
   *
   * The stretch is deliberately eleven metres and not the whole promenade. He
   * is a dog on a beach, not a patrol: far enough that he is somewhere
   * different when you look back, near enough that he is still part of the
   * scene you found him in. It also keeps him on concrete that her performance
   * already guarantees is clear, so he needs no blocker test of his own.
   */
  const DOG = {
    trot: 0.93,
    lane: SHOW_LANE0 - 0.8,
    t0: JAD.jetty + 14.4,
    t1: JAD.jetty + 25.4,
    turn: 2.6,                  // rad/s, turning on the spot
    stand: [2.6, 9.0],          // how long he stays put, seconds
    hitR: 0.36, hitH: 0.44,     // what the jet has to land on
    // How long a hoseful is remembered. Longer than the shake, so that holding
    // the jet on him gets a second one rather than one and a wet dog standing
    // there — and short enough that he stops when you stop.
    soak: 1.4,
    // Indoors. He follows you in, gets up on the cot and settles there.
    //
    // The jump is short because a jump is: 0.38 s from a standing start to the
    // top of a mattress 44 cm up is about right for a small dog and, more to
    // the point, is over before you can look at it closely. It is played on the
    // idle clip — there is no jump in tools/blender/dog.py and there does not
    // need to be one, because what sells it is the arc and the fact that he is
    // suddenly a foot and a half higher than he was.
    hopFor: 0.38,
    hopUp: 0.12,        // m of overshoot at the top of the arc
    // And the settle, which is a sit.
    //
    // There is no sit in tools/blender/dog.py and this does not add one: a sit
    // is a body pitched nose-up about the hips with the hind legs folded under
    // it, and both of those are one rotation each, laid over the idle clip
    // through `aim`. The rear ends up below the tick and stays there, which is
    // the whole reason this works on a mattress and would not on a floor — a
    // bed hides the half of a sit that is hardest to fake.
    //
    // `settle` is the compensation, not a slouch: pitching about the root lifts
    // the front of him by about six centimetres and his front paws have to come
    // back down onto something.
    // Measured off `joints` in the debug read rather than guessed, because the
    // first pass at it put his rump 62 mm under the tick and a bedsheet cut him
    // in half. The rear ends up 20 mm under, which a mattress swallows, and the
    // front paws 10 mm over, which at this size is nothing — a pitch that puts
    // both sets of paws on the same plane is a pitch too small to be a sit.
    settle: 0.070,      // m the body drops, so the rear is only just under
    slump: 0.34,        // rad of nose-up pitch — the sit itself
    fold: 0.55,         // rad the hind legs swing forward, under him
    curlIn: 1.9,        // 1/s, how fast the settle arrives
  };

  /**
   * The balloon, which is her card's trick with two things changed.
   *
   * Hers is a child of her mesh and reads two bones a frame to sit between her
   * hands, because the pose decides how she holds it. Nothing holds this one:
   * it is a thought over an animal that does not move, so it hangs at a fixed
   * height and simply turns to face you. Billboarded, and only about the
   * vertical — tilting a balloon back as you climb into an aeroplane would be
   * the one thing in the scene that knows where the camera is.
   *
   * And it is only up when you are close. A speech balloon visible from the
   * circuit is a HUD element; visible from six metres it is a joke you walked
   * into, which is the whole of what it is for.
   */
  function makeBalloon() {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const write = (text) => {
      g.clearRect(0, 0, cv.width, cv.height);
      // A rounded box with a tail pointing down at the animal thinking it.
      const R = 34, W = cv.width - 16, H = 190;
      g.fillStyle = '#fbfaf6';
      g.strokeStyle = '#7d8894';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(8 + R, 10);
      g.arcTo(8 + W, 10, 8 + W, 10 + H, R);
      g.arcTo(8 + W, 10 + H, 8, 10 + H, R);
      // The tail, cut into the bottom edge rather than drawn over it, so the
      // stroke runs round the outside of the whole shape in one path.
      g.lineTo(cv.width / 2 + 26, 10 + H);
      g.lineTo(cv.width / 2 - 6, cv.height - 6);
      g.lineTo(cv.width / 2 - 30, 10 + H);
      g.arcTo(8, 10 + H, 8, 10, R);
      g.arcTo(8, 10, 8 + W, 10, R);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#2b3540';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      fitText(g, text, W - 56, 78, 26);
      g.fillText(text, cv.width / 2, 10 + H / 2);
      tex.needsUpdate = true;
    };

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.23),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true,
        side: THREE.DoubleSide, depthWrite: false }));
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 3;
    return { mesh, say: write, said: null };
  }

  if (PAYLOAD.dog_fr3d) {
    try {
      // Skinned, on the same path she is: `skinnedFigure` turns out to be
      // entirely general once `opts.face` is left off, so the twenty-four bone
      // quadruped costs the same three lines as the twenty-eight bone woman.
      // No `face` — a pug has one, but it is four hundred vertices across and
      // the eyelids the shader looks for are hers by name.
      const fig = await loadSkin('dog_fr3d', {
        spec: 0.05, specPower: 20, body: 'base *= vVCol;',
      });
      if (!fig) throw new Error('no skinned dog');
      fig.play('idle', { fade: 0 });
      const mesh = fig.mesh;
      const dt = (DOG.t0 + DOG.t1) * 0.5;
      const p = toWorld(dt, DOG.lane);
      mesh.position.set(p[0], p[1], p[2]);
      // Facing back along the promenade, which from here is roughly at her:
      // a dog on a beach is looking at whatever is most interesting, and on
      // this deck that is either her or you, and she is closer.
      mesh.rotation.y = rigYaw(dt, Math.PI);
      mesh.updateMatrixWorld();
      scene.add(mesh);
      const balloon = makeBalloon();
      balloon.mesh.position.set(p[0], p[1] + 0.62, p[2]);
      scene.add(balloon.mesh);
      dog = {
        mesh, balloon, fig, at: [dt, DOG.lane], tris: fig.tris,
        mode: 'stand', dir: -1, timer: 3.0, tgt: dt,
        yaw: mesh.rotation.y, soak: 0,
        // Indoors: metres above whatever the ground says, how far through the
        // settle he is, which leg of the route he is on, and where the jump
        // started from.
        lift: 0, curl: 0, leg: 0, from: [dt, DOG.lane], hopH: 0,
      };
    } catch (e) {
      console.warn('dog failed:', e.message);
    }
  }

  // Asked for once here and on their own intervals after, for as long as the
  // page is open. Started here rather than at the top of the file because there
  // has to be somebody to say them: no figure and no dog means no card and no
  // balloon, and a number nobody can be shown is not worth a request. It used
  // to sit inside the figure's own block, which quietly made the dog's line
  // depend on her mesh having loaded — two things that have nothing to do with
  // each other.
  if (skinFig || dog) {
    for (const src of LIVE) {
      poll(src);
      setInterval(() => poll(src), src.every);
    }
  }

  /**
   * Point the balloon at you, and take it down when you are not there.
   *
   * `DOG_NEAR` is a little further than the distance she notices you from, on
   * purpose: the balloon should already be up by the time she starts her
   * routine, or it reads as a reaction to the routine rather than as a dog that
   * was standing there thinking about coins the whole time.
   */
  const DOG_NEAR = 21;

  /**
   * Where he is going, what he is playing, and which way he is pointing.
   *
   * Three modes and no more: `stand`, `walk`, `shake`. The interesting one is
   * `walk`, and the interesting thing about it is that he **turns on the spot
   * before he goes anywhere**. The alternative — steering while trotting — is
   * what most things in this game do, and it is wrong here for a reason the
   * gait makes unavoidable: the trot is solved for a paw that does not slide,
   * and a body arcing sideways under legs that are stepping straight forward
   * slides every one of them. Turning while idle scuffs nothing, because a
   * standing dog's feet are not pretending to be anywhere.
   *
   * `speed` is set from the same number every frame he moves, so the pace and
   * the legs cannot drift apart. There is nowhere to get them out of step.
   */
  /**
   * Turn towards a mark in the resort's own frame, then trot at it.
   *
   * The along-shore walk below moves in `t` alone and can steer by picking one
   * of two headings. Coming through a doorway cannot: the route bends twice and
   * the second leg is straight up `s`. Same rule either way — he comes round on
   * the spot first and only then puts a paw down, because the trot is solved
   * for a paw that does not slide and a body arcing under legs stepping
   * straight forward slides every one of them.
   *
   * Returns the gap left after this step, so a caller can ask "am I there yet".
   */
  function dogTo(gt, gs, dt, pace = 1) {
    const s = dog;
    const dtt = gt - s.at[0], dss = gs - s.at[1];
    const gap = Math.hypot(dtt, dss);
    if (gap < 1e-4) return 0;
    const want = rigYaw(s.at[0], Math.atan2(dss, dtt));
    let err = want - s.yaw;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    s.yaw += Math.min(Math.abs(err), DOG.turn * dt) * Math.sign(err);
    if (Math.abs(err) > 0.28) {
      s.fig.play('idle', { fade: 0.22 });
      s.fig.state.speed = 1;
      return gap;
    }
    s.fig.play('trot', { fade: 0.22 });
    s.fig.state.speed = pace;
    const step = Math.min(gap, DOG.trot * pace * dt);
    s.at[0] += (dtt / gap) * step;
    s.at[1] += (dss / gap) * step;
    return gap - step;
  }

  /** The four indoor modes, as a set, so the trigger can tell it is on one. */
  const DOG_IN = { come: 1, hop: 1, rest: 1 };

  function moveDog(dt, pt, ps) {
    const s = dog;
    s.soak = Math.max(0, s.soak - dt);

    // ── the room ──
    //
    // He comes in after you, and this is the same test the performance uses
    // because it is the same door. The two of them are what is on the other
    // side of it: she comes in and pours a drink, and he gets up on the cot,
    // which between them is the difference between a room with a bed in it and
    // somewhere the pair of them live.
    //
    // Derived from where you are every frame rather than fired on a threshold,
    // for the reason the wrap is: an event that has to be paired with another
    // event some unknown number of frames later is a state machine with a leak
    // in it, and walking out of a hut is exactly the sort of thing that
    // happens between two frames.
    const K = special;
    const inRoom = !!K && !!kit && !!kit.cot
      && pt > K.t0 - 0.25 && pt < K.t1 + 0.25
      && ps > K.face + 0.15 && ps < K.s1 + 0.2;
    if (inRoom && !DOG_IN[s.mode] && s.mode !== 'shake') {
      s.mode = 'come'; s.leg = 0;
    } else if (!inRoom && DOG_IN[s.mode]) {
      // Out, from wherever he had got to. Off the cot first if he is on it —
      // `out` walks, and a dog walking out of a hut two feet above the floor is
      // the funniest bug this could have and still a bug.
      s.mode = 'out'; s.leg = 0;
    }

    switch (s.mode) {
      // Three marks, and for the reason hers has three: a straight line from
      // the deck to the cot goes through a metre and a half of hut.
      case 'come': {
        const legs = [[K.dc, K.face - 1.30], [K.dc, K.face + 0.70],
          [kit.cotFoot[0], kit.cotFoot[1]]];
        const g = legs[Math.min(s.leg, 2)];
        const last = s.leg >= 2;
        if (dogTo(g[0], g[1], dt, last ? 0.8 : 1) < (last ? 0.16 : 0.34)) {
          if (last) {
            s.mode = 'hop'; s.timer = 0;
            s.from = [s.at[0], s.at[1]];
            s.hopH = kit.cot[2] - standY(kit.cot[0], kit.cot[1]);
          } else s.leg++;
        }
        return;
      }

      // Up. An arc rather than a ramp: something that eases straight to the
      // final height is a lift and not a jump, and the overshoot at the top is
      // the whole of what makes it one.
      case 'hop': {
        s.timer += dt;
        const u = Math.min(1, s.timer / DOG.hopFor);
        s.at[0] = s.from[0] + (kit.cot[0] - s.from[0]) * u;
        s.at[1] = s.from[1] + (kit.cot[1] - s.from[1]) * u;
        s.lift = s.hopH * u * (2 - u) + Math.sin(Math.PI * u) * DOG.hopUp;
        s.fig.play('idle', { fade: 0.10 });
        s.fig.state.speed = 1;
        if (u >= 1) { s.mode = 'rest'; s.lift = s.hopH; s.timer = 0; }
        return;
      }

      // And he stays, facing the door, which is where you came in and where you
      // will go out. `curl` is the settle and it eases rather than switching,
      // so the last thing he does after landing is lie down.
      case 'rest': {
        const want = rigYaw(s.at[0], Math.atan2(K.face - s.at[1],
          (K.dc - s.at[0]) * 0.4));
        let err = want - s.yaw;
        while (err > Math.PI) err -= Math.PI * 2;
        while (err < -Math.PI) err += Math.PI * 2;
        s.yaw += Math.min(Math.abs(err), DOG.turn * 0.5 * dt) * Math.sign(err);
        s.fig.play('idle', { fade: 0.40 });
        s.fig.state.speed = 1;
        s.curl = Math.min(1, s.curl + dt * DOG.curlIn);
        s.lift = s.hopH - DOG.settle * s.curl;
        return;
      }

      // Down off the cot and back out through the door, and then the promenade
      // takes him again — `stand` with no timer left picks his next walk on the
      // next frame, from wherever he is standing, which is the whole reason
      // that mode reads its position rather than remembering one.
      case 'out': {
        s.curl = Math.max(0, s.curl - dt * 3.0);
        if (s.lift > 0.01) {
          // Off the edge the way he got on, but downwards and quicker: a drop
          // is not a jump run backwards.
          s.lift = Math.max(0, s.lift - dt * 1.9);
          dogTo(kit.cotFoot[0], kit.cotFoot[1], dt, 0.8);
          return;
        }
        s.lift = 0;
        const legs = [[K.dc, K.face + 0.70], [K.dc, K.face - 1.60],
          [(DOG.t0 + DOG.t1) * 0.5, DOG.lane]];
        const g = legs[Math.min(s.leg, 2)];
        if (dogTo(g[0], g[1], dt, 1) < 0.34) {
          if (s.leg >= 2) {
            s.mode = 'stand'; s.timer = 0; s.at[1] = DOG.lane;
          } else s.leg++;
        }
        return;
      }
      default: break;
    }

    if (s.mode === 'shake') {
      s.timer -= dt;
      if (s.timer > 0) return;
      // Still being hosed when he finishes: go again. That is the whole of the
      // reward for keeping the jet on him, and it is one branch.
      if (s.soak > 0) { shakeDog(); return; }
      // Back to whatever he was doing, and on the cot that is lying on it.
      // Without this he lands in `stand`, the room trigger sees him not on an
      // indoor mode and sends him to `come` — from a standing start two feet
      // above the floor, which he then trots across.
      if (s.lift > 0.01) { s.mode = 'rest'; return; }
      s.mode = 'stand';
      s.timer = DOG.stand[0] + Math.random() * (DOG.stand[1] - DOG.stand[0]);
      return;
    }

    if (s.mode === 'stand') {
      s.timer -= dt;
      if (s.timer > 0) return;
      // Somewhere else on his stretch, and at least three metres off, so that
      // he never sets out on a walk too short to be one.
      let want = DOG.t0 + Math.random() * (DOG.t1 - DOG.t0);
      if (Math.abs(want - s.at[0]) < 3.0) {
        want = s.at[0] < (DOG.t0 + DOG.t1) * 0.5 ? DOG.t1 : DOG.t0;
      }
      s.tgt = want;
      s.dir = want > s.at[0] ? 1 : -1;
      s.mode = 'walk';
      return;
    }

    // walk. The heading he wants is along the shore in whichever direction the
    // target is; `rigYaw` turns that into a bearing on a coastline that is not
    // straight, so this stays right as he crosses a bend.
    const want = rigYaw(s.at[0], s.dir > 0 ? 0 : Math.PI);
    let err = want - s.yaw;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    const step = Math.min(Math.abs(err), DOG.turn * dt) * Math.sign(err);
    s.yaw += step;

    if (Math.abs(err) > 0.28) {
      // Still coming round. Standing, not trotting: see above.
      s.fig.play('idle', { fade: 0.22 });
      s.fig.state.speed = 1;
      return;
    }
    s.fig.play('trot', { fade: 0.22 });
    s.fig.state.speed = 1;
    const gap = s.tgt - s.at[0];
    if (Math.abs(gap) < 0.15) {
      s.mode = 'stand';
      s.timer = DOG.stand[0] + Math.random() * (DOG.stand[1] - DOG.stand[0]);
      s.fig.play('idle', { fade: 0.30 });
      return;
    }
    s.at[0] += Math.sign(gap) * Math.min(Math.abs(gap), DOG.trot * dt);
  }

  /**
   * The jet is on him.
   *
   * He stops, braces and shakes it off, and the walk he was on is abandoned
   * rather than resumed — a dog that shakes and then carries on to the exact
   * spot it was headed for is a dog on rails. `next: 'idle'` hands the clip
   * back on its own, so nothing here has to count frames; the timer is only for
   * when he is allowed to decide something again, and it is read off the clip
   * rather than written down, because the length of the shake lives in
   * tools/blender/dog.py and has no business being in two files.
   */
  function shakeDog() {
    dog.mode = 'shake';
    dog.fig.play('shake', { fade: 0.10, next: 'idle' });
    dog.fig.state.speed = 1;
    dog.timer = (dog.fig.state.cur ? dog.fig.state.cur.dur : 1.6) + 0.30;
  }

  /**
   * Litres are ignored, the same way they are for her and for the same reason.
   *
   * `soak` is set here and nowhere else. `shakeDog` deliberately does not touch
   * it: it is called again from `moveDog` when a shake ends with the jet still
   * on him, and a version that refreshed the memory of being hit every time it
   * fired would have kept him shaking for ever off one hoseful.
   */
  function dogWet(_litres) {
    if (!dog) return;
    dog.soak = DOG.soak;
    if (dog.mode !== 'shake') shakeDog();
  }

  /** Where he is, for the jet to aim at. Read once a trace by 47-ground.js. */
  function dogProbe() {
    if (!dog || !dog.mesh.visible) return null;
    const p = toWorld(dog.at[0], dog.at[1]);
    return { x: p[0], y: p[1], z: p[2], r: DOG.hitR, h: DOG.hitH };
  }

  function stepDog(camPos, dt) {
    if (!dog) return;
    const b = dog.balloon;
    const d = Math.hypot(camPos.x - dog.mesh.position.x,
      camPos.z - dog.mesh.position.z);
    // Posed on the CPU, so it is gated the way she is and for the same reason:
    // twenty-four bones a frame buys nothing at a range where the whole animal
    // is a couple of pixels. Tighter than her 250 m, because the gate is really
    // about how far away a *pose* stops reading and he is a third her height.
    // Out of range he stops where he was, mid-stride, and stays there: a dog
    // frozen at 120 m is a dog you cannot see is frozen.
    if (d < 120) {
      const [pt, ps] = local(camPos.x, camPos.z);
      moveDog(dt, pt, ps);
      // The sit, laid over the idle clip: pitch the whole animal nose-up about
      // his root, and swing the hind legs forward under him. `aim` is in figure
      // space — +x is the way he faces and +y is up, which is knowable, unlike
      // which way a bone imported from a glTF happens to point — so this is a
      // back tipping whichever way he has turned to face.
      dog.fig.aim('root', 0, 0, 1, dog.curl * DOG.slump);
      dog.fig.aim('BackUpLeg.L', 0, 0, 1, dog.curl * DOG.fold);
      dog.fig.aim('BackUpLeg.R', 0, 0, 1, dog.curl * DOG.fold);
      dog.fig.update(dt);
      // `toWorld` reads `standY`, which already knows the kabina floor is not
      // the deck — it steps up over the sill — so walking in needs nothing.
      // `lift` is the cot on top of that.
      const p = toWorld(dog.at[0], dog.at[1]);
      const y = p[1] + dog.lift;
      dog.mesh.position.set(p[0], y, p[2]);
      dog.mesh.rotation.y = dog.yaw;
      b.mesh.position.set(p[0], y + 0.62, p[2]);
    }
    // No price, no balloon. The same rule her card follows: a line that never
    // arrived is simply not one of the things anybody says.
    b.mesh.visible = !!live.doge && d < DOG_NEAR;
    if (!b.mesh.visible) return;
    if (b.said !== live.doge) { b.said = live.doge; b.say(live.doge); }
    b.mesh.rotation.y = Math.atan2(camPos.x - b.mesh.position.x,
      camPos.z - b.mesh.position.z);
  }

  // ── the performance ────────────────────────────────────────────────────────
  /**
   * What she does when you walk up to her.
   *
   * Notice, down on all fours, crawl, up, three somersaults, and then the rest
   * of her repertoire in a fixed order — the shimmy, the heart, the note, the
   * cartwheels — before she settles into larking about with you behind. Every
   * part of it is a clip authored in tools/blender/human_mh.py rather than
   * anything this file knows how to draw. That is the whole point of having
   * spent a session on skinning: this is a state machine over a dozen names and
   * two numbers, and it is the first thing in the game that is *content*.
   *
   * The fixed order is `show.queue`, and it is worth saying why it exists,
   * because everything after the routine is a dice roll and that is the more
   * natural way to build this. A move that only ever comes up one time in
   * twelve is a move you cannot judge, cannot show anybody, and cannot tell is
   * broken. Doing all four once, in order, the first time you walk up to her
   * turns the repertoire into something you have seen rather than something you
   * have been told about — and after that the dice take over and she is
   * unpredictable again, which is the point of her.
   *
   * And then there is the turn, which is the one thing on the promenade that is
   * not a trick she is doing for you. Point the branch at her for long enough —
   * sixteen seconds of it actually landing, which is over a third of the pack —
   * and she stops being delighted about it: she gathers, throws herself open,
   * and comes up doing a routine that is not hers, alight, throwing fire down
   * the deck. Everything it lights is a real burning object on the ground
   * mode's own list, so the branch puts them out, the tally counts them, and the
   * ones you leave count against you.
   *
   * It is the only loop in the game that the player starts on purpose and then
   * has to close. Everything else here is weather.
   *
   * One thing is deliberately not here: she does not collide with anything. She
   * performs on the strip of deck between the middle terrace and the front row
   * of huts, which is clear by construction, and if a walker happens to be
   * standing in it she goes through them. A figure doing a tucked front
   * somersault while being pushed out of a parasol is worse than either.
   *
   * The distances are the load-bearing part. 17 m is about where you can tell
   * she is a person rather than a shape, so it is where she is allowed to know
   * you are coming; 46 m is far enough that giving up does not look like a sulk.
   */
  const SHOW = {
    near: 17,           // she notices you inside this many metres
    far: 46,            // and gives up if you get this far away
    crawl: 0.95,        // m/s on all fours. One clip cycle is 1.1 s and covers
                        // 1.05 m, which is what keeps her hands off the ice.
    // m/s walking, and it is a measured number rather than a chosen one:
    // `walk_floor` in tools/blender/human_mh.py puts her feet 0.687 m apart at
    // the footfall and the cycle is two of those in a second. Changing it here
    // does not make her walk faster, it unhooks her feet from the deck — see
    // `showPace`, which scales the clip's clock by v over this.
    walk: 1.37,
    hop: 2.1,           // m/s the somersault carries her while she is over
    flips: 3,           // "a bunch of summersaults"
    wheel: 1.9,         // m/s through a cartwheel — about 1.7 m of deck a turn
    wheels: 3,          // and how many she strings together
    crawlFor: 4.6,      // seconds down on all fours
    playFor: 24,        // and larking about, before she comes home to her spot
    lane: [SHOW_LANE0, JAD.rowA - 1.8],      // the strip of deck she plays on
    // And the length of stage she has, which used to be the whole shore.
    //
    // `far: 46` is the distance at which she gives up on you, and it is tuned
    // against a 189 m promenade where you are never more than a few seconds
    // from her. On the 572 m shore she wandered out of her own encounter and it
    // dissolved with nobody having gone anywhere. 86 m either side of the jetty
    // is 8 to 180, which is what the old `8, LEN - 8` came to on the shore she
    // was written for.
    t0: Math.max(8, JAD.jetty - 86),
    t1: JAD.jetty + 86,
    // The wander. A new heading every `turn` seconds, `swing` radians off the
    // last one, at a speed drawn fresh each time — which is a random walk with
    // the corners rounded off, and the rounding is the whole trick. Redrawing
    // the heading outright every second is a fly in a jar; carrying it forward
    // and nudging it is somebody enjoying themselves.
    // `pace` is a multiple of `walk`, not a speed — `walk` is the speed the
    // clip is *authored* for and changing that would only unhook the feet from
    // the deck. Slowing her down means drawing a smaller multiple, and the clip
    // slows with it.
    //
    // 0.80 to 1.55 is 1.10 to 2.12 m/s. Those two ends are a dawdle and a good
    // brisk walk, and there is nothing above them any more: the range used to
    // top out at 3.3 m/s, which was a jog, and it was only ever set that high
    // because the clip underneath was a skip and a slow skip looks silly. A
    // walk played at 2.4x does not look like hurrying, it looks like a film
    // running fast, so the honest ceiling is much lower than the old one and
    // the clip is the reason.
    turn: [0.55, 1.35], swing: 1.5, pace: [0.80, 1.55],
    crawlTurn: [0.9, 2.0], crawlSwing: 0.7,
    // How fast a drawn speed is taken up. `showWander` hands `showPace` a fresh
    // number every second or so and it used to be believed on the frame it
    // arrived, so an amble became a jog between two frames — and because the
    // clip's clock is scaled off the same number, the *animation* stepped with
    // it. A third of a second of getting there is what a person takes.
    accel: 3.2,
    // And the turn, which was the other corner. See `turnRate`.
    turnP: 3.4,         // rad/s of yaw asked for per rad of heading error
    turnEase: 7,        // and how fast that ask is taken up
    turnMax: 3.0,       // rad/s, walking
    sideMax: 2.6,       // and the same for the shoulders-across offset,
    orbitMax: 3.4,      // except in the orbit, where it carries the whole yaw
    edge: 14,           // metres from the ends of the resort the push starts
    joy: 0.22,          // chance that a new heading comes with a somersault
    spin: 0.16,         // and the chance it comes with a run of cartwheels
    // And the dance. Lower odds than the acrobatics on purpose: a somersault is
    // over in a second and a half and this is held for three or four, so equal
    // odds would have her dancing most of the time she is not tumbling and
    // wandering almost never.
    //
    // There were two of these. The moonwalk is gone — not shelved behind a zero,
    // taken out, because a move nobody wants to watch is not a move that wants
    // an option flag. It was the one thing in the repertoire that had to be sold
    // by the illusion rather than by the pose, and a glide is sold or it is not:
    // the anchor foot has to be *still*, to the degree, and a rig with no toe
    // roll and a clip resampled to sixteen keys cannot hold that. The clip is
    // still in tools/blender/human_mh.py and comes out of the payload with the
    // next Blender run. The shimmy takes its share of the dice.
    shimmy: 0.12,
    shimmyFor: 3.4,     // seconds of it, which is about eight reversals
    // And the other one, which is the shimmy's opposite in every way that
    // matters: a twist that never reaches the hips against a pitch that lives
    // in nothing else. Held a shade longer because the beat is slower — 0.52 s
    // a cycle against the shimmy's 0.44 — so 3.8 s is about seven of them,
    // which is the same *count* rather than the same clock.
    twerk: 0.10, twerkFor: 3.8,
    // And the two she does with her hands. Held longer than the shimmy because
    // both of them are things you are meant to *read* — a gesture you have to
    // recognise and a card you have to actually finish — and three seconds is
    // not long enough to walk round to the front of somebody and take it in.
    heart: 0.09, heartFor: 4.6,
    note: 0.09, noteFor: 5.4,
    say: [1.8, 4.2],    // seconds between noises while she is playing
    // ── the water ─────────────────────────────────────────────────────────
    // How long the jet is remembered after it comes off her. Not zero: a hose
    // is aimed by hand and by eye, it wanders a metre in and out of a target
    // constantly, and reading the trace literally would have her standing up
    // and sitting back down three times a second.
    grace: 0.5,
    owed: 2.0,          // and how long a reaction she has not been able to give
                        // yet stays owed — long enough to outlast a somersault
    hitR: 0.62,         // m — how wide a target she is to the jet
    hitH: 1.85,         // and how tall
    // And how long she stays interested afterwards. Half a minute is long
    // enough to be a change in what she is doing rather than a twitch, and
    // short enough that it is worth doing again.
    lockFor: 32,
    ring: 6.0,          // m — the radius she orbits you at
    arc: [2.6, 5.6],    // seconds before she turns and sweeps back the other way
    // ── the turn ──────────────────────────────────────────────────────────
    // "If we spray her with water for too long she at some point switches into
    // a Prodigy Firestarter routine and starts casting fireballs."
    //
    // Five and a half seconds of jet actually landing on her, and it is worth
    // being precise about what that means, because the note above `figureWet`
    // says in as many words that litres are ignored and that a soak meter on a
    // child playing in a hose would be the game being a game about the one thing
    // here that is not one. That note still stands and this does not contradict
    // it. What is metered here is not damage and there is no state she is being
    // driven toward — nothing is filling up, and hosing her is not *for*
    // anything. It is a clock on how long you have been doing one thing, and
    // what it buys is a different thing to look at.
    //
    // It was sixteen, which at 9.2 litres a second is a hundred and fifty
    // straight down the branch and, because the jet wanders off her constantly
    // and the meter only counts the frames it is actually landing, nearer two
    // hundred and fifty out of the pack in practice. That is well over half of
    // a four-hundred-litre trolley spent on a joke, and the reasoning behind it
    // — that the turn should cost enough that nobody reaches it by accident —
    // was answering the wrong question. Nobody reaches it by accident at five
    // seconds either: a jet held on one person for five continuous seconds is
    // already unmistakably deliberate. What sixteen actually bought was that
    // most players never saw the best thing on the promenade at all, and that
    // the ones who did had no water left to fight the fire with afterwards.
    // Fifty litres is an eighth of the pack, which is a price worth paying
    // twice.
    soakFor: 5.5,
    // And a second and a half of it inside the kabina. See the note on the
    // meter itself: in there the water is not buying a set piece, it is asking
    // a question, and a question you have to hold for five seconds has been
    // answered by the holding.
    soakIn: 1.5,
    // A minute is a set piece and ten seconds is a twitch. Twenty-six is long
    // enough to light four or five patches of deck and put you properly behind.
    blazeFor: 26,
    // And five with the branch on her ends it, which is the loop closing: the
    // water started this and the water is what stops it. Not instant, because
    // instant would mean the whole sequence could be cancelled by a player who
    // happened to still be holding the trigger when it began.
    douseFor: 5,
    castEvery: [1.4, 2.5],   // seconds between fireballs
    // And between cards. The first is seeded at the far end of this at the
    // moment she lights, so the fire comes first and the announcement comes
    // after it — which is the right order for a boast — and a twenty-six second
    // burn then gets two of them. Three would be a woman with a sign rather
    // than a woman on fire.
    boastEvery: [6, 11],
    // Two cards at 2.2 s each. Long enough to read four words and take the
    // second one as a punchline, short enough that she is a woman on fire who
    // paused rather than a woman holding a sign.
    boastFor: 4.4,
    // How long she stays down once the water is off her. Measured from the
    // moment the jet stops, not from the moment she got there, so keeping the
    // branch on her keeps her there — and eleven seconds after you stop is long
    // enough to walk round her and short enough that she is not furniture.
    keptFor: 11,
    // And the knee shuffle, for when you back off across the room while she is
    // down there. All three numbers are about a room four metres across: a pace
    // that reads as knees and not as a walk, a gap that is far enough to be a
    // retreat rather than a step back, and one close enough to be over. The
    // stopping distance is the wide one on purpose — she is arriving at
    // somebody on her knees, and arriving at their shoes is a different scene.
    creep: 0.40,
    creepFrom: 1.35,
    creepTo: 0.80,
    // How far the chin comes up while the water is on her down there, in
    // radians. Thirty degrees off whatever the clip had her head doing: enough
    // that she is looking up at somebody standing over her rather than at their
    // knees, and short of the angle where a neck stops being a neck.
    chin: 0.52,
    // And how the mouth answers a branch that is left on it. A mouth that is
    // simply open is a pose; one that keeps opening is somebody taking it, and
    // the difference costs one accumulator. `gulp` is seconds of unbroken water
    // to reach the wide end of `open`, `spit` is how long it takes to forget —
    // slower, because she is not going to have swallowed it in two seconds —
    // and `froth` is how far up the fill the foam starts to collect, which is
    // late on purpose. Foam that arrives with the first squirt is a face full of
    // shaving cream; foam that arrives once she has been holding her mouth under
    // it for four seconds is foam.
    gulp: 5.0,
    spit: 9.0,
    open: [0.52, 0.46],
    froth: 0.26,
    castAt: 0.46,       // s into the `cast` clip where it leaves her hand. This
                        // is FIRE_CAST_AT in tools/blender/human_mh.py and it
                        // has to move with it or the ball appears out of a hand
                        // that has already finished throwing.
    // Metres down the deck they land. Sixteen was too far: she throws along the
    // line she is facing, that line is at you, and anything past about a dozen
    // metres came down level with the camera or behind it — so the fire you
    // were meant to go and deal with was the one you could not see.
    ballRange: [4, 13],
    // Radians of arc she scatters them over, and it is wide on purpose. She
    // throws along the line she is facing and the line she is facing is at
    // *you*, so a tight spread puts every ball at your feet or over your head —
    // which reads as being shot at rather than as a promenade catching light.
    // A hundred and forty degrees lays them out along the deck either side of
    // you, where they can be seen and got to.
    ballSpread: 2.4,
    fires: 7,           // most patches alight at once. A cap and not a budget:
                        // seven is already more than the branch can hold, and
                        // without one a routine you ignore lays down thirteen.
  };

  /**
   * Is she under the roof of the one kabina that opens?
   *
   * Two things ask, and they used to ask separately: the soak meter, which is
   * a fifth as long in there because what happens in the room is a question
   * rather than a set piece, and — since the report — the water on her face.
   * One test, so they can never disagree about which side of the doorway she
   * is on.
   */
  function sheIsIn() {
    const K0 = special;
    return !!K0 && !!show && show.t > K0.t0 - 0.2 && show.t < K0.t1 + 0.2
      && show.s > K0.face + 0.15 && show.s < K0.s1;
  }

  /**
   * Her mesh yaw, for a heading in the resort's own frame: 0 runs along +t and
   * −PI/2 is the water.
   *
   * No half turn. Her forward is +X, the same as the crowd rig's, because
   * tools/blender/human_mh.py lands both of them there — MakeHuman imports
   * facing −Y and the fix-up matrix maps that to +X. A stray half turn here is
   * what had her crawling and walking backwards: she travelled along her
   * heading while facing the other way down it.
   */
  const faceYaw = (t, ang) => rigYaw(t, ang);

  /**
   * Move her, and run the gait off the same number.
   *
   * The walk clip covers 0.687 m a step and is authored to look right at
   * 1.37 m/s; play it at any other speed and the feet slide, because nothing in
   * the runtime matches a footfall to the ground. That has quietly been true
   * since she started wandering — `play` draws a fresh pace every second or so
   * — and it is much more visible in the orbit, where she is travelling
   * sideways and both feet are in profile. It is more visible again now that
   * the clip is a walk: a skip is airborne for half of itself and you lose
   * track of the contact, and a walk never leaves the ground for you to lose
   * track over.
   *
   * The fix is one line and it should have been there all along: scale the
   * clip's clock by the same factor as the distance. A gait at half speed is a
   * gait that takes twice as long, which is what a slow walk *is*.
   *
   * And the speed itself is eased into rather than stepped to. `showWander`
   * draws a new pace every second or so and this took it on the frame it was
   * drawn — so an amble became a jog between two frames, and because the line
   * below hangs the clip's clock off the same number, the animation jumped with
   * her. Nothing about that read as a decision; it read as a dropped frame.
   */
  function showPace(v, dt) {
    show.vel = damp(show.vel, v, SHOW.accel, dt);
    skinFig.state.speed = clamp(show.vel / SHOW.walk, 0.55, 1.75);
    showMove(show.vel, dt);
  }

  /**
   * Turn an angle toward another one, the way a body turns rather than the way
   * a servo does.
   *
   * All three of these used to be `ang += clamp(err, ±rate * dt)`, which is a
   * bang-bang controller: the frame a new heading is drawn she is already
   * turning at the full three radians a second, and the frame she arrives she is
   * not turning at all. Both ends are a corner. It is the single most visible
   * thing about how she moves, because it is on her *yaw* — a corner in a
   * position is a bump and a corner in a heading is a figure being steered.
   *
   * So: ask for a rate proportional to the error, which takes the corner off the
   * arrival on its own, and then damp the rate toward that ask, which takes it
   * off the departure. `turnP` against `turnEase` puts the pair at about 0.7 of
   * critical — a touch of overshoot, settling inside a second, which is a person
   * turning round rather than a turret slewing.
   *
   * Returns the new rate. The caller adds `rate * dt` itself, because two of the
   * three callers have to wrap the angle afterwards and one must not.
   */
  function turnRate(err, rate, max, dt) {
    while (err > Math.PI) err -= TAU;
    while (err < -Math.PI) err += TAU;
    return damp(rate, clamp(err * SHOW.turnP, -max, max), SHOW.turnEase, dt);
  }

  /**
   * Walk her to a point, and never mind the lane.
   *
   * `showMove` clamps `s` into the strip of deck she performs on, which is
   * exactly right for everything she does out there and is a wall across the
   * doorway of the one place she can go indoors. This is the same integration
   * with the clamp taken off and a target instead of a heading, and the
   * distance it returns is what the caller uses to decide it has arrived.
   *
   * She still has no collision — see the note at the top of the performance —
   * so the doorway is threaded by putting the waypoints in it rather than by
   * pushing her out of anything. Which is also why there are three of them and
   * not one: a straight line from the promenade to the tabouret goes through a
   * metre and a half of hut.
   */
  function showTo(tt, ss, dt, mul = 1) {
    const d0 = tt - show.t, d1 = ss - show.s;
    const dist = Math.hypot(d0, d1);
    show.want = Math.atan2(d1, d0);
    const want = dist > 0.14
      ? Math.min(SHOW.walk * mul, Math.max(0.45, dist * 1.8)) : 0;
    show.vel = damp(show.vel, want, SHOW.accel, dt);
    skinFig.state.speed = clamp(show.vel / SHOW.walk, 0.55, 1.75);
    show.t += Math.cos(show.ang) * show.vel * dt;
    show.s += Math.sin(show.ang) * show.vel * dt;
    return dist;
  }

  /**
   * The knee shuffle, which gets its own mover rather than borrowing `showTo`.
   *
   * Everything `showTo` does with speed is about a walk: a 0.45 m/s floor under
   * the pace, so a walker crossing the last half metre never mimes, and a clip
   * rate that follows the pace, so a stride covers the ground the stride looks
   * like it covers. On knees both are wrong — the pace *is* below that floor,
   * and the clip is authored to the pace rather than the other way round — so
   * this moves her at one speed and plays it at one rate.
   */
  function showCreep(tt, ss, dt) {
    const d0 = tt - show.t, d1 = ss - show.s;
    const dist = Math.hypot(d0, d1);
    show.want = Math.atan2(d1, d0);
    show.vel = damp(show.vel, dist > SHOW.creepTo ? SHOW.creep : 0,
      SHOW.accel * 0.6, dt);
    skinFig.state.speed = 1;
    show.t += Math.cos(show.ang) * show.vel * dt;
    show.s += Math.sin(show.ang) * show.vel * dt;
    return dist;
  }

  /**
   * Stand still, indoors.
   *
   * `showPace(0)` is the obvious way to do this and it is wrong in exactly one
   * place: it goes through `showMove`, which clamps `s` into the strip of deck
   * she performs on — so every frame she stood in the kabina she was quietly
   * teleported back out to the lane edge and the whole indoor sequence played
   * itself out on the promenade, four metres from the door, in front of
   * everybody.
   */
  function showHold(dt) {
    show.vel = damp(show.vel, 0, SHOW.accel, dt);
    skinFig.state.speed = 1;
  }

  /** Advance her along her heading, kept on the deck and inside the resort. */
  function showMove(v, dt) {
    show.t = clamp(show.t + Math.cos(show.ang) * v * dt, SHOW.t0, SHOW.t1);
    show.s = clamp(show.s + Math.sin(show.ang) * v * dt, SHOW.lane[0], SHOW.lane[1]);
  }

  /**
   * A wander heading bent away from the edges of her ground.
   *
   * Bent, not clamped. `showMove` clamps as a backstop and a clamp on its own
   * is what makes wandering crowd figures grind along a wall — she arrives at
   * the lane edge, the clamp eats the across-shore half of every step, and she
   * slides down the line still pointed into it. Adding an outward term to the
   * heading *vector* turns her instead, and it grows with the overshoot, so a
   * metre inside the margin is a suggestion and a metre outside is a decision.
   */
  function showSteer(a) {
    const push = (v, lo, hi) => (v < lo ? lo - v : v > hi ? hi - v : 0);
    const x = Math.cos(a) + push(show.t, SHOW.edge, LEN - SHOW.edge) * 0.5;
    const y = Math.sin(a) + push(show.s, SHOW.lane[0] + 1.6, SHOW.lane[1] - 1.6) * 1.2;
    return Math.atan2(y, x);
  }

  /** Re-aim: a new heading off the current one, and a new speed to take it at. */
  function showWander(turn, swing) {
    show.tick = turn[0] + Math.random() * (turn[1] - turn[0]);
    show.wander += (Math.random() * 2 - 1) * swing;
    show.pace = SHOW.walk * (SHOW.pace[0] + Math.random()
      * (SHOW.pace[1] - SHOW.pace[0]));
  }

  /**
   * A noise, quieter the further off you are. Silent from the aeroplane.
   *
   * Linear in distance and not squared. Squared, she was inaudible at fifteen
   * metres — which is inside the range at which she notices you, so the first
   * thing she ever said was already too quiet to hear.
   */
  /**
   * Distance first, and then how wet she is.
   *
   * The soaking already changed what she says and how she moves; it did not
   * change how hard she said it, so the loudest thing that happens to her all
   * game was being delivered at exactly the level of her idle chatter. `wet`
   * is the right multiplier rather than the phase, because it rises the
   * instant the jet lands and falls off over the ten seconds she takes to dry
   * — so she is loudest while the water is actually on her and comes back down
   * on her own, without a single extra piece of state to get out of step.
   *
   * The ceiling is 1.8 and `squeak` clamps there, which is where the maximum
   * below comes from.
   */
  function showSay(kind, d) {
    if (!audio || state.phase === 'intro') return;
    const g = clamp(1.15 - d / 46, 0, 1) * (1 + (show ? show.wet : 0) * 0.75);
    if (g > 0.04) audio.squeak(kind, g);
  }

  /**
   * The idle chatter, and the reason it is a list rather than a coin flip.
   *
   * The ćuk keeps the largest share on purpose — it is the one call that is
   * *hers*, the thing you hear across the channel and walk towards, and a
   * signature that comes up one time in eight stops being a signature. The rest
   * are there so that the fifth minute on the promenade does not sound like the
   * first. Weighted by hand and not evenly: `tick` and `burr` are the strangest
   * two and are rationed accordingly.
   */
  const CHAT = ['cuk', 'cuk', 'cuk', 'trill', 'trill', 'peep', 'peep',
    'warble', 'squee', 'burr', 'tick'];
  const IDLE_CHAT = ['cuk', 'cuk', 'cuk', 'cuk', 'cuk', 'peep', 'warble'];
  const WET_CHAT = ['squee', 'squee', 'trill', 'peep', 'warble'];
  const FIRE_CHAT = ['squee', 'squee', 'tick', 'peep'];
  const say1 = (list) => list[(Math.random() * list.length) | 0];

  // ── the water ───────────────────────────────────────────────────────────────
  /**
   * Where she is, for the jet to aim at — or nothing, if there is nothing to
   * aim at yet. Read once per trace by 47-ground.js; see `addGuest` there.
   */
  function figureProbe() {
    if (!show || !skinFig || !skinFig.mesh.visible) return null;
    const p = toWorld(show.t, show.s);
    return { x: p[0], y: p[1], z: p[2], r: SHOW.hitR, h: SHOW.hitH };
  }

  /**
   * The jet is on her.
   *
   * Litres are ignored on purpose. This is not a fire and she is not a
   * casualty: there is no quantity of water that finishes the job, and putting
   * a soak meter on a child playing in a hose would be the game being a game
   * about the one thing here that is not one. All that is recorded is *that*
   * it is landing, and the clock that says how recently.
   */
  function figureWet(_litres) {
    if (!show) return;
    show.hit = SHOW.grace;
    show.owed = SHOW.owed;
    show.lock = SHOW.lockFor;
    // Straight to most of the way wet, rather than ramping there from nothing.
    // Four hundred litres a minute does not soak anybody gradually, and the
    // ramp had a side effect worth being rid of: `showSay` reads this to decide
    // how loud she is, and her first yelp — the one that is a reaction to being
    // hit, and the one that most wants to be loud — fired one frame in, when
    // the ramp was still at 0.02 and it came out at the level of idle chatter.
    show.wet = Math.max(show.wet, 0.55);
  }

  // ── the fireballs ───────────────────────────────────────────────────────────
  //
  // Two lists and they belong to two different owners, which is the whole design
  // of this bit.
  //
  // `balls` are in flight and are ours: a position, a velocity and gravity, and
  // they are drawn by handing 47-ground.js a few extra flames through `flames()`
  // below. `fires` are what they turn into when they land, and those are handed
  // over completely — they go out as this locale's `objects`, which is the same
  // list the aerodrome fills with fuel drums and burning aeroplanes, and from
  // that moment the ground mode owns them entirely. It spreads heat between
  // them, grows them, draws them, lets the branch put them out, counts the ones
  // you save and the ones you lose, and stops the fire catching your own
  // clothes if you stand in one.
  //
  // Nothing here reimplements any of that. The alternative was a second little
  // fire model living on the promenade that would have had to be kept in step
  // with the real one for ever, and the cost of not writing it is one field on
  // an object literal.
  const balls = [];
  const fires = [];
  const ballFx = [];

  /**
   * Where the ball leaves her hand, in the resort's own frame.
   *
   * Half a metre in front of her and a fifth of one to the side, at the height
   * her right hand is at on the release frame of the clip. Read off the pose
   * rather than off the skeleton on purpose: asking the rig for a bone's world
   * position means walking the whole chain a second time, once a throw, to place
   * something that is a metre of glowing air.
   */
  function castFrom() {
    const a = show.ang + show.side;
    const ct = Math.cos(a), st = Math.sin(a);
    const t = show.t + ct * 0.52 + st * 0.20;
    const s = show.s + st * 0.52 - ct * 0.20;
    return [t, s, walkY(t, s) + 1.42];
  }

  /** One fireball, thrown down the deck in front of her. */
  function throwBall() {
    const [t0, s0, y0] = castFrom();
    const a = show.ang + show.side + (Math.random() - 0.5) * SHOW.ballSpread;
    const R = SHOW.ballRange[0]
      + Math.random() * (SHOW.ballRange[1] - SHOW.ballRange[0]);
    // Clamped to the deck rather than aimed at it. The clamp bends the throw a
    // little when she is near an end, which is better than the alternative:
    // fireballs landing in the sea, where there is nothing to catch and nothing
    // for you to do about it.
    const t1 = clamp(show.t + Math.cos(a) * R, SHOW.t0 - 4, SHOW.t1 + 4);
    const s1 = clamp(show.s + Math.sin(a) * R, SHOW.lane[0], SHOW.lane[1]);
    // Time of flight from the range, so a short throw is a fast flat one and a
    // long throw hangs. Solved for the vertical speed that gets there — which is
    // what makes it land where it was aimed instead of wherever the arc happened
    // to put it.
    const T = clamp(Math.hypot(t1 - t0, s1 - s0) / 11, 0.55, 1.9);
    const y1 = walkY(t1, s1);
    balls.push({
      t: t0, s: s0, y: y0,
      vt: (t1 - t0) / T, vs: (s1 - s0) / T,
      vy: (y1 - y0) / T + 0.5 * 9.81 * T,
      age: 0, life: T + 0.5,
    });
  }

  /**
   * A ball has come down. Light the deck where it landed.
   *
   * The dead ones are swept first rather than on a timer, because `out` is set
   * by the ground mode and this is the only place that has any reason to care.
   */
  function light(t, s) {
    for (let i = fires.length - 1; i >= 0; i--) if (fires[i].out) fires.splice(i, 1);
    if (fires.length >= SHOW.fires) return;
    const p = toWorld(t, s);
    fires.push({
      // `h` is what the ground mode scales the flame off, and 1.0 drew the same
      // two metres of fire it gives a burning fuel drum. This is a fireball that
      // landed on concrete — what catches is a parasol, a lounger, a towel — so
      // 0.6, which comes out at about the size of somebody whose kit is alight.
      kind: 'blaze', w: 1.2, h: 0.6, x: p[0], y: p[1], z: p[2],
      // `soak` is the litres it takes to put out and has to stay well under
      // flow times life or the thing cannot be extinguished at all — twenty-six
      // is under three seconds of the branch held on it. `life` is how long it
      // burns if you do not: half a minute, and then it counts against you.
      fuel: 0.55, soak: 26, life: 30, col: [0.86, 0.42, 0.16],
      // Already alight. Everything else on this list starts cold and catches
      // from something; this one arrived on fire.
      burning: 0.4, heat: 1.02, wet: 0, out: false, spent: 0,
    });
  }

  function stepBalls(dt) {
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.age += dt;
      b.t += b.vt * dt;
      b.s += b.vs * dt;
      b.vy -= 9.81 * dt;
      b.y += b.vy * dt;
      if (b.y <= walkY(b.t, b.s) + 0.04 || b.age > b.life) {
        balls.splice(i, 1);
        light(b.t, b.s);
      }
    }
  }

  /**
   * The flames 47-ground.js should draw for us that are not `objects`: every
   * ball still in the air, and her.
   *
   * Her being alight is the whole point of the sequence, and it is three small
   * flames rather than one big one. One was tried first, at about the size the
   * ground mode gives a member of the crew whose kit has caught, and it came
   * out a six-metre column standing exactly where she was: the routine was
   * behind it, which is the one thing this must not do. Three — hips and both
   * shoulders — read as a person alight instead of as a bonfire, and leave her
   * visible through the middle of it.
   *
   * They fade with `burn` rather than snapping off, so putting her out visibly
   * wins before it finishes winning.
   */
  const ON_FIRE = [[0.0, 0.92, 1.15], [-0.20, 1.34, 0.74], [0.20, 1.34, 0.74]];

  function fieldFlames() {
    ballFx.length = 0;
    if (!show) return ballFx;
    for (const b of balls) {
      const p = toWorld(b.t, b.s);
      ballFx.push({ x: p[0], y: b.y, z: p[2], size: 1.1, v: 0.95 });
    }
    if (show.burn > 0) {
      const q = 0.45 + 0.55 * show.burn;
      for (const [off, up, sz] of ON_FIRE) {
        const p = toWorld(show.t + off, show.s);
        ballFx.push({ x: p[0], y: p[1] + up, z: p[2], size: sz * q, v: 0.45 + 0.4 * q });
      }
    }
    return ballFx;
  }

  /**
   * The phases she can be pulled out of by a hoseful of water.
   *
   * Not the acrobatics. A somersault and a cartwheel are both a body committed
   * to an arc with its hands off the ground, and cutting to a standing pose
   * halfway through one is a teleport — she would blink from upside down to
   * upright, which is worse than a beat of not reacting. So she finishes what
   * she was doing first, which is what a person would do anyway.
   *
   * The crawl *is* in the list, even though standing up out of it in a third of
   * a second is a scramble rather than a stand. Four and a half seconds of
   * crawling, then a getup, then three somersaults is fourteen seconds of being
   * hosed and not noticing, and a scramble is much the better of the two.
   */
  const WETTABLE = { idle: 1, notice: 1, crawl: 1, play: 1, home: 1,
    aim: 1, orbit: 1, shimmy: 1, twerk: 1, heart: 1, note: 1 };

  /**
   * How long she holds each of the standing numbers.
   *
   * A map rather than `SHOW[phase + 'For']`, which is what this was for about a
   * minute: a lookup built by string concatenation works right up until a phase
   * is renamed and then fails by silently reading `undefined`, which compares
   * false against every timer and leaves her dancing until you walk away.
   */
  const HOLD_FOR = { shimmy: 'shimmyFor', twerk: 'twerkFor',
    heart: 'heartFor', note: 'noteFor' };

  /**
   * And the phases the *turn* cannot start from.
   *
   * A shorter list than WETTABLE's complement, and deliberately: standing up out
   * of the crawl to react to a squirt of water is one thing, but there is no
   * phase this is not worth interrupting except the ones where interrupting is
   * physically a teleport. So: the two airborne moves, the getting up and down,
   * and the three that make up the turn itself. Everything else — including
   * `bask`, which is where she will nearly always be when the meter runs out,
   * because standing in the jet is how the meter fills — goes straight over.
   */
  const HELD = { down: 1, up: 1, flip: 1, joy: 1, wheel: 1,
    flare: 1, blaze: 1, cast: 1, boast: 1,
    // And the indoor answer to the same meter — see `submit` below. It is held
    // for the identical reason the turn is: it is not a mood, it is a thing
    // that has happened, and the meter refilling underneath it would have her
    // going down onto her knees from a position she is already in.
    submit: 1, kept: 1, rise: 1, creep: 1 };

  // And the three of those that have a beat under them. `flare` is in it
  // because the riser is the point of the riser: the music starts a second and
  // a tenth before the first kick, under the clip where she throws herself
  // open, and the downbeat lands on the frame the stamping starts.
  // `boast` is in it for both reasons at once: the beat must not stop while she
  // holds the card up — a track that drops out for three seconds in the middle
  // has ended, not paused — and the ink rides the same flag, so a firestarter
  // showing you a sign that says she is one had better still have flames on her
  // arms while she does it.
  const MUSIC = { flare: 1, blaze: 1, cast: 1, boast: 1 };

  /**
   * And how pleased she is, per phase, which is the only thing driving her face.
   *
   * A default of 0.30 rather than 0: the paint already gives her a mouth whose
   * corners sit above its middle, on the argument that a resting mouth over the
   * top of everything she does reads as somebody enduring it, and this is the
   * same argument one step further on. She is at the beach.
   *
   * The three that are not on this table are the turn — `flare`, `blaze` and
   * `cast` — and they are handled below rather than here, because what her face
   * does there is not a smaller smile. It is a different face.
   */
  const SMILE = {
    idle: 0.30, notice: 0.62, down: 0.55, crawl: 0.50, up: 0.72,
    flip: 0.85, play: 0.55, aim: 0.70, wheel: 0.85, bask: 1.00,
    orbit: 0.80, joy: 1.00, shimmy: 0.90, home: 0.45,
    // She is facing away for this one and you cannot see her face at all, so
    // the number is about the two frames of the crossfade either side of it.
    twerk: 0.95,
    // Both of the hand ones are the widest she has. A heart made with a
    // straight face is a threat.
    heart: 1.00, note: 0.95,
    // Indoors. Lower across the board than anything on the promenade, and that
    // is the whole difference between the two places: out there every face she
    // makes is aimed at somebody, and in here she is drinking somebody's wine
    // in a room with the door open behind her.
    come: 0.55, enter: 0.40, wine: 0.30, meet: 0.85, untie: 0.60,
    dwell: 0.70, leave: 0.45,
    // The one thing in the room the hose gets you. She goes down on the way in
    // with the face of somebody who has decided to, and holds the widest smile
    // in the building at the bottom of it — which is the whole of why this is
    // not the promenade's answer to the same water. Out there she catches fire.
    submit: 0.75, kept: 1.00, rise: 0.80, creep: 0.95,
  };

  /**
   * The three she is on her knees for, indoors.
   *
   * `submit` is on the way down and is in it anyway: the water is usually still
   * on her while she goes, and a chin that waits for the clip to finish before
   * coming up is a chin that comes up after the moment it was answering.
   */
  const KNEES = { submit: 1, kept: 1, creep: 1 };

  /** The indoor track, as a set, so the trigger can tell it is already on it. */
  const KABIN = { come: 1, enter: 1, wine: 1, meet: 1, untie: 1,
    dwell: 1, leave: 1 };

  function stepShow(dt, pt, ps) {
    if (!show || !skinFig) return;
    const f = skinFig, S = f.state;
    const d = Math.hypot(show.t - pt, show.s - ps);
    // A one-shot that has run off its end. `update` leaves `curT` past `dur`
    // and `sample` clamps, so this stays true until something else is played.
    const done = S.cur && !S.cur.loop && S.curT >= S.cur.dur;
    show.tmr += dt;

    const go = (phase, clip, fade = 0.30) => {
      // Back to nominal on every clip change. `showPace` below runs the walk
      // off its own clock to keep her feet under her, and the somersault and
      // the cartwheel are timed to the second against the distances they carry
      // her — inheriting a rate from whatever she was doing before would put a
      // slow-motion flip in the middle of a lazy wander.
      S.speed = 1;
      if (clip) f.play(clip, { fade });
      show.phase = phase;
      show.tmr = 0;
      show.said = 0;
      // Let go of the bottle on the way out of anything that is not the drink.
      // The turn can arrive in the middle of it, and a bottle still welded to a
      // wrist through a cartwheel is the sort of thing that is funny once.
      if (phase !== 'wine') { show.held = 0; show.pour = 0; }
    };

    // The two set pieces, each with the setting-up its entry needs, so that the
    // dice below and the routine above can both start one without either
    // knowing what the other knows.
    const enterShimmy = () => {
      showSay('whee', d);
      go('shimmy', 'shimmy', 0.32);
    };
    // Longer fade than the shimmy's, because this one starts from a deep squat
    // with the knees bent forty-eight degrees and the trunk carried thirty-six
    // forward. A third of a second from standing to that is a collapse.
    const enterTwerk = () => {
      showSay('whee', d);
      go('twerk', 'twerk', 0.44);
    };
    // Both of these are done *at* somebody, so both turn to face you and
    // neither travels. The card picks its line on the way in rather than on the
    // way out, so that the one you are reading is the one she chose for you.
    const enterHeart = () => {
      showSay('trill', d);
      go('heart', 'heart', 0.36);
    };
    const enterNote = () => {
      if (banner) banner.pick();
      showSay('whee', d);
      go('note', 'note', 0.36);
    };
    // Lined up along the promenade first, and still walking while she does it.
    // A cartwheel wants a straight run of five or six metres and the deck is
    // only about four deep, so pointed any other way she would be over the edge
    // halfway through the second one.
    const enterWheels = () => {
      show.wander = Math.cos(show.ang) > 0 ? 0 : Math.PI;
      go('aim', 'walk', 0.30);
    };

    /**
     * The next number in the opening routine, or the wander once it is over.
     *
     * Every set piece ends by calling this rather than by going back to `play`
     * directly, which is what lets the same three states serve both the fixed
     * routine and the dice without knowing which one started them.
     */
    const showNext = () => {
      const nxt = show.queue.shift();
      if (nxt === 'shimmy') return enterShimmy();
      if (nxt === 'twerk') return enterTwerk();
      if (nxt === 'heart') return enterHeart();
      if (nxt === 'note') return enterNote();
      if (nxt === 'wheel') return enterWheels();
      show.wander = show.ang;
      showWander(SHOW.turn, SHOW.swing);
      return go('play', 'walk', 0.36);
    };

    // The jet, and its two clocks.
    //
    // `hit` is whether the water is on her *now*, and it is what `bask` watches
    // to decide when to stop standing in it. Half a second, because a branch is
    // aimed by hand and by eye and wanders in and out of a target constantly.
    //
    // `owed` is the reaction she has not had a chance to give yet, and it is a
    // separate number because the first version did not have one: a squirt that
    // landed during a somersault set `hit`, `hit` ran out inside the 1.4 s of
    // the clip, and she came down and carried on as if nothing had happened.
    // The comment above `WETTABLE` said she reacts at the end of the arc. She
    // did not. Two seconds is long enough to cover a somersault and a getup,
    // and short enough that water thrown at her a while ago stays thrown a
    // while ago.
    show.hit = Math.max(0, show.hit - dt);
    show.owed = Math.max(0, show.owed - dt);
    show.wet = clamp(show.wet + (show.hit > 0 ? dt * 1.1 : -dt * 0.09), 0, 1);

    // The third clock, and the slow one. It counts up only while the jet is
    // genuinely on her and comes back down at an eighth of the rate, so a
    // sixteen-second fill takes over two minutes to forget — which means it
    // survives you wandering off to refill the pack and does not survive you
    // forgetting about her for the rest of the mission.
    //
    // Full, it latches: it stops counting either way and waits for a phase it
    // is allowed to interrupt. Without the latch it never fires at all, which
    // is what it did — the meter hit the cap on one frame and the decay took it
    // a fiftieth of a second below the threshold on the next, so the test that
    // reads it was never once true on a frame that mattered.
    //
    // Indoors it is a fifth of that, and the two numbers are not the same
    // number for the same reason the two answers are not the same answer. Five
    // and a half seconds is the price of a set piece that costs you a quarter
    // of a trolley and puts a woman on fire in front of you. What happens in
    // the kabina costs nothing, is over in a second and a half, and is between
    // the two of you: making somebody stand in a small room holding a jet on a
    // person for five seconds to reach it is not a price, it is a wait.
    const her = sheIsIn();
    const full = her ? SHOW.soakIn : SHOW.soakFor;
    if (show.soak < full) {
      show.soak = clamp(show.soak + (show.hit > 0 ? dt : -dt * 0.12), 0, full);
    } else if (!HELD[show.phase]) {
      show.soak = 0;
      show.queue.length = 0;
      show.side = 0;
      showSay('squee', d);
      // Indoors she does something else with it, and that is the point of the
      // room. On the promenade being hosed in front of forty people is a dare
      // and she answers it by catching fire; in a four-metre changing hut with
      // the door shut and one other person in it, it is not a dare and there is
      // nobody to answer it in front of. So she goes down onto her knees, puts
      // her hands behind her back and smiles at you, and the flames stay
      // outside where they belong.
      //
      // Tested on her own position rather than on `KABIN`, because the
      // interesting case is precisely the one the phase table cannot see: she
      // can be hit standing in the doorway a second before the indoor track
      // picks her up. Which is also why `her` is worked out above rather than
      // here: the same test decides how long the meter is, so a woman standing
      // in the doorway is on the short one and answers the water the way the
      // room answers it.
      if (her) go('submit', 'submit', 0.30);
      else go('flare', 'flare', 0.30);
      return;
    }
    if (show.owed > 0 && WETTABLE[show.phase]) {
      show.owed = 0;
      show.side = 0;
      // And the routine is off. Being hosed is the more interesting thing that
      // just happened, and picking a rehearsed running order back up two states
      // later — after the basking and the orbit — would be a performer who had
      // not noticed. She can always run it again the next time she notices you.
      show.queue.length = 0;
      showSay('squee', d);
      go('bask', 'soak', 0.40);
    }

    // The needle drop, and it is fed rather than switched on. `audio` keeps a
    // third of a second of watchdog and stops the moment nobody is asking for
    // it, so every way out of the turn — doused, timed out, walked away from,
    // culled at 250 m by the gate in `updateCrowd`, the ground mode left
    // altogether — takes the music with it without any of them knowing there is
    // music. Which matters, because only one of those five is somewhere a
    // person would think to write the stop.
    //
    // Rolled off with distance on the same shape as her voice and over three
    // times the range: gone by about a hundred and forty metres, which is the
    // far end of the promenade. It is a needle drop and not a PA, but it is
    // *hers*, and hearing it from across the channel would make it the game's.
    if (audio && MUSIC[show.phase] && state.phase !== 'intro') {
      audio.firestarter(clamp(1.3 - d / 110, 0, 1));
    }

    // Her face. Two numbers, and everything they are made of is already here.
    //
    // The water is worth a third of a smile on its own — she is delighted by the
    // jet and the whole `bask` state exists to say so — and it is added rather
    // than tabled because it happens on top of whatever she was doing.
    //
    // And then the turn, where both numbers go the other way. She is not doing
    // this one for you: the smile goes out entirely, and `rate` drops to a tenth
    // so that the blinking all but stops. A face that keeps blinking politely
    // through it is a face that is still being pleasant, and the whole point of
    // the turn is that she has stopped.
    //
    // And her arms, which are the other half of the same idea. The flames are
    // not a costume she is wearing when you find her — they arrive with the
    // turn and climb her over about a second, which is the length of the riser,
    // and they go out again when the turn does.
    if (f.face) {
      const turn = !!MUSIC[show.phase];
      f.face.smile = turn ? 0
        : clamp((SMILE[show.phase] ?? 0.4) + show.wet * 0.32, 0, 1);
      f.face.rate = turn ? 0.1 : 1;
      // The ink stays. It arrives with the riser and it does not wash off —
      // this is not make-up she is wearing for the number, it is what the
      // number turned out to have been about. `uInk` is the flame front's
      // height up her arms and the shader eases it, so `turned` simply holds
      // the front at the top: the tongues keep licking, at rest, for the rest
      // of the afternoon.
      f.face.ink = turn || show.turned ? 1 : 0;
    }

    // ── the water in her face ─────────────────────────────────────────────
    //
    // Down on her knees indoors with the branch still on her: chin up, mouth
    // open, into it. Both ride `hit`, which the jet refreshes and which decays
    // over half a second, so this lasts exactly as long as you keep the water
    // there and lets go the moment you stop — no phase, no timer, no clip.
    //
    // The lift is laid over whatever is playing rather than baked into a second
    // `kept`: a held pose and a near-identical copy of it with the head in a
    // different place is two clips that have to be kept in step forever. And it
    // is in figure space, so it is a chin coming up whichever way she has
    // turned to face you.
    {
      const into = KNEES[show.phase] && show.hit > 0 ? 1 : 0;
      // Up fast and down slowly. She is answering the water, and a chin that
      // falls as quickly as it rose reads as a flinch.
      show.gape = damp(show.gape, into, into ? 9 : 3.2, dt);
      // And how long it has been going in, which is a different question from
      // whether it is going in now — `gape` is the gesture and lets go with the
      // jet; this is the tally and does not. Keeping them apart is what lets a
      // mouth that opened once keep opening while you hold the branch on it.
      show.fill = clamp(show.fill
        + (into ? dt / SHOW.gulp : -dt / SHOW.spit), 0, 1);
      if (f.face) {
        f.face.gape = show.gape * (SHOW.open[0] + SHOW.open[1] * show.fill);
        // Both gated on `gape` rather than on `fill` alone, so everything in
        // her mouth leaves with her mouth. A closed mouth with foam painted on
        // the inside of it is a closed mouth with a white line across it.
        f.face.foam = show.gape
          * sat((show.fill - SHOW.froth) / (1 - SHOW.froth));
        // And what is running down her, which is the third of these and the
        // only one that is not about her mouth. `wet` is the meter that already
        // exists — it goes most of the way up on the first squirt and comes
        // down over a dozen seconds — and the heavy feeds in the shader are
        // gated on `foam` anyway, so a woman who has been rained on gets a
        // sheen and threads, and a woman who has been holding her mouth under
        // the branch for ten seconds gets it coming out of the corners.
        f.face.wet = show.wet;
        // And whether any of it is drawn as water rather than only as shine.
        // Indoors, yes: that is the scene, in a room lit through one doorway
        // where a rivulet has to be lifted above its own albedo to be seen at
        // all. Out on the deck the same lift clips against a noon sun and the
        // threads come out as white splotches on her forehead — which is what
        // was reported, and is fair. Out there being hosed leaves her wet, and
        // wet is the sheen and the darkening, both of which are unconditional
        // in the shader.
        f.face.streak = her ? 1 : 0;
      }
      f.aim('head', 0, 0, 1, show.gape * SHOW.chin * (0.86 + 0.20 * show.fill));
    }

    // And the wrap, which she never puts back on.
    //
    // Derived every frame rather than switched by the events that bracket the
    // turn, which is how it was written first and which stranded her: `blaze`
    // owned the only line that put it back, and there are ways out of `blaze`
    // that do not run it. The range gate in `updateCrowd` is the plain one —
    // walk 250 m off mid-turn and `stepShow` stops being called at all, so the
    // event never fires. An event that has to be paired with another event some
    // unknown number of frames later is a state machine with a leak in it; a
    // value read off the state it belongs to cannot leak. That argument is why
    // this line is a line and not two calls, and it still holds now that the
    // state it reads is a latch rather than a meter.
    //
    // The ankle ink is not on that list and used to be: it arrived with the
    // dropped wrap, on the argument that it was a thing the room revealed. It
    // is not. A tattoo is not a costume change — it was on her when she walked
    // down here this morning, and the version where you can only see it in one
    // room is the version where it is a prop. Unconditional, from the first
    // frame she exists.
    if (skinFig) {
      skinFig.wear(!show.turned && !show.shed);
      skinFig.tattoo(true);
    }

    // And the card, which is only ever up during a phase that holds it.
    // Placed before the matrix update at the bottom of this function, because
    // it is a child of her mesh and that call is what pushes it to the GPU.
    if (banner) {
      banner.mesh.visible = show.phase === 'note' || show.phase === 'boast';
      if (banner.mesh.visible) banner.place();
    }

    // ── the room ──────────────────────────────────────────────────────────
    // She follows you in. Not "if she has noticed you" and not "if she is
    // between numbers" — the door is a thing you had to find, and a performer
    // who finishes her cartwheel first before deciding to come is a performer
    // who does not come, because the phase she is in is a dice roll you cannot
    // see. The one thing that outranks it is the turn: she is not doing
    // anything for anybody once that has started, least of all following them
    // indoors.
    const K = special;
    const inside = !!K && pt > K.t0 - 0.25 && pt < K.t1 + 0.25
      && ps > K.face + 0.15 && ps < K.s1 + 0.2;
    // `OWN` is everything that outranks the room: the turn, and the room's own
    // answer to the hose. The second one is not optional — `submit` is entered
    // from *inside* the kabina, so without it this line fires on the very next
    // frame and walks her back to the doorway to start coming in again, out of
    // a pose she has just gone down into three feet away from you.
    const OWN = { flare: 1, submit: 1, kept: 1, rise: 1, creep: 1 };
    if (inside && !KABIN[show.phase] && !MUSIC[show.phase]
        && !OWN[show.phase] && !show.turned) {
      show.leg = 0;
      go('come', 'walk', 0.34);
    }

    switch (show.phase) {
      // ── in ──
      // Three waypoints and not one, because a straight line from the deck to
      // the tabouret goes through a metre and a half of hut. Out to the middle
      // of the doorway, through it, and then round to the bottle.
      case 'come': {
        const legs = [[K.dc, K.face - 1.55], [K.dc, K.face + 0.55],
          [kit.wine[0], kit.wine[1]]];
        const g = legs[Math.min(show.leg, legs.length - 1)];
        // Slower on the last leg. She is arriving somewhere small and dark, and
        // walking into it at promenade pace reads as somebody who has come to
        // fix the boiler.
        const dist = showTo(g[0], g[1], dt, show.leg === 2 ? 0.72 : 1.05);
        if (dist < (show.leg === 2 ? 0.20 : 0.40)) {
          if (show.leg >= 2) { show.leg = 0; go('wine', 'wine', 0.42); }
          else show.leg++;
        }
        break;
      }

      // The bottle. `held` is the window the clip has it off the table, and it
      // is a ramp rather than a switch: the hand and the tabouret are 40 cm
      // apart at the moment of the grasp and a bottle that teleports between
      // them is a bottle nobody believes was ever picked up.
      case 'wine': {
        show.want = kit.wine[2];
        showHold(dt);
        const u = S.cur ? S.curT : 0;
        const wn = wineAt(u);
        show.held = wn.held;
        show.pour = wn.pour;
        // And the glass is full from the middle of the pour on, and stays that
        // way. Nobody drinks it and nothing empties it: she poured it for you
        // and it is sitting there, which is the state this room is about.
        if (u > 2.65 && kit.poured) kit.poured.visible = true;
        if (done) go('meet', 'idle', 0.45);
        break;
      }

      // Turned to face you, and that is all this one is. It exists because
      // everything either side of it is something she is doing to an object,
      // and without a beat between them she puts a bottle down and starts
      // undoing her clothes in the same movement.
      case 'meet':
        show.want = Math.atan2(ps - show.s, pt - show.t);
        showHold(dt);
        if (show.tmr > 1.5) {
          if (show.shed) go('dwell', 'idle', 0.40);
          else go('untie', 'untie', 0.40);
        }
        break;

      case 'untie': {
        show.want = Math.atan2(ps - show.s, pt - show.t);
        showHold(dt);
        // On the tug, not on the end of the clip: the last second of it is her
        // hands coming away from something that has already gone.
        if (!show.shed && S.cur && S.curT > 1.28) {
          show.shed = 1;
          if (kit.scarf) {
            const w = toWorld(show.t, show.s);
            kit.scarf.position.set(w[0], w[1] + 0.005, w[2]);
            kit.scarf.rotation.y = faceYaw(show.t, show.ang);
            kit.scarf.visible = true;
          }
        }
        if (done) go('dwell', 'idle', 0.45);
        break;
      }

      // And she stays. Nothing else happens in here yet, which is why this
      // phase does nothing but keep her pointed at you: the alternative is a
      // dozen frames of her wandering off through a wall, and standing there
      // is the honest end of what has been built.
      case 'dwell':
        show.want = Math.atan2(ps - show.s, pt - show.t);
        showHold(dt);
        if (!inside) go('leave', 'walk', 0.34);
        break;

      // ── the indoor answer to the hose ──
      // Turned to face you the whole way down, because a person who has decided
      // to do this does it at somebody. `want` is set every frame rather than
      // once on entry: you can walk round her while it happens, and a figure
      // that keeps facing the doorway you have left is a figure playing a clip.
      case 'submit':
        show.want = Math.atan2(ps - show.s, pt - show.t);
        if (done) go('kept', 'kept', 0.30);
        break;

      case 'kept':
        show.want = Math.atan2(ps - show.s, pt - show.t);
        // Up again when the water has been off her a while. `hit` is the grace
        // window the jet refreshes, so holding the branch on her holds the
        // pose — which is the version anybody who finds this will want, and
        // costs one term.
        if (show.hit > 0) show.tmr = 0;
        // Back off across the room and she comes after you rather than letting
        // you watch from the door. Only while you are still in here: from a
        // kabina the way out is one metre of doorway, and a woman shuffling
        // after you on her knees out onto a public beach is a different game
        // than the one this room is.
        if (inside && Math.hypot(pt - show.t, ps - show.s) > SHOW.creepFrom) {
          go('creep', 'knees', 0.35);
        } else if (show.hit <= 0 && show.tmr > SHOW.keptFor) {
          go('rise', 'getup', 0.35);
        }
        break;

      // On her knees, coming to you. `tmr` is held down the whole way, so the
      // eleven seconds that get her up are eleven seconds of you standing still
      // and not eleven seconds of her crossing a room.
      case 'creep': {
        show.tmr = 0;
        if (!inside) { go('kept', 'kept', 0.35); break; }
        const gap = showCreep(pt, ps, dt);
        // Inside the walls, which nothing else in here has to bother with:
        // every other indoor phase is either standing on a marked spot or
        // walking a route somebody picked. This one is following you, and you
        // can stand in a corner.
        show.t = clamp(show.t, K.t0 + 0.40, K.t1 - 0.40);
        show.s = clamp(show.s, K.face + 0.40, K.s1 - 0.40);
        if (gap < SHOW.creepTo) go('kept', 'kept', 0.35);
        break;
      }

      // And back onto the indoor track, not the promenade's. `up` is the other
      // way out of a floor and it ends in a somersault, which in a room four
      // metres across is a person going through a wall.
      case 'rise':
        show.want = Math.atan2(ps - show.s, pt - show.t);
        if (done) go(inside ? 'dwell' : 'leave', inside ? 'idle' : 'walk', 0.40);
        break;

      // Out through the door before she is allowed to head for her spot, or
      // `home` walks her straight through the back of the row.
      case 'leave': {
        const legs = [[K.dc, K.face + 0.55], [K.dc, K.face - 1.9]];
        const g = legs[Math.min(show.leg, 1)];
        if (showTo(g[0], g[1], dt, 1.05) < 0.35) {
          if (show.leg >= 1) { show.leg = 0; go('home', 'walk', 0.30); }
          else show.leg++;
        }
        break;
      }

      case 'idle':
        show.want = -Math.PI / 2;                        // back to the water
        // The ćuk, on her own, every few seconds — the one noise she makes when
        // nothing is happening. It is what tells you there is something up
        // there worth walking towards before you are close enough to see it.
        if (show.tmr - show.said > 3.4 + Math.random() * 2.5) {
          show.said = show.tmr; showSay(say1(IDLE_CHAT), d);
        }
        // Three seconds of standing there first. Without it she comes home,
        // notices you again on the same frame and goes straight back down on
        // all fours, which is not delight, it is a stuck record.
        if (show.tmr > 3 && d < SHOW.near) {
          showSay('wake', d); go('notice', 'notice', 0.30);
        }
        break;

      case 'notice':
        show.want = Math.atan2(ps - show.s, pt - show.t);
        if (done) go('down', 'kneel', 0.28);
        break;

      case 'down':
        // Turn along the promenade, away from you: that is where she is going.
        show.want = pt > show.t ? Math.PI : 0;
        if (done) {
          show.wander = show.want;
          showWander(SHOW.crawlTurn, SHOW.crawlSwing);
          go('crawl', 'crawl', 0.32);
        }
        break;

      case 'crawl':
        // Wandering on all fours too, but lazily — a crawl that changes its
        // mind as often as the walking does looks like a dropped contact lens.
        show.tick -= dt;
        if (show.tick <= 0) showWander(SHOW.crawlTurn, SHOW.crawlSwing);
        show.want = showSteer(show.wander);
        showMove(SHOW.crawl, dt);
        if (show.tmr - show.said > 1.7) {
          show.said = show.tmr;
          showSay(Math.random() < 0.7 ? 'chirr' : 'tick', d);
        }
        if (show.tmr > SHOW.crawlFor) go('up', 'getup', 0.28);
        break;

      case 'up':
        if (done) {
          showSay('hup', d);
          // Off the deck and straight into the routine. The somersaults stay
          // where they have always been, at the front of it: they are what
          // getting up *is* for her, and the three new numbers queue up behind.
          show.queue = ['shimmy', 'twerk', 'heart', 'note', 'wheel'];
          go('flip', 'flip', 0.18);
          show.flips = 1;
        }
        break;

      case 'flip': {
        // She travels through the middle of the somersault and not through the
        // crouch at either end of it — the alternative is a figure sliding
        // along the concrete while she is still standing on it.
        const u = S.curT;
        showMove(SHOW.hop * sat((u - 0.34) / 0.10) * sat((1.10 - u) / 0.12), dt);
        if (u >= 0.98 && !show.said) { show.said = 1; showSay('whump', d); }
        if (done) {
          if (show.flips < SHOW.flips) {
            // Restarting the clip rather than playing it: `play` refuses a clip
            // that is already current, and this one ends on the pose it starts
            // from, so a hard rewind is seamless.
            show.flips++; S.curT = 0; show.said = 0; show.tmr = 0;
            showSay('hup', d);
          } else {
            show.played = 0;
            showNext();
          }
        }
        break;
      }

      case 'play':
        // The larking about. A random walk in heading and speed, turned back
        // by the edges of the deck rather than stopped by them, with a
        // somersault thrown in whenever the dice say so — which is as close as
        // a state machine gets to happy-go-lucky.
        show.played += dt;
        show.tick -= dt;
        if (show.tick <= 0) {
          showWander(SHOW.turn, SHOW.swing);
          // A table rather than a chain of `dice < a + b + c` tests, which is
          // what this was. Five terms was already at the edge of readable and
          // the sixth is where it tips: every line has to repeat the whole
          // prefix, so adding a number in the middle means editing every line
          // below it, and a missed term is a move that silently never comes up.
          // The odds themselves are unchanged.
          const dice = Math.random();
          let cut = 0;
          for (const [odds, enter] of [
            [SHOW.joy, () => { showSay('hup', d); go('joy', 'flip', 0.18); }],
            [SHOW.spin, enterWheels],
            [SHOW.shimmy, enterShimmy],
            [SHOW.twerk, enterTwerk],
            [SHOW.heart, enterHeart],
            [SHOW.note, enterNote],
          ]) {
            cut += odds;
            if (dice < cut) { enter(); break; }
          }
          if (dice < cut) break;
        }
        show.want = showSteer(show.wander);
        showPace(show.pace, dt);
        if (show.tmr - show.said > SHOW.say[0]
          + Math.random() * (SHOW.say[1] - SHOW.say[0])) {
          show.said = show.tmr;
          showSay(say1(CHAT), d);
        }
        if (show.played > SHOW.playFor || d > SHOW.far) go('home', 'walk', 0.32);
        break;

      case 'aim':
        // Still walking, but now down the promenade and turning her shoulders
        // across it. The turn is on `side` and takes about six tenths of a
        // second; she leaves when it has arrived, with a floor under that so
        // she cannot go over straight out of a hard turn.
        show.played += dt;
        show.want = show.wander;
        // showPace, not showMove: she is still playing the walk clip here, so
        // the clock has to come down with the speed or the run-up into a
        // cartwheel is the one bit of her wander where the feet still slide.
        showPace(show.pace * 0.8, dt);
        if (show.tmr > 0.75 && Math.abs(show.side + Math.PI / 2) < 0.06) {
          show.wheels = 1; showSay('whee', d); go('wheel', 'cartwheel', 0.20);
        }
        break;

      case 'wheel': {
        // Same shape as the somersault above: travel through the middle of the
        // turn and not through the stance at either end, and rewind rather than
        // replay to chain them, because `play` refuses a clip already current
        // and this one ends on the pose it starts from.
        const w = S.curT;
        show.played += dt;
        showMove(SHOW.wheel * sat((w - 0.14) / 0.16) * sat((1.16 - w) / 0.20), dt);
        if (done) {
          if (show.wheels < SHOW.wheels) {
            show.wheels++; S.curT = 0; show.said = 0; show.tmr = 0;
            showSay('whee', d);
          } else {
            showSay('trill', d);
            showNext();
          }
        }
        break;
      }

      case 'bask':
        // Standing in it.
        //
        // She faces you rather than the jet, and those are the same direction
        // because you are holding it. No movement at all: the pose has her
        // leaning into the water with her arms out and her weight forward, and
        // a figure drifting sideways in it would be somebody being pushed.
        show.want = Math.atan2(ps - show.s, pt - show.t);
        if (show.tmr - show.said > 1.0 + Math.random() * 1.2) {
          show.said = show.tmr; showSay(say1(WET_CHAT), d);
        }
        // Off her for half a second, and she has had enough of standing still.
        // The floor under `tmr` is what stops a jet that flickers across her
        // from strobing the pose.
        if (show.hit <= 0 && show.tmr > 0.9) {
          show.spin = Math.random() < 0.5 ? 1 : -1;
          show.tick = SHOW.arc[0] + Math.random() * (SHOW.arc[1] - SHOW.arc[0]);
          showSay('trill', d);
          go('orbit', 'walk', 0.38);
        }
        break;

      case 'orbit': {
        // Tidally locked, and the phrase is the brief's: she keeps one face
        // turned to you the way the moon keeps one to the earth.
        //
        // Two headings, and the whole state is the difference between them.
        // Where her feet go is a tangent to a circle round you, bent inward or
        // outward by however far off the ring she is — which is what makes it
        // *following* rather than circling, because when you walk away the ring
        // walks with you and the radial term turns into a chase. Where her body
        // points is straight at you, always, and that is the `side` offset at
        // the bottom of this function.
        //
        // She sweeps rather than circles. A figure going round and round you at
        // a steady rate is a planet or a shark; turning back every few seconds
        // is somebody showing off, and it also keeps her in front of you where
        // she can be seen instead of spending half of every lap behind your
        // head.
        show.played += dt;
        show.lock -= dt;
        show.tick -= dt;
        if (show.tick <= 0) {
          show.spin = -show.spin;
          show.tick = SHOW.arc[0] + Math.random() * (SHOW.arc[1] - SHOW.arc[0]);
          showSay(say1(WET_CHAT), d);
        }
        const rt = show.t - pt, rs = show.s - ps;
        const r = Math.max(0.4, Math.hypot(rt, rs));
        const bear = Math.atan2(rs, rt);          // from you to her
        show.faceAng = bear + Math.PI;            // and so, from her to you
        // Positive when she is inside the ring and wants to be further out.
        const pull = clamp((SHOW.ring - r) / 2.4, -1, 1);
        const tang = bear + show.spin * Math.PI / 2;
        show.wander = Math.atan2(
          Math.sin(tang) + Math.sin(bear) * pull * 1.3,
          Math.cos(tang) + Math.cos(bear) * pull * 1.3);
        show.want = showSteer(show.wander);
        // Slower the closer in she is, so a player who walks straight at her
        // gets sidestepped rather than run around. Rescaled with the gait: the
        // old multipliers were fractions of a skip and read as fractions of a
        // walk, which had her circling you at half a metre a second — not
        // sidestepping, dawdling. These are 1.15 to 1.90 m/s, which is the
        // same ground covered as before at the same radii.
        showPace(SHOW.walk * clamp(0.84 + r / 5.2, 0.84, 1.39), dt);
        if (show.tmr - show.said > SHOW.say[0]
          + Math.random() * (SHOW.say[1] - SHOW.say[0])) {
          show.said = show.tmr;
          showSay(say1(CHAT), d);
        }
        if (show.lock <= 0 || d > SHOW.far) {
          show.played = 0;
          show.wander = show.ang;
          showWander(SHOW.turn, SHOW.swing);
          go('play', 'walk', 0.38);
        }
        break;
      }

      case 'joy':
        // One somersault in the middle of the wander, and straight back into
        // it. `played` keeps running across this so a run of lucky rolls
        // cannot leave her out here for ever.
        show.played += dt;
        showMove(SHOW.hop * sat((S.curT - 0.34) / 0.10)
          * sat((1.10 - S.curT) / 0.12), dt);
        if (S.curT >= 0.98 && !show.said) { show.said = 1; showSay('whump', d); }
        if (done) { showWander(SHOW.turn, SHOW.swing); go('play', 'walk', 0.36); }
        break;

      case 'shimmy':
      case 'twerk':
        // Standing still, because both clips keep both feet on the deck the
        // whole way through and any travel under them turns a dance straight
        // back into a walk with something twitching.
        //
        // And turned *opposite* ways, which is the one thing the two do not
        // share. A shimmy is done at somebody and points its shoulders at you.
        // A twerk points the other end, and that is not a joke this code is
        // making, it is what the move is: the whole thing happens behind her,
        // and facing you she would be a woman doing a deep squat.
        show.played += dt;
        show.want = Math.atan2(ps - show.s, pt - show.t)
          + (show.phase === 'twerk' ? Math.PI : 0);
        if (show.tmr - show.said > SHOW.say[0] * 0.7
          + Math.random() * (SHOW.say[1] - SHOW.say[0])) {
          show.said = show.tmr;
          showSay(say1(CHAT), d);
        }
        if (show.tmr > SHOW[HOLD_FOR[show.phase]] || d > SHOW.far) showNext();
        break;

      case 'heart':
      case 'note':
        // Standing still and turned to you, for the shimmy's reason and one
        // more of their own: both of these are aimed. A heart pointed at the
        // sea is a heart for the sea, and a card you are behind is a card you
        // cannot read.
        show.played += dt;
        show.want = Math.atan2(ps - show.s, pt - show.t);
        if (show.tmr - show.said > 1.4 + Math.random() * 1.6) {
          show.said = show.tmr; showSay(say1(CHAT), d);
        }
        if (show.tmr > (show.phase === 'heart' ? SHOW.heartFor : SHOW.noteFor)
          || d > SHOW.far) showNext();
        break;

      // ── the turn ─────────────────────────────────────────────────────────
      case 'flare':
        // A second and a tenth, uninterruptible, facing you. Nothing moves her
        // through it: the clip is a gather and a fling on the spot, and a
        // figure sliding sideways through the one beat the whole sequence is
        // remembered by would undo it.
        show.want = Math.atan2(ps - show.s, pt - show.t);
        if (done) {
          // And the wrap goes with this, on the same frame as everything else.
          // This one downbeat already carries the crash, the ink climbing her
          // arms and the first stamp; putting the wrap on it too costs nothing
          // and means the turn is one event rather than a sequence of small
          // ones. Doing it as its own little beat afterwards would read as
          // undressing, which is a different thing entirely from catching fire.
          // See the line above the switch that actually does it.
          show.burn = 1;
          show.cast = 0.7;
          show.boast = SHOW.boastEvery[1];
          // And the latch. Everything else in this file is a meter that fills
          // and empties — soak, burn, wet, owed — because everything else is a
          // mood, and a mood passes. This one does not: the first flare is the
          // hinge the whole promenade turns on, and after it she is a different
          // thing wearing the same body. The wrap is gone for good and the ink
          // does not wash off. She goes back to cartwheeling and holding up
          // cards about the weather, and does all of it as a flamme fatale.
          show.turned = 1;
          // On the downbeat, and the one call in the set that is half a second
          // long and rises the whole way — it comes up under the crash while
          // she does, which is the entire moment.
          showSay('whee', d);
          go('blaze', 'firestarter', 0.20);
        }
        break;

      case 'blaze':
        // Stamping on the spot and turned to face you, for the shimmy's reason:
        // it is a thing done *at* somebody, and the clip keeps a foot on the
        // deck the whole way through, so any travel under it turns the stamp
        // back into a march.
        show.want = Math.atan2(ps - show.s, pt - show.t);
        show.burn = Math.max(0, show.burn
          - dt / (show.hit > 0 ? SHOW.douseFor : SHOW.blazeFor));
        show.cast -= dt;
        if (show.burn <= 0) {
          // Out. Straight back into the wander rather than into anything
          // sheepish, and `soak` is already spent, so doing it again means
          // filling the meter again from nothing.
          show.burn = 0;
          show.played = 0;
          show.wander = show.ang;
          showWander(SHOW.turn, SHOW.swing);
          showSay(show.hit > 0 ? 'squee' : 'trill', d);
          go('play', 'walk', 0.36);
          break;
        }
        // Not while she is being hosed. A figure throwing fire out of a jet of
        // water is the two halves of this arguing with each other, and the one
        // that should win is the branch — otherwise there is no answer to the
        // sequence except waiting it out. Same for the card, which additionally
        // is a joke, and a joke told by somebody being hosed is a sad joke.
        show.boast -= dt;
        if (show.boast <= 0 && show.hit <= 0 && banner) {
          // Checked before the fireball rather than after, and it pushes the
          // fireball back half a second on the way out — otherwise the two
          // timers drift into each other and she lowers the card straight into
          // a throw, which reads as her having been interrupted by herself.
          banner.say(FIRE_NOTES[0]);
          go('boast', 'note', 0.20);
          break;
        }
        if (show.cast <= 0 && show.hit <= 0) go('cast', 'cast', 0.14);
        if (show.tmr - show.said > 1.1 + Math.random() * 1.3) {
          // High ones only, and this used to be `burr`. A rolled note at 300 Hz
          // is a lovely sound and there is now a distorted bass sitting on E1
          // with everything up to about 400 Hz to itself — she was not quiet
          // under it, she was gone. The three below all live above 1.4 kHz,
          // where the only other thing is the hi-hat.
          show.said = show.tmr; showSay(say1(FIRE_CHAT), d);
        }
        break;

      // The card, mid-conflagration. It reuses the `note` clip whole, and that
      // is the entire reason this is a phase of its own rather than a card hung
      // off the stamping: `banner.place()` sizes and hangs the card off however
      // far apart her hands are, so it will follow her through *any* pose — and
      // through the blaze that means a sign wandering about at hip height while
      // she stamps, and through the cast it means one leaving her hand with the
      // fireball. The pose that holds a card up is the pose where she stops and
      // holds a card up. Which is also the funnier version: she breaks off
      // burning the place down for three seconds to make sure you have read it.
      case 'boast':
        show.want = Math.atan2(ps - show.s, pt - show.t);
        show.burn = Math.max(0, show.burn
          - dt / (show.hit > 0 ? SHOW.douseFor : SHOW.blazeFor));
        // The turn of the card, halfway through, and `said` is the one-shot
        // latch — the same trick the fireball's release uses, and for the same
        // reason: it has to happen on exactly one frame and the clip is looping
        // underneath it, so there is nothing else here to hang "once" on.
        if (!show.said && show.tmr > SHOW.boastFor * 0.5) {
          show.said = 1;
          banner.say(FIRE_NOTES[1]);
        }
        if (show.tmr > SHOW.boastFor || show.burn <= 0 || show.hit > 0) {
          show.boast = SHOW.boastEvery[0]
            + Math.random() * (SHOW.boastEvery[1] - SHOW.boastEvery[0]);
          show.cast = Math.max(show.cast, 0.5);
          // Back to the stamp whatever the reason, including the fire being
          // out — `blaze` owns the way out of the turn, and it owns it in one
          // place, so there is exactly one line that puts her wrap back on.
          go('blaze', 'firestarter', 0.20);
        }
        break;

      case 'cast':
        show.want = Math.atan2(ps - show.s, pt - show.t);
        show.burn = Math.max(0, show.burn
          - dt / (show.hit > 0 ? SHOW.douseFor : SHOW.blazeFor));
        // `said` is the one-shot latch here rather than a chat timer — the
        // release is a single frame of a clip and it has to fire exactly once,
        // and this is the same trick the somersault uses for its landing thump.
        if (!show.said && S.curT >= SHOW.castAt) {
          show.said = 1;
          throwBall();
          showSay('tick', d);
        }
        if (done) {
          show.cast = SHOW.castEvery[0]
            + Math.random() * (SHOW.castEvery[1] - SHOW.castEvery[0]);
          go('blaze', 'firestarter', 0.16);
        }
        break;

      case 'home': {
        const dt0 = show.home[0] - show.t, ds0 = show.home[1] - show.s;
        const dist = Math.hypot(dt0, ds0);
        show.want = Math.atan2(ds0, dt0);
        if (dist > 1.1) showPace(Math.min(SHOW.walk * 1.35, dist * 1.7), dt);
        else go('idle', 'idle', 0.50);
        break;
      }
    }

    // Turn towards `want` at a rate a person turns at, and never the long way
    // round — the shore's frame wraps and a heading that crosses the wrap would
    // otherwise spin her through a whole circle to move by a degree. The wrap
    // is inside `turnRate`, along with the easing that is the point of it.
    show.rate = turnRate(show.want - show.ang, show.rate, SHOW.turnMax, dt);
    show.ang += show.rate * dt;

    // And the offset between where she is going and where she is pointed.
    //
    // Two things use it and they want it driven differently.
    //
    // The cartwheel wants a fixed quarter turn: a wheel travels along the line
    // the body goes over and that line is ninety degrees off the way she is
    // facing, so she turns her shoulders across her course rather than turning
    // the course, holds it for the run, and gives it back afterwards.
    //
    // The orbit wants the opposite — a fixed *heading*, not a fixed offset.
    // There the thing that must stay put is her face, so what gets rate-limited
    // is `ang + side`, the mesh yaw itself. Limit the offset instead and every
    // time she reverses her sweep the heading swings 180° in about a second
    // while the offset crawls after it, and she spends that second showing you
    // her back — which is the one thing this whole phase exists never to do.
    if (show.phase === 'orbit') {
      show.sideRate = turnRate(show.faceAng - show.ang - show.side,
        show.sideRate, SHOW.orbitMax, dt);
      show.side += show.sideRate * dt;
      // Wrapped, or it winds up by a whole turn every few reversals and the
      // rate limit above starts unwinding it the long way round.
      while (show.side > Math.PI) show.side -= TAU;
      while (show.side < -Math.PI) show.side += TAU;
    } else {
      // A quarter turn for the cartwheel, because a wheel travels along the
      // line the body goes over and that line is ninety degrees off the way she
      // is facing. A fixed offset held for the length of the move and given
      // back afterwards, which is what this branch is for.
      const wantSide = show.phase === 'aim' || show.phase === 'wheel'
        ? -Math.PI / 2 : 0;
      show.sideRate = turnRate(wantSide - show.side, show.sideRate,
        SHOW.sideMax, dt);
      show.side += show.sideRate * dt;
    }

    const p = toWorld(show.t, show.s);
    f.mesh.position.set(p[0], p[1], p[2]);
    f.mesh.rotation.y = faceYaw(show.t, show.ang + show.side);
    f.mesh.updateMatrixWorld();

    // And the bottle, which is where her hand is or where she left it.
    //
    // After the matrix update, because that is what makes `boneAt` mean
    // anything this frame, and through her matrix by hand, because unlike the
    // card this is not a child of her mesh — it has to be able to stand on a
    // tabouret while she is forty metres away doing cartwheels.
    if (kit && kit.bottle) {
      if (handR === null) handR = f.boneIndex('handR');
      const r = kit.rest, w = toWorld(r[0], r[1]);
      vPos.set(w[0], r[2], w[2]);
      qAim.identity();
      if (show.held > 0 && handR >= 0) {
        f.boneAt(handR, vHand).applyMatrix4(f.mesh.matrixWorld);
        // Upright in the hand: the grip is low on the body, which is where you
        // hold a bottle you have just picked up. Not at the neck — that is a
        // waiter.
        vHold.copy(vHand);
        vHold.y -= BOT.grip;
        // And the pour, which is not a rotation. Aim it: the lip goes to a
        // fixed point six centimetres over the glass and the bottle lies back
        // along the line from her hand to it, so the tilt is whatever the angle
        // between the two happens to be that frame.
        //
        // This used to aim at her mouth, and a mouth is a hard target — it is
        // 3 cm above a bone called `head` that is really the atlas, it moves
        // when she tips her head back, and every centimetre the aim is out puts
        // 30 cm of glass through her face. The glass on the stool does not move
        // and is not part of her, so the whole class of error goes away: the
        // worst a bad frame can do now is pour two centimetres wide.
        if (show.pour > 0 && kit.pourAt) {
          const g = kit.pourAt, gw = toWorld(g[0], g[1]);
          vMouth.set(gw[0], g[2], gw[2]);
          vAx.subVectors(vMouth, vHand);
          const reach = vAx.length();
          vAx.multiplyScalar(1 / reach);
          qAim.setFromUnitVectors(UPV, vAx).slerp(qId, 1 - show.pour);
          // How far up the bottle her hand ends up. Hanging the lip on the
          // target and letting the rest fall where it may is right only while
          // the gap happens to be a bottle long; outside that the choice is
          // between a bottle through the stool and one held by nothing. So the
          // grip is what is fixed, clamped to the body of the bottle where a
          // hand pouring one actually goes, and any leftover is spent on the
          // lip stopping short — which is a stream a centimetre longer and is
          // the error nobody sees.
          const at = clamp(BOT.lip - reach, 0.02, 0.20);
          vHold.lerp(vSip.copy(vHand).addScaledVector(vAx, -at), show.pour);
        }
        vPos.lerp(vHold, show.held);
      }
      kit.bottle.position.copy(vPos);
      kit.bottle.quaternion.copy(qAim);

      // The stream. It is a cylinder standing on the wine in the glass and
      // reaching up to wherever the lip actually is, which is the honest way
      // round: gravity decides where wine goes, and if the lip is not over the
      // glass then what you see is a stream leaning out of it, which is a thing
      // to fix and not a thing to hide.
      if (kit.stream) {
        const on = show.pour > 0.6 && show.held > 0.9;
        kit.stream.visible = on;
        if (on) {
          const c = kit.cupAt, cw = toWorld(c[0], c[1]);
          vSip.set(0, BOT.lip, 0).applyQuaternion(qAim).add(vPos);
          kit.stream.position.set(vSip.x, c[2], vSip.z);
          kit.stream.scale.set(1, Math.max(0.01, vSip.y - c[2]), 1);
          if (Math.abs(vSip.x - cw[0]) > 0.09 || Math.abs(vSip.z - cw[2]) > 0.09) {
            kit.stream.visible = false;
          }
        }
      }
    }
  }

  // Looked up once, on the frame the bottle first needs it: `boneIndex` is a
  // linear search over twenty-eight names and this runs every frame she is on
  // screen. `null` and not −1, because −1 is what a miss returns.
  let handR = null;
  // Where along its own axis the bottle is held, and where its lip is. Both
  // read off the profile it is actually built to, up in `kabinaKit`.
  const BOT = { grip: 0.115, lip: 0.300 };

  /**
   * The two windows the `wine` clip drives, off one clock, because they are
   * read from the phase and again from the debug scrub and two copies of them
   * that have drifted apart is a bottle in her hand with no pour coming out of
   * it. `held` is the ramp the bottle leaves the stool on and comes back to it
   * on; `pour` is the tilt, and it is a ramp for the same reason — a bottle
   * that goes from upright to pouring between two frames is a bottle nobody
   * poured.
   */
  function wineAt(u) {
    return {
      held: sat((u - 0.85) / 0.28) * (1 - sat((u - 4.15) / 0.28)),
      pour: sat((u - 1.75) / 0.35) * (1 - sat((u - 3.10) / 0.35)),
    };
  }
  const vHand = new THREE.Vector3(), vMouth = new THREE.Vector3();
  const vHold = new THREE.Vector3(), vSip = new THREE.Vector3();
  const vPos = new THREE.Vector3(), vAx = new THREE.Vector3();
  const UPV = new THREE.Vector3(0, 1, 0);
  const qAim = new THREE.Quaternion(), qId = new THREE.Quaternion();

  const walkers = [];
  let cast = 0;
  for (const b of bathers) {
    // The first few get a mesh of their own; everybody else is an instance of
    // one of two. Ordered by the cast pass above, which already put the
    // scripted business and a spread of poses at the front.
    // A blob only if there is one spare AND the pose is one a blob can hold.
    const blobbable = b.pose !== 'sit' && b.pose !== 'lie';
    const wantSkin = cast < SKIN_CAST && crowds.skin && blobbable;
    const C = wantSkin ? crowds.skin
      : (crowds[rng() < 0.5 ? 'f' : 'm'] || crowds.m || crowds.f || crowds.skin);
    if (wantSkin) cast++;
    if (!C) break;
    const p = toWorld(b.t, b.s);
    const fg = {
      mode: b.pose,
      x: p[0], y: b.y, z: p[2], yaw: rigYaw(b.t, b.ang),
      // The (t, s) shadow of the world position, kept for the walkers: it is
      // far cheaper to advance a distance along the shore than to re-solve for
      // one from world coordinates every frame.
      t: b.t, lane: b.s, off: 0, beat: b.beat,
      dir: rng() < 0.5 ? 1 : -1,
      speed: CROWD.speed[0] + rng() * (CROWD.speed[1] - CROWD.speed[0]),
      amp: 0.40 + rng() * 0.13,
      gait: rng() * TAU,
      // Staggered, but not by much. Seeded with the full pause length, two
      // thirds of the promenade was standing still on the first frame you saw
      // it, which is the exact impression this was built to get rid of.
      wait: b.beat ? rng() * 2.2 : 0,
      seed: rng(),
      scale: b.k * (0.94 + rng() * 0.13),
      skin: pick(SKIN), suit: pick(SWIM), hair: pick(HAIR),
    };
    C.figures.push(fg);
    if (b.beat) walkers.push(fg);
  }

  function pause() {
    return CROWD.pause[0] + rng() * (CROWD.pause[1] - CROWD.pause[0]);
  }

  let crowdT = 0;

  /**
   * Walk the walkers, then pose everybody.
   *
   * The randomness here runs at frame rate rather than at build, which is a
   * deliberate exception to how the rest of this world is generated: a crowd
   * that pauses in the same places every run is a machine, and nothing about
   * where somebody stops for a moment on a promenade needs to survive a reload.
   */
  function updateCrowd(dt, cam) {
    crowdT += dt;
    // The one skinned figure here is posed on the CPU — twenty-eight bones,
    // once a frame — so she is only worth doing when there is somebody near
    // enough to tell. Past a quarter of a kilometre she is a couple of pixels
    // and the palette she was left holding is as good as any other.
    // Where you are, in the frame everybody here is laid out in.
    const [pt, ps] = local(cam.x, cam.z);

    // Unconditional, and carries its own gate inside instead. The balloon work
    // is two subtractions and a hypot and wants no gate at all; the pose is
    // twenty-four bones and wants one, and the distance both of them turn on is
    // the same number. Gating out here would mean measuring it twice.
    stepDog(cam, dt);
    stepKabina(pt, ps, dt);

    if (skinFig) {
      const dx = cam.x - skinFig.mesh.position.x, dz = cam.z - skinFig.mesh.position.z;
      // Posed on the CPU — twenty-eight bones, once a frame — so she is only
      // worth doing when there is somebody near enough to tell. Past a quarter
      // of a kilometre she is a couple of pixels and the palette she was left
      // holding is as good as any other. The performance is gated with her: at
      // that range she is always idling anyway, because it only starts at 17 m.
      if (dx * dx + dz * dz < 250 * 250) {
        skinFig.update(dt);
        // A blink is two hundred milliseconds and a lash line is one pixel
        // wide, so this is gated a good deal harder than the pose is. Inside
        // 40 m is about where a face stops being a smudge.
        if (dx * dx + dz * dz < 40 * 40) skinFig.faceTick(dt);
        stepShow(dt, pt, ps);
      }
    }
    // Outside the range gate above, because a ball that is already in the air
    // when you turn and run has to come down and light something whether or not
    // she is still close enough to be posed.
    if (balls.length) stepBalls(dt);

    for (const w of walkers) {
      if (w.wait > 0) {
        w.wait -= dt;
        w.mode = 'stand';
      } else {
        w.mode = 'walk';
        w.t += w.speed * w.dir * dt;
        if (w.t >= w.beat.t1) { w.t = w.beat.t1; w.dir = -1; w.wait = pause(); }
        else if (w.t <= w.beat.t0) { w.t = w.beat.t0; w.dir = 1; w.wait = pause(); }
        else if (rng() < dt * 0.04) w.wait = pause();
        w.gait += w.speed * dt * 2.9;
      }

      // Step around you rather than through you. This is what pays for taking
      // the walkers out of the blocker list: a figure that yields is better
      // than a box that stops you, but only if it actually yields.
      const here = w.lane + w.off;
      if (Math.abs(w.t - pt) < 1.7 && Math.abs(here - ps) < CROWD.clear) {
        w.off = clamp(w.off + (here >= ps ? 1 : -1) * dt * 1.7, -1.5, 1.5);
      } else {
        w.off -= w.off * Math.min(1, dt * 1.1);
      }

      const s = w.lane + w.off;
      const p = toWorld(w.t, s);
      w.x = p[0]; w.z = p[2];
      w.y = surfaceY(w.t, s);
      w.yaw = rigYaw(w.t, w.dir > 0 ? 0 : Math.PI);
    }

    for (const k in crowds) crowds[k].flush(crowdT, cam);
    // And the fish, which is three hands and a Date and is not worth a gate.
    if (vik) vik.tick();
  }

  const mid = at(gapAt);
  // One pose before anything is drawn, so the first frame has people in it
  // rather than a hundred figures stacked on the origin.
  updateCrowd(0, { x: mid.x, y: 0, z: mid.z });

  return {
    kind: 'jadrija',
    update: updateCrowd,
    crowd: {
      people: bathers.length,
      walkers: walkers.length,
      rigs: Object.keys(crowds),
      get drawn() {
        return Object.values(crowds).reduce((a, c) => a + c.drawn, 0);
      },
      /** Every figure, live, for a test that wants to know where they are. */
      all: () => Object.values(crowds).flatMap((c) => c.figures),
      /** The instanced layers, so the near shadow cascade can occlude with them. */
      meshes: () => Object.values(crowds).flatMap((c) => c.layers.map((L) => L.mesh)),
    },
    site: { x: mid.x + mid.nx * 16, z: mid.z + mid.nz * 16, yaw: Math.atan2(mid.ux, -mid.uz) },
    /**
     * The two ends of the swim, in world metres: the jetty head you push off
     * from and the platform you are racing to. Exported rather than measured
     * again in 61-chase.js so that moving either one moves the race with it.
     */
    swimRun: {
      start: (() => { const p = W(JET.t + JET.w + 1.6, -JET.out + 3, 0);
        return [p[0], p[2]]; })(),
      board: (() => { const p = W(DIVE.t, DIVE.s + DIVE.w + 1.2, 0);
        return [p[0], p[2]]; })(),
      deck: (() => { const p = W(DIVE.t, DIVE.s, DIVE.top);
        return [p[0], p[1], p[2]]; })(),
      jetty: (() => { const p = W(JET.t, -JET.out + 3, at(JET.t).lip);
        return [p[0], p[1], p[2]]; })(),
      /**
       * Where the boards actually stop, half a metre in from the tip.
       *
       * `jetty` above is three metres back from it, because it is the mark
       * somebody stands on rather than the end of the structure — and a dive
       * that takes off from a standing mark and carries three metres lands on
       * concrete. See the cutscene in 90-app.js.
       */
      jettyEnd: (() => { const p = W(JET.t, -JET.out + 0.5, at(JET.t).lip);
        return [p[0], p[1], p[2]]; })(),
    },
    // Kept a metre off the quay edge: the bounds are what stops a walker, and
    // stopping them exactly at the drop would let the camera hang over it.
    //
    // Inland it used to stop at `JAD.reachIn`, 38 m, which is about the
    // vikendica's stair — drawn when there was nothing behind the house but
    // bare karst, and left there after the wood went in. So the pine wood that
    // the whole of last release was about was on the far side of an invisible
    // wall you met four strides past the back of the huts. It goes to 300 m
    // now, which is the width of the headland: past `JAD.back` the concrete
    // has stopped and `walkY` falls through to the terrain, and the terrain
    // out there is a hillside 1 to 7 m above the sea the whole way across,
    // measured along four lines through the wood.
    bounds: { t0: 3, t1: LEN - 3, s0: 1.1, s1: 300,
      s0Of: (t) => (onMoleT(t) ? -JET.out - 0.9
        : onPlazaT(t) ? -PLAZA.out + 0.6 : 1.1) },
    /**
     * And the far shore, which a box cannot describe.
     *
     * Three hundred metres inland is the *other* side of the peninsula on some
     * lines through it and open ground on others, so the inland limit has to
     * be the water rather than a number. Only asked past the concrete: on the
     * bathing terrace `bounds` has already had the last word, and `walkY`
     * there is the promenade slab rather than the ground under it.
     *
     * The threshold is 0.55 m and not zero because `walkY` clamps to sea level
     * off the concrete — at exactly zero you would walk out on to the water.
     */
    standable: (x, z) => {
      const [t, s] = local(x, z);
      if (onMoleWalk(t, s)) return true;
      if (onPlaza(t, s)) return true;
      if (s < 1.0) return false;
      if (s < JAD.reachIn) return true;
      return walkY(x, z) > 0.55;
    },
    blockers, local, toWorld, walkY, inField, vik,
    /** What grows on this headland — see the note over GROVE. Read by 45-trees.js. */
    grove,
    /**
     * Where you are a person rather than a clearance. See `GROUND.tight` — this
     * is the only locale in the game with an inside to be inside of.
     */
    tightTS: (t, s) => !!(vik && vik.tight(t, s)),
    /**
     * And where there is a ceiling over you, which is a different question and
     * a narrower one — see `vik.indoorsAt`. Taken in world metres because the
     * only caller has a camera and not a station.
     */
    indoorsAt: (x, y, z) => {
      if (!vik) return 0;
      const [t, s] = local(x, z);
      return vik.indoorsAt(t, s, y);
    },
    /** What is over your head here, if anything is low enough to duck under. */
    headroom: (x, z, y) => {
      if (!vik) return null;
      const [t, s] = local(x, z);
      return vik.headroom(t, s, y);
    },
    /** And how close to its skin, either side of it — see `vik.hull`. */
    hullAt: (x, y, z) => {
      if (!vik) return 0;
      const [t, s] = local(x, z);
      return vik.hull(t, s, y);
    },
    /** Debug: put her at (t, s), and optionally straight into a phase. */
    putShow: (t, s, phase, at, ang) => {
      if (!show || !skinFig) return null;
      show.t = t; show.s = s; show.vel = 0; show.rate = 0; show.leg = 0;
      if (ang != null) { show.ang = ang; show.want = ang; }
      if (phase) {
        show.phase = phase; show.tmr = 0; show.held = 0; show.pour = 0;
        skinFig.play({ wine: 'wine', untie: 'untie', submit: 'submit',
          kept: 'kept', creep: 'knees' }[phase] || 'idle', { fade: 0 });
      }
      // And scrub, because a headless page runs its clock at a fraction of the
      // wall clock and a five-second clip is not a thing a screenshot can wait
      // out. Nothing in the game calls this with a fourth argument.
      if (at != null && skinFig.state.cur) {
        skinFig.state.curT = at;
        skinFig.update(0);
        // And the same window the phase itself computes, so a scrubbed frame
        // has the bottle in her hand rather than waiting a tick that a
        // headless clock may never give it.
        if (show.phase === 'wine') {
          const wn = wineAt(at);
          show.held = wn.held;
          show.pour = wn.pour;
        }
      }
      stepShow(0, show.t, show.s + 2);
      return { phase: show.phase, t: show.t, s: show.s, held: show.held,
        bottle: kit && kit.bottle ? kit.bottle.position.toArray()
          .map((v) => +v.toFixed(3)) : null,
        curT: skinFig.state.cur ? skinFig.state.curT : null };
    },
    /** Debug: where named bones have got to this frame, in world metres. */
    bones: (names) => {
      if (!skinFig) return null;
      const v = new THREE.Vector3(), out = {};
      skinFig.mesh.updateMatrixWorld();
      for (const n of names) {
        if (n[0] === '@') {
          v.set(n === '@x' ? 1 : 0, 0, n === '@z' ? 1 : 0)
            .transformDirection(skinFig.mesh.matrixWorld);
          out[n] = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
          continue;
        }
        const i = skinFig.boneIndex(n);
        if (i < 0) { out[n] = null; continue; }
        skinFig.boneAt(i, v);
        v.applyMatrix4(skinFig.mesh.matrixWorld);
        out[n] = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
      }
      return out;
    },
    /**
     * The one kabina that opens.
     *
     * `inside` is 0 to 1 across the thickness of the front wall and nothing
     * more. The caller latches it, so what this has to say is only *where* the
     * line is, and the line is the wall: 0 while your eye is still seaward of
     * it, 1 by the time you have cleared it, which with the hysteresis puts
     * the flip at about 0.20 m past the face — one step over the doorstep.
     *
     * It has been wrong twice, both times too deep, and the second time is
     * the instructive one. Ramping from the face over 0.55 m sounds like the
     * doorway and is not: the latch needs 0.62 of it, so the flip landed
     * 0.7 m in, by which point the door is behind your shoulders and the
     * whole screen is hut. Standing there in full afternoon light with the
     * singers still on is exactly the half-in-half-out this was supposed to
     * cure. A threshold you have already walked through is not a threshold.
     */
    kabina: special && {
      inside: (x, z) => {
        const [t, s] = local(x, z);
        if (t < special.t0 - 0.25 || t > special.t1 + 0.25) return 0;
        if (s < special.face - 0.30 || s > special.s1 + 0.25) return 0;
        return sat((s - (special.face - 0.05)) / 0.40);
      },
      // Where in the resort's own frame it is, for anything that has to walk
      // there — and for the tests, which otherwise have to find a door by eye.
      at: [(special.t0 + special.t1) * 0.5, (special.face + special.s1) * 0.5],
      door: [special.dc, special.face - 1.1],
      face: special.face, back: special.s1, floor: special.floor,
      // The doorway itself, and the two places the crossing puts you down:
      // the middle of the floor with the room in front of you, and a stride
      // out on the concrete with the row in front of you.
      dc: special.dc, dj: special.dj,
      standIn: [special.dc, special.face + 2.45],
      standOut: [special.dc, special.face - 1.40],
    },
    // Where everybody started, as {t, s, y, ang, pose, k, beat}. Kept because a
    // test needs somewhere to point the camera — but note this is the placement
    // and not the live position: anyone with a `beat` has been walking since.
    people: bathers,
    // Live, and by reference: 47-ground.js takes this array once, on retarget,
    // and reads it every frame from then on. Anything pushed into it is
    // something that is on fire on the promenade — see the fireballs above.
    objects: fires, crewSpots: [],
    /** The flames that are not `objects`: her, and whatever is still in the air. */
    flames: fieldFlames,
    apron: toWorld(gapAt, JAD.mid + 3),
    tint() { /* concrete does not scorch, and the huts are not hers to burn */ },
    flushTint() {},
    // Only what stands up casts. See the note where the buffers are made.
    meshes: [deckMesh, upMesh, vilMesh], casters: [upMesh, vilMesh], length: LEN,
    /** The town builder asks this so it does not draw these twice. */
    ownsBuilding: (bl) => taken.has(bl),
    houses: houses.length,
    /** How the OSM footprints in this box were spent. See the thinning. */
    get census() { return { ...census }; },
    testFigure: testFigure && { tris: testFigure.tris, at: testFigure.at,
      bones: skinFig ? skinFig.bones.length : 0,
      clips: skinFig ? skinFig.clips.join('+') : 'none',
      playing: skinFig ? skinFig.playing() : 'none' },
    /** The skinned figure, for the debug API and for whatever animates her. */
    figure: skinFig,
    /** What the internet last said, or nulls. Read by a test, and by nothing else. */
    btc: () => live.btc,
    live: () => ({ ...live }),
    /** The dog, and whether its balloon is up. */
    /**
     * The dog, how his skeleton is standing, and whether his balloon is up.
     *
     * `pose` is every bone origin summed, in figure space, and it is here
     * because a clip that is *selected* and a clip that is *running* look
     * identical in a screenshot — `playing` says 'idle' either way. Sample it
     * twice a second apart: if it does not move, the pose is frozen, which is
     * what a bad bake, a missed `update` and a range gate that shut too early
     * all look like from outside.
     *
     * Every bone and not one named bone, which was the first version of this
     * and was useless. It watched `Head`, and rotating a head does not move
     * the head's own origin — so it read as dead solid while the dog was quite
     * visibly breathing. Whatever moves, this moves.
     */
    dog: () => {
      if (!dog) return null;
      const f = dog.fig, v = new THREE.Vector3();
      let pose = 0;
      for (let i = 0; i < f.bones.length; i++) {
        f.boneAt(i, v);
        pose += v.x + v.y + v.z;
      }
      return { at: [+dog.at[0].toFixed(2), +dog.at[1].toFixed(2)],
        tris: dog.tris,
        bones: f.bones.length, clips: f.clips.join('+'), playing: f.playing(),
        pose: +pose.toFixed(5),
        mode: dog.mode, tgt: +dog.tgt.toFixed(2),
        timer: +dog.timer.toFixed(2), yaw: +dog.yaw.toFixed(3),
        soak: +dog.soak.toFixed(2),
        // Indoors: how far off the floor he is and how far through the sit.
        // A dog on the cot and a dog standing next to it differ by one number.
        lift: +dog.lift.toFixed(3), curl: +dog.curl.toFixed(2), leg: dog.leg,
        // And where his corners have actually got to, in world metres. The sit
        // is three rotations laid over a clip and the only way to know what
        // that leaves below the mattress is to ask: a rump 11 cm under the tick
        // is a dog cut in half by a bedsheet, and it shipped once.
        joints: (() => {
          const v = new THREE.Vector3(), o = {};
          // The matrix, by hand: this is read between frames and the renderer
          // is what normally refreshes it, so without this every joint comes
          // back in whatever space the mesh was in one frame ago — which reads
          // as a plausible set of numbers that do not move when the dog does.
          dog.mesh.updateMatrixWorld(true);
          for (const n of ['root', 'Hips', 'Body', 'Head', 'BackFoot.L',
            'FrontFoot.L', 'Torso']) {
            const i = f.boneIndex(n);
            if (i < 0) continue;
            f.boneAt(i, v).applyMatrix4(dog.mesh.matrixWorld);
            o[n] = +v.y.toFixed(3);
          }
          return o;
        })(),
        says: dog.balloon.mesh.visible ? dog.balloon.said : null };
    },
    /** Hose him, from the console, without having to fly the aeroplane. */
    wet: () => { dogWet(1); return dog && dog.mode; },
    /**
     * Send him off now rather than waiting out his stand. Only a shortcut for
     * looking at the gait: he picks the destination himself, the same way he
     * would have in his own time.
     */
    walk: () => { if (dog && dog.mode === 'stand') dog.timer = 0; return !!dog; },
    /** Where the performance has got to. */
    show: () => show && {
      phase: show.phase, clip: skinFig ? skinFig.playing() : null,
      t: +show.t.toFixed(1), s: +show.s.toFixed(1),
      ang: +show.ang.toFixed(2), flips: show.flips,
      wheels: show.wheels, side: +show.side.toFixed(2),
      pace: +show.pace.toFixed(2), played: +show.played.toFixed(1),
      // What she is actually doing, as against what she has been asked for:
      // `pace` and `want` are the ask, these two are where the easing has got
      // to. A gap between them is the point of them.
      vel: +show.vel.toFixed(2), rate: +show.rate.toFixed(2),
      // Indoors: how far into the clip she is and whether the bottle is off
      // the table. A pose that has not started and a pose that is not playing
      // look identical from outside, and only one of them is a bug.
      curT: skinFig && skinFig.state.cur ? +skinFig.state.curT.toFixed(2) : null,
      held: +show.held.toFixed(2), leg: show.leg, shed: show.shed,
      wet: +show.wet.toFixed(2), lock: +show.lock.toFixed(1),
      // Whether the water on her is drawn as water. See sheIsIn().
      indoors: sheIsIn(), streak: skinFig && skinFig.face
        ? +skinFig.face.streak.toFixed(2) : null,
      hit: +show.hit.toFixed(2), spin: show.spin,
      soak: +show.soak.toFixed(1), burn: +show.burn.toFixed(2),
      turned: show.turned,
      balls: balls.length, fires: fires.filter((f) => f.burning > 0).length,
    },
    /**
     * Fill the soak meter by hand, so the turn can be seen without standing
     * there with the branch on her for sixteen seconds — which is exactly as
     * long headless as it is in a real window, and is sixteen seconds every
     * time a number in the sequence moves.
     */
    flare: () => { if (show) show.soak = SHOW.soakFor; },
    /** Bring the next card forward, so the boast is not a thirteen-second wait. */
    boast: () => { if (show) show.boast = 0; },
    /**
     * Hold the jet on her without a jet.
     *
     * `hit` is half a second of grace that the hose refreshes every frame, and
     * headless a frame is about a second — so anything that reads it is off
     * again before the shutter. A big number is the same code path with the
     * water left on.
     */
    douse: (v = 99) => { if (show) show.hit = v; return show && show.hit; },
    /** The wrap, by hand, for looking at what is under it without a fire. */
    wear: (on) => { if (skinFig) skinFig.wear(on !== false); },
    /**
     * Queue a number, so a screenshot does not have to wait on the dice.
     *
     * The queue is the routine's own mechanism and it is emptied one name at a
     * time by `showNext`, so putting a name on the front of it is exactly what
     * the routine does — no phase is forced and nothing is entered from a state
     * that would be a teleport out of.
     */
    cue: (...names) => { if (show) show.queue.unshift(...names); return show && show.queue.slice(); },
    /**
     * Her face, held still.
     *
     * A blink is a fifth of a second and headless the page runs at about one
     * frame a second, so the only way to look at one is to stop it where it is.
     * Setting `blink` also takes `rate` to zero, which is what keeps the tick
     * from scheduling another one over the top of the screenshot.
     */
    face: (o = {}) => {
      if (!skinFig || !skinFig.face) return null;
      const u = skinFig.uFace;
      if (o.blink != null) { u.uBlink.value = o.blink; skinFig.face.rate = 0; }
      if (o.smile != null) { u.uSmile.value = o.smile; skinFig.face.smile = o.smile; }
      if (o.rate != null) skinFig.face.rate = o.rate;
      if (o.ink != null) { u.uInk.value = o.ink; skinFig.face.ink = o.ink; }
      // The mouth, held open by hand. `fill` is the driver and it is the one
      // worth setting: it is a five-second accumulator, and headless the page
      // runs at about a frame a second, so a test that wanted to see a mouthful
      // of foam would otherwise have to hold a branch on her for three hundred
      // frames. Setting it writes through to both halves at once, which is what
      // the tick does anyway.
      if (o.fill != null && show) show.fill = sat(o.fill);
      if (o.gape != null) { u.uGape.value = o.gape; skinFig.face.gape = o.gape; }
      if (o.foam != null) { u.uFoam.value = o.foam; skinFig.face.foam = o.foam; }
      if (o.wet != null) {
        u.uWet.value = sat(o.wet); skinFig.face.wet = sat(o.wet);
        if (show) show.wet = sat(o.wet);
      }
      // The crawl, so a still frame can be taken part-way down a rivulet rather
      // than always at whatever offset a frame a second happens to land on.
      if (o.run != null) u.uRun.value = o.run;
      const a = skinFig.face.anchors;
      const r3 = (v) => [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
      return {
        blink: +u.uBlink.value.toFixed(3), smile: +u.uSmile.value.toFixed(3),
        ink: +u.uInk.value.toFixed(3), gape: +u.uGape.value.toFixed(3),
        foam: +u.uFoam.value.toFixed(3),
        wet: +u.uWet.value.toFixed(3), run: +u.uRun.value.toFixed(2),
        fill: show ? +show.fill.toFixed(3) : null,
        lipC: a.lipC ? r3(u.uLipC.value) : null,
        lipW: a.lipC ? +a.lipW.toFixed(4) : null,
        want: +skinFig.face.smile.toFixed(2), rate: skinFig.face.rate,
        eye: r3(u.uEye.value), rad: +a.rad.toFixed(4),
        lip: a.corner ? r3(u.uLip.value) : null,
        lid: r3(u.uLidCol.value), lash: r3(u.uLashCol.value),
        armB: a.armB, armY: a.armY && a.armY.map((v) => +v.toFixed(3)),
        balls: a.balls, mouth: a.mouth, arm: a.arm,
      };
    },
    /** Where she is standing, so the back door can put you in front of her. */
    figureAt: testFigure ? testFigure.at : null,
    /** The two ends of the hose hook — 47-ground.js wires them together. */
    figureProbe, figureWet, dogProbe, dogWet, radioProbe, radioWet,
    tvProbe, tvWet,
    /** The set on the table: where it is, what it is doing, and knock it on. */
    radio: (knock) => {
      if (knock) { SET.cool = 0; radioWet(); }
      return { band: SET.band, lit: +SET.lit.toFixed(2), near: SET.near,
        at: kit ? kit.set : null, probe: radioProbe() };
    },
    /** The television: which channel, what it is showing, and turn the knob. */
    tv: (knock) => {
      if (knock) { tvCool = 0; tvWet(); }
      const c = TVCH[tvChan];
      return { chan: tvChan, of: TVCH.length, k: c ? c.k : 'static',
        showing: tvNow(), roll: +tvRoll.toFixed(2), seen: { ...tvSeen },
        at: kit ? kit.screen : null, probe: tvProbe() };
    },
    /**
     * Drive the promenade forward by hand.
     *
     * A headless browser throttles requestAnimationFrame to about one frame a
     * second, so a test that waits for a two-second clip to finish waits for
     * two frames of it. This is the only way to see a clip actually play from
     * outside a real window.
     */
    step: (secs, cam) => {
      for (let i = 0; i < Math.round(secs * 60); i++) updateCrowd(1 / 60, cam);
    },
    /** Debug: where the gull ended up, so a camera can be pointed at it. */
    mural: () => mural && { at: mural.at.map((v) => +v.toFixed(2)),
      p: mural.mesh.position.toArray().map((v) => +v.toFixed(2)) },
    /** Debug: the tourist board, and what its map found to draw. */
    beads: () => beads && {
      strands: beads.strands, gap: +beads.gap.toFixed(4),
      at: beads.at.map((v) => +v.toFixed(2)), swing: beads.swing(),
      tris: beads.mesh.geometry.index.count / 3,
      // Walk somebody through it without a camera. A headless page renders at
      // about a frame a second and `camera.position` is written once a frame,
      // so twenty steps of a crossing driven from a test all arrive at the same
      // place and the curtain never moves. Nothing in the game calls this.
      walk: (t, s, dt) => beads.step(t, s,
        Math.hypot(t - beads.at[0], s - beads.at[1]), dt),
    },
    board: () => board && {
      at: board.at.map((v) => +v.toFixed(2)),
      world: board.mesh.position.toArray().map((v) => +v.toFixed(1)),
      size: [2.10, +(2.10 / board.aspect).toFixed(3)],
      canvas: [board.tex.image.width, board.tex.image.height],
      houses: board.houses, lanes: board.lanes,
      // The canvas itself, so a screenshot can look at the print rather than at
      // a photograph of the print. Two metres of wall at four metres' range is
      // 300 px of a 1280 px frame, which is enough to say the map is there and
      // nothing like enough to say the legend is legible.
      el: board.tex.image,
    },
    tris: (deck.count() + up.count() + vil.count()) / 3,
  };
}
