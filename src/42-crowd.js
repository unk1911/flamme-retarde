// -----------------------------------------------------------------------------
// People, drawn many at a time.
//
// There are two casts in this game. The aerodrome ground crew are Blender-
// authored — tools/blender/firefighter.py — eleven rigid parts on a joint tree,
// and they walk; there are eight of them and each one is a Three.js Group
// hierarchy with its own material, which is the right answer for eight.
//
// The Jadrija bathers were the hold-out. A hundred and some figures written out
// by hand as stacked frustums and baked into the concrete, so that not one of
// them could turn a head. From the promenade that is exactly what it looked
// like: a beach of shop mannequins, all facing slightly different directions,
// forever.
//
// This is the machinery for the second case. Same rig format, same joint names,
// same sign convention, and — the point — the *same walk cycle*, because a
// second implementation of a gait is a second thing to get wrong. What is
// different is how they are drawn: one instanced layer per rig part, so a
// hundred and twenty people cost twenty-two draw calls instead of thirteen
// hundred. Posing happens on one scratch skeleton that is re-posed per figure
// and read out into the instance buffers, which means the whole crowd carries
// no per-figure Three.js objects at all.
//
// The sign convention, restated because every line of the animation depends on
// it and it is the one thing that is not obvious from the code:
//
//   forward is +X, up is +Y, the figure's own left is -Z
//   a joint's rotation.z swings its far end toward +X, i.e. forward
//   a joint's rotation.x swings its far end toward the figure's left
// -----------------------------------------------------------------------------

const CROWD = {
  // Past this there is no point posing anybody: at 240 m a 1.7 m figure is
  // about four pixels tall and the gait is well under one, so the whole crowd
  // is skipped rather than animated into a smear.
  poseM: 240,
  // Walkers stop and look at things. These are seconds, and the spread matters
  // more than the middle: a promenade where everybody pauses for the same four
  // seconds reads as a carousel.
  pause: [2.0, 8.0],
  speed: [0.78, 1.34],       // m/s. A seaside stroll, not a commute.
  // How close a walker lets you get before stepping around you. Slightly more
  // than an arm's length, because being brushed past is fine and being walked
  // through is not.
  clear: 1.15,
};

// How far an arm hangs out from the body at rest. Zero is a soldier at
// attention; this is a person.
const SPLAY = 0.11;

/**
 * Every joint written every frame, from rest.
 *
 * Touching only what changes means a pose left over from `alight` bleeds into
 * `safe` two seconds later, and eleven assignments are cheaper than reasoning
 * about which of them are stale.
 */
function restPose(f) {
  for (const j of f.joints) j.rotation.set(0, 0, 0);
  f.pelvis.position.y = f.restY;
  f.armLU.rotation.x = SPLAY;
  f.armRU.rotation.x = -SPLAY;
}

/**
 * A stride: hips, knees, shoulders and elbows off one phase angle.
 *
 * The knee is phased off the hip rather than given a curve of its own. It
 * flexes hardest just after the foot leaves the ground and is straight at the
 * moment it lands, which is one cosine away from the hip — and that single
 * relationship is most of the difference between a walk and a pair of
 * scissors. A knee also only bends one way, hence the negative sign and the
 * squared term that keeps it there.
 */
function stride(f, phase, amp, armAmp) {
  for (const [up, lo, off] of [[f.legLU, f.legLL, 0], [f.legRU, f.legRL, Math.PI]]) {
    const t = phase + off;
    up.rotation.z = Math.sin(t) * amp;
    const k = Math.max(0, Math.cos(t + 0.55));
    lo.rotation.z = -(0.13 + 1.20 * k * k) * amp;
  }
  if (armAmp <= 0) return;
  // Opposite the leg on the same side, which is what stops a walk looking
  // like a march.
  for (const [up, lo, off, side] of [[f.armLU, f.armLL, Math.PI, 1],
    [f.armRU, f.armRL, 0, -1]]) {
    const s = Math.sin(phase + off);
    up.rotation.z = s * amp * armAmp;
    up.rotation.x = side * SPLAY;
    lo.rotation.z = (0.20 + 0.65 * Math.max(0, s)) * amp * armAmp * 1.5;
  }
}

