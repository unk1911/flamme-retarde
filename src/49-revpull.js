// -----------------------------------------------------------------------------
// Roles reversed: Chloe's fist in your hair (1.574.0).
//
// Misha, 2 Oct 2026: *"during the role reversal, does Chloe ever pull me by
// the hair, when she is excited? ... Just like I (Chloe) sometimes pull
// baye's hair, she should do it also to me when in role reversal"* — and the
// agreed follow-up: *"can Chloe pull me by my hair and bring my head ...
// towards her ... resulting in me trying to keep my balance by holding her by
// her legs"*, in the version that was agreed: your CHEEK against her SIDE, at
// her hip and waist, your head turned to the side. Never your face to her
// front below the waist; that was declined and is not here.
//
// The same two adults and the same game as src/49-reverse.js, and the
// safeword over all of it: "red" and her fist opens at once.
//
// TWO MOVES OF HERS, as `rvm.move`s (src/49-revmoves.js runs her body, her
// arms, her look; this file asks for them):
//
//   THE PULL FROM BEHIND (`pull`). You face down on the cot, on all fours,
//   kneeling or standing. (Bent over the cot's edge your head lies on the
//   far side of the cot by the wall, out of her reach from any floor; since
//   1.575.0 she has you up on your knees on the cot first, then takes it.)
//   She goes where her arm reaches the back of your head from (`rvmPlan`,
//   checked to be behind you or beside your shoulders), her hand closes on
//   your hair where the player's own hand closes on Baye's (`hairGrab`,
//   1.545.0), and she pulls your head back. YOUR BODY is 1.545.0's
//   `PULL_RAG` — the very net the player pulls Baye's hair with, because the
//   body you are in IS Baye's: her trunk and head as four ragdoll bodies,
//   the hips held, the hair a spring to the fist, the gasp. Her fist is
//   drawn wherever the net says it is (`hairPullAt`), her palm solved on to
//   it every frame and measured, and she leans back as she pulls. Your hands
//   brace: face down your palms go flat to the mattress beside your
//   shoulders; on all fours they stay planted where they were while your
//   chest comes up. Your view goes back with your head — the first-person
//   camera tipped up toward the ceiling and her, clamped. Two to four
//   seconds, and now and then her other hand spanks you while she holds
//   (1.565.0's strike, from where she already is). Then it eases back.
//
//   THE KNEELING DRAW (`draw`). You on your knees on the floor, she standing
//   beside you, her side to you. Her fist in your hair draws you in until
//   your cheek rests against her side at the hip, your head turned along
//   her, your face kept well round her side and off her front, and your
//   arms go round her leg for balance — both palms solved on to her thigh,
//   measured off her skin. Then she turns her shoulders to you and tips your
//   head back so you look up at her face, holds it a beat with a line, and
//   lets you go.
//
// While her hand is in your hair your body stays facing where it faces
// (`rvhWho`): on your knees it would otherwise turn after her.
//
// WHEN: her excitement — her heat high, a run of orders kept, during or just
// after a spanking or her hands on a toy — weighted in her selector, and never
// twice inside `cool` seconds; when you ask ("pull my hair", "povuci me za
// kosu", "tire-moi les cheveux"; "draw me in", "hold me against you"); or a
// key, `.` the pull and `,` the draw. The draw wants you kneeling, and warm
// enough she orders you down on your knees first.
// -----------------------------------------------------------------------------

const RVH = {
  pull: {
    hold: [2.2, 3.6],        // s her fist stays shut
    up: 0.15,                // m over her shoulder she pulls toward (PULL_RAG takes 0.25 off)
    // Your view: rad up, held and at the yank (a 30-degree tip), eased; and
    // never past this much over level, whatever the mouse had.
    cam: 0.50, yank: 0.10, camMax: 0.85, camRate: 7,
    spank: 0.40,             // chance (plus heat) her other hand spanks you while she holds
    fist: 0.27,              // m her fist is kept off her shoulder as she pulls (she leans back for it)
    reachT: 7,               // s to get there before she gives up
    leanAfter: 0.6,          // s into the hold before she leans back with it
    spankAfter: 1.3,         // s into the hold before her other hand starts (your head up by then)
  },
  draw: {
    // Your trunk bowed toward her (rad, the most), your head turned to lay the
    // cheek on her (rad: neck and the top of the spine between them).
    bowMax: 0.80, turn: 1.40, trunk: 0.22,
    // The cheek's gap to her side it closes on, m; and the band of her side
    // it may rest on, m off the floor (her hip to her waist).
    gap: 0.015, band: [0.86, 1.08],
    // Her step in to you as you come to her: m at most, m/s.
    slide: 0.35, slideV: 0.25,
    // Her stand spot moved by what that step and the guard on her front
    // always did (m along your forward, along her facing) — see `rvhDrawPlan`.
    planFl: -0.06, planF: 0.13, dead: 0.015,
    // The look up: how much of your bow toward her you keep (0..1). None
    // since 1.575.0: your head comes up off her side, upright, before you
    // look up at her. Keeping half of it left your eye under her armpit and
    // her upper arm level across your view between you and her face
    // (photographed, first person, three draws in three); upright, her face
    // is clear and her arm is below it.
    upKeep: 0,
    // How far along her your turned head carries your cheek from your own middle line, m.
    turnShift: 0.10,
    // Your face at least this far (m) from the middle of her front below the
    // waist — the agreed version's line; she keeps it with her feet.
    frontMin: 0.19,
    // Her shoulders turned to you and bowed a little, looking down at you (rad;
    // on her spine a + turn is to her left, MEASURED off her chest: + with you on her left).
    herTurn: 0.8, herBow: 0.25,
    // Where on her your cheek rests, m off the floor, at most: her hip-bone, below her waist.
    cheekY: 0.98,
    // How far behind the middle of her depth (her +x forward) the point of
    // her side your cheek goes to is, m — her side, not her front.
    back: -0.08,
    // s: her hand to your hair, drawing you in, resting, the look up, holding
    // it, letting go.
    reachT: 6, inT: 1.4, rest: 2.2, upT: 1.0, look: 2.0, outT: 1.0,
    // Your palms on her thigh: m off the floor (above her knee), and how
    // far into her you may lean for them.
    handY: 0.62, palmOff: 0.016,
  },
  cool: 24,                  // s before she picks it again on her own
  look: 4.5,                 // your view eased to where your head points, 1/s
};

/**
 * Her lines. English (1.569.0), written for her: a Californian in charge,
 * playful. The keys are her beats on the voice service (`CHLOE_BEAT` in
 * server/baye/baye.py), so the words come back in her voice when it can.
 */
const RVH_SAY = {
  hair_pulled: ['Mm. Head up, babe.', 'There it is... I love that little gasp.', 'Arch for me. Just like that.',
    "Who's in charge? Hm?"],
  kneel_draw: ["C'mere. Right here against me.", "Hold on to me, babe. Don't let go."],
  kneel_look: ['Look up at me. Good girl.', 'Eyes on me. That\'s my girl.'],
};

const rvh = {
  M: null,                   // the move in hand (also `rvm.move` while it is on)
  last: -1e9, n: 0,          // when she last did one, and how many
  after: null,               // 'draw' once she has ordered you to your knees for it
  cam: 0, camK: 0,           // your view's tip, wanted and eased (0..1)
  bk: 0,                     // your body's aims (the draw, the brace), eased
  aimed: {},                 // which of Baye's bones this file has an aim on
  log: [], stats: null, slapsWas: 0, slapAt: -1e9,
  // Your arms' feedback (`rvhBayeArm`): the miss, and the goal last sent.
  fbB: { L: { e: new THREE.Vector3(), sent: new THREE.Vector3(), ok: false },
    R: { e: new THREE.Vector3(), sent: new THREE.Vector3(), ok: false } },
};
const _rvhA = new THREE.Vector3(), _rvhB = new THREE.Vector3(), _rvhC = new THREE.Vector3(), _rvhD = new THREE.Vector3();
const _rvhE = new THREE.Vector3(), _rvhF = new THREE.Vector3(), _rvhG = new THREE.Vector3();
const _rvhQ = new THREE.Quaternion(), _rvhQ2 = new THREE.Quaternion(), _rvhQ3 = new THREE.Quaternion();
const _rvhM = new THREE.Matrix4();
const _rvhUP = new THREE.Vector3(0, 1, 0);

function rvhNote(s) { rvh.log.push([+rev.clock.toFixed(1), s]); if (rvh.log.length > 60) rvh.log.shift(); }
function rvhTrace(e) { if (typeof revTrace === 'function') revTrace(e); }
function rvhSay(kind, force = false) {
  return typeof revSay === 'function' ? revSay(kind, force, null, { still: revStill.dom }) : null;
}
const rvhSm = (x) => { const e = Math.min(1, Math.max(0, x)); return e * e * (3 - 2 * e); };

// ── skin, measured ───────────────────────────────────────────────────────────
//
// What touches what is measured on the skin, not on the bones: each figure's
// own bind vertices, skinned on the CPU the way the shader does it (`turn ·
// (v − bind head) + head`, weighted over its four bones), for a few hundred
// vertices picked once by where they are in the bind.

/** Baye's drawn mesh (v2.0, `appr`, when it is the one drawn) and the rig that poses it. */
function rvhBayeSkin() {
  const f = jadrija && jadrija.figure;
  if (!f) return null;
  const m = typeof appr !== 'undefined' && appr && appr.mesh && appr.mesh.visible && appr.data ? appr : f;
  return { rig: f, geo: m.data.geo, mesh: f.mesh, key: m === f ? 'v1' : 'v2' };
}
function rvhChloeSkin() {
  return you && you.fig && you.fig.data ? { rig: you.fig, geo: you.fig.data.geo, mesh: you.mesh, key: 'chloe' } : null;
}

const rvhSets = {};
/**
 * Vertex indices of figure `S` whose strongest bone is one of `bones` and
 * whose bind position passes `test(p, B)` (`p` the bind point, `B` the bind
 * heads by name). Cached by `key`.
 */
function rvhPick(S, key, bones, test, every = 1) {
  const k = S.key + ':' + key;
  if (rvhSets[k]) return rvhSets[k];
  const g = S.geo, pos = g.attributes.position.array, bi = g.attributes.aBoneIdx.array, bw = g.attributes.aBoneWt.array;
  const R = S.rig, BT = R.bindRest().bindT;
  const want = new Set(bones.map((n) => R.boneIndex(n)).filter((i) => i >= 0));
  const B = (n) => { const i = R.boneIndex(n); return i < 0 ? null : [BT[3 * i], BT[3 * i + 1], BT[3 * i + 2]]; };
  const out = [];
  const nv = pos.length / 3;
  for (let i = 0, c = 0; i < nv; i++) {
    let top = 0, tb = -1;
    for (let j = 0; j < 4; j++) if (bw[4 * i + j] > top) { top = bw[4 * i + j]; tb = bi[4 * i + j]; }
    if (!want.has(tb)) continue;
    if (!test([pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]], B)) continue;
    if ((c++ % every) === 0) out.push(i);
  }
  rvhSets[k] = out;
  return out;
}

/** Vertex `i` of `S` as drawn, world, into `out` (and its normal into `n`, if asked). */
function rvhSkinAt(S, i, out, n = null) {
  const g = S.geo, pos = g.attributes.position.array, bi = g.attributes.aBoneIdx.array, bw = g.attributes.aBoneWt.array;
  const R = S.rig, BT = R.bindRest().bindT;
  const nrm = n && g.attributes.normal ? g.attributes.normal.array : null;
  out.set(0, 0, 0);
  if (n) n.set(0, 0, 0);
  let tot = 0;
  for (let j = 0; j < 4; j++) {
    const w = bw[4 * i + j];
    if (!w) continue;
    const b = bi[4 * i + j];
    R.boneTurn(b, _rvhQ3);
    _rvhG.set(pos[3 * i] - BT[3 * b], pos[3 * i + 1] - BT[3 * b + 1], pos[3 * i + 2] - BT[3 * b + 2]).applyQuaternion(_rvhQ3);
    R.boneAt(b, _rvhF);
    out.addScaledVector(_rvhG.add(_rvhF), w);
    if (nrm) n.addScaledVector(_rvhG.set(nrm[3 * i], nrm[3 * i + 1], nrm[3 * i + 2]).applyQuaternion(_rvhQ3), w);
    tot += w;
  }
  out.multiplyScalar(1 / (tot || 1)).applyMatrix4(S.mesh.matrixWorld);
  if (n) n.applyQuaternion(S.mesh.quaternion).normalize();
  return out;
}

/** A set, skinned now: an array of world points (and, asked, `{ P, N }` with the normals). */
function rvhSkinSet(S, idx, normals = false) {
  S.mesh.updateMatrixWorld();
  const P = [], N = [];
  for (const i of idx) {
    const n = normals ? new THREE.Vector3() : null;
    P.push(rvhSkinAt(S, i, new THREE.Vector3(), n));
    if (n) N.push(n);
  }
  return normals ? { P, N } : P;
}

