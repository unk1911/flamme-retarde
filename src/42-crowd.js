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
// different is how they are drawn: instanced, so a hundred and twenty people
// cost a handful of draw calls instead of thirteen hundred. Posing happens on
// one scratch skeleton that is re-posed per figure and read out into the
// instance buffers, which means the whole crowd carries no per-figure Three.js
// objects at all.
//
// Until 27 Sep the instances were tube figures, eleven rigid lofts a person
// out of tools/blender/bather.py, one instanced layer per tube — the
// "prehistoric wooden manequins" of Misha's report. They are the eight real
// bathers now, skinned to the same eleven joints on the GPU, one layer per
// body: see `readFR3DCrowd`.
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
  // And how close two of THEM get, which is a different number and was missing
  // entirely — the line above promised "being walked through is not [fine]"
  // and the promise was only ever kept about the player.
  //
  // Measured rather than chosen: the collision radii this crowd carries sum to
  // 0.46-0.64 m between two adults, so 0.70 is a shoulder's clearance and not
  // a corridor. Strangers pass each other far closer than they pass you, which
  // is why this is not `clear`.
  body: 0.70,
  // How far up the shore a walker looks for somebody to step round. Two metres
  // at a stroll is a second and a half of warning, which is about when a person
  // actually starts to drift.
  near: 2.0,
  // And how far ahead it looks for a BENCH — or for anybody who is not going to
  // move — which is a longer number for a reason worth writing down: a person
  // yields to a person late and to a wall early. Two adults closing head-on
  // share their approach, so `near` is really four metres of warning; a bench
  // closes at the walker's own 1.3 m/s and nothing else.
  //
  // 3.6 and not the 2.6 this started at, and the difference is measured. What
  // is being decided here is not "lean away" but WHICH SIDE to pass on, and
  // that answer is only as good as the window it is taken over: at t 278 there
  // is a standing figure on the lane with a knot of six more inland of him, so
  // over 2.6 m the answer was "go inland" until the sixth of them came into the
  // window and it flipped to "go seaward" with 0.3 s left. Measured over 150 s
  // of promenade, that flip was the deepest body-to-body overlap on the shore:
  // 0.363 m at 2.6, 0.008 m at 3.6. Three seconds of notice is enough to see
  // the whole knot before choosing.
  see: 3.6,
  // The most lateral speed a yield may ask for, m/s, and the cap both halves
  // share. It was the literal 2.4 under the loop and it is named here because
  // there are now two callers and a number two callers agree on by coincidence
  // is a number that stops agreeing.
  shove: 2.4,
  // And how far off its own lane a walker may end up, which is the other
  // literal. The promenade beats sit between s 10.2 and s 16.7 on about seven
  // metres of walkable concrete, so 1.5 m is a walker using the width it has
  // rather than stepping into the sea or under an awning. It bounds the
  // STEERING only: being ejected out of a bench is allowed to beat it, because
  // a lane that runs through one cannot be steered out of.
  wide: 1.5,
  // How high a thing has to stand over your own feet before you walk ROUND it
  // rather than over it. A kerb, a doorstep and a 0.19 m plinth are things a
  // stroller's foot clears without the owner noticing; a 0.30 m box is not.
  //
  // Measured, and it sits in a real gap. Of the 196 static blockers a promenade
  // lane can reach, the low ones stand 0.10, 0.12, 0.13 and 0.19 m — and then
  // there is nothing at all until 0.30, 0.41 and the 0.49 m benches. So the
  // threshold can be put where no object is, which is the whole point of
  // choosing it here rather than copying `showAhead`'s 0.10: that one lands ON
  // the four 0.10 m ones, where a centimetre of terrain under the feet decides
  // the answer. Two walkers were stepping into the 0.10 m plinths at t 329 and
  // t 341 and out again on alternate frames for exactly that reason.
  step: 0.24,
};

// How far an arm hangs out from the body at rest. Zero is a soldier at
// attention; this is a person.
const SPLAY = 0.11;

/**
 * The hash, and RULE 4 is why there is one.
 *
 * Not one draw off `rng` in this file, ever. The Jadrija layout is downstream
 * of a single stream and `pose` runs a hundred times a frame; a draw taken
 * here would not just move a parasol, it would move every parasol on the beach
 * on every frame. `__fr.stats().jadrija.census` is the proof and it reads
 * `{seen: 446, thin: 333, plain: 86, rich: 27}` with 818 blockers either side
 * of everything below.
 *
 * The same two lines as `jit` in the shore build, `laneJit` in 46-backlane and
 * `paxJit` in 60-pax, and copied a fourth time rather than imported for the
 * reason those give: a hash is pure, two callers landing on the same (i, k)
 * costs nothing, and what a shared one would cost is a dependency on a file
 * that belongs to somebody else's evening.
 *
 * Keyed on `fg.seed` and not on `fg.idx`, because `idx` is the beach's name
 * for somebody and the boat's passengers have never had one — see 60-pax.js.
 * Every figure on either has a seed. Multiplied up before it goes in: `seed`
 * lives in [0, 1) and the hash's first term is `i * 12.9898`, so a whole crowd
 * squeezed into one radian of sine is a crowd with visible bands in it.
 */
function crowdJit(i, k) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

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
  // Where the hip joint goes when this person sits on a slab: see `sit` in
  // `pose`. The old tube rig was measured by hand at 0.14 m, which is what
  // `restY - 0.72` came to on it; a body out of crowd_far.py says for itself,
  // off the underside of its own thighs, because a heavy woman sits higher on
  // her thighs than a lean man and a figure told otherwise sits in the slab.
  f.sitY = rig.sitHip != null ? rig.sitHip : f.restY - 0.72;
  // And how far a shin laid out along the ground falls from a level thigh to
  // the heel, for the quay sitters (1.538.2 — see `legRestOf` in
  // 43-settle.js). This rig has no ankle, so the knee's bind height stands in
  // for the shin and the ankle over the ground is 3.9 % of stature (Drillis
  // and Contini's table). About six degrees on every body.
  const kn = rig.parts ? rig.parts.findIndex((p) => p.name === 'legLL') : -1;
  const H = rig.height || 1.7;
  const shin = kn >= 0 && rig.bind ? rig.bind[kn][1] - 0.039 * H : 0.43;
  f.shinDrop = Math.asin(Math.max(0, Math.min(0.5, (f.sitY - 0.039 * H) / Math.max(0.2, shin))));
  return f;
}

/**
 * The far tier's bodies — tools/blender/crowd_far.py, one .fr3d v6 per person.
 *
 * ── what this replaced ─────────────────────────────────────────────────────
 *
 * Misha, 27 Sep 2026: *"lookin from very far away ... in the distance, one of
 * the bathers still appears as our 'prehistoric' wooden manequins. but as i
 * approached her closer, she transformed into modern v2.0 bather ... can we
 * just get rid of those prehistoric manequins completely"*.
 *
 * This tier used to draw everybody with two rigs out of tools/blender/
 * bather.py — eleven lofted tubes a person, one instanced layer per tube, and a
 * marker palette in the vertex colours asking each instance what colour its
 * skin, swimwear and hair were. Those were the mannequins: the one kind of
 * person on the shore that was not one of the eight people the near tier
 * draws, which is why walking up to somebody turned a wooden doll into a
 * woman in a red bikini.
 *
 * Now the far tier draws the SAME eight. The bake takes each v2 bather as it
 * ships, brings the arms down to the rest pose `pose()` below is written
 * against, folds its MakeHuman skeleton into the eleven joints this tier
 * animates, decimates it to the old rig's triangle budget and paints every
 * vertex with which of the person's three colours it wants and how much
 * shading the texture had there. A person at two hundred metres is the same
 * body, the same skin tone, the same swimsuit and the same hair as at two.
 *
 * The file:
 *
 *     '<4sIIIfI'  magic, 6, nv, ni, height, nparts
 *     per part:   u16 len, name, i32 parent, 3 f32 pivot (from parent's)
 *     u16 len, JSON meta
 *     f32 pos[nv*3]  i8 nrm[nv*3]  u8 tint[nv*4]  u8 bone[nv*4]  u16 idx[ni]
 *
 * (v10, what ships since 1.550.5, is the same with the positions and index
 * packed — see the note in the reader and tools/fr3d_q.py.)
 *
 * `parts` is the same table `rigSkeleton` has always read — names, parents
 * and pivots — and `bind` is where each joint stands in the bind pose, which
 * is the inverse every joint matrix is written against in `flush`.
 */
function readFR3DCrowd(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1),
    dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'FR3D') throw new Error('not an fr3d blob: ' + magic);
  const version = dv.getUint32(4, true);
  if (version !== 6 && version !== 10) {
    throw new Error('fr3d crowd body needs version 6 or 10, got ' + version);
  }
  const nv = dv.getUint32(8, true);
  const ni = dv.getUint32(12, true);
  const height = dv.getFloat32(16, true);
  const np = dv.getUint32(20, true);
  const dec = new TextDecoder();
  let o = 24;
  const parts = [];
  for (let i = 0; i < np; i++) {
    const len = dv.getUint16(o, true); o += 2;
    const name = dec.decode(new Uint8Array(buf, o, len)); o += len;
    parts.push({
      name, parent: dv.getInt32(o, true),
      pivot: [dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true),
        dv.getFloat32(o + 12, true)],
    });
    o += 16;
  }
  const ml = dv.getUint16(o, true); o += 2;
  const meta = JSON.parse(dec.decode(new Uint8Array(buf, o, ml))); o += ml;
  // Copies, once, at load: the table above is variable-length, so nothing
  // after it lands on the alignment a typed-array view needs.
  //
  // v10 is v6 PACKED (tools/fr3d_q.py): a position box, then the positions
  // as zigzag uint16 deltas across it (per axis, low bytes then high — v7's
  // runs), then the same normal, tint and bone bytes, then the index as
  // zigzag uint16 deltas. 0.013 mm on the tallest body; nothing else moves.
  let pos, idx;
  if (version === 10) {
    const b = new Uint8Array(buf);
    const lo = [0, 1, 2].map((k) => dv.getFloat32(o + k * 4, true));
    const hi = [0, 1, 2].map((k) => dv.getFloat32(o + 12 + k * 4, true));
    o += 24;
    pos = new Float32Array(nv * 3);
    for (let k = 0; k < 3; k++, o += nv * 2) {
      const s = (hi[k] - lo[k]) / 65535;
      let acc = 0;
      for (let i = 0; i < nv; i++) {
        const u = b[o + i] | (b[o + nv + i] << 8);
        acc = (acc + ((u >>> 1) ^ -(u & 1))) & 0xffff;
        pos[i * 3 + k] = lo[k] + acc * s;
      }
    }
  } else {
    pos = new Float32Array(buf.slice(o, o + nv * 12)); o += nv * 12;
  }
  const nrm = new Int8Array(buf.slice(o, o + nv * 3)); o += nv * 3;
  const tint = new Uint8Array(buf.slice(o, o + nv * 4)); o += nv * 4;
  const bone = new Uint8Array(buf.slice(o, o + nv * 4)); o += nv * 4;
  if (version === 10) {
    const b = new Uint8Array(buf, o, ni * 2);
    idx = new Uint16Array(ni);
    let acc = 0;
    for (let i = 0; i < ni; i++) {
      const u = b[i] | (b[ni + i] << 8);
      acc = (acc + ((u >>> 1) ^ -(u & 1))) & 0xffff;
      idx[i] = acc;
    }
  } else {
    idx = new Uint16Array(buf.slice(o, o + ni * 2));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3, true));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 4, true));
  geo.setAttribute('aBone', new THREE.BufferAttribute(bone, 4, true));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));

  // Parents come first — the bake writes them in `PARTS` order — so one pass
  // accumulates every joint's bind position.
  const bind = [];
  for (const p of parts) {
    const b = p.parent < 0 ? [0, 0, 0] : bind[p.parent];
    bind.push([b[0] + p.pivot[0], b[1] + p.pivot[1], b[2] + p.pivot[2]]);
  }
  return {
    parts, bind, geo, height, tris: ni / 3,
    // How high the hip joint sits over a seat with the thighs level, off this
    // body's own thighs. See `sitY` in `rigSkeleton`.
    sitHip: meta.sitHip, meta,
  };
}

/**
 * One body out of the payload, parsed once and shared by every crowd that
 * draws it — the shore's two and the boat's. Null if the build does not carry
 * it, which leaves that person to the other bodies of their sex.
 */
const CROWD_BODIES = new Map();
function loadCrowdBody(kind) {
  if (CROWD_BODIES.has(kind)) return CROWD_BODIES.get(kind);
  const key = 'crowd_' + kind + '_fr3d';
  const p = (async () => {
    if (typeof PAYLOAD === 'undefined' || !PAYLOAD[key]) return null;
    try {
      const b = readFR3DCrowd(await inflateBinary(PAYLOAD[key]));
      b.kind = kind;
      return b;
    } catch (e) {
      console.warn('crowd body failed:', key, e.message);
      return null;
    }
  })();
  CROWD_BODIES.set(kind, p);
  return p;
}

/**
 * Every body of one sex, in casting order. What `makeCrowd` is built from.
 *
 * By sex because the crowd is split by sex, and it is split by sex because
 * everything downstream of a person already is — the voice, the bark, which
 * of the eight a promotable bather becomes (`BATHER_SEX`). Four bodies a crowd
 * is four draws a crowd: eight for the whole far tier, where the old rigs cost
 * twenty-two.
 */
async function loadCrowdBodies(sex) {
  const kinds = BATHER_CAST.filter((k) => BATHER_SEX[k] === sex);
  const all = await Promise.all(kinds.map(loadCrowdBody));
  return all.filter(Boolean);
}

/**
 * Which body this person is drawn with, and dressed to match it.
 *
 * `kin` is the body they already are, if they are one — a promotable bather
 * is dealt one of the eight at build time (`castBlob` in 43-jadrija.js) and
 * turns into it when you walk up, so the far tier has to BE it or walking up
 * changes their shape. Everybody else — the shop staff, a boat's passengers —
 * gets one by hash off their seed, a child's body for a child (`child`) and an
 * adult's for everybody else, which is the one thing about them the old
 * mannequin could only fake by shrinking.
 *
 * And then `bather2Pick`, which is the near tier's own choice of skin, hair
 * and swimwear for that body, written back on to `fg`. For a promotable
 * bather it has already been made and is returned as it was; for anybody else
 * it replaces the beach palette's skin with a real skin's own mean tone, so a
 * far figure is a colour a person on that body can actually be.
 *
 * Rule 4: no draw of `rng` — `crowdJit` off the seed, like everything else in
 * this file.
 */
