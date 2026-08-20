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
 * The far shadow cascade: 900 m across, following the aeroplane, and the one
 * that draws a hillside of pines shading the next hillside.
 *
 * A phone does not get it. Measured over the channel it is 38 draw calls and
 * two and a half million triangles a frame — and the reason it costs that much
 * over open water, where it has nothing to draw, is that a shadow proxy is
 * registered `frustumCulled = false` and so goes through the pass whether it is
 * in the cascade or not. What a phone keeps is the near cascade, 110 m across
 * and following your eye, which is every shadow you are close enough to read.
 *
 * `?farshadow` and `?nofarshadow` force it either way.
 */
CONFIG.shadowFar = QUERY.has('nofarshadow') ? 0
  : QUERY.has('farshadow') ? 1
    : IS_SMALL ? 0 : 1;

/**
 * Whether the cascades are allowed to stand down over water at all — see
 * `shadowMode` in 90-app.js. On by default everywhere, because what it drops
 * is provably empty; `?noshadowskip` is here so the claim can be measured
 * rather than believed.
 */
CONFIG.shadowSkip = QUERY.has('noshadowskip') ? 0 : 1;

/**
 * And how often the live cascades are redrawn while you are flying, in frames.
 *
 * Two on a phone. The map and the matrix that goes with it are held together,
 * so what you get is not a shadow sliding across the ground — it is the same
 * shadow, one frame old. At 300 km/h and 200 m up that is under three metres,
 * seen from two hundred. On foot it stays at one: you are looking at a contact
 * shadow half a metre from your boot, and there it would show.
 *
 * `?shadowevery=N` overrides, `?shadowevery=1` turns it off.
 */
CONFIG.shadowEvery = QUERY.has('shadowevery')
  ? Math.max(1, Math.round(parseFloat(QUERY.get('shadowevery')) || 1))
  : IS_SMALL ? 2 : 1;

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