/** The nearest pair between two point sets: { d, a, b, i, j }. */
function rvhNearest(A, B) {
  let best = { d: Infinity, i: -1, j: -1 };
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    for (let j = 0; j < B.length; j++) {
      const b = B[j];
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, d = dx * dx + dy * dy + dz * dz;
      if (d < best.d) best = { d, i, j };
    }
  }
  best.d = Math.sqrt(best.d);
  best.a = A[best.i] || null; best.b = B[best.j] || null;
  return best;
}

// Baye's head regions, off her head bone's bind head (+x forward, +y up, +z
// her right): the cheek (side `sg`) and her face.
function rvhCheekIdx(sg) {
  const S = rvhBayeSkin();
  return S ? rvhPick(S, 'cheek' + sg, ['head'], (p, B) => {
    const h = B('head'); if (!h) return false;
    const x = p[0] - h[0], y = p[1] - h[1], z = (p[2] - h[2]) * sg;
    return x > 0.015 && x < 0.115 && y > 0.0 && y < 0.085 && z > 0.035;
  }) : [];
}
function rvhFaceIdx() {
  const S = rvhBayeSkin();
  return S ? rvhPick(S, 'face', ['head'], (p, B) => {
    const h = B('head'); if (!h) return false;
    const x = p[0] - h[0], y = p[1] - h[1], z = p[2] - h[2];
    return x > 0.075 && y > -0.01 && y < 0.13 && Math.abs(z) < 0.045;
  }, 8) : [];
}
// Chloe: her side at the hip and waist (side `sg`, her +z her right), her
// front below the waist, and a ring round her thigh (side `sg`) at
// `RVH.draw.handY`.
function rvhSideIdx(sg) {
  const S = rvhChloeSkin();
  return S ? rvhPick(S, 'side' + sg, ['pelvis', 'spine01', 'spine02', 'legUL', 'legUR'], (p) =>
    p[1] > 0.80 && p[1] < 1.16 && p[2] * sg > 0.08 && Math.abs(p[0]) < 0.12) : [];
}
function rvhFrontIdx(wide = false) {
  const S = rvhChloeSkin();
  return S ? rvhPick(S, wide ? 'frontW' : 'front', ['pelvis', 'spine01', 'legUL', 'legUR'], (p, B) => {
    const pv = B('pelvis'); if (!pv) return false;
    // Below her waist (the pelvis bone's head is at her waist's height,
    // near enough: the band is to the top of her thighs), in front of her
    // middle: the middle of her front, or (`wide`) all of it to her hips.
    return p[1] < pv[1] + 0.06 && p[1] > 0.62 && p[0] > pv[0] + 0.02 && Math.abs(p[2]) < (wide ? 0.13 : 0.09);
  }) : [];
}
function rvhThighIdx(sg) {
  const S = rvhChloeSkin();
  return S ? rvhPick(S, 'thigh' + sg, [sg > 0 ? 'legUR' : 'legUL', sg > 0 ? 'legLR' : 'legLL'],
    (p) => Math.abs(p[1] - RVH.draw.handY) < 0.035 && p[2] * sg > 0) : [];
}

// ── your arms (Baye's), solved ───────────────────────────────────────────────

let rvhArmDef = null;
/** Her (Baye's) two arms off the bind: bone indices, lengths, each elbow's hinge. */
function rvhBayeArms() {
  if (rvhArmDef) return rvhArmDef;
  const f = jadrija && jadrija.figure;
  if (!f) return null;
  const B = f.bindRest(), T = B.bindT;
  const out = {};
  for (const s of ['L', 'R']) {
    const iu = f.boneIndex('armU' + s), il = f.boneIndex('armL' + s), ih = f.boneIndex('hand' + s), ifg = f.boneIndex('fingers' + s);
    if (iu < 0 || il < 0 || ih < 0) return null;
    const ip = f.bones[iu].parent;
    const u = new THREE.Vector3(T[3 * il] - T[3 * iu], T[3 * il + 1] - T[3 * iu + 1], T[3 * il + 2] - T[3 * iu + 2]);
    const a = new THREE.Vector3(T[3 * ih] - T[3 * il], T[3 * ih + 1] - T[3 * il + 1], T[3 * ih + 2] - T[3 * il + 2]);
    out[s] = { iu, il, ih, ifg, ip, e: u.clone().cross(a).normalize(), l1: u.length(), l2: a.length(),
      bq: new THREE.Quaternion(B.bindQ[4 * iu], B.bindQ[4 * iu + 1], B.bindQ[4 * iu + 2], B.bindQ[4 * iu + 3]).invert(),
      pq: new THREE.Quaternion(B.bindQ[4 * ip], B.bindQ[4 * ip + 1], B.bindQ[4 * ip + 2], B.bindQ[4 * ip + 3]) };
  }
  rvhArmDef = out;
  return out;
}

/** Your palm as drawn, world: half way from the wrist to the knuckles (the cot's own measure). */
function rvhBayePalm(s, out) {
  const f = jadrija.figure, A = rvhBayeArms();
  if (!A) return null;
  const a = A[s];
  f.boneAt(a.ih, _rvhA);
  if (a.ifg >= 0) f.boneAt(a.ifg, _rvhB); else _rvhB.copy(_rvhA);
  return out.copy(_rvhA).add(_rvhB).multiplyScalar(0.5).applyMatrix4(f.mesh.matrixWorld);
}
/** Your wrist as drawn, world. */
function rvhBayeWrist(s, out) {
  const f = jadrija.figure, A = rvhBayeArms();
  return A ? f.boneAt(A[s].ih, out).applyMatrix4(f.mesh.matrixWorld) : null;
}
/** Your shoulder as drawn, world. */
function rvhBayeShoulder(s, out) {
  const f = jadrija.figure, A = rvhBayeArms();
  return A ? f.boneAt(A[s].iu, out).applyMatrix4(f.mesh.matrixWorld) : null;
}

/**
 * YOUR ARM TO A PALM POINT, side `s`: the palm (as the cot measures it) to
 * world point `T`, the elbow toward world direction `pole`, `k` 0..1 of the
 * way from the clip's arm. The chain is the clip's own this frame carried by
 * the collarbone as drawn (so a bow laid on your spine is in it) and the
 * solve is `hingeArm`, the elbow bending on its hinge. The wrist goal is the
 * palm's point less the palm's offset off the wrist as last drawn: a frame's
 * feedback, which is how the measured error gets to millimetres.
 */
function rvhBayeArm(s, T, pole, k) {
  const A = rvhBayeArms(), f = jadrija && jadrija.figure;
  if (!A || !f || !jadrija.hingeArm) return false;
  const a = A[s];
  const R = f.bindRest(), L = f.local();
  _rvhM.copy(f.mesh.matrixWorld).invert();
  const S = f.boneAt(a.iu, new THREE.Vector3());
  const qP = f.boneTurn(a.ip, new THREE.Quaternion()).multiply(a.pq);
  const lq = L.q;
  const qU = qP.clone().multiply(new THREE.Quaternion(lq[4 * a.iu], lq[4 * a.iu + 1], lq[4 * a.iu + 2], lq[4 * a.iu + 3]));
  const E = new THREE.Vector3(R.t[3 * a.il], R.t[3 * a.il + 1], R.t[3 * a.il + 2]).applyQuaternion(qU).add(S);
  const qL = qU.clone().multiply(new THREE.Quaternion(lq[4 * a.il], lq[4 * a.il + 1], lq[4 * a.il + 2], lq[4 * a.il + 3]));
  const W = new THREE.Vector3(R.t[3 * a.ih], R.t[3 * a.ih + 1], R.t[3 * a.ih + 2]).applyQuaternion(qL).add(E);
  // THE HINGE THE CLIP'S ARM IS ACTUALLY BENT ON: upper arm × forearm as the
  // clip has them. The bind's elbow axis carried by the upper arm is right for
  // an arm the clip holds in its own plane; on your knees (`kept`, hands
  // behind your back) the forearm is wrung well out of it, and `hingeArm`
  // keeps whatever is out of the plane — your palm 20 cm off its goal, the
  // same every frame, MEASURED. Bent in its own plane the miss is the
  // feedback's few millimetres. A straight arm has no plane: the bind's.
  const cr = new THREE.Vector3().crossVectors(E.clone().sub(S), W.clone().sub(E));
  const hinge = cr.length() > 0.08 * a.l1 * a.l2 ? cr.normalize() : a.e.clone().applyQuaternion(qU.clone().multiply(a.bq));
  // The wrist: the palm's point less where the palm sits off the wrist now.
  const palm = rvhBayePalm(s, new THREE.Vector3()), wr = rvhBayeWrist(s, new THREE.Vector3());
  const Gw = T.clone().sub(palm.sub(wr));
  // AND THE MISS TAKEN OFF (`fb`, as her own arms do it in 49-revmoves.js).
  // `hingeArm` closes the elbow about its hinge and keeps whatever the clip's
  // forearm has out of that plane — on your arms in `flatheld`, eight degrees
  // of it, which is a wrist 34 mm off its goal, MEASURED, the same whatever
  // the goal. Where the wrist was drawn against where it was sent is that
  // miss; it changes slowly, so the next goal is sent that much the other way.
  const fb = rvh.fbB[s];
  if (fb.ok) {
    fb.e.lerp(_rvhA.copy(wr).sub(fb.sent), 0.8);
    if (fb.e.length() > 0.10) fb.e.setLength(0.10);
  } else fb.e.set(0, 0, 0);
  const full = k >= 0.995;
  if (full) Gw.sub(fb.e);
  fb.sent.copy(Gw); fb.ok = full;
  const G = Gw.clone().applyMatrix4(_rvhM);
  G.lerpVectors(W, G, Math.max(0, Math.min(1, k)));
  const P = pole.clone().applyQuaternion(_rvhQ.copy(f.mesh.quaternion).invert());
  // For a probe: last frame's wrist goal against the wrist as now drawn, and
  // the clip's own wrist (this chain, unaimed) against the target's reach.
  rvh.armDbg = rvh.armDbg || {};
  const was = rvh.armDbg[s];
  rvh.armDbg[s] = { G: G.clone().applyMatrix4(f.mesh.matrixWorld), T: T.clone(),
    palmMiss: was ? +was.T.distanceTo(rvhBayePalm(s, new THREE.Vector3())).toFixed(4) : null,
    fb: +(fb.e.length() * 1000).toFixed(1), reach: +G.distanceTo(S).toFixed(3), l: +(a.l1 + a.l2).toFixed(3) };
  jadrija.hingeArm(f, 'armU' + s, 'armL' + s, S, E, W, hinge, G, P);
  rvh.aimed['armU' + s] = rvh.aimed['armL' + s] = true;
  return true;
}

/** Aim one of your bones (figure space), remembered so it can be taken off. */
function rvhAim(name, q) {
  const f = jadrija && jadrija.figure;
  if (!f) return;
  armAimQ(f, name, q);
  rvh.aimed[name] = true;
}
/** Every aim this file laid on you, off. */
function rvhUnaim() {
  const f = jadrija && jadrija.figure;
  if (!f) return;
  for (const n of Object.keys(rvh.aimed)) f.aim(n, 0, 0, 1, 0);
  rvh.aimed = {};
  rvh.fbB.L.ok = rvh.fbB.R.ok = false;
}

// ── where things are ─────────────────────────────────────────────────────────

/**
 * Your BODY's axes, world, level: the way the front of your chest faces and
 * your right — not the figure's (a clip carries its root's turn: on your
 * knees you face round to her, MEASURED, and the draw planned off the
 * figure put her behind you). `fq` turns a world axis into the figure's
 * frame, where an aim is laid.
 */
function rvhYourAxes() {
  const f = jadrija && jadrija.figure;
  if (!f) return null;
  const c = rvhChestFwd();
  const fl = new THREE.Vector3(c.x, 0, c.z);
  if (fl.lengthSq() < 0.05) fl.set(1, 0, 0).applyQuaternion(f.mesh.quaternion).setY(0);
  fl.normalize();
  const rl = new THREE.Vector3().crossVectors(fl, _rvhUP).normalize();
  const fq = f.mesh.quaternion.clone().invert();
  return { fw: fl, rt: rl, fl, rl, fq };
}

/** The way the front of your chest faces, world. */
function rvhChestFwd() {
  const f = jadrija && jadrija.figure;
  if (!f) return new THREE.Vector3(1, 0, 0);
  const i = f.boneIndex('chest');
  return new THREE.Vector3(1, 0, 0).applyQuaternion(f.boneTurn(i, _rvhQ)).applyQuaternion(f.mesh.quaternion).normalize();
}

