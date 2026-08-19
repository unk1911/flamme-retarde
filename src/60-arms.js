// -----------------------------------------------------------------------------
// Your own arms, in the water.
//
// The rig has twenty-two clips and not one of them is a swim, and for most of
// this project that was the right answer: a swim clip is a whole body, and the
// only place a whole body is ever drawn is inside the bathroom mirror. There
// is no mirror in the Adriatic. Bake the finest front crawl anybody has ever
// solved in Blender and the game would show you exactly none of it.
//
// What the game *would* show you is what you can actually see while swimming,
// which is your own two arms and nothing else. That is the animation. Everyone
// who has been in the sea knows the picture: the far hand entering ahead of
// you, the near forearm sweeping down past the bottom of the frame, and then
// the elbow coming over high and outboard on the recovery, half of it out of
// shot. Miss that out and the first-person swim is a camera flying through
// water; put it in and it is a person.
//
// So this is three rigid pieces a side on a two-joint chain, driven by angles
// rather than by IK. Angles, because the shape of a crawl is a *cycle* and not
// a target: a hand does not go to a place, it goes round. An IK solve would
// need the same cycle written out to have something to aim at, and would then
// add a solver's worth of ways to be wrong at the singular pose, which for an
// arm is the one it spends a quarter of every stroke in — straight out ahead.
//
// Three things it has to get right, and none of them is the arm.
//
// The first is that the arms belong to the *body* and the camera does not. The
// head rolls with the stroke — that is `pose()` in 59-swim.js and it is what
// makes the horizon tip — and if the arms are parented to a rolling camera
// then the arms never roll, because they roll with it. So they hang off the
// camera's position and yaw and take the roll back out.
//
// The second is that they stop. There is no swimming on the spot: let go of
// everything and the jacket floats you, your arms scull, and the cycle has to
// wind down to that rather than keep churning. Out of air it stops altogether,
// because that is the whole of what running out of air does here — it takes
// the controls off you, and arms that carried on stroking would be arguing
// with the only consequence in the mode.
//
// The third is that they are *in* the water and have to be lit like it. That
// is free: `solidMaterial` carries `applyWater` now, so an arm at four metres
// down goes the same green everything else does, and a hand that comes out on
// the recovery brightens as it clears the surface without a line of code.
// -----------------------------------------------------------------------------

