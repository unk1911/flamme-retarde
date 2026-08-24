// -----------------------------------------------------------------------------
// Anywhere else.
//
// A canopy can come down anywhere in a hundred and sixty-nine square kilometres,
// and almost none of that is an aerodrome. The alternative to answering for the
// rest of it is a parachute that only works over one rectangle, which is worse
// than not having the parachute — you would be spending an aeroplane to arrive
// at a screen that says the game is over.
//
// So: the on-foot mode consumes a locale, eleven members and nothing else, and
// this synthesises one around wherever you touched down. Bounds a kilometre and
// a half across, heights straight off the DEM, no blockers, no objects, nobody
// there. It costs almost nothing and it is the difference between a feature and
// a trap.
// -----------------------------------------------------------------------------

const OPEN = {
  reach: 780,          // m from the touchdown point you are allowed to walk
  // Buildings taken from the city's own footprints, nearest first. `confine`
  // walks the whole list up to eight times a step, so this is a budget rather
  // than a radius: land in the middle of the old town and the four hundred
  // nearest houses are solid, which is a good deal further than you will get.
  walls: 1200,
};

/**
 * A locale for open country, centred on a point. Implements exactly the
 * interface `buildGround` consumes — see `src/46-airfield.js` for the one it
 * was written against.
 *
 * The local frame is world-axis-aligned and simply offset. An aerodrome's frame
 * is rotated to its runway because every structure on it was laid out in those
 * axes; a hillside has no axes, so inventing a rotation for it would be
 * inventing a fact.
 */
function openLocale(x, z, city) {
  const cx = Math.round(x), cz = Math.round(z);
  const R = OPEN.reach;
  // Never below the waterline — but this is now only a backstop for the last
  // few centimetres at the tideline, because `standable` below stops you
  // reaching the water at all. On its own it was the whole reason you could
  // walk out across the channel: the DEM under the sea is negative, this
  // clamped it to zero, and nothing anywhere said you may not stand there.
  const walkY = (wx, wz) => Math.max(groundAt(wx, wz), 0);

  // The buildings. The locale frame here is world-axis-aligned and merely
  // offset, so a footprint's principal axis is its rotation within the frame
  // directly, and `confine` turns into it exactly as it does for the Jadrija
  // houses laid out to their lanes.
  const blockers = [];
  if (city && city.obbs) {
    const near = [];
    for (const o of city.obbs) {
      const dx = o.x - cx, dz = o.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < R * R) near.push([d2, o]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(near.length, OPEN.walls); i++) {
      const o = near[i][1];
      blockers.push({
        t: o.x - cx, s: o.z - cz, a: o.hu, c: o.hv, h: o.h, y: 0,
        rot: Math.atan2(o.az, o.ax),
      });
    }
  }

  return {
    site: { x: cx, z: cz },
    bounds: { t0: -R, t1: R, s0: -R, s1: R },
    blockers,
    local: (wx, wz) => [wx - cx, wz - cz],
    toWorld: (t, s) => [cx + t, walkY(cx + t, cz + s), cz + s],
    walkY,
    /**
     * Where a person may put their feet. The bounds are a square and the
     * blockers are boxes; a coastline is neither, so it needs its own test.
     * Everywhere else on the map the shore is handled by a bound — Jadrija
     * stops you 1.1 m short of the quay edge — and open country had nothing.
     */
    standable: (wx, wz) => !isSea(wx, wz),
    objects: [],
    crewSpots: [],
    apron: [cx, walkY(cx, cz), cz],
    tint() { /* nothing here to char */ },
    flushTint() {},
  };
}

/**
 * Which locale owns a point. Inside the aerodrome wire it is the aerodrome,
 * with its buildings, its crew and its mission; on the Jadrija concrete it is
 * Jadrija, with its terraces and its huts; anywhere else it is open country.
 * Landing on the field by parachute and finding the hangars had become scenery
 * would be the worse bug of the two.
 *
 * Order matters only in that the two hand-built places must both come before the
 * synthesised one. They are four kilometres apart and cannot both claim a point.
 */
function localeAt(x, z, airfield, jadrija, city) {
  if (airfield && airfield.site && airfield.inField && airfield.inField(x, z)) {
    return airfield;
  }
  // Padded, and the pad is not a fudge — it is the resort's own `walkY`, which
  // answers for t in [-5, LEN+5] and hands back the terrain outside that. Asked
  // without it, a canopy coming down two metres past the west end of the
  // promenade fails `inField` by a hair, gets open country, and stands you on
  // the DEM: 1.21 m, with the concrete you can see at 2.55 m. You land inside
  // the deck and spend the rest of the visit looking at the underside of it.
  //
  // The two tests had drifted apart because they are about different things —
  // `inField` is "is this the resort", used to keep pines out of the bathing
  // terrace, and it is deliberately tight. What the locale wants is "can this
  // place answer for the ground here", and that is a wider question.
  if (jadrija && jadrija.inField && jadrija.inField(x, z, 5)) return jadrija;
  // The Brod. A third hand-built place, and the newest: a masonry quay on the
  // north-east shore of the spit, 134 m outside anything Jadrija's shore frame
  // can address. Open country would answer for the hillside correctly and for
  // the quay not at all — its `walkY` is the DEM, and the DEM has the quay's
  // deck a metre and a fifth under the water it is holding back.
  if (atBrod(x, z)) return brodLocaleCached(city);
  return openLocale(x, z, city);
}
