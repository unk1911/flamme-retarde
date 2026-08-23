// -----------------------------------------------------------------------------
// Brod — the boat to Šibenik.
//
// Misha, after an evening at Jadrija: *"Where Brod is — the pier where the boat
// comes to take people to Šibenik. Today it was too late for the boat. I am
// thinking of integrating a side-quest: to board the Jadrija–Šibenik boat and
// go on a trip to Šibenik through the beautiful sea, passing St Nicholas'
// fortress and so on."*
//
// So this is the one thing you do in this game that is not firefighting, not a
// race and not a board: you stand on a deck for nine minutes and the coast the
// rest of the game is flown over at three hundred metres goes past at eye
// height. Everything it sails through is already in the world — the same height
// field, the same cover raster, the same Gerstner sea, the same thirteen
// thousand footprints — and none of it was authored for this, which is the
// point. It is the only view of Šibenik in the game taken from the direction
// Šibenik has always been looked at from.
//
// ── the route ───────────────────────────────────────────────────────────────
//
// `CHANNEL` is not drawn by hand. It is a min-clearance Dijkstra through the
// shipped SEA mask of `build/payload/terrain_c.png`, from the head of the
// Jadrija mole to the town quay, with the step cost `1 + 260/clearance` so the
// line hunts the middle of the water instead of cutting the corners; then
// smoothed and resampled at 150 m. Thirty-one waypoints, 4 469 m, every one of
// them `isSea` at 6.35 m resolution with 8 to 35 m of water under it.
//
// What it passes, measured against the OSM geometry rather than remembered:
//
//     s    745 m   Svjetionik Rt Jadrija      184 m to port
//     s  1 043 m   Tvrđava svetog Nikole      104 m to starboard
//     s  1 400 m   into Kanal svetog Ante, and the shores close to 250 m
//     s  2 460 m   the narrows — 220 m of water, karst both sides
//     s  4 469 m   alongside at Šibenik, 86 m from the cathedral
//
// The fortress passes on the **starboard** hand, which is the hand it passes on
// coming in from the sea. Getting that right is why 48-landmarks.js had to be
// fixed before any of this could be built: it was 74 cm under the water and
// aimed 106° off.
//
// ── what this first pass is not ─────────────────────────────────────────────
//
// You do not steer. A scheduled passenger boat is not a vehicle you are given,
// it is a vehicle you are *on*, and the whole of what you do aboard is walk her
// deck and look — which is exactly what two hours of survey footage of this
// coast are of. A wheel would turn nine minutes of Dalmatia into nine minutes
// of not hitting things.
//
// And there is no timetable. Misha's "today it was too late for the boat" is
// the feeling this is built out of and it is deliberately *not* the mechanic: a
// side quest behind a clock you cannot see is a side quest nobody finds. She
// lies alongside the mole with her engine ticking over from the moment you can
// walk out to her, and she waits.
// -----------------------------------------------------------------------------

const BROD = {
  // Fifteen and a half metres, four and a bit across. The Jadrija boat is a
  // wooden Dalmatian motor passenger boat, and the best picture of one in the
  // whole survey is not a photograph of a boat: it is the mural painted on the
  // end wall of the kabine block (`1000150392`), which is what the people who
  // live with her think she looks like. White hull, dark strake along the
  // sheer with a thin gold cove line under it, low white deckhouse with a long
  // row of square lights, white pipe rails forward, open cockpit aft.
  loa: 15.6,
  beam: 4.20,

  eye: 1.62,                 // your eyes above whatever you are standing on

  // Speed. A 16 m wooden boat on a single diesel does 13 to 16 knots and this
  // one does 15.6, which puts 4 469 m of channel at nine and a half minutes.
  // That is a long time to be a passenger and it is the honest number; the
  // alternative is a boat that crosses the channel like a RIB, and the subject
  // of this whole mode is how long and how slow this coast is.
  cruise: 8.0,
  accel: 0.26,               // m/s² — she is twenty tonnes and gathers way slowly
  brake: 0.34,
  slowAt: 300,               // m from the berth that she comes off cruise
  letGo: 5.0,                // s alongside with the engine on before she moves

  // The walkable deck, in her frame: +x forward, +z to starboard. Four
  // rectangles — the cockpit, both side decks and the foredeck — because that
  // is what is walkable on a boat this shape, and one box would let you stand
  // inside the wheelhouse. The `y` is the sole each one stands at.
  decks: [
    { x0: -7.00, x1: -1.35, z0: -1.08, z1: 1.08, y: 0.72 },   // cockpit
    { x0: -1.35, x1: 4.55, z0: -1.66, z1: -1.28, y: 1.06 },   // port side deck
    { x0: -1.35, x1: 4.55, z0: 1.28, z1: 1.66, y: 1.06 },     // starboard
    { x0: 4.55, x1: 6.40, z0: -0.85, z1: 0.85, y: 1.22 },     // foredeck
  ],
  walk: 1.55,                // m/s about the deck — it is a deck, not a runway
  run: 2.6,

  // How she sits. Sampled off the real Gerstner surface at four points, so the
  // heel and the trim are the sea's business and not a clock's: a hull that
  // pitches on a canned sine in a sea that has waves in it is the one thing on
  // the water that looks wrong from the deck of it.
  probe: 0.62,               // fraction of loa/beam the four samples sit at
  soften: 0.55,              // twenty tonnes does not take every wavelet
  heelRate: 1.9,             // rad/s the attitude is allowed to chase at

  board: 7.0,                // m from the boarding mark that she may be got on

  // Landmark callouts, in metres run. `side` is the hand it passes on.
  calls: [
    { at: 40, key: 'brod.callAway', side: '' },
    { at: 700, key: 'brod.callLight', side: 'port' },
    { at: 1000, key: 'brod.callNikola', side: 'stbd' },
    { at: 1500, key: 'brod.callChannel', side: '' },
    { at: 2450, key: 'brod.callNarrows', side: '' },
    { at: 3450, key: 'brod.callSpilja', side: 'port' },
    { at: 4050, key: 'brod.callTown', side: '' },
    { at: 4380, key: 'brod.callBerth', side: '' },
  ],
};

