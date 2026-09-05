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
    // The same floor the hand-loaded skins get. These are people on the same
    // beach as her and they carry the same `spec` for the same reason; lifting
    // one and not the other puts two kinds of human in one frame lit two ways.
    emissive: SKIN_EMISSIVE,
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
 * What each of the eight has on, and what colour they are.
 *
 * Read off `SUITS` in tools/blender/bathers_mh.py, which is where they are
 * baked: the first triple is the swimwear and the second the skin. Nothing at
 * runtime needs these to *draw* a blob — the colours are in its vertices and
 * the shader is `base *= vVCol` — so this table would be dead weight if the
 * cast were fixed.
 *
 * It is here because the cast is not fixed. A bather who is a blob when you
 * are near them and eleven tapered boxes when you are not is one person drawn
 * two ways, and the two ways have to agree about what colour they are or
 * walking toward somebody repaints them. The instanced tier is the one that
 * can be told: it has `aInstColor` / `aInstSuit` / `aInstHair` and asks the
 * mesh's marker palette which is which. So the blob's baked paint is copied on
 * to its own instanced stand-in, and the direction of the copy is the whole
 * answer to "which colours are this person's own" — the blob's, because the
 * blob is the one that cannot be told otherwise.
 *
 * If a suit is ever re-baked, this table is what goes stale, and what it looks
 * like is a bather who changes colour at about fifty metres.
 */
const BATHER_PAINT = {
  woman_young_slim: { suit: [0.78, 0.16, 0.18], skin: [0.83, 0.68, 0.58] },
  man_old_heavy: { suit: [0.24, 0.26, 0.30], skin: [0.72, 0.55, 0.44] },
  girl_child: { suit: [0.86, 0.31, 0.42], skin: [0.80, 0.64, 0.53] },
  man_young_fit: { suit: [0.11, 0.16, 0.28], skin: [0.74, 0.56, 0.44] },
  woman_young_full: { suit: [0.88, 0.62, 0.14], skin: [0.42, 0.29, 0.22] },
  boy_child: { suit: [0.16, 0.36, 0.62], skin: [0.72, 0.56, 0.42] },
  woman_old: { suit: [0.30, 0.34, 0.52], skin: [0.78, 0.63, 0.53] },
  man_young_lean: { suit: [0.18, 0.42, 0.36], skin: [0.76, 0.62, 0.47] },
};

/**
 * And their hair, which is one colour for all eight.
 *
 * `HAIR_P` in tools/blender/human_mh.py. The bathers take the literal rather
 * than the marker — `post=False`, see the note in `one` in bathers_mh.py — so
 * every one of them has the same dark brown on, and the instanced stand-in
 * must have it too or the promotion is a haircut. It is within a couple of
 * units of `HAIR[0]` in 43-jadrija.js, which is the palette entry this
 * effectively pins the whole promotable half of the beach to.
 */
const BATHER_HAIR = [0.128, 0.094, 0.070];

/**
 * How tall a baked figure stands, in metres, off its own vertices.
 *
 * Not read from a table, because there is one — `BATHERS` in
 * tools/blender/mh_morph.py names a height for each of the eight — and a
 * second copy of a number that is already in the mesh is a number that can
 * disagree with the mesh. The bind pose stands with its soles on y = 0, so the
 * tallest vertex is the stature and nothing has to be measured about the pose.
 */
function skinHeight(data) {
  const p = data.geo.attributes.position.array;
  let hi = 0;
  for (let i = 1; i < p.length; i += 3) if (p[i] > hi) hi = p[i];
  return hi;
}

/**
 * The same question of the instanced rig, which has no vertices in one place.
 *
 * The rig is a tree of pivots with a lump of geometry hanging off each, so the
 * top of the head is the head part's own highest vertex plus every pivot
 * between it and the ground. Walked rather than looked up for the reason
 * above: 42-crowd.js has said "a canonical 1.70 m figure" in prose for as long
 * as it has existed and nothing has ever checked.
 *
 * The parts are in parent-before-child order — `rigSkeleton` already depends
 * on it — so one pass accumulates the chain.
 */
function rigHeight(rig) {
  const up = new Float64Array(rig.parts.length);
  let hi = 0;
  for (let i = 0; i < rig.parts.length; i++) {
    const p = rig.parts[i];
    up[i] = p.pivot[1] + (p.parent < 0 ? 0 : up[p.parent]);
    const a = p.geo.attributes.position.array;
    for (let k = 1; k < a.length; k += 3) {
      const v = up[i] + a[k];
      if (v > hi) hi = v;
    }
  }
  return hi;
}

