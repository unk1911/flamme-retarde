// -----------------------------------------------------------------------------
// An ACTIVE RAGDOLL for a skinned figure, on `avbdNet` — and Baye in the
// hammock is its first customer.
//
// Misha, 27 Sep 2026: *"when i rock the hammock too hard, she ends up falling
// out of it, and she falls off very stiffly, like a wooden doll ... there is
// no natural elasticity to her body movement ... is it possible to make her
// body like, super elastic, to groove with the hammock the way a real human
// lying down on it would do, and can AVBD equations be used to achieve that
// fluidity"* — and then, *"to have a ragdoll, actually, b/c we can reuse it
// elsewheres ... i do want her to occasionally fall out i guess, and the
// ragdoll thing will make it look realistic"*.
//
// She was a wooden doll because she WAS one: in 1.531.0 the hammock held her
// as a single rigid body of 55 kg carrying her capsules, re-shaped every frame
// from whatever the clip said, so nothing about her could give. Here she is
// twelve bodies — pelvis, belly, chest, head and neck, and two each of upper
// arm, forearm, thigh and shin — hung together by hard ball sockets at her
// joints (the reference's Joint), with an ANGLE on every socket (the new row
// in `avbdNet`, (h) in 43-avbd.js): a soft drive toward a target pose, some
// damping, and the joint's limits as one-sided rows. The drive is her muscle
// tone — a `tension` from floppy to holding on — and the limits are what
// keep a knee a knee when nothing is holding it. What is between two bodies
// (spine01, spine03, the clavicles) rides the body under it at the angle it
// had when the ragdoll took over; what nothing collides with (fingers, eyes,
// jaw) keeps doing whatever the clip is doing.
//
// ── the API ──────────────────────────────────────────────────────────────────
//
//   const rag = ragdollBuild(net, fig, caps, { idBase })
//       Into an `avbdNet` that has room for it (maxBodies/Joints/Angles/Caps),
//       dormant; calls `net.finish()`. `fig` is a skinned figure (41-skin.js);
//       `caps` its collision capsules in its BIND frame — [{ bone, a, e, r0,
//       r1 }], a bone index and two bind-space points, which is what
//       `chainCapsules` in 43-jadrija.js hands out.
//   rag.enter(fig, meshP, meshQ, v, w, c)
//       Take over from the figure as it is drawn this frame (its mesh at
//       meshP/meshQ, THREE objects): every body where its bone is, moving
//       like a rigid body with velocity v and spin w about the point c
//       (arrays; world). Nothing jumps — the first pose written back is the
//       one that was on the screen.
//   rag.drive(localQ)        muscle targets: a local pose, 4 a bone (a clip).
//   rag.tension(k)           0 a rag, 1 the table's stiffnesses (RAGDOLL.bodies).
//   rag.frame(outP, outQ)    a mesh frame that rides her pelvis — the frame
//                            the figure was in when it was taken over.
//   rag.write(out, mP, mQ, clipQ)
//                            the bodies back into a local pose (out.q nb×4,
//                            out.t) for `fig.manual`, in the mesh frame given.
//   rag.groundFrame(q, t, floor)
//                            where to stand a clip whose first frame is pose
//                            (q, t) so it starts where she lies: [x, y, z, yaw].
//   rag.enterPose(q, t, meshP, meshQ)
//       The same, at rest, from a local pose instead of the figure as drawn
//       — the settle's (43-settle.js), which must not depend on the frame.
//   rag.kick(vx, vy, vz), rag.leave(), rag.faceUp(), rag.speed(), rag.bodies.
//
// The net steps it; the caller decides when it is on. See 43-hammock.js for
// the bodies in the cloth and `hamRag*` in 43-jadrija.js for the hand-overs.
// -----------------------------------------------------------------------------