/**
 * The channel, in world metres. See the header for how it was cut.
 *
 * The berth is *not* in here: it is worked out from the mole at load time and
 * pushed on the front, so that moving the mole moves the boat, the fittings,
 * the boarding mark and the first leg of the voyage together. That is the rule
 * `swimRun` is exported under in 43-jadrija.js and it is the same rule.
 */
const CHANNEL = [
  [-2098.9, 492.2], [-2072.2, 637.1], [-1978.2, 752.0], [-1867.3, 851.2],
  [-1726.5, 891.5], [-1577.8, 886.7], [-1448.8, 816.6], [-1341.4, 713.4],
  [-1232.8, 611.4], [-1125.4, 508.3], [-1024.4, 398.8], [-918.2, 294.8],
  [-778.5, 250.4], [-630.7, 232.1], [-485.8, 198.9], [-344.8, 152.0],
  [-198.8, 122.7], [-56.6, 80.7], [71.2, 4.4], [216.5, -21.9],
  [365.4, -20.3], [510.3, 12.4], [657.2, 14.7], [785.0, -60.0],
  [893.0, -162.4], [995.3, -270.7], [1095.2, -381.1], [1163.1, -513.2],
  [1253.9, -630.6], [1359.1, -735.9], [1457.0, -822.0],
];

/**
 * The `rotation.y` that points a model's local **+X** along the world vector
 * (dx, dz).
 *
 * Written down once and used everywhere in this file, because it is not the
 * yaw the rest of the game uses. A walker's yaw in 43-jadrija.js and
 * 47-ground.js is a compass bearing — `atan2(ux, -uz)`, zero facing north,
 * with the body's forward on local −Z. Every hull in 37-props.js is built with
 * its forward on **+X** instead, and three.js maps local +X to
 * `(cos θ, −sin θ)`, so the two differ by a quarter turn and a sign. Mixing
 * them puts a boat broadside on its own course, which is exactly what the
 * first cut of this file did.
 */
const yawOfX = (dx, dz) => Math.atan2(-dz, dx);

/**
 * The hull, the house and everything standing on her.
 *
 * Local frame is `boatProto`'s — **+X forward, +Y up, +Z to starboard** — so
 * that anything in 37-props.js can be hung off her without a second convention
 * to get wrong. y = 0 is the designed waterline: below it is antifouling, above
 * it is the boat.
 *
 * Built the way `boatNearProto` is, and for its reason rather than by copying
 * it: a hull is a section that changes along its length and no arrangement of
 * flat plates has any of it. Nine stations, seven points a side — keel through
 * garboard and chine to the sheer — with rocker, sheer and flare, shaded smooth
 * across the grid so there is no crease under the rubbing strake.
 *
 * What this one has that the six-metre runabout does not is a **near-plumb stem
 * and a counter aft**. That is the difference between a modern GRP hull and a
 * wooden boat built on this coast in the middle of the last century, and from
 * anywhere on the water it is most of the silhouette.
 */
