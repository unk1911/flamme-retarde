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
  // `t` runs south-east along the shore. 232 is a stride west of the mole at
  // 258, on the last of the open frontage before the boardwalk starts — which
  // is where the real one stands and is a great deal more useful than the 24 it
  // was at, three hundred metres up an empty beach from anything.
  //
  // Its own +X runs along +t and its terrace faces the sea. At s 25.4 the
  // terrace front lands at 19.3 m — two metres behind the seaward face the front
  // row used to occupy, which is exactly the line the real one stands on.
  t: 232.0,
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
  // And the riser, which `floorAt` needs and did not have. `ST_RISE` in
  // tools/blender/vikendica.py, where the flight is drawn: seventeen of them,
  // 0.17 each, 2.89 of the storey's 2.90. See the note in `floorAt` about what
  // the ramp between the two ends of them has to run THROUGH.
  riser: 0.17,

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

  // How near the roof is drawn as laid tiles (1.576.0) rather than as the
  // flat slab under them. A 21 cm ripple in courses is the roof from the road;
  // from further than this it is a moiré, and the plain slab makes no claim.
  // At sixty metres a tile pitch is still four pixels across at 1280.
  kupeNear: 60,
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
  // World to house-local, for the one thing the shell's shader needs to know
  // about where a fragment is: inside the walls or out. See `mat`.
  root.updateMatrixWorld(true);
  const vikInv = { value: root.matrixWorld.clone().invert() };

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
    //
    // ONLY INSIDE THE WALLS (1.576.0). The roll was applied to every downward
    // face in the payload, so outdoors the underside of the terrace slab — the
    // porch ceiling of the flat below — and the eave soffits were turned to
    // face the sky, took the sun on their backs, were lifted a third, and came
    // out as the brightest surfaces on the house: a white panel glowing over a
    // wall in its shade, at every hour. Outside the 6.78 x 7.73 footprint a
    // soffit is a soffit and takes the ground bounce like any other. Only a
    // soffit, though — a face turned more than 32 degrees off straight down:
    // the blades of every shutter on the house face 45 degrees down, and
    // without the roll they took the karst's ochre bounce and the white
    // grilje came out as brown ones.
    uniforms: { uVikInv: vikInv },
    decl: 'uniform mat4 uVikInv;',
    body: `base *= vVCol;
      vec3 vikP = (uVikInv * vec4(vWorld, 1.0)).xyz;
      float vikIn = step(abs(vikP.x), 3.40) * step(abs(vikP.z), 3.875);
      float dn = smoothstep(0.0, -0.55, n.y) * max(vikIn, step(-0.85, n.y));
      n = normalize(mix(n, vec3(n.x, 0.30, n.z), dn));
      base *= 1.0 + 0.34 * dn;`,
  });

  // The renovation's roof, drawn with the same roll and one correction to it.
  //
  // The roll turns the normal, and the sun term is computed off the turned
  // normal, so every face it touches is lit by the sun as if it faced the sky.
  // The shadow map cannot take that back: casters are written back face first,
  // so the depth in the map over a roof IS its underside, and an underside is
  // always on the lit side of its own bias. Under the loft's 25 degree
  // boarding, its rafters and its ridge beam that was the whole picture: every
  // downward face of the roof took full sun, lifted a third, and the roof came
  // out one flat glowing yellow with no shade anywhere in it (Misha, 2 Oct:
  // "the shadows"). Measured at 11:00 looking up from the big room, a board
  // between two rafters went from (255,255,208), which is clipped, to
  // (142,125,83).
  //
  // So here the roll keeps its job, which is the ambient — a soffit indoors
  // samples the sky and not the karst — and the lift, and the sun goes back to
  // what the face's own normal says, which for anything facing down is none.
  // The shade between the rafters is in the vertex colours. The one exception
  // is what the roll was written for, a flat white ceiling: the deck's soffit
  // is the ceiling of the rooms under it and has to match the ceilings beside
  // it, whose brightness has that leak in it. "Flat and white" is told from
  // the normal and the albedo, since one material draws the whole blob: the
  // ridge beam's underside is flat too, and it glowed until it was excluded.
  const loftMat = solidMaterial(0xffffff, {
    spec: 0.05,
    specPower: 30,
    emissive: VIK.glow,
    uniforms: { uVikInv: vikInv },
    decl: 'uniform mat4 uVikInv;',
    body: `base *= vVCol;
      vec3 vikP = (uVikInv * vec4(vWorld, 1.0)).xyz;
      float vikIn = step(abs(vikP.x), 3.40) * step(abs(vikP.z), 3.875);
      float dn = smoothstep(0.0, -0.55, n.y) * max(vikIn, step(-0.85, n.y));
      vec3 nGeo = n;
      float ceilK = smoothstep(-0.95, -0.99, n.y)
        * smoothstep(0.80, 0.86, min(base.r, min(base.g, base.b)));
      float slopeDn = dn * (1.0 - ceilK);
      n = normalize(mix(n, vec3(n.x, 0.30, n.z), dn));
      base *= 1.0 + 0.34 * dn;`,
    lit: `float ndlGeo = max(dot(nGeo, uSunDir), 0.0);
      col -= slopeDn * base * uSunColor * uSunI * max(ndl - ndlGeo, 0.0)
        * sh * INV_PI;
      col -= slopeDn * uSunColor * spec * sh * max(0.0,
        pow(max(dot(n, hv), 0.0), uSpecPower)
        - pow(max(dot(nGeo, hv), 0.0), uSpecPower));`,
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

  // The bojler's jacket, which is stove enamel: the one painted metal in the
  // house with a gloss on it. On the plaster material its 96-sided curve
  // shaded like a white column of render; the highlight running down it is
  // what says steel. Its own value is the plaster's — ENAMEL_W is chosen in
  // the Blender file to sit between the tile and the machine under it and the
  // emissive must not move it out of that slot — so only the gloss differs.
  const enamelMat = solidMaterial(0xffffff, {
    spec: 0.20, specPower: 70, emissive: VIK.glow + 0.04,
    body: 'base *= vVCol;',
  });

  // The kupe — the roof's tiles as laid, out of `_kupe` in the Blender file —
  // lit exactly as the slab under them is, and simply not there past
  // `VIK.kupeNear` from the eye: the slab is 3.5 cm under the troughs and takes
  // over without a seam. A discard and not a visibility switch, so it is right
  // for every camera there is, the aeroplane's included.
  const kupeMat = solidMaterial(0xffffff, {
    spec: 0.05,
    specPower: 30,
    emissive: VIK.glow,
    body: `if (length(vWorld - uCamPos) > ${VIK.kupeNear.toFixed(1)}) discard;
      base *= vVCol;`,
  });

  const parts = {};
  const soft = (k) => k.endsWith('_glass') || k.endsWith('_sheer');
  for (const key of ['shell', 'roof', 'loft',
                     'shell_glass', 'roof_glass', 'loft_glass',
                     'shell_sheer', 'roof_sheer', 'loft_sheer',
                     'shell_ware', 'shell_enamel', 'roof_kupe', 'loft_kupe']) {
    const b64 = PAYLOAD['vikendica_' + key + '_fr3d'];
    if (!b64) { if (!soft(key)) console.warn('no vikendica payload:', key); continue; }
    try {
      const geo = readFR3D(await inflateBinary(b64));
      const mesh = new THREE.Mesh(geo,
        key.endsWith('_sheer') ? sheerMat : key.endsWith('_glass') ? glassMat
          : key.endsWith('_ware') ? wareMat
            : key.endsWith('_enamel') ? enamelMat
              : key.endsWith('_kupe') ? kupeMat
                : key === 'loft' ? loftMat : mat);
      // The kupe cast nothing the slab under them does not: their own laps
      // are finer than a texel of the sun's map.
      mesh.castShadow = !soft(key) && !key.endsWith('_kupe');
      mesh.receiveShadow = true;
      if (soft(key)) mesh.renderOrder = 3;
      root.add(mesh);
      parts[key] = mesh;
    } catch (e) {
      console.warn('vikendica failed:', key, e.message);
    }
  }
  for (const k of ['loft', 'loft_glass', 'loft_sheer', 'loft_kupe']) {
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

    // ── AND THE NEWS IS REAL WHEN IT CAN BE ─────────────────────────────────
    //
    // Misha, 29 Sep 2026: *"the btc, ltc prices are current but the news
    // stories are either fake or stuck on some old news stories from months
    // ago, can u make sure the TV shows stories from *actual* more current
    // local sibenik/jadrija/croatian news?"*. They were fake: `HEAD` above is
    // this world's sixth of August, written by hand, and it was all the set
    // ever showed, because `/baye/world` never sent a headline to the page.
    //
    // It does now — three slots off Brave News, the last day's, Croatian
    // outlets only, each with its source and its time (`_news` in
    // server/baye/baye.py). With a session the set asks once and then every
    // twenty minutes, which is how often the service refreshes anyway, and
    // shows those: the town first, then the country and the world in turn,
    // and the subline is the outlet and how long ago, worked out when it is
    // drawn so "prije 2 h" is still true an hour later. Signed out or offline
    // the baked sixth of August stands, which is the fiction the rest of the
    // room is in and was never claiming to be today's.
    let news = null;            // [{ t, src, ts }] in the order they are shown
    let newsCrawl = null;
    let newsAt = -1e12;         // Date.now() of the last ask
    let newsBusy = false;
    const NEWS = { every: 20 * 60e3, retry: 5 * 60e3, keep: 12 };

    function newsAsk() {
      if (newsBusy || typeof fetch !== 'function') return;
      if (typeof AUTH === 'undefined' || !AUTH.baye) return;
      const now = Date.now();
      if (now - newsAt < (news ? NEWS.every : NEWS.retry)) return;
      newsAt = now;
      newsBusy = true;
      fetch(AUTH.baye + '/world', { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && d.ok) newsTake(d.news); })
        .catch(() => {})
        .then(() => { newsBusy = false; });
    }

    /** Local first, then national and world in turn: L N L W N L W … */
    function newsTake(n) {
      if (!n) return;
      const pick = (k) => (Array.isArray(n[k]) ? n[k] : [])
        .filter((x) => x && typeof x.t === 'string' && x.t.length > 8);
      const q = { L: pick('local'), N: pick('national'), W: pick('world') };
      const out = [];
      const seen = new Set();
      const ORDER = 'LNLWN';
      for (let i = 0; out.length < NEWS.keep && (q.L.length || q.N.length
        || q.W.length); i++) {
        const k = ORDER[i % ORDER.length];
        const x = q[k].shift() || q.L.shift() || q.N.shift() || q.W.shift();
        if (!x) break;
        const key = x.t.toLowerCase().slice(0, 40);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ t: x.t, src: String(x.src || ''), ts: +x.ts || 0 });
      }
      if (!out.length) return;
      news = out;
      headI = 0;
      // The crawl carries what the big line is not showing right now: the
      // rest of the country and the world, short.
      const rest = pick('national').concat(pick('world')).slice(0, 8)
        .map((x) => x.t.toUpperCase());
      newsCrawl = rest.length ? rest.join('   ·   ') + '   ·   ' : null;
    }

    /** "prije 2 h", off the story's own time and the clock on the wall. */
    function newsAgo(ts) {
      if (!ts) return '';
      const m = Math.max(0, (Date.now() / 1000 - ts) / 60);
      if (m < 2) return 'upravo';
      if (m < 60) return 'prije ' + Math.round(m) + ' min';
      const h = m / 60;
      if (h < 24) return 'prije ' + Math.round(h) + ' h';
      const d = Math.round(h / 24);
      return d <= 1 ? 'jučer' : 'prije ' + d + ' dana';
    }

    /**
     * The headline, in the biggest type that fits the space the baked ones
     * had. A baked headline is three or four words and a real one is often
     * fifteen, so the size steps down before the line count runs out, and
     * only past the smallest does it lose its tail to an ellipsis.
     */
    function headFit(text, top, bottom) {
      const W = TV.w - 60;
      for (const [px, gap] of [[40, 46], [34, 40], [29, 34], [25, 30]]) {
        g.font = face(px, 'bold');
        const lines = [];
        let line = '';
        for (const wd of text.split(' ')) {
          const test = line ? line + ' ' + wd : wd;
          if (g.measureText(test).width > W && line) { lines.push(line); line = wd; } else line = test;
        }
        if (line) lines.push(line);
        const room = Math.floor((bottom - top) / gap) + 1;
        if (lines.length <= room || px === 25) {
          if (lines.length > room) {
            lines.length = room;
            let l = lines[room - 1];
            while (l.length > 1 && g.measureText(l + '…').width > W) l = l.slice(0, -1);
            lines[room - 1] = l.replace(/[\s,.:;–-]+$/, '') + '…';
          }
          return { lines, gap };
        }
      }
      return { lines: [text], gap: 46 };
    }

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
      const text = newsCrawl || CRAWL;
      const w = g.measureText(text).width;
      let x = 104 - ((t * 74) % w);
      while (x < TV.w) { g.fillText(text, x, y + 28); x += w; }
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
      const live = news && news.length ? news[headI % news.length] : null;
      const h = live
        ? [live.t.toUpperCase(),
          [live.src, newsAgo(live.ts)].filter(Boolean).join(' · ')]
        : HEAD[headI % HEAD.length];
      g.fillStyle = '#e8eef7';
      g.textAlign = 'left';
      // Wrapped by hand, because two lines of 40 px is the whole design --
      // and stepped down when a real headline is longer than that. The
      // bottom is the subline's floor: the lamp sits at TV.h - 118.
      const fit = headFit(h[0], 168, 360);
      let y = 168;
      for (let i = 0; i < fit.lines.length; i++) {
        if (i) y += fit.gap;
        g.fillText(fit.lines[i], 30, y);
      }
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
        newsAsk();
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
      /** What the news page is showing, for a probe: live or baked, and the
       *  line up now. `feed` hands it a `/world` news object directly, so a
       *  headless check can draw real-shaped headlines without a session. */
      news: () => ({ live: !!news, n: news ? news.length : 0,
        head: news && news.length ? news[headI % news.length].t
          : HEAD[headI % HEAD.length][0] }),
      feed: (n) => { newsTake(n); paint(Date.now()); },
      /** The screen as a PNG data URL, so a probe can look at the picture
       *  itself rather than at a photograph of the room it is in. */
      png: () => { paint(Date.now()); return cv.toDataURL('image/png'); },
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

  // ── the two drawings on the spine, and the poster on the east wall ─────────
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
    //
    // ── THE TWO WALLS THINGS HANG ON, AND WHY THE SECOND ONE IS MEASURED ──
    //
    // `SPINE` is the partition between the big room and the two bedrooms, whose
    // face this file already carried at 0.622. `EAST` is the long blank wall on
    // the right of the stair-head door, and its number is NOT off the plan:
    // `plan.blockers` puts that wall's inner face at x 3.19 and the GEOMETRY
    // puts it at 3.150. The blockers are the walk volume, deliberately fat — a
    // blocker exists to stop you walking into a wall and is 4 cm clear of it on
    // purpose — so hanging off one buries the frame 40 mm inside the render.
    // Raycast in the ROOT's own frame at 24 points across the run: 3.150
    // everywhere from z 0.80 to 3.55 and from 0.70 to 2.10 above the floor, and
    // 3.154 on the last row before the wall head.
    //
    // In the root's frame and not `at()`'s, which is the other half of that
    // measurement. `at()` goes through the shore field, and the shore field is a
    // CURVE; `root` is a rigid group with one yaw. Over the 2.9 m from the
    // middle of the room to this wall the two disagree by 27 mm, so the first
    // pass of this raycast reported the wall at 3.217 and would have hung the
    // poster in mid-air.
    const SPINE = { yaw: 0, p: (a, y) => [a, y, -0.622] };
    const EAST = { yaw: -Math.PI / 2, p: (a, y) => [3.150, y, a] };

    // One frame for everything on a wall in this house: dark stained wood, a
    // hard small highlight, and the same `VIK.glow` the plaster gets.
    const frameMat = solidMaterial(new THREE.Color(0.145, 0.130, 0.110), {
      spec: 0.24, specPower: 40, emissive: VIK.glow, vcol: false,
    });

    /**
     * Hang a framed sheet on a wall.
     *
     * `a0..a1` is its extent ALONG the wall and `y0..y1` its height, both in
     * house metres — x on the spine, z on the east wall, which is the whole
     * reason this goes in a group rather than setting three components by hand.
     * The group is stood on the wall face with `wall.yaw`, so everything below
     * is written once in the sheet's own frame: +z is the room, and the only
     * numbers left are how far off the wall each piece stands.
     *
     * `tex` is the picture; `o.mat` replaces the material that carries it, and
     * a caller that supplies one hands the same texture over twice on purpose
     * — the first argument says what the sheet IS whichever shader draws it.
     *
     * Two kinds of frame, and the difference is not decoration:
     *
     *  - the drawings get a solid box behind them, which is what they have
     *    always had. A sheet of paper 2 mm in front of a board is fine at half
     *    a metre across and in a corner of the room nobody stands in.
     *  - the poster gets FOUR BARS AND A HOLE. Same call the bar poster in the
     *    kabina makes and for the reason written there: a backing board puts a
     *    second surface a couple of millimetres behind the paper, and two
     *    millimetres over a metre of diagonal is half a degree — the first cut
     *    of that one buried half the print in its own frame. With nothing behind
     *    it the only thing the paper can argue with is the wall, 20 mm back,
     *    which is rule 5 with a factor of six in hand.
     */
    const hang = (tex, a0, a1, y0, y1, o = {}) => {
      const wall = o.wall || SPINE;
      const w = a1 - a0, h = y1 - y0;
      const g = new THREE.Group();
      const p = wall.p((a0 + a1) / 2, (y0 + y1) / 2);
      g.position.set(p[0], p[1], p[2]);
      g.rotation.y = wall.yaw;
      root.add(g);
      const put = (m, x, y, z) => {
        m.position.set(x, y, z);
        m.castShadow = false; m.receiveShadow = false;
        g.add(m);
      };
      if (o.open) {
        // 28 mm of moulding, 24 mm deep, its back 8 mm off the render so the
        // frame reads as hung and not as printed on. Top and bottom run the
        // full width and the stiles fit between them, which is a butt joint and
        // not two coplanar front faces fighting over the corners.
        const b = 0.028, d = 0.024, zc = 0.008 + d / 2;
        const bar = (bw, bh, bx, by) =>
          put(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d), frameMat),
            bx, by, zc);
        bar(w + 2 * b, b, 0, (h + b) / 2);
        bar(w + 2 * b, b, 0, -(h + b) / 2);
        bar(b, h, -(w + b) / 2, 0);
        bar(b, h, (w + b) / 2, 0);
      } else {
        put(new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.030, h + 0.030, 0.020), frameMat),
        0, 0, -0.006);
      }
      // The paper. `PlaneGeometry` faces its own +z and the group's +z is the
      // room, so this is the right way round on either wall without a flip —
      // and getting that backwards is a poster that is simply not there.
      put(new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        o.mat || new THREE.MeshBasicMaterial({ map: tex })),
      0, 0, o.open ? 0.020 : 0.006);
      return g;
    };
    hang(priz, 1.40, 1.96, 4.40, 4.80);
    hang(kat, 2.10, 2.50, 4.32, 4.88);

    // ── BUCKETEERS OF AMERICA, on the east wall ──────────────────────────────
    /**
     * The poster on the wall to the right of the stair-head door.
     *
     * It is a supplied image and not a canvas — the one piece of artwork in
     * this game that is neither drawn by this file nor a photograph of a real
     * place — so rule 12 is satisfied by REPRODUCING it rather than by
     * retyping its wording into a 2d context. It goes through `build/payload`
     * the way every other baked asset does, and `build.py` turns it into a
     * data URI, so the finished page still opens off the filesystem.
     *
     * 512×768 and 67 KB of WebP, down from the 1024×1536 it came in at, which
     * costs the bundle 90 KB of base64 out of 28 MB. Sized against the job it
     * has and MEASURED off the frames: in a 1200-px window the paper is 120 px
     * across from where you stand in this room, and 279 px with your nose on
     * the 1.2 m near clip, which is as close as the camera is ever allowed to
     * get. On a 1080p panel that is 192 px standing and 446 px with your nose
     * on it, so 512 is two and a half times what the room ever asks for and
     * one-to-one at the extreme; on a 4K panel the extreme wants 893 and gets
     * 512, which is a softness you have to walk up to the wall to find. 1024
     * would be four times the bytes to serve only that walk.
     *
     * ── AND THE COLOUR SPACE, WHICH IS THE WHOLE JOB ─────────────────────────
     *
     * NOT `SRGBColorSpace`. Everywhere else in this game that line is correct
     * and here it is the bug, and the difference is which end of the pipe the
     * number comes from.
     *
     * A canvas texture is written by this code in css bytes and read by the
     * shader as an albedo, so it needs the decode to land back on the number
     * the file meant — that is what the `paint()` helper in `brodMural` exists
     * for and what the note over it records. A SHIPPED IMAGE is already the
     * answer: its bytes ARE display-referred, and `solidFragment` writes its
     * colour straight to the framebuffer in display space, tone mapping and all
     * left off. Decode it and you have applied a transfer function that nothing
     * downstream undoes.
     *
     * MEASURED, by building it BOTH WAYS and photographing the same frame from
     * the same place in the same light, then reading the rendered sheet back
     * against the file it was made from — rendered over source, per region:
     *
     *                              undecoded    tagged SRGB
     *     whole sheet, luma          0.947         0.574
     *     the deep blue foot band    0.915         0.304
     *     the headline and paper     0.952         0.694
     *
     * and the band itself, (20, 64, 106) in the file, comes back (16, 59, 103)
     * undecoded and (9, 18, 40) decoded. That is a navy band rendered as a
     * black one, three times too dark, on a sheet whose whole bottom eighth it
     * is. This is the failure the gull and the fish hid for three builds by
     * being near-white — at the top of the tonal range the error is a third
     * and at the bottom it is a factor of three, and a poster is the one kind
     * of artwork that lives at both ends at once.
     *
     * So the texture is left undecoded and the shipped file is left alone. The
     * alternative — pre-encoding the artwork so that a decode lands back on it —
     * is the same arithmetic done twice and stores a washed-out image that
     * looks broken in any viewer, and it would put the lossy WebP quantiser to
     * work in a stretched space.
     *
     * `emissive` is the plaster's own `VIK.glow` and nothing more. The bar
     * poster in the kabina takes 0.46 because that room is lit by a television;
     * this wall renders at (190, 203, 215) in the middle of an August
     * afternoon, and a print that has to out-glow that is a lightbox.
     */
    const boaTex = (() => {
      const img = new Image();
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.NoColorSpace;
      tex.anisotropy = 8;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      // The payload arrives as a data URI, so the decode is a microtask and
      // not a request — but it is still not synchronous, and a texture whose
      // image has no width yet uploads as nothing at all.
      img.onload = () => { tex.needsUpdate = true; };
      img.src = PAYLOAD.boa_poster;
      return tex;
    })();

    // 0.600 × 0.900, which is the file's own 1024:1536 exactly. Bigger than
    // the 0.500 × 0.750 it was: between A1 (0.594 × 0.841) and B1 (0.700 ×
    // 1.000) now rather than between A2 and B2 — a printed public-service
    // sheet at the size a hallway actually gets one, and still not a hoarding.
    //
    // MOVED LEFT AND ENLARGED, on the asking, and those two turn out to be the
    // same move. Left on this wall is −z, and that is established against
    // something that is not the photograph, because a photograph read on its
    // own has put a parasol on the wrong end of a building twice: the wall
    // faces −x, so a camera that can see this poster looks along +x, and with
    // up = +y the screen's right hand is f × u = +z. Then checked in the
    // engine — stood at the `living` anchor with the yaw computed off
    // `root.rotation.y` rather than off the frame, the doorway that is at
    // frame left in his shot comes out as the FRONT DOOR at z 0.2…0.73, with
    // the outside flight's landing and railing beyond it, and the terrace at
    // z 3.865 and up comes out past the right edge. Left is towards the door.
    //
    // AND THAT IS WHY IT CAN NOW STAY UP UNDER THE LOFT, which the note this
    // replaces said it could not. That note was right that the ladder-stair
    // runs up this wall and wrong about which way round it runs. It climbs
    // TOWARDS the door: `floorAt` interpolates f from z1 down to z0 and the
    // blocker band is banded the same way, so the FOOT of the flight is at
    // z 3.14 by the terrace corner and the HEAD is at z 0.90 by the door — not
    // the other way about, and the 0.17 m and 0.48 m in the old note are the
    // right gaps against the wrong ends. Every tread agrees: measured in loft
    // mode the tread tops step 2.34, 2.13, 1.91 … 0.43, 0.21 as z goes 1.2 to
    // 3.1, which is a flight descending as z grows.
    //
    // So the wall under it is not a 2.24 m write-off. It is a triangle, and the
    // triangle is deepest at the door end — which is exactly the end he asked
    // for. Cast upwards at x 3.118, the plane the frame's own front stands in:
    //
    //     z 0.70 … 0.99   the mezzanine deck, soffit at 2.39 off the floor
    //     z 1.00 … 3.14   the flight's wall string, underside 3.528 − 1.180 z
    //
    // straight, to the millimetre, over every sample; the deck binds to the
    // left of z 0.964 and the string to the right of it. And the old note's
    // "runs back to the render at 3.15" is out by 31 mm — string and treads
    // both stop between x 3.119 and 3.121. Which does NOT make the old poster
    // innocent: its frame front stands at 3.118, so the two overlapped by
    // something like 2 mm. It was never a picture buried in a staircase, it
    // was a picture grazing one, and rule 5 asks for 3.
    //
    // Paper at z 0.860…1.460 and 0.760…1.660 off the floor; the frame's outer
    // 0.656 × 0.956 of it at z 0.832…1.488 and 0.732…1.688. Clearances:
    //
    //     frame left to the door lining at z 0.730             0.102
    //     frame top to the string underside (1.772 at z 1.488) 0.084
    //     frame top to the deck soffit over its left-hand end  0.70
    //     frame back at x 3.142 to the render at 3.150         0.008
    //
    // the last of which is the old rule-5 number and is untouched.
    //
    // WHAT IT COST is 0.34 m of height, and that is the whole three-way trade.
    // The centre was at 1.55, which put the headline at a standing eye (this
    // game's own is 1.66); it is at 1.21 now, with the top edge at the eye
    // instead and the bottom 0.76 off the floor — still clear of anything that
    // could ever stand there, since nothing does on this wall. There is no way
    // round it: the string falls 1.18 in 1, so with the left-hand end pinned
    // 0.102 off the door lining every extra 100 mm of paper width drives the
    // top edge 118 mm further down. Holding 1.55 m of centre instead would have
    // allowed a sheet 0.424 wide — SMALLER than the one he asked to have made
    // bigger. Rejected with it: hanging it above the flight rather than under,
    // which is the same triangle mirrored and sits at the terrace end, the one
    // direction the arrow did not point.
    //
    // It is no longer registered `nowOnly`, and it was the only thing that ever
    // was, so that list and the loop `roof()` ran over it have gone with it. A
    // mechanism with no members is a paragraph of comment describing something
    // that does not happen; `loftOnly` down in the blockers still carries the
    // same idea the other way round if anything ever needs this one back.
    hang(boaTex, 0.860, 1.460, 3.660, 4.560, {
      wall: EAST,
      open: true,
      mat: solidMaterial(0xffffff, {
        spec: 0.03, emissive: VIK.glow, vcol: false,
        decl: 'uniform sampler2D uBoaMap;',
        body: 'base = texture2D(uBoaMap, vUv).rgb;',
        uniforms: { uBoaMap: { value: boaTex } },
      }),
    });
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
   * one welded mesh per roof state, and a welded mesh cannot spin.
   *
   * The second version (1.559.2; Misha: *"that fan in the kitchen could use an
   * upgrade"*), off the one in the photograph of the bedroom — a 40 cm stand
   * fan, white, five blades behind a domed wire guard with a round badge in
   * the middle. It was flat sector blades, a ring-and-spoke cage drawn as two
   * flat discs, and a cylinder for a motor. Now:
   *
   *   - the blades are moulded: each one narrow at the root and broad and
   *     rounded at the tip, swept back, with its pitch twisting from steep at
   *     the hub to flat at the tip and a camber across its chord, round a hub
   *     with a domed spinner;
   *   - the guard is two domes of wire — the rear one shallow, the front one
   *     deeper — each of radial wires bent over the dome and concentric rings
   *     on it, clamped together at the rim by a band with a clip, with the
   *     badge on the front;
   *   - the motor is a turned can with a rounded front, a tapered back and a
   *     ring of vent slots, on a yoke with a tilt knob, with a row of four
   *     piano keys and the oscillation knob on its back;
   *   - the column telescopes through a knurled collar, on a cross of tube legs
   *     with rubber feet, and the flex runs off to the wall with its plug.
   *
   * Local house metres. The wall the fridge stands against is +z, so the fan
   * faces −z, which is into the room.
   */
  const fans = [];
  function makeFan(FAN) {
    const fan = { blades: null, head: null, phase: FAN.phase || 0 };
    const R = FAN.r;
    const ds = THREE.DoubleSide;
    const white = solidMaterial(new THREE.Color(0.925, 0.920, 0.905), {
      spec: 0.30, specPower: 44, emissive: VIK.glow, vcol: false, side: ds,
    });
    const grey = solidMaterial(new THREE.Color(0.735, 0.735, 0.730), {
      spec: 0.22, specPower: 30, emissive: VIK.glow, vcol: false, side: ds,
    });
    const wire = solidMaterial(new THREE.Color(0.890, 0.890, 0.880), {
      spec: 0.40, specPower: 60, emissive: VIK.glow, vcol: false,
    });
    const dark = solidMaterial(new THREE.Color(0.090, 0.095, 0.105), {
      spec: 0.10, specPower: 20, emissive: VIK.glow * 0.3, vcol: false, side: ds,
    });
    const blue = solidMaterial(new THREE.Color(0.180, 0.330, 0.620), {
      spec: 0.30, specPower: 40, emissive: VIK.glow, vcol: false, side: ds,
    });
    // The blades are a translucent-looking pale grey plastic and a blade seen
    // from behind is the same blade, so it is drawn both ways round.
    const vane = solidMaterial(new THREE.Color(0.800, 0.805, 0.800), {
      spec: 0.34, specPower: 48, emissive: VIK.glow, vcol: false, side: ds,
    });
    const g = new THREE.Group();
    g.position.set(FAN.x, plan.floor, FAN.z);
    g.rotation.y = FAN.yaw || 0;
    root.add(g);

    const put = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = false; m.receiveShadow = false;
      return m;
    };
    /** A lathe about Y, from [r, y] pairs. */
    const lathe = (pts, seg = 28) =>
      new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    /** A strut between two points, which is what a cylinder must be aimed as. */
    const strut = (a, b, r0, r1, mat, seg = 10) => {
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const m = put(new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), seg),
        mat, mid.x, mid.y, mid.z);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize());
      return m;
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    // The cross base: four tube legs from a moulded hub, each ending in a
    // rubber foot. Each leg is aimed from the hub at its foot — see `strut` —
    // because a three.js cylinder stands on its own Y axis, and four of them
    // tipped by a tenth of a radian were once four pins standing on the floor.
    for (let i = 0; i < 4; i++) {
      const a = (i + 0.5) * Math.PI / 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const hub = V(ca * 0.050, 0.050, sa * 0.050);
      const knee = V(ca * 0.180, 0.030, sa * 0.180);
      const toe = V(ca * 0.300, 0.018, sa * 0.300);
      g.add(strut(hub, knee, 0.013, 0.011, white, 12));
      g.add(strut(knee, toe, 0.011, 0.0095, white, 12));
      g.add(put(new THREE.SphereGeometry(0.0115, 12, 8), white, knee.x, knee.y, knee.z));
      const foot = put(new THREE.SphereGeometry(0.016, 14, 8), dark, toe.x, 0.010, toe.z);
      foot.scale.set(1.25, 0.65, 1.25);
      g.add(foot);
    }
    g.add(put(lathe([[0.0005, 0.000], [0.060, 0.012], [0.064, 0.030],
      [0.058, 0.058], [0.036, 0.074], [0.030, 0.090], [0.0005, 0.090]], 32),
    white, 0, 0, 0));
    // The column: a fat lower tube, the knurled collar it telescopes through,
    // the thin upper tube.
    g.add(put(new THREE.CylinderGeometry(0.0225, 0.025, 0.55, 20), white, 0, 0.36, 0));
    {
      const c = put(lathe([[0.022, 0.0], [0.034, 0.004], [0.036, 0.040],
        [0.032, 0.048], [0.019, 0.050]], 36), grey, 0, 0.632, 0);
      g.add(c);
      for (let k = 0; k < 18; k++) {
        const a = k * Math.PI * 2 / 18;
        const rib = put(new THREE.BoxGeometry(0.004, 0.032, 0.004), grey,
          Math.cos(a) * 0.0365, 0.654, Math.sin(a) * 0.0365);
        rib.rotation.y = -a;
        g.add(rib);
      }
    }
    g.add(put(new THREE.CylinderGeometry(0.0145, 0.0145, 0.42, 16), grey, 0, 0.88, 0));

    // The head, which oscillates about the top of the column.
    const head = new THREE.Group();
    head.position.set(0, 1.09, 0);
    g.add(head);
    fan.head = head;
    // The yoke: a stem off the column, a block, and the tilt knob on its side.
    head.add(put(new THREE.CylinderGeometry(0.017, 0.019, 0.05, 16), white, 0, -0.025, 0));
    head.add(put(new THREE.BoxGeometry(0.044, 0.036, 0.052), white, 0, 0.004, -0.004));
    {
      const k = put(lathe([[0.0005, 0.0], [0.016, 0.0], [0.018, 0.004],
        [0.017, 0.016], [0.010, 0.020], [0.0005, 0.021]], 20), grey, 0.022, 0.006, -0.004);
      k.rotation.z = -Math.PI / 2;
      head.add(k);
    }
    // The motor: a turned can, rounded at the front, tapering at the back to
    // a vented cap. Lathed about Y and laid along Z: the front is −Z.
    {
      const can = lathe([[0.0005, -0.128], [0.028, -0.126], [0.046, -0.118],
        [0.056, -0.104], [0.060, -0.085], [0.061, -0.040], [0.058, -0.010],
        [0.050, 0.020], [0.040, 0.040], [0.032, 0.052], [0.0005, 0.056]], 36);
      can.rotateX(Math.PI / 2);
      head.add(put(can, white, 0, 0.060, 0));
      // The vent slots round the back, dark, and the shaft collar at the
      // front.
      for (let k = 0; k < 16; k++) {
        const a = k * Math.PI * 2 / 16;
        const slot = put(new THREE.BoxGeometry(0.006, 0.0025, 0.030), dark,
          Math.cos(a) * 0.0535, 0.060 + Math.sin(a) * 0.0535, 0.008);
        slot.rotation.z = a;
        head.add(slot);
      }
      const col = lathe([[0.0005, 0.0], [0.020, 0.0], [0.020, 0.012], [0.012, 0.016],
        [0.0005, 0.016]], 24);
      col.rotateX(-Math.PI / 2);
      head.add(put(col, grey, 0, 0.060, -0.126));
      // The controls on the back of the can: four piano keys in a grey
      // housing, and the oscillation knob sticking up behind them.
      head.add(put(new THREE.BoxGeometry(0.060, 0.016, 0.034), grey, 0, 0.122, 0.006));
      for (let k = 0; k < 4; k++) {
        const key = put(new THREE.BoxGeometry(0.0125, 0.010, 0.026),
          k === 0 ? blue : white, -0.0215 + k * 0.0143, 0.134, 0.004 - (k === 1 ? 0.004 : 0));
        key.rotation.x = k === 1 ? 0.18 : 0;
        head.add(key);
      }
      head.add(put(new THREE.CylinderGeometry(0.009, 0.011, 0.030, 14), white,
        0, 0.114, 0.050));
      head.add(put(new THREE.CylinderGeometry(0.0055, 0.0055, 0.018, 10), grey,
        0, 0.136, 0.050));
    }

    // The guard: a shallow rear dome and a deeper front one, both radial wires
    // bent over the dome with rings on them, clamped together at the rim.
    const GZ = -0.150, GY = 0.060;          // the rim's plane, and the axis height
    /** A point on a guard dome: `s` 0 at the centre to 1 at the rim, `a` round. */
    const dome = (s, a, depth, z0) => {
      const r = R * s;
      const z = z0 + depth * (1 - s * s) * (1 - 0.15 * s);
      return V(Math.cos(a) * r, GY + Math.sin(a) * r, z);
    };
    const wireUp = (pts, r, n = 4) => new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts), pts.length * 3, r, n, false);
    {
      const geos = [];
      // Rear: 24 wires from a ring round the motor out to the rim.
      for (let k = 0; k < 24; k++) {
        const a = k * Math.PI * 2 / 24;
        const pts = [];
        for (let j = 0; j <= 6; j++) pts.push(dome(0.32 + 0.68 * j / 6, a, 0.050, GZ));
        geos.push(wireUp(pts, 0.0018));
      }
      // Front: 36 wires, from the badge to the rim, over a deeper dome.
      for (let k = 0; k < 36; k++) {
        const a = k * Math.PI * 2 / 36 + 0.05;
        const pts = [];
        for (let j = 0; j <= 7; j++) pts.push(dome(0.17 + 0.83 * j / 7, a, -0.058, GZ));
        geos.push(wireUp(pts, 0.0016));
      }
      for (const m of geos) head.add(put(m, wire, 0, 0, 0));
      // The rings, on both domes.
      for (const [s, depth, r] of [[0.45, 0.050, 0.0020], [0.75, 0.050, 0.0020],
        [0.30, -0.058, 0.0018], [0.52, -0.058, 0.0018], [0.74, -0.058, 0.0018],
        [0.92, -0.058, 0.0018]]) {
        const p = dome(s, 0, depth, GZ);
        const t = put(new THREE.TorusGeometry(R * s, r, 6, 64), wire, 0, GY, p.z);
        head.add(t);
      }
      // The clamp band round the rim, and its clip at the bottom.
      head.add(put(new THREE.TorusGeometry(R + 0.002, 0.0055, 8, 72), white, 0, GY, GZ));
      head.add(put(new THREE.BoxGeometry(0.030, 0.016, 0.022), white, 0, GY - R - 0.006, GZ));
      // The badge: a white disc with a blue ring and a grey centre.
      const bz = GZ - 0.058 - 0.004;
      const badge = lathe([[0.0005, 0.0], [0.034, 0.0], [0.035, 0.004], [0.031, 0.008],
        [0.0005, 0.010]], 32);
      badge.rotateX(-Math.PI / 2);
      head.add(put(badge, white, 0, GY, bz));
      const ring = put(new THREE.TorusGeometry(0.024, 0.0022, 6, 40), blue, 0, GY, bz - 0.009);
      head.add(ring);
      head.add(put(new THREE.CircleGeometry(0.012, 24), grey, 0, GY, bz - 0.0102)
        .rotateY(Math.PI));
    }

    // And the blades. Five, each a moulded paddle: narrow at the root, broad
    // and rounded at the tip, swept back by a few degrees, pitched steeply at
    // the hub and flatter at the tip, and cambered across the chord. Built in
    // the blade's own polar frame — `u` out along the span, `v` across the
    // chord — and turned into place.
    const blades = new THREE.Group();
    blades.position.set(0, GY, GZ - 0.002);
    head.add(blades);
    fan.blades = blades;
    {
      const NU = 14, NV = 8, r0 = 0.034, r1 = R * 0.86;
      const bladeGeo = () => {
        const pos = [], idx = [];
        for (let i = 0; i <= NU; i++) {
          const u = i / NU;
          const r = r0 + (r1 - r0) * u;
          // Half the chord as an angle: narrow at the root, widest at 0.7 and
          // rounded off at the tip.
          const half = (0.16 + 0.36 * Math.sin(Math.min(1, u / 0.75) * Math.PI / 2))
            * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, u - 0.82) / 0.18, 2)) * 0.85 + 0.15);
          const sweep = 0.22 * u * u;
          const pitch = 0.50 - 0.25 * u;
          for (let j = 0; j <= NV; j++) {
            const v = j / NV * 2 - 1;
            const a = sweep + v * half;
            const chord = v * half * r;
            const z = -Math.sin(pitch) * chord + 0.010 * (1 - v * v) * (0.4 + 0.6 * u);
            pos.push(Math.cos(a) * r * Math.cos(pitch * 0.25), Math.sin(a) * r, z);
          }
        }
        for (let i = 0; i < NU; i++) {
          for (let j = 0; j < NV; j++) {
            const a = i * (NV + 1) + j, b = a + NV + 1;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        return geo;
      };
      const proto = bladeGeo();
      for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(proto, vane);
        b.rotation.z = i * (Math.PI * 2 / 5);
        b.castShadow = false; b.receiveShadow = false;
        blades.add(b);
      }
      // The hub and its spinner.
      const hub = lathe([[0.0005, 0.016], [0.034, 0.012], [0.038, 0.0], [0.036, -0.012],
        [0.026, -0.022], [0.012, -0.028], [0.0005, -0.030]], 32);
      hub.rotateX(Math.PI / 2);
      blades.add(put(hub, white, 0, 0, 0));
    }
    for (const m of blades.children) m.frustumCulled = false;

    // The flex, off the hub across the tiles to the wall, and its plug.
    {
      const pts = [V(0.040, 0.012, 0.050), V(0.06, 0.004, 0.12), V(0.02, 0.004, 0.24),
        V(-0.05, 0.004, 0.31), V(-0.07, 0.010, 0.335), V(-0.07, 0.30, 0.338)];
      const flex = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0035, 6, false);
      g.add(put(flex, grey, 0, 0, 0));
      g.add(put(new THREE.BoxGeometry(0.036, 0.046, 0.024), white, -0.07, 0.31, 0.330));
    }
    fans.push(fan);
  }
  makeFan({ x: -1.52, z: 3.28, r: 0.195 });
  // And its twin in soba 3, in the corner by the window, where the photograph
  // of a bedroom has one: it was baked into the room as three discs on a
  // stick. Facing into the room, a different phase so the two never agree.
  makeFan({ x: 2.83, z: -3.245, r: 0.195, yaw: Math.PI, phase: 2.1 });

  // ── the towel on the terrace railing ────────────────────────────────────────
  /**
   * One beach towel hung over the top rail, flapping (Misha, 1 Oct 2026:
   * *"perhaps hang one towel on the railings there and have it flap in the
   * wind like them flags"*).
   *
   * It IS the flags: `brodEnsign` (src/59-brod.js), the particle cloth the
   * Brod's ensign and the flags on the Jadrija mole fly, handed a carrier
   * turned so that its luff — the edge that does not move — lies along the
   * rail instead of up a pole, and its fly hangs down off it. The carrier's
   * +X is up, so the cloth starts hanging straight down; its +Y runs along
   * the rail; its +Z is the side the long half hangs on. `plane` keeps the
   * cloth on that side of the railing's rods.
   *
   * The long half hangs on the TERRACE side, and that is the wind's choice,
   * not taste. Hung on the sea side first, it lay dead flat against the rods
   * (sag 89.8°, not a ripple): the channel's breeze here is onshore, so it
   * pressed the cloth into the railing it was hung on. On the inside the
   * same breeze lifts it off the rail toward the house, which is the towel
   * flapping that was asked for — and the side it is seen from.
   *
   * The short half, over the rail and down the sea side, is not cloth: it is
   * the same towel's other end, bent over the rail and hanging still, which
   * is what a towel over a rail does — one half moves, the other is held.
   *
   * Terry is heavy for a flag (0.30 kg/m² against the ensign's 0.24), so in
   * the channel's usual 2.6 m/s it lifts and ripples rather than flying flat.
   * 7 × 11 particles, stepped only within 60 m of you; frozen where it was
   * beyond that.
   */
  const towel = {};
  {
    // House metres, three.js axes: x along the rail, y up, z out to sea. The
    // rail's top tube is at Blender (y -6.005, z 3.94), radius 21 mm.
    const T = plan.towel;
    const W = T.x1 - T.x0, FLY = 0.95;
    // The part inside: over the top of the rail from where the cloth is
    // pinned (0.85 rad up from level on the sea side) and 40 cm down.
    const RR = 0.024, PH0 = 0.85, ARC = RR * (Math.PI - PH0), IN = ARC + 0.40;
    // S: the side the free half hangs on, along house z. −1 is the terrace.
    const S = -1;
    const carrier = new THREE.Object3D();
    carrier.position.set(S < 0 ? T.x1 : T.x0, T.y + RR * Math.sin(PH0),
      T.z + S * RR * Math.cos(PH0));
    carrier.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(-S, 0, 0), new THREE.Vector3(0, 0, S)));
    root.add(carrier);
    root.updateMatrixWorld(true);
    // The stripes, off the cloth's own u — metres down the towel from the
    // inner end, so the still half over the rail carries on the same bands.
    const STRIPES = 'n = gl_FrontFacing ? n : -n;'
      + 'float s = vUv.x * ' + FLY.toFixed(3) + ' + ' + IN.toFixed(3) + ';'
      + 'float k = fract(s / 0.47);'
      + 'vec3 c = vec3(0.060, 0.230, 0.560);'
      + 'if (k < 0.16) c = vec3(0.930, 0.925, 0.900);'
      + 'else if (k < 0.27) c = vec3(0.960, 0.760, 0.150);'
      + 'else if (k < 0.32) c = vec3(0.930, 0.925, 0.900);'
      + 'else if (k < 0.58) c = vec3(0.100, 0.640, 0.700);'
      + 'else if (k < 0.63) c = vec3(0.930, 0.925, 0.900);'
      + 'else if (k < 0.76) c = vec3(0.920, 0.380, 0.180);'
      + 'float e = min(s, ' + (FLY + IN).toFixed(3) + ' - s);'
      + 'c = mix(vec3(0.900, 0.890, 0.860), c, smoothstep(0.015, 0.035, e));'
      + 'base = c;';
    const cloth = brodEnsign({
      name: 'vikendica:towel',
      E: { nu: 11, nv: 7, fly: FLY, hoist: W, sigma: 0.30, near: 60, gust: 0.6,
        iters: 10, maxSub: 3 },
      head: new THREE.Vector3(0, 0, 0),
      mastF: 0, mastR: 0,
      // Out of the railing: nothing behind the plane of the rods' face.
      plane: { n: [0, 0, S], d: 0.004, frame: root },
      body: STRIPES,
    });
    cloth.mesh.castShadow = true;
    scene.add(cloth.mesh);
    // Hang it once now, so that from the promenade — further than it is ever
    // stepped from — it is a towel and not nothing.
    cloth.step(1 / 60, carrier, 0, null);
    towel.cloth = cloth;
    towel.carrier = carrier;

    // The short half: over the top of the rail and down the far side, still.
    {
      const NA = 8, NS = 18;
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= NA; i++) {
        const x = T.x0 + W * i / NA;
        for (let j = 0; j <= NS; j++) {
          // Arc length back from the pinned edge: round the top of the rail
          // and then straight down the far side, with a slow wave across it.
          const L = (j / NS) * IN;
          let y, z;
          if (L < ARC) {
            const ph = PH0 + L / RR;
            y = T.y + RR * Math.sin(ph); z = T.z + S * RR * Math.cos(ph);
          } else {
            const h = L - ARC;
            y = T.y - h;
            z = T.z - S * (RR + 0.008 * Math.sin((i / NA) * Math.PI * 2.5 + 0.6)
              * Math.min(1, h / 0.15));
          }
          pos.push(x, y, z);
          uv.push(-L / FLY, i / NA);
        }
      }
      for (let i = 0; i < NA; i++) {
        for (let j = 0; j < NS; j++) {
          const a = i * (NS + 1) + j, b = a + NS + 1;
          idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, cloth.mesh.material);
      m.name = 'vikendica:towel-in';
      m.castShadow = true;
      root.add(m);
    }
  }
  /** A frame of the towel. `who` is the person, in world metres. */
  function stepTowel(dt, who) {
    if (towel.cloth) towel.cloth.step(Math.min(dt || 0, 0.1), towel.carrier, 0, who || null);
  }

  // ── the awning, on its crank ────────────────────────────────────────────────
  /**
   * The folding-arm awning over the terrace doors, wound in and out by hand
   * (Misha, 2 Oct 2026: *"those awnings, there are missing those horizontal
   * sticks that one can use to roll them out or in.. maybe would be cool to
   * roll/unroll them using the sticks, would be cool to retract or fold the
   * awnings to create atmosphere"*).
   *
   * The cassette and the arms' shoulder brackets are screwed to the wall and
   * stay baked (`awning` in tools/blender/vikendica.py). Everything that moves
   * is here, off the same numbers: the cloth off its roller, the front bar
   * with its valance, the two folding arms, and the crank — a gearbox under
   * the east end of the cassette's nose, and hooked into its eye a rod with a
   * cranked handle at the foot, which is the stick every one of these has
   * hanging off it.
   *
   * E beside the handle winds it, the whole way in or the whole way out —
   * seven seconds and eleven turns, which is a quarter of what the real one
   * takes and the most a game can ask anybody to stand and watch. E again
   * while it moves sends it back the other way. Winding, the rod swings out
   * toward you off the eye and the handle goes round; let go, it drops back
   * to hanging straight.
   *
   * The arms are solved, not keyframed: each is two equal halves hinged at
   * the elbow, the shoulder fixed under the cassette and the hand on the bar,
   * and the elbow sits on the circle that leaves both halves their length —
   * pushed in toward the middle, the way a folding arm's spring holds it.
   * Right out the elbows are bent 23 degrees, as photographed; right in they
   * lie along the cassette, 28 cm apart in the middle.
   *
   * All in the house's Blender metres (x east, y north, z up) and turned into
   * the root's frame by `A3`, so the numbers can be read against the .py.
   */
  const AWN = {
    z: 5.20,              // the cassette's underside: F2 + 2.30
    wall: -3.865,         // the south face, Y0
    xa: 0.14, xb: 3.14,   // its ends: the terrace doors and 40 cm either side
    roll: -3.985,         // where the cloth leaves the slot in the nose
    out: 2.05,            // the bar off the wall, run right out
    tuck: 0.225,          // and wound right in, closing the nose
    drop: 0.34,           // the bar below the roller, run right out
    arm: 1.07,            // each half of a folding arm
    secs: 7.0, turns: 11, // all the way, in or out
    eye: [3.02, -4.030, 5.205],
    rod: 1.10,            // the eye to the handle
    reach: 1.0,           // m: how near the handle E finds it
  };
  const A3 = (x, y, z) => new THREE.Vector3(x, z, -y);
  const awning = { e: 1, to: 1, phase: 0, tilt: 0, want: 0, shape: null };

  function makeAwning() {
    const ds = THREE.DoubleSide;
    const cream = solidMaterial(new THREE.Color(0.880, 0.830, 0.610), {
      spec: 0.10, specPower: 18, emissive: VIK.glow, vcol: false, side: ds,
    });
    const white = solidMaterial(new THREE.Color(0.905, 0.900, 0.885), {
      spec: 0.34, specPower: 50, emissive: VIK.glow, vcol: false,
    });
    const grey = solidMaterial(new THREE.Color(0.620, 0.630, 0.640), {
      spec: 0.30, specPower: 40, emissive: VIK.glow, vcol: false,
    });
    const black = solidMaterial(new THREE.Color(0.075, 0.075, 0.080), {
      spec: 0.18, specPower: 24, emissive: VIK.glow * 0.3, vcol: false,
    });
    const g = new THREE.Group();
    g.name = 'vikendica:awning';
    root.add(g);
    const mesh = (geo, mat) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      return m;
    };

    // A closed (dy, dz) section swept along x, flat-shaded: the bar.
    const sweepX = (prof, x0, x1) => {
      const pos = [];
      const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      const n = prof.length;
      const P = (x, i) => A3(x, prof[i][0], prof[i][1]);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        tri(P(x0, i), P(x1, i), P(x1, j)); tri(P(x0, i), P(x1, j), P(x0, j));
      }
      for (let i = 1; i < n - 1; i++) {
        tri(P(x0, 0), P(x0, i + 1), P(x0, i)); tri(P(x1, 0), P(x1, i), P(x1, i + 1));
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      return geo;
    };
    // A rod from a to b (Blender metres), as a unit cylinder stretched.
    const UP = new THREE.Vector3(0, 1, 0);
    const rodTo = (m, a, b) => {
      const A = A3(...a), B = A3(...b), d = B.clone().sub(A);
      const L = d.length() || 1e-6;
      m.position.copy(A).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(UP, d.divideScalar(L));
      m.scale.set(1, L, 1);
    };

    // The cloth: a sheet off the roller to the back of the bar.
    const NX = 28, NY = 20;
    const cloth = new THREE.BufferGeometry();
    cloth.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((NX + 1) * (NY + 1) * 3), 3));
    {
      const idx = [];
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX; i++) {
          const a = j * (NX + 1) + i, b = a + NX + 1;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
      cloth.setIndex(idx);
    }
    const clothM = mesh(cloth, cream);
    g.add(clothM);

    // The bar, its grey end caps and the valance, which ride together.
    const bar = new THREE.Group();
    g.add(bar);
    bar.add(mesh(sweepX([[0.035, 0.030], [-0.020, 0.030], [-0.034, 0.024], [-0.040, 0.012],
      [-0.042, -0.012], [-0.040, -0.026], [-0.030, -0.030], [0.035, -0.030]],
    AWN.xa + 0.012, AWN.xb - 0.012), white));
    for (const x of [AWN.xa, AWN.xb - 0.012]) {
      bar.add(mesh(sweepX([[0.038, 0.034], [-0.046, 0.034], [-0.046, -0.034], [0.038, -0.034]],
        x, x + 0.012), grey));
    }
    {
      // Straight, 20 cm, kicked out a little at the hem by its weighted edge,
      // and never quite flat across.
      const NV = 4, pos = [], idx = [];
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        for (let i = 0; i <= NX; i++) {
          const x = AWN.xa + 0.02 + (AWN.xb - AWN.xa - 0.04) * i / NX;
          const p = A3(x, -0.046 - 0.012 * v * v + 0.003 * Math.sin(x * 7.3) * v,
            -0.020 - 0.20 * v);
          pos.push(p.x, p.y, p.z);
        }
      }
      for (let j = 0; j < NV; j++) {
        for (let i = 0; i < NX; i++) {
          const a = j * (NX + 1) + i, b = a + NX + 1;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      bar.add(mesh(geo, cream));
    }

    // The arms: upper, fore, and a knuckle at the shoulder, the elbow and
    // the hand.
    const tube = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
    const ball = new THREE.SphereGeometry(1, 16, 10);
    const arms = [AWN.xa + 0.30, AWN.xb - 0.30].map((sx, k) => {
      const c = k === 0 ? 1 : -1;
      const up = mesh(tube, white), fore = mesh(tube, white);
      const kn = [0.028, 0.032, 0.024].map((r) => {
        const m = mesh(ball, grey); m.scale.setScalar(r); g.add(m); return m;
      });
      g.add(up, fore);
      return { sx, c, up, fore, kn };
    });

    // The gearbox under the east end of the nose, and its eye.
    const [ex, ey, ez] = AWN.eye;
    {
      const box = mesh(new THREE.BoxGeometry(0.07, 0.05, 0.07), white);
      box.position.copy(A3(ex, ey + 0.02, AWN.z - 0.005));
      g.add(box);
      const eyeR = mesh(new THREE.TorusGeometry(0.014, 0.0035, 8, 20), grey);
      eyeR.position.copy(A3(ex, ey, ez - 0.045));
      eyeR.rotation.y = Math.PI / 2;
      g.add(eyeR);
    }
    // The crank: hung from the eye, its hook, the rod, and at the foot the
    // cranked handle — out sideways and back down, with a black grip that
    // turns on it.
    const crank = new THREE.Group();
    crank.position.copy(A3(ex, ey, ez - 0.058));
    g.add(crank);
    const spin = new THREE.Group();
    crank.add(spin);
    {
      const R = 0.0085, L = AWN.rod, OFF = 0.12;
      const hook = mesh(new THREE.TorusGeometry(0.016, 0.0045, 8, 20, Math.PI * 1.4), grey);
      hook.rotation.z = -Math.PI * 0.2;
      hook.position.y = -0.004;
      spin.add(hook);
      const rod = mesh(new THREE.CylinderGeometry(R, R, L - 0.02, 16), white);
      rod.position.y = -0.02 - (L - 0.02) / 2;
      spin.add(rod);
      // The bend out to the handle, horizontal — the stick you turn by.
      const arm = mesh(new THREE.CylinderGeometry(R, R, OFF, 12), white);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(OFF / 2, -L, 0);
      spin.add(arm);
      for (const x of [0, OFF]) {
        const b = mesh(ball, white); b.scale.setScalar(R * 1.05); b.position.set(x, -L, 0); spin.add(b);
      }
      const grip = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.11, 16), black);
      grip.position.set(OFF, -L - 0.065, 0);
      spin.add(grip);
      const cap = mesh(ball, black); cap.scale.set(0.017, 0.010, 0.017);
      cap.position.set(OFF, -L - 0.12, 0);
      spin.add(cap);
      awning.grip = grip;
    }

    // The shape for an extension `e`, 0 wound in to 1 run out.
    awning.shape = (e) => {
      const d = AWN.tuck + (AWN.out - AWN.tuck) * e;
      const yb = AWN.wall - d;
      const zf = AWN.z + 0.035 - (AWN.drop + 0.035) * e;
      bar.position.copy(A3(0, yb, zf));
      // The cloth, with the belly a tensioned cloth has in it and no more.
      const P = cloth.attributes.position.array;
      const y0 = AWN.roll, z0 = AWN.z + 0.012, y1 = yb + 0.035, z1 = zf + 0.030;
      for (let j = 0; j <= NY; j++) {
        const v = j / NY;
        for (let i = 0; i <= NX; i++) {
          const u = i / NX;
          const x = AWN.xa + 0.03 + (AWN.xb - AWN.xa - 0.06) * u;
          const sag = 0.035 * e * Math.sin(Math.PI * v) * (0.6 + 0.4 * Math.sin(Math.PI * u));
          const p = A3(x, y0 + (y1 - y0) * v, z0 + (z1 - z0) * v - sag);
          const o = 3 * (j * (NX + 1) + i);
          P[o] = p.x; P[o + 1] = p.y; P[o + 2] = p.z;
        }
      }
      cloth.attributes.position.needsUpdate = true;
      cloth.computeVertexNormals();
      cloth.computeBoundingSphere();
      clothM.visible = e > 0.01;
      // The arms. Shoulder S fixed, hand F on the bar; the elbow on the
      // circle of points `arm` from both, toward the middle and a touch low.
      for (const A of arms) {
        const S = [A.sx, AWN.wall - 0.06, AWN.z - 0.10];
        const F = [A.sx, yb + 0.045, zf - 0.005];
        const dy = F[1] - S[1], dz = F[2] - S[2];
        const D = Math.hypot(dy, dz);
        const h = Math.sqrt(Math.max(0, AWN.arm * AWN.arm - D * D / 4));
        const E = [A.sx + A.c * h, (S[1] + F[1]) / 2, (S[2] + F[2]) / 2 - 0.035 * e];
        rodTo(A.up, S, E); A.up.scale.x = A.up.scale.z = 0.021;
        rodTo(A.fore, E, F); A.fore.scale.x = A.fore.scale.z = 0.018;
        A.kn[0].position.copy(A3(...S)); A.kn[1].position.copy(A3(...E));
        A.kn[2].position.copy(A3(...F));
      }
    };
    awning.crank = crank; awning.spin = spin;
    awning.shape(awning.e);
  }
  makeAwning();

  /** A frame of the awning: wind it, swing the rod out or let it hang. */
  function stepAwning(dt) {
    if (!awning.shape || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    const moving = awning.e !== awning.to;
    if (moving) {
      const dir = Math.sign(awning.to - awning.e);
      const de = Math.min(Math.abs(awning.to - awning.e), dt / AWN.secs);
      awning.e += dir * de;
      if (Math.abs(awning.e - awning.to) < 1e-6) awning.e = awning.to;
      // Clockwise to wind it out, seen from the handle.
      awning.phase += dir * de * AWN.turns * Math.PI * 2;
      awning.spin.rotation.y = awning.phase;
      awning.shape(awning.e);
    }
    // Swung out 19 degrees toward you while it turns; hanging when not.
    const want = moving ? 0.33 : 0;
    if (Math.abs(want - awning.tilt) > 1e-4) {
      awning.tilt += (want - awning.tilt) * Math.min(1, dt * 5);
      awning.crank.rotation.x = -awning.tilt;
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
    for (const fan of fans) {
      const t = now / 1000 + fan.phase;
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
      // ── AND HALF A RISER UP, WHICH IS NOT A FUDGE — IT IS WHERE THE TREADS
      //    ARE ───────────────────────────────────────────────────────────────
      //
      // Misha, 11 Sep 2026, of the Bucketeer: *"when she walks down the steps,
      // her feet are slightly below the ground"*. They were, and so were
      // yours, and so is anybody else's who ever uses this flight: it is this
      // line and it has nothing to do with her.
      //
      // The lerp alone runs from `base` at `z1` to `base + floor` at `z0`,
      // which is the line through the INSIDE CORNERS of the steps — where each
      // riser meets the tread behind it. The surface you actually stand on is
      // the tread TOP, one riser above that corner, so over the body of every
      // tread the old ramp fell away underneath the concrete.
      //
      // MEASURED, not argued. `outside_stair` in tools/blender/vikendica.py
      // draws tread i with its top at `GRADE + ST_RISE * (i + 1)` over a going
      // of 3.10 / 17 = 0.18235, so in this frame the drawn top at house z is
      // 0.17 * (floor((3.86 - z) / 0.18235) + 1) and the old ramp was
      // 0.93398 * (3.865 - z). Differenced over the flight that is a SAWTOOTH
      // from −5 mm to +165 mm with a mean of +78 mm, and it is positive — her
      // inside the step — for 97 per cent of the run. Rays straight down on to
      // the drawn treads agree with the arithmetic to the millimetre: traced at
      // 1/60 s down legs 6-8 of `BUCK_WAY`, 504 frames, the drawn tread top
      // stood a mean of 74.0 mm above her feet and 174 mm above them at worst.
      //
      // Half a riser is where a ramp fitted to a stair belongs: it puts the
      // line through the middle of each tread, so the residual is ±85 mm about
      // zero instead of −5 to +165 mm about −78. Clamped at BOTH ends, and the
      // two clamps are different facts:
      //
      //   the FLOOR of the clamp is `base + riser`, the top of the bottom
      //   tread, and NOT `base + sink` as it was. There is a real step up off
      //   the made ground on to that tread — 70 mm of it, riser minus sink —
      //   and the ramp must not dive below the tread to find it. The old
      //   `Math.max(base + sink, …)` put a 40 mm DIP inside the stair rectangle
      //   instead, which is the "50.0 mm off the bottom step" the note over
      //   `BUCK.stepRate` measured and could not explain.
      //
      //   the CEILING is `base + floor`, which the lerp used to reach exactly
      //   and now reaches 90 mm early, at z 0.851. Tread 16's top is 2.89 and
      //   the landing is 2.90, so that last 90 mm is the flight meeting the
      //   landing 10 mm high rather than a step: continuous, and on the right
      //   side of continuous.
      offer(clamp(base + VIK.floor * clamp((R.z1 - z) / (R.z1 - R.z0), 0, 1)
        + VIK.riser * 0.5, base + VIK.riser, base + VIK.floor));
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
   * How much of the upper bathroom you are standing in, 0…1.
   *
   * There is one thing in this house that goes through the slab, and it is not
   * a stair — there is no stair, the two flats are let separately and always
   * have been. It is the soil stack. The prizemlje has one drawn in the corner
   * of `kupN` behind the door, boxed in and tiled, and it is drawn there
   * because every flat in the row has one; the upper bathroom is the room
   * directly over it and shares it, because a stack serves both wet rooms or
   * it serves neither. Stack, vent and boxing are one continuous column of air
   * between the two storeys and the slab is cast around it rather than across
   * it — which is exactly why, in a building like this, the flat below is
   * audible in the bathroom and nowhere else at all.
   *
   * So this is a room query and not an audio one, and it lives here for the
   * same reason `indoorsAt` does: the house owns which room you are in, and a
   * second opinion about it in 80-audio.js would be a second set of
   * coordinates to keep in step with the drawings. `plan.rooms.bath` IS the
   * rectangle the walls were built from — 2.35 by 1.655, the 3.89 m² on the
   * schedule — so it cannot drift.
   *
   * Ramped 0.30 m in from the walls rather than switched at them. Two reasons
   * and both are measured: a body inside this house is held 0.26 m off a face
   * by `GROUND.tight`, so 0.30 is the smallest ramp that still reaches 1
   * everywhere you can actually stand; and the door is a 1.0 m opening in the
   * east wall, so a hard edge would put the whole change on the threshold, in
   * one step, which is the one place in a room a level change is audible AS a
   * level change. Walking in, it comes up over about a third of a metre.
   *
   * The height band is the flat's own storey and not "above the slab". Above
   * matters because the room below is a different bathroom; below matters
   * because the mezzanine deck, when the loft roof is on, spreads right across
   * this footprint at +2.55 and a person standing on it is over the bathroom's
   * ceiling and not in it.
   *
   * Swept at 5 cm over the whole plot to check it is what it says it is: at
   * eye height on the upper storey it answers non-zero over 3.88 m² bounded by
   * x -3.15..-0.85 and z -0.60..1.00, which is `rooms.bath` to the grid step
   * and the schedule's 3.89 m² to a centimetre. At eye height on the ground
   * floor: nothing. On the mezzanine deck: nothing. Walking in through the
   * door on z = 0 it reads 0, 0.20, 0.53, 0.87, 1 at 10 cm steps.
   */
  const DUCT_RAMP = 0.30;
  function ductAt(t, s, y) {
    if (y != null && (y < base + VIK.floor - 0.6
      || y > base + VIK.floor + plan.clear)) return 0;
    const B = plan.rooms.bath;
    const [x, z] = toHouse(t, s);
    const into = Math.min(x - B.x0, B.x1 - x, z - B.z0, B.z1 - z);
    return clamp(into / DUCT_RAMP, 0, 1);
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

  // ── the fly ────────────────────────────────────────────────────────────────
  /**
   * One housefly in the big room, and the whole of it is behaviour.
   *
   * The mesh cannot help. Seven millimetres is four pixels across from two
   * metres, so nothing about its shape is going to say "fly" — what says fly
   * is how it moves, and a fly moves like nothing else in this game:
   *
   *   STRAIGHT, THEN INSTANTLY NOT. A housefly holds a heading for one to four
   *      tenths of a second and then changes it in about thirty milliseconds
   *      with no arc in it at all. Those are its saccades and they are the
   *      whole tell. Anything that eases from one heading into the next is a
   *      bee or a moth and no amount of size or speed will save it afterwards
   *      — which is why the heading below is a step function with a 30 ms ramp
   *      on it rather than a steered velocity with a turn rate.
   *   IT SITS. Most of a fly's day is spent still. Landing, sitting for four to
   *      twenty seconds, grooming, and going again is not a garnish on the
   *      flying — it is the larger half of the animal, and something that
   *      never lands is a mote of dust on the lens.
   *   THE CEILING WINS. Given the choice it goes up, and it walks about up
   *      there upside down, which nothing else in a room does.
   *   LOOPS, NOT ERRANDS. Its track round a room is a loose circuit that keeps
   *      returning to the same few places rather than a series of crossings,
   *      so a run of saccades here all turn the same way before the bias flips.
   *   THE LIGHT. The terrace doors are by a long way the brightest thing in
   *      this flat, and a fly in this room goes to the window.
   *
   * The turns are `Math.random()` at frame rate and that is deliberate. RULE 4
   * — never a draw from the world's own stream — is about the BUILD, which the
   * census is the checksum of. Where a fly goes next is not part of the world;
   * it is part of the afternoon, and it should be different every time you
   * walk in.
   */
  const FLY = {
    // The air it uses, in the house's own metres — the big room's inner faces
    // pulled in far enough to clear everything that stands in it above head
    // height. The room is x −0.74…3.19 by z −0.635…3.665 under a 5.30 ceiling;
    // 4.16 is over the top corner of the television at 4.09, 5.13 is under the
    // lampshade over the sofa, which hangs to 5.16, and the west end starts at
    // −0.20 because west of that the fridge stands 1.86 m off the floor and
    // its case tops out at 4.76, squarely in the band. The plan sheets and the
    // fish on the spine stand 16 mm proud of z −0.635, so −0.48 is a hand's
    // width off them.
    box: { x0: -0.20, x1: 3.03, z0: -0.48, z1: 3.50, y0: 4.16, y1: 5.13 },

    // One straight segment in seconds, and how far the saccade at the end of
    // it turns, in radians. A housefly holds a heading for one to four tenths
    // and then changes it by something between a quarter turn and a third of
    // one.
    seg: [0.10, 0.42],
    turn: [0.60, 2.00],
    // And how long that turn takes. THIRTY MILLISECONDS, which is the one
    // number this whole thing stands on: at 0.03 the track is a polygon and
    // reads as a fly, at 0.20 it is a smooth ribbon and reads as a bumblebee,
    // and there is nothing in between that reads as either.
    snap: 0.030,
    speed: [0.55, 1.35],       // m/s, and it steps at the saccade as well

    // How long it stays up before it wants somewhere to sit, and how long it
    // sits. Four seconds in the air against ten on the plaster is about the
    // ratio you actually watch.
    air: [2.4, 9.0],
    rest: [3.5, 18.0],
    land: 0.16,                // s, the flare and the roll on to the surface
    off: 0.14,                 // s, the jump off it

    // Walking about where it has landed, which is most of what a sitting fly
    // does that is visible: a centimetre a second, in bursts, with a turn on
    // the spot at the start of each.
    step: 0.011,
    walk: [0.35, 1.60],
    still: [0.9, 3.4],

    // Where the body rides with the feet down: the legs are 2.7 mm long and
    // drop 40 degrees off a pivot 0.8 mm under the thorax, so a standing fly
    // is 2.1 mm clear of the surface.
    stand: 0.0021,

    hear: 6.5,                 // m — the room, and not a metre past its walls
  };

  /**
   * And what happens when you hit it with the hose.
   *
   * A branch throws 9.2 litres a second at 23 m/s. Whatever that does to a 12
   * mg animal it does not do gently, and the honest thing to model is not a
   * fly being knocked out of the sky — it is a fly that has been WETTED. A
   * housefly with water on its wings does not stop flying; it goes into a
   * flat, accelerating spiral it cannot get out of, beating harder and harder
   * against an airframe that has stopped answering, and it comes down. That is
   * the beat Misha asked for — "loudly, in a spiralling orbit" — and it is
   * also what actually happens, which is the sort of agreement worth having.
   *
   * The numbers:
   *
   *   fall     1.55 s from the hit to the floor. Free fall from the middle of
   *            this room is 0.59 s and looks like a dropped ball bearing; a
   *            wet fly is still making lift, badly, and takes two or three
   *            times that. It is also how long the shot needs.
   *   turns    Four and a bit revolutions on the way down, speeding up as the
   *            orbit closes — which is the same skater's arm that makes every
   *            spiral in nature tighten as it goes.
   *   r0, r1   The orbit opens at 16 cm and closes to 2. Wider and it flies
   *            through the furniture; tighter and it is a fly falling straight
   *            down with a wobble on it.
   *   tumble   How fast the animal turns about its OWN axes, which is not the
   *            orbit and is what makes it read as out of control rather than
   *            as being on a wire. It rises through the fall, because it is
   *            losing rather than fighting.
   *   again    And then, in two and a half to four and a half minutes,
   *            ANOTHER ONE. See the note over `hatch`.
   *   floors   The clear patches of tile it is allowed to die on, in the
   *            house's own metres, read off a downward raycast over the whole
   *            room rather than guessed: everything else in here is under an
   *            armchair, the shelves, the desk or the low table, and a corpse
   *            you cannot walk over and look at is a corpse that did not
   *            happen. The fly's own position is clamped into the nearest of
   *            them, so it still dies roughly where it was hit.
   *
   *            EVERY ONE OF THESE IS VERIFIED AT 5 cm, not at the 20 cm the
   *            first sweep used: 684 samples, none of them anything but floor.
   *            The 20 cm version put the west edge of the second rectangle at
   *            1.25, which is one sample away from an armchair whose true edge
   *            is somewhere between 1.2 and 1.4 — and the first fly to die at
   *            that end of the room landed inside it, with the cut framing a
   *            close-up of upholstery.
   */
  const DEATH = {
    fall: 1.55,
    turns: 4.3,
    r0: 0.16,
    r1: 0.02,
    tumble: [7.0, 30.0],       // rad/s, start and end
    hz: [1.38, 1.74],          // the wingbeat climbs a fifth as it fights
    again: [150, 270],
    keep: 4,                   // corpses the floor remembers
    floors: [
      { x0: 1.80, x1: 2.30, z0: -0.15, z1: 1.00 },
      { x0: 1.45, x1: 1.75, z0: -0.15, z1: 1.55 },
      { x0: 0.22, x1: 0.45, z0: -0.20, z1: 1.50 },
    ],
  };

  /**
   * The few places it goes back to, which is what a fly's day in a room is.
   *
   * Each is a patch of a real surface in the house's own metres with the
   * outward normal of that surface, and every one of them was read off
   * tools/blender/vikendica.py rather than eyeballed, because a fly sitting
   * two centimetres inside the plaster is the one way this can look broken
   * from close up.
   *
   * The weights are the argument. The ceiling gets five because that is where
   * a housefly is when you look for it; the two panes of the terrace door get
   * three between them because a fly in a room goes to the light; the long
   * clear stretch of the east wall gets two; and the three horizontal surfaces
   * a fly will actually stand on — the plastic desk, the low table and the top
   * of the television cabinet — get one each.
   */
  const PERCH = [
    { k: 'ceiling', w: 5, n: [0, -1, 0], y: 5.30,
      x: [-0.12, 2.96], z: [-0.42, 3.46] },
    // The two glazed leaves of the 220 opening. Their inner face is at 3.758
    // and the mullion between them stands 35 mm proud of it, so they are two
    // patches and not one. High up them, because that is where a fly on a
    // window is.
    { k: 'window', w: 1.5, n: [0, 0, -1], z: 3.758,
      x: [0.66, 1.53], y: [4.10, 4.88] },
    { k: 'window', w: 1.5, n: [0, 0, -1], z: 3.758,
      x: [1.76, 2.62], y: [4.10, 4.88] },
    // The east wall between the front door and the terrace, which is the one
    // long stretch of plaster in this room with nothing standing against it.
    { k: 'wall', w: 2, n: [-1, 0, 0], x: 3.19,
      z: [1.15, 3.28], y: [3.95, 5.10] },
    // The white plastic garden table that is the desk, west of the laptop.
    { k: 'desk', w: 1, n: [0, 1, 0], y: 3.640,
      x: [0.96, 1.12], z: [2.52, 3.18] },
    // The low round table beside the armchair, inside its 0.32 rim and east of
    // the little box that stands on it.
    { k: 'table', w: 1, n: [0, 1, 0], y: 3.340,
      x: [0.62, 0.74], z: [1.84, 2.16] },
    // And the cabinet top in front of the set, between the screen and the edge.
    { k: 'tv', w: 1, n: [0, 1, 0], y: 3.560,
      x: [-0.10, 0.44], z: [3.26, 3.42] },
  ];

  // The four places its circuits are centred on, which is the other half of
  // "it comes back to the same few places": under the ceiling light over the
  // sofa, in front of the terrace doors, over the desk, and down the west end
  // over the television. The second is drawn twice as often as the others for
  // the same reason the window perches are weighted the way they are — a room
  // with a fly in it has the fly at the window.
  const HAUNT = [
    [1.35, 4.80, 0.60], [1.75, 4.62, 3.00], [1.75, 4.62, 3.00],
    [1.15, 4.92, 2.05], [0.30, 4.70, 2.55],
  ];

  // The three pairs of legs, standing and flying, as (sweep, droop) in radians
  // per row — front, middle, hind. Sweep turns the leg about the body's up
  // axis, droop drops it below the body, and the left side is the mirror.
  //
  // A fly does not fly with its feet down. The front pair comes up under the
  // head, the middle pair tucks and the hind pair trails; a fly crossing a
  // room in the standing stance is the single thing that most clearly reads as
  // a model of a fly rather than a fly, because six legs hanging down is what
  // a dead one on a windowsill looks like.
  const LEG_STAND = [[-0.85, -0.70], [-1.75, -0.70], [-2.45, -0.70]];
  const LEG_AIR = [[-0.60, 0.42], [-2.30, -0.22], [-2.80, -0.45]];

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.min(a.length - 1, Math.floor(Math.random() * a.length))];
  const wrapPi = (a) => {
    let v = a;
    while (v > Math.PI) v -= TAU;
    while (v < -Math.PI) v += TAU;
    return v;
  };

  /**
   * The lid over the room, which the renovation moves.
   *
   * With the gable that is there it is the 5.30 slab over the whole plan. With
   * the mezzanine on there is no slab: the deck's soffit is at 5.29 over the
   * north two thirds — DECK less the 160 mm its joists and boards take — and
   * the south third is open to a ridge four metres up, where a fly walking
   * upside down would be walking on nothing. So a ceiling perch is refused
   * there rather than faked.
   */
  const loftOn = () => !!(parts.loft && parts.loft.visible);
  const ceilY = () => (loftOn() ? plan.deck - 0.16 : plan.floor + plan.clear);

  // The one hard stop, and it is a net rather than a rule: `saccade` keeps the
  // fly inside `FLY.box` and this catches the frames around a landing and a
  // take-off, where it is legitimately outside it — a fly leaving the ceiling
  // starts 17 cm above the box's own lid.
  //
  // Every bound is a real surface less the 2.1 mm a standing fly rides at, and
  // not a round number with slack in it. It was 3.77 on the z side, which is
  // 12 mm past the inner face of the terrace glazing, and a run of ten minutes
  // found the approach jitter using every one of those millimetres — a fly
  // with a third of itself inside a pane, for a frame at a time.
  const HARD = { x0: -0.66, x1: 3.188, z0: -0.56, z1: 3.756, y0: 3.30 };

  const flyRig = new THREE.Group();
  const flyWing = [new THREE.Group(), new THREE.Group()];
  const flyLeg = [];
  // The dead ones. `corpseProto` is built beside the live rig out of the same
  // parts and cloned into `corpses` as they are needed — see the note on it
  // below, and `DEATH.keep` for why there is more than one.
  let corpseProto = null;
  const corpses = [];
  // The close-up's own scene, and it is null until somebody kills something.
  let corpseShot = null;
  // The wings, and they are nearly not there. Emissive was 0.34 and specular
  // 0.30 — a white sheet lit from inside — and against the beech of the table
  // they came out as two solid cream wedges, which is a paper aeroplane and
  // not an insect. A wing is a membrane: it takes a catch-light off one edge
  // and otherwise you see the room through it. `uOpacity` is animated in
  // `poseFly`, thinner in the air than folded.
  const flyWingMat = solidMaterial(new THREE.Color(0.90, 0.91, 0.93), {
    spec: 0.16, specPower: 90, emissive: 0.10, vcol: false,
    opacity: 0.22, transparent: true, depthWrite: false,
    side: THREE.DoubleSide,
  });
  {
    // One unit sphere shared by all four lumps of it, scaled per part. A fly
    // is a chain of three ellipsoids and two enormous eyes and there is no
    // reading distance at which more than that is visible.
    const ball = new THREE.SphereGeometry(1, 8, 6);
    const dark = solidMaterial(new THREE.Color(0.105, 0.098, 0.090), {
      // Hard and shiny, which is the whole of what says INSECT at four pixels:
      // a fly is a chitinous thing with a catch-light on it and a matt black
      // speck of the same size is a piece of grit.
      spec: 0.55, specPower: 70, emissive: VIK.glow * 1.5, vcol: false,
    });
    // And a lighter grey for the thorax, which is the one piece of a housefly's
    // colouring that survives being four pixels wide: the thorax is pale grey
    // with four black stripes down it and the abdomen is nearly black, so a fly
    // is light at the shoulders and dark at the tail. One material apart is
    // enough to carry that; the stripes are not, at any distance.
    const grey = solidMaterial(new THREE.Color(0.245, 0.238, 0.225), {
      spec: 0.42, specPower: 55, emissive: VIK.glow * 1.5, vcol: false,
    });
    const eye = solidMaterial(new THREE.Color(0.330, 0.105, 0.075), {
      spec: 0.60, specPower: 80, emissive: VIK.glow * 1.6, vcol: false,
    });
    // Model axes: +X is the way it is pointing, +Y is its back.
    //
    // Musca domestica off a ruler: 7.3 mm from the front of the eyes to the
    // tip of the abdomen, 2.4 across the thorax, 15 across the wings — and it
    // is modelled at that and not a millimetre over. There is no reading
    // distance at which a bigger fly would help: close enough to see it, the
    // size is the first thing that would be wrong.
    const lump = (mat, sx, sy, sz, px, py) => {
      const m = new THREE.Mesh(ball, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(px, py || 0, 0);
      m.castShadow = false; m.receiveShadow = false;
      flyRig.add(m);
      return m;
    };
    lump(grey, 0.00140, 0.00115, 0.00120, 0.00040);        // thorax
    lump(dark, 0.00195, 0.00115, 0.00105, -0.00235, -0.00015);  // abdomen
    lump(grey, 0.00080, 0.00085, 0.00092, 0.00205);        // head
    lump(eye, 0.00062, 0.00080, 0.00098, 0.00235);         // and it is all eye

    // The wings, on pivots at their roots so the sweep can be animated: out at
    // 25 degrees in the air, folded back over the abdomen the moment it lands.
    // No flapping, and there could not be — 190 beats a second against 60
    // frames is nine strokes a frame, so what a camera sees is a smear, and a
    // pale translucent sheet held still IS that smear.
    //
    // Shaped and not a rectangle. A translucent rectangle over a contrasty
    // background is a rectangle — against the channel through the terrace
    // glass the folded pair read as a pale sticky label on the abdomen. A
    // wing is a rounded blade, widest two thirds of the way out, and five
    // segments a curve is all it takes to say so at this size.
    const L = 0.0062, WD = 0.00120;
    const blade = new THREE.Shape();
    blade.moveTo(0, -0.00028);
    blade.lineTo(0, 0.00030);
    blade.quadraticCurveTo(-L * 0.35, WD, -L * 0.72, WD * 0.92);
    blade.quadraticCurveTo(-L * 0.98, WD * 0.55, -L, 0.0);
    blade.quadraticCurveTo(-L * 0.92, -WD * 0.62, -L * 0.55, -WD * 0.80);
    blade.quadraticCurveTo(-L * 0.22, -WD * 0.60, 0, -0.00028);
    const vane = new THREE.ShapeGeometry(blade, 5);
    vane.rotateX(-Math.PI / 2);
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      // The two roots are 0.06 mm apart in height, which is RULE 5 and nothing
      // else: folded, the pair lie one over the other down the abdomen, and
      // two coplanar sheets are two coplanar sheets even when they are 6 mm
      // long and drawn without depth.
      flyWing[i].position.set(0.00060, 0.00105 + s * 0.00003, s * 0.00075);
      const m = new THREE.Mesh(vane, flyWingMat);
      m.castShadow = false; m.receiveShadow = false;
      m.renderOrder = 2;
      flyWing[i].add(m);
      flyRig.add(flyWing[i]);
    }

    // Six legs, on pivots, splayed down and out — see LEG_STAND. Sub-pixel at
    // any honest distance and worth the twelve triangles anyway: a landed fly
    // is a squat thing standing on a fringe, and without them it is a bean.
    const shank = new THREE.BoxGeometry(0.0027, 0.00022, 0.00022);
    shank.translate(0.00135, 0, 0);
    for (let i = 0; i < 6; i++) {
      const s = i & 1 ? 1 : -1;
      const row = i >> 1;
      const g = new THREE.Group();
      g.position.set([0.00115, -0.00015, -0.00145][row], -0.00080, s * 0.00085);
      g.rotation.set(0, s * LEG_STAND[row][0], LEG_STAND[row][1]);
      const m = new THREE.Mesh(shank, dark);
      m.castShadow = false; m.receiveShadow = false;
      g.add(m);
      flyRig.add(g);
      flyLeg.push(g);
    }
    root.add(flyRig);

    /**
     * The same animal, dead, on the tile.
     *
     * Built out of the same four lumps, two vanes and six shanks as the live
     * one, because it IS the live one and a corpse modelled separately is a
     * second fly that has to be kept in agreement with the first. What changes
     * is the pose, and only the pose: on its back, wings splayed instead of
     * folded, and the six legs drawn in over the belly.
     *
     * It is 3.7 px at the distance you can get to it and every bit of that is
     * the silhouette, which is why the legs are worth posing at all: a speck
     * with a fringe round it reads as a dead insect and a bare speck reads as
     * a crumb. The close-up in src/44-corpse.js is what the detail is for.
     */
    corpseProto = new THREE.Group();
    {
      // The body, and the pose is the whole of it.
      for (const m of flyRig.children) {
        if (!(m instanceof THREE.Mesh)) continue;
        const c = m.clone();
        corpseProto.add(c);
      }
      for (let i = 0; i < 2; i++) {
        const w = new THREE.Group();
        w.position.copy(flyWing[i].position);
        // Out and flat, which is where a dead fly's wings are. The living one
        // folds them down the abdomen the instant six feet are down; nothing
        // folds them again after that.
        w.rotation.set(0, (i ? 1 : -1) * 0.95, 0.06);
        const m = new THREE.Mesh(vane, flyWingMat);
        m.renderOrder = 2;
        w.add(m);
        corpseProto.add(w);
      }
      // And the curl. Same three rows as LEG_STAND, swept hard inboard and
      // dropped on to the body — see LEG_DEAD in src/44-corpse.js, which is
      // the same pose written out joint by joint for the shot that can see it.
      const CURL = [[-0.30, 1.15], [-1.55, 1.30], [-2.70, 1.20]];
      for (let i = 0; i < 6; i++) {
        const s = i & 1 ? 1 : -1;
        const row = i >> 1;
        const g = new THREE.Group();
        g.position.set([0.00115, -0.00015, -0.00145][row], -0.00080, s * 0.00085);
        g.rotation.set(0, s * CURL[row][0], CURL[row][1]);
        const m = new THREE.Mesh(shank, dark);
        g.add(m);
        corpseProto.add(g);
      }
      corpseProto.visible = false;
    }
  }

  /**
   * Where it is, what it is doing, and what it is going to do next.
   *
   * `mode` is one of: `cruise` (up, patrolling), `in` (homing on a perch),
   * `down` (the last 14 cm and the roll on to the surface), `sit` (still, or
   * walking about, or grooming) and `off` (the jump).
   */
  const F = {
    p: new THREE.Vector3(1.4, 4.85, 1.1),
    yaw: 0.4, pitch: 0,
    yaw0: 0.4, yawD: 0, pitch0: 0, pitchD: 0,
    turnT: 0,                  // what is left of the 30 ms
    speed: 0.9, speed0: 0.9, speedD: 0,
    up: new THREE.Vector3(0, 1, 0),
    upFrom: new THREE.Vector3(0, 1, 0),
    mode: 'cruise', seg: 0, hold: 0, u: 0,
    // Where it is going: `aimSurf` is the point its feet will be on and `aim`
    // is 14 cm off it along the normal, which is where the approach ends and
    // the flare begins.
    perch: null, aim: new THREE.Vector3(), aimSurf: new THREE.Vector3(),
    // Where the flare starts from, which is wherever the approach ended and
    // not the standoff point: the two are up to 5 cm apart, and 5 cm is seven
    // body lengths to snap through on one frame.
    from: new THREE.Vector3(),
    loop: { x: 1.3, y: 4.78, z: 0.70, dir: 1, left: 6 },
    doing: 'still', act: 0, rock: 0, wig: 0,
    buzz: 0, hz: 1,
    held: false, far: true,
    // The spiral, while there is one: where it is winding down to, how far
    // round it has got, and how far over it has gone. Null unless `mode` is
    // 'spin'. `again` is the clock on the next fly — see `hatch`.
    die: null, again: 0,
  };
  // The close-up's own buzz, 0 to 1, or −1 for the room's. See `fly.buzz`.
  let buzzOver = -1;
  const fwd = new THREE.Vector3(1, 0, 0);
  const side = new THREE.Vector3();
  const upN = new THREE.Vector3();
  const aimV = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const camRight = new THREE.Vector3();
  const _tq = new THREE.Quaternion();
  const _ax = new THREE.Vector3();

  /**
   * Where the fly is in world metres.
   *
   * By hand rather than through `world()`, and the difference is not rounding.
   * `world()` goes out through `field.toWorld`, which follows the traced
   * shoreline — so a point 3.7 m along the house comes back a centimetre or so
   * from where the house's own rigid transform puts it, because the house is
   * straight and the shore is not. Everything else in this file can use either;
   * this one cannot, because it is what the debug camera aims at and a
   * centimetre at 30 cm is two degrees off the middle of the frame.
   *
   * `root.rotation.y = yaw` sends local +X to (cos yaw, −sin yaw).
   */
  const flyWorld = () => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [root.position.x + F.p.x * c + F.p.z * s,
      base + F.p.y,
      root.position.z - F.p.x * s + F.p.z * c];
  };

  const headingTo = (dx, dz) => Math.atan2(dz, dx);
  const setHeading = (y, p, sp) => {
    F.yaw0 = F.yaw; F.yawD = wrapPi(y - F.yaw);
    F.pitch0 = F.pitch; F.pitchD = clamp(p, -1.1, 1.1) - F.pitch;
    F.speed0 = F.speed; F.speedD = sp - F.speed;
    F.turnT = FLY.snap;
  };
  const headOf = (v, y, p) => {
    const c = Math.cos(p);
    v.set(c * Math.cos(y), Math.sin(p), c * Math.sin(y));
  };

  /**
   * One saccade: the whole animal, in twenty lines.
   *
   * The new heading is the old one turned the way this circuit is turning, by
   * a random amount, pulled a little toward whatever the fly is currently
   * orbiting — and then thrown away and drawn again if it would put the fly
   * through a wall within a third of a second. Eight tries, and the fallback
   * is the middle of the room, which is what a fly that has run out of ideas
   * in a corner does anyway.
   *
   * The wall test is what makes this look deliberate rather than random. A
   * real fly saccades BECAUSE the wall is expanding in its eye, so a turn that
   * happens at a wall and points back into the room is not a cheat — it is the
   * mechanism.
   */
  function saccade(bias = 0.28) {
    const B = FLY.box;
    const gx = F.loop.x - F.p.x, gy = F.loop.y - F.p.y, gz = F.loop.z - F.p.z;
    const home = headingTo(gx, gz);
    const homeP = clamp(gy * 1.2, -0.55, 0.55);
    let best = null;
    for (let i = 0; i < 8; i++) {
      const y = wrapPi(F.yaw + F.loop.dir * rnd(FLY.turn[0], FLY.turn[1])
        + (i ? rnd(-0.9, 0.9) : 0));
      // Pulled toward the circuit's own centre, gently. Hard, and it is a
      // moth going round a bulb; not at all, and it is a random walk that
      // ends up in a corner and stays there.
      const yb = F.yaw + wrapPi(y - F.yaw) * (1 - bias)
        + wrapPi(home - F.yaw) * bias;
      const p = clamp(rnd(-0.30, 0.30) + homeP * 0.5, -0.75, 0.75);
      const sp = rnd(FLY.speed[0], FLY.speed[1]);
      headOf(side, yb, p);
      const ax = F.p.x + side.x * sp * 0.34;
      const ay = F.p.y + side.y * sp * 0.34;
      const az = F.p.z + side.z * sp * 0.34;
      if (ax > B.x0 && ax < B.x1 && az > B.z0 && az < B.z1
        && ay > B.y0 && ay < B.y1) { best = [yb, p, sp]; break; }
    }
    if (!best) {
      const cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2, cz = (B.z0 + B.z1) / 2;
      best = [headingTo(cx - F.p.x, cz - F.p.z),
        clamp((cy - F.p.y) * 1.5, -0.7, 0.7), rnd(FLY.speed[0], FLY.speed[1])];
    }
    setHeading(best[0], best[1], best[2]);
    F.seg = rnd(FLY.seg[0], FLY.seg[1]);
    // And the circuit itself: a run of same-way turns, then a flip and a new
    // centre. Without this the track is a random walk with no shape in it, and
    // a fly's track has a shape — it is why "there is a fly going round the
    // room" is a sentence people say.
    if (--F.loop.left <= 0) {
      F.loop.dir = -F.loop.dir;
      F.loop.left = 4 + Math.floor(Math.random() * 6);
      const h = pick(HAUNT);
      F.loop.x = clamp(h[0] + rnd(-0.50, 0.50), FLY.box.x0 + 0.1, FLY.box.x1 - 0.1);
      F.loop.y = clamp(h[1] + rnd(-0.25, 0.25), FLY.box.y0 + 0.1, FLY.box.y1 - 0.1);
      F.loop.z = clamp(h[2] + rnd(-0.50, 0.50), FLY.box.z0 + 0.1, FLY.box.z1 - 0.1);
    }
  }

  /**
   * A landing place: which perch, and the point on it the feet go.
   *
   * `kind` picks one by name for the debug hook; without it the draw is the
   * weighted one, which is where "the ceiling is its favourite place" actually
   * lives.
   *
   * The point comes back stood off along the surface's normal by `FLY.stand`,
   * which is where the body rides when the feet are down — the legs are 2.7 mm
   * long and drop 40 degrees, so the underside of a fly is a little over two
   * millimetres clear of whatever it is standing on. Landing the body ON the
   * plane instead buries half of it, and it is a third of the animal's own
   * width, so it shows.
   */
  function choosePerch(kind) {
    const usable = (s) => !kind || s.k === kind;
    let tot = 0;
    for (const s of PERCH) if (usable(s)) tot += s.w;
    let r = Math.random() * tot;
    let got = null;
    for (const s of PERCH) {
      if (!usable(s)) continue;
      got = s;
      r -= s.w;
      if (r <= 0) break;
    }
    if (!got) got = PERCH[0];
    const at = new THREE.Vector3(s3(got, 'x'), s3(got, 'y'), s3(got, 'z'));
    if (got.k === 'ceiling') {
      at.y = ceilY();
      // With the mezzanine on there is no 5.30 slab: the deck's soffit is the
      // ceiling over the north two thirds and the south third is open to a
      // ridge four metres up, where there is nothing to stand on. So the patch
      // shrinks to what is actually over the room.
      if (loftOn()) at.z = Math.min(at.z, 1.05);
    }
    at.x += got.n[0] * FLY.stand;
    at.y += got.n[1] * FLY.stand;
    at.z += got.n[2] * FLY.stand;
    return { site: got, at };
  }
  // A coordinate of a perch: the fixed one where the surface fixes it, a draw
  // across the patch where it does not.
  function s3(s, k) {
    const v = s[k];
    return Array.isArray(v) ? rnd(v[0], v[1]) : v;
  }

  /** Put it on a perch, this instant, facing anywhere. */
  function alight(hit) {
    const n = hit.site.n;
    F.p.copy(hit.at);
    F.up.set(n[0], n[1], n[2]);
    F.upFrom.copy(F.up);
    F.perch = hit.site;
    F.mode = 'sit';
    F.hold = rnd(FLY.rest[0], FLY.rest[1]);
    F.doing = 'still';
    F.act = rnd(FLY.still[0], FLY.still[1]);
    F.buzz = 0;
    // Facing along the surface, which for a wall or the window means the yaw
    // is measured in a different plane — but the yaw is only ever used to make
    // `fwd`, and `fwd` is re-projected into the surface below, so one number
    // covers all three cases.
    F.yaw = rnd(-Math.PI, Math.PI); F.pitch = 0; F.turnT = 0;
    F.speed = 0; F.speed0 = 0; F.speedD = 0;
  }

  /**
   * Sitting: still, walking, or grooming, and it is the grooming that sells it.
   *
   * A fly at rest is not a static prop. It rubs its front feet together, it
   * wipes its head with them, it scrapes its wings with the back pair, and
   * between bouts it walks a couple of centimetres and stops again. From
   * across a room none of the legs is resolvable and it does not matter: what
   * you see is a speck that twitches, walks a little way and twitches again,
   * and that is unmistakably an insect and not a mark on the plaster.
   */
  function stepSit(dt) {
    F.act -= dt;
    if (F.act <= 0) {
      // Three quarters of the time it grooms or sits, a quarter it walks —
      // and a walk always starts with a turn on the spot, because a fly does
      // not sidle.
      const r = Math.random();
      if (r < 0.34) {
        F.doing = 'walk';
        F.act = rnd(FLY.walk[0], FLY.walk[1]);
        F.yaw = wrapPi(F.yaw + rnd(-2.4, 2.4));
      } else if (r < 0.78) {
        F.doing = Math.random() < 0.62 ? 'front' : 'back';
        F.act = rnd(0.55, 2.10);
      } else {
        F.doing = 'still';
        F.act = rnd(FLY.still[0], FLY.still[1]);
      }
    }
    if (F.doing === 'walk') {
      headOf(fwd, F.yaw, 0);
      // Projected into the surface, so the same yaw walks it across a ceiling,
      // a wall or a table without three cases.
      fwd.addScaledVector(F.up, -fwd.dot(F.up));
      if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0);
      fwd.normalize();
      const s = FLY.step * dt;
      const nx = F.p.x + fwd.x * s, ny = F.p.y + fwd.y * s, nz = F.p.z + fwd.z * s;
      const P = F.perch;
      const ok = (v, r0) => !Array.isArray(r0) || (v > r0[0] && v < r0[1]);
      if (P && ok(nx, P.x) && ok(ny, P.y) && ok(nz, P.z)) {
        F.p.set(nx, ny, nz);
      } else {
        // It has reached the edge of its patch, so it turns round, which is
        // what a fly walking off the edge of a picture frame does.
        F.yaw = wrapPi(F.yaw + rnd(2.0, 4.3));
      }
      F.rock += (0.35 - F.rock) * Math.min(1, dt * 10);
      F.wig = 0;
    } else if (F.doing === 'still') {
      F.rock += (0 - F.rock) * Math.min(1, dt * 8);
      F.wig = 0;
    } else {
      // A groom is fast — six or seven strokes a second — and the body rocks
      // with it, which is the half of it that carries across a room.
      F.wig = F.doing === 'front' ? 1 : -1;
      F.rock += (1 - F.rock) * Math.min(1, dt * 14);
    }
    F.hold -= dt;
    if (F.hold <= 0) {
      F.mode = 'off';
      F.u = 0;
      F.upFrom.copy(F.up);
      F.doing = 'still'; F.wig = 0;
      // Straight up off the surface and then away: the take-off heading is
      // whatever the room offers, and the first saccade a hundred
      // milliseconds later will have an opinion about it.
      F.yaw = rnd(-Math.PI, Math.PI);
      F.pitch = 0; F.turnT = 0;
      F.speed = 0.20; F.speed0 = 0.20; F.speedD = 0;
    }
  }

  // ── being hit with the hose ─────────────────────────────────────────────────
  /**
   * Where a fly at (x, z) is allowed to end up: the nearest clear patch of
   * tile, with the point clamped into it.
   *
   * Nearest and not random, because the one thing the player has to be able to
   * do afterwards is find it — a fly swatted over the low table that lands
   * behind the bookshelf is a fly that did not land at all as far as anybody
   * watching is concerned. See DEATH.floors for where the rectangles come from.
   */
  function deathBed(x, z) {
    let best = null, bd = Infinity;
    for (const R of DEATH.floors) {
      const cx = clamp(x, R.x0, R.x1), cz = clamp(z, R.z0, R.z1);
      const d = (cx - x) * (cx - x) + (cz - z) * (cz - z);
      if (d < bd) { bd = d; best = [cx, cz]; }
    }
    return best || [1.9, 0.5];
  }

  /**
   * Hit. Everything after this is the fly dying.
   *
   * Returns false if there was nothing to hit, which is the caller's cue that
   * it did not happen — the app puts a whole camera sequence on the back of
   * this and must not start one for a fly that is already on the floor.
   *
   * A SITTING FLY CAN BE HIT, and that is deliberate. The obvious reading is
   * that a swat is a thing you do to something in the air, but nobody has ever
   * swatted a fly in the air: you hit it on the wall, on the window, on the
   * table, in the fraction of a second before it goes. It is also the only
   * version that is fair — the animal spends the larger half of its life
   * sitting still (see the note at the top of this block), and a hit test that
   * excluded that would be a hit test that was off more than it was on.
   */
  function swat() {
    if (F.mode === 'spin' || F.mode === 'dead') return false;
    const bed = deathBed(F.p.x, F.p.z);
    F.mode = 'spin';
    F.held = false;
    F.buzz = 1;
    // Which way it goes round: whichever way it was already turning, because
    // it is the fly's own momentum and not a coin.
    const dir = F.loop.dir;
    // The orbit it opens on is the one it is already flying. The angle is set
    // so that the tangent at u = 0 is the heading it has this instant, and the
    // circle's centre is put wherever that requires — which means the first
    // frame of the spiral is exactly where the last frame of the flight was,
    // going the same way, and there is no cut in the middle of a shot that is
    // about to zoom in on it.
    //
    // The centre then DRIFTS to the patch of floor it is going to die on. That
    // is the part the first pass got wrong: it centred the orbit on the
    // landing point from the first frame, so a fly hit at the terrace window,
    // 2.2 m from the nearest clear tile, teleported the whole 2.2 m on frame
    // one and then spiralled tidily down from the wrong place. A spiral that
    // translates while it turns is what falling out of control looks like
    // anyway; a spiral around a fixed axis is a fairground ride.
    const a0 = F.yaw - dir * Math.PI / 2;
    F.die = {
      t: 0,
      bx: bed[0], bz: bed[1],
      cx: F.p.x - Math.cos(a0) * DEATH.r0,
      cz: F.p.z - Math.sin(a0) * DEATH.r0,
      a0,
      y0: F.p.y,
      spun: 0, tumble: 0,
      dir,
    };
    return true;
  }

  /**
   * One frame of the spiral.
   *
   * The orbit is analytic — angle and radius as functions of how far through
   * the fall it is — rather than integrated, and that is on purpose: this is
   * two seconds of a shot that has to arrive at one exact point on the floor
   * with the camera already pointed at it, and an integrator that is 3 cm out
   * at the end is a cut to a fly that is not in frame.
   */
  function stepDie(d) {
    const D = F.die;
    D.t += d;
    const u = clamp(D.t / DEATH.fall, 0, 1);
    // Accelerating down, because it is falling as much as flying by the end.
    const drop = u * u * (3 - u) / 2;
    // And tightening. The orbit angle goes as u², so the last quarter of the
    // fall is half of the turning — which is what a spiral that is closing
    // does, and is the part everybody actually sees.
    const spun = TAU * DEATH.turns * u * u;
    D.spun = spun;
    const r = lerp(DEATH.r0, DEATH.r1, u * u);
    const a = D.a0 + D.dir * spun;
    // The axis, on its way from where it was hit to where it is going to lie.
    const cx = lerp(D.cx, D.bx, drop);
    const cz = lerp(D.cz, D.bz, drop);
    F.p.x = clamp(cx + Math.cos(a) * r, HARD.x0, HARD.x1);
    F.p.z = clamp(cz + Math.sin(a) * r, HARD.z0, HARD.z1);
    const floor = plan.floor + FLY.stand;
    F.p.y = lerp(D.y0, floor, drop);
    // Its own tumble, which is not the orbit: the body is turning end over end
    // inside a circle it is being carried round, and both are needed or it
    // reads as a model aeroplane on a string.
    D.tumble += d * lerp(DEATH.tumble[0], DEATH.tumble[1], u);
    // Heading is the tangent of the orbit, so it is at least pointing the way
    // it is travelling — which a fly with one wet wing very nearly is.
    F.yaw = a + D.dir * Math.PI / 2;
    F.pitch = -0.5 * u;
    F.speed = TAU * r * DEATH.turns / DEATH.fall;
    F.hz = lerp(DEATH.hz[0], DEATH.hz[1], u);
    if (u >= 1) settle(D.bx, D.bz);
  }

  /**
   * Down. Put a corpse where it landed and take the live one away.
   *
   * The corpse is a separate object and not the fly frozen: the fly has to be
   * able to be alive again — see `hatch` — and a room with one mesh in it
   * cannot have both a dead fly on the tile and a live one at the window,
   * which is exactly the state this room is in two minutes later.
   */
  function settle(x, z) {
    F.mode = 'dead';
    F.buzz = 0;
    F.die = null;
    F.p.set(x, plan.floor + 0.0004, z);
    flyRig.visible = false;
    if (audio) audio.fly(0);
    if (corpseProto) {
      let c;
      if (corpses.length < DEATH.keep) {
        c = corpseProto.clone();
        c.visible = true;
        root.add(c);
        corpses.push(c);
      } else {
        // Four dead flies on the floor of a four-metre room is already a
        // story; a fifth is a bug report. The oldest gets swept up.
        c = corpses.shift();
        corpses.push(c);
      }
      c.position.copy(F.p);
      // On its back, and rolled a third of a right angle off it, which is
      // where a domed thing with a wing folded under each side of it actually
      // comes to rest. CORPSE_ROLL, so the speck on the tile and the close-up
      // that cuts to it are lying at the same angle.
      c.rotation.set(Math.PI - CORPSE_ROLL, Math.random() * TAU, 0);
    }
    // And the next one, in a few minutes.
    F.again = rnd(DEATH.again[0], DEATH.again[1]);
  }

  /**
   * Another fly.
   *
   * The choice here was: is the flat silent for the rest of the session, or
   * does another one find its way in? It is another one, and the argument is
   * the terrace door. This is a ground-floor-plus-one flat on the Dalmatian
   * coast in August with a 2.2 m opening on to a beach standing open all day;
   * the room does not become fly-proof because you got the one that was in it.
   * A room that went permanently quiet would also make the swat a thing you
   * can do exactly once per session, and it is far too good to be a one-shot.
   *
   * It comes in at the terrace door, high, and goes about its business, and
   * the one you killed is still on the tile behind it.
   */
  function hatch() {
    F.mode = 'cruise';
    F.p.set(rnd(1.10, 2.30), rnd(4.55, 4.95), 3.40);
    F.up.set(0, 1, 0);
    F.upFrom.set(0, 1, 0);
    F.yaw = rnd(-Math.PI, Math.PI); F.pitch = 0; F.turnT = 0;
    F.speed = 0.8; F.speed0 = 0.8; F.speedD = 0;
    F.perch = null;
    F.hold = rnd(FLY.air[0], FLY.air[1]);
    F.seg = 0;
    F.buzz = 0;
    F.again = 0;
    flyRig.visible = true;
    saccade(0.5);
  }

  /** Wings out or wings folded, and the legs doing whatever they are doing. */
  function poseFly(dt) {
    const air = F.mode !== 'sit';
    // 25 degrees out and swept back in the air, folded down the abdomen on the
    // ground. Fast, because a fly folds its wings the instant it is down.
    const wantS = air ? 0.42 : 0.09;
    const wantT = air ? -0.12 : 0.02;
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      const w = flyWing[i];
      w.rotation.y += (s * wantS - w.rotation.y) * Math.min(1, dt * 16);
      w.rotation.z += (wantT - w.rotation.z) * Math.min(1, dt * 16);
    }
    // Thinner in the air than on the ground, which is what a smear is: two
    // wings beating 190 times a second are not two sheets, they are a haze
    // with the room showing through. Folded, they are actual membrane over
    // the abdomen and there is more of them to see.
    flyWingMat.uniforms.uOpacity.value = air ? 0.20 : 0.34;
    // The front pair rubbing, or the back pair over the wings. `wig` says
    // which, `act` runs the clock, and outside a bout everything returns to
    // the stance.
    const t = performance.now() / 1000;
    const beat = Math.sin(t * 42) * (F.wig ? 1 : 0);
    for (let i = 0; i < 6; i++) {
      const s = i & 1 ? 1 : -1;
      const row = i >> 1;
      const [sweep, droop] = air ? LEG_AIR[row] : LEG_STAND[row];
      const on = !air && ((F.wig > 0 && row === 0) || (F.wig < 0 && row === 2));
      const g = flyLeg[i];
      const wantY = s * sweep + (on ? s * 0.55 * beat : 0);
      const wantZ = droop + (on ? 0.40 * beat : 0);
      g.rotation.y += (wantY - g.rotation.y) * Math.min(1, dt * 20);
      g.rotation.z += (wantZ - g.rotation.z) * Math.min(1, dt * 20);
    }
  }

  /**
   * A frame of the fly.
   *
   * `who` is the person, in world metres — the ear the buzz arrives at.
   */
  function stepFly(dt, who) {
    if (!who) { poseFly(dt); return; }
    // What it costs when nobody is in the flat: two subtractions. The house is
    // 2 km from the origin and this thing is 7 mm across, so there is no
    // distance at which it is worth stepping and cannot be seen.
    const dx = who.x - root.position.x, dz = who.z - root.position.z;
    const near = dx * dx + dz * dz < 30 * 30;
    if (!near) {
      if (!F.far) { F.far = true; flyRig.visible = false; if (audio) audio.fly(0); }
      // The one thing that keeps running with nobody in the flat: the clock on
      // the next fly. Gate it on being watched and the room stays empty until
      // you have STOOD in it for four minutes, which nobody does — you kill
      // the fly, go down to the beach, come back, and the flat is a museum.
      // A fly comes in through the terrace door whether or not you are there
      // to see it, so this is two subtractions and a branch, out here.
      if (F.mode === 'dead') {
        F.again -= Math.min(dt, 0.05);
        if (F.again <= 0) { hatch(); flyRig.visible = false; F.far = true; }
      }
      return;
    }
    if (F.far) { F.far = false; flyRig.visible = true; }

    const d = Math.min(dt, 0.05);
    // `hold` freezes the animal and NOT the frame: the mesh is still placed
    // where the state says it is, and the buzz still measured off it. It stops
    // early once — the first version returned before the pose — and the fly
    // then stayed drawn wherever it had last been stepped while `go()` moved
    // it somewhere else, which is a debug handle that lies.
    if (F.held) { poseRig(d, who); return; }
    switch (F.mode) {
      case 'cruise': {
        F.seg -= d;
        // The wall, which triggers a saccade of its own — and this is not a
        // cheat bolted on to a wander. A real fly saccades BECAUSE the wall is
        // expanding in its eye; a turn that happens at a wall and points back
        // into the room is the mechanism, not a correction to it.
        headOf(fwd, F.yaw, F.pitch);
        const B = FLY.box;
        const ax = F.p.x + fwd.x * F.speed * 0.22;
        const ay = F.p.y + fwd.y * F.speed * 0.22;
        const az = F.p.z + fwd.z * F.speed * 0.22;
        const out = ax < B.x0 || ax > B.x1 || az < B.z0 || az > B.z1
          || ay < B.y0 || ay > B.y1;
        if (F.seg <= 0 || out) saccade(out ? 0.55 : 0.28);
        break;
      }
      case 'in': {
        // Homing: the same saccades, shorter, aimed mostly at a point 14 cm
        // off the surface. It is not a glide path — a fly arrives at a ceiling
        // in the same jerks it crossed the room in.
        F.seg -= d;
        if (F.seg <= 0) {
          aimV.subVectors(F.aim, F.p);
          const len = aimV.length() || 1;
          // Slowing into it, but not creeping: at 2.2 times the distance
          // remaining the last twenty centimetres took three seconds, and a
          // fly does not hover its way on to a ceiling — it arrives.
          setHeading(headingTo(aimV.x, aimV.z) + rnd(-0.32, 0.32),
            Math.asin(clamp(aimV.y / len, -1, 1)) + rnd(-0.22, 0.22),
            clamp(len * 2.6, 0.38, 1.05));
          F.seg = rnd(0.07, 0.20);
        }
        // Close enough to flare — or long enough trying. The timeout has
        // never fired in ten minutes of recorded flying, and it is here so
        // that a heading the jitter got badly wrong cannot leave the animal
        // circling a spot on the ceiling for the rest of the afternoon.
        F.hold -= d;
        if (F.p.distanceTo(F.aim) < 0.055 || F.hold <= 0) {
          F.mode = 'down'; F.u = 0;
          F.upFrom.copy(F.up);
          F.from.copy(F.p);
        }
        break;
      }
      case 'down': {
        F.u += d / FLY.land;
        if (F.u >= 1) {
          alight({ site: F.perch, at: F.aimSurf });
          break;
        }
        // In along the normal, decelerating, and rolling over as it goes. On
        // the ceiling that roll IS the somersault a fly does to get its feet
        // up there, and at 160 ms it is the right length for one.
        const e = F.u * F.u * (3 - 2 * F.u);
        const n = F.perch.n;
        F.p.lerpVectors(F.from, F.aimSurf, e);
        upN.set(n[0], n[1], n[2]);
        F.up.copy(F.upFrom).lerp(upN, e);
        if (F.up.lengthSq() < 1e-6) F.up.copy(upN);
        F.up.normalize();
        break;
      }
      case 'off': {
        F.u += d / FLY.off;
        const n = F.perch ? F.perch.n : [0, 1, 0];
        F.p.x += n[0] * 0.55 * d; F.p.y += n[1] * 0.55 * d; F.p.z += n[2] * 0.55 * d;
        upN.set(0, 1, 0);
        F.up.copy(F.upFrom).lerp(upN, Math.min(1, F.u)).normalize();
        F.speed = 0.20 + 0.9 * Math.min(1, F.u);
        if (F.u >= 1) {
          F.mode = 'cruise';
          F.up.set(0, 1, 0);
          F.hold = rnd(FLY.air[0], FLY.air[1]);
          F.seg = 0;
          F.pitch = clamp(0.5 * -n[1], -0.6, 0.6);
          saccade(0.5);
        }
        break;
      }
      case 'spin':
        // Hit. The spiral owns the position outright — it is not a heading and
        // a speed any more — so this returns rather than falling through to
        // the integrator and the perch logic below, both of which would be
        // arguing with it.
        stepDie(d);
        poseRig(d, who);
        return;
      case 'dead':
        // Nothing to step but the clock on the next one. The corpse is a
        // separate object standing where it fell and does not need a frame.
        F.again -= d;
        if (F.again <= 0) hatch();
        poseRig(d, who);
        return;
      default:
        stepSit(d);
        break;
    }

    // The 30 ms, which is the only interpolation in the whole animal.
    if (F.turnT > 0) {
      F.turnT -= d;
      const u = clamp(1 - Math.max(0, F.turnT) / FLY.snap, 0, 1);
      F.yaw = wrapPi(F.yaw0 + F.yawD * u);
      F.pitch = F.pitch0 + F.pitchD * u;
      F.speed = F.speed0 + F.speedD * u;
    }

    if (F.mode === 'cruise' || F.mode === 'in' || F.mode === 'off') {
      headOf(fwd, F.yaw, F.pitch);
      F.p.addScaledVector(fwd, F.speed * d);
      // And the net. `saccade` is what keeps it in the room; this is only here
      // so that no arithmetic anywhere above can ever put a fly through a wall.
      F.p.x = clamp(F.p.x, HARD.x0, HARD.x1);
      F.p.y = clamp(F.p.y, HARD.y0, ceilY() + 0.001);
      F.p.z = clamp(F.p.z, HARD.z0, HARD.z1);
    }

    // Time to look for somewhere to sit.
    if (F.mode === 'cruise') {
      F.hold -= d;
      if (F.hold <= 0) {
        const hit = choosePerch();
        F.perch = hit.site;
        F.aimSurf.copy(hit.at);
        const n = hit.site.n;
        F.aim.copy(F.aimSurf);
        F.aim.x += n[0] * 0.14; F.aim.y += n[1] * 0.14; F.aim.z += n[2] * 0.14;
        F.mode = 'in';
        F.seg = 0;
        F.hold = 8;
      }
    }

    poseRig(d, who);
  }

  /**
   * Where the state says the animal is: the mesh, the wings, the legs, and
   * what it sounds like from where you are standing.
   *
   * Its own function rather than the tail of `stepFly` because `hold` has to
   * be able to run it without running the simulation — see the note there.
   */
  function poseRig(d, who) {
    headOf(fwd, F.yaw, F.pitch);
    if (F.mode === 'sit' || F.mode === 'down') {
      // On a surface the heading lies in the surface, not in the world.
      fwd.addScaledVector(F.up, -fwd.dot(F.up));
      if (fwd.lengthSq() < 1e-6) fwd.set(F.up.y, -F.up.x, 0);
      fwd.normalize();
    }
    upN.copy(F.up);
    if (Math.abs(upN.dot(fwd)) > 0.98) upN.set(0, 1, 0);
    side.crossVectors(fwd, upN).normalize();
    upN.crossVectors(side, fwd).normalize();
    // Nose up, in the air, and it is not decoration. A fly does not point
    // where it is going: the wing stroke plane is roughly level whatever the
    // body is doing, so at anything under its own top speed the body hangs
    // under the wings at twenty or thirty degrees to the flight path — which
    // is why a fly crossing a room in front of you looks like it is climbing
    // when it is not. Rotated about the body's own side axis, so it works
    // upside down and on the way out of a ceiling as well.
    if (F.mode !== 'sit' && F.mode !== 'down') {
      const a = 0.38 * (1 - 0.5 * clamp((F.speed - FLY.speed[0])
        / (FLY.speed[1] - FLY.speed[0]), 0, 1));
      const c2 = Math.cos(a), s2 = Math.sin(a);
      aimV.copy(fwd);
      fwd.multiplyScalar(c2).addScaledVector(upN, s2).normalize();
      upN.multiplyScalar(c2).addScaledVector(aimV, -s2).normalize();
      side.crossVectors(fwd, upN).normalize();
    }
    // The grooming rock, on the body's own two axes so it reads whichever way
    // up the fly is.
    if (F.rock > 0.002) {
      const t = performance.now() / 1000;
      const a = F.rock * 0.14 * Math.sin(t * (F.wig ? 44 : 13));
      const b = F.rock * 0.10 * Math.sin(t * (F.wig ? 31 : 9) + 1.1);
      upN.addScaledVector(fwd, -a).addScaledVector(side, b).normalize();
      side.crossVectors(fwd, upN).normalize();
    }
    basis.makeBasis(fwd, upN, side);
    flyRig.quaternion.setFromRotationMatrix(basis);
    // And the tumble, on top of whatever heading it has: about the body's own
    // long axis and about its side at once, so it is going over and round at
    // the same time. Multiplied on to the basis rather than replacing it, so
    // the orbit is still legible under the spinning.
    if (F.mode === 'spin' && F.die) {
      _tq.setFromAxisAngle(_ax.set(1, 0, 0), F.die.tumble);
      flyRig.quaternion.multiply(_tq);
      _tq.setFromAxisAngle(_ax.set(0, 0, 1), F.die.tumble * 0.42);
      flyRig.quaternion.multiply(_tq);
    }
    flyRig.position.copy(F.p);
    poseFly(d);

    // ── and what it sounds like ──────────────────────────────────────────────
    // Airborne or not, first, because that is the whole of it: the buzz is the
    // wings and the wings are either going or they are not.
    const airborne = F.mode !== 'sit' && F.mode !== 'dead';
    F.buzz += ((airborne ? 1 : 0) - F.buzz) * Math.min(1, d * 40);
    // Faster wings when it is working, which is audible: a fly coming out of a
    // turn or off a ceiling is a semitone up on one crossing the room. In the
    // spiral `stepDie` has already set it — a fly fighting a wet wing is not
    // beating at the speed it is travelling at, which is the whole tell — so
    // this leaves it alone.
    if (F.mode !== 'spin') {
      F.hz = 0.94 + 0.34 * clamp((F.speed - FLY.speed[0])
        / (FLY.speed[1] - FLY.speed[0]), 0, 1) + (F.mode === 'off' ? 0.22 : 0);
    }
    if (!audio) return;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const [wx, wy, wz] = flyWorld();
    const ex = who.x - wx, ey = who.y - wy, ez = who.z - wz;
    const dist = Math.sqrt(ex * ex + ey * ey + ez * ez);
    // Inside the flat with it, and nowhere else — the same shape of test the
    // near clip and the room's own dimming use in `indoorsAt`, run on the
    // LISTENER rather than on the fly. A buzz audible from the promenade is
    // not a fly in a room, it is a fly in your headphones. Ramped over the
    // last 35 cm so that the doorway is a fade rather than a switch, and
    // banded to the upper storey so that it is not heard downstairs either.
    const hx = who.x - root.position.x, hz2 = who.z - root.position.z;
    const lx = hx * c - hz2 * s, lz = hx * s + hz2 * c, ly = who.y - base;
    const O = plan.outer;
    const off = Math.hypot(Math.max(O.x0 - lx, lx - O.x1, 0),
      Math.max(O.z0 - lz, lz - O.z1, 0));
    const storey = ly > plan.floor - 0.7 && ly < plan.floor + 2.9 ? 1 : 0;
    const inFlat = storey * clamp(1 - off / 0.35, 0, 1);
    // Linear in distance and not squared, for the reason written over the
    // Bucketeer's hum: squared, it is gone at two metres, which is well inside
    // the range at which you can see the thing making it.
    const far = Math.pow(clamp(1 - dist / FLY.hear, 0, 1), 1.6);
    let pan = 0;
    if (camera && camera.matrixWorld) {
      // Which ear. The camera's own right vector and not the walker's, because
      // the pan is about the head the sound arrives at — the same reach for the
      // app's camera that 49-you.js and 60-arms.js make.
      camRight.setFromMatrixColumn(camera.matrixWorld, 0);
      pan = clamp((camRight.x * -ex + camRight.z * -ez)
        / Math.max(0.30, dist), -1, 1) * 0.85;
    }
    // The spiral is louder, and it is louder in the one place there is room to
    // be: the gain the level is measured against, which 80-audio.js takes as an
    // argument for exactly this. Not by raising the idle buzz, which is a
    // separate question and is still open. See FLYBUZZ.death.
    //
    // The distance and doorway terms stay on. They are the reason the whole
    // thing is not simply audible from the promenade, and a fly dying loudly in
    // a room you are not in is still a fly in a room you are not in.
    // Unless the swat's close-up has the buzz — see `fly.buzz` below. A fly
    // getting up off the tile in a shot is not the corpse in the room, which is
    // silent, and the two would otherwise take turns at the one voice.
    if (buzzOver >= 0) { audio.fly(buzzOver, 1.14, 0, false); return; }
    audio.fly(F.buzz * far * inFlat, F.hz, pan, F.mode === 'spin');
  }

  /** The clock, the fan, the set, the fly, and the towel on the terrace. */
  function tickHouse(dt, who) {
    tickClock();
    stepFly(dt || 0, who);
    stepTowel(dt, who);
    stepAwning(dt);
  }

  return {
    root, parts, plan, base, yaw,
    floorAt, blockers, tight, indoorsAt, ductAt, hull, headroom,
    tick: tickHouse,
    /**
     * The awning on its crank. `near` is whether a person stood at (x, y, z)
     * in world metres has the handle to hand; `toggle` winds it the other
     * way; `offer` names what E would do, for the line on the screen.
     */
    awning: {
      near(x, y, z) {
        if (!awning.grip) return false;
        const p = awning.grip.getWorldPosition(new THREE.Vector3());
        // `y` is the person's eye (ground.you.y, 1.66 over the floor), and a
        // foot is let through too: anywhere from just under the terrace to a
        // head over it. Under the terrace, on the porch, it is not to hand.
        const up = y - (base + VIK.floor);
        return Math.hypot(p.x - x, p.z - z) < AWN.reach && up > -0.3 && up < 2.1;
      },
      toggle() {
        awning.to = awning.e !== awning.to ? (awning.to ? 0 : 1) : (awning.e > 0.5 ? 0 : 1);
        return awning.to;
      },
      offer: () => (awning.e !== awning.to ? 'back' : awning.e > 0.5 ? 'in' : 'out'),
      /** Debug: put it anywhere, 0 in to 1 out, at once. */
      set(e) { awning.e = awning.to = clamp(e, 0, 1); awning.shape(awning.e); return awning.e; },
      state: () => ({ e: +awning.e.toFixed(3), to: awning.to, turns: +(awning.phase / (Math.PI * 2)).toFixed(2),
        tilt: +awning.tilt.toFixed(3) }),
      grip: () => (awning.grip ? awning.grip.getWorldPosition(new THREE.Vector3()).toArray() : null),
    },
    /** The towel on the terrace rail: the cloth's own probe (`brodEnsign`). */
    towel: () => (towel.cloth ? towel.cloth.stats() : null),
    /** The television: where it is in world metres, and the knock. */
    tv: {
      at: () => { const [wx, wz] = world(tv.at[0], tv.at[2]);
        return [wx, base + tv.at[1], wz]; },
      knock: () => tv.knock(),
      page: () => tv.page(),
      live: () => tv.live(),
      news: () => tv.news(),
      feed: (n) => tv.feed(n),
      png: () => tv.png(),
    },
    /** 'now' | 'loft' — which roof is on. The rooms below do not change. */
    roof(which) {
      for (const k of ['roof', 'roof_glass', 'roof_sheer', 'roof_kupe']) {
        if (parts[k]) parts[k].visible = which !== 'loft';
      }
      for (const k of ['loft', 'loft_glass', 'loft_sheer', 'loft_kupe']) {
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
    /**
     * The fly — src/90-app.js hangs `__fr.fly` off this.
     *
     * It exists for the same reason every other handle in this file does: the
     * thing it drives happens on a clock nobody can wait for. Ten seconds of
     * a housefly is a landing and a take-off; a headless page runs about one
     * frame a second, so waiting for a screenshot of a fly sitting on the
     * ceiling is waiting for something that will not happen.
     */
    fly: {
      /** Where it is in world metres, which is what a camera wants. */
      at: () => flyWorld(),
      /**
       * And in the house's own metres, which is what a perch is written in.
       *
       * To five places rather than the three `stats` prints, because this is
       * the one a recorded track is plotted from: the animal itself is 7 mm
       * long, so a millimetre of rounding on a 15 mm step is three degrees of
       * heading noise and it swamps the only measurement that matters here —
       * how straight a straight segment is.
       */
      here: () => [+F.p.x.toFixed(5), +F.p.y.toFixed(5), +F.p.z.toFixed(5)],
      /**
       * Put it where you want it.
       *
       * `cruise` sends it up, `land` starts an approach it will fly properly,
       * and a perch name — ceiling, window, wall, desk, table, tv — puts it
       * there this instant, sitting, which is the one a screenshot wants.
       */
      go: (what = 'ceiling') => {
        if (what === 'cruise' || what === 'up') {
          if (F.mode === 'sit') { F.hold = 0; stepSit(0.0001); }
          else { F.mode = 'cruise'; F.hold = rnd(FLY.air[0], FLY.air[1]); }
        } else if (what === 'land') {
          // From the air only. Forcing 'cruise' on a sitting fly would leave
          // it hanging a couple of millimetres off whatever it was standing
          // on with its wings folded, for the frame before it noticed.
          if (F.mode === 'sit') return 'sitting';
          F.mode = 'cruise'; F.hold = 0;
        } else {
          alight(choosePerch(what));
        }
        return F.mode;
      },
      /** Hold it still, so a photograph of it is a photograph of one frame. */
      hold: (on = true) => { F.held = !!on; return F.held; },
      /** Run its clock forward without waiting for the wall one. */
      step: (secs = 1, who = null, dtStep = 1 / 60) => {
        for (let t = 0; t < secs; t += dtStep) stepFly(dtStep, who);
        return F.mode;
      },
      /**
       * Hit it with the hose. See `swat` above for what that starts, and
       * src/90-app.js for who decides that the water arrived.
       *
       * Comes back false if there is nothing to hit — already spiralling, or
       * already on the tile — which is what stops a second jet of water
       * starting a second camera sequence over the first.
       */
      swat: () => swat(),
      /**
       * Kill it where it is, without the water. The whole sequence is two
       * seconds long and needs a hose, a room and a hit, and none of those is
       * available to a headless page that wants a picture of the corpse.
       */
      kill: () => {
        if (!swat()) return F.mode;
        // Straight to the floor rather than through the spiral, because the
        // spiral is what `step()` is for and this is the shortcut past it.
        stepDie(DEATH.fall + 0.001);
        return F.mode;
      },
      /**
       * How long the spiral lasts. The camera sequence in src/90-app.js is cut
       * to it and the two must not be able to disagree — a shot that cuts to
       * the close-up a quarter of a second before the animal lands is a shot
       * of a fly that is still in the air.
       */
      fallSecs: () => DEATH.fall,
      /** Alive again, at the terrace door, and the corpses stay where they are. */
      revive: () => { hatch(); return F.mode; },
      /** What it is doing, as one word, without building `stats()` for it. */
      mode: () => F.mode,
      /**
       * Hand the buzz to somebody else: a level, or null to give it back. The
       * swat's resurrection is the only caller — the corpse getting up in the
       * close-up is loud, and the corpse on the tile it is a picture of is not.
       */
      buzz: (v) => { buzzOver = v == null ? -1 : clamp(v, 0, 1); return buzzOver; },
      /**
       * The newest corpse gets up: it comes off the tile and its house-metre
       * position is handed back, for src/45-zombie.js to put a live one at.
       * Null if the floor is clean.
       *
       * The newest and not the nearest, because the only caller is the swat's
       * own resurrection and the fly in that shot is the one that just died.
       */
      raise: () => {
        const c = corpses.pop();
        if (!c) return null;
        root.remove(c);
        return [c.position.x, c.position.y, c.position.z];
      },
      /**
       * A copy of the live animal for something else to fly, in the house's
       * own metres — it goes under `root` exactly as this one does. The
       * children are in the order they were built: four lumps, the two wing
       * pivots, the six leg pivots.
       */
      kit: () => {
        const rig = flyRig.clone(true);
        rig.visible = true;
        rig.position.set(0, 0, 0);
        rig.quaternion.identity();
        return { rig, wings: rig.children.slice(4, 6), legs: rig.children.slice(6, 12),
          wingMat: flyWingMat };
      },
      /** Is there a live one in the room? */
      alive: () => F.mode !== 'dead' && F.mode !== 'spin',
      /** Where the dead ones are lying, in the house's own metres. */
      dead: () => corpses.map((c) => [+c.position.x.toFixed(3),
        +c.position.y.toFixed(3), +c.position.z.toFixed(3)]),
      /**
       * The close-up, built on demand and kept.
       *
       * Twenty thousand triangles and eleven materials that most sessions will
       * never ask for — see the head of src/44-corpse.js — so nothing exists
       * until the first fly dies, and after that it is the same shot.
       */
      shot: () => {
        if (!corpseShot) corpseShot = buildFlyCorpse();
        return corpseShot;
      },
      /** Every perch it knows, for a test that wants to visit all of them. */
      perches: () => PERCH.map((s) => s.k),
      stats: () => ({
        mode: F.mode,
        doing: F.mode === 'sit' ? F.doing : null,
        perch: F.perch ? F.perch.k : null,
        // House-local, because that is the frame every number above is in.
        at: [+F.p.x.toFixed(3), +F.p.y.toFixed(3), +F.p.z.toFixed(3)],
        aim: F.mode === 'in' || F.mode === 'down'
          ? [+F.aimSurf.x.toFixed(3), +F.aimSurf.y.toFixed(3),
            +F.aimSurf.z.toFixed(3)] : null,
        yaw: +F.yaw.toFixed(3),
        pitch: +F.pitch.toFixed(3),
        speed: +F.speed.toFixed(3),
        // What is left of this straight segment, and of the 30 ms turn at the
        // end of it. A reading with `turn` above zero is a fly mid-saccade.
        seg: +Math.max(0, F.seg).toFixed(3),
        turn: +Math.max(0, F.turnT).toFixed(3),
        loop: F.loop.dir > 0 ? 'cw' : 'ccw',
        hold: +Math.max(0, F.hold).toFixed(2),
        buzz: +F.buzz.toFixed(3),
        hz: +(192 * F.hz).toFixed(1),
        up: [+F.up.x.toFixed(2), +F.up.y.toFixed(2), +F.up.z.toFixed(2)],
        held: F.held,
        drawn: flyRig.visible,
      }),
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
