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
function openLocale(x, z) {
  const cx = Math.round(x), cz = Math.round(z);
  const R = OPEN.reach;
  // Never below the waterline. Walk to the edge of the Adriatic and you stand
  // in the shallows rather than descending the seabed, which is what the DEM
  // under the channel would otherwise have you doing.
  const walkY = (wx, wz) => Math.max(groundAt(wx, wz), 0);
  return {
    site: { x: cx, z: cz },
    bounds: { t0: -R, t1: R, s0: -R, s1: R },
    blockers: [],
    local: (wx, wz) => [wx - cx, wz - cz],
    toWorld: (t, s) => [cx + t, walkY(cx + t, cz + s), cz + s],
    walkY,
    objects: [],
    crewSpots: [],
    apron: [cx, walkY(cx, cz), cz],
    tint() { /* nothing here to char */ },
    flushTint() {},
  };
}

/**
 * Which locale owns a point. Inside the aerodrome wire it is the aerodrome,
 * with its buildings, its crew and its mission; anywhere else it is open
 * country. Landing on the field by parachute and finding the hangars had become
 * scenery would be the worse bug of the two.
 */
function localeAt(x, z, airfield) {
  if (airfield && airfield.site && airfield.inField && airfield.inField(x, z)) {
    return airfield;
  }
  return openLocale(x, z);
}
