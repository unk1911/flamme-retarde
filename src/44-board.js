// -----------------------------------------------------------------------------
// The tourist board at the end of the row.
//
// Every bathing station on this coast has one: a laminated panel bolted to the
// first wall you meet, with the settlement drawn on it in cream and blue, the
// houses as little red blocks, a scale bar, a compass, a legend of pictograms
// nobody reads, and a red tag saying VI STE OVDJE over the spot you are standing
// on. It is the one piece of scenery that tells you where you are.
//
// It is drawn rather than photographed, and drawn *from the world this game is
// already standing on*: the coastline comes out of the same signed distance
// field the terrain shades itself with, the houses are the same OpenStreetMap
// footprints the city builder extrudes, the roads are the same 1 535 ways, and
// the names are the same OSM place nodes the landmarks are sited from. So the
// map is true in the only sense that matters here — walk to a corner of it and
// the corner is there.
//
// The one thing it is not is a copy of the real sign. Šibenik's arms and the
// tourist board's own mark belong to somebody; a lighthouse on a shield does
// not.
// -----------------------------------------------------------------------------

const BOARD = {
  // The window on the world, in metres, north up: +x is east and −z is north,
  // which is what `lonlat_to_game` in tools/bake.py lays down.
  //
  // 1700 by 1170 is the settlement and its water and almost nothing else. It
  // takes in the whole built spit from the hill behind Sićenica down to the
  // lighthouse on Rt Jadrija, and it puts the resort a little right of centre
  // where a bathing station belongs on its own map — near the middle, so the
  // walk to either end of it is on the paper.
  x0: -3150, x1: -1450,
  z0: -420, z1: 750,
  // 1.05 px to the metre, which is what the real boards run at: a six-metre
  // house is six pixels, and six pixels is the smallest red block that still
  // reads as a building rather than as noise. Half of it on a phone — the panel
  // is 2.1 m wide and you are never further from it than the alley is deep, so
  // the resolution that matters is the one you get standing in front of it.
  w: 1792,

  // ── the palette ──────────────────────────────────────────────────────────
  // Cream land and a mid Adriatic blue, which is the whole look of a Croatian
  // tourist board and is not an accident: the land is printed in the lightest
  // ink that still takes red on top of it, and the sea is the only large area of
  // saturated colour, so the coastline reads from ten metres away.
  land: '#e9ebcc',
  sea: '#3a86c6',
  deep: '#2a6ba8',
  shelf: '#66aed8',
  surf: '#f4f6f2',
  pine: '#4d8a43',
  scrub: '#8aab68',
  house: '#b34c30',
  civic: '#8f5a2c',
  road: '#e9b545',
  lane: '#fbfbf7',
  laneEdge: '#c6c3b4',
  ink: '#20211c',
  red: '#c0272d',
};

/**
 * The map, on a canvas, as a texture.
 *
 * `here` is where the board itself stands, in world metres, and it is the only
 * argument: everything else this needs is already in `world`.
 */