const ARMS = {
  // Where the shoulders are, relative to the eye. Out, down and back: your eye
  // is at the top of your head and your shoulder is a good 28 cm under it, and
  // in a prone float the head is ahead of the shoulders as well as above them.
  // Written closer than that at first and the result was a forearm filling a
  // quarter of the frame — the arms were the right size and in the wrong place,
  // which at half a metre from a 58-degree lens is the same mistake as being
  // the wrong size.
  shoulder: [0.205, -0.175, 0.100],

  // And the whole shoulder line tipped up, which is the one number in here
  // that is a lie and the reason the rest of it can be true.
  //
  // A person swimming has their eyes at the top of their head and their arms
  // on a torso that is horizontal under it, so the honest geometry puts every
  // hand a good half metre below the eye and about twenty centimetres ahead —
  // which through a 58-degree lens aimed at the horizon is a long way off the
  // bottom of the frame. That is not a bug in the arms, it is what looking at
  // the horizon while swimming actually shows you: nothing. Real first-person
  // swimming footage is shot with the head *down*, face in the water, and this
  // mode deliberately keeps your head up, because the horizon coming and going
  // over the chop is the whole of what being in the sea looks like from in it.
  //
  // So the shoulders are tipped back until the stroke rides in the bottom
  // third of the picture. It is the same cheat every first-person game makes
  // with a pair of hands, for the same reason and by about the same amount.
  lift: 0.42,

  // Measured off her, not guessed. `human_skin.fr3d` is the same rig the
  // mirror figure is built on, and its rest skeleton says the humerus is
  // 239 mm and the radius 238 mm, with a mean flesh radius running 55 mm at
  // the deltoid to 37 mm at the elbow and 37 mm to 22 mm down the forearm.
  // Everything below is those numbers. What the rig cannot give is the
  // *surface* — see the note on `armHand` — but it can certainly give the
  // proportions, and an arm that is hers by measurement is worth more than an
  // arm that is anybody's by eye.
  upper: 0.240,        // m — humerus
  fore: 0.238,         // radius/ulna
  palm: 0.092,         // wrist to knuckle; her hand is 171 mm end to end

  // Silhouettes, not radii — and now tables rather than formulae, because an
  // arm's outline is not any one curve. The first version was two cones; the
  // second was a cone with a sine on it, which is a cone that breathes. Both
  // read as plumbing for the same reason: a limb's width goes up and down
  // several times along its length and every one of those reversals is a
  // muscle you can name.
  //
  // Down the upper arm: the deltoid is the widest part and it is at the *top*,
  // a third of the way down there is the biceps and triceps belly, then a long
  // narrowing to the elbow — which widens again in the last two centimetres,
  // because the humeral condyles are wider than the shaft above them and that
  // little flare is most of what makes an elbow read as a joint rather than as
  // a bend in a hose.
  //
  // Down the forearm: nothing at all at the elbow itself, then the flexor mass
  // swelling to its maximum a hand's breadth below it, then two thirds of the
  // limb's length spent tapering to a wrist barely half the width. The wrist
  // is the giveaway. It is the one place on an arm where the section is
  // emphatically not round — about 55 mm across and 40 mm through — and a
  // round wrist is the single loudest wrong note in a first-person hand.
  //
  // Columns: t, half-width across X, depth ratio Z/X, squareness, bow.
  //
  // Squareness is the other thing the cones got wrong. A cross-section through
  // a forearm is not an ellipse; it is a rounded triangle with the ulna making
  // a flat along one side, and near the wrist it is nearly a rectangle. An
  // ellipse catches the light in one even band all the way round, which is
  // what plastic does. See `armSection`.
  upperProf: armProfile([
    [0.00, 0.0548, 1.00, 0.34, 0.0000],
    [0.10, 0.0572, 1.00, 0.30, 0.0006],
    [0.27, 0.0524, 1.05, 0.24, 0.0007],
    [0.45, 0.0462, 1.07, 0.22, 0.0006],
    [0.67, 0.0416, 1.00, 0.26, 0.0000],
    [0.85, 0.0390, 0.90, 0.38, -0.0007],
    [0.95, 0.0396, 0.80, 0.52, -0.0011],
    [1.00, 0.0372, 0.78, 0.52, -0.0013],
  ]),
  foreProf: armProfile([
    [0.00, 0.0374, 0.86, 0.48, 0.0000],
    [0.09, 0.0428, 0.90, 0.38, 0.0013],
    [0.23, 0.0440, 0.92, 0.32, 0.0018],
    [0.43, 0.0378, 0.86, 0.32, 0.0016],
    [0.63, 0.0306, 0.80, 0.36, 0.0009],
    [0.81, 0.0259, 0.73, 0.44, 0.0002],
    [0.93, 0.0234, 0.68, 0.54, -0.0004],
    [1.00, 0.0225, 0.66, 0.58, -0.0005],
  ]),
  // The palm, with the arch in it. A hand held as a paddle is cupped: the
  // knuckle row is a curve and the whole plate dishes toward the thumb, which
  // is why a swimmer's hand holds water and a flat board does not.
  // The thickness is the whole of it. A palm is 89 mm across and 22 mm
  // through — a plate, and the ratio between those two numbers is the only
  // reason a hand reads as a hand from the side. Written at half the width it
  // came out a ball on the end of the wrist, which is what a first draft of a
  // hand always is.
  palmProf: armProfile([
    [0.00, 0.0262, 0.70, 0.56, 0.0000],
    [0.18, 0.0322, 0.55, 0.64, 0.0010],
    [0.45, 0.0388, 0.40, 0.72, 0.0016],
    [0.74, 0.0432, 0.30, 0.78, 0.0014],
    [0.92, 0.0448, 0.26, 0.80, 0.0006],
    [1.00, 0.0442, 0.25, 0.80, 0.0000],
  ]),
  // The thenar eminence — the muscle pad at the root of the thumb. It is the
  // thickest part of a hand and it is the piece whose absence makes a modelled
  // hand look like a glove with nothing in it.
  thenarProf: armProfile([
    [0.00, 0.0062, 1.00, 0.10, 0.0000],
    [0.32, 0.0128, 0.80, 0.14, 0.0000],
    [0.66, 0.0132, 0.74, 0.16, 0.0000],
    [1.00, 0.0072, 0.66, 0.20, 0.0000],
  ]),

  // Four fingers, index through little: length from the knuckle, and the
  // radius of the proximal bone. Three bones each — see `armFinger`.
  finger: [
    [0.0706, 0.0096],
    [0.0786, 0.0100],
    [0.0737, 0.0094],
    [0.0577, 0.0082],
  ],
  // The knuckle row, which is an arc and not a line: the index knuckle stands
  // a few millimetres proud of the little one, and they are not all the same
  // distance down the palm.
  knuckle: [0.0042, 0.0060, 0.0028, -0.0044],
  thumb: 0.0546,
  thumbR: 0.0108,

  // A Dalmatian August, three weeks in. Albedo, so it sits below the colour it
  // arrives on screen as.
  skin: [0.795, 0.620, 0.495],
  // Her right arm is inked — see YOU.ink in 49-you.js, where the same sleeve is
  // three noise fields on the mirror figure. This is that sleeve seen from the
  // inside, which is the only other place it can be seen from.
  ink: [0.175, 0.150, 0.190],

  // How near a stroke gets to the surface at the catch. Not zero: a crawl's
  // entry is a hand's width under, and a hand that broke the surface every
  // cycle would need spray it is not going to get.
  idle: 0.30,          // how much of a stroke a stopped swimmer still sculls
};

