// -----------------------------------------------------------------------------
// The vikendica at Jadrija.
//
// One real house, surveyed off its own drawings, standing in the resort behind
// the back row of kabine. It is here for two reasons and they pull the same
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
  // from the waterline. The back of the concrete is at 33.1 m, so this puts the
  // terrace just off it and the house in the trees behind, which is where it
  // is. Its own +X runs along +t and its terrace faces the sea.
  t: 128.0,
  s: 39.6,

  // The upper floor, off the drawings. Kept here as well as in the sidecar
  // because the walking floor is computed every frame and a JSON lookup per
  // step is not worth the tidiness.
  floor: 2.90,

  // The outside stair: seventeen risers of 17 up the east face, sixteen goings
  // of 25 along it. In house-local three.js metres, z running north to south.
  stair: { x0: 3.46, x1: 4.56, z0: -0.10, z1: 3.90 },
  landing: { x0: 3.19, x1: 4.56, z0: -1.20, z1: -0.10 },

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
  // The ground it stands on: the terrain under the middle of the footprint,
  // dropped a little so the plinth is buried rather than floating.
  const base = groundAt(here[0], here[2]) - 0.25;

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
    body: 'base *= vVCol;',
  });

  const parts = {};
  for (const key of ['shell', 'roof', 'loft']) {
    const b64 = PAYLOAD['vikendica_' + key + '_fr3d'];
    if (!b64) { console.warn('no vikendica payload:', key); continue; }
    try {
      const geo = readFR3D(await inflateBinary(b64));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      root.add(mesh);
      parts[key] = mesh;
    } catch (e) {
      console.warn('vikendica failed:', key, e.message);
    }
  }
  if (parts.loft) parts.loft.visible = false;

  // ── where you may stand ────────────────────────────────────────────────────
  /**
   * House-local metres from a point in the locale. The house was placed with
   * its +X along +t and its terrace toward the sea, so this is a translation
   * and a sign flip and nothing else — which is the reason it was placed that
   * way rather than at whatever angle the lane happens to run.
   */
  const toHouse = (t, s) => [t - VIK.t, VIK.s - s];

  const inRect = (x, z, r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

  /**
   * The height of the floor under a point, or null if this point is not on the
   * house at all.
   *
   * Three surfaces, in the order you meet them walking up from the lane: the
   * flight, which is a ramp because sixteen separate step heights would be a
   * staircase you fall through; the landing; and then everything inside the
   * walls and out on the terrace, which is all one floor at +2.90.
   */
  function floorAt(t, s) {
    const [x, z] = toHouse(t, s);
    if (inRect(x, z, VIK.stair)) {
      const f = clamp((VIK.stair.z1 - z) / (VIK.stair.z1 - VIK.stair.z0), 0, 1);
      return base + VIK.floor * f;
    }
    if (inRect(x, z, VIK.landing)) return base + VIK.floor;
    if (inRect(x, z, plan.outer)) return base + VIK.floor;
    if (inRect(x, z, plan.rooms.terrace)) return base + VIK.floor;
    return null;
  }

  /**
   * The walls, as boxes in the locale's own axes.
   *
   * Everything inside the house is already axis-aligned to the locale by the
   * placement above, so each one is a straight translation — no rotation field,
   * unlike the houses of the resort, which were laid out to their lanes.
   *
   * `GROUND.girth` is taken back off each box the way the kabina's walls do it:
   * `confine` adds the player's radius to every blocker, and a 10 cm partition
   * grown by 55 cm on each side is a metre and a half of solid, which seals a
   * flat this size completely.
   */
  function blockers() {
    const out = [];
    const push = (r, shrink) => {
      const a = (r.x1 - r.x0) * 0.5 - shrink;
      const c = (r.z1 - r.z0) * 0.5 - shrink;
      out.push({
        t: VIK.t + (r.x0 + r.x1) * 0.5,
        s: VIK.s - (r.z0 + r.z1) * 0.5,
        a: Math.max(a, 0.02), c: Math.max(c, 0.02),
        h: 6.0, y: base,
      });
    };
    for (const b of plan.blockers) push(b, GROUND.girth);
    // The terrace's three open edges — its railing, which is a real railing and
    // has to stop you the way the drawn one would. Without them the terrace is
    // a floor at +2.90 you can walk off, and worse, walk on to from the lane.
    const T = plan.rooms.terrace;
    push({ x0: T.x0, x1: T.x1, z0: T.z1 - 0.10, z1: T.z1 }, 0.02);
    push({ x0: T.x0, x1: T.x0 + 0.10, z0: T.z0, z1: T.z1 }, 0.02);
    push({ x0: T.x1 - 0.10, x1: T.x1, z0: T.z0, z1: T.z1 }, 0.02);
    // And the open side of the flight, so you go up it rather than off it.
    push({ x0: VIK.stair.x1 - 0.08, x1: VIK.stair.x1,
           z0: VIK.stair.z0, z1: VIK.stair.z1 + 0.6 }, 0.02);
    return out;
  }

  const world = (x, z) => {
    const w = field.toWorld(VIK.t + x, VIK.s - z);
    return [w[0], w[2]];
  };

  return {
    root, parts, plan, base, yaw,
    floorAt, blockers,
    /** 'now' | 'loft' — which roof is on. The rooms below do not change. */
    roof(which) {
      if (parts.roof) parts.roof.visible = which !== 'loft';
      if (parts.loft) parts.loft.visible = which === 'loft';
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