function brodProto() {
  const b = propBuilder();
  const HULL = [0.905, 0.900, 0.878];       // white, weathered
  const SHEER = [0.118, 0.145, 0.190];      // the dark strake along the sheer
  const COVE = [0.686, 0.545, 0.243];       // and the gold line under it
  const BOOT = [0.230, 0.106, 0.086];       // antifouling
  const DECK = [0.560, 0.470, 0.352];       // laid timber, oiled
  const HOUSE = [0.912, 0.906, 0.886];
  const GLASS = [0.140, 0.196, 0.216];
  const TRIM = [0.400, 0.290, 0.170];       // varnished mahogany
  const RAIL = [0.845, 0.845, 0.840];
  const DARK = [0.180, 0.185, 0.195];

  // [x, keel y, chine y, chine half-beam, sheer y, sheer half-beam]
  //
  // The sheer is the line the whole boat is read by: high at the stem, lowest
  // about two thirds aft, lifting a hand's breadth again at the transom.
  //
  // The sheer heights were 0.45 m lower on the first cut and it was the one
  // thing about her that was measurably wrong. `JET.top` at the mole comes out
  // at **1.46 m** above the sea — the terrace lip, not the 0.72 the comment in
  // 43-jadrija.js quotes — so a boat with 1.05 m of freeboard lies with her
  // gunwale 0.4 m *below* the quay you board her from, and from the mole all
  // you can see of her is a roof. She is a passenger boat: her rail comes to
  // the pier, which is how anybody gets on.
  const ST = [
    [7.80, 0.35, 0.62, 0.10, 2.24, 0.22],
    [7.10, -0.55, -0.10, 0.34, 2.05, 0.72],
    [5.90, -1.00, -0.52, 0.74, 1.86, 1.26],
    [4.20, -1.14, -0.72, 1.14, 1.68, 1.75],
    [2.00, -1.15, -0.80, 1.44, 1.55, 2.02],
    [-0.60, -1.13, -0.80, 1.52, 1.48, 2.10],
    [-3.20, -1.06, -0.76, 1.50, 1.48, 2.08],
    [-5.90, -0.90, -0.64, 1.42, 1.54, 1.99],
    [-7.80, -0.62, -0.46, 1.28, 1.62, 1.82],
  ];

  const NS = 7;
  const N = NS * 2 - 1;
  const tAt = (j) => Math.abs(j - (NS - 1)) / (NS - 1);
  const sAt = (j) => (j < NS - 1 ? -1 : 1);
  const pt = (st, s, t) => {
    const [x, ky, cy, cw, sy, sw] = st;
    if (t <= 0.60) {
      const u = t / 0.60;
      return [x, ky + (cy - ky) * Math.pow(u, 0.70), s * cw * Math.pow(u, 1.20)];
    }
    const u = (t - 0.60) / 0.40;
    return [x, cy + (sy - cy) * Math.pow(u, 0.94),
      s * (cw + (sw - cw) * Math.pow(u, 0.58))];
  };
  const G = ST.map((st) => {
    const row = [];
    for (let j = 0; j < N; j++) row.push(pt(st, sAt(j), tAt(j)));
    return row;
  });
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const GN = G.map((row, i) => row.map((_, j) => {
    const u = sub(G[Math.min(G.length - 1, i + 1)][j], G[Math.max(0, i - 1)][j]);
    const v = sub(row[Math.min(N - 1, j + 1)], row[Math.max(0, j - 1)]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0]];
    const L = Math.hypot(n[0], n[1], n[2]) || 1;
    // x runs bow to stern down the array, so the cross comes out pointing in.
    return [-n[0] / L, -n[1] / L, -n[2] / L];
  }));
  // Three bands rather than two: antifouling under the chine, white topsides,
  // and the last strake before the gunwale in the dark colour.
  for (let i = 0; i < G.length - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const A = G[i][j], B = G[i][j + 1], C = G[i + 1][j + 1], D = G[i + 1][j];
      const na = GN[i][j], nb = GN[i][j + 1], nc = GN[i + 1][j + 1], nd = GN[i + 1][j];
      const t0 = tAt(j), t1 = tAt(j + 1);
      const col = Math.max(t0, t1) < 0.62 ? BOOT
        : (Math.min(t0, t1) > 0.90 ? SHEER : HULL);
      b.smooth(A, B, C, na, nb, nc, col, col, col);
      b.smooth(A, C, D, na, nc, nd, col, col, col);
    }
  }
  // The transom, fanned to a point a little below the sole so she has a counter
  // and a shadow under it rather than a wall.
  {
    const row = G[G.length - 1];
    const c = [row[0][0], -0.10, 0];
    for (let j = 0; j < N - 1; j++) {
      const col = tAt(j) < 0.62 ? BOOT : (tAt(j) > 0.90 ? SHEER : HULL);
      b.tri(row[j + 1], row[j], c, col);
    }
  }

  /**
   * A quad on one side of her, wound so that its face points the right way.
   *
   * Everything from the bulwark outwards is written once with a `s = ±1`
   * multiplier on the z, which is how the port and starboard copies of a thing
   * get built from one line — and **mirroring a polygon reverses its winding**.
   * `propBuilder.tri` takes the normal off the winding and three.js culls back
   * faces, so half of every mirrored pair was inside out. The symptom was
   * specific and took a screenshot to see: standing on her deck you could look
   * down at the *port* bulwark and see the dark outer strake from the inboard
   * side, with sea through the gap where the white inner face should have been,
   * and the whole cockpit read as a hole in the boat.
   *
   * Every quad in this file that carries an `s` goes through here.
   */
  const sideQuad = (s, A, B, C, D, col) =>
    (s > 0 ? b.quad(D, C, B, A, col) : b.quad(A, B, C, D, col));

  /** The sheer height and half-beam at any x, by interpolating the stations. */
  const sheerAt = (x) => {
    let a = ST[0], c = ST[1];
    for (let i = 0; i < ST.length - 1; i++) {
      if (x <= ST[i][0] && x >= ST[i + 1][0]) { a = ST[i]; c = ST[i + 1]; break; }
    }
    const u = clamp((a[0] - x) / ((a[0] - c[0]) || 1), 0, 1);
    return [a[4] + (c[4] - a[4]) * u, a[5] + (c[5] - a[5]) * u];
  };

  // ── the deck and the bulwark ─────────────────────────────────────────────
  // The sheer curves and the sole does not; that is the whole difference
  // between a gunwale you look over and a floor you stand on. The sole steps up
  // twice going forward — cockpit, side deck, foredeck — which is what the
  // engine under the house and the chain locker under the foredeck do to it.
  const soleAt = (x) => (x > 4.55 ? 1.22 : (x > -1.35 ? 1.06 : 0.72));
  {
    const NX = 26;
    for (let i = 0; i < NX; i++) {
      const x0 = 7.6 - 15.8 * (i / NX);
      const x1 = 7.6 - 15.8 * ((i + 1) / NX);
      const [y0, w0] = sheerAt(x0), [y1, w1] = sheerAt(x1);
      const i0 = Math.max(0.02, w0 - 0.24), i1 = Math.max(0.02, w1 - 0.24);
      const sy = soleAt((x0 + x1) * 0.5);
      for (const s of [1, -1]) {
        // cap
        sideQuad(s, [x0, y0, s * w0], [x1, y1, s * w1],
          [x1, y1, s * i1], [x0, y0, s * i0], TRIM);
        // outer face, in the dark strake colour
        sideQuad(s, [x0, y0 - 0.40, s * w0], [x1, y1 - 0.40, s * w1],
          [x1, y1, s * w1], [x0, y0, s * w0], SHEER);
        // Inner face, painted out white like the rest of the inside — and
        // carried all the way down to the sole rather than a fixed 0.40, which
        // is what left a gap you could see the sea through once the sheer went
        // up and the sole did not follow it the same distance.
        sideQuad(s, [x1, y1, s * i1], [x1, sy, s * i1],
          [x0, sy, s * i0], [x0, y0, s * i0], HOUSE);
      }
      b.quad([x0, sy, -i0], [x1, sy, -i1], [x1, sy, i1], [x0, sy, i0], DECK);
    }
    // The gold cove line: one 70 mm strip a side, standing 12 mm off the
    // topside so it never z-fights the hull it is painted on.
    for (let i = 0; i < NX; i++) {
      const x0 = 7.3 - 15.2 * (i / NX);
      const x1 = 7.3 - 15.2 * ((i + 1) / NX);
      const [y0, w0] = sheerAt(x0), [y1, w1] = sheerAt(x1);
      for (const s of [1, -1]) {
        sideQuad(s, [x0, y0 - 0.50, s * (w0 + 0.012)], [x1, y1 - 0.50, s * (w1 + 0.012)],
          [x1, y1 - 0.43, s * (w1 + 0.012)], [x0, y0 - 0.43, s * (w0 + 0.012)], COVE);
      }
    }
  }

  // ── the deckhouse ────────────────────────────────────────────────────────
  // Aft face at x -1.35, forward at 4.55, 2.40 wide and 1.94 high off the side
  // deck, with the wheelhouse standing proud of it at the front. Seven lights a
  // side, which is what the mural has, and the mural is the only thing in the
  // survey that shows the whole boat at once.
  b.box(1.60, 1.06 + 0.97, 0, 5.90, 1.94, 2.40, HOUSE, HOUSE);
  b.box(4.00, 1.06 + 1.20, 0, 1.10, 1.48, 2.10, HOUSE, HOUSE);
  {
    const y = 1.06 + 1.22;
    for (let i = 0; i < 7; i++) {
      const x = -0.80 + i * 0.83;
      for (const s of [1, -1]) b.box(x, y, s * 1.215, 0.54, 0.60, 0.03, GLASS);
    }
    for (let i = -1; i <= 1; i++) {
      b.box(4.56, 1.06 + 1.36, i * 0.66, 0.03, 0.64, 0.58, GLASS);
    }
    // The door into the house, on the port side aft, standing open.
    b.box(-1.37, 1.06 + 0.86, -0.62, 0.04, 1.72, 0.74, DARK);
  }
  // The roof: a flat deck with a coaming, and the boat's one piece of shade.
  // Everybody on every boat in the survey sits under this.
  b.box(1.60, 1.06 + 1.99, 0, 6.20, 0.10, 2.66, HOUSE, HOUSE);
  b.box(4.00, 1.06 + 1.99, 0, 1.20, 0.10, 2.30, HOUSE, HOUSE);

  // ── the rails ────────────────────────────────────────────────────────────
  // Pipe stanchions and two wires round the foredeck only. Aft the bulwark is
  // the rail, which is why you can sit on it.
  {
    const NST = 6;
    for (let i = 0; i <= NST; i++) {
      const x = 4.7 + (7.3 - 4.7) * (i / NST);
      const [y, w] = sheerAt(x);
      for (const s of [1, -1]) b.box(x, y + 0.40, s * (w - 0.12), 0.05, 0.80, 0.05, RAIL);
    }
    for (const s of [1, -1]) {
      for (const h of [0.36, 0.72]) {
        const [ya, wa] = sheerAt(4.7), [yb, wb] = sheerAt(7.3);
        // Both windings, not one: a wire is 35 mm of nothing and you are as
        // often inboard of it as outboard, so it is the one thing on her that
        // has to be visible from both sides.
        b.quad([4.7, ya + h, s * (wa - 0.12)], [7.3, yb + h, s * (wb - 0.12)],
          [7.3, yb + h + 0.035, s * (wb - 0.12)], [4.7, ya + h + 0.035, s * (wa - 0.12)],
          RAIL);
        b.quad([4.7, ya + h + 0.035, s * (wa - 0.12)], [7.3, yb + h + 0.035, s * (wb - 0.12)],
          [7.3, yb + h, s * (wb - 0.12)], [4.7, ya + h, s * (wa - 0.12)], RAIL);
      }
    }
  }

  // ── the fittings ─────────────────────────────────────────────────────────
  // A mast forward of the house with the ensign at its head, a stub exhaust out
  // of the port quarter of the roof, and benches down both sides of the
  // cockpit. The ensign is a flat panel and not cloth, because the only thing
  // that reads from the far side of a fifteen-metre deck is red-white-blue.
  b.box(4.66, 1.06 + 2.90, 0, 0.14, 3.90, 0.14, TRIM);
  b.box(2.60, 1.06 + 2.36, -0.96, 0.16, 0.66, 0.16, DARK);
  for (const s of [1, -1]) {
    b.box(-4.20, 0.72 + 0.42, s * 1.42, 5.30, 0.08, 0.52, TRIM);
    b.box(-4.20, 0.72 + 0.20, s * 1.66, 5.30, 0.42, 0.06, TRIM);
  }
  for (let i = 0; i < 3; i++) {
    const col = [[0.78, 0.16, 0.16], [0.94, 0.94, 0.94], [0.10, 0.20, 0.52]][i];
    b.box(5.12, 1.06 + 4.40 - i * 0.18, 0, 0.80, 0.18, 0.02, col);
  }
  return b.geo();
}