/**
 * How fast this person's clip runs, as a multiple of nominal.
 *
 * Shared, because the same number has to be used in two places that are not
 * near each other: `flush` writes it on to the figure that is drawing somebody
 * and 43-jadrija.js advances the clock of everybody who is *not* being drawn
 * by a blob, so that a person promoted mid-stride carries on from where their
 * clip had got to rather than from wherever the last occupant of the slot left
 * it. Two copies of it would be two clocks running at different rates and a
 * figure that jumps the moment it becomes worth looking at.
 */
function clipRate(fg) {
  return fg.mode === 'walk'
    ? Math.max(0.7, Math.min(1.6, (fg.speed || 0.92) / 0.92))
    : 0.90 + fg.seed * 0.22;
}

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
 * `figs` are already-loaded skinned figures, and they come in two halves.
 *
 * The first `figs.length - rove` of them are bound by index and stay bound.
 * That was the whole rule once, and the reason given for it was that a figure
 * whose identity is reassigned per frame is a person who changes body when you
 * walk past them — which is true, and was the wrong conclusion. What actually
 * followed from a fixed binding is that the twenty-four best figures on this
 * shore were chosen before you arrived: a mannequin at your elbow stayed a
 * mannequin all session while a blob two hundred metres away, four pixels
 * tall, spent the budget. Reported, of the promenade: wooden marionettes just
 * standing around.
 *
 * So the last `rove` of them are slots rather than people. A slot is pointed
 * at whoever is nearest, `assign` moves it, and the person it is pointed at
 * carries everything that makes them themselves — their colours, their
 * stature, their clip and the phase it had got to. What a slot owns is one
 * mesh and one bone palette; what it does not own is an identity. See
 * `stepCast` in 43-jadrija.js for the choosing, which is promenade logic and
 * belongs there.
 *
 * The `figures` array, the `flush(t, cam)` call and the distance cut are all
 * `makeCrowd`'s, so the promenade logic in 43-jadrija.js does not know which of
 * the two it is talking to.
 */
