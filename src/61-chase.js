// -----------------------------------------------------------------------------
// The swim out to the skakaonica, and the person already ahead of you.
//
// Every other mode in this game is you against a fire, a machine or the water.
// This one is you against somebody who is better at it than you are, which is
// the oldest thing that happens on a beach: she is on the end of the jetty, she
// goes in, and by the time you are in the water she has a seven-metre lead on a
// hundred-and-fifty-metre swim to the platform.
//
// Three decisions are worth writing down.
//
// It is not a phase. `state.phase` stays `swim` the whole way through, and the
// chase is a layer over the top of it — the same water, the same breath bar, the
// same arms. A separate phase would have meant a second copy of every one of
// those and a second set of ways for them to disagree; what a race actually adds
// is one other swimmer, a gap, and a reason to press Q.
//
// She is beatable but not by drifting. Her cruise is 1.42 m/s against your 1.15,
// so at a steady crawl the gap opens the whole way and you lose. Sprint is 2.00
// and costs you nothing but distance under water, so the race is: hold the
// sprint, breathe, and do not let the gap past about fifty metres. And she has
// a tail — get inside four metres and she finds another fifth of a knot, which
// is what anybody does when they hear you coming.
//
// And she is built here rather than posed off the crowd rig. The rig has
// twenty-two clips and not one of them is a swim — see the note at the top of
// 60-arms.js, which reached the same wall from the other side and solved it the
// same way. What you actually see of a swimmer ahead of you is a back, two arms
// coming over, a pair of heels and a wake, all of it half in the water at ten to
// forty metres, and that is what this builds.
//
// ── 1.556.0: Baye v2.0, all the way to the ladder, and up it ──────────────────
//
// Misha, 1 Oct 2026: *"for the 'R' swim sequence, can u replace the old v1.0
// baye with the latest v2.0 baye? ... the baye however still swims half way to
// the trampuline, erroneously thinking she is done, but really she should swim
// all the way to the real location of the trampouline, and once she reaches
// it ... she should go up the trampoline, just like our diver, and execute a
// beautiful jump ... maybe pick from a repertoire of like 4-6 different jumps,
// it's sort of her showing off ... she should wear a bikini and her hair should
// be neatly tied.. maybe u can add cute goggles to her that she can wear and
// then take them off once she goes up climbing"*.
//
// Four things changed, and each is written down where it lives:
//
//   HER. This was the last place v1.0 was drawn. She is `baye2.fr3d` now —
//   the photographic skin, the face, the lids and the jaw — loaded a second
//   time, with two garments hung on her own bone palette out of a 78 KB blob
//   (`bayeswim`, see `loadBayeSwim`): a modelled bikini and the bun.
//
//   THE FINISH. The race ended at `swimRun.board`, a point five metres off the
//   tower on the side facing the jetty — the old platform's mark, never moved
//   when the tower was turned to face the kabine — and a racer more than
//   fifty-five metres back saw her stop short and vanish (`lost`). The finish
//   is the foot of the ladder now, round the end of the tower (`route`), and
//   nobody vanishes: losing the race means watching her get there first.
//
//   THE SHOW. At the foot she pushes her goggles up and climbs, and from there
//   she is 61-plunge.js's own diver: the same solved climb on her own bones,
//   the same AVBD springboard bending under her, the same conserved angular
//   momentum in the air and the same splash — driven by `autoDive` from a
//   repertoire of six (`BAYE_DIVES`), never the same one twice running.
//
//   THE END is the one that was there: after the show she swims over to you,
//   says her three lines, and swims back in with you.
// -----------------------------------------------------------------------------

const CHASE = {
  lead: 7.0,           // m she is ahead when you hit the water
  // Measured against the swim: your cruise is 1.15 and your sprint gets you
  // about 1.69 through the water once drag has had its say. At 1.42 a clean
  // sprint the whole way finished 2.8 m behind her — which is a race you
  // cannot win, and a race you cannot win is a race nobody runs twice.
  sp: 1.34,            // m/s — a decent club swimmer in flat water
  spTail: 1.56,        // and what she finds when you get on her feet
  tailAt: 4.5,         // m — inside this she hears you
  catchAt: 2.80,       // m — and inside this you have caught her
  // m behind and she is out of it altogether — not the race, the whole thing.
  // Was 55 and ended the RACE: she stopped where she was and was hidden, which
  // from the water is a woman evaporating short of the platform. The race is
  // won or lost at the ladder now; this only lets her go when you have left.
  lost: 260,
  turnRate: 1.1,       // rad/s she comes round on to her line
  strokeHz: 0.72,      // her cycle, in strokes a second
  // How far off her bearing she strays, and where she stops straying.
  //
  // The first cut used 0.42 rad on a 12 s cycle and measured 0.9 m of
  // cross-track, which is a weave you have to be told about. The fix was not
  // more angle. How far she actually gets off the line is her speed over the
  // frequency times the angle — sp/w * A — so a period three times longer is
  // three times the excursion for exactly the same heading offset, and the
  // heading offset is the only thing that costs her anything. The drift term
  // runs at 33 s now and she swings 2.5 m either side of the rhumb line.
  //
  // What the angle costs is the cosine of it, averaged: 0.25 rad RMS is 3.1%
  // of speed made good, about 4.6 s over the whole swim. The race is that much
  // easier to win now and it should be — the reason to sprint is that she is
  // going somewhere you can cut the corner on. Against a straight line there
  // is no corner and no reason.
  wander: 0.52,
  wanderOut: 25.0,     // m from the platform where she straightens up
  // And her pace breathes. +/-7% on a 16.7 s cycle, which is enough to make the
  // gap counter move on its own without being enough to read as a bug.
  surge: 0.07,
  cut: 5.2,            // s of the shot before you get the keys
  talk: 10.5,          // s of her turning round, in three lines
  wake: 4.6,           // m of foam behind her
  // The swim back in, once she has said her piece.
  // How far under the surface she rides while the race is on.
  //
  // Matched to `RACE_DEEP` in 90-app.js, which is what pulls you down to meet
  // her: the point of both numbers is that a chase between two heads bobbing
  // in the chop is not a chase, and the same two swimmers a half metre under
  // are. She comes back up for the talk, because a conversation happens at the
  // surface.
  deep: 0.5,
  homeSp: 1.06,        // m/s — an easy return, not a second race
  homeHold: 6.0,       // m — past this she is waiting for you rather than going
  homeEase: 0.45,      // and how far she drops her pace while she waits
  // ── the finish and the show ───────────────────────────────────────────────
  footAt: 1.1,         // m from the ladder's foot that counts as there
  turnAt: 1.6,         // m from a corner of the route that counts as round it
  easySp: 1.08,        // m/s anywhere that is not the race
  easyDeep: 0.10,      // and how far under, which is barely
  goggles: 0.9,        // s to push them up on to her forehead
  // Between dives: on the deck before she goes, and treading where she came
  // up. Seconds, [least, most].
  deck: [1.8, 3.8],
  rest: [2.4, 4.4],
  dives: 6,            // and then she comes and finds you
  waveAt: 30,          // m — you are close enough to be waved at
  meetAt: 5.0,         // m — swim up to her between dives and the show is over
  rise: 1.2,           // s from where the dive left her to the surface
};