/** Her eye, world (for the pull's way, and your look up). */
function rvhChloeFace(out) {
  const f = you && you.fig;
  if (!f) return out.set(rev.ch.x, rev.ch.y + 1.55, rev.ch.z);
  const hi = f.boneIndex('head');
  you.mesh.updateMatrixWorld();
  f.boneAt(hi, out).applyMatrix4(you.mesh.matrixWorld);
  return out.add(_rvhA.set(0.10, 0.07, 0).applyQuaternion(f.boneTurn(hi, _rvhQ)).applyQuaternion(you.mesh.quaternion));
}

// ── her choices ──────────────────────────────────────────────────────────────

/** Whether she can do this now at all: not with her hand full, not mid-something. */
function rvhFree(asked) {
  if (!rev.on || rev.care) return 'off';
  if (typeof rvkHandFull === 'function' && rvkHandFull()) return 'her hand is full';
  if (typeof rvkBusy === 'function' && rvkBusy()) return 'busy';
  if (!asked && (rvm.move || rev.arm.mode === 'spank')) return 'busy';
  if (rvm.move && rvm.move.id === 'care') return 'aftercare';
  return true;
}

/**
 * Her moves here, for `revDecide`: `[{ id, s }]`. Her excitement: heat over
 * the middle, a run of orders kept, a spanking or her hands on a toy in the
 * last fifteen seconds. Never inside `cool` seconds of the last.
 */
function rvhCands(ctx, D) {
  const out = [];
  if (!ctx || rvhFree(false) !== true) return out;
  if (rev.clock - rvh.last < RVH.cool) return out;
  const recent = (id) => D.last.slice(-5).includes(id);
  if (recent('hair:pull') || recent('hair:draw') || recent('hair:kneel') || recent('hair:upcot')) return out;
  const v = revView();
  const edge = v && v.phase === 'edgeHeld';
  // Spanked or toyed with just now: the slaps counter and her toy moves.
  const hot = rev.clock - rvh.slapAt < 15 || D.last.slice(-3).some((x) => x === 'spank' || x === 'toy' || x === 'remote' || x === 'swap');
  const ex = Math.max(0, D.heat - 0.4) * 1.6 + 0.12 * Math.min(3, D.streak) + (hot ? 0.35 : 0);
  if (ex < 0.15) return out;
  if (!edge && (ctx === 'front' || ctx === 'fours' || ctx === 'kneel' || ctx === 'cotKneel' || ctx === 'stand')) {
    out.push({ id: 'hair:pull', s: (ctx === 'stand' ? 0.5 : 1) * (0.15 + 0.6 * ex) });
  }
  // Bent over the edge, your head is out of her reach (1.575.0): up on your
  // knees on the cot first, then her fist in your hair from beside you.
  if (edge && !(rev.dom.order)) out.push({ id: 'hair:upcot', s: 0.8 * (0.15 + 0.6 * ex) });
  if (ctx === 'kneel') out.push({ id: 'hair:draw', s: 0.12 + 0.5 * ex });
  // Standing, and warm: on your knees first, then the draw.
  if (ctx === 'stand' && D.heat > 0.55) out.push({ id: 'hair:kneel', s: 0.10 + 0.3 * ex });
  return out;
}

/** Her pick, from `revDecide`: 'hair:pull' | 'hair:draw' | 'hair:kneel'. */
function rvhChoose(id, why) {
  const k = id.slice(5);
  if (k === 'kneel') {
    rvh.after = { what: 'draw', until: rev.clock + 16 };
    return typeof revOrder === 'function' ? revOrder('kneel', 'hair: ' + why) : 'no order';
  }
  if (k === 'upcot') return rvhUpCot('hair: ' + why);
  return rvhStart(k, why);
}

/**
 * Bent over the cot's edge, her fist cannot reach your hair: your head lies
 * on the far side by the wall, 0.6-0.8 m from every floor she can stand on
 * (MEASURED, 1.574.0). Since 1.575.0 she does not give up on it: she has you
 * up on your knees on the cot (4), and once you are, she takes it from
 * beside your shoulders (MEASURED: her palm 0.4 mm median on the fist). Not
 * on your tummy: from the edge that lays you along the cot with your head at
 * its wall end, 60 cm from her again.
 */
function rvhUpCot(why) {
  rvh.after = { what: 'pull', until: rev.clock + 18, asked: /^asked/.test(why) };
  return typeof revOrder === 'function' ? revOrder('upcot', why) : 'no order';
  return rvhStart(k, why);
}

/** A spot at the back of your head, high (`u` 0 the crown, 1 the nape), and its normal. */
function rvhHairSpot(Hd, u) {
  const n = Hd.up.clone().multiplyScalar(0.75 - 0.6 * u).addScaledVector(Hd.fw, -0.70).normalize();
  return { T: Hd.C.clone().addScaledVector(n, 0.105), n };
}

/**
 * Start `kind` ('pull' | 'draw'). Answers true or why not. Asked (`why`
 * 'asked'), whatever she was in the middle of gives way to it.
 */
function rvhStart(kind, why = 'mood') {
  const asked = why === 'asked';
  const fr = rvhFree(asked);
  if (fr !== true) return fr;
  const v = revView();
  const ctx = v ? v.ctx : null;
  if (kind === 'pull') {
    if (!(ctx === 'front' || ctx === 'fours' || ctx === 'kneel' || ctx === 'cotKneel' || ctx === 'stand')) return 'not from where you are';
    if (!jadrija.hairGrab || !jadrija.hairPull) return 'no hair';
    // Bent over the cot's edge your head lies on the far side of it, by the
    // wall: from the floor her arm does not reach it (0.6-0.8 m short of
    // it, MEASURED from every place the room has), and she is not climbing
    // on to the cot to get it.
    if (v.phase === 'edgeHeld') return 'edge';
    const g = jadrija.hairGrab();
    const Hd = rvmYourHead();
    if (!g || !Hd) return 'no hair to take';
    if (asked) rvhYield();
    const T = new THREE.Vector3(g.x, g.y, g.z);
    // The way out of you at the grab, for the plan: out of your head's middle
    // through it, and up — her hand comes at your hair from outside it. (Not
    // the hair's own line: face down the braid lies on the mattress and runs
    // UP to your scalp, and a hand planned from under it is under the cot.)
    const n = rvhGrabNormal(T, Hd);
    // With a spank under it, the plan reaches your bottom with her right and
    // your hair with her left; else her right hand alone.
    const sp = ctx !== 'cotKneel' && Math.random() < RVH.pull.spank + 0.3 * rev.dom.heat;
    let P = null, side = 'R';
    if (sp && typeof rvmSpankSpot === 'function') {
      const butt = rvmSpankSpot(v);
      if (butt) {
        P = rvhPullPlan(ctx, Hd, [{ s: 'L', T, n }, { s: 'R', T: butt.T, n: butt.n }]);
        if (P) side = 'L';
      }
    }
    if (!P) P = rvhPullPlan(ctx, Hd, [{ s: 'R', T, n }]);
    if (!P) return 'no room behind you';
    const M = { id: 'hair', kind, t: 0, ph: 'go', why, ctx, side, plan: P, spank: side === 'L', n0: n,
      dur: RVH.pull.hold[0] + Math.random() * (RVH.pull.hold[1] - RVH.pull.hold[0]), err: [] };
    return rvhBegin(M);
  }
  if (kind === 'draw') {
    if (ctx !== 'kneel') return 'on your knees first (4)';
    if (asked) rvhYield();
    const S = rvhDrawPlan();
    if (!S) return 'no room beside you';
    const M = { id: 'hair', kind, t: 0, ph: 'go', why, ctx, side: S.hand, plan: null, place: S,
      bow: 0, turn: 0, up: 0, err: { L: [], R: [] }, gapMin: 9, gapRest: [], frontMin: 9, intoMin: 9 };
    revGo(S.x, S.z);
    rev.ch.face = new THREE.Vector3(S.x + S.f.x * 3, rev.ch.y, S.z + S.f.z * 3);
    rvm.goal = { x: S.x, z: S.z, yaw: S.yaw, mode: 'stand', bow: 0, w: 0 };
    return rvhBegin(M);
  }
  return 'no such move';
}

/** Out of your head at the grab, and up: the way her hand comes at it. */
function rvhGrabNormal(T, Hd) {
  return T.clone().sub(Hd.C).normalize().add(_rvhA.set(0, 0.6, 0)).normalize();
}

/**
 * Where "behind you" is, level, for her to come from: the back of your head
 * standing or kneeling; on all fours or face down, along you toward your
 * feet and out to the room's side of the cot — beside your shoulders, where
 * a hand pulls a head back and not forward.
 */
function rvhBehind(ctx, Hd) {
  const lying = ctx === 'front' || ctx === 'fours' || ctx === 'cotKneel';
  const bk = new THREE.Vector3(-Hd.fw.x, 0, -Hd.fw.z);
  if (!lying && bk.length() > 0.35) return bk.normalize();
  const hf = jadrija.headFrame ? jadrija.headFrame() : null;
  const along = hf ? new THREE.Vector3(-hf.ax, 0, -hf.az) : bk;
  const G = typeof rvmCotGeom === 'function' ? rvmCotGeom() : null;
  if (ctx === 'front' && G && G.out) along.multiplyScalar(0.55).addScaledVector(G.out, 0.85);
  return along.lengthSq() > 1e-6 ? along.normalize() : null;
}

/**
 * WHERE SHE TAKES YOUR HAIR FROM, by where you are, and kept only if it is
 * that: standing or kneeling, behind your head (MEASURED without the check:
 * the room behind a standing body was the cot, and she went round in front
 * and reached across your face for your nape); on all fours, beside your
 * shoulders, never behind your hips (photographed: kneeling there her body
 * went into yours); face down, wherever her arm reaches the nape from, which
 * on this cot is its head end — your head comes up off the pillow toward her.
 * `reach` as for `rvmPlan`. Answers its plan or null.
 */
function rvhPullPlan(ctx, Hd, reach) {
  const pv = revBone('pelvis', new THREE.Vector3()), nk = revBone('neck', new THREE.Vector3());
  if (!pv || !nk) return null;
  const ax = new THREE.Vector3(nk.x - pv.x, 0, nk.z - pv.z);
  if (ax.lengthSq() < 1e-6) ax.set(Hd.fw.x, 0, Hd.fw.z);
  ax.normalize();
  const across = new THREE.Vector3(-ax.z, 0, ax.x);
  // Behind you is behind your BODY: your head turns (to her, with your look)
  // and kneeling it hangs forward, so its own forward is no guide — MEASURED,
  // she stood in front of you by it and pulled your head down.
  // Nor is the figure's own: a clip carries its root's turn (on your knees
  // you face round to her). The front of your chest is (`pullBack`'s test).
  const back = rvhChestFwd().negate();
  back.y = 0;
  if (back.lengthSq() < 0.05) back.set(-Hd.fw.x, 0, -Hd.fw.z);
  back.normalize();
  const tries = [];
  if (ctx === 'stand' || ctx === 'kneel') {
    if (back.lengthSq() > 0.05) tries.push({ prefer: back.clone().normalize(), K: 3 });
  } else if (ctx === 'fours' || ctx === 'cotKneel') {
    // Upright on your knees on the cot: behind your back first, as kneeling
    // on the floor (1.575.0); then beside your shoulders as on all fours.
    if (ctx === 'cotKneel' && back.lengthSq() > 0.05) tries.push({ prefer: back.clone(), K: 3, behind: true });
    // Her side of you first.
    const sd = (rev.ch.x - pv.x) * across.x + (rev.ch.z - pv.z) * across.z >= 0 ? 1 : -1;
    tries.push({ prefer: across.clone().multiplyScalar(sd), K: 3 }, { prefer: across.clone().multiplyScalar(-sd), K: 3 });
    // And toward your head, either side (1.575.0): knelt up on the cot from
    // its edge the best place beside you scored by your hips, the only plan
    // asked for was refused there, and she gave up ('no room', MEASURED).
    for (const sg of [sd, -sd]) tries.push({ prefer: across.clone().multiplyScalar(sg).addScaledVector(ax, 1.2).normalize(), K: 4 });
  } else {
    tries.push({ prefer: rvhBehind(ctx, Hd), K: 1.5 }, { prefer: null, K: 0 });
  }
  const T = reach[0].T;
  for (const t of tries) {
    const P = rvmPlan(reach, { prefer: t.prefer, preferK: t.K });
    if (!P) continue;
    const dx = P.x - T.x, dz = P.z - T.z;
    if (ctx === 'stand' || ctx === 'kneel' || t.behind) {
      const d = Math.hypot(dx, dz) || 1;
      if ((dx * back.x + dz * back.z) / d / (back.length() || 1) < 0.35) continue;
    } else if (ctx === 'fours' || ctx === 'cotKneel') {
      // Level with your chest or your head — not back by your hips.
      if ((P.x - pv.x) * ax.x + (P.z - pv.z) * ax.z < 0.12) continue;
    }
    return P;
  }
  return null;
}

/** Whatever she is doing gives way to an ask: her move ended, a swing stopped. */
function rvhYield() {
  if (rvm.move && rvm.move.id !== 'care') rvmEnd('asked: hair');
  if (rev.arm.mode === 'spank' && typeof revArmStop === 'function') revArmStop();
}