/**
 * Wet skin, forty centimetres from the lens.
 *
 * The geometry above was half of "the arms look rough"; this is the other
 * half. A flat albedo with a broad plastic highlight on it is a mannequin's
 * arm at any distance, and at this one there is nothing else in shot to
 * distract from it. Three things, and each of them is one line:
 *
 * Wet. Skin straight out of the sea carries a film of water, and water is a
 * dielectric with a very strong Fresnel: nearly matte face-on and close to a
 * mirror at a grazing angle. That is why a wet arm has a bright rim along its
 * whole silhouette and a dull middle, and it is the single strongest cue that
 * the thing on screen has just come out of the water. `spec` here is the
 * Fresnel curve rather than a number, so the same material is a dry-looking
 * arm in the middle of the frame and a wet one round its edge — and the sky
 * reflection `solidFragment` already adds is then blue on the rim, for free,
 * which is what the Adriatic does to an arm.
 *
 * Translucent. Skin is not opaque. Light entering the far side of a forearm
 * comes back out reddened, so the edge of a lit arm goes warm before it goes
 * dark — the wrap term below, which is a fifty-year-old cheat and still the
 * cheapest realistic thing you can do to a limb.
 *
 * And not one colour. Three weeks of a Dalmatian August is on the outside of
 * an arm and not on the inside of it, and there is a fine grain over the whole
 * of it. Keyed to `vLocal`, which is the bind pose, so both stay stuck to the
 * arm while it strokes.
 */
const ARM_SKIN = /* glsl */ `
  vec3 avd = normalize(vWorld - uCamPos);
  float afr = pow(1.0 - abs(dot(n, avd)), 3.2);
  spec = mix(0.09, 0.92, afr);

  float atan_ = clamp(vLocal.z * -22.0, -1.0, 1.0) * 0.5 + 0.5;
  base *= mix(vec3(1.010, 0.995, 0.985), vec3(0.945, 0.885, 0.845), atan_);
  // Grain, and it has to be *grain*. One octave of value noise on x+z is a
  // lattice, and at this range a lattice on an arm reads as scales — which is
  // what the first pass of this shipped. Two fields, crossed and at coprime
  // rates so the beat between them never lines up, and half the amplitude.
  base *= 1.0
    + 0.030 * (vnoise2(vec2(vLocal.x * 1.7 + vLocal.z, vLocal.y) * 173.0) - 0.5)
    + 0.022 * (vnoise2(vec2(vLocal.y * 1.3, vLocal.z - vLocal.x * 0.6) * 431.0) - 0.5);

  base = mix(base, vec3(0.760, 0.335, 0.250), afr * 0.26);
`;