/**
 * The joint tree with no geometry in it.
 *
 * `makeFigure` in 47-ground.js builds the same hierarchy with a Mesh in every
 * Group, which is what you want for eight people you are going to add to the
 * scene. Here the tree is scratch: it gets posed, its world matrices read out,
 * and then re-posed as the next person. Nothing is ever drawn from it, so
 * nothing is ever put in it.
 */
function rigSkeleton(rig) {
  const root = new THREE.Group();
  // YXZ so that laying a figure down and then aiming it is a tip followed by a
  // yaw about world up, rather than the two fighting each other.
  root.rotation.order = 'YXZ';
  const f = { root, joints: [] };
  for (const p of rig.parts) {
    const g = new THREE.Group();
    g.position.set(p.pivot[0], p.pivot[1], p.pivot[2]);
    (p.parent < 0 ? root : f.joints[p.parent]).add(g);
    f.joints.push(g);
    f[p.name] = g;
  }
  f.restY = f.pelvis.position.y;
  return f;
}

/**
 * One instanced layer for one rig part.
 *
 * The marker palette is the whole reason this has its own material rather than
 * sharing the landmarks' `base *= vVCol`. tools/blender/bather.py paints three
 * reserved colours that mean "ask the instance", and this is where they are
 * asked. See that file's docstring for the convention.
 */