/**
 * Her repertoire. Misha: *"maybe pick from a repertoire of like 4-6
 * different jumps, it's sort of her showing off"*. Six, all off the same
 * board and the same physics as yours, and nothing about any of them is a
 * typed trajectory: each is a plan for `autoDive` in 61-plunge.js — how
 * many bounces to pump the board with, which way to lean off it, what shape
 * to hold and when to come out of it — and the flight is whatever the
 * board and her own angular momentum make of that plan.
 *
 *   swan    a swan dive. Two bounces, laid out with her arms spread, the
 *           takeoff spin SOLVED for exactly half a turn by the water
 *           (`turnTo`), the arms swept together overhead for the entry.
 *   tuck    forward one-and-a-half, tucked: three bounces for height, the
 *           tuck held until what she still turns laid out lands her head
 *           first after a turn and a half — `autoPump`'s own kick-out.
 *   pike    forward one-and-a-half, piked: the same, folded at the hips
 *           with her legs straight, which spins her half as fast.
 *   back    a reverse dive: facing the water, turning back toward the board,
 *           laid out — half a turn, solved.
 *   twist   a forward dive with a full twist about her long axis, counted.
 *   ball    a cannonball. Knees to her chest, no spin at all, feet first,
 *           and the biggest splash the sea in this game has.
 */
const BAYE_DIVES = [
  { id: 'swan', bounces: 2, lean: 1, turnTo: Math.PI, style: 'swan' },
  { id: 'tuck', bounces: 3, lean: 1, shape: 'tuck', turns: 1 },
  { id: 'pike', bounces: 3, lean: 1, shape: 'pike', turns: 1 },
  { id: 'back', bounces: 2, lean: -1, turnTo: -Math.PI },
  { id: 'twist', bounces: 3, lean: 1, turnTo: Math.PI, twistTurns: 1 },
  { id: 'ball', bounces: 2, lean: 1, turnTo: 0, shape: 'ball', style: 'ball' },
];

/**
 * What she wears in the water. The suit is the bikini's own map with its
 * black cloth dyed — the gold trim is kept — and the bun is the Bucketeer's
 * map dyed Baye's brown (`hairDye`: its luminance as the shading, the colour
 * ours), with the velvet tie dyed to match the suit. The goggles are made
 * here, and are the one thing on her that is: two cups, two lenses, a
 * bridge and a strap, sized off her own head (see `bayeGoggles`).
 */
const BAYE_SWIM = {
  suit: [0.760, 0.075, 0.300],          // fuchsia, with the map's gold trim
  // Matched by eye beside the shore figure's braid, both in one frame: the
  // first pass (0.42, 1.05) was a shade lighter and warmer than her.
  hair: 0x6b4f3c, hairGain: 0.34, hairLit: 0.92,
  goggle: { frame: 0xff5fa8, lens: 0x2a6fd8, strap: 0xe24f93 },
  // How far the goggles tip up about the back of her head to sit on her
  // forehead, rad.
  up: 0.36,
};

/**
 * Turn her to face you, at `rate` radians a second. Shared by the phases
 * that do nothing else.
 */
function _turnTo(her, you, dt, rate) {
  const aim = Math.atan2(-(you.x - her.x), -(you.z - her.z));
  let d = aim - her.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return her.yaw + Math.max(-rate * dt, Math.min(rate * dt, d));
}
/** Turn `yaw` toward `aim` at `rate`, both in the game's heading convention. */
function _turnYaw(yaw, aim, dt, rate) {
  let d = aim - yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return yaw + Math.max(-rate * dt, Math.min(rate * dt, d));
}

/**
 * Baye v2.0 in her bikini, her hair up and her goggles on. Null — quietly —
 * if this build carries neither blob, which is the same failure `loadSkin`
 * has and the same one it deserves.
 *
 * HER BODY IS `baye2.fr3d`, A SECOND TIME. Her face, her lids, her jaw, her
 * skin and all forty-nine clips — the same construction as the shore figure
 * (46-apprentice.js) less the three parts she does not wear here: the braid,
 * the loose hair and the fishnet. Plain `loadSkin` and not `loadSkinHands`:
 * nothing here needs the leader's added finger bones, and the garments below
 * are skinned off exactly the thirty bones the bake wrote.
 *
 * THE GARMENTS RIDE HER PALETTE. `bayeswim.fr3d` is the same rig with no body
 * and no clips (tools/blender/baye2.py), so its parts are built here the way
 * `skinnedFigure` builds a v5 figure's parts — children of her mesh, sharing
 * her `uBones` — and whatever poses her poses them, with nothing copied. The
 * rig is checked bone for bone first, because a palette for one skeleton on
 * another is a body turned inside out.
 *
 * AND THE BODY UNDER THE SUIT IS CUT. MakeHuman takes it out at bake time
 * (the suit's `delete_verts`, as the Bucketeer's one-piece does); here the
 * body is a different blob, so `bayeswim_mask` is those faces in UV space and
 * her body fragment discards them — in the colour pass only, so her shadow
 * keeps its middle.
 */