/**
 * A profile table, sampled smoothly.
 *
 * Catmull-Rom through the knots rather than straight lines between them: the
 * knots are where an anatomist would put a name, and the shape between two of
 * them is a curve, not a chamfer. Sampled twenty-odd times down a limb it is
 * the difference between an arm and a stack of cans.
 *
 * Returns [half-width, depth ratio, squareness, bow] at t.
 */
function armProfile(tab) {
  const key = (i, c) => tab[Math.min(tab.length - 1, Math.max(0, i))][c] ?? 0;
  return (t) => {
    let i = 0;
    while (i < tab.length - 2 && t > tab[i + 1][0]) i++;
    const t0 = tab[i][0], t1 = tab[i + 1][0];
    const u = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    const out = [];
    for (let c = 1; c <= 4; c++) {
      const p0 = key(i - 1, c), p1 = key(i, c);
      const p2 = key(i + 1, c), p3 = key(i + 2, c);
      out.push(0.5 * (2 * p1 + (p2 - p0) * u
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
        + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u));
    }
    return out;
  };
}

/**
 * One point on a cross-section.
 *
 * A superellipse, because a limb is not an ellipse anywhere along its length.
 * `k` runs 0 for a true ellipse to about 0.8 for the wrist, which is nearly a
 * rounded rectangle. The exponent is what puts the flats on the sides and the
 * corners between them, and the flats are what let a highlight break into
 * separate bands down the length of a forearm instead of running as one even
 * stripe — which is the whole visual difference between skin and moulded PVC.
 */
function armSection(th, rx, rz, k) {
  const n = 2 + 2.2 * Math.max(0, k);
  const c = Math.cos(th), s = Math.sin(th);
  const r = Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(s), n), -1 / n);
  return [c * r * rx, s * r * rz];
}

/**
 * One tapered limb, hanging from the origin down -Y.
 *
 * Down -Y because that is the direction a joint chain wants to be written in:
 * the shoulder is at the origin, the elbow is `len` below it, and every
 * rotation in the file is then a rotation of a thing that starts by hanging.
 *
 * The tessellation is not decoration. At forty centimetres from a 58-degree
 * lens an arm is eight hundred pixels tall, and a twenty-four-sided lathe puts
 * a visible flat every thirty pixels round its silhouette; worse, the sparse
 * rows meant the profile table above would have been sampled at eight stations
 * and every reversal in it rounded off to nothing. Thirty-six sides and
 * twenty-two rows is about nine thousand triangles for the pair, which for the
 * only object on the screen that is close enough to be judged as a *surface*
 * is not extravagant — it is the minimum at which the silhouette stops being
 * the thing you look at.
 */
function armLimb(len, prof, opt = {}) {
  const seg = opt.seg ?? 36, rows = opt.rows ?? 22, N = opt.cap ?? 9;
  // How far a cap stands proud, as a fraction of the radius it caps. A whole
  // hemisphere is right on the end of a bone and badly wrong on the end of a
  // palm: a palm is 45 mm across, so a full cap put a 36 mm dome on the
  // knuckle line and the fingers grew out of the middle of it. That was the
  // mitten. A palm ends in a flat with a rolled edge, and so does a knuckle.
  const cT = opt.capTopS ?? 0.80, cB = opt.capBotS ?? 0.80;
  const st = [];
  const p0 = prof(0), p1 = prof(1);
  // The caps are what fixed the joints. Two flat-ended cylinders meeting at a
  // bent elbow show you both of their end discs and the wedge of nothing
  // between them, and at forty centimetres from the lens that wedge is the
  // first thing you see. Round both ends into half an ellipsoid and the pieces
  // read as one arm through any bend the cycle asks for, with no skinning, no
  // blend shape and no joint sphere sitting proud of the limb it belongs to.
  if (opt.capTop !== false) {
    for (let i = N; i >= 1; i--) {
      const a = (i / N) * Math.PI * 0.5, c = Math.max(Math.cos(a), 0.003);
      st.push([p0[0] * Math.sin(a) * cT, p0[0] * c, p0[0] * p0[1] * c,
        p0[2], p0[3]]);
    }
  }
  for (let j = 0; j <= rows; j++) {
    const t = j / rows, p = prof(t);
    st.push([-t * len, p[0], p[0] * p[1], p[2], p[3]]);
  }
  if (opt.capBot !== false) {
    for (let i = 1; i <= N; i++) {
      const a = (i / N) * Math.PI * 0.5, c = Math.max(Math.cos(a), 0.003);
      st.push([-len - p1[0] * Math.sin(a) * cB, p1[0] * c, p1[0] * p1[1] * c,
        p1[2], p1[3]]);
    }
  }
  const rings = st.map(([y, rx, rz, k, bow]) => {
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const [x, z] = armSection((i / seg) * Math.PI * 2, rx, rz, k);
      // The bow. An arm is not a straight axis: the forearm carries a few
      // millimetres of lateral bow and the upper arm the other way, and at
      // this range a perfectly straight limb reads as machined.
      ring.push(new THREE.Vector3(x + bow, y, z));
    }
    return ring;
  });
  return loft(rings, { closed: true, caps: false });
}