function makeSkinCrowd(scene, figs, cap, rove = 0) {
  const figures = [];
  // Where the pinned half stops and the roving half starts.
  const PIN = Math.max(0, figs.length - rove);
  // `slots[j]` is whoever `figs[PIN + j]` is standing in for, or null.
  const slots = new Array(figs.length - PIN).fill(null);
  let drawn = 0;
  let last = -1;
  let ups = 0, downs = 0;

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
  // What somebody standing about does that `idle` does not: a look off to one
  // side and, less often, a wave. Both are one-shots in the bake and both are
  // keyed from `IDLE_A` at either end — see BATHER_CLIPS in
  // tools/blender/bathers_mh.py — so they drop into a loop of `idle` with
  // nothing between them and it, which is exactly why they are the two that
  // are usable here and `kneel` is not.
  const BIZ = ['notice', 'notice', 'notice', 'wave'];
  // How often, in metres, a figure is re-posed. Posing one of these is
  // twenty-eight bones on the CPU and then a texture upload of the palette,
  // and the upload is the expensive half — it is a driver call per figure per
  // frame, which is what makes a skinned crowd cost what an instanced one does
  // not. Measured on the promenade with forty-one of them: every frame for all
  // of them is 26.2 ms, the ladder below is 19.0 ms, and eight of them at every
  // frame — which is what this shore had — was 19.0 ms as well. So the whole
  // difference between eight proper bathers and forty-one is the rate they are
  // posed at, and past forty-five metres nobody can see the difference anyway.
  const POSE_NEAR = 45, POSE_MID = 110;

  /**
   * Which clip this person should be playing.
   *
   * The `f.clips` test is not defensive coding for its own sake. The payload
   * and the source are versioned separately — `build/payload/bather_*.fr3d.gz`
   * is committed, not built — so a blob baked before the seated clips existed
   * has to come out as a person standing rather than as a thrown exception.
   */
  /**
   * The phase a figure's clip starts at when it has no clock of its own yet.
   *
   * `43-jadrija.js` seeds `fg.clock = fg.seed * 11.3` when the beach is built
   * and advances it every frame for everybody, drawn or not — so this is only
   * ever reached by a figure whose seed is 0. It is a name rather than a
   * literal so that the three places in this file which need it cannot drift
   * apart again, which is what they had already done.
   */
  const phaseOf = (fg) => fg.seed * 11.3;

  function wantClip(fg, f) {
    // A sunbather, and until 3 Sep there was no clip for one — which is why
    // every towel on this beach had a lay figure on it: with nothing to play,
    // `lie` was ruled out of the skinned tier altogether in 43-jadrija.js and
    // the eleven of them could never be promoted however close you stood.
    if (fg.mode === 'lie') {
      return f.clips && f.clips.includes('sunbathe') ? 'sunbathe' : 'idle';
    }
    if (fg.mode !== 'sit') return CLIP[fg.mode] || 'idle';
    // Two different kinds of sitting, and the difference is the furniture.
    // A terrace sitter is on a 0.46 m chair and plays one of three clips
    // solved against it; a quay sitter is on the slab itself with their legs
    // over the water, half a metre lower, and plays `sitquay`. Handing a chair
    // clip to somebody on the quay is what the old code could not do — it did
    // not have to, because the quay sitters were all mannequins.
    if (fg.seat == null) {
      return f.clips && f.clips.includes('sitquay') ? 'sitquay' : 'idle';
    }
    const nm = SEATED[((fg.seat | 0) % SEATED.length + SEATED.length)
      % SEATED.length];
    return f.clips && f.clips.includes(nm) ? nm : 'idle';
  }

  for (const f of figs) {
    f.mesh.visible = false;
    f.mesh.frustumCulled = false;
    scene.add(f.mesh);
  }

  /**
   * Whether this figure is in the middle of doing something one-shot.
   *
   * The clip a person *should* be in and the clip they are *in* differ for two
   * seconds every half minute or so, and without this test the line below would
   * see `wave` where it wanted `idle` and cut the wave off on its first frame,
   * every frame. A one-shot ends by itself — `update` plays the `next` it was
   * given — so the only thing needed here is to leave it alone until it does.
   */
  const midBiz = (f) => !!(f.state && f.state.cur && !f.state.cur.loop);

  let frame = 0;

  /**
   * Point slot `j` at `fg`, or at nobody.
   *
   * Four things have to happen together here and every one of them is a way
   * this reads wrong if it is left out. The person leaving takes their clock
   * with them, so that being demoted and promoted again forty seconds later
   * resumes the same idle rather than restarting it. The person arriving is
   * marked `rebind`, which is what makes `step` below start their clip from
   * *their* phase and re-pose the mesh on the spot instead of waiting for the
   * distance ladder's turn — a slot that changes hands and does not re-pose is
   * a new person wearing the last one's pose for up to eight frames.
   * `fg.hidden` is the flag the instanced tier reads, and it is set here and
   * cleared here so that a person can never be drawn twice or drawn not at
   * all. And the mesh goes invisible for the one frame in between, because the
   * only thing worse than the swap being visible is it being visible in the
   * wrong place.
   */
  function assign(j, fg) {
    const was = slots[j];
    if (was === fg) return false;
    const f = figs[PIN + j];
    if (was) {
      if (f.state && f.state.cur) was.clock = f.state.curT;
      was.hidden = false;
      was.slot = -1;
      was.bizOn = false;
      downs++;
    }
    slots[j] = fg;
    f.mesh.visible = false;
    if (fg) {
      fg.hidden = true;
      fg.slot = j;
      fg.rebind = true;
      ups++;
    }
    return true;
  }

  /**
   * Draw one person on one figure. Returns whether they were drawn at all.
   *
   * `i` is only the stagger's — see the ladder at the bottom — and has to be
   * distinct per figure rather than per person, which is why the roving half
   * passes its slot's index in `figs` and not the bather's.
   */
  function step(fg, f, i, t, dt, cam, maxSq, nearSq, midSq) {
    const dx = fg.x - cam.x, dz = fg.z - cam.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > maxSq) { f.mesh.visible = false; return false; }
    const want = wantClip(fg, f);
    // A slot that has just changed hands. Everything on the mesh belongs to
    // whoever was standing here a frame ago — the clip and where it had got
    // to, a head still turned toward where you were when they noticed you,
    // and a pose owed to the ladder — and none of it is this person's.
    //
    // No fade. A crossfade between two clips is the right answer when one
    // person changes what they are doing and the wrong one here: there is
    // nothing to fade *from* except a stranger, in a different place, at a
    // different height.
    if (fg.rebind) {
      fg.rebind = false;
      f.aim('head', 0, 1, 0, 0);
      fg.aimed = false;
      fg.lag = 0;
      // `|| phaseOf(fg)` and not `|| 0`, which is what these two said. Three
      // places in this file seed a figure's clip phase and one of them fell
      // back to a different number than the other two — the same "one value,
      // two spellings" that cost three releases in `ballet.py` overnight. It
      // bites only the figure whose seed is 0, because `fg.clock` is
      // initialised to `fg.seed * 11.3` and never legitimately reaches zero
      // again; that one bather rebinding to a clip at phase 0 while everybody
      // around them is mid-cycle is exactly the tell the note fifty lines down
      // exists to prevent.
      if (f.playing() !== want) {
        f.play(want, { fade: 0, from: fg.clock || phaseOf(fg) });
      } else if (f.state) {
        f.state.curT = fg.clock || phaseOf(fg);
        f.state.prev = null;
      }
      fg.rebound = true;
    }

    // A piece of business, on this figure's own clock.
    //
    // Same argument as the instanced tier's `act`, and the same seed, for the
    // same reason: a crowd that shares one clock breathes in and out as one
    // animal. Here it can be a real clip rather than a hand-written pose, so
    // it is one — and the gate is an *edge* rather than a window, because a
    // one-shot is started once and then left to run.
    //
    // Nobody walking, and nobody sitting: the wave is keyed from a standing
    // pose and playing it on somebody in a chair lifts them out of it.
    if ((fg.mode === 'stand' || fg.mode === 'wade') && !midBiz(f)) {
      const rate = 0.70 + fg.seed * 0.70;
      const ph = t * 0.9 + fg.seed * 6.283;
      const g = Math.sin(ph * 0.20 * rate + fg.seed * 5.1) > 0.94;
      if (g && !fg.bizOn) {
        f.play(BIZ[(fg.seed * BIZ.length * 7) % BIZ.length | 0],
          { fade: 0.25, next: want });
      }
      fg.bizOn = g;
    }

    if (!midBiz(f) && f.playing() !== want) {
      // `from` is the whole difference between a crowd and a chorus line. The
      // eight blobs are cast round-robin, so the same person stands on this
      // shore four or five times over, and four copies of one mesh starting
      // one 4.6 s idle at t = 0 is four copies of one mesh. The clips that
      // land here all loop, and `sample` takes the phase modulo the duration,
      // so any number at all is a legal offset.
      //
      // `fg.clock` rather than the `fg.seed * 11.3` it was seeded with: the
      // clock is that same offset, still running, so a person who changes what
      // they are doing lands mid-clip instead of at whatever phase they were
      // handed when the beach was built.
      f.play(want, { fade: 0.28, from: fg.clock || phaseOf(fg) });
    }
    // The walk clip is authored at about 0.92 m/s; anybody strolling faster
    // than that plays it faster rather than sliding.
    //
    // And everybody else runs their idle a few per cent off nominal, which is
    // the cheapest half of not being a clone: two figures on the same phase
    // offset would otherwise stay on it for as long as you watched them.
    if (f.state) f.state.speed = clipRate(fg);
    f.mesh.position.set(fg.x, fg.y, fg.z);
    f.mesh.rotation.set(0, fg.yaw, 0);
    // Stature. Set here and not once at bind time because a figure is bound
    // by index and the index outlives any one person; and left at 1 for
    // anybody in a chair, because the three seated clips are solved in metres
    // against a 0.46 m seat and a sitter scaled by 6 per cent is a sitter
    // 3 cm off their own chair. See `sit_clips` in bathers_mh.py.
    f.mesh.scale.setScalar(fg.hscale || 1);
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
    // The pose, at a rate that falls off with distance — see POSE_NEAR. The
    // stagger by `i` is not cosmetic: without it every figure in a band
    // re-poses on the same frame and the cost that was spread over three
    // frames arrives on one of them, which is a stutter rather than a saving.
    //
    // `rebound` is the one frame the ladder must not be allowed to skip. It is
    // set by `assign` above and is the difference between a slot that changes
    // hands cleanly and one that wears the previous occupant's pose on this
    // person's body until the stagger next comes round to it.
    const every = d2 < nearSq ? 1 : d2 < midSq ? 3 : 8;
    fg.lag = (fg.lag || 0) + dt;
    if (fg.rebound || every === 1 || (frame + i) % every === 0) {
      f.update(fg.lag);
      fg.lag = 0;
      fg.rebound = false;
      // Handed back to the person rather than left on the mesh, so that a
      // demotion and a later promotion resume one clip instead of restarting
      // it. `stepCast` keeps it running for everybody who is not in a slot.
      if (f.state) fg.clock = f.state.curT;
    }
    f.mesh.visible = true;
    return true;
  }

  function flush(t, cam) {
    // A delta, because these animate rather than being posed from absolute
    // time. Clamped: the first frame after a locale builds is worth several
    // seconds and would jump every clip to a random phase.
    const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, t - last));
    last = t;
    frame++;
    let n = 0;
    const maxSq = CROWD.poseM * CROWD.poseM;
    const nearSq = POSE_NEAR * POSE_NEAR, midSq = POSE_MID * POSE_MID;
    const lim = Math.min(cap, PIN, figures.length);
    for (let i = 0; i < lim; i++) {
      if (step(figures[i], figs[i], i, t, dt, cam, maxSq, nearSq, midSq)) n++;
    }
    for (let i = lim; i < PIN; i++) figs[i].mesh.visible = false;
    // And the roving half, which is the same work about a different question:
    // who is standing here now.
    for (let j = 0; j < slots.length; j++) {
      const fg = slots[j], f = figs[PIN + j];
      if (!fg) { f.mesh.visible = false; continue; }
      if (step(fg, f, PIN + j, t, dt, cam, maxSq, nearSq, midSq)) n++;
    }
    drawn = n;
  }

  return {
    figures, flush, layers: [], kind: 'skin', slots, assign,
    /**
     * Register every figure with the shadow map.
     *
     * Late, and from 90-app.js, because the shadow does not exist when the
     * resort is built. `dynamic` is what makes it affordable: `syncMoving`
     * copies each proxy's visibility off its mesh, and `flush` has already
     * hidden everybody past 240 m and every slot standing in for nobody, so
     * the depth pass draws exactly the people who are on screen.
     *
     * It was not here before and it showed the moment the cast started
     * following the player. The instanced tier casts — one proxy per layer,
     * registered in 90-app.js since the crowd was written — and the skinned
     * tier did not, which was invisible while the good figures were mostly far
     * away and became the whole picture when they were mostly at your elbow:
     * you would walk toward a bather and watch their shadow go out.
     */
    shadows: (shadow) => figs.map((f) => f.cast(shadow, { near: true })),
    /** Everybody this tier is answerable for right now. See `tierCount`. */
    live: () => figures.concat(slots.filter(Boolean)),
    /**
     * Each bather paired with the skinned figure currently standing in for
     * them, so a caller can hang something on a BONE.
     *
     * `live()` answers "who is on this tier" and that is all most callers
     * want. Carrying a prop needs the other half — the `skinnedFigure` itself,
     * because `boneAt` / `boneTurn` / `boneIndex` live on it and they are the
     * only way to find a hand that is being animated. See the note over
     * `boneTurn` in 41-skin.js, which was written for exactly this and had no
     * caller until the phones.
     *
     * A null first element is a slot standing in for nobody, and the caller
     * has to expect it: the roving half of this tier is emptied and refilled
     * as you walk.
     */
    pairs: () => figs.map((f, i) => [i < PIN ? figures[i] : slots[i - PIN], f]),
    tris: figs.reduce((a, f) => a + f.tris, 0),
    get drawn() { return drawn; },
    /**
     * How many times a slot has been filled and emptied since the page loaded.
     *
     * The measurement that says whether the hysteresis is doing anything: a
     * walk along the promenade should promote a few dozen people, and if it
     * promotes a few thousand then two of them are trading a slot every frame
     * and the fix is a wider `ROVE.hold`, not a smaller cast.
     */
    get swaps() { return { up: ups, down: downs }; },
  };
}