async function loadBayeSwim() {
  if (!PAYLOAD.baye2_fr3d || !PAYLOAD.bayeswim_fr3d) return null;
  const S = BAYE_SWIM;
  const glv = (a) => 'vec3(' + a.map((n) => n.toFixed(3)).join(', ') + ')';
  const look = v5Parts({
    hairTex: 'bucketeer2_hair', hairCol: S.hair, browCol: APPR.browCol, lidCol: 0xdcbcad,
    hairDye: true, hairGain: S.hairGain, hairLit: S.hairLit,
    // The velvet tie round the bun: anything in the map clearly redder than
    // it is green or blue (the Bucketeer's own test), dyed to her suit.
    // Tighter than the Bucketeer's 0.10-0.22: the map's brown strands
    // themselves sit at 0.13, and at her threshold a fifth of every strand
    // went fuchsia. The velvet is 0.38.
    hairBody: 'float tie = smoothstep(0.26, 0.34, hc.r - max(hc.g, hc.b));\n'
      + 'base = mix(base, ' + glv(S.suit) + ' * (0.55 + 1.6 * hl), tie);',
  });
  const fig = await loadSkin('baye2_fr3d', {
    spec: 0.10, specPower: 26, vcol: false,
    uniforms: { uSkin: { value: v5Tex('baye2_skin') }, uCut: { value: v5Tex('bayeswim_mask') },
      ...look.jaw.uniforms, ...look.lid.uniforms },
    decl: 'uniform sampler2D uSkin;\nuniform sampler2D uCut;' + look.jaw.decl + look.lid.decl,
    vdecl: look.jaw.vdecl,
    body: 'if (texture2D(uCut, vUv).r > 0.5) discard;\n'
      + 'base = texture2D(uSkin, vUv).rgb;' + look.jaw.frag,
    vert: look.lid.vert + look.jaw.bodyVert,
    parts: { eyes: look.parts.eyes, mouth: look.parts.mouth,
      brow: look.parts.brow, lash: look.parts.lash },
  });
  if (!fig) return null;
  v5Eyes(fig, look.eye);
  v5Jaw(fig, look.jaw);
  fig.v5 = look;

  let wear = null;
  try {
    wear = readFR3DSkin(await inflateBinary(PAYLOAD.bayeswim_fr3d));
  } catch (e) {
    console.warn('bayeswim failed:', e.message);
  }
  const same = wear && wear.bones.length === fig.bones.length
    && wear.bones.every((b, i) => {
      const c = fig.bones[i];
      return b.name === c.name && b.parent === c.parent
        && Math.abs(b.t[0] - c.t[0]) + Math.abs(b.t[1] - c.t[1]) + Math.abs(b.t[2] - c.t[2]) < 1e-4
        && Math.abs(b.q[0] - c.q[0]) + Math.abs(b.q[1] - c.q[1])
          + Math.abs(b.q[2] - c.q[2]) + Math.abs(b.q[3] - c.q[3]) < 1e-4;
    });
  if (wear && !same) console.warn('bayeswim: not her rig — garments left off');
  if (same) {
    const U = fig.material.uniforms, nb = fig.bones.length;
    const SUIT = {
      color: 0xffffff, side: THREE.DoubleSide, spec: 0.24, specPower: 40,
      // Cloth, not skin — the fishnet's note.
      emissive: 0.03,
      uniforms: { uSuit: { value: v5Tex('bayeswim_suit') } },
      decl: 'uniform sampler2D uSuit;',
      // The map is flat black cloth (0.13) with a gold band at the hips and
      // the bust; the black is dyed, the gold is the map's own. The inside of
      // the suit is lit as the inside it is.
      body: 'n = gl_FrontFacing ? n : -n;\n'
        + 'vec3 sc = texture2D(uSuit, vUv).rgb;\n'
        + 'float trim = smoothstep(0.08, 0.16, sc.r - sc.b);\n'
        + 'base = mix(' + glv(S.suit) + ' * (0.80 + 1.5 * sc.g), sc * 1.35, trim);\n'
        + 'if (!gl_FrontFacing) base *= 0.55;',
    };
    for (const grp of wear.groups) {
      const po = grp.name === 'hair' ? look.parts.hair : grp.name === 'suit' ? SUIT : null;
      if (!po) continue;
      const geo = new THREE.BufferGeometry();
      for (const k of ['position', 'normal', 'uv', 'aVCol', 'aBoneIdx', 'aBoneWt']) {
        const a = wear.geo.getAttribute(k);
        if (a) geo.setAttribute(k, a);
      }
      geo.setIndex(wear.geo.getIndex());
      geo.setDrawRange(grp.start, grp.count);
      geo.boundingSphere = wear.geo.boundingSphere;
      const pm = new THREE.Mesh(geo, solidMaterial(po.color ?? 0xffffff, {
        spec: 0.06, specPower: 32, emissive: SKIN_EMISSIVE, vcol: false,
        ...po,
        defines: { FR_SKIN: '', FR_BONES: nb },
        uniforms: { uBones: U.uBones, uBoneRows: U.uBoneRows, ...(po.uniforms || {}) },
      }));
      pm.frustumCulled = false;
      pm.renderOrder = po.renderOrder || 0;
      fig.mesh.add(pm);
      fig.parts[grp.name === 'hair' ? 'bun' : 'suit'] = pm;
    }
  }
  fig.goggles = bayeGoggles(fig, look.eye);
  return fig;
}

/**
 * Her goggles: two cups, two lenses with a rim each, a bridge and a strap.
 *
 * The one thing on her that is made here rather than taken off the rack, and
 * it is small enough that it can be: the MakeHuman packs carry swimwear and
 * no swim goggles. Everything is placed off her own bind mesh — the two eye
 * centres `v5Eyes` measured, and her head's width and the back of her skull
 * at eye height, read off the vertices that are mostly hers on `head` — so
 * the cups sit on her eye sockets and the strap clears her temples.
 *
 * Carried the way Chloe's beanie is: built in the bind pose, hung off the head
 * bone's position, turned by its `boneTurn`. And pushed up on to her forehead
 * by tipping the whole thing about the back of her skull, where the strap
 * sits — which is what a hand pushing goggles up does. `tick(k)`: 0 over her
 * eyes, 1 up.
 */
