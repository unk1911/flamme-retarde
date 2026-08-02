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
  // The built stretch of shore, as world x. Beyond these the coast carries on
  // and is left to the land cover, which is correct: the resort is a few hundred
  // metres of frontage, not the whole peninsula.
  from: -2372,
  to: -2016,
  step: 6,                 // shore samples this far apart
  probe: [140, 640],       // z window to hunt the waterline in

  // The cross-section, in metres inland from the water's edge.
  lip: 4.2,                // the lowest bathing platform, the one you sit on
  mid: 10.4,               // the middle terrace
  deck: 19.6,              // the promenade proper
  rowA: 22.4,              // seaward face of the front row of kabine
  rowB: 30.2,              // and of the back row
  back: 38.0,              // where the concrete stops
  bleed: 9.0,              // and blends back into the hillside

  drop: 0.62,              // height of one terrace riser
  quay: 1.9,               // how far the quay wall carries on below the water

  cabW: 2.15,              // one cabin's frontage
  cabD: 2.90,              // and its depth
  cabH: 2.18,              // wall height at the eaves
  cabRise: 0.62,           // ridge above the eaves
  cabEave: 0.26,           // overhang
  plinth: 0.22,            // the concrete pad the rows stand on

  reachIn: 135,          // how far inland you may walk — out through the village
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
  for (let x = JAD.from; x <= JAD.to + 0.01; x += JAD.step) {
    let hit = -1;
    for (let z = z0; z < z1; z += 3) if (isSea(x, z)) { hit = z; break; }
    if (hit < 0) continue;
    let a = hit - 3, c = hit;
    for (let i = 0; i < 16; i++) {
      const m = (a + c) * 0.5;
      if (isSea(x, m)) c = m; else a = m;
    }
    raw.push([x, c]);
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

function buildJadrija(scene) {
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
    st.lip = Math.max(0.85, hl + 0.32);
    st.mid = Math.max(st.lip + JAD.drop, hm + 0.32);
    st.deck = Math.max(st.mid + JAD.drop, Math.min(hd + 0.26, 4.6));
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
    st.lip = Math.max(st.lip, 0.85, hl + 0.30);
    st.mid = Math.max(st.mid, st.lip + JAD.drop * 0.8, hm + 0.30);
    st.deck = Math.max(st.deck, st.mid + JAD.drop * 0.8, hd + 0.24);
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

  /** A strip of surface running the whole shore, between two inland offsets. */
  function ribbon(s0, s1, yOf, col) {
    for (let i = 0; i < ST.length - 1; i++) {
      const a = ST[i], c = ST[i + 1];
      b.quad(pt(a, s0, yOf(a)), pt(c, s0, yOf(c)),
        pt(c, s1, yOf(c)), pt(a, s1, yOf(a)), col(i));
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
  const CONC = [[0.470, 0.455, 0.424], [0.442, 0.428, 0.398], [0.498, 0.480, 0.446]];
  const SALT = [0.330, 0.328, 0.312];        // the wet band at the waterline
  const STONE = [0.386, 0.370, 0.340];       // the quay wall
  const bay = (i) => CONC[i % 3];
  const bayIn = (i) => CONC[(i + 2) % 3];

  // The three levels, seaward to inland, then the quay wall down into the water.
  ribbon(0, JAD.lip, lipOf, bay);
  riser(JAD.lip, lipOf, midOf, bayIn);
  ribbon(JAD.lip, JAD.mid, midOf, bayIn);
  riser(JAD.mid, midOf, (st) => st.deck, bay);
  ribbon(JAD.mid, JAD.back, (st) => st.deck, bay);
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
    b.quad(pt(a, s0, a.deck), pt(c, s0, c.deck), pt(c, s1, yc), pt(a, s1, ya), bayIn(i));
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
    for (const s of [-0.28, 0.28]) {
      boxTS(t + s - 0.035, t + s + 0.035, 0.30, 0.38, -1.05, lip + 0.92, GALV);
      boxTS(t + s - 0.035, t + s + 0.035, 0.38, 0.90, lip + 0.84, lip + 0.92, GALV);
    }
    for (let k = 0; k < 5; k++) {
      const y = lip + 0.30 - k * 0.36;
      boxTS(t - 0.30, t + 0.30, 0.31, 0.37, y - 0.03, y + 0.03, GALV);
    }
  }

  // ── the kabine ─────────────────────────────────────────────────────────────
  // Faded to what a century of salt and August does to paint. The rows are not
  // uniform in life and must not be here: a run of identical huts is a texture,
  // and what you actually see at Jadrija is one long stripe of mismatched
  // colours under a single roofline.
  const CAB = [
    [0.855, 0.845, 0.795], [0.700, 0.760, 0.740], [0.795, 0.735, 0.585],
    [0.610, 0.685, 0.730], [0.840, 0.780, 0.720], [0.690, 0.650, 0.570],
    [0.775, 0.690, 0.630], [0.650, 0.710, 0.650], [0.880, 0.870, 0.845],
  ];
  const ROOFS = [[0.385, 0.372, 0.350], [0.430, 0.252, 0.180], [0.345, 0.338, 0.326]];
  const TRIM = [0.340, 0.300, 0.252];

  const runs = [];        // for the blockers, later

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
    for (let k = 0; k < n; k++) {
      const a = t0 + k * JAD.cabW, c = a + JAD.cabW;
      const col = CAB[Math.floor(rng() * CAB.length)];
      boxTS(a + 0.03, c - 0.03, front, back, y0 + JAD.plinth, eave, col);
      // Door: a frame proud of the face and a dark panel inside it, rather than
      // a black rectangle painted on the wall. Two boxes, and it is the
      // difference between a hut and a texture of a hut.
      const dc = (a + c) * 0.5;
      boxTS(dc - 0.50, dc + 0.50, front - 0.075, front - 0.005,
        y0 + JAD.plinth, y0 + JAD.plinth + 2.00, TRIM);
      boxTS(dc - 0.42, dc + 0.42, front - 0.045, front - 0.020,
        y0 + JAD.plinth + 0.04, y0 + JAD.plinth + 1.92,
        [col[0] * 0.62, col[1] * 0.56, col[2] * 0.50]);
      // A louvre over the door, because these things have to breathe.
      boxTS(dc - 0.26, dc + 0.26, front - 0.06, front - 0.02,
        eave - 0.30, eave - 0.13, TRIM);
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
    runs.push({ t0: t0 - 0.5, t1: t1 + 0.5, s0: front - 0.55, s1: back + 0.45,
      y: y0, h: ridge - y0 });
    b = deck;
  }

  /**
   * Lay the rows out. Runs of seven to thirteen with an alley between, and a
   * deliberate hole left in the middle of both rows where the jetty comes ashore
   * — a resort has a way through it to the water, and two unbroken 350 m walls
   * of hut would be a corridor rather than a place.
   */
  const gapAt = LEN * 0.5;
  for (const [front, phase] of [[JAD.rowA, 0], [JAD.rowB, JAD.cabW * 0.5]]) {
    let t = 8 + phase;
    while (t < LEN - 14) {
      const n = 7 + Math.floor(rng() * 7);
      const span = n * JAD.cabW;
      const clearOfGap = t + span < gapAt - 9 || t > gapAt + 9;
      if (clearOfGap) cabinRun(t, n, front, ROOFS[Math.floor(rng() * ROOFS.length)]);
      t += span + 2.6 + rng() * 2.2;
    }
  }

  // The steps belong to the ground — you walk down them — and are cut into the
  // terrace they come off, so they stay in the deck buffer where their concrete
  // matches. Everything after this stands up.
  for (let t = 40; t < LEN - 20; t += 96) seaSteps(t);
  b = up;

  // ── the jetty, the lamps, the fittings ─────────────────────────────────────
  /**
   * The jetty the taxi boat from Šibenik comes alongside. It runs out from the
   * gap in the rows, on piles, and it is the only thing here that stands over
   * open water — which makes it the thing you walk to the end of.
   */
  const JET = { t: gapAt, out: 26, w: 2.4 };
  {
    const st = at(JET.t), lip = st.lip;
    boxTS(JET.t - JET.w, JET.t + JET.w, -JET.out, 0.4,
      lip - 0.42, lip, [0.720, 0.706, 0.664], CONC[2]);
    for (let k = 0; k < 6; k++) {
      const s = -2.5 - k * 4.3;
      for (const o of [-JET.w + 0.4, JET.w - 0.4]) {
        boxTS(JET.t + o - 0.17, JET.t + o + 0.17, s - 0.17, s + 0.17,
          -2.2, lip - 0.4, [0.400, 0.360, 0.320]);
      }
    }
    // Bollards, and a stack of tyres on the last pile, which is what everybody
    // on this coast actually fenders a jetty with.
    for (const s of [-JET.out + 2, -JET.out + 10, -2]) {
      for (const o of [-JET.w + 0.5, JET.w - 0.5]) {
        boxTS(JET.t + o - 0.13, JET.t + o + 0.13, s - 0.13, s + 0.13,
          lip, lip + 0.52, [0.300, 0.290, 0.275], [0.360, 0.350, 0.330]);
      }
    }
  }

  // Lamps down the promenade. A post and a lantern; at this scale a lantern is
  // a box, and the post is what does the work of spacing the walk out.
  for (let t = 12; t < LEN - 8; t += 27) {
    const st = at(t), y = st.deck;
    boxTS(t - 0.065, t + 0.065, JAD.mid + 1.13, JAD.mid + 1.26, y, y + 3.20,
      [0.190, 0.186, 0.178]);
    boxTS(t - 0.155, t + 0.155, JAD.mid + 1.04, JAD.mid + 1.35, y + 3.20, y + 3.50,
      [0.620, 0.612, 0.586], [0.215, 0.210, 0.202]);
  }

  // Ladders, spaced so there is always one within sight of wherever you stand.
  for (let t = 22; t < LEN - 12; t += 44) ladder(t);

  // Benches along the back of the promenade, facing the water.
  for (let t = 18; t < LEN - 10; t += 33) {
    const st = at(t), y = st.deck;
    const TEAK = [0.520, 0.400, 0.280];
    boxTS(t - 0.85, t + 0.85, JAD.rowA - 2.5, JAD.rowA - 1.85, y + 0.38, y + 0.46, TEAK);
    boxTS(t - 0.85, t + 0.85, JAD.rowA - 1.95, JAD.rowA - 1.85, y + 0.46, y + 1.02, TEAK);
    for (const o of [-0.72, 0.72]) {
      boxTS(t + o - 0.06, t + o + 0.06, JAD.rowA - 2.45, JAD.rowA - 1.90,
        y, y + 0.40, [0.240, 0.235, 0.225]);
    }
  }

  // ── the life in it ─────────────────────────────────────────────────────────
  /**
   * Everything up to here is the resort with nobody in it: correct concrete,
   * correct huts, and the atmosphere of a place that has been evacuated. Which
   * is wrong twice over — it is the sixth of August, it is a bathing station,
   * and the whole point of the fire is that there are people under it.
   *
   * All of it is static geometry in the same buffer as the huts. Nothing here
   * animates and nothing here is a simulation: at the distance you actually see
   * Jadrija from — either three hundred metres up at a hundred and eighty knots,
   * or standing on the promenade — a still figure in a plausible pose reads as a
   * person, and thirty of them read as a beach. Animating them would cost the
   * frame budget of the fire and buy a wobble nobody would look at twice.
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
  function person(t, s, y, ang, pose = 'stand', scale = 1) {
    const P = facing(t, s, ang);
    const k = scale;
    const skin = pick(SKIN), suit = pick(SWIM), hair = pick(HAIR);
    // Half-widths. `hip` has to stay well under the ±0.105 the legs are set out
    // at or the two boxes meet in the middle and there is no gap to see — which
    // is exactly what the first version did, at 0.11 against 0.095.
    const shin = 0.092 * k, hip = 0.068 * k;

    if (pose === 'lie') {
      // Flat on the back, feet seaward. The whole figure is a metre and three
      // quarters of horizontal boxes, which at a metre off the ground is what
      // a person on a lounger is from any angle you will ever see one here.
      boxIn(P, -0.17 * k, 0.17 * k, -0.86 * k, 0.10 * k, y, y + 0.16 * k, skin);
      boxIn(P, -0.20 * k, 0.20 * k, 0.10 * k, 0.62 * k, y, y + 0.20 * k, suit);
      boxIn(P, -0.13 * k, 0.13 * k, 0.62 * k, 0.80 * k, y + 0.02 * k, y + 0.20 * k, skin);
      boxIn(P, -0.10 * k, 0.10 * k, 0.80 * k, 0.98 * k, y + 0.04 * k, y + 0.22 * k, hair);
      return;
    }

    // Everything upright shares a skeleton and differs only in where the knees
    // are and how far the hips have dropped.
    const sit = pose === 'sit';
    const wade = pose === 'wade';
    const drop = sit ? 0.44 * k : 0;
    const foot = wade ? -0.55 * k : 0;      // in to the knees
    const hipY = y - drop + (0.84 * k) + foot;

    // Legs apart with daylight between them. Drawn at the same width as the hips
    // and butted together, the whole figure came out as one slab from shoulder
    // to floor and read as a painted board rather than as a person — the gap is
    // what a silhouette needs, not the detail.
    if (sit) {
      // Thighs forward off the edge, shins hanging down the wall in front.
      boxIn(P, -0.17 * k, 0.17 * k, -0.02 * k, 0.40 * k, hipY - 0.13 * k, hipY, skin);
      for (const o of [-0.105 * k, 0.105 * k]) {
        boxIn(P, o - hip, o + hip, 0.30 * k, 0.30 * k + 2 * hip,
          hipY - 0.56 * k, hipY - 0.13 * k, skin);
      }
    } else {
      for (const o of [-0.105 * k, 0.105 * k]) {
        boxIn(P, o - hip, o + hip, -shin, shin, y + foot, hipY, skin);
      }
    }

    const shY = hipY + 0.58 * k;
    const half = 0.185 * k, deep = 0.105 * k;
    // The suit sits *across* the hips rather than above them, so the colour
    // break falls where a costume actually is and closes the top of both legs.
    boxIn(P, -half, half, -deep, deep, hipY - 0.19 * k, hipY + 0.09 * k, suit);
    boxIn(P, -half, half, -deep, deep, hipY + 0.09 * k, shY, skin);
    // Arms just outside the ribs. At 0.26 they put the silhouette at 63 cm
    // across, which is a doorway, not a swimmer.
    for (const o of [-half - 0.045 * k, half + 0.045 * k]) {
      boxIn(P, o - 0.042 * k, o + 0.042 * k, -0.055 * k, 0.055 * k,
        shY - 0.58 * k, shY - 0.02 * k, skin);
    }
    boxIn(P, -0.055 * k, 0.055 * k, -0.048 * k, 0.048 * k, shY, shY + 0.06 * k, skin);
    boxIn(P, -0.088 * k, 0.088 * k, -0.082 * k, 0.082 * k,
      shY + 0.06 * k, shY + 0.25 * k, skin);
    // The back and top of the head only. A fringe of hair over a box reads far
    // better than a hair-coloured box does.
    boxIn(P, -0.093 * k, 0.093 * k, -0.087 * k, 0.02 * k,
      shY + 0.14 * k, shY + 0.27 * k, hair);
  }

  /** A parasol: a pole and a shallow eight-panel cone, tilted a few degrees. */
  function parasol(t, s, y, col) {
    const P = facing(t, s, rng() * TAU);
    post(P, 0, 0, y, y + 2.06, 0.028, [0.560, 0.545, 0.520], 5);
    const R = 1.15, tip = y + 2.24, rim = y + 1.86;
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU;
      // Alternating panels, which is what every hired parasol on this coast is,
      // and the one detail that stops a field of them looking like mushrooms.
      const c = i % 2 ? col : [0.930, 0.920, 0.895];
      b.tri(P(0, 0, tip),
        P(Math.cos(a0) * R, Math.sin(a0) * R, rim),
        P(Math.cos(a1) * R, Math.sin(a1) * R, rim), c);
      b.tri(P(Math.cos(a1) * R, Math.sin(a1) * R, rim),
        P(Math.cos(a0) * R, Math.sin(a0) * R, rim),
        P(0, 0, tip), c);
    }
  }

  /** A lounger: a frame, a back raked up at one end, and four short legs. */
  function lounger(t, s, y, ang, col) {
    const P = facing(t, s, ang);
    boxIn(P, -0.32, 0.32, -0.92, 0.36, y + 0.30, y + 0.36, col);
    // The back, raised. Drawn as a stack of three thin slabs climbing away from
    // the seat, because a genuinely raked quad here needs its own frame and this
    // is a deckchair.
    for (let i = 0; i < 3; i++) {
      boxIn(P, -0.32, 0.32, 0.36 + i * 0.17, 0.53 + i * 0.17,
        y + 0.36 + i * 0.13, y + 0.44 + i * 0.13, col);
    }
    for (const dt of [-0.26, 0.26]) {
      for (const ds of [-0.80, 0.24]) {
        boxIn(P, dt - 0.03, dt + 0.03, ds - 0.03, ds + 0.03,
          y, y + 0.31, [0.720, 0.715, 0.700]);
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
  function pine(t, s, y, h) {
    const P = facing(t, s, rng() * TAU);
    const lean = (rng() - 0.5) * 0.9;
    post(P, 0, 0, y, y + h * 0.34, 0.20, [0.330, 0.270, 0.215], 5);
    post(P, lean * 0.3, 0, y + h * 0.32, y + h * 0.70, 0.15, [0.360, 0.295, 0.235], 5);
    const cx = lean, top = y + h * 0.66;
    for (let i = 0; i < 3; i++) {
      const a = rng() * TAU, d = rng() * h * 0.20;
      dome(P, cx + Math.cos(a) * d, Math.sin(a) * d,
        top + i * h * 0.09, h * 0.16, h * (0.30 - i * 0.05),
        i ? [0.180, 0.255, 0.140] : [0.145, 0.215, 0.120]);
    }
  }

  /** An olive: a short trunk that forks low, and a silver-grey crown. */
  function olive(t, s, y, h) {
    const P = facing(t, s, rng() * TAU);
    post(P, 0, 0, y, y + h * 0.36, 0.19, [0.400, 0.360, 0.300], 5);
    for (const o of [-0.16, 0.18]) {
      post(P, o, o * 0.4, y + h * 0.30, y + h * 0.58, 0.10, [0.420, 0.380, 0.315], 4);
    }
    for (const [dx, dz, r] of [[0, 0, 0.52], [-0.35, 0.25, 0.36], [0.34, -0.22, 0.34]]) {
      dome(P, dx * h * 0.5, dz * h * 0.5, y + h * 0.52, h * 0.34, h * r,
        [0.365, 0.410, 0.285]);
    }
  }

  /** Oleander: a mound of dark leaf with the flowers sitting on top of it. */
  function oleander(t, s, y, r) {
    const P = facing(t, s, rng() * TAU);
    dome(P, 0, 0, y, r * 1.25, r, [0.130, 0.235, 0.135]);
    const flower = rng() < 0.5 ? [0.880, 0.480, 0.600] : [0.945, 0.930, 0.910];
    for (let i = 0; i < 5; i++) {
      const a = rng() * TAU, d = rng() * r * 0.72;
      dome(P, Math.cos(a) * d, Math.sin(a) * d,
        y + r * (0.72 + rng() * 0.42), r * 0.16, r * 0.20, flower, 5);
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
  const bathers = [];

  // The middle terrace is the shelf people actually lay their towels on: wide
  // enough for a parasol and a pair of loungers, and one step above the water.
  for (let t = 9; t < LEN - 9; t += 7.4 + rng() * 5.0) {
    const st = at(t), y = st.mid;
    if (Math.abs(t - gapAt) < 5) continue;                  // keep the jetty clear
    if (rng() < 0.62) {
      const s = 5.4 + rng() * 3.6;
      parasol(t, s, y, pick(SWIM));
      // Loungers point at the water, which is the one thing everybody here
      // agrees about.
      const n = 1 + (rng() < 0.55 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const lt = t + (i - (n - 1) * 0.5) * 1.5;
        lounger(lt, s - 1.5, y, Math.PI, pick([[0.900, 0.890, 0.870],
          [0.240, 0.420, 0.560], [0.860, 0.560, 0.300]]));
        if (rng() < 0.5) bathers.push([lt, s - 1.9, y + 0.36, Math.PI, 'lie', 1]);
      }
    } else if (rng() < 0.5) {
      bathers.push([t, 5.0 + rng() * 4.0, y, Math.PI + (rng() - 0.5) * 1.4, 'stand', 1]);
    }
  }

  // Along the lowest platform: sitting on the edge with their feet over the
  // water, which is what that step is for and the reason it is 4.2 m wide.
  for (let t = 6; t < LEN - 6; t += 5.2 + rng() * 6.5) {
    if (Math.abs(t - gapAt) < 4) continue;
    const st = at(t), y = st.lip;
    const r = rng();
    if (r < 0.44) bathers.push([t, 1.25, y, Math.PI, 'sit', r < 0.10 ? 0.66 : 1]);
    else if (r < 0.60) bathers.push([t, 2.2 + rng() * 1.4, y, rng() * TAU, 'stand', 1]);
    else if (r < 0.70) bathers.push([t, -0.9, 0.0, Math.PI, 'wade', r < 0.655 ? 0.66 : 1]);
  }

  // The promenade: people who are not bathing at all — walking it, standing at
  // the rail, waiting for the boat.
  for (let t = 10; t < LEN - 10; t += 11 + rng() * 13) {
    const st = at(t), y = st.deck;
    bathers.push([t, JAD.mid + 1.6 + rng() * 6.0, y, rng() * TAU, 'stand', 1]);
    // Two together, half the time. People come here in pairs.
    if (rng() < 0.5) {
      bathers.push([t + 0.7, JAD.mid + 2.2 + rng() * 5.0, y, rng() * TAU, 'stand',
        rng() < 0.28 ? 0.68 : 1]);
    }
  }

  // Somebody halfway down every other ladder, which is the one place on this
  // shore where a still figure reads unambiguously as mid-movement.
  for (let t = 22; t < LEN - 12; t += 88) {
    const st = at(t);
    bathers.push([t + 0.34, -0.28, st.lip - 0.95, 0, 'stand', 1]);
  }

  for (const [t, s, y, a, pose, k] of bathers) person(t, s, y, a, pose, k);

  // Dinghies: two alongside the jetty and a few on their own moorings off the
  // shelf. None of them is going anywhere — this is a bathing station, and the
  // boats belong to whoever walked down to it.
  dinghy(JET.t - JET.w - 0.9, -JET.out + 7, 0.1, [0.880, 0.870, 0.845]);
  dinghy(JET.t + JET.w + 1.0, -JET.out + 15, -0.06, [0.230, 0.420, 0.620]);
  for (let t = 14; t < LEN - 14; t += 26 + rng() * 40) {
    if (Math.abs(t - gapAt) < 12) continue;
    dinghy(t, -5.5 - rng() * 9, rng() * TAU,
      pick([[0.880, 0.870, 0.845], [0.780, 0.250, 0.230], [0.240, 0.450, 0.640]]));
  }

  // Green. Pines and olives go behind the back row where there is soil and where
  // they will not be standing in the middle of the promenade; oleander runs
  // along the back of the walk, which is where every Dalmatian resort puts it
  // because it takes salt and nothing eats it; agave on the rough slope past the
  // concrete, which is exactly where it grows without being planted.
  const greens = [];
  for (let t = 5; t < LEN - 5; t += 6 + rng() * 9) {
    const s = JAD.rowB + 2.6 + rng() * 5.0;
    const st = at(t), y = surfaceY(t, s);
    const r = rng();
    if (r < 0.42) { pine(t, s, y, 7.5 + rng() * 4.5); greens.push([t, s, 0.55, 9]); }
    else if (r < 0.72) { olive(t, s, y, 4.2 + rng() * 1.6); greens.push([t, s, 0.60, 5]); }
    else oleander(t, s, y, 0.85 + rng() * 0.55);
  }
  for (let t = 8; t < LEN - 8; t += 4.5 + rng() * 5) {
    if (Math.abs(t - gapAt) < 6) continue;
    oleander(t, JAD.rowA - 1.15, at(t).deck, 0.62 + rng() * 0.42);
  }
  for (let t = 4; t < LEN - 4; t += 3.2 + rng() * 6) {
    const s = JAD.back + 1.5 + rng() * 7;
    agave(t, s, surfaceY(t, s), 0.55 + rng() * 0.55);
  }

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
    reach: 125,          // how far inland a house is worth rebuilding
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

  /**
   * One house. Walls follow the real polygon, because the silhouette is what you
   * read at eye height; the roof and the plinth are built on the footprint's
   * bounding box in its own principal axes, because a hip needs a rectangle and
   * the overhang covers the difference on the handful that are L-shaped.
   */
  function detailHouse(poly, hTag, r) {
    const n = poly.length;
    let cx = 0, cz = 0;
    for (const p of poly) { cx += p[0]; cz += p[1]; }
    cx /= n; cz /= n;
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

    // Openings, walked along each wall so a long face gets a rhythm and a short
    // one gets one window rather than a squeezed pair.
    const storeys = Math.max(1, Math.min(3, Math.floor((eave - base) / HOUSE.storey)));
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
      for (let k = 1; k <= slots; k++) {
        const d = k * gap;
        for (let st = 0; st < storeys; st++) {
          const sill = base + 0.95 + st * HOUSE.storey;
          if (sill + HOUSE.winH + 0.35 > eave) continue;
          const hw = HOUSE.win / 2;
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
    vil.quad(Q(A0, V0, eave), Q(A1, V0, eave), Q(R1, VM, top), Q(R0, VM, top), tile);
    vil.quad(Q(A1, V1, eave), Q(A0, V1, eave), Q(R0, VM, top), Q(R1, VM, top), tile);
    vil.tri(Q(A0, V1, eave), Q(A0, V0, eave), Q(R0, VM, top), tile);
    vil.tri(Q(A1, V0, eave), Q(A1, V1, eave), Q(R1, VM, top), tile);
    boxIn(P, A0, A1, V0, V0 + 0.10, eave - 0.20, eave, FASCIA);
    boxIn(P, A0, A1, V1 - 0.10, V1, eave - 0.20, eave, FASCIA);
    boxIn(P, A0, A0 + 0.10, V0, V1, eave - 0.20, eave, FASCIA);
    boxIn(P, A1 - 0.10, A1, V0, V1, eave - 0.20, eave, FASCIA);

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
    for (const bl of world.town) {
      const poly = bl.p;
      if (!poly || poly.length < 3 || poly.length > 12) continue;
      let cx = 0, cz = 0;
      for (const p of poly) { cx += p[0]; cz += p[1]; }
      cx /= poly.length; cz /= poly.length;
      const [t, s] = local(cx, cz);
      if (t < -55 || t > LEN + 55 || s < -6 || s > HOUSE.reach) continue;
      taken.add(bl);
      detailHouse(poly, bl.h || 6, hr);
    }
  }

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
    return [st.x + st.nx * s, surfaceY(t, s), st.z + st.nz * s];
  }

  /**
   * Ground height in world space. Off the concrete this has to fall through to
   * the terrain, or standing one step past the back wall would put you on an
   * invisible shelf at promenade height.
   */
  function walkY(x, z) {
    const [t, s] = local(x, z);
    if (t < -5 || t > LEN + 5 || s < -3 || s > JAD.back + JAD.bleed) {
      return Math.max(groundAt(x, z), 0);
    }
    return surfaceY(clamp(t, 0, LEN), s);
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
  // The trees. A trunk is the one piece of the new scenery you can walk into
  // rather than round: parasols and loungers you step over in life, and a person
  // gets out of your way, but an olive does not. Squared off to the trunk, not
  // to the crown — being stopped by foliage two metres over your head is worse
  // than walking through it.
  for (const [t, s, r, h] of greens) blockers.push({ t, s, a: r, c: r, h, y: 0 });

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

  const mid = at(LEN * 0.5);
  return {
    kind: 'jadrija',
    site: { x: mid.x + mid.nx * 16, z: mid.z + mid.nz * 16, yaw: Math.atan2(mid.ux, -mid.uz) },
    // Kept a metre off the quay edge: the bounds are what stops a walker, and
    // stopping them exactly at the drop would let the camera hang over it.
    bounds: { t0: 3, t1: LEN - 3, s0: 1.1, s1: JAD.reachIn },
    blockers, local, toWorld, walkY, inField,
    objects: [], crewSpots: [],
    apron: toWorld(gapAt, JAD.mid + 3),
    tint() { /* nothing here has caught yet */ },
    flushTint() {},
    // Only what stands up casts. See the note where the buffers are made.
    meshes: [deckMesh, upMesh, vilMesh], casters: [upMesh, vilMesh], length: LEN,
    /** The town builder asks this so it does not draw these twice. */
    ownsBuilding: (bl) => taken.has(bl),
    houses: houses.length,
    tris: (deck.count() + up.count() + vil.count()) / 3,
  };
}
