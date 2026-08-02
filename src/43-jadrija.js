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

  reachIn: 46,             // how far inland you may walk before stage 2 exists
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
  function boxTS(t0, t1, s0, s1, y0, y1, col, topCol) {
    const A = W(t0, s0, y0), B = W(t1, s0, y0), C = W(t1, s1, y0), D = W(t0, s1, y0);
    const a = [A[0], y1, A[2]], q = [B[0], y1, B[2]];
    const c = [C[0], y1, C[2]], d = [D[0], y1, D[2]];
    b.quad(a, q, c, d, topCol || col);
    b.quad(D, C, B, A, col);
    b.quad(A, B, q, a, col);
    b.quad(C, D, d, c, col);
    b.quad(B, C, c, q, col);
    b.quad(D, A, a, d, col);
  }

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

  const FACE = 'n = gl_FrontFacing ? n : -n; base *= vVCol;';
  const deckMesh = new THREE.Mesh(deck.geo(), solidMaterial(0xffffff, {
    spec: 0.07, specPower: 22, side: THREE.DoubleSide, body: FACE,
  }));
  const upMesh = new THREE.Mesh(up.geo(), solidMaterial(0xffffff, {
    spec: 0.05, specPower: 14, side: THREE.DoubleSide, emissive: 0.22, body: FACE,
  }));
  for (const m of [deckMesh, upMesh]) { m.frustumCulled = false; scene.add(m); }

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
    // Only the upright buffer casts. See the note where the buffers are made.
    meshes: [deckMesh, upMesh], casters: [upMesh], length: LEN,
    tris: (deck.count() + up.count()) / 3,
  };
}
