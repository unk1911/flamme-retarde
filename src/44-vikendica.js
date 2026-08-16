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

  // The outside stair: seventeen risers of 17 up the east face, sixteen goings
  // of 25 along it, in house-local three.js metres. The landing is at the top
  // and it covers the doorway, which took a change in the Blender file to be
  // true: the flight used to arrive *in* the opening, so the last thing between
  // the promenade and the front door was an 18 cm step with nothing to stand on
  // while you crossed it. Walking in was a fall.
  //
  // `x0` deliberately overlaps the east wall. The outer face is at 3.39 and the
  // flight starts at 3.46, and that 7 cm of nothing was a slot the width of a
  // finger where the floor was neither the house's nor the stair's — so you
  // dropped 2.9 m through the doorstep. Surfaces that meet must overlap.
  stair: { x0: 3.30, x1: 4.62, z0: 0.76, z1: 5.01 },
  landing: { x0: 3.30, x1: 4.62, z0: -0.42, z1: 0.80 },

  // And the ladder-stair inside, up the east wall of the big room: fourteen
  // treads, 2.55 m of rise in 2.60 of run.
  loftStair: { x0: 2.20, x1: 3.15, z0: 1.02, z1: 3.80 },
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

  const parts = {};
  for (const key of ['shell', 'roof', 'loft',
                     'shell_glass', 'roof_glass', 'loft_glass']) {
    const b64 = PAYLOAD['vikendica_' + key + '_fr3d'];
    const glass = key.endsWith('_glass');
    if (!b64) { if (!glass) console.warn('no vikendica payload:', key); continue; }
    try {
      const geo = readFR3D(await inflateBinary(b64));
      const mesh = new THREE.Mesh(geo, glass ? glassMat : mat);
      mesh.castShadow = !glass;
      mesh.receiveShadow = true;
      if (glass) mesh.renderOrder = 3;
      root.add(mesh);
      parts[key] = mesh;
    } catch (e) {
      console.warn('vikendica failed:', key, e.message);
    }
  }
  for (const k of ['loft', 'loft_glass']) if (parts[k]) parts[k].visible = false;

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
  let loftRail = null;

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
    for (const b of plan.blockers) push(b);
    // The terrace's three open edges — its railing, which is a real railing and
    // has to stop you the way the drawn one would. Without them the terrace is
    // a floor at +2.90 you can walk off, and worse, walk on to from the lane.
    const T = plan.rooms.terrace;
    push({ x0: T.x0, x1: T.x1, z0: T.z1 - 0.08, z1: T.z1 });
    push({ x0: T.x0, x1: T.x0 + 0.08, z0: T.z0, z1: T.z1 });
    push({ x0: T.x1 - 0.08, x1: T.x1, z0: T.z0, z1: T.z1 });
    // The open side of the flight and of the landing, so you go up it rather
    // than off it, and the rail across the head of the landing.
    push({ x0: VIK.stair.x1 - 0.06, x1: VIK.stair.x1,
           z0: VIK.landing.z0, z1: VIK.stair.z1 + 0.5 });
    push({ x0: VIK.landing.x0, x1: VIK.landing.x1,
           z0: VIK.landing.z0 - 0.08, z1: VIK.landing.z0 });
    // The gallery rail, which is there only when the mezzanine is.
    loftRail = push(
      { x0: VIK.loftDeck.x0, x1: VIK.loftStair.x0, z0: 1.14, z1: 1.26 },
      { off: true, y0: base + VIK.deck - 1.1, y1: base + VIK.deck + 2.4 });
    return out;
  }

  const world = (x, z) => {
    const w = field.toWorld(VIK.t + x, VIK.s - z);
    return [w[0], w[2]];
  };

  return {
    root, parts, plan, base, yaw,
    floorAt, blockers, tight,
    /** 'now' | 'loft' — which roof is on. The rooms below do not change. */
    roof(which) {
      for (const k of ['roof', 'roof_glass']) {
        if (parts[k]) parts[k].visible = which !== 'loft';
      }
      for (const k of ['loft', 'loft_glass']) {
        if (parts[k]) parts[k].visible = which === 'loft';
      }
      if (loftRail) loftRail.off = which !== 'loft';
      return which;
    },
    get roofNow() { return parts.loft && parts.loft.visible ? 'loft' : 'now'; },
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