function crowdBody(crowd, fg, kin, child) {
  const kinds = crowd.kinds || [];
  let k = kin ? kinds.indexOf(kin) : -1;
  if (k < 0 && kinds.length) {
    const T = bather2Table();
    const isKid = (n) => (T && T.bathers[n] ? !!T.bathers[n].child : n.includes('child'));
    let pool = kinds.map((_n, i) => i).filter((i) => isKid(kinds[i]) === !!child);
    if (!pool.length) pool = kinds.map((_n, i) => i);
    k = pool[Math.floor(crowdJit(fg.seed * 977 + 13, 74) * pool.length) % pool.length];
  }
  fg.body = Math.max(0, k);
  if (kinds[fg.body]) bather2Pick(kinds[fg.body], fg);
  return fg.body;
}

/**
 * The shadow of one body layer: `GLSL_CROWD`, the same skinning the surface
 * does, so the shadow is cast from where the person is.
 */
const CROWD_CASTER_VERT = /* glsl */ `
attribute vec4 aBone;
varying float vDepth;
${GLSL_CROWD}
void main(){
  vec3 sp = vec3(0.0), sn = vec3(0.0);
  crowdSkin(aBone, vec4(position, 1.0), vec4(0.0), sp, sn);
  gl_Position = projectionMatrix * viewMatrix * vec4(sp, 1.0);
  vDepth = gl_Position.z / gl_Position.w * 0.5 + 0.5;
}
`;

/**
 * One instanced layer for one BODY: everybody in a crowd who is drawn with
 * it, in one draw.
 *
 * Per instance it carries the person's three colours (and a fourth, the
 * shirt, whose alpha says whether there is one) as attributes, and their
 * eleven joints as one row of `tex` — see `GLSL_CROWD` in 30-material.js for
 * the layout. The row is the instance's index, so `flush` writes person n's
 * joints to row n and their colours to slot n and nothing else has to agree.
 *
 * Double-sided, as the old layers were: the hair and swimwear are single
 * sheets, and the near tier draws them from both sides too.
 */