function rvhBegin(M) {
  if (M.plan) rvmGoPlan(M.plan);
  // YOUR BODY STAYS FACING WHERE IT FACES. On your knees (`kept`) the body
  // you are in turns to whoever it is with — Chloe, since 1.561.0 — and
  // shuffles after her: MEASURED, as she walked round behind you for your
  // hair you turned to face her, and she ended up in front pulling your head
  // down; drawing you in, your head followed her every step. So while her
  // hand is in your hair, the person you are with is a point straight ahead
  // of you (`rvhWho`, read by `revWho`) — inside the 1.35 m past which you
  // would creep after it on your knees.
  const Hd = rvmYourHead(), cf = rvhChestFwd();
  if (Hd) M.who = { x: Hd.C.x + cf.x * 0.8, y: rev.ch.y, z: Hd.C.z + cf.z * 0.8 };
  rvm.move = M;
  rvh.M = M;
  rvh.last = rev.clock; rvh.n++;
  rvh.after = null;
  rvhTrace({ pick: 'hair:' + M.kind, why: M.why, ctx: M.ctx, heat: +rev.dom.heat.toFixed(2),
    place: M.plan ? M.plan.mode + ' bow ' + M.plan.bow.toFixed(2) + (M.spank ? ' +spank' : '') : 'beside you' });
  rvhNote(M.kind + ' (' + M.why + ')');
  return true;
}

/**
 * WHERE SHE STANDS FOR THE DRAW: beside you, square to you, her side to your
 * face, a body's width and your lean in front of you — her hip where your
 * cheek will come to. Of the two ways she can stand (her left side to you or
 * her right) the one the room has space for. Answers { x, z, yaw, f, hand,
 * sg, ... } or null.
 */
function rvhDrawPlan() {
  const X = rvhYourAxes(), Hd = rvmYourHead();
  const P0 = revBone('spine01', new THREE.Vector3());
  const S = rvhChloeSkin();
  if (!X || !Hd || !P0 || !S) return null;
  const D = RVH.draw;
  // Your head bowed in about the bottom of your spine (forward is a turn of
  // −b about your right): the least bow that brings your cheek down into her
  // hip-to-waist band, and no less than a lean you can see.
  const rel = Hd.C.clone().sub(P0);
  const headAt = (b) => rel.clone().applyAxisAngle(X.rl, -b).add(P0);
  let b = 0.25;
  while (b < D.bowMax * 0.8 && headAt(b).y - rev.ch.y > D.band[1] - 0.04) b += 0.03;
  const H1 = headAt(b);
  const cy = Math.max(D.band[0], Math.min(D.band[1], H1.y - rev.ch.y));
  const feet = rvmYourFeet();
  const pos = S.geo.attributes.position.array;
  let best = null;
  for (const sg of [1, -1]) {
    // sg 1: her LEFT side to you, facing your left; your RIGHT cheek on her.
    const fC = X.rl.clone().multiplyScalar(-sg);
    const rC = new THREE.Vector3().crossVectors(fC, _rvhUP).normalize();
    // THE POINT OF HER SIDE YOUR CHEEK GOES TO: on her flank at your
    // cheek's height, a little BEHIND the middle of her depth — so your face,
    // turned along her and a head's depth forward of your cheek, is level
    // with her hip and well off her front (her bind: she stands in her idle
    // much as she is bound).
    // The outermost of her at that height, within a few centimetres of that
    // depth: her flank (scored by depth alone it found the back of her hip,
    // 9 cm out of her middle, MEASURED).
    let vi = -1, vs = Infinity;
    for (const i of rvhSideIdx(-sg)) {
      const y = pos[3 * i + 1], x = pos[3 * i];
      if (Math.abs(y - cy) > 0.035 || Math.abs(x - D.back) > 0.035) continue;
      const sc = -Math.abs(pos[3 * i + 2]) + Math.abs(x - D.back) * 0.3;
      if (sc < vs) { vs = sc; vi = i; }
    }
    if (vi < 0) continue;
    const off = fC.clone().multiplyScalar(pos[3 * vi]).addScaledVector(rC, pos[3 * vi + 2]);
    for (const extra of [0, 0.03, -0.02, 0.06]) {
      // Your cheek, turned on to her, half a head's width out of its middle;
      // the gap; and her root back from her side point.
      // And your head turned on to her carries your cheek a hand along her
      // front-to-back from your middle (`turnShift`, MEASURED).
      const Q = new THREE.Vector3(H1.x, 0, H1.z).addScaledVector(X.fl, 0.072 + D.gap + extra).addScaledVector(fC, D.turnShift);
      // Where she will END UP, not where the bind says (1.575.0): measured
      // over three draws her feet then slid 4-9 cm back along your forward
      // to close on your cheek and 12-16 cm on along her own facing to keep
      // your face off her front — up to 35 cm of sliding feet. Both were
      // the same way every time, so she stands there to begin with.
      Q.addScaledVector(X.fl, D.planFl).addScaledVector(fC, D.planF);
      const x = Q.x - off.x, z = Q.z - off.z;
      const [qx, qz] = ground.confine ? ground.confine(x, z, rev.ch.y) : [x, z];
      if (Math.hypot(qx - x, qz - z) > 0.015 || !jadrija.kabina.room(x, z, 0.12)) continue;
      // Her feet clear of your knees and shins.
      if (feet.some((p) => Math.hypot(p[0] - x, p[1] - z) < 0.16 && p[2] - rev.ch.y < 0.6)) continue;
      const sc = Math.abs(extra) * 3 + (sg > 0 ? 0 : 0.05);
      if (!best || sc < best.sc) best = { sc, x, z, sg, f: fC, yaw: Math.atan2(-fC.x, -fC.z), out: -pos[3 * vi + 2] * sg, bow: b, cy, vi, Q: Q.clone() };
      break;
    }
  }
  if (!best) return null;
  // Her hand on your side of her takes your hair.
  best.hand = best.sg > 0 ? 'L' : 'R';
  // Your right and forward, in your figure's frame: what the bow and the lean turn about.
  best.rFig = X.rl.clone().applyQuaternion(X.fq).normalize();
  best.fFig = X.fl.clone().applyQuaternion(X.fq).normalize();
  best.fl = X.fl.clone(); best.rl = X.rl.clone();
  return best;
}

// ── the frame ────────────────────────────────────────────────────────────────

/**
 * Once a frame from `revTick`, after her body is driven and before her arms
 * are solved (`rvmTick`): the move, your body under it, and your look.
 */
function rvhTick(dt) {
  if (!rev.on) return;
  // A spanking just now (for her excitement).
  if (rev.slaps !== rvh.slapsWas) { rvh.slapsWas = rev.slaps; rvh.slapAt = rev.clock; }
  const M = rvh.M;
  // Ended from outside (the safeword, an ask, you moving out of it).
  if (M && rvm.move !== M) rvhDone(M, 'ended');
  // Her order up on to your knees on the cot kept (1.575.0): now the pull.
  if (rvh.after && rvh.after.what === 'pull') {
    const v = revView();
    if (rev.clock > rvh.after.until) rvh.after = null;
    else if (v && v.ctx === 'cotKneel' && !rev.dom.order && !rvm.move && rev.arm.mode !== 'spank' && !rev.care) {
      const asked = rvh.after.asked;
      rvh.after = null;
      const r = rvhStart('pull', asked ? 'asked' : 'up on the cot');
      if (r !== true) rvhTrace({ pick: 'hair:pull:' + r, why: 'up on the cot' });
    }
  }
  // Her order to kneel kept: now the draw.
  if (rvh.after && rvh.after.what === 'draw') {
    const v = revView();
    if (rev.clock > rvh.after.until) rvh.after = null;
    else if (v && v.ctx === 'kneel' && !rev.dom.order && !rvm.move && rev.arm.mode !== 'spank' && !rev.care) {
      rvh.after = null;
      rvhStart('draw', 'after your knees');
    }
  }
  const N = rvh.M;
  // Debug: an arm of yours held to a point (`__fr.reverse.hair.armTo`).
  if (rvh.dbgArm) for (const s of ['L', 'R']) if (rvh.dbgArm[s]) rvhBayeArm(s, rvh.dbgArm[s].T, rvh.dbgArm[s].pole, 1);
  if (N && N.kind === 'pull') rvhPullTick(N, dt);
  else if (N && N.kind === 'draw') rvhDrawTick(N, dt);
  else {
    rvh.cam = 0;
    // Your body back to the clip, eased: a draw cut short (the safeword, an
    // ask) lets your head and arms come back over half a second, not in a
    // frame; a brace lets go the same way.
    rvhEaseOut(dt);
  }
  rvh.camK = damp(rvh.camK, rvh.cam, rvh.cam > rvh.camK ? RVH.pull.camRate * 1.6 : RVH.pull.camRate * 0.6, dt);
}

/** The move over: her fist opens, your body is eased back, the scene told. */
function rvhDone(M, why) {
  if (M.kind === 'pull' && M.held && jadrija.hairPull) jadrija.hairPull(false);
  // Her shoulders square again after the look down at you.
  if (M.kind === 'draw') { rvm.body.turnTo = 0; rvm.body.bowTo = 0; }
  if (M.kind === 'pull' && M.spank && rev.arm.mode === 'spank' && typeof revArmStop === 'function') revArmStop();
  rvh.M = null;
  rvh.cam = 0;
  if (M.kind === 'draw') rvh.lastDraw = M; else rvh.lastPull = M;
  rvh.stats = rvhSummary(M, why);
  rvhTrace({ pick: 'hair end:' + M.kind, why: why + (rvh.stats.hand ? ' | hand ' + rvh.stats.hand.med + ' mm' : '') });
  if (rvm.move === M) rvmEnd(why);
}

/** What one move measured — see `__fr.reverse.hair.last()`. */
function rvhSummary(M, why) {
  const mm = (a) => {
    if (!a || !a.length) return null;
    const L = Array.from(a).sort((x, y) => x - y), q = (f) => +(L[Math.min(L.length - 1, Math.floor(f * L.length))] * 1000).toFixed(1);
    return { n: L.length, mean: +(L.reduce((x, y) => x + y, 0) / L.length * 1000).toFixed(1), med: q(0.5), p90: q(0.9),
      max: +(L[L.length - 1] * 1000).toFixed(1) };
  };
  const o = { kind: M.kind, why, t: +M.t.toFixed(2), side: M.side };
  if (M.kind === 'pull') {
    o.hand = mm(M.err); o.handYank = mm(M.errY); o.handLog = M.err.log || null; o.fistD = M.fistD != null ? +M.fistD.toFixed(3) : null;
    o.head = M.rag || null;
    o.cam = M.camMax != null ? +(M.camMax * 57.3).toFixed(1) : null;
    o.spank = !!M.spanked;
    o.brace = M.brace ? { L: mm(M.brace.L), R: mm(M.brace.R), dbg: M.brace.dbg || null } : null;
    o.reachMiss = M.reachMiss;
  } else {
    o.handL = mm(M.err.L); o.handR = mm(M.err.R);
    o.handUpL = M.errUp ? mm(M.errUp.L) : null; o.handUpR = M.errUp ? mm(M.errUp.R) : null;
    o.gapRest = mm(M.gapRest);
    o.gapMin = +(M.gapMin * 1000).toFixed(1);
    o.frontMin = +(M.frontMin * 1000).toFixed(1);
    o.frontWide = M.frontWide != null ? +(M.frontWide * 1000).toFixed(1) : null;
    o.slid = +(M.slid || 0).toFixed(3); o.slidFront = +(M.slidF || 0).toFixed(3);
    o.hairHand = mm(M.hairErr); o.hairHandLook = mm(M.hairLook); o.hairHandMoving = mm(M.hairMove);
    o.hairLookLog = M.hairLook && M.hairLook.log ? M.hairLook.log.slice(0, 6) : null;
    o.bow = +(M.bowAt || 0).toFixed(2);
    o.cheekY = M.cheekY != null ? +M.cheekY.toFixed(3) : null;
  }
  return o;
}