/**
 * One finger: three bones, each with its own knuckle, curling as it goes.
 *
 * A finger modelled as one taper is a cone with a fingernail's worth of
 * ambition, and there were four of them side by side on the largest object in
 * the frame — which is why the last hand read as a mitten. The joints are the
 * information. Every knuckle is wider than the bone above and below it, the
 * gaps between the bones are where a finger creases, and the curl accumulates
 * so the tip comes round further than the base — the shape of a hand doing
 * something rather than a hand being displayed.
 */
function armFinger(len, r, curl) {
  const bone = [len * 0.45, len * 0.31, len * 0.24];
  const out = [];
  let m = new THREE.Matrix4();
  for (let i = 0; i < 3; i++) {
    const a = r * (1 - 0.11 * i), b = r * (1 - 0.11 * (i + 1));
    const g = armLimb(bone[i], (t) => {
      // A knuckle at the head of each bone and a smaller one at its foot: a
      // finger is a string of beads and the beads are what you actually see.
      const w = a + (b - a) * t
        + r * 0.16 * Math.exp(-t * t * 34.0)
        + r * 0.10 * Math.exp(-(1 - t) * (1 - t) * 40.0);
      // The last bone ends in a pad, not a point. Second column is the depth
      // *ratio*, like every other profile in this file.
      return [w, 1.06 - 0.10 * t, 0.24, 0];
    }, { seg: 14, rows: 7, cap: 6 });
    out.push(g.applyMatrix4(m.clone()));
    m = m.clone()
      .multiply(new THREE.Matrix4().makeTranslation(0, -bone[i] * 0.94, 0))
      .multiply(new THREE.Matrix4().makeRotationX(curl[i]));
  }
  return out;
}

/**
 * A hand: a palm with an arch and a thumb pad, four three-boned fingers and a
 * thumb, merged into one buffer.
 *
 * Not splayed, and not clamped shut. A crawl's hand is a paddle held with the
 * fingers just touching and very slightly cupped — water goes through a splayed
 * hand and a clenched one has no surface — so they lie together with a few
 * degrees of curl and the little finger trailing the others, which is the
 * shape that says "this hand is doing something" rather than "this hand is
 * a model of a hand".
 */
