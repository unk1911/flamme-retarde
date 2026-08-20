// -----------------------------------------------------------------------------
// The vikendica at Jadrija.
//
// One real house, surveyed off its own drawings, standing on the front row at
// the beach end of the resort with the channel in front of it and nothing in
// between but the promenade. It is here for two reasons and they pull the same
// way: the on-foot mode has thirteen thousand buildings in it and not one you
// can go inside, and there is a renovation to decide — sixty centimetres of new
// wall is all the permission there is, and the only honest way to know what
// that buys is to stand under it.
//
// So the roof is a switch. `vik.roof('now')` is the 23° gable that is there;
// `vik.roof('loft')` raises the wall head sixty centimetres, re-pitches at 25°
// and puts a mezzanine deck across the north two thirds at +2.55. Everything
// below the wall head is the same geometry under either, which is the whole
// point — you are meant to be standing in the same room.
//
// Geometry comes out of tools/blender/vikendica.py as three .fr3d blobs plus a
// plan sidecar, and the sidecar is what makes the house walkable: room
// rectangles, wall blockers and door anchors, written by the same file that
// built the walls so there is one source of truth for where they are.
// -----------------------------------------------------------------------------

const VIK = {
  // Where it stands, in Jadrija's own frame: `t` along the shore, `s` inland
  // from the waterline.
  //
  // It was behind the back row of kabine, and behind the back row of kabine you
  // are looking at the backs of a hundred huts. This house is a first-row house
  // — its whole reason for existing is that the balcony faces open water — so it
  // stands at the western end of the frontage, past where the rows now stop,
  // with the promenade in front of it and nothing between that and the channel.
  // `t` runs south-east along the shore, so 24 is up the beach end and the
  // jetty, at 94, is a seventy-metre walk away.
  //
  // Its own +X runs along +t and its terrace faces the sea. At s 25.4 the
  // terrace front lands at 19.3 m — two metres behind the seaward face the front
  // row used to occupy, which is exactly the line the real one stands on.
  t: 24.0,
  s: 25.4,

  // The upper floor, off the drawings. Kept here as well as in the sidecar
  // because the walking floor is computed every frame and a JSON lookup per
  // step is not worth the tidiness.
  floor: 2.90,

  // How far the plinth is buried. Small, because it stands on a made-up
  // concrete surface rather than on a slope — the whole point of `sink` on a
  // hillside is to hide the gap under the uphill wall, and there is no slope
  // here to leave one.
  sink: 0.10,

  // The mezzanine, when it is on: the deck, and the ladder-stair up to it.
  deck: 5.45,

  // The outside stair: seventeen risers of 17 up the east face, seventeen
  // goings of 18.3 along it, in house-local three.js metres. Both ends of it
  // are fixed by something else — the head by the door it serves, the foot by
  // the south face of the house, which is where the real one starts — so the
  // going is the remainder and not a choice. It was 25, which ran the flight a
  // metre and a bit past the corner of the building and out over open ground.
  //
  // The landing is at the top
  // and it covers the doorway, which took a change in the Blender file to be
  // true: the flight used to arrive *in* the opening, so the last thing between
  // the promenade and the front door was an 18 cm step with nothing to stand on
  // while you crossed it. Walking in was a fall.
  //
  // `x0` deliberately overlaps the east wall. The outer face is at 3.39 and the
  // flight starts at 3.46, and that 7 cm of nothing was a slot the width of a
  // finger where the floor was neither the house's nor the stair's — so you
  // dropped 2.9 m through the doorstep. Surfaces that meet must overlap.
  stair: { x0: 3.30, x1: 4.62, z0: 0.76, z1: 3.865 },
  landing: { x0: 3.30, x1: 4.62, z0: -0.42, z1: 0.80 },

  // And the ladder-stair inside, up the east wall of the big room: twelve
  // treads, 2.55 m of rise in 1.98 of run. It was fourteen over 2.60, and
  // 2.60 m is the whole distance from the deck's open edge to the inner face of
  // the south wall — so the bottom tread was 1.5 cm off the terrace glass and
  // you came down the last step of it into a window.
  loftStair: { x0: 2.20, x1: 3.15, z0: 0.90, z1: 3.14 },
  loftDeck: { x0: -3.19, x1: 3.19, z0: -3.665, z1: 1.20 },

  // A little emissive, and it is a cheat with a reason. The interior is lit by
  // one sun through five windows and this shader does not bounce, so a room you
  // are standing in the middle of goes black in a way no real room does. 0.14
  // is the plaster doing what plaster does.
  glow: 0.14,
};


/**
 * Decode the three blobs and stand the house up in the world.
 *
 * `field` is the Jadrija locale — it owns the shore frame, so the house asks it
 * where (t, s) is rather than carrying a second copy of the traced shoreline.
 */