const RAGDOLL = {
  // Her mass, and each body's share — de Leva's adjusted segment masses for a
  // woman (1996), the trunk's three parts and the head with the neck; the
  // hand rides the forearm and the foot the shin, so their shares are there.
  mass: 55,
  // The table, left side: the bone the body is, its share of the mass, its
  // limits (deg, the bone's own axes — the frame every pose here is written
  // in: legU −x forward, legL +x the knee, armU −x forward, armL −x the
  // elbow, spine −x forward; y is the twist and z the other swing), and its
  // drive at tension 1 (N·m/rad) and damping (N·m·s/rad). The right side is
  // made from the left, its y and z mirrored, as every pose in human_mh.py is.
  //
  // THE STIFFNESSES ARE SIZED ON WHAT EACH JOINT CARRIES: a thigh held out
  // level is 8 kg a fifth of a metre out, 16 N·m, and 80 N·m/rad lets it
  // droop 0.2 rad — a leg that is being held, not a leg that is locked; a
  // forearm is under 1 N·m and 5 N·m/rad lets it hang. The damping is half
  // of critical or under at tension 1, so an arm swings on after the
  // hammock does, which is the whole of "groove with the hammock".
  bodies: [
    { bone: 'pelvis', m: 0.125 },
    { bone: 'spine02', m: 0.147, lo: [-40, -25, -20], hi: [25, 25, 20], k: 220, kd: 10 },
    { bone: 'chest', m: 0.155, lo: [-30, -25, -20], hi: [20, 25, 20], k: 180, kd: 8 },
    { bone: 'neck', m: 0.067, lo: [-50, -60, -35], hi: [40, 60, 35], k: 30, kd: 1.5 },
    { bone: 'armUL', m: 0.0255, lo: [-175, -90, -140], hi: [70, 90, 140], k: 10, kd: 0.5 },
    { bone: 'armLL', m: 0.0194, lo: [-150, -85, -8], hi: [2, 85, 8], k: 5, kd: 0.25 },
    { bone: 'legUL', m: 0.148, lo: [-125, -45, -30], hi: [30, 45, 50], k: 80, kd: 5 },
    { bone: 'legLL', m: 0.061, lo: [-2, -25, -10], hi: [150, 25, 10], k: 25, kd: 1.2 },
  ],
  // Bones nothing collides with and nothing hangs off, which go on doing what
  // the clip does: the face, the hands' own fingers, the toes.
  live: /^(fingers|thumb|eye|jaw|toe)/,
  // THE LIMITS' CEILING, N·m/rad (`limK` in `avbdNet`). Hard, they were
  // the stiffest thing on a 3 kg shin — the penalty climbs by beta·|C| until
  // the row holds — and MEASURED in the hammock the knee's own socket opened
  // 15 to 32 mm at every big swing, the shin held by its limit against the
  // cloth and pulled off the thigh, and the guard put the whole hammock back
  // six times in a minute. A ligament gives: at this a knee pushed 10
  // degrees past its stop by the whole of her thigh's weight is back in 0.1 s.
  limK: 3000,
  // Air, 1/s: a body moving through it, not a body in treacle.
  drag: 0.05,
  // The arms meet a one-sided box from both sides — see (g) in 43-avbd.js.
  twoSided: /^arm/,
};

/** The table with its right side made from its left. */
function ragdollTable() {
  const out = [];
  for (const d of RAGDOLL.bodies) {
    out.push(d);
    if (!/L$/.test(d.bone)) continue;
    const r = Object.assign({}, d, { bone: d.bone.replace(/L$/, 'R') });
    if (d.lo) {
      r.lo = [d.lo[0], -d.hi[1], -d.hi[2]];
      r.hi = [d.hi[0], -d.lo[1], -d.lo[2]];
    }
    out.push(r);
  }
  return out;
}

/**
 * Figure-space rotations (4 a bone) and heads (3 a bone) of a local pose.
 * The figure's own pass in `update`, for a pose that is not being drawn.
 */
function ragdollFK(fig, q, t, outW, outT) {
  const B = fig.bones, R = fig.bindRest();
  for (let i = 0; i < B.length; i++) {
    const p = B[i].parent;
    if (p < 0) {
      outW[4 * i] = q[4 * i]; outW[4 * i + 1] = q[4 * i + 1]; outW[4 * i + 2] = q[4 * i + 2]; outW[4 * i + 3] = q[4 * i + 3];
      outT[3 * i] = t[0]; outT[3 * i + 1] = t[1]; outT[3 * i + 2] = t[2];
    } else {
      avbdQMul(outW, 4 * p, q, 4 * i, outW, 4 * i);
      qrotv(outT, 3 * i, outW, 4 * p, R.t, 3 * i);
      outT[3 * i] += outT[3 * p]; outT[3 * i + 1] += outT[3 * p + 1]; outT[3 * i + 2] += outT[3 * p + 2];
    }
  }
}