function armHand(side) {
  const parts = [];
  const P = ARMS.palm;
  parts.push(armLimb(P, ARMS.palmProf, {
    seg: 30, rows: 14, cap: 8, capTopS: 0.42, capBotS: 0.16 }));

  // The thumb pad, laid along the thumb side of the palm and rolled forward
  // on to the palmar face where it actually sits.
  const then = armLimb(P * 0.78, ARMS.thenarProf, {
    seg: 18, rows: 9, cap: 6, capTopS: 0.5, capBotS: 0.5 });
  then.applyMatrix4(new THREE.Matrix4()
    .makeRotationZ(-0.15 * side)
    .premultiply(new THREE.Matrix4().makeTranslation(-0.0206 * side, -0.0150, 0.0058)));
  parts.push(then);

  for (let i = 0; i < 4; i++) {
    const [len, r] = ARMS.finger[i];
    // Knuckles across the head of the palm, index at -X through little at +X
    // on the left hand and mirrored by the parent's sign.
    const x = (-1.5 + i) * 0.0228 * side;
    // The little finger trails and curls further, which every hand does and
    // no modelled hand ever does.
    const lag = i === 3 ? 0.07 : 0;
    for (const g of armFinger(len, r, [0.09 + lag, 0.19 + lag, 0.17])) {
      parts.push(g.applyMatrix4(new THREE.Matrix4()
        .makeRotationX(0.10)
        .premultiply(new THREE.Matrix4().makeRotationZ(-x * 1.25))
        .premultiply(new THREE.Matrix4().makeTranslation(
          x, -P + ARMS.knuckle[i], 0.0022))));
    }
  }

  // The thumb, off the side of the palm and a long way round the axis: held
  // in against the index finger, which is where it is on a catch. Two bones,
  // not three, because that is how many a thumb has.
  const tb = [ARMS.thumb * 0.56, ARMS.thumb * 0.44];
  let m = new THREE.Matrix4()
    .makeRotationZ(-0.30 * side)
    .premultiply(new THREE.Matrix4().makeRotationX(0.26))
    .premultiply(new THREE.Matrix4().makeTranslation(-0.0250 * side, -0.0548, 0.0090));
  for (let i = 0; i < 2; i++) {
    const a = ARMS.thumbR * (1 - 0.16 * i), b = ARMS.thumbR * (1 - 0.16 * (i + 1));
    const g = armLimb(tb[i], (t) => {
      const w = a + (b - a) * t + ARMS.thumbR * 0.13 * Math.exp(-t * t * 30.0);
      return [w, 0.94 - 0.06 * t, 0.26, 0];
    }, { seg: 14, rows: 7, cap: 6 });
    parts.push(g.applyMatrix4(m.clone()));
    m = m.clone()
      .multiply(new THREE.Matrix4().makeTranslation(0, -tb[i] * 0.94, 0))
      .multiply(new THREE.Matrix4().makeRotationX(0.34));
  }
  return kiteMerge(parts);
}

/**
 * The arms you can see, and the cycle that moves them.
 *
 * `swim` is the object from 59-swim.js — this reads `you.stroke`, which is
 * already the phase of a stroke and is already wound down by how fast you are
 * actually going, so the cycle in here and the head lift in `pose()` are the
 * same cycle by construction rather than by two files agreeing.
 */