/**
 * The pier furniture at the head of the mole.
 *
 * All of it is off two photographs of 23 August 2026 — `1000150377` (portrait,
 * straight out across the water at St Nicholas') and `1000150378` (the same
 * quay, wide) — and it is worth being exact about what they can and cannot
 * settle, because neither carries GPS and there is no landmark in either frame
 * that this game already knows to within a hundred metres.
 *
 * They settle the **fittings**, and there are five, in this order along the
 * coping: a squared **timber rubbing baulk** bedded along the very edge,
 * weathered silver, with the bolt heads showing; a fat **cast-iron mushroom
 * bollard**, rusted through its paint, half a metre across and knee high; a
 * **stainless bitt** on a bolted base plate with a bar through its head and
 * three turns of white rope round it; a length of that rope flaked on the
 * concrete beside it; and a grey **cylindrical rubber fender** hung over the
 * edge on a lanyard so that only its top shows.
 *
 * They do not settle **where**. So the berth is a *placement*, and the argument
 * for it is that the mole is the only structure at Jadrija standing over open
 * water — 42 m out, 11 m across, 0.72 m of freeboard, stone armour at the head
 * — and no aerial of this shore shows another. If the boat comes somewhere
 * else, one constant moves it.
 *
 * This also overturns something the model says out loud. 43-jadrija.js at the
 * mole reads *"no boat comes: there is no bollard, no fender and no moored hull
 * anywhere in thirty-nine photographs"*, which was true of the survey it was
 * written against and is not true of this one. The bollards are photographed.
 *
 * Built in the mole's own frame — **+x out along it from the root, +z athwart
 * it** — and dropped on the world with one transform, which is the only way to
 * keep a fitting square to a quay that is not square to anything. `M.side` is
 * ±1 for which hand the berth is on, applied to the coordinates rather than as
 * a negative `scale.z`: mirroring a mesh reverses its winding, and a
 * back-face-culled bollard is a bollard-shaped hole.
 */