function bayeGoggles(fig, eye) {
  const hi = fig.boneIndex('head');
  if (hi < 0 || !eye) return null;
  const bt = fig.bindRest().bindT;
  const eL = eye.uEyeL.value, eR = eye.uEyeR.value;
  const ey = (eL.y + eR.y) / 2, ex = (eL.x + eR.x) / 2;
  // Her skull at the strap's height, off her own mesh.
  const g = fig.mesh.geometry;
  const pos = g.getAttribute('position'), bI = g.getAttribute('aBoneIdx'),
    bW = g.getAttribute('aBoneWt'), ix = g.getIndex();
  const r0 = g.drawRange.start, r1 = r0 + Math.min(g.drawRange.count, ix.count - r0);
  let back = 0, half = 0;
  for (let k = r0; k < r1; k++) {
    const i = ix.getX(k);
    if (Math.abs(pos.getY(i) - (ey + 0.012)) > 0.010) continue;
    if (Math.round(bI.getX(i) * 255) !== hi || bW.getX(i) < 0.6) continue;
    back = Math.min(back, pos.getX(i));
    half = Math.max(half, Math.abs(pos.getZ(i)));
  }
  if (!(half > 0.04) || !(back < -0.02)) { back = ex - 0.19; half = 0.075; }
  const G = BAYE_SWIM.goggle;
  const frame = solidMaterial(G.frame, { spec: 0.45, specPower: 60, vcol: false, emissive: 0.04 });
  const lens = solidMaterial(G.lens, { spec: 1.1, specPower: 140, vcol: false, emissive: 0.06 });
  const strap = solidMaterial(G.strap, { spec: 0.25, specPower: 30, vcol: false });
  const holder = new THREE.Group();
  const pivot = new THREE.Group();
  const inner = new THREE.Group();
  holder.add(pivot); pivot.add(inner);
  fig.mesh.add(holder);
  // The pivot: the back of her skull, at the strap.
  const P = [back - 0.004, ey + 0.006, 0];
  pivot.position.set(P[0] - bt[hi * 3], P[1] - bt[hi * 3 + 1], P[2] - bt[hi * 3 + 2]);
  inner.position.set(-P[0], -P[1], -P[2]);
  const cupG = new THREE.CylinderGeometry(0.0172, 0.0196, 0.014, 22, 1, true).rotateZ(-Math.PI / 2);
  const lensG = new THREE.CircleGeometry(0.0172, 22).rotateY(Math.PI / 2);
  const rimG = new THREE.TorusGeometry(0.0176, 0.0026, 6, 24).rotateY(Math.PI / 2);
  const outer = [];
  for (const [e, s] of [[eL, 1], [eR, -1]]) {
    const cup = new THREE.Group();
    cup.position.set(e.x + 0.017, e.y + 0.002, e.z + s * 0.002);
    // Toed out, the way the face turns away from the nose.
    cup.rotation.y = -s * 0.24;
    const c = new THREE.Mesh(cupG, frame);
    const l = new THREE.Mesh(lensG, lens); l.position.x = 0.0068;
    const r = new THREE.Mesh(rimG, frame); r.position.x = 0.0068;
    cup.add(c, l, r);
    inner.add(cup);
    cup.updateMatrix();
    outer.push(new THREE.Vector3(0, 0, s * 0.0196).applyMatrix4(cup.matrix));
  }
  // The bridge, over her nose between the two inner rims.
  const zi = Math.abs(eL.z - eR.z) / 2 - 0.0175;
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 2 * zi, 8)
    .rotateX(Math.PI / 2), frame);
  bridge.position.set(ex + 0.024, ey + 0.004, (eL.z + eR.z) / 2);
  inner.add(bridge);
  // The strap: from one cup round the back of her head to the other, on an
  // ellipse through her temples and the back of her skull.
  const ax = (ex - back) * 0.5 + 0.006, cx = (ex + back) * 0.5, az = half + 0.006;
  const pts = [outer[0]];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI * 0.42 + (Math.PI * 1.16) * (k / 16);
    pts.push(new THREE.Vector3(cx + ax * Math.cos(a), ey + 0.006, az * Math.sin(a)));
  }
  pts.push(outer[1]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),
    64, 0.0034, 6, false), strap);
  inner.add(tube);
  for (const o of [holder, pivot, inner]) o.frustumCulled = false;
  inner.traverse((o) => { o.frustumCulled = false; });
  return {
    group: holder,
    /** k: 0 over her eyes, 1 pushed up on her forehead. After `fig.update`. */
    tick(k) {
      fig.boneAt(hi, holder.position);
      fig.boneTurn(hi, holder.quaternion);
      pivot.rotation.z = BAYE_SWIM.up * k;
    },
    measured: { back: +back.toFixed(3), half: +half.toFixed(3), eye: [+ex.toFixed(3), +ey.toFixed(3)] },
  };
}

/**
 * The race, and what she does after it.
 *
 * Owns her, the line she is on and what is left of it. `update` is handed the
 * swim's own `you` so it never has to know how the water works; what it returns
 * is the one thing the frame loop above it has to act on.
 *
 * `attach(jad, hooks)` gives her the tower, once the resort and Chloe's own
 * plunge exist (90-app.js): her own `buildPlunge` on her own figure, and the
 * hooks that say whether Chloe is up there and what a splash sounds like.
 */