function crowdLayer(scene, proto, cap) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', proto.attributes.position);
  geo.setAttribute('normal', proto.attributes.normal);
  geo.setAttribute('aVCol', proto.attributes.aVCol);
  geo.setIndex(proto.index);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

  const A = {
    aPos: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
    aRot: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4),
    aScale: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
    aColor: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
    aSuit: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
    aHair: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
  };
  const NAME = {
    aPos: 'aInstPos', aRot: 'aInstRot', aScale: 'aInstScale',
    aColor: 'aInstColor', aSuit: 'aInstSuit', aHair: 'aInstHair',
  };
  for (const k in A) {
    A[k].setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(NAME[k], A[k]);
  }

  const mesh = new THREE.Mesh(geo, solidMaterial(0xffffff, {
    instanced: true,
    spec: 0.09,
    specPower: 24,
    body: `
      // The marker palette from tools/blender/bather.py. Skin is painted pure
      // white, swimwear pure black and hair pure red, and none of those is a
      // colour anybody wanted — they are three questions the mesh asks of the
      // instance, so that one pair of meshes can be a whole beach of different
      // people. Anything else is taken literally.
      float s3 = vVCol.r + vVCol.g + vVCol.b;
      base = vVCol;
      base = mix(base, vColor, step(2.94, s3));
      base = mix(base, vSuit, 1.0 - step(0.06, s3));
      base = mix(base, vHair, step(0.94, vVCol.r) * (1.0 - step(0.06, vVCol.g + vVCol.b)));
      n = gl_FrontFacing ? n : -n;
    `,
    side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  scene.add(mesh);
  geo.instanceCount = 0;
  return { geo, mesh, ...A };
}

/**
 * A crowd sharing one rig.
 *
 * `figures` is the caller's to fill and to move: this end owns posing and
 * drawing and knows nothing about where anybody is going, which is how the
 * promenade logic stays in 43-jadrija.js where it belongs.
 */
/**
 * The eight, in the order they are cast.
 *
 * Named here rather than in 43-jadrija.js because the names are the bake's —
 * tools/blender/mh_morph.py holds the recipe for each, and the payload keys are
 * these strings with `bather_` in front and `_fr3d` behind. The order is the
 * casting order and it matters only in that it is stable: person three is
 * person three every time the beach is built.
 *
 * Two children, two people past sixty, a heavy man, a full-figured woman, a
 * lean man and a slim woman. Which is not a diversity checklist, it is what a
 * Dalmatian bathing station has on it in August, and the thing the old crowd
 * could not do at any number of instances.
 */
const BATHER_CAST = [
  'woman_young_slim', 'man_old_heavy', 'girl_child', 'man_young_fit',
  'woman_young_full', 'boy_child', 'woman_old', 'man_young_lean',
];

/**
 * The same contract as `makeCrowd`, backed by one skinned figure per person.
 *
 * Two casts became three. The aerodrome crew are eleven rigid parts in a Group
 * hierarchy, right for eight of them; the promenade walkers are those same
 * eleven parts instanced, right for a hundred and twenty. This is the third
 * answer and it is the opposite trade: eight people, each a *different* mesh
 * with its own skeleton, its own build, its own height and its own skin, at
 * seven thousand triangles apiece.
 *
 * It exists because the instanced crowd could never be more than two silhouettes
 * repainted. A beach of twenty-four box people all cut from a man and a woman
 * reads as a beach of twenty-four box people however many colours they are
 * wearing — and the fix is not more of them. Eight who are actually different
 * cost fewer triangles than twenty-four who are not, and they are made from the
 * same MakeHuman base the game's other figure is built from, morphed: see
 * tools/blender/mh_morph.py for the eight recipes and bathers_mh.py for the
 * bake.
 *
 * `figs` are already-loaded skinned figures. Binding is by index and it has to
 * be: a figure whose identity is reassigned per frame is a person who changes
 * body when you walk past them.
 *
 * The `figures` array, the `flush(t, cam)` call and the distance cut are all
 * `makeCrowd`'s, so the promenade logic in 43-jadrija.js does not know which of
 * the two it is talking to.
 */
function makeSkinCrowd(scene, figs, cap) {
  const figures = [];
  let drawn = 0;
  let last = -1;

  // What each pose is called over here. The crowd's `mode` is a body position
  // and a clip is a body position over time, so most of them land on `idle`:
  // somebody standing in the shallows is somebody standing.
  //
  // `sit` is the one that does not, and it used to: it landed on `idle`, which
  // is a person standing up where a person should be sitting down, and that is
  // why the terraces were drawn by the instanced tier instead. There are three
  // seated clips in the bake now — see `sit_clips` in tools/blender/bathers_mh.py
  // — and which of the three a figure is in is `fg.seat`, set once where the
  // crowd is placed and never afterwards, because a person who changes how
  // they are sitting every time you look away is worse than a mannequin.
  const CLIP = { stand: 'idle', wade: 'idle', walk: 'walk', sit: 'idle',
    lie: 'idle', wait: 'idle' };
  const SEATED = ['sit', 'sitback', 'sittable'];

  /**
   * Which clip this person should be playing.
   *
   * The `f.clips` test is not defensive coding for its own sake. The payload
   * and the source are versioned separately — `build/payload/bather_*.fr3d.gz`
   * is committed, not built — so a blob baked before the seated clips existed
   * has to come out as a person standing rather than as a thrown exception.
   */
  function wantClip(fg, f) {
    if (fg.mode !== 'sit') return CLIP[fg.mode] || 'idle';
    const nm = SEATED[((fg.seat | 0) % SEATED.length + SEATED.length)
      % SEATED.length];
    return f.clips && f.clips.includes(nm) ? nm : 'idle';
  }

  for (const f of figs) {
    f.mesh.visible = false;
    f.mesh.frustumCulled = false;
    scene.add(f.mesh);
  }

  function flush(t, cam) {
    // A delta, because these animate rather than being posed from absolute
    // time. Clamped: the first frame after a locale builds is worth several
    // seconds and would jump every clip to a random phase.
    const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, t - last));
    last = t;
    let n = 0;
    const maxSq = CROWD.poseM * CROWD.poseM;
    const lim = Math.min(cap, figs.length, figures.length);
    for (let i = 0; i < lim; i++) {
      const fg = figures[i], f = figs[i];
      const dx = fg.x - cam.x, dz = fg.z - cam.z;
      if (dx * dx + dz * dz > maxSq) { f.mesh.visible = false; continue; }
      const want = wantClip(fg, f);
      if (f.playing() !== want) f.play(want, { fade: 0.28 });
      // The walk clip is authored at about 0.92 m/s; anybody strolling faster
      // than that plays it faster rather than sliding.
      if (f.state) {
        f.state.speed = fg.mode === 'walk'
          ? Math.max(0.7, Math.min(1.6, (fg.speed || 0.92) / 0.92)) : 1;
      }
      f.mesh.position.set(fg.x, fg.y, fg.z);
      f.mesh.rotation.set(0, fg.yaw, 0);
      f.mesh.updateMatrixWorld();
      // The same head turn the instanced tier does in `pose`, and the same two
      // numbers written from outside — see the note there. `aim` is in figure
      // space, where +y is up, so an extra yaw about +y is exactly what
      // `f.mesh.rotation.y` already means and no offset has to be measured.
      //
      // Only touched while it is happening or on the frame it stops. `aim`
      // walks the bone list by name to find the head and there are twenty-eight
      // of them, which is nothing once and is thirty-two lookups a frame if it
      // is asked unconditionally for a crowd that is not being bumped.
      if (fg.look || fg.aimed) {
        f.aim('head', 0, 1, 0, fg.look ? fg.lookY * fg.look : 0);
        fg.aimed = !!fg.look;
      }
      f.update(dt);
      f.mesh.visible = true;
      n++;
    }
    for (let i = lim; i < figs.length; i++) figs[i].mesh.visible = false;
    drawn = n;
  }

  return {
    figures, flush, layers: [],
    tris: figs.reduce((a, f) => a + f.tris, 0),
    get drawn() { return drawn; },
  };
}