function moleFittings(M) {
  const b = propBuilder();
  const PATCH = [0.700, 0.686, 0.646];
  const TIMBER = [0.560, 0.540, 0.498];
  const RUST = [0.396, 0.208, 0.130];
  const STEEL = [0.760, 0.766, 0.772];
  const ROPE = [0.870, 0.850, 0.800];
  const RUBBER = [0.330, 0.336, 0.342];
  const TOP = M.top, W = M.w, SD = M.side || 1;
  const V = (d) => d * SD;

  // The rubbing baulk: 0.24 x 0.20 squared timber lying on the coping with its
  // outer face flush, so it stands 0.14 m proud of the deck. In lengths,
  // because a nineteen-metre baulk is not a thing and the joints show.
  for (let u = M.out - 19; u < M.out - 1.4; u += 2.4) {
    const l = Math.min(2.35, (M.out - 1.4) - u);
    b.box(u + l / 2, TOP + 0.07, V(W - 0.10), l, 0.20, 0.24, TIMBER, TIMBER);
    b.box(u + l / 2, TOP + 0.18, V(W - 0.10), 0.05, 0.03, 0.05, RUST, RUST);
  }
  // The cast-iron mushroom, 6.4 m in from the head: a stub, a swelling and a
  // cap. Three boxes is enough at the size it is — the whole thing is 0.52 m
  // across and you are never further from it than the boat is.
  {
    const u = M.out - 6.4, v = V(W - 0.62);
    b.box(u, TOP + 0.10, v, 0.30, 0.20, 0.30, RUST, RUST);
    b.box(u, TOP + 0.26, v, 0.44, 0.14, 0.44, RUST, RUST);
    b.box(u, TOP + 0.37, v, 0.52, 0.10, 0.52, RUST, RUST);
  }
  // The stainless bitt, 12.8 m in, on its plate, with the bar through the head,
  // three turns of rope on it and the tail flaked out on the slab.
  {
    const u = M.out - 12.8, v = V(W - 0.66);
    b.box(u, TOP + 0.004, v, 0.92, 0.01, 0.92, PATCH, PATCH);
    b.box(u, TOP + 0.02, v, 0.46, 0.03, 0.46, STEEL, STEEL);
    b.box(u, TOP + 0.23, v, 0.26, 0.42, 0.26, STEEL, STEEL);
    b.box(u, TOP + 0.41, v, 0.52, 0.06, 0.06, STEEL, STEEL);
    for (let i = 0; i < 3; i++) b.box(u, TOP + 0.14 + i * 0.05, v, 0.32, 0.04, 0.32, ROPE, ROPE);
    for (let i = 0; i < 5; i++) {
      const a = 0.9 + i * 0.75;
      b.box(u - 0.4 - i * 0.22, TOP + 0.025, v - V(0.30 + Math.sin(a) * 0.22),
        0.55, 0.04, 0.05, ROPE, ROPE);
    }
  }
  // The fender: a 0.9 m grey cylinder over the edge on a lanyard, top just
  // showing above the timber.
  {
    const u = M.out - 9.6, v = V(W + 0.08);
    b.box(u, TOP - 0.34, v, 0.30, 0.90, 0.30, RUBBER, RUBBER);
    b.box(u, TOP + 0.06, v, 0.04, 0.34, 0.04, ROPE, ROPE);
  }
  return b.geo();
}