/** Her hand in your hair (side `s`), this frame: an ask of `rvmArms`, and its miss. */
function rvhHairHand(s, T, n, d, pole, errs, k = 1) {
  // The last frame's ask against where the palm was drawn for it: the miss.
  if (rvh.sent && rvh.sent.s === s && rvm.k[s] > 0.97 && errs) {
    const p = rvmPalm(s, _rvhD);
    if (p) {
      errs.push(p.distanceTo(rvh.sent.T));
      // Per frame, with what her other hand is doing (`__fr.reverse.hair.errs()`).
      const shD = rvmShoulder(s, _rvhE);
      const dSh = shD && rvh.shWas ? +(shD.distanceTo(rvh.shWas) * 1000).toFixed(0) : null;
      const dT = rvh.tWas ? +(rvh.sent.T.distanceTo(rvh.tWas) * 1000).toFixed(0) : null;
      if (shD) rvh.shWas = shD.clone();
      rvh.tWas = rvh.sent.T.clone();
      (rvh.errTr = rvh.errTr || []).push([+rev.clock.toFixed(3), +(errs[errs.length - 1] * 1000).toFixed(1), rev.arm.mode ? rev.arm.ph : '-', dSh, dT]);
      if (rvh.errTr.length > 600) rvh.errTr.shift();
      // For a probe: the miss, how far her shoulder was from it, and the
      // solve's own shortfall (past her reach), now and then.
      if (errs.length % 6 === 1) {
        const sh = rvmShoulder(s, _rvhE);
        (errs.log = errs.log || []).push([+(rev.clock).toFixed(2), +(errs[errs.length - 1] * 1000).toFixed(1),
          sh ? +sh.distanceTo(rvh.sent.T).toFixed(3) : null, rvm.last && rvm.last[s] ? rvm.last[s].short : null]);
      }
    }
  }
  // A softer correction (1.575.0): at the full 0.8 it rang with a
  // three-frame period while her other hand swung, 5/13/19 mm round and
  // round (MEASURED); at 0.5 it settles.
  rvmAsk(s, { C: T.clone(), n: n.clone(), d: d.clone(), pole, cock: 0.05, shape: 'grip', rate: 9 * k, fb: true, fbK: 0.5 });
  rvh.sent = { s, T: T.clone() };
}

// ── the pull ─────────────────────────────────────────────────────────────────

function rvhPullTick(M, dt) {
  M.t += dt;
  const s = M.side;
  const Hd = rvmYourHead();
  if (!Hd) { rvhDone(M, 'no head'); return; }
  const { r } = rvmAxes(rev.ch.yaw);
  const pole = (s === 'R' ? r.clone() : r.clone().negate()).add(_rvhA.set(0, -0.45, 0)).normalize();
  if (M.ph === 'go') {
    if (M.plan.mode === 'kneel' && revAt()) rvmWant('kneel');
    // Walked there and down on her knees first (a slow approach round the
    // cot's end is a walk, not a reason to reach from where she stands).
    if (rvmSettled() || M.t > RVH.pull.reachT + (rvm.body.want !== rvm.body.mode ? 2 : 0)) {
      M.ph = 'reach'; M.t0 = M.t; rvm.body.bowTo = M.plan.bow;
    }
    return;
  }
  if (M.ph === 'reach') {
    // To where her hand will close: the player's own grab on Baye.
    const g = jadrija.hairGrab();
    if (!g) { rvhDone(M, 'no hair'); return; }
    const T = new THREE.Vector3(g.x, g.y, g.z);
    const n = rvhGrabNormal(T, Hd);
    const sh = rvmShoulder(s, _rvhB);
    if (sh) { const need = sh.distanceTo(T) - RVM.reach; rvm.body.bowTo = Math.max(0, Math.min(RVM.bowMax + 0.2, rvm.body.bowTo + need * dt * 3)); }
    rvhHairHand(s, T.clone().addScaledVector(n, 0.015), n, _rvhUP.clone().negate(), pole, null, 0.8);
    const palm = rvmPalm(s, _rvhC);
    const near = palm ? palm.distanceTo(T) : 9;
    M.near = near;
    // Her hand not there after all that: never a fist shut on the air. Once
    // more from somewhere nearer, then she gives it up.
    if (M.t - M.t0 > 2.5 && near > 0.05) {
      const P = !M.replanned ? rvhPullPlan(M.ctx, Hd, [{ s, T, n }]) : null;
      rvhTrace({ pick: 'hair:reach', why: (near * 100).toFixed(0) + ' cm off, ' + (P ? 'moving' : 'giving up') });
      if (P) { M.replanned = true; M.plan = P; M.spank = false; rvmGoPlan(P); M.ph = 'go'; M.t = 0; return; }
      rvhDone(M, 'out of reach');
      return;
    }
    if ((rvm.k[s] > 0.95 && near < 0.035 && M.t - M.t0 > 0.4) || (M.t - M.t0 > 2.5 && near <= 0.05)) {
      // Her fist shuts, and she pulls toward over her shoulder.
      const e = M.eye = rvhPullEye(s, M);
      M.held = !!jadrija.hairPull(true, e);
      if (!M.held) { rvhDone(M, 'would not take'); return; }
      M.ph = 'hold'; M.t1 = M.t; M.reachMiss = +near.toFixed(3);
      // Your hands brace where there is something to brace on: the mattress,
      // the floor. Kneeling or standing they stay as the clip has them.
      M.brace = M.ctx === 'front' || M.ctx === 'fours' ? { L: [], R: [], at: null } : null;
      rvhSay('hair_pulled', true);
    }
    return;
  }
  if (M.ph === 'hold') {
    const tt = M.t - M.t1;
    jadrija.hairPull(true, M.eye);
    const F = jadrija.hairPullAt ? jadrija.hairPullAt() : null;
    if (F) {
      const T = new THREE.Vector3(F.x, F.y, F.z);
      const n = new THREE.Vector3(-F.hx, -F.hy, -F.hz).normalize();
      rvhHairHand(s, T, n, _rvhUP.clone().negate(), pole, tt > 0.45 ? M.err : tt > 0.05 ? (M.errY = M.errY || []) : null);
      // She leans back with it: the fist comes 26 cm toward her as your head
      // comes up, and she straightens until it is a forearm off her shoulder
      // rather than folded up against it (MEASURED before this, 12-14 cm, her
      // arm shut like a wing). Not while her other hand is swinging, which
      // closes her bow on your bottom itself.
      const sh = rvmShoulder(s, _rvhB);
      // And not through the yank (1.575.0): the fist comes 26 cm in 0.18 s,
      // and her bow chasing it moved the shoulder her arm is solved from by
      // as much again — her palm was 5-10 cm off the fist for a third of a
      // second at every pull, MEASURED. She leans once she has you.
      // Her other hand waiting over your bottom ('ready') does not stop it — the
      // fist is still coming toward her then, and with her bow held it went
      // past her reach: 55 mm off it, every frame of the strike (MEASURED).
      const swing = rev.arm.mode === 'spank' && rev.arm.ph !== 'ready' && rev.arm.ph !== 'go';
      if (sh && !swing && tt > RVH.pull.leanAfter) {
        const d = sh.distanceTo(T);
        rvm.body.bowTo = Math.max(-0.22, Math.min(M.plan.bow + 0.1, rvm.body.bowTo + Math.max(-0.5, Math.min(0.5, (d - RVH.pull.fist) * 4)) * dt));
        M.fistD = d;
      }
    }
    const pr = jadrija.pullRag ? jadrija.pullRag() : null;
    if (pr) M.rag = { pitchMax: pr.pitchMax, chestMax: pr.chestMax, riseMax: pr.riseMax, riseNMax: pr.riseNMax, Fmax: pr.Fmax, rescues: pr.rescues };
    // Your view back with your head: the yank, then held.
    const yk = tt < 0.12 ? tt / 0.12 : tt < 0.30 ? 1 : Math.max(0, 1 - (tt - 0.30) / 0.4);
    rvh.cam = 1 + (RVH.pull.yank / RVH.pull.cam) * yk;
    M.camMax = Math.max(M.camMax || 0, rvhCamTilt()[0]);
    // And your eyes go where your head is pulled (1.575.0): looking round at
    // her behind you when she took it, the first-person view stayed on her
    // face, a neck turned 180 degrees, with the tip-up laid on top of that
    // (photographed). Eased to your head's own forward, level part only —
    // the tip is `rvhCamTilt`'s.
    rvhLookAlong(dt);
    rvhBrace(M, dt);
    // Her other hand, while this one holds you.
    if (M.spank && !M.spanked && tt > RVH.pull.spankAfter && rev.arm.mode == null) {
      M.spanked = true;
      const n = 1 + Math.floor(Math.random() * (1 + rev.dom.heat * 2));
      // From where she is, or not at all: never a step while her fist is in
      // your hair (`stay`, checked before anything of hers moves).
      const rr = typeof rvmSpankStart === 'function' ? rvmSpankStart(n, 'hair held', { stay: true }) : 'none';
      if (rr !== true) { rvhTrace({ pick: 'hair+spank:' + rr }); M.spank = false; }
    }
    if (tt > M.dur && rev.arm.mode !== 'spank') {
      jadrija.hairPull(false);
      M.held = false;
      M.ph = 'out'; M.t2 = M.t;
    }
    return;
  }
  if (M.ph === 'out') {
    const tt = M.t - M.t2;
    rvh.cam = 0;
    rvhBrace(M, dt, true);
    // Her hand comes away from where the fist was (rvmArms eases it back).
    if (tt > 0.65) rvhDone(M, 'done');
  }
}

/**
 * Where her pull goes — what `hairPull` is handed as the puller's eye (it
 * pulls toward 25 cm under it, and out of your back). Level from your head
 * toward her and a little up: your head goes BACK. Her own shoulder was the
 * first cut, and standing over you kneeling it is 40 cm above your head, so
 * the pull was up and not back — 2.5 degrees of head, MEASURED. Face down
 * it is mostly up: your head comes up off the pillow.
 */
function rvhPullEye(s, M) {
  const Hd = rvmYourHead();
  const sh = rvmShoulder(s, new THREE.Vector3()) || new THREE.Vector3(rev.ch.x, rev.ch.y + 1.4, rev.ch.z);
  if (!Hd) return sh.add(_rvhA.set(0, 0.25 + RVH.pull.up, 0));
  const lv = new THREE.Vector3(sh.x - Hd.C.x, 0, sh.z - Hd.C.z);
  if (lv.lengthSq() > 1e-6) lv.normalize();
  const front = M && M.ctx === 'front';
  return Hd.C.clone().addScaledVector(lv, front ? 0.25 : 0.6).add(_rvhA.set(0, 0.25 + (front ? 0.6 : RVH.pull.up), 0));
}

/**
 * YOUR HANDS BRACE. Face down on the cot, your palms come flat to the
 * mattress beside your shoulders as your chest lifts — the start of a push-up.
 * On all fours they stay where they were planted (your chest coming up must
 * not lift them off the floor: riding the chest, MEASURED, they would). On
 * your knees, on your thighs where they are. Solved as your arms always are
 * here: two bones on the elbow's hinge, palm to the point.
 */
function rvhBrace(M, dt, out = false) {
  const v = revView();
  if (!v || v.arms > 0.1) return;
  const B = M.brace;
  if (!B) return;
  // Your body's own axes (a lying body's figure frame is a standing one's):
  // along you, pelvis to neck, and across, left shoulder to right.
  const shL = rvhBayeShoulder('L', new THREE.Vector3()), shR = rvhBayeShoulder('R', new THREE.Vector3());
  const pv = revBone('pelvis', new THREE.Vector3()), nk = revBone('neck', new THREE.Vector3());
  if (!shL || !shR || !pv || !nk) return;
  const along = nk.clone().sub(pv).normalize(), across = shR.clone().sub(shL).normalize();
  if (!B.at) {
    // The palms as they are planted now (before the give is much).
    B.at = {};
    for (const s of ['L', 'R']) {
      const p = rvhBayePalm(s, new THREE.Vector3());
      if (!p) return;
      if (M.ctx === 'front') {
        // Beside your shoulder, flat on the mattress, a hand toward your head.
        const sh = s === 'R' ? shR : shL, sg = s === 'R' ? 1 : -1;
        const top = jadrija.kabina && jadrija.kabina.kit ? jadrija.kabina.kit().cot[2] : p.y;
        p.copy(sh).addScaledVector(_rvhA.set(across.x, 0, across.z).normalize(), 0.09 * sg)
          .addScaledVector(_rvhB.set(along.x, 0, along.z).normalize(), 0.05);
        p.y = top + 0.024;
      }
      B.at[s] = p;
    }
    B.k = 0;
  }
  B.k = damp(B.k || 0, out ? 0 : 1, out ? 6 : 8, dt);
  rvh.bk = Math.max(rvh.bk, B.k);
  for (const s of ['L', 'R']) {
    const T = B.at[s];
    // The elbow out to the side and back toward your hips, as a body bracing
    // on its hands holds it — and up, lying on your front.
    const sg = s === 'R' ? 1 : -1;
    const pole = across.clone().multiplyScalar(sg).addScaledVector(along, -0.5)
      .addScaledVector(_rvhUP, M.ctx === 'front' ? 0.5 : 0).normalize();
    if (B.k > 0.97 && !out && M.t - (M.t1 || 0) > 0.7) {
      const p = rvhBayePalm(s, _rvhC);
      if (p) {
        B[s].push(p.distanceTo(T));
        B.dbg = B.dbg || {};
        B.dbg[s] = [p.toArray().map((x) => +x.toFixed(3)), T.toArray().map((x) => +x.toFixed(3)), +(s === 'R' ? shR : shL).distanceTo(T).toFixed(3)];
      }
    }
    rvhBayeArm(s, T, pole, B.k);
  }
  if (out && B.k < 0.02) { for (const s of ['L', 'R']) { jadrija.figure.aim('armU' + s, 0, 0, 1, 0); jadrija.figure.aim('armL' + s, 0, 0, 1, 0); } }
}