function makeCrowd(scene, rig, cap) {
  const layers = rig.parts.map((p) => crowdLayer(scene, p.geo, cap));
  const skel = rigSkeleton(rig);
  const figures = [];
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();

  /**
   * Pose the scratch skeleton as `fg`, at time `t`.
   *
   * `tip` is a rotation of the whole figure about its own long axis, and it is
   * kept as a local here rather than written straight on to the root because
   * the root is *shared*: `restPose` clears the joints and nothing clears the
   * root, so the first sunbather laid the scratch skeleton on its back and
   * every one of the ninety-odd figures posed after it stayed there. The whole
   * beach was face-up on the concrete and it took a probe to see it, because a
   * flat figure at fifty metres just looks like litter.
   */
  function pose(fg, t) {
    restPose(skel);
    let tip = 0;
    const ph = t * 0.9 + fg.seed * 6.283;

    switch (fg.mode) {
      case 'walk':
        stride(skel, fg.gait, fg.amp, 0.85);
        // The pelvis drops twice per stride, at the two moments both feet are
        // on the ground. Without it a walk slides; with it, it has weight.
        skel.pelvis.position.y = skel.restY - 0.022 * fg.amp
          * (1 - Math.cos(fg.gait * 2)) * 0.5;
        skel.torso.rotation.x = Math.sin(fg.gait) * 0.045;
        break;

      case 'sit':
        // On the edge of the lowest platform with the legs hanging over the
        // water, which is what that step is for and the reason it is 4.2 m
        // wide. Thighs forward and level, knees square, shins straight down.
        //
        // The pelvis drop is the number that matters and it is not a guess:
        // `restY` is the standing hip height, and somebody sitting on a slab
        // has their hip joint about 14 cm above it. Anything less leaves them
        // hovering, which is exactly what the first cut did — a row of people
        // sitting on nothing, half a metre in the air, legs straight out.
        skel.pelvis.position.y = skel.restY - 0.72;
        skel.legLU.rotation.z = 1.55;
        skel.legRU.rotation.z = 1.52;
        // Same clock per figure and the same complaint answered as in the
        // standing case below: two people sitting on a quay do not swing their
        // legs in time with each other, and a pair of shins moving through five
        // degrees is a pair of shins that is not moving.
        const sr = 0.70 + fg.seed * 0.70;
        skel.legLL.rotation.z = -1.50 + Math.sin(ph * 0.62 * sr) * 0.19;
        skel.legRL.rotation.z = -1.46 + Math.sin(ph * 0.55 * sr + 2.1) * 0.17;
        // The trunk rocks slowly over the hips, which is what you do when there
        // is nothing behind you to lean on.
        skel.torso.rotation.z = -0.14 + Math.sin(ph * 0.24 * sr) * 0.085;
        // Arms back and straight, taking the weight. Everybody sits like this.
        skel.armLU.rotation.z = -0.62; skel.armLU.rotation.x = SPLAY * 2.4;
        skel.armRU.rotation.z = -0.58; skel.armRU.rotation.x = -SPLAY * 2.4;
        skel.armLL.rotation.z = 0.22;
        skel.armRL.rotation.z = 0.20;
        // And every half minute or so one hand comes up off the slab — the arm
        // takes the weight again afterwards, which is why it goes back rather
        // than staying wherever it got to.
        const sact = sat((Math.sin(ph * 0.21 * sr + fg.seed * 4.3) - 0.72) / 0.24);
        skel.armRU.rotation.z += sact * 0.95;
        skel.armRL.rotation.z += sact * 0.85;
        skel.armRU.rotation.x -= sact * 0.22;
        skel.head.rotation.z = 0.06 + Math.sin(ph * 0.35 * sr) * 0.07 - sact * 0.08;
        skel.head.rotation.y = Math.sin(ph * 0.23 * sr) * 0.30
          + Math.sin(ph * 0.52 * sr + 0.8) * 0.11;
        break;

      case 'lie':
        // Flat on a lounger, face up. The tip is one rotation of the whole
        // figure rather than something spread through the joints: a reclining
        // figure is a standing figure laid over and then bent a little, and
        // doing it the other way round means re-deriving eleven joints for one
        // pose.
        //
        // +π/2 and not −π/2: about Z, local +X (the front of the body) goes to
        // world up, which is a sunbather. The other sign is face down on a
        // lounger, which nobody does.
        //
        // It also puts the head along local −X — the *opposite* of the bearing
        // the figure was placed with — which is why 43-jadrija.js aims these
        // seaward to get a head that ends up inland.
        tip = Math.PI / 2;
        // Propped on the backrest, which climbs over the last half-metre of
        // the lounger. Positive, because a joint's rotation.z swings its far
        // end toward the front of the body and the front of the body is now
        // pointing at the sky — so this lifts the head. Negative drives it down
        // through the frame, which is what the first cut did and which reads,
        // convincingly and horribly, as somebody who has passed out.
        skel.torso.rotation.z = 0.58;
        skel.head.rotation.z = 0.16;
        // Knees just off straight. Nobody lies with their legs locked.
        skel.legLU.rotation.z = 0.16 + Math.sin(ph * 0.3) * 0.02;
        skel.legRU.rotation.z = 0.09;
        skel.legLL.rotation.z = -0.22;
        skel.legRL.rotation.z = -0.12;
        skel.armLU.rotation.z = -0.26; skel.armLU.rotation.x = SPLAY * 1.8;
        skel.armRU.rotation.z = -0.22; skel.armRU.rotation.x = -SPLAY * 1.8;
        skel.armLL.rotation.z = 0.30;
        skel.armRL.rotation.z = 0.26;
        break;

      case 'wade':
        // Standing in half a metre of water. Arms held a little out and clear,
        // which is what everybody does, and a slow sway because you cannot
        // stand still on a shingle bottom.
        skel.armLU.rotation.x = SPLAY * 3.4;
        skel.armRU.rotation.x = -SPLAY * 3.4;
        skel.armLU.rotation.z = -0.18 + Math.sin(ph * 0.7) * 0.12;
        skel.armRU.rotation.z = -0.18 + Math.sin(ph * 0.7 + 1.7) * 0.12;
        skel.torso.rotation.x = Math.sin(ph * 0.5) * 0.05;
        skel.head.rotation.y = Math.sin(ph * 0.31) * 0.42;
        break;

      default: {
        // Standing about. This is the pose most of the beach is in at any
        // moment and it is the one that has to not be frozen.
        //
        // It was not frozen, and it read as frozen anyway, which is the more
        // interesting failure. What was here turned the head through 31° and
        // shifted the hips, and standing on the promenade watching it the
        // verdict was a room full of robots whose batteries had run out.
        // Three things were wrong with it and none of them was the amount of
        // motion in the file.
        //
        // The crowd shared one clock. Every figure ran the same 16.6 s weight
        // shift and the same 26 s head turn, offset only in phase, so the beach
        // breathed in and out as one animal and none of it read as anybody
        // deciding anything.
        //
        // Everything below the neck moved by two or three degrees. A 0.045 rad
        // hip roll moves the top of the head by four centimetres; at fifteen
        // metres that is a third of a pixel, so the only thing that actually
        // moved on screen was the head, on a twenty-six second period, which is
        // slow enough that you have to watch one figure to see it at all.
        //
        // And it was a pure sine. A person standing about is not a slow
        // oscillator. They are still, and then they *do* something — hands to
        // the hips, a hand up against the sun, a stretch, a towel shaken out —
        // and the doing is the whole of what the eye reads as alive.
        //
        // So: a clock per figure, a weight shift with some weight in it, hands
        // that are never quite still, and a piece of business every half minute
        // or so. All of it off `fg.seed`, which already carries the phase
        // offset, so this costs nothing at build time and no draws off `rng` —
        // the seed a figure is given is the habit it keeps.
        const rate = 0.70 + fg.seed * 0.70;
        const w = Math.sin(ph * 0.42 * rate);
        // The weight goes on to one leg and then the other. The pelvis rolls,
        // the loaded hip comes up, the torso leans back against it and the free
        // knee softens — which is the difference between somebody standing and
        // a figure balanced on two straight legs.
        skel.pelvis.rotation.x = w * 0.075;
        skel.pelvis.position.y = skel.restY - Math.abs(w) * 0.030;
        skel.torso.rotation.x = -w * 0.055;
        // Counter-rotated against the pelvis, or the roll swings both feet
        // sideways across the concrete. The residual is the old 0.030.
        skel.legLU.rotation.x = w * 0.075 - w * 0.045;
        skel.legRU.rotation.x = w * 0.075 - w * 0.045;
        skel.legLL.rotation.z = -(0.04 + 0.13 * Math.max(0, w));
        skel.legRL.rotation.z = -(0.04 + 0.13 * Math.max(0, -w));
        // The arms on a slower clock than the hips and out of step with each
        // other, because two arms swinging together is a march.
        const swA = Math.sin(ph * 0.31 * rate);
        const swB = Math.sin(ph * 0.31 * rate + 1.9);
        skel.armLU.rotation.x = SPLAY + w * 0.05;
        skel.armRU.rotation.x = -SPLAY + w * 0.05;
        skel.armLU.rotation.z = swA * 0.085;
        skel.armRU.rotation.z = swB * 0.080;
        skel.armLL.rotation.z = 0.10 + Math.max(0, swA) * 0.16;
        skel.armRL.rotation.z = 0.10 + Math.max(0, swB) * 0.15;
        // Two frequencies on the head, so it arrives somewhere and looks about
        // once it is there rather than sweeping like a radar.
        skel.head.rotation.y = Math.sin(ph * 0.27 * rate) * 0.42
          + Math.sin(ph * 0.61 * rate + 1.3) * 0.16;
        skel.head.rotation.z = Math.sin(ph * 0.19 * rate) * 0.06;
        // And the shoulders follow the head a little, which is most of what
        // makes a turn of the head look like attention rather than a hinge.
        skel.torso.rotation.y = Math.sin(ph * 0.27 * rate) * 0.14;

        // The business. `act` is zero for three quarters of a cycle 25 to 50 s
        // long and then ramps to one for a few seconds. Which piece of business
        // is fixed per figure and never changes, because a person has habits.
        const act = sat((Math.sin(ph * 0.20 * rate + fg.seed * 5.1) - 0.70) / 0.25);
        if (act > 0) {
          switch ((fg.seed * 4) | 0) {
            case 0:                                   // hands to the hips
              skel.armLU.rotation.x = SPLAY + act * 0.40;
              skel.armRU.rotation.x = -SPLAY - act * 0.40;
              skel.armLL.rotation.z += act * 1.30;
              skel.armRL.rotation.z += act * 1.26;
              break;
            case 1:                                   // a hand up against the sun
              skel.armRU.rotation.z -= act * 0.55;
              skel.armRU.rotation.x = -SPLAY - act * 0.95;
              skel.armRL.rotation.z += act * 1.55;
              skel.head.rotation.z -= act * 0.10;
              break;
            case 2:                                   // a stretch
              skel.armLU.rotation.z -= act * 0.85;
              skel.armRU.rotation.z -= act * 0.80;
              skel.armLU.rotation.x = SPLAY + act * 0.30;
              skel.armRU.rotation.x = -SPLAY - act * 0.30;
              skel.torso.rotation.z -= act * 0.10;
              break;
            default: {                                // shaking a towel out
              // 1.2 Hz, which is how fast a towel actually gets shaken and far
              // and away the most visible thing anybody on this beach does.
              const flap = Math.sin(ph * 8.2) * act * 0.34;
              skel.armLU.rotation.z += act * 0.95 + flap;
              skel.armRU.rotation.z += act * 0.90 + flap;
              skel.armLL.rotation.z += act * 0.30;
              skel.armRL.rotation.z += act * 0.28;
              skel.torso.rotation.x -= act * 0.06;
              break;
            }
          }
        }
        break;
      }
    }

    // ── the head of somebody you have just walked into ────────────────────────
    //
    // `fg.look` is a weight and `fg.lookY` the extra yaw the neck wants, both
    // written from outside by whoever is driving the crowd — 43-jadrija.js
    // aims it at you when you bump into one of these people. Nothing in here
    // decides anything about it; this is the two lines that let it show.
    //
    // It has to be applied *after* the switch and cannot live inside it. Four
    // of the six poses write `head.rotation.y` from their own clock, so a look
    // set before the switch is a look four of them overwrite and what you get
    // is a head that goes on sweeping the horizon while somebody stands in
    // front of it.
    //
    // A blend rather than an assignment, because the idle head turn is the
    // thing that makes these people look alive and cutting it dead at the
    // moment somebody notices you is exactly backwards.
    //
    // The shoulders come with it, at a third. Nobody turns their head on a
    // fixed torso, and the note in the standing case says as much about the
    // idle sweep: the shoulders following is most of what makes a turn of the
    // head read as attention rather than as a hinge.
    if (fg.look) {
      const w = fg.look;
      skel.head.rotation.y = skel.head.rotation.y * (1 - w) + fg.lookY * w;
      skel.torso.rotation.y = skel.torso.rotation.y * (1 - w)
        + fg.lookY * 0.30 * w;
    }

    skel.root.position.set(fg.x, fg.y, fg.z);
    // Written in full every time, never touched in part. YXZ order, so the tip
    // happens in the figure's own frame and the yaw then aims the result.
    skel.root.rotation.set(0, fg.yaw, tip);
    skel.root.scale.setScalar(fg.scale);
    skel.root.updateMatrixWorld(true);
  }

  let drawn = 0;

  /** Pose everybody in range and hand the transforms to the GPU. */
  function flush(t, cam) {
    let n = 0;
    const maxSq = CROWD.poseM * CROWD.poseM;
    for (const fg of figures) {
      if (n >= cap) break;
      const dx = fg.x - cam.x, dz = fg.z - cam.z;
      if (dx * dx + dz * dz > maxSq) continue;
      pose(fg, t);
      for (let j = 0; j < layers.length; j++) {
        const L = layers[j];
        skel.joints[j].matrixWorld.decompose(_p, _q, _s);
        L.aPos.array[n * 3] = _p.x;
        L.aPos.array[n * 3 + 1] = _p.y;
        L.aPos.array[n * 3 + 2] = _p.z;
        L.aRot.array[n * 4] = _q.x; L.aRot.array[n * 4 + 1] = _q.y;
        L.aRot.array[n * 4 + 2] = _q.z; L.aRot.array[n * 4 + 3] = _q.w;
        L.aScale.array[n * 3] = _s.x;
        L.aScale.array[n * 3 + 1] = _s.y;
        L.aScale.array[n * 3 + 2] = _s.z;
        for (const [a, c] of [[L.aColor, fg.skin], [L.aSuit, fg.suit],
          [L.aHair, fg.hair]]) {
          a.array[n * 3] = c[0]; a.array[n * 3 + 1] = c[1]; a.array[n * 3 + 2] = c[2];
        }
      }
      n++;
    }
    for (const L of layers) {
      L.geo.instanceCount = n;
      L.aPos.needsUpdate = L.aRot.needsUpdate = L.aScale.needsUpdate = true;
      L.aColor.needsUpdate = L.aSuit.needsUpdate = L.aHair.needsUpdate = true;
    }
    drawn = n;
  }

  return {
    figures, layers, flush,
    tris: rig.parts.reduce((a, p) => a + p.geo.index.count / 3, 0),
    get drawn() { return drawn; },
  };
}