function ragdollBuild(net, fig, caps, o = {}) {
  const defs = ragdollTable();
  const bones = fig.bones, NBN = bones.length;
  const BR = fig.bindRest();                  // q/t the rest (local), bindQ/bindT (figure)
  const deg = Math.PI / 180;
  const idBase = o.idBase == null ? 40 : o.idBase;

  // ── which bone is which body ──────────────────────────────────────────
  const bodyOf = new Int32Array(NBN).fill(-1);
  const list = [];
  for (const d of defs) {
    const b = fig.boneIndex(d.bone);
    if (b < 0) continue;
    bodyOf[b] = list.length;
    list.push({ bone: b, d, caps: [], cp: [], O: new Float64Array(3), parent: -1, joint: -1, angle: -1, i: -1 });
  }
  /** The body a bone rides: its own, or the nearest up the chain. */
  const up = (b) => {
    while (b >= 0 && bodyOf[b] < 0) b = bones[b].parent;
    return b < 0 ? -1 : bodyOf[b];
  };
  for (let c = 0; c < caps.length; c++) {
    const k = up(caps[c].bone);
    if (k >= 0) list[k].caps.push(c);
  }
  // Each bone's kind: 0 a body; 1 fixed on the body under it at the angle it
  // had when the ragdoll took over (between two bodies, or carrying a
  // capsule); 2 live, off the clip.
  const kind = new Uint8Array(NBN);
  const carries = new Uint8Array(NBN);
  for (const c of caps) carries[c.bone] = 1;
  const above = new Uint8Array(NBN);           // has a body somewhere below it
  for (let b = 0; b < NBN; b++) {
    if (bodyOf[b] < 0) continue;
    for (let p = bones[b].parent; p >= 0; p = bones[p].parent) above[p] = 1;
  }
  for (let b = 0; b < NBN; b++) {
    kind[b] = bodyOf[b] >= 0 ? 0 : (carries[b] || above[b] || !RAGDOLL.live.test(bones[b].name)) ? 1 : 2;
  }

  // ── into the net, asleep ──────────────────────────────────────────────
  for (const B of list) {
    B.i = net.addBody(RAGDOLL.mass * B.d.m, [0.01, 0.01, 0.01, 0, 0, 0], 0, -100, 0);
    net.setLive(B.i, false);
    net.drag[B.i] = RAGDOLL.drag;
    const two = RAGDOLL.twoSided.test(B.d.bone) ? 1 : 0;
    for (const c of B.caps) {
      const cp = net.addCap(B.i, idBase + c);
      net.cpOn[cp] = 0;
      net.cpTwo[cp] = two;
      B.cp.push(cp);
    }
    B.parent = bones[B.bone].parent >= 0 ? up(bones[B.bone].parent) : -1;
  }
  for (const B of list) {
    if (B.parent < 0) continue;
    const A = list[B.parent];
    B.joint = net.addJoint(A.i, [0, 0, 0], B.i, [0, 0, 0], Infinity, 0, 1);
    net.setJointLoose(B.joint, true);
    B.angle = net.addAngle(A.i, B.i, [0, 0, 0, 1], [0, 0, 0, 1]);
    if (B.d.lo) net.setAngleLimits(B.angle, B.d.lo.map((v) => v * deg), B.d.hi.map((v) => v * deg));
  }
  net.finish();
  const root = list[0];                         // the pelvis: the table's first

  // ── scratch ────────────────────────────────────────────────────────────
  const head = new Float64Array(3 * NBN), turn = new Float64Array(4 * NBN);
  const fixedQ = new Float64Array(4 * NBN);
  const W = new Float64Array(4 * NBN);
  const q4 = new Float64Array(4), q5 = new Float64Array(4), v3 = new Float64Array(3), v4 = new Float64Array(3);
  const D = new Float64Array(4);                // mesh = pelvis body · D
  const rootT0 = new Float64Array(3);
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion();
  const Pn = net.P, Qn = net.Q;
  let on = false, tens = 1;

  /** Bind-space point x on bone cb, into body B's bind-aligned frame, at the pose in head/turn. */
  function toBody(B, cb, x, out) {
    // Figure space: head_cb + turn_cb·(x − bindT_cb).
    v3[0] = x[0] - BR.bindT[3 * cb]; v3[1] = x[1] - BR.bindT[3 * cb + 1]; v3[2] = x[2] - BR.bindT[3 * cb + 2];
    qrotv(v4, 0, turn, 4 * cb, v3, 0);
    v4[0] += head[3 * cb] - head[3 * B.bone]; v4[1] += head[3 * cb + 1] - head[3 * B.bone + 1];
    v4[2] += head[3 * cb + 2] - head[3 * B.bone + 2];
    // Back through the body's own turn, and on to its bind head.
    q4[0] = -turn[4 * B.bone]; q4[1] = -turn[4 * B.bone + 1]; q4[2] = -turn[4 * B.bone + 2]; q4[3] = turn[4 * B.bone + 3];
    qrotv(out, 0, q4, 0, v4, 0);
    out[0] += BR.bindT[3 * B.bone]; out[1] += BR.bindT[3 * B.bone + 1]; out[2] += BR.bindT[3 * B.bone + 2];
  }

  /**
   * Measure every body off the figure as it stands — capsules, centre of
   * mass, inertia, the sockets and the joint frames — and put it there.
   */
  function enter(f, mP, mQ, v = null, w = null, c = null) {
    for (let b = 0; b < NBN; b++) {
      f.boneAt(b, _v); head[3 * b] = _v.x; head[3 * b + 1] = _v.y; head[3 * b + 2] = _v.z;
      f.boneTurn(b, _q); turn[4 * b] = _q.x; turn[4 * b + 1] = _q.y; turn[4 * b + 2] = _q.z; turn[4 * b + 3] = _q.w;
    }
    take(mP, mQ, v, w, c);
  }
  /**
   * The same, from a local pose (q 4 a bone, t the root's) rather than off
   * the figure as drawn — at rest. For the settle (43-settle.js), which
   * takes a sitter over at the first frame of their clip whatever the clip
   * is doing on the screen, so the same person settles the same way on
   * every visit.
   */
  function enterPose(q, t, mP, mQ) {
    ragdollFK(fig, q, t, fkW, fkT);
    for (let b = 0; b < NBN; b++) {
      head[3 * b] = fkT[3 * b]; head[3 * b + 1] = fkT[3 * b + 1]; head[3 * b + 2] = fkT[3 * b + 2];
      avbdQMul(fkW, 4 * b, BR.bindQ, 4 * b, turn, 4 * b, false, true);
    }
    take(mP, mQ, null, null, null);
  }
  function take(mP, mQ, v, w, c) {
    // The pose as DRAWN, which is the clip plus whatever was aimed on top of
    // it (her gaze turns her head in figure space) — so the local rotations
    // are taken off the drawn turns and not off the clip's own.
    for (let b = 0; b < NBN; b++) {
      avbdQMul(turn, 4 * b, BR.bindQ, 4 * b, W, 4 * b);
      const p = bones[b].parent;
      if (p < 0) fixedQ.set(W.subarray(4 * b, 4 * b + 4), 4 * b);
      else avbdQMul(W, 4 * p, W, 4 * b, fixedQ, 4 * b, true);
    }
    rootT0[0] = head[3 * root.bone]; rootT0[1] = head[3 * root.bone + 1]; rootT0[2] = head[3 * root.bone + 2];
    const mq = [mQ.x, mQ.y, mQ.z, mQ.w];
    const ca = new Float64Array(3), ce = new Float64Array(3);
    for (const B of list) {
      // Its capsules, in its frame; its centre of mass and inertia from them,
      // each a solid of its volume at one density (`herShape`'s rule).
      const seg = [];
      let vol = 0, cx = 0, cy = 0, cz = 0;
      for (const k of B.caps) {
        const C = caps[k];
        toBody(B, C.bone, C.a, ca); const a = [ca[0], ca[1], ca[2]];
        toBody(B, C.bone, C.e, ce); const e = [ce[0], ce[1], ce[2]];
        const r = (C.r0 + C.r1) / 2, Lc = Math.hypot(e[0] - a[0], e[1] - a[1], e[2] - a[2]);
        const vv = Math.PI * r * r * Lc + (4 / 3) * Math.PI * r * r * r;
        seg.push([a, e, C.r0, C.r1, vv]);
        vol += vv; cx += vv * (a[0] + e[0]) / 2; cy += vv * (a[1] + e[1]) / 2; cz += vv * (a[2] + e[2]) / 2;
      }
      if (vol > 0) { cx /= vol; cy /= vol; cz /= vol; } else {
        cx = BR.bindT[3 * B.bone]; cy = BR.bindT[3 * B.bone + 1]; cz = BR.bindT[3 * B.bone + 2];
      }
      B.O[0] = cx; B.O[1] = cy; B.O[2] = cz;
      const m = net.mass[B.i], I = [0, 0, 0, 0, 0, 0];
      seg.forEach(([a, e, r0, r1, vv], n) => {
        const mk = vol > 0 ? m * vv / vol : 0, r = (r0 + r1) / 2;
        let ux = e[0] - a[0], uy = e[1] - a[1], uz = e[2] - a[2];
        const Lc = Math.hypot(ux, uy, uz) || 1;
        ux /= Lc; uy /= Lc; uz /= Lc;
        const acr = mk * (Lc * Lc / 12 + r * r / 4), alo = mk * r * r / 2;
        const dx = (a[0] + e[0]) / 2 - cx, dy = (a[1] + e[1]) / 2 - cy, dz = (a[2] + e[2]) / 2 - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        I[0] += acr * (1 - ux * ux) + alo * ux * ux + mk * (d2 - dx * dx);
        I[1] += acr * (1 - uy * uy) + alo * uy * uy + mk * (d2 - dy * dy);
        I[2] += acr * (1 - uz * uz) + alo * uz * uz + mk * (d2 - dz * dz);
        I[3] += (alo - acr) * ux * uy - mk * dx * dy;
        I[4] += (alo - acr) * ux * uz - mk * dx * dz;
        I[5] += (alo - acr) * uy * uz - mk * dy * dz;
        net.setCap(B.cp[n], a[0] - cx, a[1] - cy, a[2] - cz, e[0] - cx, e[1] - cy, e[2] - cz, r0, r1);
        net.cpOn[B.cp[n]] = 1;
      });
      // A floor under the inertia, so a body with a capsule along its own
      // axis is not a needle about it.
      const Imin = m * 0.0004;
      for (let k = 0; k < 3; k++) I[k] = Math.max(I[k], Imin);
      for (let k = 0; k < 6; k++) net.inert[6 * B.i + k] = I[k];
      // In the world: q = mesh·turn, P = mesh·(head + turn·(O − bindT)).
      avbdQMul(mq, 0, turn, 4 * B.bone, q4, 0);
      v3[0] = cx - BR.bindT[3 * B.bone]; v3[1] = cy - BR.bindT[3 * B.bone + 1]; v3[2] = cz - BR.bindT[3 * B.bone + 2];
      qrotv(v4, 0, turn, 4 * B.bone, v3, 0);
      _v.set(head[3 * B.bone] + v4[0], head[3 * B.bone + 1] + v4[1], head[3 * B.bone + 2] + v4[2]).applyQuaternion(mQ);
      net.setLive(B.i, true);
      net.place(B.i, mP.x + _v.x, mP.y + _v.y, mP.z + _v.z, [q4[0], q4[1], q4[2], q4[3]]);
    }
    // The sockets, at each child bone's head as it stands; the joint frames
    // qL = turn_A⁻¹·turn_p·bindQ_i (p the bone's own parent) and qR = bindQ_i,
    // so r is the bone's own rotation off its rest — see (h) in 43-avbd.js.
    for (const B of list) {
      if (B.parent < 0) continue;
      const A = list[B.parent], i = B.bone, p = bones[i].parent;
      const ra = new Float64Array(3);
      toBody(A, i, [BR.bindT[3 * i], BR.bindT[3 * i + 1], BR.bindT[3 * i + 2]], ra);
      ra[0] -= A.O[0]; ra[1] -= A.O[1]; ra[2] -= A.O[2];
      const rb = [BR.bindT[3 * i] - B.O[0], BR.bindT[3 * i + 1] - B.O[1], BR.bindT[3 * i + 2] - B.O[2]];
      net.setJointArms(B.joint, ra, rb);
      avbdQMul(turn, 4 * A.bone, turn, 4 * p, q4, 0, true);
      avbdQMul(q4, 0, BR.bindQ, 4 * i, q4, 0);
      net.setAngleFrame(B.angle, q4, [BR.bindQ[4 * i], BR.bindQ[4 * i + 1], BR.bindQ[4 * i + 2], BR.bindQ[4 * i + 3]]);
      // Held where it is until somebody says otherwise.
      avbdQMul(BR.q, 4 * i, fixedQ, 4 * i, q5, 0, true);
      net.setAngleTarget(B.angle, q5[0], q5[1], q5[2], q5[3]);
    }
    // Moving as the one body she was.
    for (const B of list) {
      if (!v) break;
      const o3 = 3 * B.i;
      const rx = Pn[o3] - c[0], ry = Pn[o3 + 1] - c[1], rz = Pn[o3 + 2] - c[2];
      const vx = v[0] + w[1] * rz - w[2] * ry, vy = v[1] + w[2] * rx - w[0] * rz, vz = v[2] + w[0] * ry - w[1] * rx;
      net.kick(B.i, vx, vy, vz);
      net.W[o3] = w[0]; net.W[o3 + 1] = w[1]; net.W[o3 + 2] = w[2];
    }
    // The mesh frame rides the pelvis: mesh = q_pelvis·D.
    avbdQMul(Qn, 4 * root.i, mq, 0, D, 0, true);
    tension(tens);
    on = true;
  }

  function leave() {
    for (const B of list) {
      net.setLive(B.i, false);
      for (const cp of B.cp) net.cpOn[cp] = 0;
    }
    on = false;
  }

  /** Muscle targets from a local pose — each body's bone, off its rest. */
  function drive(localQ) {
    for (const B of list) {
      if (B.parent < 0) continue;
      avbdQMul(BR.q, 4 * B.bone, localQ, 4 * B.bone, q4, 0, true);
      net.setAngleTarget(B.angle, q4[0], q4[1], q4[2], q4[3]);
    }
  }
  /** Muscle tone: the table's drive times k; the damping with the square root. */
  function tension(k) {
    tens = k;
    const kd = Math.sqrt(Math.max(0, k));
    for (const B of list) if (B.parent >= 0) net.setAngleK(B.angle, B.d.k * k, B.d.kd * Math.max(0.35, kd));
  }

  /** Where bone b's head is in the world, into v4 — off its body. */
  function headWorld(b) {
    const B = list[bodyOf[b]];
    v3[0] = BR.bindT[3 * b] - B.O[0]; v3[1] = BR.bindT[3 * b + 1] - B.O[1]; v3[2] = BR.bindT[3 * b + 2] - B.O[2];
    qrotv(v4, 0, Qn, 4 * B.i, v3, 0);
    v4[0] += Pn[3 * B.i]; v4[1] += Pn[3 * B.i + 1]; v4[2] += Pn[3 * B.i + 2];
    return v4;
  }
  /** The mesh frame that rides her pelvis — the one she was taken over in. */
  function frame(outP, outQ) {
    avbdQMul(Qn, 4 * root.i, D, 0, q4, 0);
    outQ.set(q4[0], q4[1], q4[2], q4[3]).normalize();
    headWorld(root.bone);
    _v.set(rootT0[0], rootT0[1], rootT0[2]).applyQuaternion(outQ);
    outP.set(v4[0] - _v.x, v4[1] - _v.y, v4[2] - _v.z);
  }
  /**
   * The bodies as a local pose, in the mesh frame (mP, mQ): out.q (4 a
   * bone) and out.t. Fixed bones as they were taken over; live ones off
   * `clipQ` (or as they were, without it).
   */
  function write(out, mP, mQ, clipQ = null) {
    const mqi = [-mQ.x, -mQ.y, -mQ.z, mQ.w];
    for (let b = 0; b < NBN; b++) {
      const p = bones[b].parent, o4 = 4 * b;
      if (kind[b] === 0) {
        const B = list[bodyOf[b]];
        avbdQMul(mqi, 0, Qn, 4 * B.i, W, o4);
        avbdQMul(W, o4, BR.bindQ, o4, W, o4);
        if (p < 0) { out.q[o4] = W[o4]; out.q[o4 + 1] = W[o4 + 1]; out.q[o4 + 2] = W[o4 + 2]; out.q[o4 + 3] = W[o4 + 3]; } else {
          avbdQMul(W, 4 * p, W, o4, q4, 0, true);
          const l = Math.hypot(q4[0], q4[1], q4[2], q4[3]) || 1;
          out.q[o4] = q4[0] / l; out.q[o4 + 1] = q4[1] / l; out.q[o4 + 2] = q4[2] / l; out.q[o4 + 3] = q4[3] / l;
        }
      } else {
        const src = kind[b] === 2 && clipQ ? clipQ : fixedQ;
        out.q[o4] = src[o4]; out.q[o4 + 1] = src[o4 + 1]; out.q[o4 + 2] = src[o4 + 2]; out.q[o4 + 3] = src[o4 + 3];
        if (p < 0) { W[o4] = src[o4]; W[o4 + 1] = src[o4 + 1]; W[o4 + 2] = src[o4 + 2]; W[o4 + 3] = src[o4 + 3]; } else avbdQMul(W, 4 * p, src, o4, W, o4);
      }
    }
    headWorld(root.bone);
    _v.set(v4[0] - mP.x, v4[1] - mP.y, v4[2] - mP.z).applyQuaternion(_q.set(mqi[0], mqi[1], mqi[2], mqi[3]));
    out.t[0] = _v.x; out.t[1] = _v.y; out.t[2] = _v.z;
  }

  /**
   * Where to stand a clip whose first frame is the local pose (q, t) so that
   * it starts where she lies: its pelvis over hers, its pelvis-to-neck the
   * way hers points, on the ground under it. [x, y, z, yaw] — yaw as three.js
   * turns a mesh about +y.
   */
  const fkW = new Float64Array(4 * NBN), fkT = new Float64Array(3 * NBN);
  function groundFrame(q, t, floor) {
    ragdollFK(fig, q, t, fkW, fkT);
    const pel = root.bone, nk = fig.boneIndex('neck');
    const hFx = fkT[3 * nk] - fkT[3 * pel], hFz = fkT[3 * nk + 2] - fkT[3 * pel + 2];
    const pW = Array.from(headWorld(pel)), nW = Array.from(headWorld(nk));
    const hWx = nW[0] - pW[0], hWz = nW[2] - pW[2];
    const yaw = Math.atan2(-hWz, hWx) - Math.atan2(-hFz, hFx);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    // R_y(yaw)·(x, z) = (x c + z s, −x s + z c).
    const px = fkT[3 * pel], pz = fkT[3 * pel + 2];
    const x = pW[0] - (px * c + pz * s), z = pW[2] - (-px * s + pz * c);
    return [x, floor(x, z), z, yaw];
  }

  /** Her front — the chest's +x, which is where the figure faces — against up. */
  function faceUp() {
    const B = list[bodyOf[fig.boneIndex('chest')]] || root;
    v3[0] = 1; v3[1] = 0; v3[2] = 0;
    qrotv(v4, 0, Qn, 4 * B.i, v3, 0);
    return v4[1];
  }
  /** The fastest of her, m/s. */
  function speed() {
    let s = 0;
    for (const B of list) {
      const o3 = 3 * B.i;
      s = Math.max(s, Math.hypot(net.V[o3], net.V[o3 + 1], net.V[o3 + 2]));
    }
    return s;
  }
  function kick(vx, vy, vz) { for (const B of list) net.kick(B.i, vx, vy, vz); }

  return {
    enter, enterPose, leave, drive, tension, frame, write, groundFrame, faceUp, speed, kick, headWorld,
    /** Net capsule indices, with the bone each body is — for the settle's pairs. */
    capsOf: () => list.map((B) => ({ bone: bones[B.bone].name, cp: B.cp.slice(), i: B.i })),
    get on() { return on; },
    get tens() { return tens; },
    /** Net indices: every body, the pelvis, and by bone name. */
    bodies: list.map((B) => B.i),
    pelvis: root.i,
    body: (name) => { const b = fig.boneIndex(name); return b >= 0 && bodyOf[b] >= 0 ? list[bodyOf[b]].i : -1; },
    angles: list.filter((B) => B.parent >= 0).map((B) => [bones[B.bone].name, B.angle]),
    joints: list.filter((B) => B.parent >= 0).map((B) => [bones[B.bone].name, B.joint]),
    caps: list.reduce((n, B) => n + B.cp.length, 0),
  };
}