function makeCrowd(scene, rig, cap) {
  const layers = rig.parts.map((p) => crowdLayer(scene, p.geo, cap));
  const skel = rigSkeleton(rig);
  // Which layer is the trunk, so that one person on this beach can be wearing
  // something. See `fg.shirt` in the write below.
  const torsoIx = rig.parts.findIndex((p) => p.name === 'torso');
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

      case 'serve':
      case 'barista': {
        // Working a counter, which is the one thing on this shore that is a
        // job rather than an afternoon. 20260823_111815 and _111819: two young
        // men behind the gelato case, one bowed over something in front of him
        // with the back of his head to the shop and one turned right away to
        // the back bar, and everything either of them does happens between the
        // case in front of them and the mirror behind.
        //
        // TWO MODES OUT OF ONE BLOCK, because they are the same job at two
        // ends of the same counter and the posture — hips against it, elbows
        // out, weight on one leg — is the whole of what they share. `serve` is
        // the man at the gelato case: he bows into it and he hands things
        // across. `barista` is the man at the coffee machine, which stands at
        // the WEST end of this counter — the placement is in 43-jadrija.js —
        // so his work is a turn to his own right and back again.
        const bar = fg.mode === 'barista';

        // THE SIGN OF `rotation.z` IS NOT THE SAME FOR A LIMB AND FOR A SPINE,
        // and the note that used to stand here had it backwards for both the
        // head and the torso. The convention at the top of this file — "a
        // joint's rotation.z swings its far end toward +X, i.e. forward" — is
        // written for a limb, and a limb hangs DOWN: Rz(θ) takes (0,−1,0) to
        // (sin θ, −cos θ, 0), so a positive z does swing a hanging arm
        // forward. The torso and the head point UP, and Rz(θ) takes (0,1,0) to
        // (−sin θ, cos θ, 0), which is BACKWARD. So a positive
        // `torso.rotation.z` leans a standing figure back and a positive
        // `head.rotation.z` lifts his chin.
        //
        // Which is exactly what the old `dig` did while the comment over it
        // said "head down into the case": `torso.rotation.z = 0.05 + dig·0.16`
        // with `head.rotation.z = 0.04 + dig·0.11` leaned him AWAY from the
        // counter and put his chin UP, every time he was supposed to be
        // reaching into it. `sit`, two cases above, has had the sign right all
        // along at `torso.rotation.z = −0.14` for somebody leaning forward.
        //
        // It also retires the 0.11 rad cap the old note argued for at length.
        // That cap was there because a positive `head.rotation.z` walks the
        // crown INLAND — 0.15 m at 0.33 rad, measured — into a shop body that
        // is solid from `s0` while a server stands at `s0−0.15`. Bowing with a
        // NEGATIVE angle walks it the other way, out over a counter with a
        // metre and a half of nothing in front of it. The measurement stands;
        // the limit it implied only ever applied to the wrong sign.

        // A cycle, not a sway. `u` runs 0 to 1 once every 11 to 21 s off the
        // figure's own seed, and each piece of business is a window in it — so
        // two people working one counter can never reach at the same moment,
        // which is what one shared clock did to the beach and is written up at
        // length in the standing case below. `hump` is sin², which leaves and
        // arrives with zero slope: a movement that starts and stops without a
        // corner in it.
        const rate = 0.70 + fg.seed * 0.70;
        const u = (ph * 0.075 * rate + fg.seed) % 1;
        const hump = (a, c) => {
          if (u <= a || u >= c) return 0;
          const s = Math.sin(Math.PI * (u - a) / (c - a));
          return s * s;
        };
        // Two businesses each, and the windows do not touch: whatever else
        // happens, there is a third of every cycle in which the man is simply
        // standing at his counter, which is what makes the other two read as
        // him deciding to do something.
        const dig = bar ? 0 : hump(0.05, 0.36);      // down into the case
        const pass = bar ? 0 : hump(0.50, 0.78);     // and hand it across
        const pull = bar ? hump(0.04, 0.34) : 0;     // round to the machine
        const set = bar ? hump(0.46, 0.72) : 0;      // and the cup on the bar

        // The weight shift, same shape as the standing pose and half the size:
        // a man behind a counter has one hip against it and does not rock the
        // way somebody loose on the concrete does.
        const w = Math.sin(ph * 0.31 * rate);
        skel.pelvis.rotation.x = w * 0.05;
        skel.pelvis.position.y = skel.restY - Math.abs(w) * 0.020;
        skel.legLU.rotation.x = w * 0.05;
        skel.legRU.rotation.x = w * 0.05;
        skel.legLL.rotation.z = -(0.04 + 0.11 * Math.max(0, w));
        skel.legRL.rotation.z = -(0.04 + 0.11 * Math.max(0, -w));

        // ELBOWS UP, and this is the number the whole pose turns on.
        //
        // A counter hides everything below 1.06 m, so an arm that reads at all
        // has to have its hand ABOVE that line. The rig, measured off the bake
        // rather than guessed: shoulder 1.38, elbow 1.07, hand 0.79, all at
        // scale 1, and these two are drawn at 1.005 and 1.019. The old pose
        // hung the upper arm at −0.12 and swung the forearm out flat at 1.52,
        // which puts the hand at 1.08 m — two centimetres of wrist over the
        // lip of the counter, from a shop the promenade looks at from four
        // metres, and it is why the pair read as two busts with stumps.
        //
        // 0.55 at the shoulder and 1.15 at the elbow lifts the elbow to 1.12
        // and puts the hand at 1.16 m, 0.45 m out: a hand ON the counter
        // rather than under it, and both of them in the frame.
        const eUp = 0.55, eFl = 1.15;
        skel.armLU.rotation.x = SPLAY * 1.5;
        skel.armRU.rotation.x = -SPLAY * 1.5;
        skel.armLU.rotation.z = eUp;
        skel.armRU.rotation.z = eUp;
        skel.armLL.rotation.z = eFl;
        skel.armRL.rotation.z = eFl;

        // The idle head. Never at the sea, because that way is a mirror — it
        // sweeps the shop and the queue, on two frequencies so that it arrives
        // somewhere and looks about once it is there.
        let hy = Math.sin(ph * 0.27 * rate) * 0.30
          + Math.sin(ph * 0.58 * rate + 1.1) * 0.11;
        let hz = -0.05;
        let ty = Math.sin(ph * 0.27 * rate) * 0.10;
        let tz = -0.04;

        if (!bar) {
          // THE BOW. The case is 0.5 m east of where he stands, which is his
          // own left — he faces the sea and the shore's `t` runs east — so it
          // is a lean forward with a quarter turn into it and the chin down.
          //
          // 0.24 and not 0.30, and the six hundredths are the difference
          // between a man and a man with a hole in him. The shoulder sits
          // 0.42 m above the waist pivot this leans about, so it travels
          // 0.42·sin(lean) SEAWARD — 0.14 m at 0.34 rad, which puts it at
          // `s0−0.29`. The counter's front panel is a plane at `s0−0.28`, and
          // in front of a plane there is no such thing as nearly hidden: at
          // one centimetre out the whole of everything hanging off that
          // shoulder renders in full. 0.28 rad total keeps it at `s0−0.266`.
          tz -= dig * 0.24;
          ty += dig * 0.34;
          hz -= dig * 0.34;
          hy = hy * (1 - dig) + dig * 0.30;
          // AND THE ELBOW NEVER GOES BELOW THE COUNTER, which is the one rule
          // this pose has. It is arithmetic: the elbow hangs at
          // 1.39 − 0.31·cos θ off the shoulder angle θ, the counter is at
          // 1.06, and the arm is 0.04 m thick — so θ must stay over 0.54 rad
          // or the elbow is under the lip. Below that the forearm and the hand
          // hang in front of the panel and there is a bare arm in the air over
          // the promenade, which is the fault the old note recorded and which
          // this pass reproduced twice: once at −0.45/−0.85, which hangs the
          // arm at 39° and drops the hand to `s0−0.51`, and once at
          // −0.62/−1.05, which hangs it plumb at 0.79 m and looked, from the
          // promenade, like a pair of legs standing in front of the shop.
          // Photographed both times; the arithmetic that said it would be
          // hidden had left the lean out.
          //
          // So the bow closes the ELBOW and leaves the shoulder alone. 0.60 at
          // the shoulder and 1.75 at the elbow puts the hand at 1.19 m and
          // 0.47 m out — with the lean, 0.10 m over the counter top and 0.42 m
          // in front of its face. Both hands out low over the counter with the
          // head down between them, which is what reaching into a case looks
          // like from the far side of one.
          skel.armLU.rotation.z = eUp + dig * 0.05 + pass * 0.06;
          skel.armLL.rotation.z = eFl + dig * 0.60;
          // THE HAND ACROSS, on the other arm and on the other half of the
          // cycle. His right is west, which is where the two children at the
          // open counter are, and 1.05 at the shoulder with 0.77 at the elbow
          // reaches the hand to 1.30 m and 0.55 m out — a quarter of a metre
          // above the counter top and a third of a metre in front of its face,
          // which is an arm out over a counter and cannot be read as anything
          // else. It is 0.24 m clear of the counter slab at its lowest, so
          // there is nothing here for rule 5 to catch.
          //
          // The two businesses have to be told apart at four metres, so they
          // are told apart by more than the arm: the bow is both hands LOW and
          // the head down and the body turned to the case, the pass is one
          // hand HIGH and the head up and the body square to the queue.
          skel.armRU.rotation.z = eUp + dig * 0.05 + pass * 0.50;
          skel.armRL.rotation.z = eFl + dig * 0.60 - pass * 0.38;
          skel.armRU.rotation.x = -SPLAY * 1.5 + pass * SPLAY * 1.1;
          tz -= pass * 0.09;
          ty -= pass * 0.13;
          hy = hy * (1 - pass) - pass * 0.16;
          hz += pass * 0.05;
        } else {
          // THE TURN TO THE MACHINE. 0.62 rad is 35°, and the point of doing
          // it in the torso rather than in the arm is that a turned body aims
          // the arm for nothing: his forward is then 35° west of seaward, so
          // the same elbow-up posture puts his hand at 0.26 m west and 0.37 m
          // out — over the grinder at t 331.63, which is 0.37 m west of him.
          // An arm swung out sideways from a square body reaches the same
          // place and reads as a man pointing at a wall.
          ty -= pull * 0.62;
          hy = hy * (1 - pull) - pull * 0.34;
          hz -= pull * 0.26;
          tz -= pull * 0.10;
          skel.armRU.rotation.z = eUp + pull * 0.32;
          skel.armRL.rotation.z = eFl - pull * 0.22;
          skel.armRU.rotation.x = -SPLAY * 1.5 - pull * SPLAY * 1.6;
          // The other arm stays at the counter through the turn — nobody works
          // a machine with both hands and nothing to lean on. It comes DOWN by
          // a tenth and no more: the elbow floor above is 0.54 rad and this
          // one starts at 0.55.
          skel.armLU.rotation.z = eUp - pull * 0.10;

          // AND THE CUP DOWN. Back square to the counter, a shade of a lean
          // into it, and the left hand out and down to where a saucer would
          // go. Smaller than the gelato man's reach on purpose: he is putting
          // something down 0.4 m away, not handing it to a child a metre off.
          skel.armLU.rotation.z += set * 0.38;
          skel.armLL.rotation.z = eFl - set * 0.24;
          tz -= set * 0.11;
          ty += set * 0.09;
          hy = hy * (1 - set) + set * 0.12;
          hz -= set * 0.16;
        }

        skel.torso.rotation.z = tz;
        skel.torso.rotation.y = ty;
        skel.torso.rotation.x = -w * 0.045;
        skel.head.rotation.z = hz;
        skel.head.rotation.y = hy;
        break;
      }

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
      // Somebody the good tier is drawing this frame — see `assign` in
      // `makeSkinCrowd`. The flag is set and cleared there and read only here,
      // which is the whole of "the marionette goes the instant its skinned
      // twin appears": one person, one boolean, and no frame in which either
      // both of them or neither of them is on the concrete.
      if (fg.hidden) continue;
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
        // A t-shirt, and it is paint rather than a garment.
        //
        // `aColor` is what the marker palette hands to every vertex the bake
        // painted pure white, which is skin — and the parts are separate
        // layers with separate attribute buffers, so answering that question
        // differently for the trunk than for the head and the arms costs one
        // comparison and dresses the figure in something with sleeves. It also
        // deforms, which is the whole reason it is this and not a shell: the
        // survey's plan for the two behind the gelato counter was a static box
        // over the chest, and a box does not breathe with the ribcage the
        // standing pose rocks through five degrees.
        //
        // The neck goes black with it. The neck is on the trunk part and there
        // is nothing to be done about that short of a re-bake; at the two
        // metres this is ever seen from it reads as a collar.
        const skin = fg.shirt && j === torsoIx ? fg.shirt : fg.skin;
        for (const [a, c] of [[L.aColor, skin], [L.aSuit, fg.suit],
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
    figures, layers, flush, kind: 'inst',
    /** Everybody this tier is answerable for right now. See `tierCount`. */
    live: () => figures.filter((fg) => !fg.hidden),
    /** How tall this rig stands at scale 1. See `rigHeight`. */
    height: rigHeight(rig),
    tris: rig.parts.reduce((a, p) => a + p.geo.index.count / 3, 0),
    get drawn() { return drawn; },
  };
}