function crowdBodyLayer(scene, body, cap) {
  const geo = new THREE.InstancedBufferGeometry();
  for (const k of ['position', 'normal', 'aTint', 'aBone']) {
    geo.setAttribute(k, body.geo.attributes[k]);
  }
  geo.setIndex(body.geo.index);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

  const A = {
    aColor: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
    aSuit: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
    aHair: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
    aShirt: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4),
  };
  const NAME = { aColor: 'aInstColor', aSuit: 'aInstSuit', aHair: 'aInstHair',
    aShirt: 'aInstShirt' };
  for (const k in A) {
    A[k].setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(NAME[k], A[k]);
  }

  const W = body.parts.length * 3;
  const uCrowdBones = { value: null };

  const mesh = new THREE.Mesh(geo, solidMaterial(0xffffff, {
    instanced: true,
    vcol: false,
    defines: { FR_CROWD: '' },
    uniforms: {
      uCrowdBones,
      uCrowdCap: { value: new THREE.Vector2(body.meta.capHair || 1,
        body.meta.capSuit || 1) },
    },
    spec: 0.09,
    specPower: 24,
    // The same floor the near tier's skin gets — `SKIN_EMISSIVE`, see the
    // note there — because these are the same people on the same beach.
    emissive: SKIN_EMISSIVE,
    // The colour was resolved per vertex (see FR_CROWD in 30-material.js);
    // all that is left here is to light the back of a sheet as a front.
    body: 'n = gl_FrontFacing ? n : -n;',
    side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  // Named so a probe walking the scene can find them — `crowd:woman_old` is
  // everybody the far tier is drawing on that body right now.
  mesh.name = 'crowd:' + body.kind;
  scene.add(mesh);
  geo.instanceCount = 0;
  const L = { geo, mesh, tex: null, data: null, rows: 0, W, uCrowdBones, body, n: 0, ...A };
  crowdRows(L, 1);
  return L;
}

/**
 * Make a layer's joint texture `rows` people deep.
 *
 * Sized to the people who are actually on this body, not to the crowd's cap:
 * the texture goes up whole every frame (a DataTexture has no partial
 * upload), and eight layers each a hundred deep was 420 KB a frame of
 * matrices for a few dozen people. `makeCrowd` grows it the first time it
 * sees who is on which body, and again only if that changes.
 */
function crowdRows(L, rows) {
  if (rows <= L.rows) return;
  if (L.tex) L.tex.dispose();
  const was = L.data;
  L.rows = rows;
  L.data = new Float32Array(L.W * 4 * rows);
  if (was) L.data.set(was);
  L.tex = new THREE.DataTexture(L.data, L.W, rows, THREE.RGBAFormat, THREE.FloatType);
  L.tex.minFilter = L.tex.magFilter = THREE.NearestFilter;
  L.tex.generateMipmaps = false;
  L.tex.needsUpdate = true;
  L.uCrowdBones.value = L.tex;
}

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
 * And which of them is a woman.
 *
 * Stated rather than parsed off the name, because a table that can be read is
 * worth eight lines and a regex over `^woman|^girl` is a rule somebody has to
 * remember when the ninth person is baked.
 *
 * It exists because the beach was deciding this TWICE. `castBlob` deals these
 * eight along the shore on height alone -- child or adult, and nothing else,
 * because sex has not been drawn yet when it runs -- and the casting loop then
 * flipped its own coin for the instanced rig and the bark voice. Two answers
 * about one person, never compared: 41 of 79 promotable bathers disagreed.
 * What that looks like is a figure with a fall of hair down her neck who yelps
 * in a woman's voice and becomes a heavy old man in trunks as you walk up.
 *
 * Four of each, and both of `castBlob`'s bands are balanced too -- one girl
 * and one boy, three women and three men -- so reading sex off the deal
 * instead of off a coin leaves the shore's own balance where it was.
 */
const BATHER_SEX = {
  woman_young_slim: 'f', man_old_heavy: 'm',
  girl_child: 'f', man_young_fit: 'm',
  woman_young_full: 'f', boy_child: 'm',
  woman_old: 'f', man_young_lean: 'm',
};

/**
 * The bodies whose swimsuit top may come off, or be undone — and nobody else.
 *
 * Misha, 29 Sep 2026, of the mole: *"many of the women bathers have their
 * tops either fully off or partially off"*, which is what a Croatian bathing
 * station is and what 43-jadrija.js now places (`top` in `MOLE_LIFE`).
 *
 * A LIST OF BODIES, NOT OF PLACES, and that is the whole of why it is here.
 * A place on the mole says "whoever lies here has her top off", and the
 * people dealt those places are whoever the shore's casting put there — it
 * is not the placement's job to know who that is, and it must not be the
 * placement that keeps a child's swimsuit on. Every tier that draws a top
 * off asks THIS set, by the body it is actually drawing: the near tier in
 * `fig.dress` (42-bathers2.js), the far tier in `flush` below. The three
 * adult women and nobody else; the two children are not on it and cannot
 * be put on it by anything a place says.
 */
const TOPS_KINDS = new Set(['woman_young_slim', 'woman_young_full', 'woman_old']);

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

// ── a hand up, solved, because the baked one does nothing ────────────────────
//
// THE BAKED `wave` DOES NOT MOVE THESE FIGURES' ARMS AND NEVER HAS. It is in
// `BATHER_CLIPS`, it loads, `playing()` returns it and `curT` runs from 0 to
// 2.5 — and the hand comes up fifteen centimetres and goes down again. It was
// in the `BIZ` list above for as long as that list has existed and nobody
// noticed, because what it produced was a figure standing still.
//
// The cause is one line in tools/blender/bathers_mh.py. `_stand` re-tracks
// Baye's standing poses onto these eight skeletons, and part of that is
// rewriting the arms' lateral angle to `STAND_ARM_IN` so the hands hang beside
// the thighs rather than bowed out round them. `wave`'s raise is written in
// exactly that channel — `WAVE_UP` is `armUR: (-16, 0, 96)` and the 96 is the
// Z — so the re-tracking overwrites a 96-degree lift with a 33-degree tuck,
// on every key, every time the bake runs. Measured either way to be sure: the
// same clip on the show figure, which does not go through `_stand`, lifts her
// wrist from 0.85 m to 1.54 m over her own soles; on a bather it goes 0.81 to
// 0.96.
//
// `bathers_mh.py` is fixed, and this does not wait for it. The payloads under
// build/payload are committed rather than built — see the note over the parse
// in 43-jadrija.js — so the eight blobs on disk still carry the flat wave and
// will until somebody runs Blender. What follows makes the arm out of the two
// things that are already true at runtime: the skinning palette says where the
// arm IS, and `aim` can lay one rotation per bone over it.
//
// It is `holdPhone`'s solve with the target moved. Two bones, two minimal
// rotations, exact on the frame it is asked for; and the same three traps,
// which are written up over there at length:
//
//   `aim` is a DELTA and `boneAt` reports the RESULT, so the last delta has to
//   come off the measurement before the next one goes on — and the solve must
//   never run twice against one measurement, which is why the only caller is
//   inside the pose ladder's guard, immediately before the `update` that
//   rebuilds the palette.
//
//   `aims` keeps ONE rotation per bone, and the phones already own `armUR`,
//   `armLR`, `handR`, `fingersR` and `neck`. So anybody holding a phone waves
//   with the OTHER hand, which is what a person does anyway.
//
//   And the mesh outlives the person on it. A slot changing hands with a
//   delta still on its shoulder is the next occupant arriving with their arm
//   in the air — which is why the deltas are kept on the MESH (`handRec`) and
//   every solve starts by taking the last one off, whoever it was for.
//
// Since 1.539.5 this is one half of `handSide`, below: the wave is laid over
// an arm that is resting on something rather than over the bare clip, so a
// greeting lifts the hand off the table and puts it back.
const WAVE = {
  // Where the upper arm points, in FIGURE space — +x is the way they face,
  // +y is up, and their own left is −z. Mostly OUT to the side being greeted
  // and only twenty-one degrees above horizontal, which is an elbow at about
  // shoulder height.
  //
  // It was (0.40, 0.70, 0.59) first, which is forty-four degrees up, and
  // photographed at five metres that is a hand raised in a classroom: the
  // upper arm and the forearm end up thirty degrees apart, so the whole limb
  // reads as one straight stick pointing at the sky. Dropping the shoulder to
  // twenty-one degrees opens the elbow to fifty-one and is the difference
  // between hailing a taxi and saying hello.
  up: [0.34, 0.36, 0.87],
  // And the forearm off that, near enough vertical. The two put the wrist
  // 0.38 m above the shoulder: on a 1.38 m shoulder that is 1.76 m, which is
  // over the top of a 1.70 m head — and being over the head is the whole of
  // whether a wave reads across a promenade or is an elbow in a crowd. The
  // hand ends up 0.34 m out to the side, well clear of it.
  fore: [0.12, 0.95, 0.29],
  // 2.2 Hz, about the rate a hand actually waves, and the rock is about the
  // figure's own FORWARD axis so the whole arm swings from the shoulder
  // rather than the wrist flapping on the end of a fixed one.
  hz: 13.8, sweep: 0.22,
};
const _wG = new THREE.Vector3();
const _wT = new THREE.Vector3(), _wP = new THREE.Vector3();
const _wX = new THREE.Vector3(1, 0, 0);

/** `aim` takes an axis and an angle; a solve hands back a quaternion. */
function armAimQ(f, name, q) {
  const s = Math.hypot(q.x, q.y, q.z);
  f.aim(name, q.x, q.y, q.z, 2 * Math.atan2(s, q.w));
}

/**
 * The wave's two turns, against the clip's own arm: `u0` its upper arm and
 * `f0` its forearm, unit, figure space. Two minimal rotations, each taking a
 * bone's own direction where it has to go — the forearm's measured AFTER the
 * upper arm's, because an aim on a parent carries its children round with it.
 * The targets are `WAVE`'s, on the side being greeted and rocking.
 */
function waveTurns(u0, f0, left, t, seed, qa, qb) {
  const sd = left ? -1 : 1;
  const ph = Math.sin(t * WAVE.hz + seed * 6.283) * WAVE.sweep;
  _wT.set(WAVE.up[0], WAVE.up[1], sd * WAVE.up[2]).normalize()
    .applyAxisAngle(_wX, ph);
  _wP.set(WAVE.fore[0], WAVE.fore[1], sd * WAVE.fore[2]).normalize()
    .applyAxisAngle(_wX, ph);
  qa.setFromUnitVectors(u0, _wT);
  qb.setFromUnitVectors(_wG.copy(f0).applyQuaternion(qa), _wP);
}

// ── hands with nothing to do, resting on something ───────────────────────────
//
// Misha, 28 Sep 2026, a man at a café table at Jadrija with a phone at his
// ear: *"the hands for the bathers and stuff, they all have that frankenstein
// hand thing, when in doubt their hands should lay palms down on the tables
// or whatnot, to look more natural u know?"* His free hand was up in front of
// his chest, palm out, the four fingers straight and spread — held there, in
// the air, resting on nothing.
//
// It was the clip's hand and it was two faults. The seated clips were solved
// for where the WRIST goes (`sit_clips` in bathers_mh.py) and say nothing
// about the hand past it, so `sittable` lays a forearm on the table's edge and
// then carries on up the forearm's own line: the hand cocked up at the wrist,
// palm to the room. And the fingers are the bind pose's, dead straight, on
// every clip this rig plays — a flat plate on the end of every arm on this
// shore, standing or sitting. The settle (43-settle.js) lets an idle arm fall
// on to whatever is under it, but a ragdoll's hand is one rigid capsule with
// the wrist and the fingers where the clip left them, so the plate came down
// on to the table and stayed a plate.
//
// So the same shape of answer as the shop staff's (`counterArms`) and the
// riders' (`wheelHand` in 43-jadrija.js): the HAND is put where it rests, and
// the arm is solved to reach it.
//
//   at a table   the palm flat on the top, in front of the shoulder and a
//                little in, fingers pointing across it and turned in, the
//                knuckles up off the wood and the fingertips down on it —
//                wherever the table can be reached without a straight arm,
//                sitting forward from the hips a little if that is what it
//                takes (`handPlan`).
//   otherwise    on the thigh, half way to the knee, fingers along it and
//                draped over the top. A quay sitter too — unless their clip
//                has the hand planted on the concrete beside or behind them,
//                which is already a hand resting on something and is left be.
//   free         standing, walking, wading, lying: the clip's arm, which
//                hangs them at their sides already, with the fingers relaxed.
//
// And the fingers everywhere, which is the half of "frankenstein" that was on
// everybody. A relaxed hand is not straight: the four fingers fold a third of
// the way at the knuckles and the thumb comes in toward the palm. This rig has
// one bone for the four fingers and one for the thumb, so that is two turns,
// about the hand's own measured axes (see `handBody`), and only ever MORE
// curl than the clip's — a hand the clip closes round a ladder's rail stays
// closed.
//
// A GREETING OR A GESTURE STARTS FROM THE REST AND ENDS IN IT. `aims` keeps
// one rotation per bone, and the chatter's gesture and the greeting's wave
// (`fg.gArm`) are aims on the same two bones, so they are solved here
// together: the wave's turns are worked out against the clip exactly as they
// always were (`waveTurns`), and the arm goes `g` of the way from resting to
// them — the hand comes up off the table, opens, and goes back down on to it.
//
// THE PHONE'S HAND IS THE PHONE'S. `holdPhone` in 43-jadrija.js owns `armUR`,
// `armLR`, `handR` and `fingersR` for anybody holding one, so for them this
// does the other hand and nothing else.
//
// Poses from the same measurement the wave uses — the palette says where the
// arm IS, the deltas this laid last time are taken back off it to find the
// clip underneath (`measured = qh · qb · qa · clip` for the hand) — so the
// same guard applies: only inside the pose ladder, once per `update`.
const HANDS = {
  // The palm's normal and the thumb's fold axis in the bind pose, figure
  // space: the bucketeer's measurements of this rig's hand, the same numbers
  // `WHEEL_HAND` grips the handlebars with. The palm is squared off each
  // body's own wrist-to-knuckle line in `handBody`, and the knuckle line is
  // the two crossed — which is the axis the four fingers fold about.
  palm: { L: [-0.180, -0.487, 0.854], R: [-0.179, -0.485, -0.856] },
  thumb: { L: [-0.149, -0.846, -0.514], R: [0.149, 0.847, -0.511] },
  // A relaxed hand's fold, radians from straight: the four fingers at the
  // knuckle, a person's own between the two, and the thumb in toward the
  // palm. In a wave the fingers open to `open`.
  curl: [0.55, 0.80], tuck: 0.30, open: 0.12,
  // The palm on a surface. `heel` is where it touches along the
  // wrist-to-knuckle line — the heel of the hand, because with the knuckles
  // tipped `arch` up off the surface that is the low point of the palm, and
  // the fingertips come back down on to it past the knuckle; `under` how far
  // the skin there is under the bone line; `roll` a person's own lean on to
  // the little finger's edge; `tip` half a finger's thickness. MEASURED on
  // the first cut, which touched at the palm's middle with the skin 18 mm
  // under the line: the wrist came out 3 mm over the table top and the
  // forearm and heel of the hand went in under the surface, fingertips
  // poking up through it.
  heel: 0.25, under: 0.024, arch: 0.24, roll: [0.04, 0.26], tip: 0.009,
  // Where on a table, from the shoulder: this far forward and this far in,
  // each a person's own give or take `spread`, and the heel of the hand
  // kept `inset` inside the edge — the palm and the fingers are further in.
  // `toe` turns the fingers in toward each other.
  fwd: 0.44, in: 0.05, spread: 0.05, inset: 0.035, toe: [0.15, 0.45],
  // The most of a straight arm a rest may take, leaning in by up to `lean`
  // to get there. Past it the table is too far — mostly the sitters leant
  // back in `sit`, `sitlap` and `sitback` — and the hand goes on the thigh,
  // which is where those clips had it anyway.
  reach: 0.95,
  // And the most a sitter leans forward from the hips to get there,
  // radians. 0.38 was tried: the man in Misha's screenshot, whose clip
  // already has him bowed over the phone at his ear, went down with his face
  // a hand over the table top. At 0.22 the ones it reaches are sitting
  // forward and the rest keep their hands on their thighs.
  lean: 0.22, spare: 0.06,
  // On the thigh: how far from hip to knee, the fingers' drape over it, and
  // the odds a table sitter keeps one hand there rather than on the table,
  // which is what stops every café on the shore being a row of the same
  // four hands.
  thigh: [0.46, 0.62], drape: 0.42, lap: 0.28,
  // A hand whose wrist is lower than this over the floor is planted on it
  // (standing and lying; a quay sitter's is measured against their hip).
  planted: 0.13,
  // Rest weight a second, in and out.
  rate: 2.5,
  // For a probe: everybody's hands as their clip has them.
  off: false,
};
const HAND_SIDES = ['L', 'R'];
const _hS = new THREE.Vector3(), _hE = new THREE.Vector3(), _hW = new THREE.Vector3();
const _hU = new THREE.Vector3(), _hF = new THREE.Vector3(), _hG = new THREE.Vector3();
const _hP = new THREE.Vector3(), _hD = new THREE.Vector3(), _hN = new THREE.Vector3();
const _hC = new THREE.Vector3(), _hM = new THREE.Vector3(), _hV = new THREE.Vector3();
const _hE1 = new THREE.Vector3(), _hA = new THREE.Vector3(), _hB = new THREE.Vector3();
const _hY = new THREE.Vector3(0, 1, 0);
const _hQm = new THREE.Quaternion(), _hQf = new THREE.Quaternion(), _hQt = new THREE.Quaternion();
const _hI = new THREE.Quaternion(), _hH0 = new THREE.Quaternion(), _hF0 = new THREE.Quaternion();
const _hT0 = new THREE.Quaternion(), _hRa = new THREE.Quaternion(), _hRb = new THREE.Quaternion();
const _hRh = new THREE.Quaternion(), _hWa = new THREE.Quaternion(), _hWb = new THREE.Quaternion();
const _hHf = new THREE.Quaternion(), _hX = new THREE.Quaternion(), _hID = new THREE.Quaternion();
const _hQs = new THREE.Quaternion();
const _hMa = new THREE.Matrix4(), _hMb = new THREE.Matrix4();
const handStats = { table: 0, thigh: 0, planted: 0, free: 0, res: 0, resMax: 0, n: 0, worst: -1 };

/**
 * This body's hands, in its bind pose: for each side the bones, the
 * wrist-to-knuckle line `d` and its length, the palm's normal `n` squared off
 * it, the knuckle line `c = d × n` the fingers fold about (a positive turn
 * takes the fingertips toward the palm), the thumb's fold axis `t`, the
 * fingers' reach past the knuckle `fl` off the skin, and the thigh's radius
 * off `settleCaps`. Once a body, on the parsed blob. Null if the rig has no
 * finger bones.
 */
function handBody(f) {
  const data = f.data;
  if (data.handRest !== undefined) return data.handRest;
  data.handRest = null;
  const T = f.bindRest().bindT;
  const pos = data.geo.getAttribute('position').array;
  const bi = data.geo.getAttribute('aBoneIdx').array, bw = data.geo.getAttribute('aBoneWt').array;
  const caps = typeof settleCaps === 'function' ? settleCaps(f) : [];
  const out = {};
  for (const s of HAND_SIDES) {
    const ix = {};
    for (const n of ['armU', 'armL', 'hand', 'fingers', 'thumb', 'legU', 'legL']) {
      ix[n] = f.boneIndex(n + s);
      if (ix[n] < 0) return null;
    }
    const at = (i) => new THREE.Vector3(T[3 * i], T[3 * i + 1], T[3 * i + 2]);
    const W = at(ix.hand), K = at(ix.fingers);
    const d = K.clone().sub(W);
    const len = d.length();
    d.normalize();
    const n = new THREE.Vector3(...HANDS.palm[s]);
    n.addScaledVector(d, -n.dot(d)).normalize();
    const c = d.clone().cross(n);
    // The fingertips: how far along the hand the fingers' own skin reaches
    // past the knuckle, the 95th of it so a stray vertex does not count.
    const reach = [];
    for (let v = 0, nv = pos.length / 3; v < nv; v++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (bw[4 * v + k] > bw[4 * v + best]) best = k;
      if (bi[4 * v + best] !== ix.fingers) continue;
      reach.push((pos[3 * v] - K.x) * d.x + (pos[3 * v + 1] - K.y) * d.y + (pos[3 * v + 2] - K.z) * d.z);
    }
    reach.sort((a, b) => a - b);
    const fl = reach.length > 8 ? reach[Math.floor(reach.length * 0.95)] : len * 0.8;
    const cap = caps.find((q) => q.name === 'legU' + s);
    out[s] = {
      iu: ix.armU, il: ix.armL, ih: ix.hand, if: ix.fingers, it: ix.thumb, ik: ix.legU, iq: ix.legL,
      hand: 'hand' + s, fing: 'fingers' + s, thumb: 'thumb' + s, armU: 'armU' + s, armL: 'armL' + s,
      d, n, c, t: new THREE.Vector3(...HANDS.thumb[s]).normalize(), len, fl,
      thighR: cap ? (cap.r0 + cap.r1) * 0.5 : 0.07,
    };
  }
  out.spine = f.boneIndex('spine01');
  if (out.spine < 0) return null;
  data.handRest = out;
  return out;
}

/** What `handsPose` keeps on a mesh, a side: the turns it has laid there. */
function handRec() {
  const q = () => new THREE.Quaternion();
  return { on: false, who: null, w: 0, g: 0, qa: q(), qb: q(), qh: q(), qf: q(), qt: q(), goal: new THREE.Vector3(),
    rest: false };
}

/** Take every turn this laid on one side back off, and forget it. */
function handClear(f, B, r, keepPhone) {
  if (!r.on) return;
  if (!keepPhone) {
    f.aim(B.armU, 0, 1, 0, 0); f.aim(B.armL, 0, 1, 0, 0);
    f.aim(B.hand, 0, 1, 0, 0); f.aim(B.fing, 0, 1, 0, 0);
  }
  f.aim(B.thumb, 0, 1, 0, 0);
  for (const k of ['qa', 'qb', 'qh', 'qf', 'qt']) r[k].identity();
  r.on = false; r.rest = false;
}

/** The signed turn of `q` about the unit axis `a`, radians. */
function twistAbout(q, a) {
  let s = q.x * a.x + q.y * a.y + q.z * a.z, w = q.w;
  if (w < 0) { s = -s; w = -w; }
  return 2 * Math.atan2(s, w);
}

/**
 * Where this person's hands rest, planned once on the body that draws them
 * and kept: `{ data, L, R }`, each side `{ kind, P, h, toe, roll, curl, u }`.
 * Planned against the pose as it is on the first frame they are drawn — the
 * clip with this solve taken back off it — so it is where THEIR shoulder is
 * over THEIR table. The palm's spot on a table is fixed there, in the
 * figure's frame, so the hand stays put while the body breathes over it; a
 * thigh rest follows the thigh.
 */
function handPlan(fg, H, geo, S0, W0, arm, piv, hipY, lean0, sd, s) {
  const j = (k) => crowdJit((fg.seed || 0) * 977 + (sd > 0 ? 71 : 37), 960 + k);
  const lo = (r, u) => r[0] + (r[1] - r[0]) * u;
  const p = { kind: 'free', P: new THREE.Vector3(), h: new THREE.Vector3(1, 0, 0), lean: 0,
    toe: lo(HANDS.toe, j(1)), roll: lo(HANDS.roll, j(2)), curl: lo(HANDS.curl, j(3)),
    u: lo(HANDS.thigh, j(4)) };
  if (fg.mode !== 'sit') {
    if (W0.y < HANDS.planted) p.kind = 'planted';
    return p;
  }
  // On the quay the floor is what they sit on, so a planted hand is one
  // below the hip it is beside: propped on the concrete, which is resting.
  if (!fg.sitAt && W0.y < hipY - 0.03) { p.kind = 'planted'; return p; }
  p.kind = 'thigh';
  // The table, if they are at one and it is not the hand that stays in the lap.
  const tb = geo && geo.back && geo.boxes && geo.boxes.length >= 7 ? geo.boxes.slice(-7) : null;
  if (!tb) { p.why = 'no table'; return p; }
  // One of the two hands, now and then, and never both.
  if (j(5) < HANDS.lap && (j(6) < 0.5) === (sd > 0)) { p.why = 'lap'; return p; }
  const [cx, cy, cz, hx, hy, hz, ty] = tb;
  const top = cy + hy;
  // In front of the shoulder and a little in, give or take.
  const Q = _hP.set(S0.x + HANDS.fwd + (j(7) - 0.5) * 2 * HANDS.spread, top,
    S0.z - sd * HANDS.in + (j(8) - 0.5) * 2 * HANDS.spread);
  // Into the top: the table's own frame, three.js's yaw turned back.
  const ct = Math.cos(ty), st = Math.sin(ty);
  const dx = Q.x - cx, dz = Q.z - cz;
  let lx = dx * ct - dz * st, lz = dx * st + dz * ct;
  if (geo.round) {
    const r = Math.hypot(lx, lz), R = hx - HANDS.inset;
    if (r > R) { lx *= R / r; lz *= R / r; }
  } else {
    lx = Math.max(-(hx - HANDS.inset), Math.min(hx - HANDS.inset, lx));
    lz = Math.max(-(hz - HANDS.inset), Math.min(hz - HANDS.inset, lz));
  }
  const P = new THREE.Vector3(cx + lx * ct + lz * st, top, cz - lx * st + lz * ct);
  // The way the fingers point: from the shoulder, level, and turned in.
  const h = new THREE.Vector3(P.x - S0.x, 0, P.z - S0.z);
  if (h.lengthSq() < 1e-6) h.set(1, 0, 0);
  h.normalize().applyAxisAngle(_hY, sd * p.toe);
  // Nor across their middle, nor behind them.
  if (sd * P.z < -0.06 || P.x < S0.x + 0.12) { p.why = 'across'; return p; }
  // Reachable without a straight arm: the wrist this palm puts, against the
  // arm, `arm` long — measured off the pose, shoulder to elbow to wrist.
  //
  // AND LEANING IN TO IT, which is what somebody does whose table is a hand
  // further off than their arm: MEASURED, the six seated clips put the table's
  // near edge 0.5 to 0.65 m in front of the shoulders and the wrist on it is
  // 1.1 to 1.4 arms away for everybody but the two `sittable` sitters, who are
  // already leant over it. So they lean in from the hips (`spine01`, which
  // nothing else on a bather aims) by as little as gets the hand there, up to
  // `lean`; past that the table is too far and the hand stays on the thigh.
  // From the hips and not the middle of the back: the first cut bent at
  // `spine02`, and a quarter of a radian there moved the shoulders 7 cm and
  // put a man's face over his table — the same turn from the hips is 11 cm,
  // and reads as sitting forward rather than as slumping.
  const B = H[s];
  const Wg = handFrame(B, P, h, _hY, p.roll, sd, _hD, _hN, _hC, _hG);
  p.why = +(Wg.distanceTo(S0) / arm).toFixed(2);
  // From the shoulder as it would be sitting up: a plan made again after the
  // settle is measured with this person's lean already on it, and a lean
  // found from there is a lean on top of a lean — the first cut halved
  // itself on every re-plan and left the old woman at Caffe TRAMPULIN's
  // hands 14 cm short of her table.
  const c0 = Math.cos(lean0), s0 = Math.sin(lean0);
  const ox = (S0.x - piv.x) * c0 - (S0.y - piv.y) * s0, oy = (S0.x - piv.x) * s0 + (S0.y - piv.y) * c0;
  let lean = -1;
  for (let a = 0; a <= HANDS.lean + 1e-6; a += 0.02) {
    const c = Math.cos(a), sn = Math.sin(a);
    _hV.set(piv.x + ox * c + oy * sn, piv.y - ox * sn + oy * c, S0.z);
    if (Wg.distanceTo(_hV) <= HANDS.reach * arm) { lean = a; break; }
  }
  if (lean < 0) return p;
  // And a little further than just reaching, where there is any to give:
  // the talking clips rock the trunk, and planned to the millimetre a hand
  // came 8 cm off its table every time the clip sat its speaker back.
  p.lean = lean > 0 ? Math.min(HANDS.lean, lean + HANDS.spare) : 0;
  p.kind = 'table';
  p.P.copy(P);
  p.h.copy(h);
  return p;
}

/**
 * The hand's frame resting on a surface with normal `m`, the palm's middle
 * at `P` and the fingers heading `h`: knuckles `d` (tipped `arch` up off
 * it), palm normal `n` (on to it, rolled `roll` toward the little finger),
 * knuckle line `c`; and the wrist that puts the palm there, into `W`.
 */
function handFrame(B, P, h, m, roll, sd, d, n, c, W) {
  d.copy(h).addScaledVector(m, -h.dot(m)).normalize();
  const ca = Math.cos(HANDS.arch), sa = Math.sin(HANDS.arch);
  d.multiplyScalar(ca).addScaledVector(m, sa).normalize();
  n.copy(m).negate().addScaledVector(d, d.dot(m)).normalize();
  // Rolled on to the little finger's edge: the palm turns toward the thumb's
  // side (`sd · c` — the thumb is +c on the right hand and −c on the left).
  c.crossVectors(d, n);
  n.multiplyScalar(Math.cos(roll)).addScaledVector(c, sd * Math.sin(roll)).normalize();
  c.crossVectors(d, n);
  return W.copy(P).addScaledVector(n, -HANDS.under).addScaledVector(d, -HANDS.heel * B.len);
}

/**
 * One arm's rest, greeting and fingers, laid on as aims. See the note over
 * `HANDS`. `g` is the greeting's weight on THIS side (0 if it is not this one).
 */
function handSide(f, r, B, H, fg, s, sd, g, t, dt, geo, lean0) {
  // ── what the clip is doing under the last solve ─────────────────────────
  f.boneAt(B.iu, _hS); f.boneAt(B.il, _hE); f.boneAt(B.ih, _hW);
  const lu = _hS.distanceTo(_hE), ll = _hE.distanceTo(_hW);
  // A figure that has never been posed has a palette of zeros.
  if (lu < 0.05 || ll < 0.05) return;
  // The undo, outermost last on and so first off.
  const ia = _hX.copy(r.qa).invert();
  const ib = _hQm.copy(r.qb).invert();
  _hU.copy(_hE).sub(_hS).divideScalar(lu || 1).applyQuaternion(ia);
  _hF.copy(_hW).sub(_hE).divideScalar(ll || 1).applyQuaternion(ib).applyQuaternion(ia);
  // Hand, fingers and thumb, as turns off the bind: `measured = qh·qb·qa·clip`,
  // and the fingers and the thumb with their own outside that.
  _hI.copy(r.qh).multiply(r.qb).multiply(r.qa).invert();
  f.boneTurn(B.ih, _hH0).premultiply(_hI);
  f.boneTurn(B.if, _hF0).premultiply(_hQf.copy(r.qf).invert()).premultiply(_hI);
  f.boneTurn(B.it, _hT0).premultiply(_hQt.copy(r.qt).invert()).premultiply(_hI);
  // The clip's wrist, for the plan.
  _hW.copy(_hS).addScaledVector(_hU, lu).addScaledVector(_hF, ll);

  // ── the plan, once a person on a body ───────────────────────────────────
  // AND AGAIN ONCE THEY HAVE SAT DOWN. A sitter is drawn in their bare clip
  // until the settle gets to them and is eased into it over a second
  // (`sitLayer`), and the settle moves a shoulder by several centimetres —
  // MEASURED, a table planned off the bare clip was 10 cm out of reach once
  // the man in Misha's screenshot had settled back. So the plan is keyed on
  // the settle it was made against, and made again when that lands in full.
  const set = fg.settled && f.sitL && f.sitL.on && f.sitL.w >= 1 ? fg.settled : null;
  let pl = fg.handPlan;
  if (!pl || pl.data !== f.data || pl.set !== set) {
    pl = fg.handPlan = { data: f.data, set, L: null, R: null };
  }
  if (!pl[s]) {
    const hipY = f.boneAt(B.ik, _hA).y;
    pl[s] = handPlan(fg, H, geo, _hS, _hW, lu + ll, f.boneAt(H.spine, _hM), hipY, lean0, sd, s);
  }
  const p = pl[s];
  const rest = p.kind === 'table' || p.kind === 'thigh';
  // A new person on this mesh sits down resting; somebody already here eases.
  if (r.who !== fg) { r.who = fg; r.w = rest ? 1 : 0; }
  else r.w = rest ? Math.min(1, r.w + dt * HANDS.rate) : Math.max(0, r.w - dt * HANDS.rate);

  // ── the rest: the hand where it goes, then the arm to it ────────────────
  _hRa.identity(); _hRb.identity(); _hRh.identity();
  let kt = p.curl, rel = false;
  if (r.w > 0) {
    if (p.kind === 'table') {
      handFrame(B, p.P, p.h, _hY, p.roll, sd, _hD, _hN, _hC, _hG);
      kt = HANDS.arch + Math.asin(Math.max(-0.4, Math.min(0.9,
        (HANDS.under + (1 - HANDS.heel) * B.len * Math.sin(HANDS.arch) - HANDS.tip) / B.fl)));
      _hV.set(-0.25, -1, sd * 0.55);
    } else {
      // On the thigh, which goes where the clip and the settle take it.
      f.boneAt(B.ik, _hA); f.boneAt(B.iq, _hB);
      const tl = _hA.distanceTo(_hB);
      _hM.copy(_hB).sub(_hA).divideScalar(tl || 1);
      _hC.copy(_hY).addScaledVector(_hM, -_hM.y).normalize();
      _hP.copy(_hA).addScaledVector(_hM, p.u * tl).addScaledVector(_hC, B.thighR);
      _hA.copy(_hM).applyAxisAngle(_hY, sd * p.toe);
      _hB.copy(_hC);
      handFrame(B, _hP, _hA, _hB, p.roll * 0.5, sd, _hD, _hN, _hC, _hG);
      kt = HANDS.drape;
      _hV.set(-0.6, -0.4, sd * 0.8);
    }
    rel = true;
    // Two bones, shoulder to wrist, the elbow bent toward `_hV`.
    _hA.copy(_hG).sub(_hS);
    let dd = _hA.length();
    _hA.divideScalar(dd || 1);
    dd = Math.min(lu + ll - 1e-3, Math.max(Math.abs(lu - ll) + 1e-3, dd));
    const a = (lu * lu - ll * ll + dd * dd) / (2 * dd);
    const hh = Math.sqrt(Math.max(0, lu * lu - a * a));
    _hV.addScaledVector(_hA, -_hV.dot(_hA)).normalize();
    _hE1.copy(_hS).addScaledVector(_hA, a).addScaledVector(_hV, hh);
    r.goal.copy(_hG);
    _hB.copy(_hE1).sub(_hS).normalize();
    _hRa.setFromUnitVectors(_hU, _hB);
    _hB.copy(_hF).applyQuaternion(_hRa);
    _hA.copy(_hG).sub(_hE1).normalize();
    _hRb.setFromUnitVectors(_hB, _hA);
    // The hand: the bind's frame on to this one, less what the arm carried.
    _hMa.makeBasis(_hD, _hN, _hC);
    _hMb.makeBasis(B.d, B.n, B.c).transpose();
    _hRh.setFromRotationMatrix(_hMa.multiply(_hMb));
    _hHf.copy(_hRb).multiply(_hRa).multiply(_hH0).invert();
    _hRh.multiply(_hHf);
    if (r.w < 1) {
      _hRa.copy(_hQs.copy(_hID).slerp(_hRa, r.w));
      _hRb.copy(_hQs.copy(_hID).slerp(_hRb, r.w));
      _hRh.copy(_hQs.copy(_hID).slerp(_hRh, r.w));
    }
  }
  // ── and the greeting's arm, `g` of the way from wherever that left it ───
  if (g > 0) {
    waveTurns(_hU, _hF, sd < 0, t, fg.seed, _hWa, _hWb);
    _hRa.slerp(_hWa, g);
    _hRb.slerp(_hWb, g);
    _hRh.slerp(_hID, g);
  }
  r.qa.copy(_hRa); r.qb.copy(_hRb); r.qh.copy(_hRh);
  // ── the fingers and the thumb, about the hand where it now is ───────────
  const k0 = twistAbout(_hQf.copy(_hH0).invert().multiply(_hF0), B.c);
  const j0 = twistAbout(_hQt.copy(_hH0).invert().multiply(_hT0), B.t);
  let df, dth;
  if (p.kind === 'planted') {
    // Flat on the concrete, as the clip has it, unless it comes up to wave.
    df = g * (HANDS.open - k0);
    dth = 0;
  } else {
    const want = kt + (HANDS.open - kt) * g;
    // Only ever more curl than the clip's when nothing is being rested:
    // a hand the clip closes round something stays closed.
    df = rel ? (want - k0) * r.w + Math.max(0, p.curl - k0) * (1 - r.w) : Math.max(0, want - k0);
    if (g > 0 && !rel) df = (want - k0) * g + df * (1 - g);
    dth = Math.max(0, HANDS.tuck - j0) * (1 - g);
  }
  _hHf.copy(r.qh).multiply(r.qb).multiply(r.qa).multiply(_hH0);
  _hA.copy(B.c).applyQuaternion(_hHf);
  r.qf.setFromAxisAngle(_hA, df);
  _hA.copy(B.t).applyQuaternion(_hHf);
  r.qt.setFromAxisAngle(_hA, dth);
  armAimQ(f, B.armU, r.qa); armAimQ(f, B.armL, r.qb); armAimQ(f, B.hand, r.qh);
  armAimQ(f, B.fing, r.qf); armAimQ(f, B.thumb, r.qt);
  r.on = true;
  r.rest = rel && r.w > 0;
  r.g = g;
  handStats[p.kind]++;
}

/**
 * Both hands of one skinned bather, immediately before the `update` that
 * rebuilds the palette and never anywhere else — see the note over `HANDS`.
 */
function handsPose(f, rec, fg, t, dt, geo) {
  const H = handBody(f);
  if (!H) return;
  for (let k = 0; k < 2; k++) {
    const s = HAND_SIDES[k], sd = k ? 1 : -1, r = rec[s], B = H[s];
    // The phone's arm is the phone's; only the thumb was ever this one's.
    // And the cigarette's, which is solved by the same kind of hold on the
    // same side (`stepSmokers` in 43-jadrija.js).
    const held = sd > 0 && !!(fg.phone || fg.smoke || fg.bubbles);
    if (HANDS.off || held) { handClear(f, B, r, held); continue; }
    // Measured against where the last solve put the wrist: how far off the
    // surface a resting hand actually got (a reach the arm did not have).
    if (r.rest && r.who === fg && !r.g && r.w >= 1) {
      const e = f.boneAt(B.ih, _hS).distanceTo(r.goal);
      handStats.res += e; handStats.n++;
      if (e > handStats.resMax) { handStats.resMax = e; handStats.worst = fg.idx; }
    }
    const g = fg.gArm > 0 && (fg.phone || fg.smoke || fg.bubbles ? true : !!fg.gArmL) === (sd < 0) ? fg.gArm : 0;
    handSide(f, r, B, H, fg, s, sd, g, t, dt, geo, rec.lean);
  }
  // The lean a table asked for, eased with the hand that asked for it. Not
  // a delta against anything measured — the shoulder is measured with it on
  // and is where the arm is solved from — so it is simply written.
  let lean = 0;
  const pl = !HANDS.off && fg.handPlan && fg.handPlan.data === f.data ? fg.handPlan : null;
  if (pl) {
    for (const s of HAND_SIDES) {
      const p = pl[s];
      if (p && p.kind === 'table') lean = Math.max(lean, p.lean * rec[s].w);
    }
  }
  if (lean || rec.lean) f.aim('spine01', 0, 0, -1, lean);
  rec.lean = lean;
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
  // What `handsPose` has laid on each MESH's arms, and it is per mesh and not
  // per person: the delta lives on the bone and the bone outlives whoever is
  // standing on it. See the note over `HANDS`.
  const hands = figs.map(() => ({ L: handRec(), R: handRec(), lean: 0 }));

  // What each pose is called over here. The crowd's `mode` is a body position
  // and a clip is a body position over time, so most of them land on `idle`:
  // somebody standing in the shallows is somebody standing.
  //
  // `sit` is the one that does not, and it used to: it landed on `idle`, which
  // is a person standing up where a person should be sitting down, and that is
  // why the terraces were drawn by the instanced tier instead. There are six
  // seated clips in the bake now — see `sit_clips` in tools/blender/bathers_mh.py
  // — and which of the six a figure is in is `fg.seat`, set once where the
  // crowd is placed and never afterwards, because a person who changes how
  // they are sitting every time you look away is worse than a mannequin.
  const CLIP = { stand: 'idle', wade: 'idle', walk: 'walk', sit: 'idle',
    lie: 'idle', wait: 'idle' };
  // Three authored against the furniture and three solved on to hand positions
  // measured off motion capture. Counted on the sand at t 300 s 6 on 10 Sep,
  // before this: of a hundred people twenty-six were sitting and they had FOUR
  // poses between them — eleven quay sitters on the one `sitquay`, and fifteen
  // terrace sitters six / five / four across the three authored ones. Eight
  // now, and the biggest single-pose group on this shore drops from eleven
  // people to six.
  const SEATED = ['sit', 'sitback', 'sittable',
    'sitlap', 'sittalk', 'sitfwd'];
  // The quay's own two. There is no `fg.seat` out here — nobody on the lip of
  // the promenade is in a numbered chair — so the choice rides on `fg.seed`,
  // the draw the figure was already given when the beach was built. Reading a
  // number that has already been drawn is free; DRAWING one here would move
  // every parasol on the beach (rule 4).
  //
  // `fg.idx` was the first cut and it is the obvious one — the casting order
  // is stable, ordinal and costs nothing. Measured, it split the eleven quay
  // sitters EIGHT / three, because the casting walks the deck laying people
  // down in a repeating pattern and the quay sitters in it are very nearly
  // every third person: an index modulo a small list against a stride of three
  // is not a spread, it is a comb. The seed has no such structure.
  const QUAYED = ['sitquay', 'quaytalk'];
  // What somebody standing about does that `idle` does not: a look off to one
  // side. It is a one-shot in the bake and it is keyed from `IDLE_A` at either
  // end — see BATHER_CLIPS in tools/blender/bathers_mh.py — so it drops into a
  // loop of `idle` with nothing between it and it, which is exactly why it is
  // usable here and `kneel` is not.
  //
  // `wave` WAS IN THIS LIST and is not any more, for two reasons and either
  // would have been enough.
  //
  // Which piece of business a figure does is fixed by their seed, so a quarter
  // of everybody standing on this shore waved at nobody every half minute,
  // forever — not one head in the frame turning to see it. A wave with nobody
  // looking back is worse than no wave, and a wave that is aimed at somebody
  // has to be asked for by whoever knows who that is: `stepGreet` in
  // 43-jadrija.js, through `fg.cue` below.
  //
  // And the clip does not work. See the long note over `WAVE` at the top
  // of this file: the bake flattens it, the arm comes up fifteen centimetres,
  // and what a quarter of this beach was actually doing every half minute was
  // nothing at all. The greeting solves its own arm instead.
  // `stretch` is CMU subject 42 retargeted whole — see the note over the clip
  // in human_mh.py. It is seven and a half seconds where `notice` is one, so
  // it is worth saying why that is fine here: `midBiz` gates the scheduler on
  // whatever is playing, `next: want` takes them back to their idle after it,
  // and the gate below is an EDGE, so a long one-shot is started once and left
  // alone. What it buys is a beach where somebody is doing something that
  // takes a while, instead of forty people each doing a one-second thing.
  const BIZ = ['notice', 'stretch'];
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
   * Which clip this person should be playing. See `firstClip` below for why
   * every return here goes through a test that the blob carries the name.
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
      // On her front if the place she was put says so (`fg.prone`, the
      // mole), which is `prone` — made from `sunbathe` on this body when
      // the blobs are parsed, see `proneClip` in 43-jadrija.js.
      if (fg.prone && f.clips && f.clips.includes('prone')) return 'prone';
      return f.clips && f.clips.includes('sunbathe') ? 'sunbathe' : 'idle';
    }
    if (fg.mode !== 'sit') return CLIP[fg.mode] || 'idle';
    // Two different kinds of sitting, and the difference is the furniture.
    // A terrace sitter is on a 0.46 m chair and plays one of six clips solved
    // against it; a quay sitter is on the slab itself with their legs over the
    // water, half a metre lower, and plays one of two solved against that.
    // Handing a chair clip to somebody on the quay is what the old code could
    // not do — it did not have to, because the quay sitters were all
    // mannequins — and it is still what this must not do: the two families are
    // separate lists and a figure never crosses between them, because the
    // whole of the difference between them is a hip half a metre lower and
    // shins hanging over water.
    const quay = fg.seat == null;
    const list = quay ? QUAYED : SEATED;
    const k = quay ? Math.floor((fg.seed || 0) * list.length) : (fg.seat | 0);
    return firstClip(f, list[(k % list.length + list.length) % list.length],
      list[0], 'idle');
  }

  /**
   * The first of these clip names this blob actually carries.
   *
   * The `f.clips` test was never defensive coding for its own sake and it
   * matters more with eight seated clips than it did with four:
   * build/payload/bather_*.fr3d.gz is COMMITTED rather than built, so a blob
   * baked before a clip existed has to come out as somebody rather than as a
   * thrown exception. What changed is the fallback. One step to `idle` was
   * fine when the only thing that could be missing was the whole seated set;
   * now a blob can easily have `sit` and not `sitfwd`, and falling all the way
   * to `idle` for that is a person standing up in a café chair — the exact bug
   * the seated clips were added to fix. So it falls to the first name in its
   * own family first, and only then to standing.
   */
  function firstClip(f, ...names) {
    for (const n of names) if (f.clips && f.clips.includes(n)) return n;
    return names[names.length - 1];
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

  // ── how they have sat down ─────────────────────────────────────────────────
  //
  // 1.538.0 — see 43-settle.js. Everybody sitting is let go into their seat
  // once as a ragdoll, and the pose they settle into is laid over their clip
  // from then on (`f.settle`, the layer in 41-skin.js). The settler is handed
  // in by 43-jadrija.js, which is the file that knows what a chair is.
  //
  // THE SETTLE BELONGS TO THE PERSON AND THE LAYER TO THE MESH, the same
  // split `assign` makes for the clip clock: `fg.settled` is kept when a quay
  // sitter is demoted, and `f.sitL` is re-pointed at whoever the slot is
  // drawing now. A person promoted who has sat down before is sat down on the
  // first frame; one who has not is drawn in their clip until the settler
  // gets to them, and then eased into it over `SETTLE.fade` — somebody
  // settling back into a chair, if you happen to be looking.
  let settler = null;
  // And whoever has been knocked off it (43-topple.js), handed in the same way.
  let toppler = null;
  function sitLayer(fg, f, want, dt) {
    const S = fg.settled;
    let L = f.sitL;
    if (SETTLE.off || !S || S.failed || S.data !== f.data) {
      if ((!S || S.data !== f.data) && !SETTLE.off) settler.want(fg, f, want);
      if (L && L.on) { f.settle(null); L.on = false; L.who = null; }
      return;
    }
    if (!L) L = f.sitL = { q: null, t: null, w: 0, on: false, who: null, rate: 1 };
    if (L.who !== fg || !L.on) {
      L.who = fg; L.q = S.q; L.t = S.t; L.on = true;
      // Fresh: eased in. Sat down before: sat down already.
      L.w = S.fresh ? 0 : 1;
      L.rate = 1 / (S.fresh ? SETTLE.fade : SETTLE.swap);
      S.fresh = false;
      f.settle(L);
    }
    // Only over the clip it was measured against — anything else (a cued
    // `notice`) is played as it was authored, and the settle comes back after.
    const to = f.playing() === S.clip ? 1 : 0;
    if (L.w < to) {
      L.w = Math.min(to, L.w + dt * L.rate);
      if (L.w >= 1) L.rate = 1 / SETTLE.swap;
    } else if (L.w > to) L.w = Math.max(to, L.w - dt / SETTLE.swap);
  }

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
    // Their clothes, before anything else about them. A v2 figure is dyed per
    // person (see 42-bathers2.js), so a slot that changes hands has to change
    // outfits in the same frame — and a pinned one has to be dressed once, on
    // the first frame anybody draws it. `dressedFor` rather than `rebind`
    // because the pinned half of this tier is never rebound.
    if (f.dress && f.dressedFor !== fg) {
      f.dress(fg);
      f.dressedFor = fg;
    }
    // Their face — a blink, a grimace, a mouth that moves when they talk.
    // Here, above the toppler, because being hosed off a chair is the one
    // time a face matters most and the toppler returns before anything below.
    // See `bather2Face` in 42-bathers2.js; it does nothing past `FACE2.near`.
    if (f.morph) bather2Face(f, fg, dt, d2);
    if (fg.rebind) {
      fg.rebind = false;
      f.aim('head', 0, 1, 0, 0);
      // And the shoulders, which arrived with the greetings and are the same
      // hazard the head has always been: an aim is a delta left standing on a
      // MESH, and the mesh outlives whoever was on it. A slot handed over
      // mid-greeting with a turned chest is the next occupant sitting there
      // wrenched round at nothing until they happen to greet somebody
      // themselves. Same argument as `dropHold` in 43-jadrija.js.
      f.aim('chest', 0, 1, 0, 0);
      // Not the arms: `handsPose` takes its own last turns off whoever they
      // were laid for, and lays this person's.
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

    // ── KNOCKED OFF, and not theirs to draw ─────────────────────────────────
    //
    // 1.540.0 — see 43-topple.js. Somebody the hose has taken off their chair
    // is a ragdoll, and then a get-up, and for all of that the toppler places
    // and poses the mesh and nothing below may: not the clip they wanted, not
    // the settle, not the hands. A cue written on them meanwhile is dropped,
    // for the reason the cue block gives. Once they are standing it hands them
    // back (`draw` false) and they are drawn as whatever `fg.mode` says.
    if (fg.topple && toppler) {
      fg.cue = null;
      if (toppler.draw(fg, f, dt)) {
        fg.lag = 0;
        f.mesh.visible = true;
        return true;
      }
    }

    // ── something somebody has asked them to do ──────────────────────────────
    //
    // `fg.cue` is a clip by name, written from outside — `stepGreet` in
    // 43-jadrija.js, which is the half of a greeting that knows who is greeting
    // whom. A cue and not a mode, because it is over in a second or two and
    // then the person goes back to whatever they were doing: `next: want` is
    // the whole of the going back.
    //
    // CLEARED WHETHER OR NOT IT WAS PLAYED, and that is not tidiness. A person
    // on this beach is drawn by whichever tier is cheaper at the moment — see
    // `assign` — so a cue can be written on somebody who is a blob and never
    // reach a mesh at all. Left standing it would fire the next time they were
    // promoted, which could be a minute later and two hundred metres down the
    // shore, and what you would see is somebody waving at nobody. The
    // scheduler clears it at the end of the greeting too; this is the other
    // end of the same guarantee.
    if (fg.cue) {
      const nm = fg.cue;
      fg.cue = null;
      if (!midBiz(f) && f.clips && f.clips.includes(nm)) {
        f.play(nm, { fade: 0.22, next: want });
      }
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
        // Remembered, so the block below can tell a piece of business from a
        // greeting's wave. Only this one may be cut short.
        fg.bizClip = BIZ[(fg.seed * BIZ.length * 7) % BIZ.length | 0];
        f.play(fg.bizClip, { fade: 0.25, next: want });
      }
      fg.bizOn = g;
    }

    // ── AND IT IS CUT SHORT IF THEY START WALKING ────────────────────────
    //
    // The gate above starts a one-shot on somebody standing and then leaves
    // it to run, which was right while `BIZ` held one entry: `notice` is a
    // second long and never outlived the mode that began it. `stretch` is
    // seven and a half. Measured on the promenade: of five bathers mid-
    // routine, one was in `walk` and covered **1.9 m in 1.8 s** — a standing
    // leg-swing gliding down the deck, because `midBiz` holds the clip while
    // the step below goes on writing `fg.x`.
    //
    // The person decided to walk, so the business is over. Only `fg.bizClip`
    // is cancelled and never a cued clip: `fg.cue` carries a greeting's wave,
    // which `freeToGreet` in 43-jadrija.js is happy to hand to a walker, and
    // cutting that would break greetings on the move.
    if (fg.bizClip) {
      if (!midBiz(f)) fg.bizClip = null;
      else if (fg.mode !== 'stand' && fg.mode !== 'wade') {
        f.play(want, { fade: 0.25 });
        fg.bizClip = null;
      }
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
    // Sat down into their seat, or not sitting — see `sitLayer`.
    if (settler && fg.mode === 'sit') sitLayer(fg, f, want, dt);
    else if (f.sitL && f.sitL.on) { f.settle(null); f.sitL.on = false; f.sitL.who = null; }
    // And a quay sitter's legs out along the concrete, over their quay clip
    // and nothing else — see `legRestOf` in 43-settle.js. Written every time
    // they are drawn, because the mesh outlives whoever is sitting on it.
    const legs = fg.ground && fg.mode === 'sit' && QUAYED.includes(f.playing()) && f.legs
      ? legRestFor(fg, f) : null;
    if (legs || f.legsOn) { if (f.legs) f.legs(legs); f.legsOn = !!legs; }
    // The same head turn the instanced tier does in `pose`, and the same two
    // numbers written from outside — see the note there. `aim` is in figure
    // space, where +y is up, so an extra yaw about +y is exactly what
    // `f.mesh.rotation.y` already means and no offset has to be measured.
    //
    // Only touched while it is happening or on the frame it stops. `aim`
    // walks the bone list by name to find the head and there are twenty-eight
    // of them, which is nothing once and is thirty-two lookups a frame if it
    // is asked unconditionally for a crowd that is not being bumped.
    //
    // AND THE SHOULDERS WITH IT, which they were not until the greetings went
    // in. The instanced tier has carried its torso a third of the way round
    // with the head since the bump landed — see the note at the foot of `pose`
    // — and this tier had the neck and nothing else, which is the difference
    // between somebody turning to look at you and a head on a spindle. It was
    // survivable on a bump, where you are standing on their toes and the head
    // is all you are looking at. It is not survivable on a greeting, because
    // half the people greeting each other on this shore are sitting down and a
    // seated figure that cannot turn its shoulders cannot turn at all.
    //
    // Split 0.30 / 0.70 and not 0.30 / 1.00: `aims` compose down the chain, so
    // the head's own share is laid over a chest that has already gone 30 per
    // cent of the way and the total at the eyes is the full `lookY`. Which is
    // exactly what the instanced tier writes, and the two tiers draw the same
    // people.
    //
    // `chest` and not `neck`, and that is not a matter of taste either: the
    // phone solve owns `neck` — see `holdPhone` in 43-jadrija.js — and `aims`
    // keeps ONE rotation per bone. Twelve people on this beach are holding a
    // phone and every one of them can be greeted.
    if (fg.look || fg.aimed) {
      const a = fg.look ? fg.lookY * fg.look : 0;
      f.aim('head', 0, 1, 0, a * 0.70);
      f.aim('chest', 0, 1, 0, a * 0.30);
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
      // The hands — resting, greeting, fingers — immediately before the
      // update and nowhere else. `aim` writes a delta and `boneAt` reads the
      // palette, and the palette is only rebuilt by the line below — so a
      // solve on a frame the ladder skips would measure a pose that does not
      // yet carry the last solve and take the delta off a second time. Which
      // arm greets, and why the phone gets a say in it, is over `WAVE`.
      //
      // A slot that has just changed hands is posed once first: its palette
      // is still the last occupant's, and where THIS person's hands rest is
      // planned off the first pose they are measured in (`handPlan`).
      if (fg.rebound) f.update(0);
      if (fg.handGeo === undefined) {
        fg.handGeo = settler && settler.geo && fg.mode === 'sit' ? settler.geo(fg) : null;
      }
      handsPose(f, hands[i], fg, t, fg.lag, fg.handGeo);
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
    faceClock(dt);
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
    // And whoever is waiting to sit down, for `SETTLE.budget` ms at most.
    if (settler) settler.tick(cam);
    // The toppler's clock, which the hose's push leaks away against.
    if (toppler) toppler.tick(dt);
  }

  return {
    figures, flush, layers: [], kind: 'skin', slots, assign,
    /** Hand in the settler (43-settle.js); null takes it away. */
    setSettler: (s) => { settler = s || null; },
    get settler() { return settler; },
    /** Hand in the toppler (43-topple.js); null takes it away. */
    setToppler: (s) => { toppler = s || null; },
    get toppler() { return toppler; },
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

/**
 * Both hands flat on a counter — the shop staff's arms, SOLVED against the
 * counter they are standing at rather than typed as angles.
 *
 * Misha, 28 Sep 2026: *"the 2 dudes working at the slastikarnica, their
 * tummies are sticking out weirdly through the counters, and their hands are
 * in weird positions / their hands should probably just be palms down.. same
 * thing dude worker at cafe bar h2o, his hands are in that weird frankenstein
 * pose, it should just be palms down i think to look more natural."*
 *
 * The frankenstein was the typed pose outliving the body it was typed for.
 * `serve` held both arms up at 0.55 / 1.15 rad, which on the old tube rig put
 * a hand ON the counter — "shoulder 1.38, elbow 1.07, hand 0.79", measured
 * off that bake. The far tier draws the eight MakeHuman bodies now, and on
 * those the same two angles leave the forearm pointing up and out over the
 * counter with the hand edge-on and the fingers spread in the air: a hand
 * reaching for nothing, twice over, on every server on the shore.
 *
 * So the arms are an answer to a question now. `fg.counter` is where the
 * counter is — its top over this person's feet and its front edge forward of
 * them, both in world metres, both measured off the counter's own geometry
 * where the placement is (see `staffAt` in 43-jadrija.js). `counterPlan`
 * turns that once into a palm target and an elbow direction, and every frame
 * after that is a two-bone IK from wherever the shoulder has got to — so the
 * torso can sway, breathe and turn to the queue and the hands stay planted.
 *
 * ── the pose ─────────────────────────────────────────────────────────────
 *
 * Leaning on his forearms, which is what a man behind a bar-height counter
 * with nothing to do looks like: upper arms down at his sides, elbows back a
 * little, forearms along the top and angled in, palms flat. It is also the
 * only one of the natural answers this rig can draw. It has no wrist — hand
 * and forearm are one bone — so a palm is flat only when the FOREARM is,
 * and the classic straight-armed "hands on the bar" needs a ninety-degree
 * wrist that is not there: tried on paper, it puts the fingertips straight
 * down into the counter with the palm facing the shop.
 *
 * Level where the elbow can get down to the top, which is most of them; on a
 * tall man at a low counter it cannot, the upper arm hangs as far as it goes
 * and the forearm slopes to meet the top (MINI, 0.97 m over his feet, is the
 * one where that happens). The rest is keeping the hands ON the counter: the
 * counter is 0.34 m deep in front of a man standing behind its panel, and the
 * forearm and hand together are 0.43 to 0.52 m — so they angle inward until
 * the fingertips are inside the front edge, and stop short of crossing.
 *
 * ── the palm ─────────────────────────────────────────────────────────────
 *
 * `crowd_far.py` bakes the arms hanging with the palm to the thigh and the
 * thumb forward — measured off the bake, the hand's thin axis is lateral —
 * so the forearm's rest frame is (down, medial) and the solve maps it to
 * (along the forearm, the part of straight down perpendicular to it). That
 * is the whole of "palms down", and it is exact for a level forearm.
 */
const COUNTER = {
  // How far forward he leans at the waist, radians. The head has to clear
  // whatever hangs behind the counter — the slasticarnica's mirror is at
  // `s0 − 0.11` — from a man whose hips are now behind the panel.
  lean: 0.30,
  // Elbow to palm centre over shoulder to elbow. Off the three male bakes:
  // 1.31, 1.32 and 1.33.
  fore: 1.32,
  // Palm centre over the counter top, and the forearm at the elbow over the
  // palm; body metres. Half a hand's thickness, and a forearm that is a hair
  // off level so it rests on the top rather than sinking into it.
  palm: 0.018, elbow: 0.022,
  // Palm centre to fingertip, and how far inside the front edge the tips stop.
  tip: 0.09, inset: 0.04,
  // How far the forearms turn in, radians — and the closest the palms get to
  // the midline, so that two hands never go through each other.
  bMin: 0.20, bMax: 1.20, mid: 0.055,
  // Which way the elbow swings, mostly out and a little back, and the most
  // it swings. 0.9 rad puts it 0.2 m out from the shoulder.
  out: 0.95, back: 0.31, phiMax: 0.90,
  // How far over the top the shoulder may be, in upper arms, before he bends
  // his knees to bring it down — cos 0.55, a third of a radian of swing
  // left — and the most he bends them, body metres.
  level: 0.85, crouch: 0.15,
};
const _cS = new THREE.Vector3(), _cE = new THREE.Vector3();
const _cD = new THREE.Vector3(), _cN = new THREE.Vector3();
const _cB = new THREE.Vector3(), _cA = new THREE.Vector3();
const _cV = new THREE.Vector3();
const _cZ = new THREE.Vector3(0, 0, 1), _cDown = new THREE.Vector3(0, -1, 0);
const _cQp = new THREE.Quaternion(), _cQu = new THREE.Quaternion();
const _cQl = new THREE.Quaternion();
const _cM0 = new THREE.Matrix4(), _cM1 = new THREE.Matrix4();
const _cA0 = new THREE.Vector3(0, -1, 0), _cN0 = new THREE.Vector3();
const _cB0 = new THREE.Vector3();

/**
 * Where this figure's hand goes, and which way its elbow points, on one side
 * (`side` +1 is the right arm, which the bake puts at +z). Once per figure:
 * written against the neutral lean, in the figure's own unscaled frame —
 * x forward, y up from the feet — so the counter's world metres are divided
 * by the figure's scale on the way in.
 */
function counterPlan(f, fg, side) {
  const C = fg.counter, k = fg.scale || 1;
  const U = side > 0 ? f.armRU : f.armLU, L = side > 0 ? f.armRL : f.armLL;
  const u = L.position.length(), lf = u * COUNTER.fore;
  const top = C.top / k + COUNTER.palm;
  const edge = C.edge / k;
  // The shoulder with the lean on and nothing else.
  _cQu.setFromAxisAngle(_cZ, -COUNTER.lean);
  const S = new THREE.Vector3().copy(U.position).applyQuaternion(_cQu)
    .add(f.torso.position);
  S.x += f.pelvis.position.x; S.y += f.restY; S.z += f.pelvis.position.z;
  // AND A BEND AT THE KNEE for a tall man at a low counter, which is what a
  // tall man at a low counter does. Leaning on his forearms wants the elbow
  // down at the top with some swing left in the upper arm to take it out
  // sideways; with his shoulders more than `level` of an upper arm over the
  // top there is none, and the first build sloped his forearms instead and
  // pointed his fingers into the counter. Up to `crouch`, and nobody sees
  // the knees: they are behind the panel.
  const ey = top + COUNTER.elbow;
  const drop = Math.min(COUNTER.crouch, Math.max(0, S.y - ey - COUNTER.level * u));
  S.y -= drop;
  const thigh = f.legLL.position.length(), shin = Math.max(0.2, f.restY - thigh);
  const knee = Math.acos(Math.max(0.5, 1 - drop / (thigh + shin)));
  // The elbow, and the one free choice in this pose is how far out it goes.
  //
  // Out is what makes the room. The forearm and hand together are longer
  // than the counter is deep in front of him, so they have to lie across it
  // at an angle, and how far they can turn in is how far the elbow is from
  // his middle. A heavy man's short arms fit with the elbows at his sides;
  // a tall young man's do not, and put there they had their palms hanging
  // off the front edge in the air — the first build of this, photographed.
  //
  // So the swing is searched, from the elbow straight down to well out,
  // and the first one that fits is the one used: fingertips inside the
  // edge (`inset`), palms short of the midline (`mid`), and the elbow never
  // below the top it is resting on. Level forearms where the arm is long
  // enough to get the elbow down to the top; where it is not, the forearm
  // slopes to meet it, which costs the fingertips a few centimetres of
  // counter top and nobody at the counter can see them.
  const E = new THREE.Vector3();
  let sa = 0, ca = 1, cb = 1, sb = 0;
  for (let phi = 0; phi <= COUNTER.phiMax + 1e-6; phi += 0.025) {
    const sp = Math.sin(phi);
    E.set(S.x - u * sp * COUNTER.back, S.y - u * Math.cos(phi),
      S.z + side * u * sp * COUNTER.out);
    if (E.y < ey && phi < COUNTER.phiMax) continue;
    E.y = Math.max(E.y, ey);
    sa = Math.min(0.9, Math.max(0, E.y - top) / lf);
    ca = Math.sqrt(1 - sa * sa);
    cb = (edge - COUNTER.inset - E.x) / ((lf + COUNTER.tip) * ca);
    cb = Math.min(Math.cos(COUNTER.bMin), Math.max(Math.cos(COUNTER.bMax), cb));
    sb = Math.sqrt(1 - cb * cb);
    if (lf * ca * sb <= side * E.z - COUNTER.mid) break;
  }
  // Out of room anyway: keep the hands apart and let the tips overhang.
  const room = Math.max(0, side * E.z - COUNTER.mid);
  if (lf * ca * sb > room) {
    sb = room / (lf * ca);
    cb = Math.sqrt(Math.max(0, 1 - sb * sb));
  }
  const P = new THREE.Vector3(E.x + lf * ca * cb, E.y - lf * sa,
    E.z - side * lf * ca * sb);
  return { P, pole: E.sub(S), drop, knee };
}

/**
 * Put both hands on the counter: two-bone IK, shoulder to palm, bent toward
 * the planned elbow, then the forearm turned palm-down about its own length.
 * Everything is composed in the figure's root frame and handed back to each
 * joint as a local quaternion, so the torso's lean and sway are whatever the
 * pose above set them to and the arm simply answers them.
 */
function counterArms(f, fg) {
  if (!fg.counter) return;
  if (!fg.cArm || fg.cArmBody !== fg.body) {
    fg.cArm = [counterPlan(f, fg, 1), counterPlan(f, fg, -1)];
    fg.cArmBody = fg.body;
  }
  // The crouch goes on first, because the shoulder is measured off it.
  const cr = fg.cArm[0];
  if (cr.drop > 0) {
    f.pelvis.position.y -= cr.drop;
    f.legLU.rotation.z += cr.knee;
    f.legRU.rotation.z += cr.knee;
    f.legLL.rotation.z -= 2 * cr.knee;
    f.legRL.rotation.z -= 2 * cr.knee;
  }
  // The upper arm's parent frame: pelvis, then torso.
  _cQp.copy(f.pelvis.quaternion).multiply(f.torso.quaternion);
  for (const side of [1, -1]) {
    const U = side > 0 ? f.armRU : f.armLU, L = side > 0 ? f.armRL : f.armLL;
    const pl = fg.cArm[side > 0 ? 0 : 1];
    _cS.copy(U.position).applyQuaternion(f.torso.quaternion)
      .add(f.torso.position).applyQuaternion(f.pelvis.quaternion)
      .add(f.pelvis.position);
    const u = L.position.length(), lf = u * COUNTER.fore;
    _cD.copy(pl.P).sub(_cS);
    let d = _cD.length();
    _cD.divideScalar(d);
    d = Math.min(u + lf - 1e-3, Math.max(Math.abs(u - lf) + 1e-3, d));
    const a = (u * u - lf * lf + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, u * u - a * a));
    _cV.copy(pl.pole).addScaledVector(_cD, -pl.pole.dot(_cD)).normalize();
    _cE.copy(_cS).addScaledVector(_cD, a).addScaledVector(_cV, h);
    // The upper arm: the rest shoulder-to-elbow on to the solved one.
    _cA.copy(L.position).normalize();
    _cB.copy(_cE).sub(_cS).normalize();
    _cQu.setFromUnitVectors(_cA, _cB);
    U.quaternion.copy(_cQp).invert().multiply(_cQu);
    // The forearm: (down, medial) at rest on to (along it, palm down).
    _cD.copy(pl.P).sub(_cE).normalize();
    _cN.copy(_cDown).addScaledVector(_cD, -_cD.dot(_cDown));
    if (_cN.lengthSq() < 1e-6) _cN.set(1, 0, 0);
    _cN.normalize();
    _cB.crossVectors(_cD, _cN);
    _cN0.set(0, 0, -side);
    _cB0.set(side, 0, 0);
    _cM0.makeBasis(_cA0, _cN0, _cB0).transpose();
    _cM1.makeBasis(_cD, _cN, _cB).multiply(_cM0);
    _cQl.setFromRotationMatrix(_cM1);
    L.quaternion.copy(_cQu).invert().multiply(_cQl);
  }
}

/**
 * A crowd: everybody drawn by the instanced tier, on a set of bodies.
 *
 * `bodies` is `loadCrowdBodies(sex)` — one instanced layer and one scratch
 * skeleton each — and `fg.body` says which a person is drawn with.
 * `figures` is the caller's to fill and to move: this end owns posing and
 * drawing and knows nothing about where anybody is going, which is how the
 * promenade logic stays in 43-jadrija.js where it belongs.
 */
function makeCrowd(scene, bodies, cap) {
  // One layer — one draw — per body, and one scratch skeleton per body with
  // that body's own joints in it. `fg.body` says which a person is; see
  // `crowdBody`, which is what sets it.
  const layers = bodies.map((b) => crowdBodyLayer(scene, b, cap));
  const skels = bodies.map((b) => rigSkeleton(b));
  // Re-pointed at the right body before every `pose`, which is written
  // against `skel` and does not need to know there is more than one.
  let skel = skels[0];
  const kinds = bodies.map((b) => b.kind);
  const figures = [];
  /**
   * The frame everybody in this crowd is placed in, or null for the world.
   *
   * Set for the length of one `flush` and read by `pose`. Null is every crowd
   * on the shore: a beach does not move, so `fg.x/y/z` are world metres and the
   * scratch skeleton's root matrix *is* its world matrix.
   *
   * A boat is the other case, and it is the reason this exists. See the header
   * of 60-pax.js: her deck heels and trims off the Gerstner surface every frame
   * and everything on her is a child of a group that carries that, so a
   * passenger placed in world metres would stand in the sea while she sailed
   * out from under them. With a frame the figure is posed in HER metres —
   * x forward, z to starboard, y off `deckAt` — and the boat's own world matrix
   * is composed on the outside of it, which is exactly what being aboard means.
   */
  let frame = null;
  const _inv = new THREE.Matrix4();
  const _cl = new THREE.Vector3();

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
    // The other two whole-figure rotations, and they exist for the same reason
    // `tip` does: the root is shared, so anything written on it has to be
    // written EVERY time or the last sunbather's roll is on the next ninety
    // people. Nought for everybody who is not lying down — see the write at
    // the bottom of this function, where `x + 0` is `x` to the last bit.
    //
    // `spin` is a half turn added to the bearing and `roll` a rotation about
    // the figure's own long axis, which for somebody laid over is the axis
    // running head to heel. Three.js composes the root as Ry·Rx·Rz, so `tip`
    // happens first in the figure's own frame, `roll` then turns the tipped
    // body about world X — which the tip has just made the body's long axis —
    // and the yaw aims the result. That ordering is the whole reason a roll
    // can be one number here rather than a re-derivation of eleven joints.
    let spin = 0;
    let roll = 0;
    // And how far to lift the whole figure off the deck, in metres. A body
    // rolled onto its shoulder is deeper than a body flat on its back, and the
    // rotation is about a line that runs through the middle of it, so without
    // this the shoulder goes through the towel.
    let lift = 0;
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
        //
        // About 14 cm on the old tube rig; on a real body it is the depth of
        // the thigh under the joint, measured per body by the bake — see
        // `sitY` in `rigSkeleton`.
        skel.pelvis.position.y = skel.sitY;
        // AND HOW FAR THE SOLES ARE UNDER THE SEAT, which is the one thing
        // about this pose that is a property of the seat and not of the person.
        //
        // Everything above is measured for the lip of the lowest platform: the
        // hip 0.14 m over the slab, the thighs level, the shins plumb, and the
        // feet 0.318 m below the slab hanging over water, where nothing is
        // waiting to be stood on. Put the same pose on a BENCH — 0.49 m over
        // its own sole, which is what both of the Brod's are — and the feet
        // stop 0.17 m short of the deck, which from two metres is a row of
        // people sitting in mid-air.
        //
        // `fg.thigh` is the delta that answers it, and it goes on the thigh
        // rather than on the hip: raising the hip lifts the whole figure off
        // the plank, while dropping the knee lets the leg reach further down
        // without moving the part of them that is actually on the seat. The
        // shin takes the same delta back, so the shank stays as near plumb as
        // it was and the feet come down under the knee instead of swinging
        // forward. See `PAX_THIGH` in 60-pax.js for the solve.
        //
        // Zero for everybody on the shore, and `x + 0` is `x`, so the beach is
        // untouched to the last bit.
        const dth = fg.thigh || 0;
        skel.legLU.rotation.z = 1.55 + dth;
        skel.legRU.rotation.z = 1.52 + dth;
        // Same clock per figure and the same complaint answered as in the
        // standing case below: two people sitting on a quay do not swing their
        // legs in time with each other, and a pair of shins moving through five
        // degrees is a pair of shins that is not moving.
        const sr = 0.70 + fg.seed * 0.70;
        skel.legLL.rotation.z = -1.50 - dth + Math.sin(ph * 0.62 * sr) * 0.19;
        skel.legRL.rotation.z = -1.46 - dth + Math.sin(ph * 0.55 * sr + 2.1) * 0.17;
        // EXCEPT ON THE QUAY, where nobody's shins hang over anything: the
        // quay sitters sit side-on to the water on the flat of the lowest
        // platform, and the pose above put both shins 0.3 m down into it —
        // *"their legs should be on the cement"* (Misha, 28 Sep 2026). So
        // their shins go on along the thighs and down to the heel
        // (`shinDrop`), still: legs lying on concrete do not swing. The same
        // legs the near tier lays out, from fifty metres.
        if (fg.ground) {
          skel.legLL.rotation.z = -skel.shinDrop;
          skel.legRL.rotation.z = -skel.shinDrop;
        }
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
        // AND HOW THEY HAVE SAT DOWN, which up close is a ragdoll's settle
        // (43-settle.js) and from here is its two biggest numbers — how far
        // their back has rounded and their head gone forward — out of the same
        // hand of cards (`settleLean`, off the seed), so a quay sitter with
        // their head down on their chest at two metres still has it down when
        // you have walked fifty away. Worked out once a person and kept.
        if (fg.lean == null) {
          const L = settleLean(fg, false);
          fg.lean = L.slouch * 0.8;
          fg.leanH = L.drop * 0.7;
          fg.leanT = L.tilt * 0.6;
        }
        skel.torso.rotation.z += fg.lean;
        skel.head.rotation.z += fg.leanH;
        skel.head.rotation.x += fg.leanT;
        break;

      case 'lie': {
        // Somebody lying down, and there are as many ways of doing that as
        // there are people doing it.
        //
        // The tip is one rotation of the whole figure rather than something
        // spread through the joints: a reclining figure is a standing figure
        // laid over and then bent a little, and doing it the other way round
        // means re-deriving eleven joints for one pose.
        //
        // ── WHAT WAS HERE, AND THE TWO THINGS WRONG WITH IT ─────────────────
        //
        // ONE POSE, TO THE MILLIMETRE. Every value below used to be a literal
        // and the only term with a clock in it was `sin(ph * 0.3) * 0.02` on
        // one thigh — 1.1 degrees, on a limb 0.43 m long, which is four
        // millimetres of knee. Measured off the drawn instance buffers rather
        // than argued about: the mean pairwise difference between two people
        // lying on this beach, over the offsets of head, trunk, elbows and
        // knees from the hip and with height divided out, was 0.002 m. The
        // standing crowd measures 0.176 and the walkers 0.283. Nine sunbathers
        // were the same statue stamped out nine times, and the fact that they
        // were also motionless is the smaller half of it.
        //
        // AND THE TRUNK LEANED THE WRONG WAY. `torso.rotation.z = 0.58` with
        // a note over it claiming that lifted the head. It does not. The
        // convention at the top of this file — "a joint's rotation.z swings
        // its far end toward +X" — is written for a limb, and a limb hangs
        // DOWN; the trunk and the head point UP, so Rz(θ) takes (0,1,0) to
        // (−sin θ, cos θ, 0) and a POSITIVE z leans them BACKWARD. Face up,
        // backward is into the ground. The same mistake is written up at
        // length in the `serve` case below, where it was found and fixed; it
        // was never carried back here.
        //
        // The arithmetic, and then the photograph. Trunk pivot 0.10 above the
        // hip, neck 0.50 above that: at z = +0.58 the neck lands at local
        // (−0.274, +0.518), which the tip lays down as 0.518 m toward the head
        // and 0.274 m BELOW the hip. Read straight off the instance buffers as
        // (−0.526, −0.276) — the head end of every sunbather on this shore was
        // a quarter of a metre under the towel it was lying on. Photographed
        // at t 513.6 from 83 m with a 4° lens: a red swimsuit on a red towel
        // and no head anywhere in the frame. The arms went the same way for
        // the same reason, at −0.26 on both shoulders.
        //
        // ── AND WHAT THE SURVEY ACTUALLY SHOWS ──────────────────────────────
        //
        // 20260821_175413 is one figure on one towel on the promenade slab and
        // it is worth the whole of this rewrite: she is FACE DOWN, propped on
        // her forearms, with both knees bent so the shins stand in the air and
        // the ankles crossed. The old note here said face down was "what
        // nobody does". 20260821_175924 has three more under the pines — one
        // on her back with an arm thrown up past her head, one curled on her
        // side, one face down with her head on her folded arms — and not one
        // of the four is the pose this case used to draw.
        //
        // Counted over 175413, 175924, 175838 and 175408, about eleven people
        // lying down: six on their backs, three face down, two on their sides.
        // Which is the split below, and it is the reason face down is a
        // quarter of this beach rather than a novelty.
        //
        // Every number off `crowdJit(fg.seed …)`. Rule 4: no draw off `rng`,
        // and the seed a figure was given at build time is the way that person
        // lies for the whole session — a beach where somebody re-chooses their
        // posture on a frame boundary is a beach of people flinching.
        const hk = (k) => crowdJit(fg.seed * 1024 + 3, k);
        const h1 = hk(11), h2 = hk(23), h3 = hk(37);
        const h4 = hk(53), h5 = hk(71), h6 = hk(97);

        // FACE UP OR FACE DOWN, and the pair of rotations that makes the
        // second one possible without moving anybody.
        //
        // +π/2 about Z takes local +X — the front of the body — to world up,
        // which is a sunbather on her back, and it puts the head along local
        // −X, the OPPOSITE of the bearing the figure was placed with. That is
        // why 43-jadrija.js aims these seaward to get a head that ends up
        // inland, and it is the constraint the prone case has to satisfy too:
        // −π/2 on its own turns her over AND swaps her end for end, so her
        // feet would be on the backrest and her head off the seaward end of
        // the lounger.
        //
        // A half turn of the bearing puts them back. Ry(y+π)·Rz(−π/2) takes
        // (0,1,0) to (−cos y, 0, sin y), which is exactly where Ry(y)·Rz(+π/2)
        // takes it — the same head, in the same place, on the same towel — and
        // it takes the body's front (1,0,0) to (0,−1,0), which is the ground.
        // Unless the place says which (`fg.prone`, the mole's towels), and
        // then the near tier says the same — see `wantClip`.
        const prone = fg.prone != null ? !!fg.prone : h1 > 0.74;
        tip = prone ? -Math.PI / 2 : Math.PI / 2;
        spin = prone ? Math.PI : 0;

        // ON THE SIDE. One rotation about the body's own long axis, for the
        // same reason the tip is one rotation: a person on their side is a
        // person on their back rolled over, not eleven joints re-solved.
        //
        // Two in eleven of the survey's figures are on their side, and the
        // rest still get a few degrees of it — nobody lies perfectly square to
        // the ground, and a beach where everybody does reads as a morgue.
        //
        // The lift is not optional. The roll is about a line through the
        // middle of the body — the tip leaves the pelvis at root height — so a
        // shoulder swung down goes through the towel. The trunk is 0.28 m
        // front to back and 0.34 m across, so rolling it through 65° trades
        // 0.14 m of half-depth for 0.17 m and puts 0.07 m of shoulder under
        // the concrete. `0.075·|sin roll|` buys it back and is nought for
        // everybody lying flat.
        const side = h2 > 0.81;
        roll = side ? (h3 < 0.5 ? -1 : 1) * (0.72 + h4 * 0.44)
          : (h3 - 0.5) * 0.34;
        lift = Math.abs(Math.sin(roll)) * 0.075;

        // How far the chest is lifted off the ground, and the sign that is the
        // whole of the bug above: away from the ground is BACKWARD when face
        // up and FORWARD when face down, so the same number serves both with
        // the tip's sign on it.
        //
        // Face up it runs from flat on the towel to propped on the elbows or
        // on a lounger's backrest, which climbs over the last half-metre of
        // one. Face down the range is smaller and starts higher: nobody lies
        // on their front completely flat for long, and 175413 is propped.
        //
        // The clock in it is a breath, at about eleven a minute. Two
        // hundredths of a radian is 1.5 cm at the shoulder, which is nothing
        // at fifty metres and is the difference between a person asleep and a
        // prop at five.
        const rate = 0.70 + fg.seed * 0.70;
        const breath = Math.sin(ph * 0.62 * rate) * 0.020;
        const prop = (prone ? 0.30 + h5 * 0.34 : h5 * 0.62) + breath;
        const sgn = prone ? 1 : -1;
        skel.torso.rotation.z = sgn * prop;

        // ── the business, which for somebody lying down is a shift ──────────
        //
        // Not a wave and not a stretch: the whole point of these people is
        // that they are the still part of the beach. But nobody holds one
        // position for an afternoon, and `act` is the couple of seconds in
        // every seventy-odd where a knee comes up, the head goes over to the
        // other side and the near arm moves. Same shape as the standing case's
        // — off the figure's own clock, so no two of them do it together.
        const act = sat((Math.sin(ph * 0.115 * rate + fg.seed * 5.7) - 0.86)
          / 0.10);

        // THE HEAD. Turned to one side, which is what a head resting on
        // something does, and over to the other side when the shift comes.
        // `rotation.z` carries the tip's sign for the reason the trunk does:
        // positive lifts the chin away from the body's front.
        skel.head.rotation.z = sgn * (prone ? 0.10 + prop * 0.55
          : -0.06 - prop * 0.28);
        skel.head.rotation.y = (h6 - 0.5) * 0.92 * (1 - act * 2)
          + Math.sin(ph * 0.09 * rate) * 0.10;

        // THE LEGS, and they are the loudest thing in a silhouette that is
        // otherwise a bar 1.7 m long.
        //
        // Face up: the hip lifts the knee into the air and the knee then folds
        // the shin back down to the deck, so the foot ends up flat and the leg
        // is a triangle standing off the towel. `1.55` is what returns the
        // shin: thigh at +k points (sin k, −cos k) in body space and the shank
        // at k − 1.55k is back below the knee.
        //
        // Face down: no hip at all — flexing it face down drives the thigh
        // through the ground — and the knee alone, which swings the shin
        // toward the body's back, which is now the sky. That is 175413 exactly.
        //
        // The two legs get separate hashes. One knee up and one flat is the
        // commonest thing on this beach and it cannot happen if both legs read
        // the same number.
        const kL = prone ? 0 : (hk(131) > 0.55 ? 0.55 + hk(151) * 0.72 : 0.10);
        const kR = prone ? 0 : (hk(173) > 0.62 ? 0.50 + hk(191) * 0.75 : 0.06);
        const bL = prone ? -(0.70 + hk(131) * 0.80) : -(0.20 + kL * 1.55);
        const bR = prone ? -(0.62 + hk(173) * 0.86) : -(0.14 + kR * 1.55);
        skel.legLU.rotation.z = kL + act * 0.42;
        skel.legRU.rotation.z = kR;
        skel.legLL.rotation.z = bL - act * 0.60;
        skel.legRL.rotation.z = bR;
        // And a splay, because two legs lying dead parallel is a mannequin in
        // a shop window. Off the same two hashes so a bent leg falls outward.
        skel.legLU.rotation.x = (hk(151) - 0.35) * 0.20;
        skel.legRU.rotation.x = (hk(191) - 0.65) * 0.20;

        // ── THE ARMS ───────────────────────────────────────────────────────
        //
        // Face down there is only one thing to do with them and it is what
        // holds the chest up: the upper arm down to the deck and the forearm
        // forward along it. Solved rather than guessed — the upper arm wants
        // to point mostly at the ground and a little toward the head, which is
        // (0.86, 0.51) in body space and so 2.05 rad at the shoulder, and the
        // forearm wants to lie flat pointing at the head, which is π in total
        // and so 1.05 at the elbow. `fold` brings the hands in under the chin
        // instead, which is the third figure in 175924.
        //
        // Face up, three habits and they are independent per arm: down at the
        // side, out on the towel, or thrown up past the head. The last is the
        // one that reads at distance — an arm at 2.35 at the shoulder points
        // up and over the crown, and with 0.9 at the elbow the forearm comes
        // back down almost along the deck above the head.
        const armOf = (u, l, s, ha, hb) => {
          if (prone) {
            const fold = ha > 0.55;
            u.rotation.z = fold ? 2.28 : 2.05;
            l.rotation.z = fold ? 1.52 : 1.05;
            u.rotation.x = s * SPLAY * (fold ? -1.1 : 2.2);
            l.rotation.x = 0;
            return;
          }
          if (ha > 0.76) {                       // up past the head
            // AND FLAT, WHICH IS THE NUMBER THIS TURNS ON. π at the shoulder
            // lays the upper arm along the deck pointing at the crown —
            // Rz(θ)(0,−1,0) is (sin θ, −cos θ) and at π that is (0, 1), which
            // the tip lays down as "toward the head, level". 2.20 was the
            // first cut and it puts the elbow 0.81 of an upper arm toward the
            // body's FRONT, which face up is 0.26 m in the air: a lying figure
            // with a limb standing straight out of it, which is a thing nobody
            // in the survey is doing and which reads at eighty metres as a
            // mast. 2.72 to 3.06 keeps the elbow inside 0.09 m of the deck.
            u.rotation.z = 2.72 + hb * 0.34;
            l.rotation.z = 0.22 + hb * 0.42;
            u.rotation.x = s * SPLAY * (0.8 + hb * 1.2);
          } else if (ha > 0.36) {                // out on the towel
            // The spread is `rotation.x` and it costs nothing to be generous
            // with: the tip is about Z and leaves Z alone, so lateral stays
            // lateral and an arm spread this way slides across the towel
            // rather than lifting off it. 25° to 44° from the body, which is
            // what an arm lying loose beside somebody actually does.
            u.rotation.z = -0.04 + hb * 0.20;
            l.rotation.z = 0.12 + hb * 0.30;
            u.rotation.x = s * SPLAY * (4.0 + hb * 3.0);
          } else {                               // down beside the hip
            u.rotation.z = 0.02 + hb * 0.14;
            l.rotation.z = 0.10 + hb * 0.22;
            u.rotation.x = s * SPLAY * (0.7 + hb * 0.9);
          }
        };
        armOf(skel.armLU, skel.armLL, 1, hk(211), hk(233));
        armOf(skel.armRU, skel.armRL, -1, hk(257), hk(277));
        // The near arm moves with the shift. On the shoulder rather than the
        // elbow, for the reason the greeting gives at the bottom of this
        // function: the shoulder carries the forearm with it.
        skel.armRU.rotation.z += act * 0.55;
        skel.armRL.rotation.z += act * 0.30;
        break;
      }

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

        // ── THE ARMS ARE SOLVED NOW, and the typed ones are gone ──────────
        //
        // This block used to hold the elbows up at 0.55 / 1.15 and swing them
        // through four pieces of business — a bow into the case, a hand across
        // to the queue, a turn to the machine, a cup set down. Every one of
        // those numbers was measured against the old tube rig, and on the
        // MakeHuman bodies the far tier draws now they came out as two
        // forearms up in the air with the fingers spread: the frankenstein
        // Misha reported on 28 Sep. Both hands are flat on the counter
        // instead, from `counterArms` below the switch — see `COUNTER`.
        //
        // The businesses survive as what the BODY does, because that is what
        // still reads with the hands planted: the bow is a lean further in
        // with the head down, the pass is the head up and round to the
        // queue, the machine is a turn from the waist. Smaller than they were
        // — a torso cannot swing 0.62 rad over two hands that do not move.
        let hy = Math.sin(ph * 0.27 * rate) * 0.30
          + Math.sin(ph * 0.58 * rate + 1.1) * 0.11;
        // The lean, and the chin brought back up by most of it so that he
        // looks across the counter rather than into it. See `COUNTER.lean`.
        let tz = -COUNTER.lean + Math.sin(ph * 0.21 * rate) * 0.015;
        let hz = COUNTER.lean * 0.75;
        let ty = Math.sin(ph * 0.27 * rate) * 0.06;
        if (!bar) {
          tz -= dig * 0.08;
          hz -= dig * 0.30;
          hy = hy * (1 - dig) + dig * 0.25;
          hy = hy * (1 - pass) - pass * 0.35;
          hz += pass * 0.04;
          ty -= pass * 0.05;
        } else {
          ty -= pull * 0.18;
          hy = hy * (1 - pull) - pull * 0.55;
          hz -= pull * 0.10;
          tz -= set * 0.06;
          hy = hy * (1 - set) + set * 0.10;
          hz -= set * 0.22;
        }

        skel.torso.rotation.z = tz;
        skel.torso.rotation.y = ty;
        skel.torso.rotation.x = -w * 0.045;
        skel.head.rotation.z = hz;
        skel.head.rotation.y = hy;
        // Last, because it answers everything above: the shoulder is wherever
        // the lean and the sway have put it this frame.
        counterArms(skel, fg);
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

    // ── and a hand up to whoever it is ────────────────────────────────────────
    //
    // The other half of a greeting, on the tier that has no clips. `fg.gArm`
    // is the weight and `fg.gArmL` which side, both written by `stepGreet` in
    // 43-jadrija.js — the same two figures, greeting each other, are drawn by
    // whichever tier is cheaper at the moment and neither of them may be this
    // one. The skinned tier answers the same two fields with the solve at the
    // top of this file; this is what the same gesture looks like when the
    // person is four pixels of tapered box.
    //
    // After the switch, for the reason the look above is: four of the six poses
    // write the arms from their own clock and one of them — `stand` — has a
    // piece of business that shakes a towel out with both of them.
    //
    // THE RAISE GOES IN `rotation.x` AND NOT IN `rotation.z`, and that is the
    // one thing about this that is not obvious. Three.js composes XYZ as
    // Rx·Ry·Rz, so `z` is applied FIRST and swings a hanging arm forward in
    // the sagittal plane; the lateral `x` then acts on what is left of the
    // vertical, which past forty degrees of z is almost nothing. Raising with
    // z gives an arm pointing forward at the sea, which is a man reaching for
    // something. `x` alone takes (0,−1,0) to (0, −cos x, −sin x), so 1.94 rad
    // is twenty-one degrees ABOVE horizontal and 0.89 out to the figure's own
    // left — an elbow at shoulder height, out to the side, which is the shape
    // the eye reads as a wave from a silhouette four pixels wide. The 0.30 of
    // z left in it is the forward lean that keeps it off the shoulder blade.
    //
    // Same numbers as `WAVE` up at the top of this file, which is the solved
    // version the skinned tier uses. They are the same gesture at two levels
    // of detail and they have to agree, because one person is drawn by both
    // over the course of one walk down the promenade.
    //
    // The sweep is on the UPPER arm and not the elbow, which is the other
    // thing that was got wrong first. `rotation.x` on the elbow swings the
    // forearm about its own root and moves the hand by 0.055 m; on the
    // shoulder it carries the forearm with it and moves the hand by 0.10. Half
    // of that back on the elbow keeps the forearm from going along for the
    // whole ride, which is a wave rather than a windscreen wiper.
    if (fg.gArm > 0) {
      const g = fg.gArm;
      // 2.2 Hz. Off `t` and the seed rather than off the greeting's own clock,
      // so that two people waving at each other are not waving in step.
      const sw = Math.sin(t * 13.8 + fg.seed * 6.283) * 0.26;
      const U = fg.gArmL ? skel.armLU : skel.armRU;
      const L = fg.gArmL ? skel.armLL : skel.armRL;
      const sd = fg.gArmL ? 1 : -1;
      U.rotation.z = U.rotation.z * (1 - g) + 0.30 * g;
      U.rotation.x = U.rotation.x * (1 - g) + sd * (1.94 + sw) * g;
      L.rotation.z = L.rotation.z * (1 - g) + 0.18 * g;
      L.rotation.x = L.rotation.x * (1 - g) + sd * (0.95 - sw * 0.5) * g;
      // The shoulder rides up with the arm. Two centimetres, and it is the
      // difference between an arm on a person and an arm on a hinge.
      skel.torso.rotation.z -= g * 0.05;
    }

    skel.root.position.set(fg.x, fg.y + lift, fg.z);
    // Written in full every time, never touched in part. YXZ order, so the tip
    // happens in the figure's own frame and the yaw then aims the result.
    skel.root.rotation.set(roll, fg.yaw + spin, tip);
    skel.root.scale.setScalar(fg.scale);
    if (!frame) { skel.root.updateMatrixWorld(true); return; }
    // The four lines `updateMatrixWorld(true)` is, with the parent it does not
    // have. Three.js would do this for nothing if the scratch skeleton were a
    // CHILD of the boat — but the skeleton is shared by every figure this crowd
    // draws, and a crowd that has to be re-parented per figure is a crowd that
    // can only ever be in one place. A matrix passed to `flush` costs one
    // multiply per person and leaves the same crowd able to hold people on a
    // beach and people on a moving deck at once.
    //
    // Nothing downstream has to know: `flush` decomposes the joint world
    // matrices into position, quaternion and scale exactly as before, and the
    // composition is exact because a boat carries rotation and translation
    // only — no shear and no scale for the decompose to lose.
    skel.root.updateMatrix();
    skel.root.matrixWorld.multiplyMatrices(frame, skel.root.matrix);
    for (const c of skel.root.children) c.updateMatrixWorld(true);
  }

  let drawn = 0;
  let sized = -1;

  /**
   * Pose everybody in range and hand the transforms to the GPU.
   *
   * `fr` is the optional frame — see the note over `frame` above. The range
   * test has to go with it: `fg.x/fg.z` are metres in whatever frame the crowd
   * is placed in, and a passenger two metres from the camera is at x 1.4, z 2.3
   * in the boat's, which against a camera at world (-1596, 343) is two
   * kilometres away and culled. So the camera comes into the frame instead of
   * the crowd going out of it — one inverse a flush rather than one transform
   * a head.
   */
  function flush(t, cam, fr) {
    frame = fr || null;
    if (frame) cam = _cl.copy(cam).applyMatrix4(_inv.copy(frame).invert());
    let n = 0;
    for (const L of layers) L.n = 0;
    // Who is on which body is settled once the caller has filled `figures`,
    // and this is the first moment that is known — see `crowdRows`.
    if (figures.length !== sized) {
      sized = figures.length;
      const per = new Int32Array(layers.length);
      for (const fg of figures) per[fg.body > 0 && fg.body < layers.length ? fg.body : 0]++;
      layers.forEach((L, i) => crowdRows(L, Math.max(1, per[i])));
    }
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
      const bi = fg.body > 0 && fg.body < layers.length ? fg.body : 0;
      const L = layers[bi];
      skel = skels[bi];
      pose(fg, t);
      // Eleven joints, each as world-from-bind: the joint's world matrix with
      // the joint's own bind position taken off the far side, which is the
      // whole of the inverse bind for a skeleton whose rest has no rotation in
      // it. Written as the three rows of a 3x4 — `GLSL_CROWD` dots each with
      // the vertex — straight into this person's row of the layer's texture.
      const r = L.n++;
      // Somebody moved body since the texture was sized: grow it, keeping
      // the rows already written this frame.
      if (r >= L.rows) crowdRows(L, L.rows * 2);
      const bind = L.body.bind;
      const D = L.data;
      for (let j = 0; j < skel.joints.length; j++) {
        const e = skel.joints[j].matrixWorld.elements;
        const b = bind[j];
        const o = (r * L.W + j * 3) * 4;
        for (let row = 0; row < 3; row++) {
          const a0 = e[row], a1 = e[row + 4], a2 = e[row + 8];
          D[o + row * 4] = a0;
          D[o + row * 4 + 1] = a1;
          D[o + row * 4 + 2] = a2;
          D[o + row * 4 + 3] = e[row + 12] - (a0 * b[0] + a1 * b[1] + a2 * b[2]);
        }
      }
      for (const [a, c] of [[L.aColor, fg.skin], [L.aSuit, fg.suit],
        [L.aHair, fg.hair]]) {
        a.array[r * 3] = c[0]; a.array[r * 3 + 1] = c[1]; a.array[r * 3 + 2] = c[2];
      }
      // A t-shirt, and it is paint rather than a garment: the vertices the
      // bake bound to the trunk take this colour instead of skin or
      // swimwear (FR_CROWD in 30-material.js). It deforms with the ribcage,
      // which is the reason it is paint and not a box over the chest.
      const sh = fg.shirt;
      L.aShirt.array[r * 4] = sh ? sh[0] : 0;
      L.aShirt.array[r * 4 + 1] = sh ? sh[1] : 0;
      L.aShirt.array[r * 4 + 2] = sh ? sh[2] : 0;
      // And the other thing the trunk can be told: bare. `fg.top` 1 is a top
      // taken off, and the same fourth channel carries it as −1 — the
      // swimwear the bake bound to the torso joint is drawn in her own skin
      // colour, which on a bikini is the top and on a one-piece is a suit
      // rolled down to the waist. Asked of THIS layer's body and nothing
      // else (`TOPS_KINDS`), so a child is never drawn so whatever `fg`
      // says. `top` 2 — undone, lying on her front — is not drawn here: from
      // the distance this tier draws at it is the same back either way.
      L.aShirt.array[r * 4 + 3] = sh ? 1
        : fg.top === 1 && TOPS_KINDS.has(L.body.kind) ? -1 : 0;
      n++;
    }
    for (const L of layers) {
      const was = L.geo.instanceCount;
      L.geo.instanceCount = L.n;
      if (!L.n && !was) continue;
      L.tex.needsUpdate = true;
      L.aColor.needsUpdate = L.aSuit.needsUpdate = L.aHair.needsUpdate = true;
      L.aShirt.needsUpdate = true;
    }
    drawn = n;
  }

  return {
    figures, layers, flush, kind: 'inst',
    /** Which body each layer is — `fg.body` indexes this. See `crowdBody`. */
    kinds,
    /** Everybody this tier is answerable for right now. See `tierCount`. */
    live: () => figures.filter((fg) => !fg.hidden),
    /**
     * How tall a person on this tier stands at scale 1. Every body is baked
     * to the same stature (`H0` in crowd_far.py — the old rig's 1.696, kept
     * so nobody on the beach changed height), so any one of them answers.
     * The bake's number and not a top vertex: a decimated crown can end a few
     * millimetres either side of it, and the near tier is scaled off this.
     */
    height: bodies.length ? (bodies[0].meta.stature || bodies[0].height) : 1.696,
    /** Triangles a person, at most — the bodies differ by a few. */
    tris: bodies.reduce((a, b) => Math.max(a, b.tris), 0),
    get drawn() { return drawn; },
    /**
     * Register every layer with the shadow pass. Not the shared instanced
     * depth material: a person's shape here is in the joint texture, and the
     * caster has to be handed it too — see `CROWD_CASTER_VERT`.
     */
    cast: (shadow) => layers.map((L) => shadow.cast(L.mesh, {
      near: true,
      material: shadow.casterMaterial(CROWD_CASTER_VERT,
        { uCrowdBones: L.uCrowdBones }),
    })),
  };
}
