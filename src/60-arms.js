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
  shoulder: [0.195, -0.245, 0.145],

  // And a little of it back when you look down, which is the only thing left
  // of what used to be a `lift` here.
  //
  // That number tipped the whole shoulder line up by twenty-four degrees so
  // that the stroke would ride in the bottom third of the picture, and it was
  // the reason the arms could never be got right: it sat between the numbers
  // that were being tuned and the thing being looked at, so every attempt to
  // move a hand *in the frame* moved it somewhere else as well. The stroke is
  // written in the eye's own frame now — see SWIM_KEYS — and there is nothing
  // left for a lift to do.
  //
  // What is left is this: a swimmer who looks down does not only move their
  // eyes, the shoulders follow about half way. It is what makes a duck-dive
  // read, and it is also what lets you look down to watch your own stroke.
  follow: 0.55,

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

  // The bar, for the kite mode. 52 cm across, which is a small bar and the
  // common one, and where it sits relative to the eye: out in front, down at
  // the bottom of the chest, exactly where 59-ride.js puts its end of the
  // lines so that the two halves of the rig meet.
  barW: 0.52,
  barAt: [0.0, -0.23, -0.46],

  // How a hand is held, joint by joint, at the two ends of what a hand does.
  //
  // Flat is the paddle: five degrees at the knuckle and not much more down the
  // finger, because a crawl's hand is very nearly a board and the little curl
  // that is in it is the hand's own, not a grip. Loose is the recovery, and it
  // is a long way from flat on purpose — a hand off the water carries no shape
  // at all, and the number that looked right in a still frame looked like a
  // hand being *held* open the moment it moved.
  fingerFlat: [0.05, 0.09, 0.11],
  fingerLoose: [0.42, 0.55, 0.40],
  thumbFlat: [0.14, 0.30],
  thumbLoose: [0.40, 0.46],
  // And a third column, for the bar. The first pass at a kite grip ran the
  // two above off the end — mix(flat, loose, 1.52) — on the theory that a
  // fist is just further round the same arc. It is not: that put about 110
  // degrees into a finger that needs 190 to get round a 27 mm bar, so both
  // hands came out open, with the bar lying across the fingertips. A fist is
  // its own shape and it gets its own numbers.
  fingerFist: [1.30, 1.55, 0.80],
  thumbFist: [0.85, 0.95],

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
function armFingerBones(len, r) {
  const bone = [len * 0.45, len * 0.31, len * 0.24];
  return bone.map((L, i) => {
    const a = r * (1 - 0.11 * i), b = r * (1 - 0.11 * (i + 1));
    return {
      len: L,
      // Where the joint below it sits. Not at the tip: a knuckle is inside a
      // finger, not on the end of one, and hinging at the tip leaves a gap you
      // can see straight through every time the hand closes.
      joint: -L * 0.94,
      geo: armLimb(L, (t) => {
        // A knuckle at the head of each bone and a smaller one at its foot: a
        // finger is a string of beads and the beads are what you actually see.
        const w = a + (b - a) * t
          + r * 0.16 * Math.exp(-t * t * 34.0)
          + r * 0.10 * Math.exp(-(1 - t) * (1 - t) * 40.0);
        // The last bone ends in a pad, not a point. Second column is the depth
        // *ratio*, like every other profile in this file.
        return [w, 1.06 - 0.10 * t, 0.24, 0];
      }, { seg: 14, rows: 7, cap: 6 }),
    };
  });
}

/**
 * A hand: a palm with an arch and a thumb pad, four three-boned fingers and a
 * thumb. The palm comes back as one buffer; the digits come back as chains.
 *
 * A crawl's hand is not one shape, and shipping it as one was the mistake in
 * the last pass. Through the pull it is a paddle — fingers just touching and
 * very slightly cupped, because water goes through a splayed hand and a
 * clenched one has no surface. Through the recovery it is nothing at all: the
 * hand hangs off the wrist and the fingers fall open, and that loose hand
 * coming over the top is the single most recognisable thing about watching
 * somebody swim. Welded at the catch pose it held the paddle for the whole
 * cycle, which read as an arm with a glove on the end of it.
 *
 * So: bones, and the pose lives in `update` where the stroke phase is.
 */