/**
 * The boat, the berth and the voyage.
 *
 * The same five verbs as the kite, the foil and the swim — `enter`, `leave`,
 * `look`, `update`, `pose` — plus `draw`, and a sixth that none of the other
 * water modes needs: `idle`. She is **scenery when you are not on her**. A boat
 * that only exists once you are aboard is a boat nobody ever decides to board.
 */
function buildBrod(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const mat = solidMaterial(0xffffff, { spec: 0.10, specPower: 30,
    body: 'base *= vVCol;' });

  const hull = new THREE.Mesh(brodProto(), mat);
  const boat = new THREE.Group();
  boat.add(hull);
  group.add(boat);

  let fitting = null;            // the pier furniture, once we know where it goes
  let route = null;              // [[x, z], ...], berth first
  let arc = null;                // cumulative metres along it
  let total = 0;
  let berth = null;              // { x, z, yaw } alongside the mole
  let dock = null;               // { x, y, z } — the mark you stand on to board
  let quay = null;               // { x, z, yaw } alongside at Šibenik

  let active = false;
  let phase = 'moored';          // moored | letgo | run | slow | alongside
  let s = 0, sp = 0, tmr = 0;
  let said = -1;                 // index of the last callout fired

  const you = { x: -4.4, z: 0, yaw: 0, pitch: -0.02, deck: 0.38 };
  const att = { y: 0, roll: 0, pitch: 0, yaw: 0 };

  const tmpV = new THREE.Vector3();
  const tmpW = new THREE.Vector3();
  const qBoat = new THREE.Quaternion();
  const qHead = new THREE.Quaternion();
  const eHead = new THREE.Euler(0, 0, 0, 'YXZ');

  /**
   * Lay the berth and the route out, once the locale exists.
   *
   * `jadrija.mole` is the only thing this module takes from that file, and
   * everything here is derived from it rather than written down: the berth, the
   * boarding mark, the fittings and the first waypoint all move together.
   */
  function moor(jadrija) {
    if (!jadrija || !jadrija.mole) return false;
    const M = jadrija.mole;
    const hx = M.head[0], hz = M.head[2];
    const rx = M.root[0], rz = M.root[2];
    let ox = hx - rx, oz = hz - rz;                 // seaward, along the mole
    const L = Math.hypot(ox, oz) || 1;
    ox /= L; oz /= L;
    // Athwart it. She lies on the side that faces east — up the channel, out of
    // the swell that comes round the point, and in sight of the whole eastern
    // half of the resort. Taken as a sign rather than written down, so a
    // re-traced shore that flips the normal does not put her on the beach.
    const sgn = -oz > 0 ? 1 : -1;
    const px = -oz * sgn, pz = ox * sgn;
    const bx = hx - ox * 8.0 + px * (M.w + 2.35);
    const bz = hz - oz * 8.0 + pz * (M.w + 2.35);
    berth = { x: bx, z: bz, yaw: yawOfX(ox, oz) };
    dock = { x: hx - ox * 8.0 + px * (M.w - 1.4),
      z: hz - oz * 8.0 + pz * (M.w - 1.4), y: M.top };

    route = [[bx, bz], ...CHANNEL.map((p) => [p[0], p[1]])];
    arc = [0];
    for (let i = 1; i < route.length; i++) {
      arc.push(arc[i - 1] + Math.hypot(route[i][0] - route[i - 1][0],
        route[i][1] - route[i - 1][1]));
    }
    total = arc[arc.length - 1];
    const last = route[route.length - 1], prev = route[route.length - 2];
    quay = { x: last[0], z: last[1],
      yaw: yawOfX(last[0] - prev[0], last[1] - prev[1]) };

    if (!fitting) {
      fitting = new THREE.Mesh(
        moleFittings({ top: M.top, w: M.w, out: M.out, side: sgn }), mat);
      fitting.position.set(rx, 0, rz);
      fitting.rotation.y = yawOfX(ox, oz);
      fitting.updateMatrixWorld();
      scene.add(fitting);
    }
    reset();
    return true;
  }

  /** Put her back alongside at Jadrija with her engine ticking over. */
  function reset() {
    phase = 'moored'; s = 0; sp = 0; tmr = 0; said = -1;
    you.x = -4.4; you.z = 0; you.yaw = 0; you.pitch = -0.02; you.deck = 0.72;
    if (berth) place(berth.x, berth.z, berth.yaw);
  }

  /** Where the route is at `d` metres run: position and heading. */
  function atS(d) {
    const q = clamp(d, 0, total);
    let i = 1;
    while (i < arc.length - 1 && arc[i] < q) i++;
    const u = (q - arc[i - 1]) / ((arc[i] - arc[i - 1]) || 1);
    const a = route[i - 1], c = route[i];
    return { x: a[0] + (c[0] - a[0]) * u, z: a[1] + (c[1] - a[1]) * u,
      yaw: yawOfX(c[0] - a[0], c[1] - a[1]) };
  }

  /**
   * Sit her on the sea.
   *
   * Four samples of the real Gerstner surface — bow, stern, port, starboard —
   * because heel and trim are the sea's business. Twenty tonnes does not take
   * every wavelet, so the differences are scaled by `soften` before the angles
   * come out of them, and the result is *chased* rather than assigned: a hull
   * snapped to the surface every frame jitters at the wave scales this sea has
   * under five metres.
   */
  function place(x, z, yaw, dt) {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const fwd = [c, -sn];                          // her local +X, in the world
    const stb = [sn, c];                           // her local +Z
    const a = BROD.loa * 0.5 * BROD.probe, w = BROD.beam * 0.5 * BROD.probe;
    const hb = seaHeightAt(x + fwd[0] * a, z + fwd[1] * a);
    const hs = seaHeightAt(x - fwd[0] * a, z - fwd[1] * a);
    const hq = seaHeightAt(x + stb[0] * w, z + stb[1] * w);
    const hp = seaHeightAt(x - stb[0] * w, z - stb[1] * w);
    const y = (hb + hs + hp + hq) * 0.25;
    const trim = Math.atan2((hb - hs) * BROD.soften, 2 * a);
    const heel = Math.atan2((hq - hp) * BROD.soften, 2 * w);
    if (dt) {
      const r = 1 - Math.exp(-BROD.heelRate * dt);
      att.y += (y - att.y) * r;
      att.pitch += (trim - att.pitch) * r;
      att.roll += (heel - att.roll) * r;
    } else { att.y = y; att.pitch = trim; att.roll = heel; }
    att.yaw = yaw;
    boat.position.set(x, att.y, z);
    boat.rotation.set(0, 0, 0);
    boat.rotateY(yaw);
    // Bow up is a positive turn about her own starboard axis (+Z); starboard up
    // is a negative turn about her own forward axis (+X). Both applied in her
    // frame, after the yaw, which is what `rotateZ`/`rotateX` do.
    boat.rotateZ(att.pitch);
    boat.rotateX(-att.roll);
    boat.updateMatrixWorld();
  }

  /** Is (lx, lz) somewhere you may stand? The deck height there, or null. */
  function deckAt(lx, lz) {
    for (const d of BROD.decks) {
      if (lx > d.x0 && lx < d.x1 && lz > d.z0 && lz < d.z1) return d.y;
    }
    return null;
  }

  // ── the verbs ─────────────────────────────────────────────────────────────

  /** True when you are near enough on the mole to step aboard. */
  function canBoard(x, z) {
    if (!dock || active || phase !== 'moored') return false;
    return Math.hypot(x - dock.x, z - dock.z) < BROD.board;
  }

  /**
   * Step aboard.
   *
   * You land on the **starboard side deck**, standing, looking forward, and
   * both halves of that are decided rather than convenient. Starboard because
   * that is the side the mole is on — she lies with her starboard rail to the
   * quay, so it is the rail you step over — and because it is the hand
   * everything worth seeing passes on: the fortress at 104 m, the town at the
   * end of it. Forward because the first cut put you in the middle of the
   * cockpit facing the bow, three metres from the aft wall of the deckhouse,
   * and nine minutes of Dalmatia opened on a shot of a white wall.
   */
  function enter() {
    if (!route || active) return false;
    active = true;
    group.visible = true;
    phase = 'letgo';
    s = 0; sp = 0; tmr = 0; said = -1;
    you.x = 1.20; you.z = 1.47; you.yaw = 0; you.pitch = -0.02;
    you.deck = deckAt(you.x, you.z) ?? 1.06;
    return true;
  }

  function leave() { active = false; }

  function look(dx, dy) {
    you.yaw += dx;
    you.pitch = clamp(you.pitch - dy, -1.30, 1.20);
    if (you.yaw > Math.PI) you.yaw -= Math.PI * 2;
    if (you.yaw < -Math.PI) you.yaw += Math.PI * 2;
  }

  /**
   * One frame of the voyage.
   *
   * Returns null, `'call'` when a landmark has just come up, or `'alongside'`
   * the one time she finishes. The phases are a straight line and there is no
   * way back up them: she is a scheduled boat, not a vehicle.
   */
  function update(dt, ctl = {}) {
    if (!active || !route) return null;
    tmr += dt;
    let out = null;

    if (phase === 'letgo') {
      if (tmr > BROD.letGo) { phase = 'run'; tmr = 0; }
    } else if (phase === 'run') {
      sp = Math.min(BROD.cruise, sp + BROD.accel * dt);
      s += sp * dt;
      if (total - s < BROD.slowAt) phase = 'slow';
    } else if (phase === 'slow') {
      // Stop *on* the berth rather than near it. The fastest she may still be
      // going is the speed that brings her to rest exactly at `total` under
      // `brake` — v = sqrt(2 a d) — and she is never allowed above it. The
      // floor under it is what stops the last two metres taking a minute.
      const d = Math.max(0, total - s);
      sp = Math.min(sp, Math.sqrt(2 * BROD.brake * d));
      sp = Math.max(sp, 0.45 * sat(d / 30));
      s += sp * dt;
      if (d < 0.5) { phase = 'alongside'; sp = 0; s = total; out = 'alongside'; }
    }

    const P = atS(s);
    place(P.x, P.z,
      (phase === 'moored' || phase === 'letgo') ? berth.yaw : P.yaw, dt);

    // Walking her deck. Everything is in her frame, so the deck moves under you
    // and you are never integrated in world metres at all — which is the whole
    // reason a passenger is cheap where a driver is not.
    const step = (ctl.sprint ? BROD.run : BROD.walk) * dt;
    const f = clamp(ctl.fwd || 0, -1, 1), r = clamp(ctl.side || 0, -1, 1);
    if (f || r) {
      const c = Math.cos(you.yaw), sn = Math.sin(you.yaw);
      const nx = you.x + (c * f - sn * r) * step;
      const nz = you.z + (sn * f + c * r) * step;
      const dy = deckAt(nx, nz);
      if (dy != null) { you.x = nx; you.z = nz; you.deck = dy; }
      else {
        // Slide along whichever axis still lands on a deck, so a bulwark or the
        // side of the house is something you brush past rather than stop dead
        // against — the same rule the walk model uses ashore.
        const ax = deckAt(nx, you.z);
        if (ax != null) { you.x = nx; you.deck = ax; }
        const az = deckAt(you.x, nz);
        if (az != null) { you.z = nz; you.deck = az; }
      }
    }

    for (let i = 0; i < BROD.calls.length; i++) {
      if (i > said && s >= BROD.calls[i].at) { said = i; out = out || 'call'; }
    }
    return out;
  }

  /**
   * Put the camera where your head is.
   *
   * The head is composed **on top of her attitude** rather than beside it —
   * `qBoat * qHead` — so her heel rolls the horizon under you and her trim
   * lifts it. That roll is the only thing on the screen that says you are on
   * water rather than on a moving platform, and adding it afterwards as a
   * `rotateZ` gets it wrong the moment you are not looking over the bow.
   *
   * `-π/2 - you.yaw` is the quarter turn between a camera, which looks down its
   * own -Z, and a hull, whose forward is +X. See `yawOfX`.
   */
  function pose(camera) {
    if (!active) return;
    tmpV.set(you.x, you.deck + BROD.eye, you.z);
    boat.localToWorld(tmpV);
    camera.position.copy(tmpV);
    boat.getWorldQuaternion(qBoat);
    eHead.set(you.pitch, -Math.PI / 2 - you.yaw, 0, 'YXZ');
    qHead.setFromEuler(eHead);
    camera.quaternion.copy(qBoat).multiply(qHead);
  }

  /**
   * Scenery, when you are not aboard.
   *
   * She is drawn whenever the camera is within a kilometre of the berth and the
   * mode is not running, which is what makes the mole somewhere you walk out to
   * *for a reason*. She does not move: she lies there rolling on the chop until
   * somebody gets on her.
   */
  function idle(dt, cam) {
    if (active || !berth) return;
    const d = Math.hypot(cam.x - berth.x, cam.z - berth.z);
    group.visible = d < 1000;
    if (group.visible) place(berth.x, berth.z, berth.yaw, dt);
  }

  /** Nothing on her animates yet. See the header for what is missing. */
  function draw() {}

  return {
    you,
    get active() { return active; },
    get phase() { return phase; },
    get run() { return s; },
    get total() { return total; },
    get speed() { return sp; },
    get call() { return said >= 0 ? BROD.calls[said] : null; },
    get dock() { return dock; },
    get berth() { return berth; },
    get quay() { return quay; },
    moor, reset, enter, leave, look, update, pose, draw, idle, canBoard,
    /**
     * Put her `m` metres along the passage. Nothing in the game calls this: it
     * is for a screenshot and for a test, because nine and a half minutes is
     * not a thing a headless page can wait out.
     */
    seek: (m) => {
      if (!route) return null;
      s = clamp(m, 0, total);
      sp = BROD.cruise;
      phase = total - s < BROD.slowAt ? 'slow' : 'run';
      said = -1;
      for (let i = 0; i < BROD.calls.length; i++) if (s >= BROD.calls[i].at) said = i;
      const P = atS(s);
      place(P.x, P.z, P.yaw);
      return s;
    },
    /** Where you are standing, in world metres — for the handover to the water. */
    where: () => {
      tmpW.set(you.x, you.deck, you.z);
      boat.localToWorld(tmpW);
      return [tmpW.x, tmpW.y, tmpW.z];
    },
    /** And which way you are looking, as the compass yaw everything ashore uses. */
    heading: () => {
      tmpW.set(Math.cos(you.yaw), 0, Math.sin(you.yaw));
      boat.localToWorld(tmpW).sub(boat.position);
      return Math.atan2(tmpW.x, -tmpW.z);
    },
    stats: () => ({
      on: active ? 1 : 0,
      phase,
      run: +s.toFixed(0),
      total: +total.toFixed(0),
      sp: +sp.toFixed(2),
      at: [+boat.position.x.toFixed(0), +boat.position.z.toFixed(0)],
      heel: +(att.roll * 57.3).toFixed(1),
      trim: +(att.pitch * 57.3).toFixed(1),
      you: [+you.x.toFixed(2), +you.z.toFixed(2)],
      said,
      dock: dock ? [+dock.x.toFixed(0), +dock.z.toFixed(0)] : null,
      tris: hull.geometry.attributes.position.count / 3
        + (fitting ? fitting.geometry.attributes.position.count / 3 : 0),
    }),
  };
}