// ── the kneeling draw ────────────────────────────────────────────────────────

/**
 * Your body for the draw, at weights: `bow` rad of your trunk toward her,
 * `turn` 0..1 of your head turned to lay the cheek on her, `up` 0..1 of the
 * look up at her face. Laid on your spine and neck as figure-space aims; your
 * head's own bone is your face's (her expressions turn it), so the neck
 * carries it.
 */
function rvhDrawBody(M) {
  const f = jadrija.figure;
  const D = RVH.draw, sg = M.place.sg;
  // The bow forward is a turn of −bow about your body's right (taken when
  // the draw was planned, in the figure's frame), the turn about up.
  // sg 1: you turn your face to your LEFT (+y), laying your right cheek on her.
  const bow = M.bow, tn = M.turn * D.turn * sg;
  const q = (ax, ay, az, a) => new THREE.Quaternion().setFromAxisAngle(_rvhA.set(ax, ay, az).normalize(), a);
  const r = M.place.rFig, fa = M.place.fFig, lat = M.lat || 0;
  rvhAim('spine01', q(r.x, r.y, r.z, -bow * 0.40).multiply(q(fa.x, fa.y, fa.z, lat * 0.55)));
  rvhAim('spine02', q(r.x, r.y, r.z, -bow * 0.35).multiply(q(fa.x, fa.y, fa.z, lat * 0.45)));
  rvhAim('spine03', q(0, 1, 0, tn * D.trunk).multiply(q(r.x, r.y, r.z, -bow * 0.25)));
  // The neck: the rest of the turn — and on the look up, eased toward the way
  // to her face (what your head as the clip and the trunk hold it needs).
  let qn = q(0, 1, 0, tn * (1 - D.trunk));
  if (M.up > 0.001) {
    const H = revBone('head', new THREE.Vector3());
    const Cf = rvhChloeFace(new THREE.Vector3());
    if (H) {
      const hi = f.boneIndex('head');
      // Your head's forward as drawn, less the neck's own aim of last frame.
      const hq = f.boneTurn(hi, _rvhQ).clone();
      const was = M.qNeck || new THREE.Quaternion();
      const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(was.clone().invert().multiply(hq));
      const want = Cf.sub(H.add(_rvhA.set(0.10, 0.07, 0).applyQuaternion(hq).applyQuaternion(f.mesh.quaternion)));
      want.applyQuaternion(_rvhQ2.copy(f.mesh.quaternion).invert()).normalize();
      const ql = new THREE.Quaternion().setFromUnitVectors(fwd.normalize(), want);
      // At most this far: a neck goes back so far and no further.
      const a = 2 * Math.acos(Math.min(1, Math.abs(ql.w)));
      if (a > 1.45) ql.slerpQuaternions(new THREE.Quaternion(), ql, 1.45 / a);
      qn = qn.slerp(ql, rvhSm(M.up));
    }
  }
  M.qNeck = qn.clone();
  rvhAim('neck', qn);
}

/** After a move: your body eased back to the clip, then every aim off. */
function rvhEaseOut(dt) {
  const D = rvh.lastDraw, P = rvh.lastPull;
  if (D) {
    D.bow = damp(D.bow, 0, 6, dt); D.turn = damp(D.turn, 0, 6, dt); D.up = damp(D.up, 0, 6, dt);
    D.lat = damp(D.lat || 0, 0, 6, dt);
    D.armK = damp(D.armK || 0, 0, 7, dt);
    rvhDrawBody(D);
    if (D.lastT && D.armK > 0.02) for (const s of ['L', 'R']) if (D.lastT[s] && D.pole && D.pole[s]) rvhBayeArm(s, D.lastT[s], D.pole[s], D.armK);
    if (D.bow < 0.01 && D.turn < 0.01 && D.up < 0.01 && D.armK < 0.02) rvh.lastDraw = null;
  }
  if (P) {
    if (P.brace && P.brace.at) rvhBrace(P, dt, true);
    if (!P.brace || !P.brace.at || P.brace.k < 0.02) rvh.lastPull = null;
  }
  if (!rvh.lastDraw && !rvh.lastPull && !rvh.dbgArm && Object.keys(rvh.aimed).length) rvhUnaim();
  rvh.bk = rvh.lastDraw || rvh.lastPull ? 1 : 0;
}

/** The thigh points for your two palms: on her near thigh, front and back. */
function rvhThighSpots(M) {
  const S = rvhChloeSkin();
  if (!S) return null;
  const sg = -M.place.sg;            // her side toward you: her left (−z) when sg is 1
  const idx = rvhThighIdx(sg);
  if (!idx.length) return null;
  const { P, N } = rvhSkinSet(S, idx, true);
  const fw = new THREE.Vector3(1, 0, 0).applyQuaternion(you.mesh.quaternion);
  fw.y = 0; fw.normalize();
  const out = new THREE.Vector3(0, 0, sg).applyQuaternion(you.mesh.quaternion);
  // The most forward and the most rearward of her thigh there, a little round
  // toward you: the front of it and the back.
  let fr = -1, bk = -1, fv = -Infinity, bv = -Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i].dot(fw) + 0.35 * P[i].dot(out), b = -P[i].dot(fw) + 0.35 * P[i].dot(out);
    if (a > fv) { fv = a; fr = i; }
    if (b > bv) { bv = b; bk = i; }
  }
  return { front: { T: P[fr], n: N[fr] }, back: { T: P[bk], n: N[bk] }, fw, out };
}