async function buildChase(scene) {
  // Her, and not a stand-in — and since 1.556.0 not v1.0 either. See the
  // header, and `loadBayeSwim`.
  const fig = await loadBayeSwim();
  const root = new THREE.Group();
  root.visible = false;
  root.frustumCulled = false;
  scene.add(root);
  if (fig) {
    fig.mesh.frustumCulled = false;
    root.add(fig.mesh);
    fig.play('swim', { fade: 0 });
    fig.mesh.visible = false;      // and her shadow with it — see `show`
  }

  // The wake: a flat ribbon of foam behind her, drawn on the surface. Cheap,
  // and it is most of what tells you at thirty metres that the shape ahead is
  // a person and not a buoy.
  const wake = (() => {
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 128;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 128);
    // Faint. The first version was 0.62 at the head of it and on a moving
    // water surface that is not foam, it is a sheet of ice being towed.
    grd.addColorStop(0, 'rgba(255,255,255,0.30)');
    grd.addColorStop(0.30, 'rgba(255,255,255,0.13)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    for (let y = 0; y < 128; y++) {
      const w = 6 + y * 0.16;
      g.fillRect(16 - w / 2, y, w, 1);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.92, CHASE.wake),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false,
        side: THREE.DoubleSide,
      }));
    // Flat on the water and trailing back down −X, which is astern of a rig
    // whose forward is +X.
    m.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    m.frustumCulled = false;
    m.renderOrder = 3;
    root.add(m);
    return m;
  })();

  /**
   * Shown or not — the group and her mesh both, because the sun's shadow
   * proxy reads the MESH's own `visible` (see `syncMoving` in 06-shadow.js)
   * and a group hidden over her would leave her shadow on the water.
   */
  function show(v) {
    root.visible = v;
    if (fig) fig.mesh.visible = v;
  }
  const her = { x: 0, z: 0, y: 0, yaw: 0, u: 0, sp: 0, done: 0 };
  /** Set while the shot is holding her on the jetty — see `poise`. */
  let poised = null;
  let on = false;
  // 'swim' the race · 'ladder' on to the foot of it, race over · 'queue'
  // treading there while the tower is somebody else's · 'goggles' · 'tower'
  // (her plunge has her) · 'rise' up from the dive · 'rest' treading where
  // she came up · 'meet' over to you · 'talk' · 'home' · 'off'.
  let phase = 'off';
  let t = 0, line = 0, gap = 0, best = 1e9;
  let target = [0, 0];
  let startAt = [0, 0];
  // The way she is going: corners in world (x, z), and which one is next.
  let route = [], leg = 0;
  // Whether the race is still on — the gap counter and the half metre under
  // are the race's, not the swim's — and how it ended.
  let racing = false, result = null;
  // The show: her own plunge, how many dives, which one now, which last.
  let bp = null, jad = null, hooks = {};
  let dives = 0, dive = null, lastDive = null, bag = [];
  let deckWait = -1, waved = false, rested = 0;
  // Goggles: 0 over her eyes, 1 up — and where they are heading.
  let gog = 0, gogWant = 0;
  // Talk: how far her jaw is open, for the three lines.
  let mouth = 0;

  const say = () => (phase === 'talk'
    ? Math.min(3, 1 + Math.floor(t / (CHASE.talk / 3.4))) : 0);

  // ── the tower, through 61-plunge.js ─────────────────────────────────────
  //
  // Her `you`: the figure, and a `drive` that writes down what the plunge
  // asks for so that `draw` can lay it on after the clip has run. The plunge
  // moves a camera as part of posing — a person's own eyes on the tower — and
  // hers is a camera nobody looks through.
  const drv = { on: false, at: [0, 0, 0], yaw: 0, q: new THREE.Quaternion(), hasQ: false,
    clip: null, speed: null, fade: 0.2 };
  const ghostCam = new THREE.Object3D();
  const body = {
    fig,
    drive(o) {
      if (!o) { drv.on = false; return null; }
      drv.on = true;
      drv.at[0] = o.at[0]; drv.at[1] = o.at[1]; drv.at[2] = o.at[2];
      drv.yaw = o.yaw || 0;
      drv.hasQ = !!o.quat;
      if (o.quat) drv.q.copy(o.quat);
      drv.clip = o.clip || null;
      drv.speed = o.speed;
      drv.fade = o.fade == null ? 0.2 : o.fade;
      return drv;
    },
  };
  /** The tower's frame, in world (x, z), off the resort's own numbers. */
  const T = (u, v) => { const p = jad.dive.frame.P(u, v, 0); return [p[0], p[2]]; };
  /** Where she treads to climb: a body-length off the rungs. */
  const foot = () => { const F = jad.dive.frame; return T(F.ladder.u, F.ladder.face - 0.55); };
  /**
   * Round the tower to its ladder. The ladder is on the face AWAY from the
   * jetty, so a straight line to it from the race runs into concrete; this
   * goes round the plank's end, under the board, a body-length off the
   * masses, and in along the ladder's face. `from` 'race' starts on the
   * jetty's side; 'tip' is where a dive leaves her, out past the end.
   */
  function towerRoute(from) {
    const F = jad.dive.frame, U = F.ladder.u, V = F.ladder.face;
    const out = [];
    if (from === 'race') out.push(T(3.2, 3.4));
    out.push(T(3.4, -2.25), T(U + 0.7, V - 0.95), foot());
    return out;
  }
  function routeLeft() {
    let L = Math.hypot(route[leg][0] - her.x, route[leg][1] - her.z);
    for (let k = leg + 1; k < route.length; k++) {
      L += Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]);
    }
    return L;
  }
  /**
   * Swim the route at `sp`, wandering as the race does when `wob`. Returns
   * true at the end of it.
   */
  function stepRoute(dt, sp, wob) {
    while (leg < route.length - 1
      && Math.hypot(route[leg][0] - her.x, route[leg][1] - her.z) < CHASE.turnAt) leg++;
    const c = route[leg];
    const dx = c[0] - her.x, dz = c[1] - her.z;
    const d = Math.hypot(dx, dz);
    const last = leg === route.length - 1;
    if (last && d < CHASE.footAt) return true;
    const left = routeLeft();
    const w = wob ? CHASE.wander * Math.min(1, left / CHASE.wanderOut)
      * (Math.sin(t * 0.190 + 1.7) * 0.62 + Math.sin(t * 0.470) * 0.26
        + Math.sin(t * 2.03 + 0.4) * 0.12) : 0;
    // Slower into the last couple of metres, so she arrives rather than
    // stops dead.
    const v = last ? sp * clamp(d / 2.5, 0.35, 1) : sp;
    her.yaw = _turnYaw(her.yaw, Math.atan2(-dx, -dz) + w, dt, CHASE.turnRate * (last ? 1.8 : 1));
    her.x -= Math.sin(her.yaw) * v * dt;
    her.z -= Math.cos(her.yaw) * v * dt;
    her.u += dt * CHASE.strokeHz * (v / CHASE.sp);
    return false;
  }

  /** The next dive: random, and never the one she has just done. */
  function nextDive() {
    if (!bag.length) {
      bag = BAYE_DIVES.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (lastDive && bag[bag.length - 1].id === lastDive.id) bag.unshift(bag.pop());
    }
    return bag.pop();
  }

  /** Is the tower somebody else's just now — Chloe on it, or the diver on its ladder? */
  function towerBusy() {
    if (hooks.chloeUp && hooks.chloeUp()) return true;
    const m = jad.dive.mode ? jad.dive.mode() : 'off';
    return m === 'ladder';
  }

  function toLadder(from) {
    route = towerRoute(from); leg = 0;
    phase = 'ladder'; t = 0;
  }

  /**
   * Put her on the line and start the clock.
   *
   * `from` and `to` are the two ends of the run in world metres — the jetty
   * head and the platform — and both come out of 43-jadrija.js so that moving
   * either one moves the race with it. `to` is where she is aimed off the
   * jetty; the finish is the foot of the ladder, round the tower from it.
   */
  function start(from, to, surfaceY) {
    startAt = [from[0], from[1]];
    target = [to[0], to[1]];
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const L = Math.hypot(dx, dz) || 1;
    her.x = from[0] + (dx / L) * CHASE.lead;
    her.z = from[1] + (dz / L) * CHASE.lead;
    her.yaw = Math.atan2(-dx, -dz);
    her.u = 0; her.sp = CHASE.sp; her.done = 0;
    her.y = surfaceY(her.x, her.z);
    route = jad ? towerRoute('race') : [target.slice()]; leg = 0;
    on = true; phase = 'swim'; t = 0; gap = CHASE.lead; best = CHASE.lead;
    racing = true; result = null;
    dives = 0; dive = null; deckWait = -1; gog = 0; gogWant = 0; mouth = 0;
    line = routeLeft();
    show(true);
    return true;
  }

  function stop() {
    on = false; phase = 'off'; show(false);
    poised = null; racing = false;
    if (bp && bp.active) bp.abort();
    drv.on = false;
  }

  /**
   * Stand her somewhere, out of the race.
   *
   * The race used to begin with her already seven metres out and already
   * swimming, which is a fair model of what you are chasing and a poor one of
   * how it started: you arrive at a jetty somebody has just left. So now there
   * is a beat before it in which she is a person standing on concrete, and
   * this is the state she is in for the length of it — placed by the shot,
   * upright, playing whatever it asks for, and not moving under her own power.
   *
   * `stop()` clears it, and `start()` overrides it, so there is no way to be
   * both poised and racing.
   */
  function poise(x, y, z, yaw, clip = 'idle', pitch = 0) {
    poised = { x, y, z, yaw, clip, pitch };
    gog = 0; gogWant = 0;
    show(true);
    return poised;
  }

  /**
   * One frame. Returns 'caught', 'arrived', 'dive', 'done', 'home', 'gone'
   * or null.
   *
   * 'caught' is the moment you get inside `catchAt` during the race, and
   * 'arrived' the moment she reaches the ladder before you have — each ends
   * the race and is fired once. 'dive' is one of hers going in (`lastEntry`
   * has the verdict). 'done' is the end of what she has to say afterwards,
   * 'home' her climbing out at the jetty with you, and 'gone' her letting you
   * go when you have swum off altogether.
   */
  function update(dt, you, surfaceY) {
    if (!on || frozen) return null;
    const t0 = performance.now();
    const out = step(dt, you, surfaceY);
    ms += (performance.now() - t0 - ms) * 0.05;
    return out;
  }
  // What she costs a frame, update and draw, as a running average — on the
  // CPU, for the reason `apprMs` gives in 46-apprentice.js.
  let ms = 0, msDraw = 0;
  function step(dt, you, surfaceY) {
    t += dt;
    if (bp && !bp.active) bp.tick(dt);

    if (phase === 'tower') {
      const w = bp.where();
      her.x = w[0]; her.z = w[2];
    }
    gap = Math.hypot(you.x - her.x, you.z - her.z);
    best = Math.min(best, gap);
    gog += clamp(gogWant - gog, -dt / CHASE.goggles, dt / CHASE.goggles);
    if (gap > CHASE.lost) { stop(); return 'gone'; }

    if (phase === 'swim') {
      // On her feet and she knows it.
      const want = (gap < CHASE.tailAt ? CHASE.spTail : CHASE.sp)
        * (1 + CHASE.surge * Math.sin(t * 0.377 + 2.1));
      her.sp += (want - her.sp) * Math.min(1, dt * 1.4);
      // Her line is not a line.
      //
      // She swam dead at the platform, which is what a bearing does and not
      // what a person does. Two hundred metres of open water with nothing to
      // sight on but a raft, and nobody holds a course inside a few degrees:
      // you drift off it, you pick your head up, you come back on, and then
      // you do it again. Straight, the race was a gap counter with a body
      // attached — you could read the outcome off the first ten seconds and
      // nothing after that changed your mind.
      //
      // Three sines at periods that do not divide into one another, summed:
      // 33 s is the drift and carries almost all of the excursion, 13.4 s is
      // her picking her head up and correcting it, and 3.1 s is the fact that
      // a stroke is not symmetrical and every swimmer yaws a little inside
      // each cycle. Off her own clock rather than off `Math.random`, so that
      // a run is a run and a test of a run is the same run — which is the
      // same reason the beach is laid out off `jit`.
      //
      // It goes to nothing over the last twenty-five metres of the route,
      // which is the round of the tower: a wander there would put her into
      // the concrete it is going round.
      const there = stepRoute(dt, her.sp, true);
      // Under for the open water, and up to the surface for the round of the
      // tower, where she is about to stop.
      const k = clamp((routeLeft() - 6) / 14, 0, 1);
      her.y = surfaceY(her.x, her.z) - lerp(CHASE.easyDeep, CHASE.deep, k);
      if (gap <= CHASE.catchAt) {
        // Caught. The race is yours, and she does not stop to say so: the
        // ladder was where she was going and it still is. Her lines come
        // after the show — see 'meet'.
        racing = false; result = 'caught';
        phase = 'ladder'; t = 0;
        return 'caught';
      }
      if (there) {
        racing = false; result = 'arrived';
        phase = 'queue'; t = 0;
        return 'arrived';
      }
      return null;
    }

    if (phase === 'ladder' || phase === 'meet' || phase === 'home') {
      // Swimming somewhere at an easy pace, barely under. `meet` is to you;
      // `home` is back to the jetty, holding a little ahead of you.
      if (phase === 'meet') {
        // Not up a ladder after you: if you are on the tower she treads
        // where she is until you are back in the water.
        if (you.inWater === false) {
          her.y = surfaceY(her.x, her.z); her.u += dt * 0.22;
          her.yaw = _turnTo(her, you, dt, 1.2);
          return null;
        }
        route = [[you.x, you.z]]; leg = 0;
        if (gap <= CHASE.catchAt + 0.6) {
          phase = 'talk'; t = 0; gogWant = 0;
          her.yaw = Math.atan2(-(you.x - her.x), -(you.z - her.z));
          return null;
        }
      }
      let sp = CHASE.easySp;
      if (phase === 'home') {
        // She holds a little ahead of you rather than running her own race:
        // the point of the leg is that there are two of you in the water, and
        // a swimmer who is fifty metres up the channel is one of you. So she
        // takes her pace from the gap — easing off when you fall behind,
        // picking it up when you are on her shoulder — and she is done when
        // the jetty is close enough to climb out at.
        route = [startAt.slice()]; leg = 0;
        const want = CHASE.homeSp * (gap > CHASE.homeHold ? CHASE.homeEase : 1.0);
        her.sp += (want - her.sp) * Math.min(1, dt * 1.2);
        sp = her.sp;
        if (Math.hypot(startAt[0] - her.x, startAt[1] - her.z) < 3.0) { stop(); return 'home'; }
      }
      const there = stepRoute(dt, sp, false);
      her.y = surfaceY(her.x, her.z) - (phase === 'home' ? CHASE.deep * 0.5 : CHASE.easyDeep);
      if (phase === 'ladder' && there) { phase = 'queue'; t = 0; }
      return null;
    }

    if (phase === 'queue' || phase === 'goggles') {
      // At the foot of the ladder, treading, facing it. Waiting her turn if
      // the tower is somebody else's — Chloe up there (one board, one ladder:
      // see `blocked` in 61-plunge.js, which keeps Chloe off it while Baye
      // has it) or the diver on its rungs.
      const F = jad.dive.frame;
      const f = foot();
      her.x += (f[0] - her.x) * Math.min(1, dt * 1.5);
      her.z += (f[1] - her.z) * Math.min(1, dt * 1.5);
      // Facing the rungs: the ladder's face is along +n from where she
      // treads, and forward in the game's convention is (−sin, −cos).
      her.yaw = _turnYaw(her.yaw, Math.atan2(-F.axis.nx, -F.axis.nz), dt, 2.0);
      her.y = surfaceY(her.x, her.z);
      her.u += dt * 0.22;
      if (phase === 'queue') {
        if (t > 0.6 && !towerBusy() && bp) {
          phase = 'goggles'; t = 0; gogWant = 1;
        }
        return null;
      }
      // Up on to her forehead, and then the rungs.
      if (gog >= 0.999 && t > CHASE.goggles * 0.5) {
        if (towerBusy()) { phase = 'queue'; t = 0; return null; }
        // The plunge wants her eye in the world; she is treading with her
        // head out, so that is a little over the surface.
        if (bp.climb([her.x, her.y + 0.30, her.z])) {
          phase = 'tower'; t = 0; deckWait = -1;
        }
      }
      return null;
    }

    if (phase === 'tower') {
      const ev = bp.update(dt, {});
      // A probe's still: held on the frame she is that far through a flight.
      if (freezeFrac != null) {
        const s = bp.stats();
        if (s.mode === 'deck' && s.rider.mode === 'air' && s.dir !== 0 && s.tFlight > 0
          && s.tAir >= freezeFrac * s.tFlight) { frozen = true; freezeFrac = null; }
      }
      if (ev && ev.type === 'top') {
        // On the plank at the ladder, facing the tip. A moment to stand
        // there and be looked at, longer after the first.
        deckWait = CHASE.deck[0] + Math.random() * (CHASE.deck[1] - CHASE.deck[0])
          + (dives ? 0 : 0.8);
      }
      if (deckWait > 0) {
        deckWait -= dt;
        if (deckWait <= 0) {
          dive = nextDive();
          bp.autoDive(dive);
        }
      }
      if (ev && ev.type === 'entry') {
        dives++;
        lastDive = dive;
        lastEntry = { ...ev.rate, id: dive ? dive.id : null };
        return 'dive';
      }
      if (ev && ev.type === 'done') {
        const h = bp.handover();
        bp.end();
        drv.on = false;
        her.x = h.x; her.z = h.z; her.y = h.y;
        // Heading: along the board, which is where the dive took her.
        her.yaw = Math.atan2(-jad.dive.frame.axis.ux, -jad.dive.frame.axis.uz);
        riseFrom = h.y;
        phase = 'rise'; t = 0; waved = false;
        rested = CHASE.rest[0] + Math.random() * (CHASE.rest[1] - CHASE.rest[0]);
      }
      return null;
    }

    if (phase === 'rise' || phase === 'rest') {
      const sy = surfaceY(her.x, her.z);
      if (phase === 'rise') {
        // Up from wherever the dive left her, opening into a tread.
        const k = smoothstep(0, CHASE.rise, t);
        her.y = lerp(riseFrom, sy, k);
        if (t >= CHASE.rise) { phase = 'rest'; t = 0; }
        return null;
      }
      her.y = sy;
      her.u += dt * 0.22;
      her.yaw = _turnTo(her, you, dt, 1.4);
      // You have swum over to her: that is the show over, and her lines.
      const near = you.inWater !== false && gap <= CHASE.meetAt;
      if (near && dives >= 1) {
        phase = 'talk'; t = 0; gogWant = 0;
        her.yaw = Math.atan2(-(you.x - her.x), -(you.z - her.z));
        return null;
      }
      // A wave, once, if you are close enough to see it.
      if (!waved && t > 0.5 && gap < CHASE.waveAt) waved = true;
      if (t > rested + (waved ? 1.4 : 0)) {
        if (dives >= CHASE.dives) {
          phase = 'meet'; t = 0;
        } else {
          toLadder('tip');
        }
      }
      return null;
    }

    if (phase === 'talk') {
      her.y = surfaceY(her.x, her.z);
      // Treading water: a slow scull rather than a stroke, and she keeps facing
      // you while you drift.
      her.u += dt * 0.22;
      her.yaw = _turnTo(her, you, dt, 1.6);
      if (t > CHASE.talk) {
        // Not `stop()`. She turns round and swims back in with you — see the
        // `home` phase, and the note on it about why she does not simply go.
        phase = 'home'; t = 0; her.sp = CHASE.homeSp * 0.4;
        return 'done';
      }
      return null;
    }
    return null;
  }
  let riseFrom = 0;
  let lastEntry = null;
  // Debug: a held frame mid-flight, for photographing a dive — see `freezeAt`.
  let frozen = false, freezeFrac = null;

  /**
   * Place and pose her, after everything has moved.
   *
   * The rig's forward is +X and a Three.js object with `rotation.y = θ` points
   * its local +X at (cos θ, −sin θ), while `her.yaw` is written the way every
   * heading in this game is — forward is (−sin, −cos). Hence the quarter turn,
   * which is the only place in this file that has to know either convention.
   */
  function draw(dt) {
    if (!fig) return;
    const t0 = performance.now();
    drawBody(dt);
    msDraw += (performance.now() - t0 - msDraw) * 0.05;
  }
  function drawBody(dt) {
    if (fig.v5) v5Blink(fig.v5.eye, dt);
    // Her mouth: the three lines, a syllable at a time — the same jaw the
    // shore figure talks with.
    const talking = phase === 'talk' && say() > 0 && (t % (CHASE.talk / 3.4)) < 2.6;
    mouth = damp(mouth, talking ? 0.18 + 0.22 * Math.max(0, Math.sin(t * 13.0)) : 0, 18, dt);
    if (fig.v5 && fig.v5.jaw) fig.v5.jaw.uniforms.uGape.value = mouth;
    // Poised beats racing, and it is drawn even when the race has not begun —
    // that is the whole point of it. Upright, so the rig's floor is under her
    // feet and there is no sinking to do: she is standing on a jetty.
    if (poised) {
      root.position.set(poised.x, poised.y, poised.z);
      root.rotation.set(0, poised.yaw + Math.PI / 2, poised.pitch || 0, 'YZX');
      if (fig.playing() !== poised.clip) fig.play(poised.clip, { fade: 0.25 });
      fig.update(dt);
      if (fig.goggles) fig.goggles.tick(gog);
      wake.visible = false;
      return;
    }
    if (!on) return;
    if (phase === 'tower' && bp && bp.active) {
      // The plunge poses her — aims, root and attitude — and the clip runs
      // under it, exactly as `you.tick` does for Chloe.
      bp.pose(ghostCam, true, dt);
      if (drv.on) {
        if (drv.clip && fig.playing() !== drv.clip) fig.play(drv.clip, { fade: drv.fade });
        if (drv.speed != null && fig.state) fig.state.speed = drv.speed;
      }
      fig.update(dt);
      if (drv.on) {
        root.position.set(drv.at[0], drv.at[1], drv.at[2]);
        if (drv.hasQ) root.quaternion.copy(drv.q);
        else root.rotation.set(0, drv.yaw, 0);
      }
      if (fig.goggles) fig.goggles.tick(gog);
      wake.visible = false;
      return;
    }
    const tread = phase !== 'swim' && phase !== 'ladder' && phase !== 'meet' && phase !== 'home';
    // How deep she floats, in metres below the surface.
    //
    // Prone she is just awash. Upright she is a whole different number and it
    // is the bigger of the two by a metre and a half: the `tread` clip is
    // authored standing, so the rig's floor is under her *feet*, and treading
    // water puts the waterline at her shoulders. Written at −0.46 — the prone
    // figure's number with a bit off it — she stood on the sea.
    // Prone she is *under* it, which is the correction this number exists to
    // carry. −0.12 floated the rig twelve centimetres clear of the waterline
    // and, the clip being authored lying down, that put a whole swimmer on top
    // of the sea — the one thing nobody swimming has ever done. A front crawl
    // sits the spine a hand's breadth under, the head down between the arms
    // and only the roll bringing a shoulder through; 0.34 is that, and it is
    // also what makes the wake read as coming off something rather than as
    // being towed by it.
    const sink = tread ? 0.88 : 0.34;
    // Off the tower the clips run at their own rate — the plunge freezes
    // `idle` at its first frame by stopping the clock, and leaves it stopped.
    if (fig.state) fig.state.speed = 1;
    root.position.set(her.x, her.y - sink, her.z);
    root.rotation.set(0, her.yaw + Math.PI / 2, 0);
    // In the rest after a dive, a wave if you are near enough to see it —
    // the arm up out of the water; the clip is authored standing, as the
    // tread is, so it sinks the same.
    const want = !tread ? 'swim'
      : phase === 'rest' && waved && t > 0.5 && t < 0.5 + 2.6 && fig.clips.includes('wave')
        ? 'wave' : 'tread';
    if (fig.playing() !== want) fig.play(want, { fade: 0.35 });
    fig.update(dt);
    if (fig.goggles) fig.goggles.tick(gog);
    wake.visible = phase === 'swim' || phase === 'ladder' || phase === 'meet' || phase === 'home';
    wake.position.set(-CHASE.wake * 0.5, 0.02 + sink, 0);
  }

  /**
   * Give her the tower. `j` is the resort (its `dive.frame` is the tower);
   * `h` the app's side of it: `chloeUp()` — is Chloe on the tower — and the
   * splash and sound of hers going in.
   */
  function attach(j, h = {}) {
    jad = j; hooks = h;
    if (!fig || !j || !j.dive || !j.dive.frame || typeof buildPlunge !== 'function') return false;
    bp = buildPlunge(j, body, {
      splash: h.splash,
      sound: h.sound,
    });
    return !!bp;
  }

  return {
    root, her, fig, start, stop, update, draw, poise, attach,
    get poised() { return poised; },
    get active() { return on; },
    get phase() { return phase; },
    get gap() { return gap; },
    /** The race itself — the HUD, the half metre under, the breath held. */
    get racing() { return on && racing; },
    /** How the race went: 'caught', 'arrived' or null while it is on. */
    get result() { return result; },
    /** Is she on the tower — the ladder, the deck, the board or in the air? */
    get onTower() { return on && phase === 'tower'; },
    /** Her last dive's verdict, as 61-plunge.js rates Chloe's. */
    get lastEntry() { return lastEntry; },
    get dives() { return dives; },
    get plunge() { return bp; },
    /** How far she still has to go, 0..1 through the race. */
    get through() {
      if (!(line > 0) || !route.length) return 0;
      return Math.max(0, Math.min(1, 1 - routeLeft() / line));
    },
    /** Which of her three lines is on screen, 1..3, or 0 for none. */
    get line() { return say(); },
    /** Debug: skip to the race over and her at the foot of the ladder. */
    skip(dv) {
      if (!on || !jad) return false;
      const f = foot();
      her.x = f[0]; her.z = f[1];
      racing = false; result = result || 'arrived';
      phase = 'queue'; t = 0;
      if (dv) { const d = BAYE_DIVES.find((x) => x.id === dv); if (d) bag = [d]; }
      return true;
    },
    /** Debug: hold her the frame she is `f` of the way through her next flight. */
    freezeAt(f) { freezeFrac = f; frozen = false; return true; },
    thaw() { frozen = false; freezeFrac = null; return true; },
    /** Debug: hold her where she is, now — any phase. */
    freeze() { frozen = true; return true; },
    get frozen() { return frozen; },
    /** Debug: the next dive she will do. */
    nextIs(dv) { const d = BAYE_DIVES.find((x) => x.id === dv); if (d) { bag = [d]; return true; } return false; },
    stats: () => ({
      on: on ? 1 : 0, phase, racing: racing ? 1 : 0, result,
      gap: +gap.toFixed(1), best: +best.toFixed(1),
      at: [Math.round(her.x), Math.round(her.z)],
      // Unrounded, because `at` is for reading and this is for measuring: a
      // wander whose whole amplitude is a metre and a half does not survive
      // being reported to the nearest metre.
      pos: [+her.x.toFixed(3), +her.z.toFixed(3), +her.yaw.toFixed(4),
        +her.sp.toFixed(3)],
      y: +her.y.toFixed(2),
      through: +(line > 0 && route.length ? 1 - routeLeft() / line : 0).toFixed(2),
      leg, legs: route.length,
      t: +t.toFixed(1),
      goggles: +gog.toFixed(2), dives, dive: dive ? dive.id : null,
      ms: +ms.toFixed(3), msDraw: +msDraw.toFixed(3),
      tower: bp ? bp.stats().mode : null, rider: bp ? bp.stats().rider : null,
      clip: fig ? fig.playing() : null,
      entry: lastEntry ? { id: lastEntry.id, word: lastEntry.word, score: lastEntry.score,
        dev: lastEntry.dev, turns: lastEntry.turns } : null,
    }),
  };
}
