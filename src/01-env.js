// -----------------------------------------------------------------------------
// What we are running on.
//
// Decided once, up front, because half the game reads it: the control scheme,
// the wording of every prompt that names a key, the pixel ratio, and how much
// vegetation a first frame can afford.
// -----------------------------------------------------------------------------

const QUERY = new URLSearchParams(location.search);

/**
 * Touch, rather than "mobile". A phone and a tablet get the same controls, and
 * so does a touchscreen laptop that has no mouse plugged in — which is exactly
 * what `pointer: coarse` means. `?touch` and `?notouch` force it either way,
 * because there is no other way to test this from a desktop browser.
 */
const IS_TOUCH = QUERY.has('touch') ? true
  : QUERY.has('notouch') ? false
    : (matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);

/**
 * Phone-shaped rather than merely touch-capable: a 10-inch tablet can carry the
 * full detail, a phone cannot. Used only for the default quality, never for the
 * controls — an iPad still gets the touch pad.
 */
const IS_SMALL = IS_TOUCH && Math.min(screen.width, screen.height) < 560;

if (IS_TOUCH) document.documentElement.classList.add('touch');

/**
 * How strong the ambient occlusion starts out, before anybody touches the
 * slider. See 89-ao.js.
 *
 * It lives here rather than in CONFIG's own block because it is a decision
 * about the machine and not about the world, and the machine is what this file
 * is for. A desktop gets it, a phone does not: the pass is three targets and a
 * sixteen-tap loop, and the phones this runs on are already spending their
 * whole budget on the shadow cascade and twenty thousand trees. `?ao=0.8` and
 * `?noao` force it either way, and whatever the slider was left on last time
 * beats both.
 */
CONFIG.ao = QUERY.has('noao') ? 0
  : QUERY.has('ao') ? Math.max(0, Math.min(1, parseFloat(QUERY.get('ao')) || 0))
    : IS_TOUCH ? 0 : 0.58;

/**
 * Live state of the on-screen controls. Written by 91-touch.js, read by the
 * input loop in 90-app.js — declared up here so neither has to care which of
 * them the build concatenates first.
 */
// `g*` are the ground mode's: a walk vector, a run latch and the branch.
// `c*` are the canopy's: one stick, where x hauls a riser and y is the front
// risers forward and the brakes back.
// `s*` are the water's, and they are the ground's plus a third axis, because
// in the sea up and down are controls you *hold* rather than a jump you press.
const TOUCH = {
  scoop: false, drop: false, level: false,
  gx: 0, gy: 0, grun: false, gjet: false, glook: false,
  cx: 0, cy: 0,
  sx: 0, sy: 0, sfast: false, sdown: false, sup: false,
};