function jadrijaMapTexture(here) {
  // Half of it on a phone, which is 2.8 MB of texture rather than 11. The panel
  // is 2.1 m wide and you cannot stand further from it than the alley is deep,
  // so what is lost is the second half of the street names — and a phone screen
  // never had the pixels to show those anyway.
  //
  // Everything below is written in *design* pixels at the full width and the
  // canvas is scaled once, which is the only way a layout with a hundred hard
  // numbers in it survives being resized: halving `w` instead would leave the
  // compass 78 px across on a map 896 px wide.
  const K = IS_SMALL ? 0.5 : 1;
  const W = BOARD.w;
  const mx = BOARD.x1 - BOARD.x0, mz = BOARD.z1 - BOARD.z0;
  const ppm = W / mx;
  const H = Math.round(mz * ppm);
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * K); cv.height = Math.round(H * K);
  const g = cv.getContext('2d');
  const PX = (x) => (x - BOARD.x0) * ppm;
  const PZ = (z) => (z - BOARD.z0) * ppm;
  const inWin = (x, z, pad = 0) => x > BOARD.x0 - pad && x < BOARD.x1 + pad
    && z > BOARD.z0 - pad && z < BOARD.z1 + pad;

  // ── the ground ─────────────────────────────────────────────────────────────
  //
  // The coastline is the hard part and it is solved rather than traced. The
  // cover raster is 12.7 m to the sample, so thresholding it directly gives a
  // shore made of thirteen-pixel steps — a bitmap of a map. But every texel also
  // carries `shore`, the distance to the waterline from whichever side it is on,
  // and signing that by the cover class turns the pair into a signed distance
  // field whose zero contour is the coast. Bilinearly interpolated, that contour
  // is smooth at a fraction of a texel, which is the same trick the terrain
  // shader plays and is why the two agree.
  const N = world.grid;
  const HALF_W = CONFIG.world / 2;
  const sd = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const wet = world.cover[i] === COVER.SEA;
    sd[i] = (wet ? -1 : 1) * (world.shore[i] / 255) * 400;
  }
  // Wooded, as a fraction rather than a class, for the same reason: a boundary
  // between pine and rock that is interpolated is a boundary a cartographer
  // could have drawn, and one that is thresholded is a staircase.
  const wood = new Uint8Array(N * N);
  const brush = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const c = world.cover[i];
    wood[i] = c === COVER.PINE ? 1 : 0;
    brush[i] = (c === COVER.SCRUB || c === COVER.OLIVE || c === COVER.VINE) ? 1 : 0;
  }

  // The base raster is the one thing that is *not* in design pixels: putImageData
  // ignores the transform, by specification, so it has to be laid out at the size
  // the canvas actually is.
  const RW = cv.width, RH = cv.height, rpm = ppm * K;
  const img = g.createImageData(RW, RH);
  const D = img.data;
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16)];
  const C = {
    land: hex(BOARD.land), sea: hex(BOARD.sea),
    deep: hex(BOARD.deep), shelf: hex(BOARD.shelf), surf: hex(BOARD.surf),
    pine: hex(BOARD.pine), scrub: hex(BOARD.scrub),
  };
  const blend = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t];
  // The bilinear fetch is written out rather than called through a closure per
  // channel: this is two and a quarter million pixels and three fields, and the
  // row terms — which are the same for every pixel in a row — come out of the
  // inner loop entirely.
  const gs = (N - 1) / CONFIG.world;
  let o = 0;
  for (let py = 0; py < RH; py++) {
    const z = BOARD.z0 + (py + 0.5) / rpm;
    const gz = clamp((z + HALF_W) * gs, 0, N - 1);
    const z0 = gz | 0, z1 = Math.min(z0 + 1, N - 1), tz = gz - z0;
    const r0 = z0 * N, r1 = z1 * N;
    for (let px = 0; px < RW; px++, o += 4) {
      const x = BOARD.x0 + (px + 0.5) / rpm;
      const gx = clamp((x + HALF_W) * gs, 0, N - 1);
      const x0 = gx | 0, x1 = Math.min(x0 + 1, N - 1), tx = gx - x0;
      const w00 = (1 - tx) * (1 - tz), w10 = tx * (1 - tz);
      const w01 = (1 - tx) * tz, w11 = tx * tz;
      const i00 = r0 + x0, i10 = r0 + x1, i01 = r1 + x0, i11 = r1 + x1;
      const d = sd[i00] * w00 + sd[i10] * w10 + sd[i01] * w01 + sd[i11] * w11;
      let col;
      if (d <= 0) {
        // Water: a shelf near the shore and open blue past it. The shelf is not
        // decoration — it is the only thing on a flat blue that says which of
        // two bodies of water you are looking at is a bay.
        col = blend(C.shelf, C.sea, sat((-d - 8) / 90));
        col = blend(col, C.deep, sat((-d - 180) / 420));
      } else {
        const bv = brush[i00] * w00 + brush[i10] * w10
                 + brush[i01] * w01 + brush[i11] * w11;
        const wv = wood[i00] * w00 + wood[i10] * w10
                 + wood[i01] * w01 + wood[i11] * w11;
        col = blend(C.land, C.scrub, sat((bv - 0.34) * 2.2));
        col = blend(col, C.pine, sat((wv - 0.34) * 2.2));
        // The white rim every shore on a printed map has, which stands for
        // beach where there is beach and for quay where there is not.
        col = blend(col, C.surf, 1 - sat(d / 6));
      }
      D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // And from here on it is design pixels.
  g.scale(K, K);

  // ── the roads ──────────────────────────────────────────────────────────────
  //
  // Casing first for the whole network, then the fill for the whole network, or
  // every junction is a road drawn over a road's outline. Twice through 1 535
  // ways is nothing next to the two million pixels above.
  const ways = [];
  for (const way of world.roads) {
    const pts = [];
    for (const [x, z] of way.p) {
      if (inWin(x, z, 120)) pts.push([PX(x), PZ(z)]);
      else if (pts.length) { if (pts.length > 1) ways.push([way.r | 0, pts.slice()]); pts.length = 0; }
    }
    if (pts.length > 1) ways.push([way.r | 0, pts]);
  }
  const laneW = (r) => (r >= 3 ? 7.5 : r === 2 ? 5.5 : 3.6);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pass of [0, 1]) {
    for (const [r, pts] of ways) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      if (pass === 0) {
        g.strokeStyle = r >= 2 ? '#a9822a' : BOARD.laneEdge;
        g.lineWidth = laneW(r) + 2.2;
      } else {
        g.strokeStyle = r >= 2 ? BOARD.road : BOARD.lane;
        g.lineWidth = laneW(r);
      }
      g.stroke();
    }
  }

  // ── the houses ─────────────────────────────────────────────────────────────
  //
  // Real footprints, at their real shapes. This is the detail that makes a
  // tourist map of a Dalmatian village look like one: the lanes are legible not
  // because the roads are drawn but because there are three hundred little red
  // rectangles either side of them, all slightly out of square.
  let drawn = 0;
  for (const b of world.town) {
    const p = b.p;
    let x = 0, z = 0;
    for (const q of p) { x += q[0]; z += q[1]; }
    if (!inWin(x / p.length, z / p.length, 30)) continue;
    g.beginPath();
    g.moveTo(PX(p[0][0]), PZ(p[0][1]));
    for (let i = 1; i < p.length; i++) g.lineTo(PX(p[i][0]), PZ(p[i][1]));
    g.closePath();
    g.fillStyle = b.k === 1 ? BOARD.civic : BOARD.house;
    g.fill();
    drawn++;
  }

  // ── the resort ─────────────────────────────────────────────────────────────
  //
  // Which OSM does not have. The kabine are 2.15 m wide and were never mapped,
  // and the promenade is a ribbon of concrete on a coastline that the raster
  // calls shore — so the one place on this map you are certainly standing gets
  // drawn from the numbers the resort is built from rather than from the
  // payload. Two rows and the quay, and no more: the huts are 2 px on this
  // scale and a hundred separate marks would be a smudge.
  const shore = traceShore();
  if (shore.length >= 8) {
    const ST = shoreStations(shore);
    const band = (s0, s1, style) => {
      g.beginPath();
      for (let i = 0; i < ST.length; i++) {
        const st = ST[i];
        g.lineTo(PX(st.x + st.nx * s0), PZ(st.z + st.nz * s0));
      }
      for (let i = ST.length - 1; i >= 0; i--) {
        const st = ST[i];
        g.lineTo(PX(st.x + st.nx * s1), PZ(st.z + st.nz * s1));
      }
      g.closePath();
      g.fillStyle = style;
      g.fill();
    };
    band(0, JAD.deck, '#f2f1e6');                       // the terraces
    band(JAD.rowA, JAD.rowA + JAD.cabD, BOARD.house);   // the front row
    band(JAD.rowB, JAD.rowB + JAD.cabD, BOARD.house);   // and the back
  }

  // ── the lettering ──────────────────────────────────────────────────────────
  const halo = (text, x, y, font, col = BOARD.ink, ring = 'rgba(255,255,255,0.92)') => {
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.strokeStyle = ring; g.lineWidth = 5;
    g.strokeText(text, x, y);
    g.fillStyle = col; g.fillText(text, x, y);
  };

  // Street names, along the lane they belong to — which on this peninsula are
  // Jadrija I to Jadrija X and are the whole address system of the place. One
  // label a name, on its longest run inside the window, and only if that run is
  // long enough to carry the word.
  const named = new Map();
  for (const way of world.roads) {
    if (!way.n) continue;
    for (let i = 0; i < way.p.length - 1; i++) {
      const a = way.p[i], b = way.p[i + 1];
      if (!inWin(a[0], a[1]) || !inWin(b[0], b[1])) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const prev = named.get(way.n);
      if (!prev || len > prev.len) named.set(way.n, { len, a, b });
    }
  }
  g.save();
  for (const [name, run] of named) {
    if (run.len < name.length * 9) continue;
    const x = PX((run.a[0] + run.b[0]) * 0.5), y = PZ((run.a[1] + run.b[1]) * 0.5);
    let ang = Math.atan2(PZ(run.b[1]) - PZ(run.a[1]), PX(run.b[0]) - PX(run.a[0]));
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    g.save();
    g.translate(x, y); g.rotate(ang);
    halo(name, 0, 0, '600 15px Helvetica, Arial, sans-serif', '#4a4a42');
    g.restore();
  }
  g.restore();

  // The places, from the same OSM nodes the landmarks are sited from. A dot and
  // a name, and the dot matters: a name floating over a peninsula is a region,
  // a name next to a mark is a thing.
  const KIND = { place: 1, lighthouse: 1, peak: 1, fort: 1 };
  for (const p of world.places) {
    if (!KIND[p.k] || !inWin(p.x, p.z, -40)) continue;
    const x = PX(p.x), y = PZ(p.z);
    if (p.k !== 'place') {
      g.beginPath(); g.arc(x, y, 5, 0, TAU);
      g.fillStyle = BOARD.ink; g.fill();
      g.beginPath(); g.arc(x, y, 2, 0, TAU);
      g.fillStyle = '#fff'; g.fill();
    }
    const big = p.k === 'place';
    halo(p.n, x, y - (big ? 0 : 16),
      big ? '600 27px Georgia, serif' : '600 17px Helvetica, Arial, sans-serif');
  }
  // And the water, which OSM does not name as a node anywhere near here. The
  // channel is the reason the town is where it is and the reason a Canadair has
  // to come round rather than straight in, so it gets its name.
  g.save();
  g.translate(PX(-1727), PZ(671));
  g.rotate(-0.55);
  halo('Kanal sv. Ante', 0, 0, 'italic 30px Georgia, serif', '#eaf5fb',
    'rgba(24,62,96,0.75)');
  g.restore();

  // ── the furniture ──────────────────────────────────────────────────────────
  const round = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  // The cartouche. A shield with a lighthouse on it, which is a device and not
  // an arms — see the note at the top of this file.
  g.save();
  g.translate(46, 40);
  g.fillStyle = 'rgba(246,244,228,0.86)';
  round(0, 0, 470, 232, 10); g.fill();
  g.strokeStyle = '#b9b49c'; g.lineWidth = 3; g.stroke();
  g.save();
  g.translate(28, 26);
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(76, 0); g.lineTo(76, 104);
  g.bezierCurveTo(76, 148, 52, 168, 38, 178);
  g.bezierCurveTo(24, 168, 0, 148, 0, 104);
  g.closePath();
  g.fillStyle = '#2f6ea8'; g.fill();
  g.strokeStyle = '#8d6a2a'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#f4f2e6';
  g.beginPath();
  g.moveTo(30, 44); g.lineTo(46, 44); g.lineTo(50, 128); g.lineTo(26, 128);
  g.closePath(); g.fill();
  g.fillStyle = '#c0272d';
  g.fillRect(29, 66, 18, 12); g.fillRect(31, 96, 14, 12);
  g.beginPath(); g.arc(38, 38, 11, 0, TAU); g.fillStyle = '#f6d24a'; g.fill();
  g.fillStyle = '#2f6ea8';
  g.beginPath(); g.moveTo(6, 146); g.quadraticCurveTo(22, 136, 38, 146);
  g.quadraticCurveTo(54, 156, 70, 146); g.lineTo(70, 168);
  g.bezierCurveTo(58, 176, 46, 180, 38, 182);
  g.bezierCurveTo(30, 180, 18, 176, 6, 168); g.closePath();
  g.fill();
  g.restore();
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#5c584a';
  g.font = '600 25px Helvetica, Arial, sans-serif';
  g.fillText('GRAD ŠIBENIK', 132, 66);
  g.fillStyle = BOARD.ink;
  g.font = 'bold 82px Georgia, serif';
  g.fillText('Jadrija', 130, 150);
  g.fillStyle = '#6c6858';
  g.font = 'italic 22px Georgia, serif';
  g.fillText('kupalište · od 1920-ih', 134, 190);
  g.restore();

  // Haloed, and heavily: the only place on this map with room for it is over
  // the pine on the hill, and red on dark green is the one pairing that a
  // printed panel cannot carry on its own.
  g.lineWidth = 12;
  halo('Dobrodošli!', W * 0.60, 74, 'bold 62px Helvetica, Arial, sans-serif',
    BOARD.red, 'rgba(252,250,238,0.95)');
  halo('Welcome!', W * 0.60, 142, 'bold 62px Helvetica, Arial, sans-serif',
    BOARD.red, 'rgba(252,250,238,0.95)');

  // The compass. Eight points, alternating light and dark halves, which is the
  // one rose that survives being 120 px across.
  g.save();
  g.translate(150, H - 300);
  const R = 78;
  for (let i = 0; i < 8; i++) {
    const a0 = i * Math.PI / 4 - Math.PI / 2;
    const r = i % 2 ? R * 0.52 : R;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
      g.lineTo(Math.cos(a0 + side * Math.PI / 4) * R * 0.20,
        Math.sin(a0 + side * Math.PI / 4) * R * 0.20);
      g.closePath();
      g.fillStyle = side > 0 ? '#f4f2e6' : '#2b3b4a';
      g.fill();
      g.strokeStyle = '#2b3b4a'; g.lineWidth = 1.6; g.stroke();
    }
  }
  g.beginPath(); g.arc(0, 0, R * 0.16, 0, TAU);
  g.fillStyle = '#c0272d'; g.fill();
  halo('N', 0, -R - 22, 'bold 30px Georgia, serif', '#f4f2e6',
    'rgba(20,44,66,0.80)');
  g.restore();

  // The scale bar. Two hundred metres in four bars, which is what the walk from
  // the jetty to the far end of the row measures.
  g.save();
  g.translate(66, H - 150);
  const unit = 50 * ppm;
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#f4f2e6' : '#22303c';
    g.fillRect(i * unit, 0, unit, 17);
    g.strokeStyle = '#22303c'; g.lineWidth = 2;
    g.strokeRect(i * unit, 0, unit, 17);
  }
  for (const m of [0, 100, 200]) {
    halo(String(m), (m / 50) * unit, -18, '600 21px Helvetica, Arial, sans-serif',
      '#f4f2e6', 'rgba(20,44,66,0.80)');
  }
  halo('m', 4 * unit + 36, -18, '600 21px Helvetica, Arial, sans-serif', '#f4f2e6',
    'rgba(20,44,66,0.80)');
  g.restore();

  // The legend, and the glyphs in it are drawn rather than typed: an emoji is
  // whatever font the machine happens to have, which on a texture is a picture
  // you did not choose.
  const glyph = {
    parasol(c) {
      c.beginPath(); c.moveTo(-13, -2);
      c.quadraticCurveTo(0, -22, 13, -2); c.closePath();
      c.fillStyle = '#c0272d'; c.fill();
      c.strokeStyle = '#22303c'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(0, -2); c.lineTo(0, 15); c.stroke();
    },
    anchor(c) {
      c.strokeStyle = '#22303c'; c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -14); c.lineTo(0, 13); c.stroke();
      c.beginPath(); c.moveTo(-9, -8); c.lineTo(9, -8); c.stroke();
      c.beginPath(); c.arc(0, 3, 11, 0.35 * Math.PI, 0.65 * Math.PI); c.stroke();
    },
    cup(c) {
      c.strokeStyle = '#22303c'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-10, -8); c.lineTo(-8, 10); c.lineTo(8, 10);
      c.lineTo(10, -8); c.closePath(); c.stroke();
      c.beginPath(); c.arc(12, 0, 6, -1.2, 1.2); c.stroke();
    },
    ring(c) {
      c.strokeStyle = '#c0272d'; c.lineWidth = 6;
      c.beginPath(); c.arc(0, 1, 11, 0, TAU); c.stroke();
      c.strokeStyle = '#f4f2e6'; c.lineWidth = 6; c.setLineDash([7, 7]);
      c.beginPath(); c.arc(0, 1, 11, 0, TAU); c.stroke();
      c.setLineDash([]);
    },
    wc(c) {
      c.fillStyle = '#22303c'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'bold 22px Helvetica, Arial, sans-serif';
      c.fillText('WC', 0, 1);
    },
    park(c) {
      c.fillStyle = '#2f6ea8'; round(-13, -13, 26, 26, 4); c.fill();
      c.fillStyle = '#f4f2e6'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'bold 22px Helvetica, Arial, sans-serif';
      c.fillText('P', 0, 1);
    },
  };
  const LEGEND = [
    ['parasol', 'Plaža', 'Beach'],
    ['anchor', 'Privez', 'Moorings'],
    ['cup', 'Kafić', 'Café'],
    ['ring', 'Spašavanje', 'Lifeguard'],
    ['wc', 'Sanitarije', 'Toilets'],
    ['park', 'Parkiralište', 'Parking'],
  ];
  g.save();
  const LW = 1040, LH = 96, LX = 348, LY = H - LH - 34;
  g.translate(LX, LY);
  g.fillStyle = 'rgba(246,244,228,0.90)';
  round(0, 0, LW, LH, 8); g.fill();
  g.strokeStyle = '#b9b49c'; g.lineWidth = 2.5; g.stroke();
  LEGEND.forEach(([kind, hr, en], i) => {
    const cx = 28 + i * ((LW - 40) / LEGEND.length);
    g.save(); g.translate(cx + 18, LH * 0.5); glyph[kind](g); g.restore();
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = BOARD.ink;
    g.font = '600 19px Helvetica, Arial, sans-serif';
    g.fillText(hr, cx + 40, LH * 0.5 - 3);
    g.fillStyle = '#6c6858';
    g.font = 'italic 17px Helvetica, Arial, sans-serif';
    g.fillText(en, cx + 40, LH * 0.5 + 19);
  });
  g.restore();

  // VI STE OVDJE. The whole reason a map is bolted to a wall rather than folded
  // in a pocket, and the one mark on it that has to be exactly right: it is
  // drawn at the board's own world position, so it moves if the board does.
  const hx = PX(here[0]), hy = PZ(here[1]);
  const tag = [hx + 210, hy + 148];
  g.strokeStyle = BOARD.red; g.lineWidth = 3.5;
  g.beginPath(); g.moveTo(hx, hy); g.lineTo(tag[0], tag[1]); g.stroke();
  g.beginPath(); g.arc(hx, hy, 9, 0, TAU);
  g.fillStyle = BOARD.red; g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
  g.save();
  g.translate(tag[0] - 8, tag[1] - 6);
  g.fillStyle = BOARD.red;
  round(0, 0, 268, 78, 8); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#fff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 30px Helvetica, Arial, sans-serif';
  g.fillText('VI STE OVDJE', 134, 26);
  g.font = 'bold 25px Helvetica, Arial, sans-serif';
  g.fillText('YOU ARE HERE', 134, 56);
  g.restore();

  // ── and twenty summers of it ───────────────────────────────────────────────
  //
  // A laminated panel on a south-facing wall in Dalmatia does not stay printed.
  // Two things happen to it and both are cheap: the ink bleaches unevenly from
  // whichever corner the afternoon gets at, and the surface collects scratches
  // that are brighter than what is under them because they are scattering
  // rather than transmitting.
  const bleach = g.createLinearGradient(W, 0, W * 0.25, H);
  bleach.addColorStop(0, 'rgba(255,252,236,0.30)');
  bleach.addColorStop(0.45, 'rgba(255,252,236,0.10)');
  bleach.addColorStop(1, 'rgba(255,252,236,0.00)');
  g.fillStyle = bleach;
  g.fillRect(0, 0, W, H);
  const rnd = mulberry32(0x5ea51de);
  g.strokeStyle = 'rgba(255,255,255,0.30)';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, y = rnd() * H, a = (rnd() - 0.5) * 0.7 - 0.5;
    const L = 40 + rnd() * 320;
    g.lineWidth = 0.8 + rnd() * 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
    g.stroke();
  }
  // And the frame the print sits in, so the edge of the paper is an edge.
  g.strokeStyle = 'rgba(60,58,48,0.55)'; g.lineWidth = 6;
  g.strokeRect(3, 3, W - 6, H - 6);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex, aspect: W / H, houses: drawn, lanes: named.size };
}