function rvhDrawTick(M, dt) {
  M.t += dt;
  const D = RVH.draw, s = M.side;
  const Hd = rvmYourHead();
  if (!Hd) { rvhDone(M, 'no head'); return; }
  const { f, r } = rvmAxes(rev.ch.yaw);
  const pole = (s === 'R' ? r.clone() : r.clone().negate()).add(_rvhA.set(0, -0.5, 0)).addScaledVector(f, -0.3).normalize();
  if (M.ph === 'go') {
    if (rvmSettled() || M.t > D.reachT) {
      // THERE, AND SQUARED UP ON IT. Her side was planned off her bind, and
      // standing in her idle, a stride's end off her mark and a few degrees
      // off her turn, the point of her side your cheek goes to is up to 12
      // cm from where it was planned (MEASURED: your lean went to its limit
      // across you chasing it). Once, she shifts her feet by the difference.
      if (!M.squared) {
        M.squared = true;
        const C = rvhChloeSkin();
        const T = C ? rvhSkinAt(C, M.place.vi, new THREE.Vector3()) : null;
        if (T && M.place.Q) {
          const dx = T.x - M.place.Q.x, dz = T.z - M.place.Q.z;
          M.place.shift = +Math.hypot(dx, dz).toFixed(3);
          if (Math.hypot(dx, dz) > 0.02 && Math.hypot(dx, dz) < 0.3) {
            revGo(rev.ch.x - dx, rev.ch.z - dz);
            rvm.goal = { x: rev.ch.x - dx, z: rev.ch.z - dz, yaw: M.place.yaw, mode: 'stand', bow: 0, w: 0 };
            return;
          }
        }
      }
      M.ph = 'reach'; M.t0 = M.t;
    }
    return;
  }
  // Her free hand on her hip, the whole time she has you.
  const o = s === 'L' ? 'R' : 'L', so = o === 'R' ? 1 : -1;
  const hip = new THREE.Vector3(0.035, 1.0, 0.165 * so).applyMatrix4(you.mesh.matrixWorld);
  const hn = new THREE.Vector3(0.15, 0.1, so).applyQuaternion(you.mesh.quaternion).normalize();
  rvmAsk(o, { C: hip.addScaledVector(hn, 0.012), n: hn, d: new THREE.Vector3(0.35, -1, 0.05 * so).applyQuaternion(you.mesh.quaternion),
    pole: new THREE.Vector3(-0.55, 0.15, so).applyQuaternion(you.mesh.quaternion), cock: -0.1, shape: 'hip', rate: 5 });
  // Her hand in your hair: at the back of your head, high.
  // Looking up at her, the back of your head is turned down and away from
  // her (MEASURED: her hand lost it by 13 cm all through the look); her fist
  // goes up on to your crown, a little toward her side of it.
  const hs = rvhHairSpot(Hd, 0);
  if (M.up > 0.001) {
    const sh0 = rvmShoulder(s, new THREE.Vector3());
    if (sh0) {
      // As far back on your crown as her arm reaches (back there her
      // forearm is out of your eyes); toward her side of it if not.
      const toHer = sh0.clone().sub(Hd.C).normalize();
      const tw = new THREE.Vector3();
      for (const w of [0.2, 0.4, 0.6, 0.8, 1.0]) {
        tw.copy(Hd.up).multiplyScalar(0.8).addScaledVector(Hd.fw, -0.55 * (1 - w)).addScaledVector(toHer, 0.25 + 0.6 * w).normalize();
        if (sh0.distanceTo(_rvhG.copy(Hd.C).addScaledVector(tw, 0.105)) < RVM.reach + 0.02) break;
      }
      hs.n.lerp(tw, rvhSm(M.up)).normalize();
      hs.T.copy(Hd.C).addScaledVector(hs.n, 0.105);
    }
  }
  M.hairErr = M.hairErr || []; M.hairMove = M.hairMove || [];
  rvhHairHand(s, hs.T.clone().addScaledVector(hs.n, -0.006), hs.n, Hd.fw.clone().negate().addScaledVector(Hd.up, -0.4), pole,
    M.ph === 'rest' ? M.hairErr : M.ph === 'look' ? (M.hairLook = M.hairLook || []) : M.ph !== 'reach' ? M.hairMove : null, 0.8);
  // And her reach kept by her own bow, as her other moves keep it: turned to
  // you and looking down she would otherwise lose your head.
  {
    const shH = rvmShoulder(s, _rvhB);
    if (shH && M.ph !== 'reach') {
      const need = shH.distanceTo(hs.T) - RVM.reach;
      M.herBow = Math.max(0, Math.min(0.5, (M.herBow || 0) + need * dt * 3));
    }
  }
  if (M.ph === 'reach') {
    const palm = rvmPalm(s, _rvhC);
    if ((rvm.k[s] > 0.95 && palm && palm.distanceTo(hs.T) < 0.04) || M.t - M.t0 > 2.5) { M.ph = 'in'; M.t1 = M.t; }
    return;
  }
  // Measured on the skin, every frame from the draw on: your cheek to her
  // side (signed along her skin's normal — under nought is into her), and
  // your face to her front below the waist.
  //
  // AND HOW THEY MEET. Your bow is chosen for your cheek's HEIGHT — her side
  // between her hip and her waist — and SHE closes the rest: a small step in
  // to you, so the point of her flank a little behind the middle of her
  // depth comes to your cheek. Closing it with your lean instead (the first
  // cut) bowed you to the limit and leaned you sideways chasing a planned
  // point 9-15 cm off the one your turned head arrived at (MEASURED), and
  // your cheek met her low on the hip with your face a handspan from her
  // front. Her step is a foot slid a few centimetres, at most `slide`.
  let gap = null, err = null, pc = null;
  {
    const B = rvhBayeSkin(), C = rvhChloeSkin();
    if (B && C) {
      const cheek = rvhSkinSet(B, rvhCheekIdx(M.place.sg));
      const side = rvhSkinSet(C, rvhSideIdx(-M.place.sg), true);
      const nr = rvhNearest(cheek, side.P);
      gap = nr.a ? nr.a.clone().sub(nr.b).dot(side.N[nr.j]) : null;
      // The point of her side your cheek goes to, at your cheek's height:
      // her outermost at that depth (`back`, her own forward from her root).
      const fC = M.place.f, root = new THREE.Vector3(rev.ch.x, rev.ch.y, rev.ch.z);
      pc = rvhNearest([nr.b || root], cheek).b;
      let bj = -1, bs = Infinity;
      if (pc) {
        for (let k = 0; k < side.P.length; k++) {
          const q = side.P[k], dep = (q.x - root.x) * fC.x + (q.z - root.z) * fC.z;
          if (Math.abs(dep - D.back) > 0.035) continue;
          const out = Math.hypot(q.x - root.x - fC.x * dep, q.z - root.z - fC.z * dep);
          const sc = Math.abs(q.y - pc.y) - out * 0.3;
          if (sc < bs) { bs = sc; bj = k; }
        }
      }
      if (bj >= 0) err = side.P[bj].clone().addScaledVector(side.N[bj], D.gap + 0.004).sub(pc);
      if (M.ph === 'rest' || M.ph === 'in') {
        if (gap != null) { M.gapMin = Math.min(M.gapMin, gap); M.cheekY = nr.b.y - rev.ch.y; }
      }
      const face = rvhSkinSet(B, rvhFaceIdx());
      const front = rvhSkinSet(C, rvhFrontIdx());
      const nf = rvhNearest(face, front);
      if (Number.isFinite(nf.d)) M.frontMin = Math.min(M.frontMin, nf.d);
      const nw = rvhNearest(face, rvhSkinSet(C, rvhFrontIdx(true)));
      if (Number.isFinite(nw.d)) M.frontWide = Math.min(M.frontWide == null ? 9 : M.frontWide, nw.d);
      M.gapNow = gap; M.frontNow = nf.d; M.errNow = err ? err.length() : null;
      // AND YOUR FACE OFF HER FRONT, whatever else, from the moment you lean
      // in: inside `frontMin` of the middle of her front below the waist,
      // she steps on past you (forward, along her own facing), which puts
      // your face further round her side.
      if (M.ph !== 'reach' && Number.isFinite(nf.d) && nf.d < D.frontMin) {
        const st = Math.min(D.frontMin - nf.d, D.slideV * 1.5 * dt);
        rev.ch.x += M.place.f.x * st; rev.ch.z += M.place.f.z * st;
        M.slidF = (M.slidF || 0) + st;
      }
    }
  }
  const sm = rvhSm;
  const close = (k) => {
    if (!err || !pc) return;
    // Your bow: your cheek to its height on her.
    const h = pc.y - rev.ch.y, want = Math.min(M.place.cy, D.cheekY);
    M.bow = Math.max(0.05, Math.min(D.bowMax, M.bow + Math.max(-0.2, Math.min(0.2, h - want)) * dt * k * 0.8));
    // Her step: the level rest, slid.
    const ex = err.x, ez = err.z, el = Math.hypot(ex, ez);
    M.errV = [+(err.dot(M.place.fl) * 1000).toFixed(0), +(err.dot(M.place.rl) * 1000).toFixed(0), +((h - want) * 1000).toFixed(0)];
    if (!M.errV0) { M.errV0 = M.errV.slice(); M.ch0 = [rev.ch.x, rev.ch.z]; }
    M.chMoved = M.ch0 ? +Math.hypot(rev.ch.x - M.ch0[0], rev.ch.z - M.ch0[1]).toFixed(3) : null;
    // Toward you or away along your forward, freely; along her own facing,
    // only where it does not bring your face back toward her front (the
    // guard above has the last word there — the two fighting, MEASURED, slid
    // her feet 45 cm between them).
    const f = M.place.f, efl = err.dot(M.place.fl), efc = ex * f.x + ez * f.z;
    let mx = -M.place.fl.x * efl, mz = -M.place.fl.z * efl;
    if (-efc > 0 || (M.frontNow != null && M.frontNow > D.frontMin + 0.02)) { mx -= f.x * efc; mz -= f.z * efc; }
    const ml = Math.hypot(mx, mz);
    // Not for the last centimetre and a half (1.575.0): the error is read off
    // skin that breathes, and chasing it walked her feet to and fro — 16-21
    // cm of sliding for 8 cm of net step, MEASURED.
    if (ml > 0.002 && el > D.dead && (M.slid || 0) < D.slide) {
      const st = Math.min(ml, D.slideV * dt, D.slide - (M.slid || 0));
      rev.ch.x += mx / ml * st; rev.ch.z += mz / ml * st;
      M.slid = (M.slid || 0) + st;
    }
  };
  if (M.ph === 'in') {
    const u = (M.t - M.t1) / D.inT;
    M.turn = sm(u * 1.15);
    // The bow comes in, and then holds your cheek's height.
    rvm.body.bowTo = M.herBow || 0;
    if (u > 0.5) close(6);
    else M.bow = Math.max(M.bow, M.place.bow * sm(u * 1.6));
    if (u >= 1) { M.ph = 'rest'; M.t2 = M.t; rvhSay('kneel_draw', true); }
  } else if (M.ph === 'rest') {
    close(4); rvm.body.bowTo = M.herBow || 0;
    if (gap != null && M.t - M.t2 > 0.5) M.gapRest.push(gap);
    if (M.t - M.t2 > D.rest) { M.ph = 'up'; M.t3 = M.t; M.bowAt = M.bow; M.bow0 = M.bow; M.lat0 = M.lat || 0; }
  } else if (M.ph === 'up') {
    // Your head tipped back off her side to look up at her — and she turns
    // her shoulders to you and looks down, or from beside her hip all you see
    // looking up is the side of her shirt (photographed, first person).
    const u = sm((M.t - M.t3) / D.upT);
    M.up = u; M.bow = M.bow0 * (1 - (1 - D.upKeep) * u); M.turn = 1 - 0.55 * u; M.lat = M.lat0 * (1 - u);
    rvm.body.turnTo = D.herTurn * M.place.sg * u; rvm.body.bowTo = D.herBow * u + (M.herBow || 0);
    if (u >= 1) { M.ph = 'look'; M.t4 = M.t; rvhSay('kneel_look', true); }
  } else if (M.ph === 'look') {
    rvm.body.turnTo = D.herTurn * M.place.sg; rvm.body.bowTo = D.herBow + (M.herBow || 0);
    if (M.t - M.t4 > D.look) { M.ph = 'out'; M.t5 = M.t; }
  } else if (M.ph === 'out') {
    const u = sm((M.t - M.t5) / D.outT);
    M.bow = M.bow0 * D.upKeep * (1 - u); M.turn = 0.45 * (1 - u); M.up = 1 - u;
    rvm.body.turnTo = D.herTurn * M.place.sg * (1 - u); rvm.body.bowTo = (D.herBow + (M.herBow || 0)) * (1 - u);
    if (u >= 1) { rvh.bk = 1; rvhDone(M, 'done'); return; }
  }
  rvh.bk = 1;
  rvhDrawBody(M);
  // Your arms round her leg: both palms on her near thigh, front and back,
  // once you are leaning in — and off her as you come up.
  const armK = M.ph === 'in' ? sm(((M.t - M.t1) / D.inT - 0.35) / 0.65) : M.ph === 'out' ? 1 - sm((M.t - M.t5) / (D.outT * 0.7)) : 1;
  if (armK > 0.001) {
    const Tg = rvhThighSpots(M);
    if (Tg) {
      const X = rvhYourAxes();
      for (const bs of ['L', 'R']) {
        // Whichever spot is nearer this shoulder.
        const sh = rvhBayeShoulder(bs, new THREE.Vector3());
        const spot = sh.distanceTo(Tg.front.T) < sh.distanceTo(Tg.back.T) ? Tg.front : Tg.back;
        // A hand her leg is out of reach of (coming up to look at her, the
        // back one) lets go and comes back to you, and takes hold again
        // when it is in reach.
        M.armS = M.armS || { L: 1, R: 1 };
        M.armS[bs] = damp(M.armS[bs], sh.distanceTo(spot.T) < 0.52 ? 1 : 0, 6, dt);
        const T = spot.T.clone().addScaledVector(spot.n, D.palmOff);
        if (armK > 0.97 && M.armS && M.armS[bs] > 0.97 && (M.ph === 'rest' || M.ph === 'up' || M.ph === 'look')) {
          const p = rvhBayePalm(bs, _rvhC);
          if (p && M.lastT && M.lastT[bs]) (M.ph === 'rest' ? M.err[bs] : (M.errUp = M.errUp || { L: [], R: [] })[bs]).push(p.distanceTo(M.lastT[bs]));
        }
        M.lastT = M.lastT || {}; M.lastT[bs] = T.clone();
        const sgb = bs === 'R' ? 1 : -1;
        const pl = X.rt.clone().multiplyScalar(sgb).addScaledVector(_rvhUP, -0.2).addScaledVector(X.fw, -0.3).normalize();
        M.pole = M.pole || {}; M.pole[bs] = pl;
        rvhBayeArm(bs, T, pl, armK * M.armS[bs]);
      }
    }
    M.armK = armK;
  } else if (rvh.aimed.armUL || rvh.aimed.armUR) {
    for (const bs of ['L', 'R']) { jadrija.figure.aim('armU' + bs, 0, 0, 1, 0); jadrija.figure.aim('armL' + bs, 0, 0, 1, 0); }
  }
  // Your eyes: where your head points while it rests on her, then up to her face.
  rvhLook(M, dt);
}

/** The walker's yaw eased round to your head's forward, and its pitch to level. */
function rvhLookAlong(dt) {
  const Y = ground && ground.you, f = jadrija.figure;
  if (!Y || !f) return;
  const hi = f.boneIndex('head');
  if (hi < 0) return;
  const d = new THREE.Vector3(1, 0, 0).applyQuaternion(f.boneTurn(hi, _rvhQ)).applyQuaternion(f.mesh.quaternion);
  if (Math.hypot(d.x, d.z) < 0.2) return;
  let dy = Math.atan2(-d.x, -d.z) - Y.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const k = 1 - Math.exp(-RVH.look * dt);
  Y.yaw += dy * k;
  Y.pitch += (0 - Y.pitch) * k;
}

/** The walker's look (your first-person view) eased to where your head is. */
function rvhLook(M, dt) {
  const Y = ground && ground.you;
  const f = jadrija.figure;
  if (!Y || !f) return;
  let tgt = null;
  if (M.ph === 'up' || M.ph === 'look') tgt = rvhChloeFace(new THREE.Vector3());
  else if (M.ph === 'in' || M.ph === 'rest') {
    const hi = f.boneIndex('head');
    const H = revBone('head', new THREE.Vector3());
    if (!H) return;
    const d = new THREE.Vector3(1, 0, 0).applyQuaternion(f.boneTurn(hi, _rvhQ)).applyQuaternion(f.mesh.quaternion);
    // Where your face points, but not straight at the floor: a bowed head
    // looks out under its brows.
    d.y = Math.max(d.y, -0.30); d.normalize();
    tgt = H.addScaledVector(d, 2);
  }
  if (!tgt) return;
  // From your eye, not the camera (a probe's camera is somewhere else).
  const E = revHead();
  const O = E ? E.eye.clone() : camera.position;
  const yw = Math.atan2(-(tgt.x - O.x), -(tgt.z - O.z));
  const pt = Math.atan2(tgt.y - O.y, Math.max(0.05, Math.hypot(tgt.x - O.x, tgt.z - O.z)));
  let dy = yw - Y.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const k = 1 - Math.exp(-RVH.look * dt);
  Y.yaw += dy * k; Y.pitch += (Math.max(-1.2, Math.min(1.2, pt)) - Y.pitch) * k;
}

// ── your view, the scene, the safeword ──────────────────────────────────────

/**
 * The first-person view's share (from `revCamera`): [pitch, roll] rad, your
 * head pulled back. 0.50 rad held, 0.60 at the yank, eased in fast and out
 * slower — and never so far that the view goes past `camMax` over level.
 */
function rvhCamTilt() {
  const k = rvh.camK;
  if (k < 0.002) return [0, 0];
  const Y = ground && ground.you;
  let p = RVH.pull.cam * k;
  if (Y) p = Math.max(0, Math.min(p, RVH.pull.camMax - Y.pitch));
  return [p, 0.035 * Math.min(1, k) * Math.sin(rev.clock * 2.1)];
}

/** Who the body you are in is with, while her hand is in your hair (see `rvhBegin`), or null. */
function rvhWho() {
  const M = rvh.M;
  return M && M.who && M.ph !== 'out' ? M.who : null;
}

/** The scene block's part (`revScene`): her fist in your hair, or you drawn in. */
function rvhScene(o) {
  const M = rvh.M;
  if (!M) return;
  if (M.kind === 'pull' && M.held) o.rev_hair = 'pull';
  else if (M.kind === 'draw' && M.ph !== 'go' && M.ph !== 'reach') o.rev_hair = M.ph === 'up' || M.ph === 'look' ? 'look' : 'draw';
}

/** The safeword: her fist opens this instant; your head eases back on its own. */
function rvhSafe() {
  const M = rvh.M;
  if (!M) return;
  if (M.kind === 'pull' && M.held && jadrija.hairPull) { jadrija.hairPull(false); M.held = false; }
  rvh.cam = 0;
  rvhDone(M, 'safeword');
}

/** Swapped back or left: all of it off, now. */
function rvhClear() {
  if (rvh.M && rvh.M.kind === 'pull' && rvh.M.held && jadrija && jadrija.hairPull) jadrija.hairPull(false);
  rvh.M = null; rvh.after = null; rvh.cam = 0; rvh.camK = 0; rvh.bk = 0; rvh.lastDraw = null; rvh.lastPull = null;
  rvhUnaim();
}