async function buildVikendica(scene, field) {
  const plan = PAYLOAD.vikendica_plan;
  if (!plan) { console.warn('no vikendica_plan payload'); return null; }

  // Where it stands, and which way. The shore is a traced polyline, so the
  // house's yaw comes from the tangent at its own station rather than from a
  // constant: two samples a metre apart is the tangent, and rotation.y = θ
  // sends local +X to (cos θ, −sin θ), which is what has to line up with it.
  const here = field.toWorld(VIK.t, VIK.s);
  const ahead = field.toWorld(VIK.t + 1, VIK.s);
  const back = field.toWorld(VIK.t - 1, VIK.s);
  const ux = ahead[0] - back[0], uz = ahead[2] - back[2];
  const len = Math.hypot(ux, uz) || 1;
  const yaw = Math.atan2(-uz / len, ux / len);
  // The ground it stands on, dropped a little so the plinth is buried rather
  // than floating.
  //
  // `here[1]`, which is the resort's own surface, and not `groundAt` — which is
  // what this was and which is the terrain *under* the resort. Standing on the
  // back of the promenade those two are 0.9 m apart, because 0.9 m of made
  // ground is what the promenade is, so the house sat most of a metre low: the
  // foot of its stair was in a pit, and the first step of the walk up to it was
  // a step down into one.
  const base = here[1] - VIK.sink;

  const root = new THREE.Group();
  root.position.set(here[0], base, here[2]);
  root.rotation.y = yaw;
  scene.add(root);

  const mat = solidMaterial(0xffffff, {
    spec: 0.05,
    specPower: 30,
    emissive: VIK.glow,
    // Every finish in the house — render, plaster, tile, laminate, the red of
    // the fridge — is baked into the vertex colours, so one material draws all
    // of it and there is no texture in the payload at all.
    //
    // Plus the one thing an interior needs that this shader has no notion of. A
    // downward-facing surface collects `uAmbGround`, which is the warm bounce
    // off open karst, because outdoors that is exactly what is under it. Indoors
    // what is under it is a white floor lit through a window, and the difference
    // is not subtle: every ceiling in the house came out tan, and a 2.40 m tan
    // ceiling makes a room you are trying to judge look like a cellar. So on
    // downward faces the normal is rolled up towards the horizon, which samples
    // the sky term instead — cooler and brighter, which is what a white ceiling
    // in a room with the sea outside it does.
    body: `base *= vVCol;
      float dn = smoothstep(0.0, -0.55, n.y);
      n = normalize(mix(n, vec3(n.x, 0.30, n.z), dn));
      base *= 1.0 + 0.34 * dn;`,
  });

  // The glazing, drawn separately and drawn through.
  //
  // Thirteen square metres of this house is glass and the whole reason for
  // standing in it is what is on the other side, so a pane baked in with the
  // walls — one flat grey rectangle, lit like plaster — turns the terrace doors
  // into a boarded-up hole. It is not much transparency: 0.26 with a hard
  // specular is what a pane with the sun off it actually looks like from inside,
  // which is mostly reflection with the view coming through it. `depthWrite` is
  // off so a pane cannot hide the room behind it from the sorter.
  const glassMat = solidMaterial(0xffffff, {
    spec: 0.62, specPower: 110, emissive: 0.06,
    opacity: 0.26, transparent: true, depthWrite: false,
    body: 'base *= vVCol;',
  });

  // The net curtains, drawn through as well.
  //
  // A sheer that stops light is not a sheer, it is a board — and both of the
  // ones that matter hang over the two brightest things in the flat: the
  // kitchen window and the 140 opening on to the terrace. Baked in with the
  // plaster they turned the west wall into a blank panel and the terrace into a
  // shuttered room. Denser than the glazing (0.44 against 0.26) and flatter,
  // because a net is a diffuser and not a mirror: almost no specular, and a
  // good deal of emissive so it *carries* the light it is standing in front of
  // rather than merely admitting it.
  const sheerMat = solidMaterial(0xffffff, {
    spec: 0.06, specPower: 12, emissive: 0.30,
    opacity: 0.44, transparent: true, depthWrite: false,
    body: 'base *= vVCol;',
  });

  // The sanitary ware, drawn brighter, and the reason is the one thing this
  // shader cannot do.
  //
  // Ambient here is hemispheric: `mix(ground, sky, n.y * 0.5 + 0.5)`. An
  // up-facing surface takes the whole sky, a vertical one takes half of it, and
  // indoors the sun is shadowed out entirely — so a horizontal white surface in
  // this bathroom renders past clipping and a vertical white surface beside it
  // renders at 53 per cent. Measured, not guessed: the WC cistern came back
  // (130,143,157) against an albedo of (247,248,249), and bluer than its own
  // paint, which is sky and nothing else.
  //
  // That is fine for plaster and wrong for glazed ceramic, which in a small
  // tiled room is one of the brightest things there is — it is sitting in the
  // bounce off a white basin, a white bath and a white ceiling, and this shader
  // has no bounce at all. `VIK.glow` is that admission already made once, at
  // 0.14, for the whole house. Sanitary ware wants far more of it than plaster
  // does, and it cannot have it while it shares a material with the walls.
  //
  // So it comes out of Blender in its own blob, the same way the glazing and
  // the net curtains do, and gets its own emissive and a harder specular for
  // the glaze. Nothing else in the house is PORCELAIN, so nothing else moves.
  const wareMat = solidMaterial(0xffffff, {
    spec: 0.11, specPower: 55, emissive: 0.46,
    body: 'base *= vVCol;',
  });

  const parts = {};
  const soft = (k) => k.endsWith('_glass') || k.endsWith('_sheer');
  for (const key of ['shell', 'roof', 'loft',
                     'shell_glass', 'roof_glass', 'loft_glass',
                     'shell_sheer', 'roof_sheer', 'loft_sheer',
                     'shell_ware']) {
    const b64 = PAYLOAD['vikendica_' + key + '_fr3d'];
    if (!b64) { if (!soft(key)) console.warn('no vikendica payload:', key); continue; }
    try {
      const geo = readFR3D(await inflateBinary(b64));
      const mesh = new THREE.Mesh(geo,
        key.endsWith('_sheer') ? sheerMat : key.endsWith('_glass') ? glassMat
          : key.endsWith('_ware') ? wareMat : mat);
      mesh.castShadow = !soft(key);
      mesh.receiveShadow = true;
      if (soft(key)) mesh.renderOrder = 3;
      root.add(mesh);
      parts[key] = mesh;
    } catch (e) {
      console.warn('vikendica failed:', key, e.message);
    }
  }
  for (const k of ['loft', 'loft_glass', 'loft_sheer']) {
    if (parts[k]) parts[k].visible = false;
  }

  // ── the fish's hands ───────────────────────────────────────────────────────
  /**
   * Three hands on the fish clock, turning, telling the actual time.
   *
   * They used to be baked into the ply at ten past ten, which is the right
   * answer for a photograph of a clock and the wrong one for a clock in a room
   * you are walking around: the pose that reads as "a clock" in a still reads as
   * "a clock that has stopped" the moment you can stand in front of it and
   * watch. A second hand sweeping is the cheapest possible proof that the room
   * is running rather than being looked at, and it costs three boxes.
   *
   * Built here rather than exported because they move, and everything in the
   * payload is one welded mesh per roof state. The spindle comes out of the plan
   * sidecar so the geometry and the hands cannot drift apart.
   *
   * The plate lies in the house's own XY, which is the wall's plane, and turns
   * about +Z, which is the wall's normal into the room. Blender's angles ran
   * anticlockwise from twelve and three.js turns the same way about the same
   * axis, so a clock — which runs the other way — is a negative angle.
   */
  const clockHands = [];
  if (plan.clock) {
    const [cx, cy, cz] = plan.clock.at;
    const R = plan.clock.r;
    /**
     * One hand, as a spade rather than as a bar.
     *
     * Everything here is a fraction of the dial's own radius, which is the
     * fix. The lengths used to be absolute numbers scaled off a 0.178 fish
     * that no longer exists, and the boss they turn on was an absolute 16 mm
     * disc that never shrank with the animal at all — so on the 24 cm clock
     * that is actually on the wall the hour hand emerged 8 mm from a 32 mm
     * black hub and read as snapped off. The numbers ride at 0.62 R, so the
     * minute reaches the inside of the markers, the hour reaches 0.61 of the
     * minute, and the second overshoots the markers the way a second hand
     * does.
     *
     * The outline is drawn once, extruded, and given the same 0.4 mm bevel
     * every other edge in this house has: a hand is the smallest thing in the
     * room and a flat black bar with no catch-light on its edge disappears
     * against a dark dial from two metres.
     */
    const hand = (len, w, tail, tailW, depth, colour) => {
      const s = new THREE.Shape();
      s.moveTo(-tailW, -tail);
      s.lineTo(tailW, -tail);
      s.lineTo(w, -tail * 0.15);
      s.lineTo(w, len * 0.58);
      s.lineTo(w * 0.42, len * 0.88);
      s.lineTo(0, len);
      s.lineTo(-w * 0.42, len * 0.88);
      s.lineTo(-w, len * 0.58);
      s.lineTo(-w, -tail * 0.15);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, {
        depth, bevelEnabled: true, bevelThickness: 0.0004,
        bevelSize: 0.0004, bevelSegments: 1, curveSegments: 1,
      });
      g.translate(0, 0, -depth * 0.5);
      const m = new THREE.Mesh(g, solidMaterial(colour, {
        spec: 0.30, specPower: 40, emissive: VIK.glow, vcol: false,
      }));
      m.position.set(cx, cy, cz);
      m.castShadow = false;
      m.receiveShadow = false;
      root.add(m);
      clockHands.push(m);
      return m;
    };
    // Hours, minutes, then the coral second hand in front of both so it never
    // disappears into one of them. The second hand is a needle with a real
    // counterweight behind the arbor, because that tail is most of what says
    // "second hand" at a glance.
    hand(0.380 * R, 0.052 * R, 0.115 * R, 0.030 * R, 0.0040, 0x101112);
    hand(0.560 * R, 0.036 * R, 0.130 * R, 0.024 * R, 0.0040, 0x101112);
    hand(0.665 * R, 0.013 * R, 0.190 * R, 0.030 * R, 0.0028, 0xd8503c)
      .position.z = cz - 0.0038;
  }

  // ── the television ─────────────────────────────────────────────────────────
  /**
   * The set on the low cabinet, on, all day, with nobody watching it.
   *
   * It was a dark grey rectangle, which is what a television that is off is,
   * and a television that is off in a room whose whole job is to feel lived in
   * is a missed opportunity — the fan turns, the clock sweeps, and the biggest
   * flat surface in the room did nothing.
   *
   * Two things it shows. The default is the business channel: a strip of
   * market, a headline, a crawl, and a clock on Zagreb time, laid out the way
   * every financial channel on earth lays it out because that layout is now
   * what "news" looks like from across a room. Hose it with the branch and the
   * channel goes round to the four crypto pages, one at a time, and then back
   * to the news — the same knock-the-set-and-it-changes idea the valve set in
   * the kabine has, one generation of television later.
   *
   * The prices are real. `api.coinbase.com` answers a plain GET with CORS
   * open, which is the same endpoint the kabine's set already uses, so this
   * costs one more request every three quarters of a minute and gets an actual
   * number off an actual exchange. Off the network — a `file://` copy, a
   * laptop on a boat — the fetch fails quietly and the walk below carries the
   * page on its own, so the set is never blank and never wrong about being
   * live: the LIVE lamp is lit by the last successful answer, not by hope.
   *
   * The headlines are this world's, not the wire's. A channel reading out
   * invented quotes from real companies would be a lie with a Bloomberg
   * typeface on it; a regional channel on the sixth of August, with a fire on
   * the hill behind Šibenik and a Canadair working the channel, is the room
   * being in the same afternoon as the rest of the game.
   */
  const TV = {
    w: 768, h: 576,
    fps: 18,
    every: 45,          // s between price requests, one pair at a time
    hold: 9.0,          // s a headline stays up
  };
  const tv = (() => {
    const cv = document.createElement('canvas');
    cv.width = TV.w; cv.height = TV.h;
    const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    // Four crypto pages and the news, and the news is page 0 because it is
    // what is on when nobody has touched it.
    const PAGES = [
      null,
      { k: 'BTC', pair: 'BTC-USD', dp: 0, name: 'BITCOIN' },
      { k: 'LTC', pair: 'LTC-USD', dp: 2, name: 'LITECOIN' },
      { k: 'ETH', pair: 'ETH-USD', dp: 0, name: 'ETHEREUM' },
      { k: 'DOGE', pair: 'DOGE-USD', dp: 4, name: 'DOGECOIN' },
    ];
    // The strip along the top. The four pairs are live; the rest walk, and are
    // labelled as what they are — an index level with no source behind it is
    // set dressing, so it is dressed as set dressing and put in small type.
    const STRIP = [
      { k: 'BTC', pair: 'BTC-USD', dp: 0, v: 96420, seed: 0.11 },
      { k: 'ETH', pair: 'ETH-USD', dp: 0, v: 3480, seed: 0.31 },
      { k: 'LTC', pair: 'LTC-USD', dp: 2, v: 118.4, seed: 0.53 },
      { k: 'DOGE', pair: 'DOGE-USD', dp: 4, v: 0.2140, seed: 0.77 },
      { k: 'CROBEX', dp: 2, v: 3184.6, seed: 0.19 },
      { k: 'EUR/USD', dp: 4, v: 1.0842, seed: 0.61 },
      { k: 'BRENT', dp: 2, v: 81.35, seed: 0.43 },
    ];
    for (const s of STRIP) { s.open = s.v; s.live = false; }

    const HEAD = [
      ['POŽAR IZNAD ŠIBENIKA', 'Kanaderi rade nad kanalom · vjetar u naletima do 45 km/h'],
      ['ZATVORENA DRŽAVNA CESTA D8', 'Promet preusmjeren preko Vodica · odgode do dva sata'],
      ['TURIZAM: KOLOVOZ REKORDAN', 'Noćenja na šibenskom području 6 % iznad prošlogodišnjih'],
      ['VATROGASCI: 49 LJUDI NA TERENU', 'Dodatne postrojbe iz Zadra i Splita stižu poslijepodne'],
      ['STRUJA: KRATKI PREKIDI', 'HEP najavljuje ograničenja na dalekovodu Šibenik–Drniš'],
      ['MORE 26 °C, BURA NAVEČER', 'Upozorenje za male brodice na otvorenom moru'],
      ['KUNA/EURO: DESET GODINA POSLIJE', 'Analiza: što je članstvo u eurozoni značilo za obalu'],
      ['JADRIJA: SEZONA U PUNOM JEKU', 'Kabine iz 1922. i dalje najfotografiranije na Jadranu'],
    ];
    const CRAWL = 'ZRAČNE SNAGE: DVA KANADERA I JEDAN AIR TRACTOR NA POŽARIŠTU'
      + '   ·   DHMZ: INDEKS OPASNOSTI OD POŽARA — VRLO VELIK'
      + '   ·   TRAJEKT ŠIBENIK–ZLARIN PLOVI PO REDU'
      + '   ·   HAK: POJAČAN PROMET NA ULAZU U GRAD'
      + '   ·   BURZA: PROMET 4,1 MIL. EUR   ·   ';

    let page = 0, wet = 0, t0 = 0, last = 0, ask = 0, busy = false, headI = 0;
    let liveAt = 0;

    /** One step of the walk, which is what keeps the numbers moving. */
    function step(t) {
      for (const s of STRIP) {
        if (s.live) continue;
        // Two sines at coprime rates, so it wanders rather than oscillates.
        const d = Math.sin(t * 0.13 + s.seed * 19) * 0.6
          + Math.sin(t * 0.041 + s.seed * 7) * 0.4;
        s.v = s.open * (1 + d * 0.011);
      }
    }

    function fetchOne() {
      if (busy || typeof fetch !== 'function') return;
      const s = STRIP[(ask++) % 4];       // the four that have an exchange
      busy = true;
      fetch('https://api.coinbase.com/v2/prices/' + s.pair + '/spot',
        { mode: 'cors' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const v = j && j.data && parseFloat(j.data.amount);
          if (v > 0) {
            if (!s.live) s.open = v;      // first real answer sets the day's open
            s.v = v; s.live = true;
            liveAt = Date.now();
          }
        })
        .catch(() => {})
        .then(() => { busy = false; });
    }

    const money = (v, dp) => '$' + v.toLocaleString('en-US',
      { minimumFractionDigits: dp, maximumFractionDigits: dp });
    const pct = (s) => ((s.v / s.open - 1) * 100);

    const UP = '#26d07c', DOWN = '#ff5a52', AMBER = '#ffb020';
    const face = (px, w) => `${w} ${px}px "Helvetica Neue",Arial,sans-serif`;

    function drawStrip(y, t) {
      g.fillStyle = '#111826';
      g.fillRect(0, y, TV.w, 30);
      const cw = TV.w / STRIP.length;
      for (let i = 0; i < STRIP.length; i++) {
        const s = STRIP[i], p = pct(s), x = i * cw + 8;
        g.font = face(13, 'bold');
        g.fillStyle = '#9fb0c8';
        g.textAlign = 'left';
        g.fillText(s.k, x, y + 13);
        g.font = face(14, 'bold');
        g.fillStyle = p >= 0 ? UP : DOWN;
        g.fillText((p >= 0 ? '▲' : '▼') + ' ' + Math.abs(p).toFixed(2) + '%',
          x, y + 26);
        g.font = face(12, '');
        g.fillStyle = '#e6edf6';
        g.textAlign = 'right';
        g.fillText(money(s.v, s.dp), x + cw - 14, y + 13);
        if (i) {
          g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(i * cw, y + 4); g.lineTo(i * cw, y + 26); g.stroke();
        }
      }
    }

    function drawCrawl(t) {
      const y = TV.h - 44;
      g.fillStyle = AMBER;
      g.fillRect(0, y, TV.w, 44);
      g.fillStyle = '#12161d';
      g.fillRect(0, y, 96, 44);
      g.font = face(15, 'bold');
      g.fillStyle = AMBER; g.textAlign = 'center';
      g.fillText('UŽIVO', 48, y + 27);
      g.save();
      g.beginPath(); g.rect(96, y, TV.w - 96, 44); g.clip();
      g.font = face(17, 'bold');
      g.fillStyle = '#1a1206'; g.textAlign = 'left';
      const w = g.measureText(CRAWL).width;
      let x = 104 - ((t * 74) % w);
      while (x < TV.w) { g.fillText(CRAWL, x, y + 28); x += w; }
      g.restore();
    }

    /** Zagreb time, off the same offset the fish clock runs on. */
    function clockText(now) {
      const d = new Date(now + zagrebOffset(now));
      const p = (n) => String(n).padStart(2, '0');
      return p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
    }

    function drawNews(t, now) {
      g.fillStyle = '#0a0e18';
      g.fillRect(0, 0, TV.w, TV.h);
      // The masthead.
      g.fillStyle = AMBER;
      g.fillRect(0, 0, TV.w, 46);
      g.fillStyle = '#12161d';
      g.font = face(24, 'bold'); g.textAlign = 'left';
      g.fillText('POSLOVNI', 18, 32);
      // Measured, not guessed at 138: the two words ran together into
      // POSLOVNIKANAL, which is the kind of thing you only see on the wall.
      const mw = g.measureText('POSLOVNI').width;
      g.font = face(24, '');
      g.fillText('KANAL', 18 + mw + 9, 32);
      g.textAlign = 'right';
      g.font = face(22, 'bold');
      g.fillText(clockText(now), TV.w - 18, 32);

      drawStrip(46, t);

      // The headline, which is the biggest thing on the screen because on a
      // channel like this it always is.
      const h = HEAD[headI % HEAD.length];
      g.fillStyle = '#e8eef7';
      g.font = face(40, 'bold'); g.textAlign = 'left';
      // Wrapped by hand, because two lines of 40 px is the whole design.
      const words = h[0].split(' ');
      let line = '', y = 168;
      for (const wd of words) {
        const test = line ? line + ' ' + wd : wd;
        if (g.measureText(test).width > TV.w - 60 && line) {
          g.fillText(line, 30, y); y += 46; line = wd;
        } else line = test;
      }
      g.fillText(line, 30, y);
      g.fillStyle = '#93a5bd';
      g.font = face(20, '');
      g.fillText(h[1], 30, y + 40);

      // The red lamp, and it is honest: lit by an answer, not by intent.
      const on = Date.now() - liveAt < 180000;
      g.fillStyle = on ? '#ff3b30' : '#4a5568';
      g.beginPath();
      g.arc(40, TV.h - 118, 8 + (on ? Math.sin(t * 3.2) * 1.6 : 0), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = on ? '#ff8078' : '#65718a';
      g.font = face(15, 'bold'); g.textAlign = 'left';
      g.fillText(on ? 'CIJENE UŽIVO' : 'CIJENE — NEMA VEZE', 58, TV.h - 112);

      drawCrawl(t);
    }

    function drawQuote(c, t, now) {
      const s = STRIP.find((q) => q.k === c.k);
      g.fillStyle = '#070b12';
      g.fillRect(0, 0, TV.w, TV.h);
      g.fillStyle = '#111826';
      g.fillRect(0, 0, TV.w, 46);
      g.fillStyle = AMBER;
      g.font = face(22, 'bold'); g.textAlign = 'left';
      g.fillText(c.k + ' / USD', 18, 32);
      g.fillStyle = '#7f8ea6';
      g.font = face(18, '');
      g.fillText(c.name, 168, 32);
      g.textAlign = 'right'; g.fillStyle = '#e8eef7';
      g.font = face(20, 'bold');
      g.fillText(clockText(now), TV.w - 18, 32);

      const p = pct(s);
      g.textAlign = 'center';
      g.fillStyle = '#f2f6fc';
      g.font = face(96, 'bold');
      g.fillText(money(s.v, c.dp), TV.w / 2, 250);
      g.fillStyle = p >= 0 ? UP : DOWN;
      g.font = face(38, 'bold');
      g.fillText((p >= 0 ? '▲ +' : '▼ ') + p.toFixed(2) + '%', TV.w / 2, 306);

      // A sparkline off the same walk that moves the number, so the shape and
      // the figure are one thing rather than two.
      g.strokeStyle = p >= 0 ? UP : DOWN;
      g.lineWidth = 2.4;
      g.beginPath();
      for (let i = 0; i <= 120; i++) {
        const tt = t - (120 - i) * 0.9;
        const d = Math.sin(tt * 0.13 + s.seed * 19) * 0.6
          + Math.sin(tt * 0.041 + s.seed * 7) * 0.4;
        const x = 60 + i * (TV.w - 120) / 120;
        const y = 430 - d * 52;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
      g.fillStyle = '#5c6b84';
      g.font = face(14, '');
      g.textAlign = 'left';
      g.fillText(s.live ? 'COINBASE SPOT' : 'BEZ VEZE — ZADNJE POZNATO', 60, 470);
      drawCrawl(t);
    }

    function paint(now) {
      const t = now / 1000;
      step(t);
      if (page === 0) drawNews(t, now); else drawQuote(PAGES[page], t, now);
      tex.needsUpdate = true;
    }

    return {
      tex,
      /** Called every frame; paints at `TV.fps` and asks for a price rarely. */
      tick() {
        const now = Date.now();
        if (!t0) { t0 = now; last = now - 1000; }
        const t = now / 1000;
        if (now - last < 1000 / TV.fps) return;
        last = now;
        if (wet > 0) wet -= 1 / TV.fps;
        if (t - (this._ask || 0) > TV.every) { this._ask = t; fetchOne(); }
        if (page === 0 && t - (this._head || 0) > TV.hold) {
          this._head = t; headI++;
        }
        paint(now);
      },
      /** The jet has found the set: one round of the dial. */
      knock() {
        if (wet > 0) return false;
        wet = 0.9;
        page = (page + 1) % PAGES.length;
        this._head = 0;
        paint(Date.now());
        return true;
      },
      page: () => page,
      live: () => Date.now() - liveAt < 180000,
    };
  })();

  {
    // The panel, over the dark rectangle the payload bakes. Blender's y is
    // three.js's −z, and the set faces the room, which is −z from this wall.
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.535, 0.425),
      new THREE.MeshBasicMaterial({ map: tv.tex }));
    // The baked panel's front face is at 3.447 and the room is at *smaller* z,
    // so the picture goes in front of it and not behind: at 3.451 it was
    // inside the set, which draws as a set that is switched off.
    scr.position.set(0.17, plan.floor + 0.955, 3.4425);
    scr.rotation.y = Math.PI;
    scr.castShadow = false; scr.receiveShadow = false;
    root.add(scr);
    tv.at = [0.17, plan.floor + 0.955, 3.40];
  }

  // ── the two drawings on the spine ──────────────────────────────────────────
  /**
   * A floor plan, drawn.
   *
   * There were two blank rectangles on this wall — a blue landscape one and a
   * white portrait one — and they were the same failure the framed sunset was
   * before them: a coloured rectangle at eye height standing in for a picture
   * nobody can see. What should be on a wall in this particular house is not in
   * doubt. The whole model was measured off a set of 1:100 drawings, `TLOCRT
   * KATA` and `TLOCRT PRIZEMLJA`, and everything in the sidecar — the rooms,
   * the wall runs, the outer envelope — is those drawings in numbers.
   *
   * So they are drawn back out. Not a scan: a scan is a photograph of a piece
   * of paper and would go out of date the moment a wall moved, and it would
   * also be somebody's building file on a public page. This is the model
   * drawing itself, at 1:100, in the same layout as the original sheet, with
   * the areas computed from the same rectangles the walls are built from. The
   * schedule at the bottom comes out within a couple of per cent of the one on
   * the real drawing — 3.89 m² for the bathroom against 3.89, 7.64 for the
   * small bedroom against 7.69 — which is the model saying, in the one place
   * you can check it, that it is the house.
   *
   * `rects` is the room table, `walls` the blocker list; both are in house
   * metres, which are the drawing's own metres.
   */
  function planSheet(o) {
    const W = o.wide ? 1120 : 760;
    const H = o.wide ? 800 : 1030;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');

    // Paper. Warm, slightly uneven, and not white: the original is a folded
    // photocopy that has been in a drawer since 2004.
    g.fillStyle = '#efe9db';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * W, y = Math.random() * H;
      g.fillStyle = `rgba(120,112,92,${0.012 + Math.random() * 0.03})`;
      g.fillRect(x, y, 1 + Math.random() * 26, 1 + Math.random() * 3);
    }
    // The fold down the middle of the sheet, which is on every one of them.
    const fold = W * (o.wide ? 0.42 : 0.36);
    const fg = g.createLinearGradient(fold - 14, 0, fold + 14, 0);
    fg.addColorStop(0, 'rgba(120,110,88,0)');
    fg.addColorStop(0.45, 'rgba(120,110,88,0.12)');
    fg.addColorStop(0.55, 'rgba(255,252,244,0.35)');
    fg.addColorStop(1, 'rgba(120,110,88,0)');
    g.fillStyle = fg;
    g.fillRect(fold - 14, 0, 28, H);

    const INK = '#232019';
    const FINE = 'rgba(35,32,25,0.72)';
    const face = (px, w) => `${w} ${px}px "Arial Narrow","Helvetica Neue",Arial,sans-serif`;

    // ── the frame the drawing sits in ────────────────────────────────────────
    const top = o.wide ? 96 : 104;
    // The schedule decides where the drawing stops, not the other way round:
    // sized the other way the ground floor's eight rooms ran off the bottom of
    // the sheet and the last two simply were not there.
    const step = o.wide ? 27 : 31;
    const bot = H - (o.schedule.length * step + (o.wide ? 104 : 124));
    const left = 108, right = W - 66;

    // The house, fitted to it. The terrace is part of the sheet — it is a
    // fifth of the floor area and the reason the flat is worth having.
    const b = { x0: o.outer.x0, x1: o.outer.x1, z0: o.outer.z0, z1: o.outer.z1 };
    if (o.terrace) {
      b.x0 = Math.min(b.x0, o.terrace.x0); b.x1 = Math.max(b.x1, o.terrace.x1);
      b.z0 = Math.min(b.z0, o.terrace.z0); b.z1 = Math.max(b.z1, o.terrace.z1);
    }
    const pad = 0.35;
    const sx = (right - left) / (b.x1 - b.x0 + pad * 2);
    const sz = (bot - top) / (b.z1 - b.z0 + pad * 2);
    const k = Math.min(sx, sz);
    const ox = left + ((right - left) - (b.x1 - b.x0) * k) / 2 - b.x0 * k;
    // North is up on an architect's plan and +z is south here, so z is flipped.
    // +z is the sea side and the sea side is the bottom of the sheet, which is
    // how the original is drawn — the terrace under the flat, the stair up the
    // right-hand edge. So z is *not* flipped.
    const oz = top + ((bot - top) - (b.z1 - b.z0) * k) / 2 - b.z0 * k;
    const X = (x) => ox + x * k;
    const Z = (z) => oz + z * k;

    // ── the terrace, tiled ───────────────────────────────────────────────────
    if (o.terrace) {
      const t = o.terrace;
      g.fillStyle = 'rgba(210,202,184,0.55)';
      g.fillRect(X(t.x0), Z(t.z0), (t.x1 - t.x0) * k, (t.z1 - t.z0) * k);
      g.strokeStyle = 'rgba(35,32,25,0.30)'; g.lineWidth = 1;
      for (let x = t.x0; x <= t.x1 + 1e-6; x += 0.45) {
        g.beginPath(); g.moveTo(X(x), Z(t.z0)); g.lineTo(X(x), Z(t.z1)); g.stroke();
      }
      for (let z = t.z0; z <= t.z1 + 1e-6; z += 0.45) {
        g.beginPath(); g.moveTo(X(t.x0), Z(z)); g.lineTo(X(t.x1), Z(z)); g.stroke();
      }
      g.strokeStyle = INK; g.lineWidth = 2.2;
      g.strokeRect(X(t.x0), Z(t.z0), (t.x1 - t.x0) * k, (t.z1 - t.z0) * k);
    }

    // ── the rooms, then the walls over them ──────────────────────────────────
    for (const r of o.rects) {
      g.fillStyle = 'rgba(255,253,247,0.60)';
      g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k);
      g.strokeStyle = FINE; g.lineWidth = 1.1;
      g.strokeRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k);
    }
    // Poché — the walls in solid, which is the whole reading of a plan.
    g.fillStyle = INK;
    for (const w of o.walls) {
      g.fillRect(X(w.x0), Z(w.z0), Math.max(2, (w.x1 - w.x0) * k),
        Math.max(2, (w.z1 - w.z0) * k));
    }

    // ── the numbers in their circles ─────────────────────────────────────────
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const r of o.rects) {
      if (!r.n) continue;
      const cx = X((r.x0 + r.x1) / 2), cy = Z((r.z0 + r.z1) / 2);
      g.fillStyle = INK;
      g.font = face(o.wide ? 26 : 30, 'bold');
      g.fillText(String(r.n), cx, cy - 1);
      g.font = face(o.wide ? 13 : 15, '');
      g.fillStyle = 'rgba(35,32,25,0.70)';
      g.fillText(r.area.toFixed(2) + ' m²', cx, cy + (o.wide ? 20 : 23));
    }

    // ── dimension strings ────────────────────────────────────────────────────
    //
    // In centimetres, which is how the original is written and how anybody in
    // Croatia would read it off a wall.
    const dim = (x0, y0, x1, y1, text, side) => {
      g.strokeStyle = FINE; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      for (const [px, py] of [[x0, y0], [x1, y1]]) {
        g.beginPath();
        g.moveTo(px - 4, py - 4); g.lineTo(px + 4, py + 4); g.stroke();
      }
      g.save();
      g.translate((x0 + x1) / 2, (y0 + y1) / 2);
      if (side === 'v') g.rotate(-Math.PI / 2);
      g.fillStyle = INK; g.font = face(15, '');
      g.textAlign = 'center'; g.textBaseline = 'bottom';
      g.fillText(text, 0, -4);
      g.restore();
    };
    const cm = (m) => String(Math.round(m * 100));
    const yTop = Z(b.z0) - 30;
    dim(X(o.outer.x0), yTop, X(o.outer.x1), yTop, cm(o.outer.x1 - o.outer.x0), 'h');
    const xLeft = X(b.x0) - 40;
    dim(xLeft, Z(o.outer.z0), xLeft, Z(o.outer.z1),
      cm(o.outer.z1 - o.outer.z0), 'v');

    // ── the title block ──────────────────────────────────────────────────────
    g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.fillStyle = INK;
    g.font = face(o.wide ? 34 : 32, 'bold');
    g.fillText(o.title, W - 60, 58);
    g.font = face(19, '');
    g.fillText('M. 1 : 100', W - 60, 84);

    // ── the schedule ─────────────────────────────────────────────────────────
    let y = bot + 62;
    g.font = face(o.wide ? 20 : 22, '');
    let total = 0;
    const base = o.wide ? 20 : 22;
    const room = W - 300;
    for (const r of o.schedule) {
      const label = r.n + '. ' + r.name;
      // The living room's name is four words long on the original too, and it
      // is the one that runs into the area column. Set narrower rather than
      // truncated: an abbreviated room name on a plan is a room you cannot
      // identify, and the number beside it is the whole point of the line.
      g.font = face(base, '');
      let px = base;
      while (px > 11 && g.measureText(label).width > room) {
        px -= 1; g.font = face(px, '');
      }
      g.textAlign = 'left'; g.fillStyle = INK;
      g.fillText(label, 74, y);
      const wid = g.measureText(label).width;
      g.font = face(base, '');
      g.textAlign = 'right';
      g.fillText('p = ' + r.area.toFixed(2) + ' m²', W - 74, y);
      // The dotted leader, which is what makes a list a schedule.
      g.strokeStyle = 'rgba(35,32,25,0.35)';
      g.setLineDash([2, 5]); g.lineWidth = 1;
      g.beginPath();
      g.moveTo(78 + wid + 14, y - 5);
      g.lineTo(W - 200, y - 5);
      g.stroke();
      g.setLineDash([]);
      total += r.area;
      y += step;
    }
    g.strokeStyle = INK; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(W * 0.42, y - 18); g.lineTo(W - 74, y - 18); g.stroke();
    y += 8;
    g.font = face(o.wide ? 22 : 23, 'bold');
    g.textAlign = 'right';
    g.fillText('UKUPNO:', W * 0.62, y);
    g.fillText('p = ' + total.toFixed(2) + ' m²', W - 74, y);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  {
    const area = (r) => (r.x1 - r.x0) * (r.z1 - r.z0);
    const R = plan.rooms, P = plan.roomsP;
    const num = (r, n) => ({ ...r, n, area: area(r) });

    const kat = planSheet({
      title: 'TLOCRT KATA',
      outer: plan.outer,
      terrace: R.terrace,
      walls: plan.blockers,
      rects: [num(R.living, 1), { ...R.kitchen, area: area(R.kitchen) },
        num(R.bath, 2), num(R.soba3, 3), num(R.soba4, 4), num(R.terrace, 5)],
      schedule: [
        { n: 1, name: 'DNEVNI BORAVAK, KUHINJA I BLAGOVAONICA',
          area: area(R.living) + area(R.kitchen) },
        { n: 2, name: 'KUPAONICA', area: area(R.bath) },
        { n: 3, name: 'SOBA', area: area(R.soba3) },
        { n: 4, name: 'SOBA', area: area(R.soba4) },
        { n: 5, name: 'TERASA', area: area(R.terrace) },
      ],
    });

    const priz = planSheet({
      wide: true,
      title: 'TLOCRT PRIZEMLJA',
      outer: plan.outer,
      walls: plan.blockersP,
      rects: [num(P.boravak, 1), num(P.kuhinja, 2), num(P.soba3d, 3),
        num(P.soba4d, 4), num(P.straga, 5), num(P.hodnik, 6),
        num(P.kupS, 7), num(P.kupN, 8)],
      schedule: [
        { n: 1, name: 'DNEVNI BORAVAK', area: area(P.boravak) },
        { n: 2, name: 'KUHINJA', area: area(P.kuhinja) },
        { n: 3, name: 'SOBA', area: area(P.soba3d) },
        { n: 4, name: 'SOBA', area: area(P.soba4d) },
        { n: 5, name: 'SOBA', area: area(P.straga) },
        { n: 6, name: 'HODNIK', area: area(P.hodnik) },
        { n: 7, name: 'KUPAONICA', area: area(P.kupS) },
        { n: 8, name: 'KUPAONICA', area: area(P.kupN) },
      ],
    });

    // On the spine, where the two rectangles were, and bigger than they were:
    // a drawing you cannot read is a rectangle with lines on it.
    //
    // Blender's y is three.js's −z, and the wall face is at 0.630 in the plan's
    // own frame — so the sheets face +z, which is into the big room.
    const WALL = -0.622;
    const hang = (tex, x0, x1, y0, y1) => {
      const frameMat = solidMaterial(new THREE.Color(0.145, 0.130, 0.110), {
        spec: 0.24, specPower: 40, emissive: VIK.glow, vcol: false,
      });
      const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const fr = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.030, h + 0.030, 0.020), frameMat);
      fr.position.set(cx, cy, WALL - 0.006);
      root.add(fr);
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: tex }));
      sheet.position.set(cx, cy, WALL + 0.006);
      root.add(sheet);
      for (const m of [fr, sheet]) { m.castShadow = false; m.receiveShadow = false; }
    };
    hang(priz, 1.40, 1.96, 4.40, 4.80);
    hang(kat, 2.10, 2.50, 4.32, 4.88);
  }

  // ── the fan ────────────────────────────────────────────────────────────────
  /**
   * A white pedestal fan beside the fridge, turning, all day.
   *
   * Same argument as the clock's hands, one room over: the thing that makes a
   * room read as lived in rather than as photographed is that something in it
   * is moving. The clock does it quietly at the far end; this does it loudly
   * in the middle, and every flat in Dalmatia has one in August.
   *
   * Built here and not in Blender for the reason the hands are: the payload is
   * one welded mesh per roof state, and a welded mesh cannot spin. That also
   * gets the cage for free — three torus rings and eight spokes is four lines
   * here and a small ordeal in bmesh.
   *
   * Local house metres. The wall the fridge stands against is +z, so the fan
   * faces −z, which is into the room.
   */
  const fan = { blades: null, head: null };
  {
    const FAN = { x: -1.52, z: 3.28, r: 0.195 };
    const white = solidMaterial(new THREE.Color(0.925, 0.920, 0.905), {
      spec: 0.30, specPower: 44, emissive: VIK.glow, vcol: false,
    });
    const grey = solidMaterial(new THREE.Color(0.735, 0.735, 0.730), {
      spec: 0.22, specPower: 30, emissive: VIK.glow, vcol: false,
    });
    // The blades are single sheets and a blade seen from behind is the same
    // blade, so this one is drawn both ways round.
    const vane = solidMaterial(new THREE.Color(0.760, 0.758, 0.750), {
      spec: 0.26, specPower: 34, emissive: VIK.glow, vcol: false,
      side: THREE.DoubleSide,
    });
    const g = new THREE.Group();
    g.position.set(FAN.x, plan.floor, FAN.z);
    root.add(g);

    const put = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = false; m.receiveShadow = false;
      return m;
    };
    // Four splayed tube legs and a hub, which is what the base of one of these
    // is — not a disc. The disc version read as a floor lamp.
    //
    // Each leg is aimed from the hub at its own foot, and it has to be: a
    // three.js cylinder stands on its own Y axis, so a leg 30 cm long tipped
    // by a tenth of a radian is not a splayed foot, it is a post. That is what
    // these were — four white pins standing upright on the tiles around the
    // column, with four loose white feet on the floor beyond them and nothing
    // joining the two. Built from its two endpoints instead, so the strut
    // reaches wherever the foot is and lies at whatever angle that takes.
    for (let i = 0; i < 4; i++) {
      const a = (i + 0.5) * Math.PI / 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const hub = new THREE.Vector3(ca * 0.045, 0.046, sa * 0.045);
      const toe = new THREE.Vector3(ca * 0.295, 0.016, sa * 0.295);
      const mid = hub.clone().add(toe).multiplyScalar(0.5);
      // Thin at the toe, thick at the hub, which is the way a pressed steel
      // leg is drawn: the cylinder's +Y end is the one the aim points at.
      const leg = put(new THREE.CylinderGeometry(0.009, 0.012,
        hub.distanceTo(toe), 7), white, mid.x, mid.y, mid.z);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        toe.clone().sub(hub).normalize());
      g.add(leg);
      g.add(put(new THREE.SphereGeometry(0.013, 6, 4), white,
        toe.x, toe.y, toe.z));
    }
    g.add(put(new THREE.CylinderGeometry(0.052, 0.058, 0.055, 12), white,
      0, 0.028, 0));
    // The column, in two diameters, because it telescopes and the joint is the
    // one detail that says which kind of fan this is.
    g.add(put(new THREE.CylinderGeometry(0.026, 0.026, 0.56, 10), white,
      0, 0.335, 0));
    g.add(put(new THREE.CylinderGeometry(0.030, 0.030, 0.045, 10), grey,
      0, 0.632, 0));
    g.add(put(new THREE.CylinderGeometry(0.017, 0.017, 0.44, 8), grey,
      0, 0.855, 0));

    // The head, which oscillates.
    const head = new THREE.Group();
    head.position.set(0, 1.09, 0);
    g.add(head);
    fan.head = head;
    // Motor housing, on the room side of the column.
    const motor = put(new THREE.CylinderGeometry(0.048, 0.052, 0.145, 12),
      white, 0, 0, -0.055);
    motor.rotation.x = Math.PI / 2;
    head.add(motor);
    head.add(put(new THREE.BoxGeometry(0.036, 0.052, 0.030), grey,
      0, 0.052, 0.006));   // the three speed buttons, as one block

    // The cage: a ring front and back, two more on the face, and eight spokes
    // between them. Thin enough to see the blades through, which is the point.
    for (const [rr, zz] of [[FAN.r, -0.058], [FAN.r, -0.185]]) {
      const t = put(new THREE.TorusGeometry(rr, 0.0055, 5, 30), white, 0, 0, zz);
      head.add(t);
    }
    for (const rr of [FAN.r * 0.68, FAN.r * 0.36]) {
      head.add(put(new THREE.TorusGeometry(rr, 0.0045, 5, 24), white, 0, 0, -0.183));
    }
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const sp = put(new THREE.CylinderGeometry(0.0035, 0.0035, FAN.r * 2, 4),
        white, 0, 0, -0.184);
      sp.rotation.z = a;
      head.add(sp);
    }
    head.add(put(new THREE.CylinderGeometry(0.030, 0.030, 0.016, 12), white,
      0, 0, -0.190));

    // And the blades. A sector of a disc with a twist on its own radius, which
    // is what a moulded fan blade is; three of them, because three is what is
    // in the photograph.
    const blades = new THREE.Group();
    blades.position.set(0, 0, -0.128);
    head.add(blades);
    fan.blades = blades;
    for (let i = 0; i < 3; i++) {
      const bg = new THREE.CircleGeometry(FAN.r * 0.86, 10, -0.60, 1.20);
      // Rotate about the blade's own radius: a flat sector is a paddle and a
      // pitched one is a fan.
      bg.rotateX(0.34);
      const b = new THREE.Mesh(bg, vane);
      b.rotation.z = i * (Math.PI * 2 / 3);
      b.castShadow = false; b.receiveShadow = false;
      blades.add(b);
    }
    for (const m of blades.children) m.frustumCulled = false;
    // The flex, trailing off across the tiles toward the wall behind.
    //
    // The same trap the legs were in, in the same object and for the same
    // reason: a three.js cylinder stands on its own Y axis, so a cable written
    // as one and never aimed is not a cable, it is a 60 cm grey pin standing
    // upright on the floor beside the fan. Aimed at where it is going, and
    // resting its own radius above the tile rather than a centimetre over it.
    {
      const from = new THREE.Vector3(0.05, 0.0035, 0.07);
      const to = new THREE.Vector3(-0.07, 0.0035, 0.44);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const flex = put(new THREE.CylinderGeometry(0.0035, 0.0035,
        from.distanceTo(to), 6), grey, mid.x, mid.y, mid.z);
      flex.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        to.clone().sub(from).normalize());
      g.add(flex);
    }
  }

  /**
   * How far Zagreb is ahead of UTC, in milliseconds.
   *
   * This clock hangs on a wall in Croatia. `new Date()` gives whatever the
   * machine under the player is set to, which for anybody not in this time zone
   * is a clock on a Dalmatian wall reading Eastern time — a small thing that is
   * wrong in exactly the way the rest of the model is trying not to be.
   *
   * CET in winter, CEST in summer, and the changeover rule is not worth
   * carrying: Intl knows it. Asked once and cached for ten minutes, which
   * catches a changeover soon enough and keeps the per-frame path down to three
   * multiplications. If the runtime has no time-zone data it falls back to the
   * machine clock rather than to nothing.
   */
  const ZG = (() => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Zagreb', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch { return null; }
  })();
  let tzOff = 0, tzAt = -1e12;
  function zagrebOffset(now) {
    if (!ZG) return -new Date(now).getTimezoneOffset() * 60000;
    if (now - tzAt < 600000) return tzOff;
    tzAt = now;
    try {
      const p = {};
      for (const q of ZG.formatToParts(new Date(now))) p[q.type] = q.value;
      const wall = Date.UTC(+p.year, +p.month - 1, +p.day,
        +p.hour % 24, +p.minute, +p.second);
      // To the minute: the parts carry no milliseconds, so the raw difference
      // is up to a second out and a second of error on a sweeping second hand
      // is the one error you could see.
      tzOff = Math.round((wall - now) / 60000) * 60000;
    } catch { tzOff = 0; }
    return tzOff;
  }

  /**
   * Wind it. Off the wall clock in Zagreb — see above.
   *
   * The second hand sweeps rather than ticks. A quartz movement ticks and this
   * one has a quartz movement in it, but a tick is one frame in sixty at any
   * frame rate worth having and a sweep is the thing you can actually see
   * moving out of the corner of your eye, which is the entire point of it.
   */
  function tickClock() {
    if (!clockHands.length) return;
    const now = Date.now();
    const d = new Date(now + zagrebOffset(now));
    const s = d.getUTCSeconds() + d.getUTCMilliseconds() / 1000;
    const m = d.getUTCMinutes() + s / 60;
    const h = (d.getUTCHours() % 12) + m / 60;
    clockHands[0].rotation.z = -TAU * h / 12;
    clockHands[1].rotation.z = -TAU * m / 60;
    clockHands[2].rotation.z = -TAU * s / 60;
    // And the fan, off the same clock. No dt here and none wanted: a wall
    // clock is a perfectly good phase for something that never stops, and it
    // means the blades are where they should be on the first frame rather than
    // wherever a frame counter had got to.
    tv.tick();
    if (fan.blades) {
      const t = now / 1000;
      fan.blades.rotation.z = -t * 14.5;
      // Oscillating, slowly, through about fifty degrees either side. This is
      // the part you notice from across the room without looking at it.
      fan.head.rotation.y = Math.sin(t * 0.22) * 0.88;
    }
  }
  tickClock();

  // ── where you may stand ────────────────────────────────────────────────────
  /**
   * House-local metres from a point in the locale. The house was placed with
   * its +X along +t and its terrace toward the sea, so this is a translation
   * and a sign flip and nothing else — which is the reason it was placed that
   * way rather than at whatever angle the lane happens to run.
   */
  const toHouse = (t, s) => [t - VIK.t, VIK.s - s];

  const inRect = (x, z, r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

  // The gallery rail's blocker, kept by reference so switching roofs can switch
  // it on and off. `field.blockers` is handed to the ground mode once and read
  // every frame from then on, so a blocker that changes has to change in place.
  let loftOnly = [];

  /**
   * The height of the floor under a point, or null if this point is not on the
   * house at all.
   *
   * Two floors now, which is what makes this more than a lookup. Walking in from
   * the promenade there is the flight — a ramp, because sixteen separate step
   * heights is a staircase you fall through — then the landing, then everything
   * inside the walls and out on the terrace, all one floor at +2.90. And when
   * the mezzanine is on there is a second set above it: the ladder-stair up the
   * east wall, and the deck at +5.45.
   *
   * The two overlap over most of the plan, so a point alone cannot say which
   * floor you are on. `yHint` — where you are standing now — settles it: take
   * the highest surface you could have got to from there, which is anything up
   * to a step-height above you, and if there is none, the lowest. That is the
   * same rule a stair enforces in life. Without it, walking under the deck
   * teleports you on to it.
   */
  function floorAt(t, s, yHint) {
    const [x, z] = toHouse(t, s);
    let lo = null, hi = null;
    const offer = (h) => {
      if (lo == null || h < lo) lo = h;
      if (yHint != null && h > yHint + 0.62) return;
      if (hi == null || h > hi) hi = h;
    };

    if (inRect(x, z, VIK.stair)) {
      const R = VIK.stair;
      // Never below the ground it stands on: the plinth is buried, so a ramp
      // run all the way down to `base` puts a step *down* at the foot of the
      // flight and you walk off the promenade into a dip before you climb.
      offer(Math.max(base + VIK.sink,
        base + VIK.floor * clamp((R.z1 - z) / (R.z1 - R.z0), 0, 1)));
    }
    if (inRect(x, z, VIK.landing)) offer(base + VIK.floor);
    if (inRect(x, z, plan.outer)) offer(base + VIK.floor);
    if (inRect(x, z, plan.rooms.terrace)) offer(base + VIK.floor);
    // And the storey below, which is a floor at the same (x, z) 2.90 m down.
    // Both are offered and `yHint` picks: there is no internal stair between
    // them, so from inside one you can never be within a step of the other and
    // the rule that got you here is the rule that keeps you here.
    if (inRect(x, z, plan.outer)) offer(base + plan.floorP);
    if (inRect(x, z, plan.rooms.terrace)) offer(base + plan.terP);

    if (parts.loft && parts.loft.visible) {
      if (inRect(x, z, VIK.loftDeck)) offer(base + VIK.deck);
      if (inRect(x, z, VIK.loftStair)) {
        const R = VIK.loftStair;
        const f = clamp((R.z1 - z) / (R.z1 - R.z0), 0, 1);
        offer(base + VIK.floor + (VIK.deck - VIK.floor) * f);
      }
    }
    if (hi != null) return hi;
    return lo;
  }

  /**
   * Is this point in the house — meaning: should you be a person here rather
   * than the half-metre-wide clearance the outdoors gets? See `GROUND.tight`.
   *
   * The zone is the whole plot and not the rooms, because the doorway is the
   * place it matters most: a body that swells back to 0.55 m on the doorstep
   * cannot get through a 0.90 m door, and the failure looks exactly like a
   * broken threshold rather than like a body that is too wide.
   */
  function tight(t, s) {
    const [x, z] = toHouse(t, s);
    return x > -5.2 && x < 6.2 && z > -5.6 && z < 7.6;
  }

  /**
   * Under this roof, in this room — not on the terrace, not on the stair.
   *
   * Narrower than `tight` on purpose. `tight` is "treat me as a person here"
   * and is generous, because being a person on the landing costs nothing. This
   * is "there is a ceiling over me", and it drives the near clip: the camera
   * fronts at 1.2 m, which is the right front clip for an aeroplane and is
   * nonsense for somebody standing in a 4 m room — every wall inside 1.2 m is
   * thrown away and you look through it at the sea. So it has to be true
   * exactly where there are walls and false one step outside them, or a doorway
   * becomes a place where the house flickers.
   *
   * Takes world y as well, because the terrace slab is the ground floor's
   * ceiling and the room is the storey above it: the same (t, s) is inside at
   * +2.90 and outside standing under the house.
   */
  /**
   * How close you are to this house's skin, 1 at it and 0 at `pad` metres off.
   *
   * A second, wider answer, and it exists for one job: the near clip. Being
   * *in* a room is the case everyone thinks of, but the front clip eats any
   * surface inside 1.2 m whichever side of it you are standing — so halfway up
   * the outside flight, 0.7 m off the east wall, the wall goes and you look
   * through the house at the furniture. On the landing, on the terrace against
   * the glass, in the cut sequence's own shot of the climb: same thing.
   *
   * `pad` is 2.2 and that is not a taste. The clip is ramped linearly on this
   * value, so near(d) = 0.06 + 0.518 d, and the wall is at d: the ramp has to
   * stay under the diagonal over the whole range or there is a band where it
   * still clips. 2.2 clears it everywhere outside 12 cm, and nothing can get
   * within 12 cm of a wall — `GROUND.tight` holds you off at 26.
   *
   * Deliberately *not* the same signal as `indoorsAt`. That one dims the room
   * and shuts the singing out, and neither of those is true standing on a
   * staircase in the sun.
   */
  /**
   * The top of the building as it currently stands — the ridge of whichever
   * roof is on, plus a little.
   *
   * Both of the tests below used to stop at floor + 3.6, which is a sensible
   * lid on a 2.40 m storey and is 1.4 m below the mezzanine's own ridge. So
   * standing on the deck you were *outside* by both of them: the room stopped
   * being dimmed, and the near clip went back to 1.2 m in a space where the
   * roof is within a metre of your eye almost everywhere. That is what "my head
   * is above the roof up there" was. Nobody's head was anywhere: the roof was
   * being thrown away by the front clip and the sky was behind it.
   */
  const roofTop = () => base + (parts.loft && parts.loft.visible
    ? plan.loftRidge : plan.ridge) + 0.35;

  function hull(t, s, y, pad = 2.2) {
    const [x, z] = toHouse(t, s);
    if (y != null && (y < base - 0.3 || y > roofTop())) return 0;
    const O = plan.outer;
    const dx = Math.max(O.x0 - x, x - O.x1, 0);
    const dz = Math.max(O.z0 - z, z - O.z1, 0);
    return clamp(1 - Math.hypot(dx, dz) / pad, 0, 1);
  }

  /**
   * The underside of the roof over a point, in world metres, or null where
   * there is nothing low enough to matter.
   *
   * Only the mezzanine has this problem and it has it badly. The deck is at
   * +2.55 over the floor and the new roof it sits under runs from 0.69 m of
   * clear height at the north wall to 2.40 m at the ridge — so a camera holding
   * a 1.66 m eye walks up there and its head goes out through the tiles about a
   * metre and a half short of the wall. Which is not a rendering fault: it is
   * the answer to the question the mezzanine is asking, delivered by putting
   * you outside the building instead of making you stoop.
   *
   * The ridge runs along the house's X at z = 0, so the underside is a straight
   * ramp in |z| off `loftRidge` at the sidecar's own pitch, less a soffit.
   */
  function headroom(t, s, y) {
    if (!parts.loft || !parts.loft.visible) return null;
    if (y == null || y < base + VIK.floor + 0.6) return null;
    const [x, z] = toHouse(t, s);
    if (!inRect(x, z, VIK.loftDeck) && !inRect(x, z, VIK.loftStair)) return null;
    const rise = Math.tan(plan.loftPitch * Math.PI / 180);
    return base + plan.loftRidge - Math.abs(z) * rise - 0.10;
  }

  function indoorsAt(t, s, y) {
    const [x, z] = toHouse(t, s);
    if (!inRect(x, z, plan.outer)) return 0;
    // Down to the ground floor now, not down to the upper one. The lower bound
    // used to be floor - 0.6, which put the whole prizemlje outside its own
    // house: undimmed, singing, and clipped at 1.2 m in rooms 2.7 m across.
    if (y != null && (y < base + plan.floorP - 0.6 || y > roofTop())) return 0;
    return 1;
  }

  /**
   * The walls, as boxes in the locale's own axes.
   *
   * Everything inside the house is already axis-aligned to the locale by the
   * placement above, so each one is a straight translation — no rotation field,
   * unlike the houses of the resort, which were laid out to their lanes.
   *
   * Nothing is shrunk. It used to be: every box had `GROUND.girth` taken back
   * off it, because 0.55 m added to each side of a 10 cm partition is a metre
   * and a half of solid and that seals a flat this size completely. That was
   * treating the symptom. The disease was the 0.55, and inside the house it is
   * now 0.26 — a person — so the boxes can be the walls, and a wall stops you a
   * shoulder's width from its face, which is what a wall does.
   *
   * `y0`/`y1` mark a blocker that only exists at one level. The gallery rail
   * round the mezzanine is one: it must stop you on the deck and must not be a
   * length of invisible fence across the living room three metres below it.
   */
  function blockers() {
    const out = [];
    const push = (r, extra) => {
      const b = {
        t: VIK.t + (r.x0 + r.x1) * 0.5,
        s: VIK.s - (r.z0 + r.z1) * 0.5,
        a: Math.max((r.x1 - r.x0) * 0.5, 0.02),
        c: Math.max((r.z1 - r.z0) * 0.5, 0.02),
        h: 6.0, y: base,
      };
      if (extra) Object.assign(b, extra);
      out.push(b);
      return b;
    };
    // The walls of the upper storey, and only of the upper storey. They used to
    // run from the ground to six metres up, which is fine until there is a
    // mezzanine over them: the deck is 15 cm above their ceiling and the whole
    // north half of it was fenced off by the bedroom partitions underneath —
    // you climbed the ladder-stair and could not walk to the beds. `ceil` keeps
    // them solid on the floor they belong to and at grade outside the house,
    // and lets the deck be a deck.
    for (const b of plan.blockers) push(b, { ceil: base + VIK.deck - 0.15,
      y0: base + VIK.floor - 0.60, y1: base + VIK.deck - 0.15 });
    // And the walls of the storey below, which stop at their own ceiling. Both
    // sets are banded: an unbanded wall is a wall on every floor at once, so
    // downstairs you would be fenced in by the partitions of the flat above
    // and upstairs by the ones below — and neither fence has anything drawn
    // where it stands.
    for (const b of plan.blockersP) push(b, {
      y0: base + plan.floorP - 0.60, y1: base + plan.floorP + plan.clearP });
    // The yard behind, which is at grade and on neither storey: the two
    // retaining walls and the wall the gate is in. Banded to grade for the
    // same reason everything else here is — unbanded they would also be a
    // fence across the terrace above them, which has no wall on that side.
    for (const b of (plan.blockersY || [])) push(b, {
      y0: base + plan.grade - 0.60, y1: base + plan.grade + 1.40 });
    // The terrace's three open edges — its railing, which is a real railing and
    // has to stop you the way the drawn one would. Without them the terrace is
    // a floor at +2.90 you can walk off, and worse, walk on to from the lane.
    //
    // Banded to the upper storey, because the same three rectangles at grade
    // are the edges of terrasa 8 — which has no railing, is flush with the
    // promenade, and is the way to the front door. Unbanded, these three were
    // an invisible fence round the only entrance to the flat.
    const T = plan.rooms.terrace;
    const rail = { y0: base + VIK.floor - 0.60, y1: base + VIK.floor + 2.20 };
    push({ x0: T.x0, x1: T.x1, z0: T.z1 - 0.08, z1: T.z1 }, rail);
    push({ x0: T.x0, x1: T.x0 + 0.08, z0: T.z0, z1: T.z1 }, rail);
    push({ x0: T.x1 - 0.08, x1: T.x1, z0: T.z0, z1: T.z1 }, rail);
    // The open side of the flight and of the landing, so you go up it rather
    // than off it, and the rail across the head of the landing.
    push({ x0: VIK.stair.x1 - 0.06, x1: VIK.stair.x1,
           z0: VIK.landing.z0, z1: VIK.stair.z1 + 0.5 });
    push({ x0: VIK.landing.x0, x1: VIK.landing.x1,
           z0: VIK.landing.z0 - 0.08, z1: VIK.landing.z0 });
    // The mezzanine's own three sides and its gallery rail, which are there
    // only when the mezzanine is. Its own, because the deck runs the full
    // footprint — the storey below is set back 70 cm on the west and the deck
    // is not — so nothing underneath it describes its edges.
    const D = VIK.loftDeck;
    const lvl = { off: true, y0: base + VIK.deck - 0.60,
      y1: base + VIK.deck + 2.70 };
    loftOnly = [
      push({ x0: D.x0 - 0.12, x1: D.x0, z0: D.z0 - 0.12, z1: D.z1 }, lvl),
      // The east side stops short of the stairwell rather than running the full
      // depth of the deck. It has to: a blocker is a wall plus your own girth,
      // so this one reaches 26 cm further into the room than it looks, and the
      // gallery rail reaches 26 cm out of its own end the same way. Run both to
      // their drawn lengths and the two invisible margins meet across the head
      // of the stair, leaving a slot half a metre wide to find in the dark. You
      // could go down it — dead centre, at the second attempt — and every other
      // approach stopped you on nothing at the top step. There is no drop to
      // fence off alongside the stair anyway; that is what the stair is.
      push({ x0: D.x1, x1: D.x1 + 0.12, z0: D.z0 - 0.12,
             z1: VIK.loftStair.z0 - 0.10 }, lvl),
      push({ x0: D.x0 - 0.12, x1: D.x1 + 0.12, z0: D.z0 - 0.12, z1: D.z0 }, lvl),
      // The rail, and its gap at the east end is the stairwell. The number is
      // where the drawn balustrade stops, less a girth — because the barrier
      // ends a girth *beyond* the box, and matching the box to the drawn rail
      // instead puts 43 cm of invisible fence across the opening you can see.
      // You walk to the gap, stop on nothing, and conclude the stair is broken,
      // which is what happened. A fence you can see through and cannot pass is
      // worse than either kind of fence.
      push({ x0: D.x0, x1: D.x1 - 1.16 - 0.26, z0: 1.14, z1: 1.26 }, lvl),
    ];
    // And the open side of the ladder-stair itself, which the note above got
    // wrong. "There is no drop to fence off alongside the stair" is true of its
    // east side, where the wall is. Its west side is open into the room, and
    // one sideways step off it puts you through a flight of stairs: measured at
    // x = 2.18, two treads up, the floor under you goes from 5.57 to 5.01
    // without a sound and you carry on walking across the living room. It is
    // the same fall the terrace had before it got its railing, in a place
    // nobody thinks to test because you climb a stair by walking *up* it.
    //
    // Not one box, because the flight rises 2.55 m in 2.24 and a full-height
    // fence along it would also be a fence along the living room floor beside
    // it. A real stair is only in your way where it is low enough to be: four
    // segments, each banded to the treads it stands beside, so the bottom step
    // stops you and the top of the flight is something you walk under. That is
    // the stringer and the balustrade, which is what is drawn there.
    {
      const R = VIK.loftStair;
      const seg = 4;
      const run = (R.z1 - R.z0) / seg;
      const rise = VIK.deck - VIK.floor;
      for (let i = 0; i < seg; i++) {
        const zHi = R.z1 - i * run;              // the low end: nearest the room
        const zLo = R.z1 - (i + 1) * run;        // the high end: nearest the deck
        const hLo = base + VIK.floor + rise * (R.z1 - zHi) / (R.z1 - R.z0);
        const hHi = base + VIK.floor + rise * (R.z1 - zLo) / (R.z1 - R.z0);
        loftOnly.push(push({ x0: R.x0 - 0.12, x1: R.x0, z0: zLo, z1: zHi },
          { off: true, y0: hLo - 0.45, y1: hHi + 0.45 }));
      }
    }
    return out;
  }

  const world = (x, z) => {
    const w = field.toWorld(VIK.t + x, VIK.s - z);
    return [w[0], w[2]];
  };

  return {
    root, parts, plan, base, yaw,
    floorAt, blockers, tight, indoorsAt, hull, headroom, tick: tickClock,
    /** The television: where it is in world metres, and the knock. */
    tv: {
      at: () => { const [wx, wz] = world(tv.at[0], tv.at[2]);
        return [wx, base + tv.at[1], wz]; },
      knock: () => tv.knock(),
      page: () => tv.page(),
      live: () => tv.live(),
    },
    /** 'now' | 'loft' — which roof is on. The rooms below do not change. */
    roof(which) {
      for (const k of ['roof', 'roof_glass', 'roof_sheer']) {
        if (parts[k]) parts[k].visible = which !== 'loft';
      }
      for (const k of ['loft', 'loft_glass', 'loft_sheer']) {
        if (parts[k]) parts[k].visible = which === 'loft';
      }
      for (const b of loftOnly) b.off = which !== 'loft';
      return which;
    },
    get roofNow() { return parts.loft && parts.loft.visible ? 'loft' : 'now'; },
    /** Any house-local three.js point, in world metres. */
    at(p) {
      const [wx, wz] = world(p[0], p[2]);
      return [wx, base + p[1], wz];
    },
    /** An anchor from the sidecar, in world metres. */
    anchor(name) {
      const a = plan.anchors[name];
      if (!a) return null;
      const [wx, wz] = world(a[0], a[2]);
      return [wx, base + a[1], wz];
    },
    /** Debug: the locale station of an anchor, which is what putShow wants. */
    station(name) {
      const a = plan.anchors[name];
      return a ? [VIK.t + a[0], VIK.s - a[2]] : null;
    },
    stats: () => ({
      at: [+VIK.t.toFixed(1), +VIK.s.toFixed(1)],
      yaw: +yaw.toFixed(3),
      base: +base.toFixed(2),
      floor: +(base + VIK.floor).toFixed(2),
      roof: parts.loft && parts.loft.visible ? 'loft' : 'now',
      tris: Object.values(parts).reduce(
        (n, m) => n + (m.visible ? m.geometry.index.count / 3 : 0), 0),
      rooms: Object.keys(plan.rooms),
    }),
  };
}
