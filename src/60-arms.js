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

  upper: 0.295,        // m — humerus
  fore: 0.265,         // radius/ulna
  palm: 0.098,         // wrist to knuckle

  // Silhouettes, not radii. The first version was two cones and a squashed
  // third, and two cones is exactly what it looked like: an arm's outline is
  // not monotonic anywhere along its length. The deltoid is the widest part of
  // the upper arm and it is at the top; the forearm's widest part is a hand's
  // breadth *below* the elbow and it runs to a wrist half that size. Getting
  // those two bulges in is most of the difference between a limb and a pipe,
  // and neither of them costs a triangle over the cone that was there.
  //
  // Elliptical, too. A forearm is a good bit deeper than it is wide seen from
  // above and the other way round seen from the front; a round one catches the
  // light evenly all the way along, which is the other half of why the cones
  // read as plumbing.
  upperProf: (t) => {
    const w = 0.0570 - 0.0170 * t + 0.0052 * Math.sin(Math.PI * t);
    return [w, w * 0.93];
  },
  foreProf: (t) => {
    const w = 0.0452 - 0.0180 * t + 0.0068 * Math.sin(Math.PI * Math.pow(t, 0.65));
    return [w, w * 0.80];
  },

  // The hand, which is now a hand. See `armHand`.
  finger: [0.0715, 0.0790, 0.0755, 0.0620],
  fingerR: 0.0098,
  thumb: 0.0640,

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
  base *= 1.0 + 0.05 * (vnoise2(vec2(vLocal.x + vLocal.z, vLocal.y) * 210.0) - 0.5);

  base = mix(base, vec3(0.760, 0.335, 0.250), afr * 0.26);
`;

/**
 * One tapered limb, hanging from the origin down −Y.
 *
 * Down −Y because that is the direction a joint chain wants to be written in:
 * the shoulder is at the origin, the elbow is `len` below it, and every
 * rotation in the file is then a rotation of a thing that starts by hanging.
 */
function armLimb(len, prof, opt = {}) {
  const seg = opt.seg ?? 24, rows = opt.rows ?? 14, N = 6;
  const st = [];
  const [rx0, rz0] = prof(0), [rx1, rz1] = prof(1);
  // The caps are what fixed the joints. Two flat-ended cylinders meeting at a
  // bent elbow show you both of their end discs and the wedge of nothing
  // between them, and at forty centimetres from the lens that wedge is the
  // first thing you see. Round both ends into half an ellipsoid and the pieces
  // read as one arm through any bend the cycle asks for, with no skinning, no
  // blend shape and no joint sphere sitting proud of the limb it belongs to.
  if (opt.capTop !== false) {
    for (let i = N; i >= 1; i--) {
      const a = (i / N) * Math.PI * 0.5, c = Math.max(Math.cos(a), 0.004);
      st.push([rx0 * Math.sin(a) * 0.80, rx0 * c, rz0 * c]);
    }
  }
  for (let j = 0; j <= rows; j++) {
    const t = j / rows, r = prof(t);
    st.push([-t * len, r[0], r[1]]);
  }
  if (opt.capBot !== false) {
    for (let i = 1; i <= N; i++) {
      const a = (i / N) * Math.PI * 0.5, c = Math.max(Math.cos(a), 0.004);
      st.push([-len - rx1 * Math.sin(a) * 0.80, rx1 * c, rz1 * c]);
    }
  }
  const rings = st.map(([y, rx, rz]) => {
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      ring.push(new THREE.Vector3(Math.cos(th) * rx, y, Math.sin(th) * rz));
    }
    return ring;
  });
  return loft(rings, { closed: true, caps: false });
}

/**
 * A hand: a palm, four fingers and a thumb, merged into one buffer.
 *
 * The old one was the limb builder run a third time with the cross-section
 * squashed — a lozenge, which is genuinely what a hand looks like from two
 * metres and genuinely does not from forty centimetres, where it is the
 * largest object on the screen for a third of every stroke. Fingers are five
 * more lathes and one draw call either way.
 *
 * Not splayed, and not clamped shut. A crawl's hand is a paddle held with the
 * fingers just touching and very slightly cupped — water goes through a splayed
 * hand and a clenched one has no surface — so they lie together with a couple
 * of degrees of curl and the little finger trailing the others, which is the
 * shape that says "this hand is doing something" rather than "this hand is
 * a model of a hand".
 */
function armHand(side) {
  const parts = [];
  const P = ARMS.palm;
  // The palm. Wider at the knuckles than at the wrist, and thin through —
  // a hand is about 20 mm deep and 85 mm across and the ratio is the whole
  // silhouette.
  parts.push(armLimb(P, (t) => [0.0385 + 0.0105 * t, 0.0205 - 0.0035 * t],
    { seg: 20, rows: 6 }));

  const R = ARMS.fingerR;
  for (let i = 0; i < 4; i++) {
    const len = ARMS.finger[i];
    // Knuckles across the head of the palm, index at −X through little at +X
    // on the left hand and mirrored by the parent's sign.
    const x = (-1.5 + i) * 0.0232 * side;
    const g = armLimb(len, (t) => {
      const w = R * (1 - 0.22 * t);
      return [w, w * 1.06];                 // fingers are deeper than they are wide
    }, { seg: 12, rows: 5 });
    // A little curl, and a little converge — the tips of a swimmer's fingers
    // are closer together than the knuckles are.
    const m = new THREE.Matrix4()
      .makeRotationX(0.16)
      .premultiply(new THREE.Matrix4().makeRotationZ(-x * 1.15))
      .premultiply(new THREE.Matrix4().makeTranslation(x, -P + 0.004, 0.0015));
    parts.push(g.applyMatrix4(m));
  }
  // The thumb, off the side of the palm and a long way round the axis: held
  // in against the index finger, which is where it is on a catch.
  const th = armLimb(ARMS.thumb, (t) => {
    const w = 0.0128 * (1 - 0.24 * t);
    return [w, w * 0.92];
  }, { seg: 12, rows: 4 });
  th.applyMatrix4(new THREE.Matrix4()
    .makeRotationZ(-0.62 * side)
    .premultiply(new THREE.Matrix4().makeRotationX(0.34))
    .premultiply(new THREE.Matrix4().makeTranslation(-0.0335 * side, -0.0300, 0.0035)));
  parts.push(th);
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