function armHand(side) {
  const P = ARMS.palm;
  const palm = [];
  palm.push(armLimb(P, ARMS.palmProf, {
    seg: 30, rows: 14, cap: 8, capTopS: 0.42, capBotS: 0.16 }));

  // The thumb pad, laid along the thumb side of the palm and rolled forward
  // on to the palmar face where it actually sits. It belongs to the palm and
  // not to the thumb: a thenar does move when the thumb moves, but nothing
  // like as far, and hanging it off the thumb's first joint would swing a
  // quarter of the palm away every time the hand opened.
  const then = armLimb(P * 0.78, ARMS.thenarProf, {
    seg: 18, rows: 9, cap: 6, capTopS: 0.5, capBotS: 0.5 });
  then.applyMatrix4(new THREE.Matrix4()
    .makeRotationZ(-0.15 * side)
    .premultiply(new THREE.Matrix4().makeTranslation(-0.0206 * side, -0.0150, 0.0058)));
  palm.push(then);

  const digits = [];
  for (let i = 0; i < 4; i++) {
    const [len, r] = ARMS.finger[i];
    // Knuckles across the head of the palm, index at -X through little at +X
    // on the left hand and mirrored by the parent's sign.
    const x = (-1.5 + i) * 0.0228 * side;
    digits.push({
      kind: 'finger',
      i,
      pos: [x, -P + ARMS.knuckle[i], 0.0022],
      // Pitch is down the finger and fan is across the palm, kept apart
      // rather than baked into one matrix because the pose opens and closes
      // the fan while the pitch stays where the knuckle put it.
      pitch: 0.10,
      fan: -x * 1.25,
      bones: armFingerBones(len, r),
    });
  }

  // The thumb, off the side of the palm and a long way round the axis. Two
  // bones, not three, because that is how many a thumb has. Where it is held
  // is the pose's business now: in against the index for the catch, out and
  // away when the hand lets go.
  const tb = [ARMS.thumb * 0.56, ARMS.thumb * 0.44];
  digits.push({
    kind: 'thumb',
    i: 0,
    pos: [-0.0250 * side, -0.0548, 0.0090],
    pitch: 0.26,
    fan: -0.30 * side,
    bones: tb.map((L, i) => {
      const a = ARMS.thumbR * (1 - 0.16 * i), b = ARMS.thumbR * (1 - 0.16 * (i + 1));
      return {
        len: L,
        joint: -L * 0.94,
        geo: armLimb(L, (t) => {
          const w = a + (b - a) * t + ARMS.thumbR * 0.13 * Math.exp(-t * t * 30.0);
          return [w, 0.94 - 0.06 * t, 0.26, 0];
        }, { seg: 14, rows: 7, cap: 6 }),
      };
    }),
  });

  return { palm: kiteMerge(palm), digits };
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
    const hand = armHand(side);
    wrist.add(new THREE.Mesh(hand.palm, mat));

    // Every joint a Group, every bone a mesh hanging off it. That is
    // twenty-eight more draw calls across the two hands in a pass that had
    // six, which sounds like a great deal until you notice what the pass is:
    // two arms in an otherwise empty scene, drawn over a frame of three and a
    // half million triangles. It costs about a fifth of a millisecond and it
    // buys the one motion in the mode that everybody has felt from the inside.
    const digits = [];
    for (const d of hand.digits) {
      const joints = [];
      let parent = wrist;
      for (let i = 0; i < d.bones.length; i++) {
        const g = new THREE.Group();
        if (i === 0) {
          g.position.set(d.pos[0], d.pos[1], d.pos[2]);
          // ZYX, so the fan happens in the plane of the palm and the pitch
          // happens down the finger. The other way round, opening the hand
          // tips every finger out of the palm as well as away from it.
          g.rotation.order = 'ZYX';
        } else {
          g.position.set(0, d.bones[i - 1].joint, 0);
        }
        g.frustumCulled = false;
        g.add(new THREE.Mesh(d.bones[i].geo, mat));
        parent.add(g);
        joints.push(g);
        parent = g;
      }
      digits.push({ kind: d.kind, i: d.i, pitch: d.pitch, fan: d.fan, joints });
    }

    for (const m of [shoulder, elbow, wrist]) m.frustumCulled = false;
    sides.push({ side, shoulder, elbow, wrist, digits });
  }

  // ── and the bar, for the other water mode ─────────────────────────────────
  //
  // 59-ride.js draws the kite and the long lines in the world, and it cannot
  // draw the near end of them: the front clip is at 1.2 m and a bar is two
  // thirds of a metre from your face, so everything from your hands up to
  // shoulder height is inside the clip and simply is not there. That left four
  // white lines starting in mid-air over the water, which reads as a fault
  // rather than as a rig.
  //
  // This scene is the answer, and it is already here for exactly this reason —
  // a five-centimetre near plane. So the bar, the last two metres of each
  // line, and the two hands holding it are drawn here, and the world's lines
  // carry on from where these stop. The join is well above the bar and behind
  // both hands, which is the one part of the frame nothing is looking at.
  const rig = new THREE.Group();
  rig.visible = false;
  rig.frustumCulled = false;
  root.add(rig);
  {
    const barMat = solidMaterial(new THREE.Color(0.10, 0.10, 0.12),
      { spec: 0.35, specPower: 50, vcol: false });
    const gripMat = solidMaterial(new THREE.Color(0.72, 0.16, 0.10),
      { spec: 0.22, specPower: 26, vcol: false });
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0135, 0.0135, ARMS.barW, 10, 1), barMat);
    bar.rotation.z = Math.PI / 2;
    rig.add(bar);
    // The grips, which are the only coloured part of a bar and the reason you
    // can tell at a glance which way up it is.
    for (const s2 of [-1, 1]) {
      const g = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0175, 0.0175, 0.125, 10, 1), gripMat);
      g.rotation.z = Math.PI / 2;
      g.position.x = s2 * ARMS.barW * 0.34;
      rig.add(g);
    }
    // The centre line running down out of the bar to the harness, which is the
    // part of a kite rig nobody draws and everybody has seen.
    const cl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.46, 5, 1),
      solidMaterial(new THREE.Color(0.80, 0.78, 0.72), { spec: 0.1, vcol: false }));
    cl.position.y = -0.23;
    rig.add(cl);
    for (const m of rig.children) m.frustumCulled = false;
  }

  const ease = (t) => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;

  // ── where the hand goes ───────────────────────────────────────────────────
  //
  // The note at the top of this file argued at some length that a stroke is a
  // cycle and not a target, and that angles were therefore the right way to
  // write one. The argument is fine and the conclusion was wrong, and it took
  // a screenshot to see why: what has to be right about a first-person arm is
  // not the arm, it is where the hand lands *in the picture*. A chain of Euler
  // angles hides that behind two compositions and a shoulder lift, so being
  // wrong about it is invisible from the code and fixing it is guesswork —
  // which is exactly how the old one ended up with a forearm lying across the
  // bottom of the frame with a hand on the inboard end of it, an arm that
  // looked, in the words of the report, screwed on backwards.
  //
  // A path does not hide it. The catch is at sixty-nine per cent across the
  // frame and sixty-two per cent down, and either it is or it is not; the
  // solve underneath is four lines of cosine rule and has one singular pose,
  // which is the straight arm, and a straight arm is the one thing a closed
  // form gets exactly right.
  //
  // Metres, in the eye's own frame — +x her right, +y up, −z the way she is
  // looking. x is in *side* units so one curve serves both arms.
  const SWIM_KEYS = [
    [0.115, -0.045, -0.335],   // the catch: ahead, inboard, hand just under
    [0.175, -0.115, -0.330],   // the front of the pull, still in shot
    [0.250, -0.250, -0.230],   // under the chest, going out of the bottom
    [0.290, -0.370, -0.035],   // the exit, at the hip and gone
    [0.360, -0.230,  0.030],   // out of the water, elbow leading
    [0.395, -0.045, -0.090],   // over the top, wide and high
    [0.200,  0.010, -0.290],   // reaching: back into shot, coming inboard
  ];
  // And what a hand does when there is no stroke in it. Not a hang: written as
  // arms-by-your-sides it was invisible, which is worse than not drawing them.
  // Treading water is elbows in, forearms out in front, palms moving — you can
  // see your own hands the whole time, and that is what makes floating read as
  // floating rather than as the camera having been let go of.
  const SCULL_KEYS = [
    [0.150, -0.115, -0.330],
    [0.235, -0.145, -0.300],
    [0.240, -0.190, -0.270],
    [0.155, -0.205, -0.295],
    [0.105, -0.170, -0.325],
    [0.110, -0.130, -0.340],
  ];
  const curveOf = (keys) => new THREE.CatmullRomCurve3(
    keys.map((k) => new THREE.Vector3(k[0], k[1], k[2])), true, 'catmullrom', 0.5);
  const strokePath = curveOf(SWIM_KEYS);
  const scullPath = curveOf(SCULL_KEYS);

  const _p1 = new THREE.Vector3();
  const _p2 = new THREE.Vector3();

  /** Where this hand is at phase `u`, with `amp` of a stroke in it. */
  function handAt(u, amp, out) {
    strokePath.getPoint(u, _p1);
    scullPath.getPoint(u, _p2);
    return out.set(mix(_p2.x, _p1.x, amp), mix(_p2.y, _p1.y, amp),
      mix(_p2.z, _p1.z, amp));
  }

  const _u = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _bx = new THREE.Vector3();
  const _by = new THREE.Vector3();
  const _bz = new THREE.Vector3();
  const _mm = new THREE.Matrix4();
  const _g = new THREE.Vector3();
  const _tw = new THREE.Vector3();
  const _qi = new THREE.Quaternion();
  const clamp1 = (v) => Math.min(1, Math.max(-1, v));

  /**
   * Put this arm's wrist at a point, with the elbow sent toward a hint.
   *
   * Two links and one closed form. The elbow angle is the cosine rule; the
   * upper arm is the line to the target tilted off it by the other cosine
   * rule, about an axis chosen so the elbow ends up where the hint asks —
   * which is the whole reason to do it this way. A high elbow is what
   * separates a crawl from a windmill and a dropped elbow is what makes a
   * kite bar look like it is being carried rather than held, and in both cases
   * it is one vector rather than a table of angles nobody can read.
   *
   * Everything is in the eye's frame. `pole` is a direction, not a point.
   */
  function reachWrist(a, tx, ty, tz, px, py, pz) {
    const S = ARMS.shoulder;
    _u.set(tx - S[0] * a.side - body.position.x,
      ty - S[1] - body.position.y,
      tz - S[2] - body.position.z);
    const raw = _u.length() || 1e-4;
    const L = ARMS.upper, F = ARMS.fore;
    // 0.998 rather than 1: a solve asked for exactly full reach lands on
    // acos(±1), where the derivative is infinite and a hand a millimetre too
    // far away snaps the elbow through straight.
    const d = Math.min(raw, (L + F) * 0.998);
    _u.multiplyScalar(1 / raw);
    const elb = Math.PI - Math.acos(clamp1((L * L + F * F - d * d) / (2 * L * F)));
    const back = Math.acos(clamp1(
      (L * L + d * d - F * F) / (2 * L * Math.max(d, 1e-4))));
    // The bend axis, perpendicular to both the reach and the hint. Cross this
    // way round and a positive `back` tilts the upper arm *toward* the hint,
    // which is what having a hint is for.
    _n.set(px, py, pz);
    _n.crossVectors(_u, _n);
    if (_n.lengthSq() < 1e-9) _n.set(a.side, 0, 0);
    _n.normalize();
    // A basis rather than three Euler angles, because the bone hangs down −Y
    // and bends about +X and this says exactly that: −Y is the upper arm, +X
    // is the axis the elbow turns on. Written as Eulers it was very nearly
    // right — the swing-out came through with its sign flipped, which on the
    // kite bar was two centimetres and invisible and in the water was an arm
    // that reached across the body instead of away from it.
    _by.copy(_u).applyAxisAngle(_n, back).negate();
    _bx.copy(_n);
    _bz.crossVectors(_bx, _by).normalize();
    _bx.crossVectors(_by, _bz).normalize();
    _mm.makeBasis(_bx, _by, _bz);
    a.shoulder.quaternion.setFromRotationMatrix(_mm);
    a.elbow.rotation.set(-elb, 0, 0);
  }

  /**
   * Turn the palm to face a direction.
   *
   * The chain shoulder → elbow → wrist bends in one plane and has no
   * pronation in it anywhere, so with the arm out in front the palm faces
   * wherever the shoulder happened to leave it and no amount of wrist bend
   * will turn it over. A real forearm rotates about its own axis, and that is
   * one number: a rotation about the wrist's Y, which is the forearm's axis.
   *
   * Solved rather than tabulated. The palm at zero twist faces the wrist's
   * +Z, so the answer is the wanted direction expressed in the forearm's own
   * frame, read off as an angle in its XZ plane. Order XZY so the twist is
   * innermost and the flex on top of it is a wrist bend rather than a second,
   * unwanted pronation.
   */
  function twistTo(a, nx, ny, nz, flex, acrossPalm) {
    _tw.set(nx, ny, nz).applyQuaternion(root.quaternion);
    a.elbow.getWorldQuaternion(_qi);
    _tw.applyQuaternion(_qi.invert());
    // Two ways to say the same one degree of freedom, and which one you pick
    // decides whether the answer is stable.
    //
    // A palm normal is the natural way to describe a paddle and a hopeless way
    // to describe a grip: gripping a bar, the direction the palm faces is
    // nearly along the forearm, and atan2 of a vector that is nearly all Y is
    // a number that swings wildly for a millimetre of nothing. That is what
    // the twisted wrists on the kite bar were. Across the palm — knuckle row
    // to knuckle row, the hand's own X — is the well-conditioned way to say
    // it, and it is also the true constraint: the bar goes *through* the fist,
    // so what has to line up with the bar is the tunnel, not the palm.
    a.wrist.rotation.set(flex, acrossPalm
      ? Math.atan2(-_tw.z, _tw.x)
      : Math.atan2(_tw.x, _tw.z), 0, 'XZY');
  }

  /**
   * Put a point *in the hand* on a point in the world, twice.
   *
   * The solve above places the wrist, and a wrist is not what holds anything:
   * the hand carries on for another nine centimetres past it, in a direction
   * that depends on the twist, which depends on the solve. So: aim the wrist
   * at the target, see where the palm actually landed, aim it at the target
   * minus that error, and do it again. Four passes, because the twist is
   * re-solved each time and the offset turns with it, so it converges rather
   * than lands: about a hand's length, then a centimetre, then two or three
   * millimetres. `missMm` in the probe is what is left.
   */
  function placeHand(a, tx, ty, tz, px, py, pz, ox, oy, oz, nx, ny, nz, flex,
    acrossPalm) {
    let cx = 0, cy = 0, cz = 0;
    for (let pass = 0; pass < 4; pass++) {
      reachWrist(a, tx + cx, ty + cy, tz + cz, px, py, pz);
      twistTo(a, nx, ny, nz, flex, acrossPalm);
      _g.set(ox, oy, oz);
      a.wrist.localToWorld(_g);
      body.worldToLocal(_g);
      const ex = tx - (_g.x + body.position.x);
      const ey = ty - (_g.y + body.position.y);
      const ez = tz - (_g.z + body.position.z);
      // Reported, because a solve that quietly does not converge looks
      // exactly like a solve that is aiming at the wrong point, and the two
      // want opposite fixes.
      a.miss = Math.hypot(ex, ey, ez);
      if (pass === 3) break;
      cx += ex; cy += ey; cz += ez;
    }
  }

  /**
   * How loose the hand is at phase `u` — 0 a flat paddle, 1 a hand hanging.
   *
   * It lets go a little before the exit, because by then the hand is already
   * off the water and holding a paddle after the paddle has stopped working is
   * the glove again. Loosest with the elbow over the top. Gathered through the
   * last fifth so the fingertips lead the hand in, which is what the entry of
   * a crawl actually is — the hand goes in fingers first and the rest of the
   * arm follows it through the same hole.
   *
   * Zero at both ends with zero slope, so the seam at the catch is not a place
   * where anything visibly happens.
   */
  function grip(u) {
    const rise = ease(Math.min(1, Math.max(0, (u - 0.46) / 0.16)));
    const fall = ease(Math.min(1, Math.max(0, (u - 0.78) / 0.20)));
    return rise - fall;
  }

  const _e = new THREE.Euler();
  const _h1 = new THREE.Vector3();
  const _h2 = new THREE.Vector3();

  /**
   * Place and pose them.
   *
   * Called after `swim.pose(camera)` and before the render, because it takes
   * the camera's own transform apart: the position is the head, the yaw and
   * pitch are where you are looking, and the roll is the stroke, which belongs
   * to the head and not to the shoulders.
   */
  /**
   * Both hands on a bar.
   *
   * The whole pose is one constraint — the hands are at two fixed points in
   * front of you and the arms have to reach them — so it is the one pose in
   * the game that was always going to be a solve, and now that the swim is
   * one too they are the same four lines.
   *
   * `pull` is 0 for a bar held out at arm's length and 1 for a bar pulled in
   * to the hip, which is the whole of the power control and the reason you can
   * see how hard you are working without a gauge.
   */
  // How far forward the shoulders come for the bar. The swim's shoulder
  // offset is a *prone* one — behind the eye, because a swimmer's head is
  // ahead of their shoulders as well as above them — and on a board it is
  // exactly wrong.
  const RIDE_LEAN = 0.14;

  /** Shut every joint in a hand into a fist. Used to hold a bar and to find it. */
  function fistDigits(a) {
    for (const dg of a.digits) {
      const thumb = dg.kind === 'thumb';
      const fist = thumb ? ARMS.thumbFist : ARMS.fingerFist;
      for (let j = 0; j < dg.joints.length; j++) {
        if (j === 0) {
          // The fingers come together round a bar and the thumb comes across
          // under it — which is the difference between a grip and a hand
          // resting on something.
          dg.joints[j].rotation.set(dg.pitch + fist[j], 0,
            thumb ? dg.fan * 2.1 : dg.fan * 0.12);
        } else {
          dg.joints[j].rotation.x = fist[j];
        }
      }
    }
  }

  /**
   * Where the hole in a fist is, in the wrist's own frame — measured.
   *
   * The first two attempts at this were guesses: five centimetres down the
   * palm, then ten and a half. Both were wrong in the way a guess about a
   * curled finger is always wrong, because where the loop closes depends on
   * three joint angles and a knuckle offset and nobody can do that in their
   * head. So the hand is put into a fist once, at build time, and asked.
   *
   * Midway between the knuckle row and the far end of the middle finger, which
   * for a hand shut this far is inside the loop and is where a 27 mm bar goes.
   */
  const GRIP_OFF = new THREE.Vector3();
  {
    const a = sides[1];
    fistDigits(a);
    a.wrist.rotation.set(0, 0, 0);
    a.wrist.updateWorldMatrix(true, true);
    const mid = a.digits[1];
    GRIP_OFF.copy(a.wrist.worldToLocal(
      mid.joints[mid.joints.length - 1].getWorldPosition(new THREE.Vector3())));
    GRIP_OFF.y += -ARMS.palm;
    GRIP_OFF.multiplyScalar(0.5);
  }

  function barPose(a, pull, t) {
    // The grips, in the eye's frame. Same three numbers `updateRide` puts the
    // bar at, so the hands cannot drift off it however the bar is sheeted.
    const tx = a.side * (ARMS.barW * 0.34);
    const ty = ARMS.barAt[1] + 0.055 * pull;
    const tz = ARMS.barAt[2] + 0.12 * pull + Math.sin(t * 1.7 + a.side) * 0.008;
    // Elbows down and outboard, which is where a rider's are: hanging off a
    // bar with your elbows up is a chin-up, not a kite.
    //
    // The point in the hand that has to land on the bar is the *hole* a fist
    // makes — ten and a half centimetres down from the wrist, past the knuckle
    // row, and three centimetres on to the palmar side where the curled
    // fingers close over. Not the wrist, which is what the first pass aimed at
    // and is why both hands sat a palm's width beyond the bar; and not the
    // middle of the palm either, which is what the second aimed at and put the
    // bar across the wrist with the fist above it holding nothing.
    //
    // And the palm faces down and back toward you, because that is an overhand
    // grip and an overhand grip is the only one anybody uses on a bar.
    // The fingers shut first, because the solve below aims the *hole* they
    // make at the bar and there is no hole in an open hand.
    fistDigits(a);
    // Across the palm, along the bar: the tunnel a fist makes is what the bar
    // goes through, so that is the axis to line up. Both hands the same way —
    // the two hands are mirrored, so her right thumb and her left thumb both
    // end up pointing in toward the middle of the bar, which is the grip
    // everybody actually uses.
    placeHand(a, tx, ty, tz,
      0.52 * a.side, -0.82, 0.24,
      GRIP_OFF.x, GRIP_OFF.y, GRIP_OFF.z,
      1, 0, 0,
      0.10 + 0.14 * pull, true);
  }

  /**
   * `ctx` is whichever water mode is running. Both of them are two arms in
   * front of a camera and nothing else in the game is, so they share the
   * scene, the material, the geometry and the draw — and differ only in what
   * the joints are told.
   */
  function update(dt, ctx, camera) {
    const swim = ctx && ctx.active && ctx.you && ctx.you.stroke !== undefined
      ? ctx : null;
    const ride = ctx && ctx.active && !swim ? ctx : null;
    // Not in the water. Everything below this line still works and none of it
    // runs there any more.
    //
    // The verdict on the swim arms was that they were not working and were not
    // going to, and it is worth being precise about what that means, because
    // the code is staying: the *stroke* was the problem and not the arm. A
    // crawl seen from inside your own head is two limbs crossing most of the
    // frame twice a second, and at a 58-degree lens there is no version of
    // that which does not read as flailing — the closer it gets to a real
    // crawl the busier it looks, which is the opposite of how animation
    // usually goes. What replaces it is what you actually notice in the sea,
    // which is not your arms: it is the mask, and it is the bubbles. See
    // 62-mask.js.
    //
    // The bar grip is untouched. Hands on a kite bar are the same rig doing
    // the thing a first-person view is good at — holding still — and nobody
    // complained about those.
    const on = !!ride;
    root.visible = on;
    rig.visible = !!ride;
    if (!on) return;
    if (ride) return updateRide(dt, ride, camera);

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
    body.position.set(0, 0, 0);
    root.position.copy(camera.position);
    // Yaw, and half the pitch. No roll: a prone swimmer's shoulders follow the
    // head down when it looks down — that is what makes a duck-dive read, and
    // it is also what lets you look down and watch your own stroke — but they
    // do not tip with it, and taking the roll out here is why the arms swing
    // under a horizon that is tipping rather than with it.
    _e.set(you.pitch * ARMS.follow, you.yaw, 0, 'YXZ');
    root.quaternion.setFromEuler(_e);

    // How much of a stroke there is. Sculling when you are still, nothing at
    // all when the air has run out and the jacket has the controls.
    const sp = Math.min(1, Math.hypot(you.vx, you.vz) / SWIM.cruise);
    const amp = you.spent ? 0 : ARMS.idle + (1 - ARMS.idle) * sp;

    for (const a of sides) {
      // Half a cycle apart, which is what alternating means.
      const u = (((you.stroke / (Math.PI * 2)) + (a.side > 0 ? 0 : 0.5)) % 1 + 1) % 1;
      handAt(u, amp, _h1);
      // Which way the palm faces, and it is not a number in a table: through
      // the pull a hand is a paddle and faces the way the water has to go,
      // which is straight back down its own track, so the normal is the
      // direction it is travelling, backwards. Read off the path itself, so a
      // change to the stroke cannot leave the hands facing the old one.
      handAt((u + 0.02) % 1, amp, _h2);
      _h2.sub(_h1);
      if (_h2.lengthSq() < 1e-10) _h2.set(0, 0, -1);
      _h2.normalize().multiplyScalar(-1);
      // On the recovery it turns over and faces down and outboard, which is
      // what lets the arm come over the top edge-on instead of dragging a
      // plate through the air.
      const paddle = 1
        - ease(Math.min(1, Math.max(0, (u - 0.50) / 0.18)))
        + ease(Math.min(1, Math.max(0, (u - 0.95) / 0.05)));
      // Off the paddle it faces down and a little forward, which is the hand
      // going in fingertips first through its own hole — the one part of a
      // crawl anybody can see the point of from the inside, and the reason
      // the entry does not look like a slap.
      const nx = mix(0.32, _h2.x, paddle);
      const ny = mix(-0.88, _h2.y, paddle);
      const nz = mix(-0.35, _h2.z, paddle);
      // Elbow high and outboard of the line from shoulder to hand. One vector,
      // and it is the whole of the high-elbow catch.
      placeHand(a, _h1.x * a.side, _h1.y, _h1.z,
        0.78 * a.side, 0.58, 0.24,
        0.0, -0.050, 0.006,
        nx * a.side, ny, nz,
        0.14 - 0.30 * paddle);

      // And the hand on the end of it.
      //
      // Staggered, because four fingers that curl on the same frame are one
      // paddle with lines drawn on it — which is exactly what the welded
      // version looked like and exactly the complaint it earned. Each finger
      // lags the one before by about a hundredth of a cycle, and the little
      // finger travels a fifth further than the index, because a hand letting
      // go does not let go all at once or evenly.
      for (const d of a.digits) {
        const thumb = d.kind === 'thumb';
        const lag = thumb ? 0.03 : d.i * 0.012;
        // The scull is what is left when there is no stroke: a floating hand
        // is never still, it opens and closes very slightly the whole time,
        // and a still one reads as a prop somebody is holding.
        const g = amp * grip(((u - lag) % 1 + 1) % 1)
          + (1 - amp) * (0.42 + 0.14 * Math.sin(u * Math.PI * 2 - d.i * 0.6));
        const k = thumb ? 1 : 0.90 + 0.08 * d.i;
        const flat = thumb ? ARMS.thumbFlat : ARMS.fingerFlat;
        const loose = thumb ? ARMS.thumbLoose : ARMS.fingerLoose;
        for (let j = 0; j < d.joints.length; j++) {
          const c = mix(flat[j], loose[j], g) * k;
          if (j === 0) {
            // Together for the paddle, fanned when the hand is nothing.
            // Together for the paddle — really together: a crawl's fingers
            // touch, and the version that kept a quarter of the fan in at the
            // catch came out as a starfish going past the lens.
            d.joints[j].rotation.set(d.pitch + c, 0,
              d.fan * mix(thumb ? 0.55 : 0.04, thumb ? 1.30 : 1.15, g));
          } else {
            d.joints[j].rotation.x = c;
          }
        }
      }
    }
  }

  /**
   * The same two arms, on a bar instead of in a stroke.
   *
   * The body does not roll here and the camera does — you counter-lean against
   * the pull and your head stays a good deal squarer to the horizon than the
   * board is — so this takes the heel back out of the shoulders exactly the
   * way the swim takes the stroke roll out, and for the same reason.
   */
  function updateRide(dt, ride, camera) {
    cam.fov = camera.fov;
    cam.aspect = camera.aspect;
    cam.position.copy(camera.position);
    cam.quaternion.copy(camera.quaternion);
    cam.updateProjectionMatrix();

    const you = ride.you;
    root.position.copy(camera.position);
    // Yaw with the board and not with the head: turn to look at your kite and
    // your arms stay on the bar, which is the entire point of the mode having
    // a separate look in the first place.
    // Yaw only. The camera already rolls with the edge — see `pose` in
    // 59-ride.js — and rolling the shoulders as well rolled the bar twice, so
    // it came out across the frame at twenty-five degrees instead of the nine
    // the lean actually accounts for.
    _e.set(0, you.yaw, 0, 'YXZ');
    root.quaternion.setFromEuler(_e);
    body.position.set(0, 0, -RIDE_LEAN);

    rig.position.set(ARMS.barAt[0], ARMS.barAt[1] + 0.055 * you.pull,
      ARMS.barAt[2] + 0.12 * you.pull);
    rig.rotation.set(-0.24, 0, 0);

    const pull = you.pull;
    for (const a of sides) barPose(a, pull, you.t);
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
      mode: rig.visible ? 'bar' : (root.visible ? 'swim' : 'off'),
      // Two arms, three pieces each, plus fourteen finger and thumb bones a
      // side — every one of them a lathe, so this is still a rounding error
      // against a 3.4 M frame and the only reason to print it is to prove
      // they are actually there.
      pieces: sides.reduce((n, a) =>
        n + 3 + a.digits.reduce((m, d) => m + d.joints.length, 0), 0),
      // How open the near hand is right now, 0..1. The one number worth
      // watching when this is wrong.
      grip: sides.length
        ? +sides[0].digits[0].joints[0].rotation.x.toFixed(3) : 0,
    }),
    /**
     * Where the hands actually are *in the frame*, per cent across and down.
     *
     * The one number that decides whether a first-person arm works, and until
     * this existed the only way to read it was to take a screenshot and look.
     * A catch belongs somewhere near [69, 62] on the near side; a hand at
     * [104, 91] is out of shot and a hand at [50, 50] is in your face.
     */
    probe: () => sides.map((a) => {
      const pt = (o) => {
        const v = o.getWorldPosition(new THREE.Vector3()).project(cam);
        return [+((v.x * 0.5 + 0.5) * 100).toFixed(1),
          +((0.5 - v.y * 0.5) * 100).toFixed(1)];
      };
      return {
        side: a.side,
        wrist: pt(a.wrist),
        tip: pt(a.digits[1].joints[a.digits[1].joints.length - 1]),
        elbow: pt(a.elbow),
        // Millimetres between where the hand was asked to hold and where it
        // actually does. Under about three is a hand on a bar.
        missMm: Math.round((a.miss || 0) * 1000),
      };
    }),
  };
}