function buildArms() {
  // Their own scene and their own camera, which is the fourth thing this has
  // to get right and the one that decides whether it works at all.
  //
  // The world's near plane is 1.2 m. An arm is thirty centimetres from your
  // eye, so drawn in the world scene there is simply nothing there — every
  // triangle of it is in front of the clip and thrown away, which is exactly
  // what the first attempt looked like. And the near plane cannot come to
  // meet it: the note on `clipNear` in 90-app.js spells out the cost, and the
  // reason it is allowed indoors is that indoors the far end of the view is a
  // doorway. Out here the far end is the far end, four kilometres of town,
  // and pulling the near clip in tenfold to draw two arms would buy them with
  // a skyline that flickers.
  //
  // So the arms are a view model, in the sense every first-person game means
  // it: a second, tiny scene with a near plane of five centimetres and a far
  // plane of six metres, drawn over the finished frame with the depth buffer
  // cleared underneath it. What that costs is that the arms cannot be occluded
  // by the world, and at half a metre from your own face there is nothing to
  // occlude them with.
  const stage = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(58, 1, 0.05, 6);

  const root = new THREE.Group();
  root.visible = false;
  root.frustumCulled = false;
  stage.add(root);

  // The body, which is not the camera. See the note at the top.
  const body = new THREE.Group();
  root.add(body);

  const sides = [];
  for (const side of [-1, 1]) {
    // Her right, which in this frame is +X. `YOU.right` says which way the
    // rig's right is and exists for exactly this reason; it is the one number
    // that has to change if the export is ever mirrored.
    const inked = side > 0 && YOU.right > 0;
    const mat = solidMaterial(
      new THREE.Color(...ARMS.skin), {
        spec: 0.10, specPower: 70, vcol: false,
        // The sleeve, and it is the same three fields as on the mirror figure
        // rather than a texture, for the same reason: this rig has no UVs and
        // ink on skin cannot be allowed to slide when the skin moves. vLocal is
        // the bind pose, so the ink is stuck to the arm and not to the room.
        // Smooth, and quiet. The first version hashed a floored lattice, which
        // on a twelve-sided lathe is a hash of the facets: it came out as a
        // zebra, and a zebra 40 cm from the lens is the most visible thing in
        // the game. Old ink at arm's length is a dark arm with warm and cool
        // inside it — that is what 49-you.js says about the same sleeve at two
        // metres, and it is more true at forty centimetres, not less.
        body: `
          ${ARM_SKIN}
        ` + (inked ? `
          vec3 q = vLocal * 7.0;
          float d = sin(q.y * 2.3 + sin(q.x * 3.1) * 1.7)
                  * 0.5 + 0.5;
          float e = sin(q.y * 5.7 - sin(q.z * 4.3) * 2.1) * 0.5 + 0.5;
          float s = smoothstep(0.22, 0.78, d * 0.65 + e * 0.35);
          base = mix(base, uInk, s * 0.30);
          base = mix(base, vec3(0.330, 0.075, 0.075),
            smoothstep(0.72, 0.94, e) * 0.26);
        ` : ''),
        uniforms: inked ? { uInk: { value: new THREE.Color(...ARMS.ink) } } : {},
        decl: inked ? 'uniform vec3 uInk;' : '',
      });

    const shoulder = new THREE.Group();
    shoulder.position.set(ARMS.shoulder[0] * side, ARMS.shoulder[1], ARMS.shoulder[2]);
    body.add(shoulder);
    shoulder.add(new THREE.Mesh(armLimb(ARMS.upper, ARMS.upperProf), mat));

    const elbow = new THREE.Group();
    elbow.position.set(0, -ARMS.upper, 0);
    shoulder.add(elbow);
    elbow.add(new THREE.Mesh(armLimb(ARMS.fore, ARMS.foreProf), mat));

    const wrist = new THREE.Group();
    wrist.position.set(0, -ARMS.fore, 0);
    elbow.add(wrist);
    // Built per side rather than mirrored with a negative scale, which would
    // turn every triangle in the hand inside out against FrontSide. Only three
    // numbers differ between the two — the knuckle offsets and where the thumb
    // sits — and every piece hanging off them is a lathe, so a hand built with
    // the sign flipped is a true mirror with the winding still the right way
    // round.
    wrist.add(new THREE.Mesh(armHand(side), mat));

    for (const m of [shoulder, elbow, wrist]) m.frustumCulled = false;
    sides.push({ side, shoulder, elbow, wrist });
  }

  const ease = (t) => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;

  /**
   * One arm's angles at phase `u` (0..1 through its own cycle).
   *
   * 0 is the catch, with the hand ahead and just under; 0.55 is the exit at
   * the hip; the rest is the recovery. The split is 55/45 because a pull is
   * slower than a recovery — the hand is doing work against water on the way
   * back and against nothing at all on the way forward, and a cycle written
   * 50/50 reads as a doll being wound rather than as somebody swimming.
   */
  function cycle(u, amp) {
    let reach, elb, out, twist;
    if (u < 0.55) {
      const p = ease(u / 0.55);
      // Forward and a little high at the catch, round to past the hip.
      reach = mix(1.92, -0.26, p);
      // The high elbow: the arm bends most in the middle of the pull, where
      // the hand is under the chest and the forearm is nearly vertical. This
      // one angle is most of what separates a crawl from a windmill.
      elb = 0.22 + 1.55 * Math.sin(Math.PI * p);
      // Wide at the entry, in under the body, wide again at the hip.
      out = 0.14 - 0.10 * Math.sin(Math.PI * p);
      twist = mix(-0.35, 0.45, p);
    } else {
      const r = ease((u - 0.55) / 0.45);
      reach = mix(-0.26, 1.92, r);
      // Over the top, elbow leading — which is what a recovery is.
      elb = 0.22 + 1.20 * Math.sin(Math.PI * r);
      out = 0.14 + 0.52 * Math.sin(Math.PI * r);
      twist = mix(0.45, -0.35, r);
    }
    // Winding down is a fade toward the rest pose, not a slowing of the clock:
    // the phase keeps its place so the arms do not jump when you start again.
    //
    // And the rest pose is a scull, not a hang. Written as arms-by-your-sides
    // it was invisible — a hanging arm is straight down out of the bottom of
    // the frame, so a swimmer who stopped simply had no arms, which is worse
    // than not drawing them at all. Treading water is elbows in, forearms out
    // in front, palms moving: you can see your own hands the whole time, which
    // is the thing that makes floating feel like floating rather than like the
    // camera having been let go of.
    const rest = { reach: 1.95, elb: 1.15, out: 0.26, twist: 0 };
    return {
      reach: mix(rest.reach, reach, amp),
      elb: mix(rest.elb, elb, amp),
      out: mix(rest.out, out, amp),
      twist: mix(rest.twist, twist, amp),
    };
  }

  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();

  /**
   * Place and pose them.
   *
   * Called after `swim.pose(camera)` and before the render, because it takes
   * the camera's own transform apart: the position is the head, the yaw and
   * pitch are where you are looking, and the roll is the stroke, which belongs
   * to the head and not to the shoulders.
   */
  function update(dt, swim, camera) {
    const on = !!(swim && swim.active);
    root.visible = on;
    if (!on) return;

    // The view-model camera is the real one, minus its reach. Copied every
    // frame rather than shared, because the field of view is a control here —
    // Z is a lens — and arms that did not zoom with the rest of the picture
    // would be the one thing on screen that was not moving.
    cam.fov = camera.fov;
    cam.aspect = camera.aspect;
    cam.position.copy(camera.position);
    cam.quaternion.copy(camera.quaternion);
    cam.updateProjectionMatrix();

    const you = swim.you;
    root.position.copy(camera.position);
    // Yaw and pitch, no roll. A prone swimmer's shoulders follow the head down
    // when it looks down — that is what makes a duck-dive read — but they do
    // not tip with it, and taking the roll out here is why the arms swing
    // under a horizon that is tipping rather than with it.
    _e.set(you.pitch * 0.55 + ARMS.lift, you.yaw, 0, 'YXZ');
    root.quaternion.setFromEuler(_e);

    // How much of a stroke there is. Sculling when you are still, nothing at
    // all when the air has run out and the jacket has the controls.
    const sp = Math.min(1, Math.hypot(you.vx, you.vz) / SWIM.cruise);
    const amp = you.spent ? 0 : ARMS.idle + (1 - ARMS.idle) * sp;

    for (const a of sides) {
      // Half a cycle apart, which is what alternating means.
      const u = ((you.stroke / (Math.PI * 2)) + (a.side > 0 ? 0 : 0.5)) % 1;
      const c = cycle((u + 1) % 1, amp);
      a.shoulder.rotation.set(c.reach, 0, c.out * a.side, 'XYZ');
      a.elbow.rotation.set(-c.elb, 0, 0);
      // The wrist leads the hand into the water and trails it out, which is
      // the only part of a stroke anybody can see the point of from inside it.
      a.wrist.rotation.set(c.twist * 0.8, 0, c.twist * 0.5 * a.side);
    }
  }

  /**
   * Draw them, over the frame that has already been drawn.
   *
   * `autoClear` off and then back on: the whole point of this pass is that it
   * keeps the colour buffer and throws away the depth, and a renderer left
   * with autoClear off would wipe nothing on the *next* frame either.
   */
  function render(renderer) {
    if (!root.visible) return;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(stage, cam);
    renderer.autoClear = auto;
  }

  return {
    root, stage, cam,
    update, render,
    stats: () => ({
      on: root.visible ? 1 : 0,
      // Two arms, three pieces each, and every piece is a lathe of six or
      // seven sides — so this is a rounding error against a 3.4 M frame and
      // the only reason to print it is to prove they are actually there.
      pieces: sides.length * 3,
    }),
  };
}