/** Asked, by key or in words. Answers { ok, label }. */
function rvhAsk(kind) {
  if (!rev.on) return { ok: false, label: 'roles are not reversed' };
  if (rev.care) return { ok: false, label: 'aftercare' };
  if (rvh.M && rvh.M.kind === kind) return { ok: true, label: 'Chloe: already' };
  if (rvh.M) rvhDone(rvh.M, 'asked: ' + kind);
  const v = revView();
  // The draw asked for standing: she tells you to kneel first.
  if (kind === 'draw' && v && v.ctx === 'stand') {
    rvh.after = { what: 'draw', until: rev.clock + 16 };
    if (typeof revOrder === 'function') revOrder('kneel', 'asked: draw');
    return { ok: true, label: 'Chloe: on your knees first (4)' };
  }
  // Asked bent over the edge: up on your knees on the cot first (1.575.0).
  if (kind === 'pull' && v && v.phase === 'edgeHeld') {
    rvhUpCot('asked: pull');
    return { ok: true, label: 'Chloe: up on your knees on the cot first (4)' };
  }
  const r = rvhStart(kind, 'asked');
  if (r === true) return { ok: true, label: kind === 'pull' ? 'Chloe: her fist in your hair' : 'Chloe: draws you in to her side' };
  return { ok: false, label: 'hair ' + kind + ': ' + r };
}

/** The words, on the line `revWords` has normalised: 'rev.hair:pull' | 'rev.hair:draw' | null. */
function rvhWords(t) {
  if (/^((please )?(pull|grab|yank|take) (my|me by the|me by my) hair( please| hard| harder| chloe)?|pull my hair back|hair pull|(povuci|cupaj|vuci|zgrabi) me za kosu|(povuci|zgrabi) mi kosu|vuci me za kosu|tire[- ]moi les cheveux|(attrape|prends)[- ]moi (par )?les cheveux)$/.test(t)) return 'rev.hair:pull';
  if (/^((please )?(draw|pull|bring|hold) me (in|close|closer|to you|against you|in to you)( please)?|pull me in( to you)?|(privuci|stisni) me( k sebi| uz sebe)?|attire[- ]moi( contre toi| vers toi)?|serre[- ]moi contre toi)$/.test(t)) return 'rev.hair:draw';
  return null;
}

// The help sheet, in the three languages — kept with the feature.
if (typeof STRINGS !== 'undefined') {
  Object.assign(STRINGS.en || {}, {
    'help.k.revhair': 'roles reversed: . Chloe pulls your hair from behind (face down, on all fours, kneeling or standing; bent over the edge she has you kneel up on the cot first — or say "pull my hair") · , kneeling, she draws you in to her side and you hold on to her (or say "draw me in"). She does both on her own when she is excited',
  });
  Object.assign(STRINGS.hr || {}, {
    'help.k.revhair': 'zamijenjene uloge: . Chloe te vuče za kosu odostraga (na trbuhu, na sve četiri, na koljenima ili stojeći; sagnutu preko ruba prvo te digne na koljena na krevetu — ili reci "povuci me za kosu") · , na koljenima, privuče te uz svoj bok i držiš se za nju (ili reci "privuci me"). Radi oboje i sama kad se uzbudi',
  });
  Object.assign(STRINGS.fr || {}, {
    'help.k.revhair': 'rôles inversés : . Chloe vous tire les cheveux par derrière (sur le ventre, à quatre pattes, à genoux ou debout ; penchée sur le bord, elle vous fait d’abord mettre à genoux sur le lit — ou dites « tire-moi les cheveux ») · , à genoux, elle vous attire contre sa hanche et vous vous tenez à elle (ou « attire-moi »). Elle le fait aussi d’elle-même quand elle est excitée',
  });
}
if (typeof REV_SAY !== 'undefined') Object.assign(REV_SAY, RVH_SAY);
// Her order off the edge and up on to the cot, for the pull (1.575.0): never
// one of her own picks as an order (no `ctx`); `hair:upcot` gives it.
if (typeof REV_ORDERS !== 'undefined') {
  REV_ORDERS.upcot = { ctx: {}, w: 0, key: '4', wait: 12,
    ok: (v) => v.onBed && v.phase === 'bedKneel', say: 'Up. On your knees, on the cot. I want that hair.',
    hud: ['Gore. Na koljena, na krevetu.', 'Up on your knees, on the cot.', 'Debout. À genoux sur le lit.'] };
}

/**
 * A debug camera on the move: at `d` m, `az` rad round from her facing (0 in
 * front of her), `h` m over her floor — the first spot round from there the
 * room has space for — aimed at `at` ('you' your head, 'mid' between you).
 */
function rvhView(az = 1.57, d = 1.9, h = 1.25, at = 'mid') {
  const Hd = rvmYourHead();
  if (!Hd) return null;
  const C = new THREE.Vector3(rev.ch.x, rev.ch.y + 0.9, rev.ch.z);
  const T = at === 'you' ? Hd.C.clone() : C.clone().lerp(Hd.C, 0.5);
  for (const da of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.6, -1.6, 2.0, -2.0, Math.PI]) {
    for (const k of [1, 0.85, 0.7, 0.55]) {
      const a = rev.ch.yaw + az + da;
      const x = T.x - Math.sin(a) * d * k, z = T.z - Math.cos(a) * d * k;
      if (typeof revRoom === 'function' && !revRoom(x, z)) continue;
      rev.debugCam = [x, rev.ch.y + h, z, T.x, T.y, T.z];
      return { cam: rev.debugCam.map((x) => +x.toFixed(2)), da, k };
    }
  }
  return null;
}

/** `__fr.reverse.hair` — see 49-reverse.js. */
const rvhApi = {
  pull: () => rvhAsk('pull'),
  draw: () => rvhAsk('draw'),
  start: (kind) => rvhStart(kind, 'probe'),
  end: () => { if (rvh.M) rvhDone(rvh.M, 'probe'); return true; },
  words: (t) => rvhWords(t),
  cands: () => { const v = revView(); return rvhCands(v ? v.ctx : null, rev.dom); },
  view: (az, d, h, at) => rvhView(az, d, h, at),
  last: () => rvh.stats,
  /** The palm-to-fist miss per frame: [t, mm, her other hand's swing phase]; `reset` clears. */
  errs: (reset = false) => { const a = (rvh.errTr || []).slice(); if (reset) rvh.errTr = []; return a; },
  /** Debug: RVH's numbers merged (`tune({ pull: { spank: 1 } })`); answers the table. */
  tune: (o) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v) && RVH[k]) Object.assign(RVH[k], v); else RVH[k] = v;
    }
    return JSON.parse(JSON.stringify(RVH));
  },
  state: () => {
    const M = rvh.M;
    return { move: M ? { kind: M.kind, ph: M.ph, t: +M.t.toFixed(2), side: M.side, held: !!M.held, spank: !!M.spank,
      spanked: !!M.spanked, bow: M.bow != null ? +M.bow.toFixed(2) : null, turn: M.turn != null ? +M.turn.toFixed(2) : null,
      up: M.up != null ? +M.up.toFixed(2) : null, gap: M.gapNow != null ? +(M.gapNow * 1000).toFixed(1) : null,
      front: M.frontNow != null ? +(M.frontNow * 1000).toFixed(1) : null,
      place: M.place ? { sg: M.place.sg, bow: +M.place.bow.toFixed(2), out: +M.place.out.toFixed(3), cy: +M.place.cy.toFixed(2), shift: M.place.shift } : null, lat: M.lat != null ? +M.lat.toFixed(2) : null, err: M.errNow != null ? +(M.errNow * 1000).toFixed(1) : null, errV: M.errV || null, errV0: M.errV0 || null, chMoved: M.chMoved, slid: M.slid,
      plan: M.plan ? { mode: M.plan.mode, bow: M.plan.bow } : null } : null,
    cam: +(rvhCamTilt()[0] * 57.3).toFixed(1), camK: +rvh.camK.toFixed(2), bk: +rvh.bk.toFixed(2),
    last: +(rev.clock - rvh.last).toFixed(1), n: rvh.n, after: rvh.after, aimed: Object.keys(rvh.aimed),
    stats: rvh.stats, log: rvh.log.slice(-8) };
  },
  /** Debug: the draw's geometry now — her facing against the plan's, her side, your cheek. */
  drawDbg: () => {
    const M = rvh.M;
    if (!M || M.kind !== 'draw') return null;
    const v3 = (p) => p ? p.toArray().map((x) => +x.toFixed(3)) : null;
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(you.mesh.quaternion);
    const B = rvhBayeSkin(), C = rvhChloeSkin();
    const cheek = rvhSkinSet(B, rvhCheekIdx(M.place.sg));
    const cc = cheek.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / cheek.length);
    const side = rvhSkinSet(C, rvhSideIdx(-M.place.sg));
    const sc = side.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / side.length);
    const root = new THREE.Vector3(rev.ch.x, rev.ch.y, rev.ch.z);
    const loc = (p) => { const d = p.clone().sub(root); const f = M.place.f, r = new THREE.Vector3().crossVectors(f, _rvhUP); return [+d.dot(f).toFixed(3), +d.y.toFixed(3), +d.dot(r).toFixed(3)]; };
    const ci = you.fig.boneIndex('chest');
    const cfw = new THREE.Vector3(1, 0, 0).applyQuaternion(you.fig.boneTurn(ci, new THREE.Quaternion())).applyQuaternion(you.mesh.quaternion);
    const toB = rvmYourHead().C.clone().sub(root); toB.y = 0; toB.normalize(); cfw.y = 0; cfw.normalize();
    return { chestToYou: +cfw.dot(toB).toFixed(3), meshToYou: +fwd.clone().setY(0).normalize().dot(toB).toFixed(3),
      shL: v3(rvmShoulder('L', new THREE.Vector3())), shToHead: +rvmShoulder(M.side, new THREE.Vector3()).distanceTo(rvmYourHead().C).toFixed(3),
      fwd: v3(fwd), planF: v3(M.place.f), root: v3(root), cheekC: v3(cc), cheekLoc: loc(cc), sideC: v3(sc), sideLoc: loc(sc),
      head: v3(rvmYourHead().C), headLoc: loc(rvmYourHead().C), mesh: v3(you.mesh.position) };
  },
  /** Debug: your palm `s` held to `dx, dy, dz` m off where it is now (null lets go). */
  armTo: (s, d) => {
    if (!d) { rvh.dbgArm = null; rvhUnaim(); return null; }
    const p = d[3] === 'sh' ? rvhBayeShoulder(s, new THREE.Vector3()) : rvhBayePalm(s, new THREE.Vector3());
    rvh.dbgArm = rvh.dbgArm || {};
    rvh.dbgArm[s] = { T: p.add(new THREE.Vector3(d[0], d[1], d[2])), pole: new THREE.Vector3(0, 1, 0) };
    return rvh.dbgArm[s].T.toArray();
  },
  /** Debug: your arm's chain as this file reads it (unaimed) against the arm drawn, mm. */
  chain: (s = 'L') => {
    const A = rvhBayeArms(), f = jadrija.figure, a = A[s], R = f.bindRest(), L = f.local();
    const S = f.boneAt(a.iu, new THREE.Vector3());
    const qP = f.boneTurn(a.ip, new THREE.Quaternion()).multiply(a.pq);
    const lq = L.q;
    const qU = qP.clone().multiply(new THREE.Quaternion(lq[4 * a.iu], lq[4 * a.iu + 1], lq[4 * a.iu + 2], lq[4 * a.iu + 3]));
    const E = new THREE.Vector3(R.t[3 * a.il], R.t[3 * a.il + 1], R.t[3 * a.il + 2]).applyQuaternion(qU).add(S);
    const qL = qU.clone().multiply(new THREE.Quaternion(lq[4 * a.il], lq[4 * a.il + 1], lq[4 * a.il + 2], lq[4 * a.il + 3]));
    const W = new THREE.Vector3(R.t[3 * a.ih], R.t[3 * a.ih + 1], R.t[3 * a.ih + 2]).applyQuaternion(qL).add(E);
    const Ed = f.boneAt(a.il, new THREE.Vector3()), Wd = f.boneAt(a.ih, new THREE.Vector3());
    return { elbow: +(E.distanceTo(Ed) * 1000).toFixed(1), wrist: +(W.distanceTo(Wd) * 1000).toFixed(1), aimed: !!rvh.aimed['armU' + s] };
  },
  /** Debug: your arms' last solve (wrist goal against the wrist drawn), and your joint limits' clamps. */
  arms: (reset = false) => ({ arm: rvh.armDbg ? JSON.parse(JSON.stringify(rvh.armDbg, (k, v) => (k === 'G' || k === 'T' ? undefined : v))) : null,
    lim: jadrija.figure && jadrija.figure.limitStats ? jadrija.figure.limitStats(reset) : null }),
  /** Debug: the skin sets' sizes (picked off the bind). */
  sets: () => ({ cheekR: rvhCheekIdx(1).length, cheekL: rvhCheekIdx(-1).length, face: rvhFaceIdx().length,
    sideL: rvhSideIdx(-1).length, sideR: rvhSideIdx(1).length, front: rvhFrontIdx().length,
    thighL: rvhThighIdx(-1).length, thighR: rvhThighIdx(1).length }),
};
if (typeof revApi !== 'undefined') revApi.hair = rvhApi;
