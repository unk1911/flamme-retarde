// ---------------------------------------------------------------------------
// AVBD — a chain of rigid links, solved the way Augmented Vertex Block Descent
// solves it. For the chain between Baye's cuffs (CHAIN in 43-jadrija.js).
//
// ── where this comes from, and the notices it has to carry ─────────────────
//
// The joint and contact maths is ported from the CPU reference in three-avbd,
// src/avbd3d/ref/ (body.ts, forces.ts, manifold.ts, solver.ts, math.ts), which
// is itself a faithful TypeScript port of Chris Giles's avbd-demo3d. The paper
// is Giles, Diaz and Yuksel, "Augmented Vertex Block Descent", ACM TOG 44(4),
// SIGGRAPH 2025. Only the CPU reference was used; none of three-avbd's WebGPU
// code is here, and none of the paper's text.
//
//   three-avbd — MIT License, Copyright (c) 2026 Steven Bobyn
//   avbd-demo3d — MIT License, Copyright (c) 2025 Chris Giles
//     (source files: Copyright (c) 2025, 2026 Chris Giles. Permission to use,
//     copy, modify, distribute and sell this software and its documentation
//     for any purpose is hereby granted without fee, provided that the above
//     copyright notice appear in all copies. Chris Giles makes no
//     representations about the suitability of this software for any
//     purpose. It is provided "as is" without express or implied warranty.)
//
//   Permission is hereby granted, free of charge, to any person obtaining a
//   copy of this software and associated documentation files (the
//   "Software"), to deal in the Software without restriction, including
//   without limitation the rights to use, copy, modify, merge, publish,
//   distribute, sublicense, and/or sell copies of the Software, and to permit
//   persons to whom the Software is furnished to do so, subject to the
//   following conditions: The above copyright notice and this permission
//   notice shall be included in all copies or substantial portions of the
//   Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
//   NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
//   DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
//   OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
//   USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// ── what was taken, and what was not ────────────────────────────────────────
//
// TAKEN, operation for operation: the per-body 6x6 block solve (Eqs. 4-6)
// with its LDLᵀ; the inertial target and the adaptive warm start; the hard
// ball joint — penalty and dual variable per row, stabilised against its own
// error at the start of the step (Eq. 18), warm-started by alpha·gamma
// (Eq. 19), the penalty ramped by beta·|C| every iteration (Eq. 16) — and its
// lumped geometric stiffness; the contact rows with their push-only normal and
// friction cone, Taylor-expanded about the start of the step (Sec. 4); the
// BDF1 velocities.
//
// WHY THIS AND NOT A PARTICLE ROPE is the augmented Lagrangian. A chain hung
// between two wrists is the worst case for a plain penalty or a plain
// Gauss-Seidel solver: two infinite masses at the ends, forty-two light
// bodies between them, and joints that must not stretch. A penalty that is
// stiff enough not to stretch is too stiff to integrate; one that is soft
// enough is a bungee. AVBD carries the joint force from iteration to
// iteration and from step to step in `lambda`, so ten iterations hold the
// joints to fractions of a millimetre that a penalty alone would need a
// thousand for.
//
// NOT TAKEN: the box-box collision, the manifold's feature matching, the
// O(n²) broadphase, fracture, and the class hierarchy. Everything here is one
// chain: body k is jointed to k-1 and k+1 and to nothing else, so the forces
// on a body are known without a list, and the arrays are flat.
//
// ── what was added ─────────────────────────────────────────────────────────
//
// (1) KINEMATIC ENDS. The two end joints hang off a WORLD POINT rather than a
// body — the reference's `bodyA === null` — and that point moves: it is on a
// cuff on her wrist. The reference only ever has static world anchors, and
// stabilising a moving one the reference's way would let the chain follow a
// hundredth of the wrist's motion per step. So C0, the error the stabilisation
// forgives, is taken against where the anchor WAS at the start of the step,
// and every iteration evaluates against where it IS at the end — the anchor's
// own motion is all corrected, and only error the chain already had is eased
// out. That is exactly what the reference does for a body that moves during
// the step; a kinematic body is one whose move is known in advance.
//
// (2) A TWIST ROW between neighbours, soft. Links of a real chain sit at
// right angles to their neighbours, which is what the eye reads as "chain";
// a ball joint alone lets a link spin freely about its own run. The row holds
// each link a quarter turn from the last about their common axis, modulo a
// half turn — a torus turned half round is the same torus, so either quarter
// is a rest state and no link is ever wound back the long way.
//
// (3) CAPSULE CONTACTS, one-sided: each link is a small sphere about its own
// middle and her body is a handful of capsules on her bones, plus a floor.
// These are the reference's contact rows (normal, two tangents, push-only,
// Coulomb cone) with body B kinematic: B's displacement over the step is the
// capsule's own, so a thigh that swings into the chain carries it along
// within the step rather than finding it inside next step. A link's contact
// is at its centre, so the rows have no angular part — the arm of a 5 mm
// sphere turning under friction is nothing anybody could see, and dropping
// it keeps the block solve's cross terms to the joints.
//
// (4) STIFFNESS SWITCHES, both the reference's own finite-stiffness path: the
// joints can be made springs (`setJointK`) — the reference's finite
// `stiffnessLin`, penalty clamped and no multiplier — and the contacts can be
// springs from the start (`contactK`), which the reference's manifold never
// is. And a contact is only made from outside (`deep`, `touched`). Each is
// there because what drives the ends of this chain is an animation, which is
// not physical, and CHAIN in 43-jadrija.js says where each one was measured
// to be needed.
//
// (5) AND ONE BALL (1.529.0) — `avbdBall` at the bottom of the file, for the
// Slow Doodle's beach ball (BALL in 43-ball.js). The same block solve, the
// same contact rows with their cone and their warm start, the same dual
// update, on ONE free body with no joints; what a ball needs and a link did
// not is written there, each with its reason.
// ---------------------------------------------------------------------------

const AVBD = {
  /** Clamp on every penalty, as in the reference (body.ts). */
  penMin: 1.0, penMax: 1e10,
};

/**
 * One chain of `o.n` equal links, each `o.pitch` long between its two joint
 * points, which lie on its local ±x. World metres, +y up.
 *
 * `o` — n, pitch, mass (kg a link), moment [Ix, Iy, Iz] (kg·m², link frame),
 * rLink (collision radius of a link, m), mu (friction), twist (N·m/rad, the
 * quarter-turn spring), iterations, alpha (joints), alphaContact, beta, gamma,
 * gravity [x, y, z], drag (1/s), vMax (m/s), margin (how near a shape a
 * contact is made, m), deep (how far inside one a new contact is refused, m),
 * contactK (N/m; Infinity, the default, is the reference's hard contact).
 */
function avbdChain(o) {
  const n = o.n;
  const half = o.pitch * 0.5;
  const mass = o.mass;
  const Ix = o.moment[0], Iy = o.moment[1], Iz = o.moment[2];
  const gx = o.gravity[0], gy = o.gravity[1], gz = o.gravity[2];
  const gLen = Math.hypot(gx, gy, gz) || 1;

  // ── bodies ────────────────────────────────────────────────────────────
  const P = new Float64Array(3 * n), Q = new Float64Array(4 * n);
  const V = new Float64Array(3 * n), W = new Float64Array(3 * n);
  const VP = new Float64Array(3 * n);             // velocity last step
  const P0 = new Float64Array(3 * n), Q0 = new Float64Array(4 * n);   // x-
  const PI = new Float64Array(3 * n), QI = new Float64Array(4 * n);   // inertial
  // ── joints: n + 1 of them, joint k between body k-1 and body k ────────
  // Joint 0's A side is the world point `anchor[0..2]`, joint n's B side is
  // `anchor[3..5]`. `anchor0` is the same two points at the start of the step.
  const NJ = n + 1;
  const jPen = new Float64Array(3 * NJ), jLam = new Float64Array(3 * NJ);
  const jC0 = new Float64Array(3 * NJ);
  const anchor = new Float64Array(6), anchor0 = new Float64Array(6);
  // ── contacts: up to MAXC a link ───────────────────────────────────────
  const MAXC = 3;
  const cN = new Int8Array(n);
  const cId = new Int16Array(n * MAXC);
  const cB = new Float64Array(n * MAXC * 9);      // rows: normal, t1, t2
  const cC0 = new Float64Array(n * MAXC);         // normal gap at x-
  const cDq = new Float64Array(n * MAXC * 3);     // the shape's move this step
  const cPen = new Float64Array(n * MAXC * 3), cLam = new Float64Array(n * MAXC * 3);
  // Last step's, for the warm start: matched by which shape it was.
  const pN = new Int8Array(n), pId = new Int16Array(n * MAXC);
  const pPen = new Float64Array(n * MAXC * 3), pLam = new Float64Array(n * MAXC * 3);

  // The world the contacts are against: capsules at the start (`a0`, `b0`)
  // and end (`a1`, `b1`) of the step, their radius at each end, and a mask
  // per link of the ones it ignores. And a floor, as a height at each end.
  // (Made by the caller when it is `avbdChainOwn` — see there.)
  const shapes = o.shapes || avbdShapes(n);
  function setShapeCount(k) {
    shapes.count = k;
    shapes.a0 = new Float64Array(3 * k); shapes.b0 = new Float64Array(3 * k);
    shapes.a1 = new Float64Array(3 * k); shapes.b1 = new Float64Array(3 * k);
    shapes.r = new Float64Array(2 * k);
  }

  // The system for one body, as the reference lays it out: lin, ang and the
  // cross block (rows angular, columns linear), and the two halves of the rhs.
  const aL = new Float64Array(9), aA = new Float64Array(9), aX = new Float64Array(9);
  const bL = new Float64Array(3), bA = new Float64Array(3);
  const dxL = new Float64Array(3), dxA = new Float64Array(3);
  const S = new Float64Array(9), T = new Float64Array(9);
  const tmp3 = new Float64Array(3);

  /**
   * The joints' stiffness: Infinity is the hard joint (the reference's
   * `stiffnessLin = Infinity`), anything else a spring of that many N/m —
   * the reference's finite stiffness, for which the penalty is clamped to it
   * and there is no dual variable. See CHAIN.tautK for why it is switched.
   */
  let jointK = Infinity;
  function setJointK(k) {
    if (k === jointK) return;
    jointK = k;
    if (k !== Infinity) jLam.fill(0);
  }

  const stats = o.stats || avbdStats();

  // ── small helpers, all scalar ─────────────────────────────────────────

  /** The body's local x axis in the world, times s, into out[o..o+2]. */
  function axisX(i, s, out, oo) {
    const x = Q[4 * i], y = Q[4 * i + 1], z = Q[4 * i + 2], w = Q[4 * i + 3];
    out[oo] = (1 - 2 * (y * y + z * z)) * s;
    out[oo + 1] = 2 * (x * y + w * z) * s;
    out[oo + 2] = 2 * (x * z - w * y) * s;
  }
  function axisY(i, out, oo) {
    const x = Q[4 * i], y = Q[4 * i + 1], z = Q[4 * i + 2], w = Q[4 * i + 3];
    out[oo] = 2 * (x * y - w * z);
    out[oo + 1] = 1 - 2 * (x * x + z * z);
    out[oo + 2] = 2 * (y * z + w * x);
  }
  /** The demo's `quat + float3`: normalize(q + ½(v, 0)·q), in place at q[o]. */
  function qaddv(q, oo, vx, vy, vz, out, oOut) {
    const ax = q[oo], ay = q[oo + 1], az = q[oo + 2], aw = q[oo + 3];
    // (v, 0) · a
    const rx = vx * aw + vy * az - vz * ay;
    const ry = -vx * az + vy * aw + vz * ax;
    const rz = vx * ay - vy * ax + vz * aw;
    const rw = -vx * ax - vy * ay - vz * az;
    let x = ax + rx * 0.5, y = ay + ry * 0.5, z = az + rz * 0.5, w = aw + rw * 0.5;
    const l = 1 / Math.sqrt(x * x + y * y + z * z + w * w);
    out[oOut] = x * l; out[oOut + 1] = y * l; out[oOut + 2] = z * l; out[oOut + 3] = w * l;
  }
  /** The demo's `quat - quat`: 2·vec(a·b⁻¹), unit quaternions. */
  function qsub(a, oa, b, ob, out) {
    const ax = a[oa], ay = a[oa + 1], az = a[oa + 2], aw = a[oa + 3];
    const bx = -b[ob], by = -b[ob + 1], bz = -b[ob + 2], bw = b[ob + 3];
    out[0] = 2 * (aw * bx + ax * bw + ay * bz - az * by);
    out[1] = 2 * (aw * by - ax * bz + ay * bw + az * bx);
    out[2] = 2 * (aw * bz + ax * by - ay * bx + az * bw);
  }

  // ── joint k: C = pA − pB, in the world ────────────────────────────────
  const jEv = new Float64Array(3);
  function jointC(k, start) {
    let ax, ay, az, bx, by, bz;
    const A = start ? anchor0 : anchor;
    if (k === 0) { ax = A[0]; ay = A[1]; az = A[2]; } else {
      axisX(k - 1, half, tmp3, 0);
      ax = P[3 * k - 3] + tmp3[0]; ay = P[3 * k - 2] + tmp3[1]; az = P[3 * k - 1] + tmp3[2];
    }
    if (k === n) { bx = A[3]; by = A[4]; bz = A[5]; } else {
      axisX(k, -half, tmp3, 0);
      bx = P[3 * k] + tmp3[0]; by = P[3 * k + 1] + tmp3[1]; bz = P[3 * k + 2] + tmp3[2];
    }
    jEv[0] = ax - bx; jEv[1] = ay - by; jEv[2] = az - bz;
    return jEv;
  }

  /**
   * Stamp joint k into body i's system. `isA`: i is the joint's A side (the
   * joint at i's +x end), else its B side (the −x end). forces.ts, Joint.
   */
  const rw = new Float64Array(3), F = new Float64Array(3);
  function stampJoint(k, i, isA, alpha) {
    const C = jointC(k, false);
    const o3 = 3 * k;
    const k0 = jPen[o3], k1 = jPen[o3 + 1], k2 = jPen[o3 + 2];
    // Stabilisation: hard rows forgive alpha of the error at x-; a spring
    // (finite `jointK`) has nothing to forgive and no multiplier.
    const a = jointK === Infinity ? alpha : 0;
    const c0 = C[0] - a * jC0[o3], c1 = C[1] - a * jC0[o3 + 1], c2 = C[2] - a * jC0[o3 + 2];
    F[0] = k0 * c0 + jLam[o3]; F[1] = k1 * c1 + jLam[o3 + 1]; F[2] = k2 * c2 + jLam[o3 + 2];
    // The anchor's arm in the world, and the angular Jacobian: skew(−r) for
    // A, skew(r) for B — `s` below is the vector the skew is of.
    axisX(i, isA ? half : -half, rw, 0);
    const sgn = isA ? 1 : -1;
    const sx = -sgn * rw[0], sy = -sgn * rw[1], sz = -sgn * rw[2];
    // S = skew(s), rows.
    S[0] = 0; S[1] = -sz; S[2] = sy;
    S[3] = sz; S[4] = 0; S[5] = -sx;
    S[6] = -sy; S[7] = sx; S[8] = 0;
    // lin += K
    aL[0] += k0; aL[4] += k1; aL[8] += k2;
    // T = Sᵀ K  (3x3): T[r][c] = S[c][r] * k_c
    for (let r = 0; r < 3; r++) {
      T[3 * r] = S[r] * k0; T[3 * r + 1] = S[3 + r] * k1; T[3 * r + 2] = S[6 + r] * k2;
    }
    // ang += Sᵀ K S ; cross += Sᵀ K · sgn
    for (let r = 0; r < 3; r++) {
      const t0 = T[3 * r], t1 = T[3 * r + 1], t2 = T[3 * r + 2];
      aA[3 * r] += t0 * S[0] + t1 * S[3] + t2 * S[6];
      aA[3 * r + 1] += t0 * S[1] + t1 * S[4] + t2 * S[7];
      aA[3 * r + 2] += t0 * S[2] + t1 * S[5] + t2 * S[8];
      aX[3 * r] += t0 * sgn; aX[3 * r + 1] += t1 * sgn; aX[3 * r + 2] += t2 * sgn;
    }
    // The lumped geometric stiffness: H = −(F·r)I + r Fᵀ, with r the arm for
    // A and minus it for B, and its column norms on the diagonal.
    const gx_ = sgn * rw[0], gy_ = sgn * rw[1], gz_ = sgn * rw[2];
    const fr = F[0] * gx_ + F[1] * gy_ + F[2] * gz_;
    for (let c = 0; c < 3; c++) {
      const h0 = gx_ * F[c] - (c === 0 ? fr : 0);
      const h1 = gy_ * F[c] - (c === 1 ? fr : 0);
      const h2 = gz_ * F[c] - (c === 2 ? fr : 0);
      aA[4 * c] += Math.sqrt(h0 * h0 + h1 * h1 + h2 * h2);
    }
    // rhs: lin += sgn·F, ang += Sᵀ F
    bL[0] += sgn * F[0]; bL[1] += sgn * F[1]; bL[2] += sgn * F[2];
    bA[0] += S[0] * F[0] + S[3] * F[1] + S[6] * F[2];
    bA[1] += S[1] * F[0] + S[4] * F[1] + S[7] * F[2];
    bA[2] += S[2] * F[0] + S[5] * F[1] + S[8] * F[2];
  }

  // ── twist k between body k-1 and body k (k = 1..n-1) ──────────────────
  // C = cos φ · sign(sin φ), φ the turn from A's y to B's y about their mean
  // run; zero at either quarter turn and ≈ −(φ ∓ 90°) near them.
  const tw = new Float64Array(8);
  function twistEval(k) {
    const a = k - 1, b = k;
    axisX(a, 1, tmp3, 0);
    let ux = tmp3[0], uy = tmp3[1], uz = tmp3[2];
    axisX(b, 1, tmp3, 0);
    ux += tmp3[0]; uy += tmp3[1]; uz += tmp3[2];
    // `Math.sqrt` of the sum and not `Math.hypot` in everything that runs per
    // link per iteration: hypot is correct about overflow nobody here can
    // reach and several times slower, and with two chains on her (1.528.0)
    // it was a measurable share of the solve.
    const ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
    if (ul < 1e-6) return 0;
    ux /= ul; uy /= ul; uz /= ul;
    axisY(a, tmp3, 0);
    let ax = tmp3[0], ay = tmp3[1], az = tmp3[2];
    let d = ax * ux + ay * uy + az * uz;
    ax -= d * ux; ay -= d * uy; az -= d * uz;
    axisY(b, tmp3, 0);
    let bx = tmp3[0], by = tmp3[1], bz = tmp3[2];
    d = bx * ux + by * uy + bz * uz;
    bx -= d * ux; by -= d * uy; bz -= d * uz;
    const la = Math.sqrt((ax * ax + ay * ay + az * az) * (bx * bx + by * by + bz * bz));
    if (la < 1e-8) return 0;
    const c = (ax * bx + ay * by + az * bz) / la;
    const s = (ux * (ay * bz - az * by) + uy * (az * bx - ax * bz) + uz * (ax * by - ay * bx)) / la;
    tw[0] = ux; tw[1] = uy; tw[2] = uz;
    tw[3] = s < 0 ? -c : c;          // C
    tw[4] = Math.abs(s);             // |dC/dφ|
    return 1;
  }
  function stampTwist(k, i) {
    if (!o.twist || !twistEval(k)) return;
    // dC/dθ_A = |s|·u, dC/dθ_B = −|s|·u (see the note on the row).
    const j = tw[4] * (i === k - 1 ? 1 : -1);
    const kk = o.twist;
    const f = kk * tw[3];
    const jx = j * tw[0], jy = j * tw[1], jz = j * tw[2];
    aA[0] += kk * jx * jx; aA[1] += kk * jx * jy; aA[2] += kk * jx * jz;
    aA[3] += kk * jy * jx; aA[4] += kk * jy * jy; aA[5] += kk * jy * jz;
    aA[6] += kk * jz * jx; aA[7] += kk * jz * jy; aA[8] += kk * jz * jz;
    bA[0] += jx * f; bA[1] += jy * f; bA[2] += jz * f;
  }

  // ── contacts ──────────────────────────────────────────────────────────
  // Contact stiffness: Infinity for the reference's hard contact, else a
  // spring of that many N/m on each row — see CHAIN.contactK for why.
  const contactK = o.contactK === undefined ? Infinity : o.contactK;
  const softC = contactK !== Infinity, cCap = Math.min(AVBD.penMax, contactK);
  const cF = new Float64Array(3), cC = new Float64Array(3);
  let cBound = 0, cFric = 0;
  /** Contact m of body i: C and the cone-clamped force into cC, cF. */
  function contactEval(i, m, alpha) {
    const q = i * MAXC + m, b = 9 * q;
    const dx = P[3 * i] - P0[3 * i] - cDq[3 * q];
    const dy = P[3 * i + 1] - P0[3 * i + 1] - cDq[3 * q + 1];
    const dz = P[3 * i + 2] - P0[3 * i + 2] - cDq[3 * q + 2];
    for (let r = 0; r < 3; r++) {
      cC[r] = cB[b + 3 * r] * dx + cB[b + 3 * r + 1] * dy + cB[b + 3 * r + 2] * dz;
    }
    // Hard contacts forgive alpha of the gap they started the step with, as
    // the reference's do; a soft one (finite `contactK`) is a spring on all
    // of it, with no multiplier.
    cC[0] += cC0[q] * (softC ? 1 : 1 - alpha);
    for (let r = 0; r < 3; r++) cF[r] = cPen[3 * q + r] * cC[r] + cLam[3 * q + r];
    if (cF[0] > 0) cF[0] = 0;
    cBound = -cF[0] * o.mu;
    cFric = Math.sqrt(cF[1] * cF[1] + cF[2] * cF[2]);
    if (cFric > cBound && cFric > 0) {
      const s = cBound / cFric;
      cF[1] *= s; cF[2] *= s;
    }
  }
  function stampContacts(i, alpha) {
    for (let m = 0; m < cN[i]; m++) {
      contactEval(i, m, alpha);
      if (cF[0] >= 0) continue;           // not pushing: not there
      const q = i * MAXC + m, b = 9 * q;
      for (let r = 0; r < 3; r++) {
        const k = cPen[3 * q + r];
        const nx = cB[b + 3 * r], ny = cB[b + 3 * r + 1], nz = cB[b + 3 * r + 2];
        aL[0] += k * nx * nx; aL[1] += k * nx * ny; aL[2] += k * nx * nz;
        aL[3] += k * ny * nx; aL[4] += k * ny * ny; aL[5] += k * ny * nz;
        aL[6] += k * nz * nx; aL[7] += k * nz * ny; aL[8] += k * nz * nz;
        bL[0] += cF[r] * nx; bL[1] += cF[r] * ny; bL[2] += cF[r] * nz;
      }
    }
  }

  /** A tangent basis for normal (nx, ny, nz) into cB at b. manifold.ts's `orthonormal`. */
  function basis(b, nx, ny, nz) {
    cB[b] = nx; cB[b + 1] = ny; cB[b + 2] = nz;
    let tx, ty, tz;
    if (Math.abs(nx) > Math.abs(nz)) { tx = -ny; ty = nx; tz = 0; } else { tx = 0; ty = -nz; tz = ny; }
    const l = 1 / Math.hypot(tx, ty, tz);
    tx *= l; ty *= l; tz *= l;
    cB[b + 3] = tx; cB[b + 4] = ty; cB[b + 5] = tz;
    cB[b + 6] = ny * tz - nz * ty; cB[b + 7] = nz * tx - nx * tz; cB[b + 8] = nx * ty - ny * tx;
  }

  /** Record one contact on link i as its `cnt`-th; returns the new count. */
  function addContact(i, cnt, id, nx, ny, nz, gap, mx, my, mz) {
    let m = cnt;
    if (cnt === MAXC) {
      // Full: replace the shallowest, if this one is deeper.
      let worst = -1, wg = gap;
      for (let j = 0; j < MAXC; j++) if (cC0[i * MAXC + j] > wg) { wg = cC0[i * MAXC + j]; worst = j; }
      if (worst < 0) return cnt;
      m = worst;
    } else cnt++;
    const q = i * MAXC + m;
    cId[q] = id;
    basis(9 * q, nx, ny, nz);
    cC0[q] = gap;
    cDq[3 * q] = mx; cDq[3 * q + 1] = my; cDq[3 * q + 2] = mz;
    // Warm start from the same shape last step (Eq. 19), else fresh.
    let found = -1;
    for (let j = 0; j < pN[i]; j++) if (pId[i * MAXC + j] === id) { found = i * MAXC + j; break; }
    for (let r = 0; r < 3; r++) {
      if (found >= 0) {
        cLam[3 * q + r] = pLam[3 * found + r] * o.alpha * o.gamma;
        cPen[3 * q + r] = Math.min(cCap, Math.max(AVBD.penMin, pPen[3 * found + r] * o.gamma));
      } else { cLam[3 * q + r] = 0; cPen[3 * q + r] = AVBD.penMin; }
    }
    // The lambda was expressed in last step's basis; with a normal that
    // barely turns in 8 ms, only the normal row's is worth carrying.
    if (found >= 0) { cLam[3 * q + 1] = 0; cLam[3 * q + 2] = 0; }
    return cnt;
  }

  /** Whether link i was in contact with shape s last step. */
  function touched(i, s) {
    for (let j = 0; j < pN[i]; j++) if (pId[i * MAXC + j] === s) return true;
    return false;
  }

  /**
   * Find this step's contacts: every capsule (and the floor) within `margin`
   * of each link at the START of the step, with the normal and gap there and
   * the capsule's own move over the step at the closest point.
   */
  function collide(margin) {
    const R = o.rLink;
    const sh = shapes;
    // Last step's state, kept for the warm start.
    pN.set(cN); pId.set(cId); pPen.set(cPen); pLam.set(cLam);
    let total = 0;
    for (let i = 0; i < n; i++) {
      const px = P[3 * i], py = P[3 * i + 1], pz = P[3 * i + 2];
      let cnt = 0;
      const ign = sh.ignore[i];
      for (let s = 0; s < sh.count; s++) {
        if (ign & (1 << s)) continue;
        const a = 3 * s;
        const ax = sh.a0[a], ay = sh.a0[a + 1], az = sh.a0[a + 2];
        const ex = sh.b0[a] - ax, ey = sh.b0[a + 1] - ay, ez = sh.b0[a + 2] - az;
        const ee = ex * ex + ey * ey + ez * ez;
        let t = ee > 1e-12 ? ((px - ax) * ex + (py - ay) * ey + (pz - az) * ez) / ee : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + ex * t, qy = ay + ey * t, qz = az + ez * t;
        const rr = sh.r[2 * s] + (sh.r[2 * s + 1] - sh.r[2 * s]) * t;
        let nx = px - qx, ny = py - qy, nz = pz - qz;
        // Out of reach on the square first: most of her is, for most links.
        const lim = rr + R + margin, dd = nx * nx + ny * ny + nz * nz;
        if (dd > lim * lim) continue;
        const d = Math.sqrt(dd);
        const gap = d - rr - R;
        if (gap > margin) continue;
        if (d < 1e-6) continue;
        // ONLY FROM OUTSIDE. A link found well inside a shape it was not
        // touching last step did not get there by sliding over its surface:
        // it was laid there, or a limb went through the chain faster than a
        // step can follow. Pushing it out along the nearest normal would as
        // often put it on the far side of her — round her neck, behind her
        // thigh — so it is left to pass through, and caught again the next
        // time it comes at the surface from outside.
        if (gap < -o.deep && !touched(i, s)) continue;
        nx /= d; ny /= d; nz /= d;
        // Where that point of the capsule goes by the end of the step.
        const mx = (sh.a1[a] + (sh.b1[a] - sh.a1[a]) * t) - qx;
        const my = (sh.a1[a + 1] + (sh.b1[a + 1] - sh.a1[a + 1]) * t) - qy;
        const mz = (sh.a1[a + 2] + (sh.b1[a + 2] - sh.a1[a + 2]) * t) - qz;
        cnt = addContact(i, cnt, s, nx, ny, nz, gap, mx, my, mz);
      }
      // The floor: a plane, up.
      const fg = py - R - sh.floor0;
      if (fg < margin) cnt = addContact(i, cnt, 31, 0, 1, 0, fg, 0, sh.floor1 - sh.floor0, 0);
      cN[i] = cnt;
      total += cnt;
    }
    stats.contacts = total;
  }

  // ── the step (solver.ts, Solver.step) ─────────────────────────────────
  function step(h) {
    const alpha = o.alpha;
    // Contacts at x-, with the shapes where they were at the start.
    collide(o.margin);
    // Joints: C0 against where the anchors were, and the warm start.
    for (let k = 0; k < NJ; k++) {
      const C = jointC(k, true);
      for (let r = 0; r < 3; r++) {
        const q = 3 * k + r;
        jC0[q] = C[r];
        jLam[q] *= o.alpha * o.gamma;
        jPen[q] = Math.min(AVBD.penMax, jointK, Math.max(AVBD.penMin, jPen[q] * o.gamma));
      }
    }
    // Bodies: the inertial target (Eq. 2) and the adaptive warm start.
    const h2 = h * h;
    for (let i = 0; i < n; i++) {
      const p = 3 * i, q = 4 * i;
      PI[p] = P[p] + V[p] * h + gx * h2;
      PI[p + 1] = P[p + 1] + V[p + 1] * h + gy * h2;
      PI[p + 2] = P[p + 2] + V[p + 2] * h + gz * h2;
      qaddv(Q, q, W[p] * h, W[p + 1] * h, W[p + 2] * h, QI, q);
      const ax = (V[p] - VP[p]) / h, ay = (V[p + 1] - VP[p + 1]) / h, az = (V[p + 2] - VP[p + 2]) / h;
      let wgt = (ax * gx + ay * gy + az * gz) / (gLen * gLen);
      wgt = wgt > 1 ? 1 : wgt > 0 ? wgt : 0;
      P0[p] = P[p]; P0[p + 1] = P[p + 1]; P0[p + 2] = P[p + 2];
      Q0[q] = Q[q]; Q0[q + 1] = Q[q + 1]; Q0[q + 2] = Q[q + 2]; Q0[q + 3] = Q[q + 3];
      P[p] += V[p] * h + gx * wgt * h2;
      P[p + 1] += V[p + 1] * h + gy * wgt * h2;
      P[p + 2] += V[p + 2] * h + gz * wgt * h2;
      Q[q] = QI[q]; Q[q + 1] = QI[q + 1]; Q[q + 2] = QI[q + 2]; Q[q + 3] = QI[q + 3];
    }
    const mh = mass / h2, ixh = Ix / h2, iyh = Iy / h2, izh = Iz / h2;
    for (let it = 0; it < o.iterations; it++) {
      // Primal, newest body first as the reference walks its list. NOT
      // alternated end to end, which was tried and measured: the dual update
      // between two sweeps that run opposite ways overshoots, and at five
      // iterations the chain crept to 160 mm of total stretch in ten seconds
      // where one direction holds it under 2.
      for (let i = n - 1; i >= 0; i--) {
        const p = 3 * i, q = 4 * i;
        aL.fill(0); aA.fill(0); aX.fill(0);
        aL[0] = mh; aL[4] = mh; aL[8] = mh;
        // The inertia is in the link's own frame and the system is in the
        // world's; the reference keeps a diagonal world inertia for boxes,
        // which is what it would be for a sphere. For a link it is R·I·Rᵀ.
        {
          const x = Q[q], y = Q[q + 1], z = Q[q + 2], w = Q[q + 3];
          const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - w * z), r02 = 2 * (x * z + w * y);
          const r10 = 2 * (x * y + w * z), r11 = 1 - 2 * (x * x + z * z), r12 = 2 * (y * z - w * x);
          const r20 = 2 * (x * z - w * y), r21 = 2 * (y * z + w * x), r22 = 1 - 2 * (x * x + y * y);
          aA[0] = r00 * r00 * ixh + r01 * r01 * iyh + r02 * r02 * izh;
          aA[1] = r00 * r10 * ixh + r01 * r11 * iyh + r02 * r12 * izh;
          aA[2] = r00 * r20 * ixh + r01 * r21 * iyh + r02 * r22 * izh;
          aA[4] = r10 * r10 * ixh + r11 * r11 * iyh + r12 * r12 * izh;
          aA[5] = r10 * r20 * ixh + r11 * r21 * iyh + r12 * r22 * izh;
          aA[8] = r20 * r20 * ixh + r21 * r21 * iyh + r22 * r22 * izh;
          aA[3] = aA[1]; aA[6] = aA[2]; aA[7] = aA[5];
        }
        bL[0] = mh * (P[p] - PI[p]); bL[1] = mh * (P[p + 1] - PI[p + 1]); bL[2] = mh * (P[p + 2] - PI[p + 2]);
        qsub(Q, q, QI, q, tmp3);
        bA[0] = aA[0] * tmp3[0] + aA[1] * tmp3[1] + aA[2] * tmp3[2];
        bA[1] = aA[3] * tmp3[0] + aA[4] * tmp3[1] + aA[5] * tmp3[2];
        bA[2] = aA[6] * tmp3[0] + aA[7] * tmp3[1] + aA[8] * tmp3[2];
        stampJoint(i, i, false, alpha);       // the joint at its −x end
        stampJoint(i + 1, i, true, alpha);    // and at its +x end
        if (i > 0) stampTwist(i, i);
        if (i < n - 1) stampTwist(i + 1, i);
        stampContacts(i, o.alphaContact);
        bL[0] = -bL[0]; bL[1] = -bL[1]; bL[2] = -bL[2];
        bA[0] = -bA[0]; bA[1] = -bA[1]; bA[2] = -bA[2];
        avbdSolve6(aL, aA, aX, bL, bA, dxL, dxA);
        P[p] += dxL[0]; P[p + 1] += dxL[1]; P[p + 2] += dxL[2];
        qaddv(Q, q, dxA[0], dxA[1], dxA[2], Q, q);
      }
      // Dual (forces.ts updateDual; manifold.ts updateDual).
      const hard = jointK === Infinity, jCap = Math.min(AVBD.penMax, jointK);
      for (let k = 0; k < NJ; k++) {
        const C = jointC(k, false);
        for (let r = 0; r < 3; r++) {
          const q = 3 * k + r;
          const c = hard ? C[r] - alpha * jC0[q] : C[r];
          if (hard) jLam[q] += jPen[q] * c;
          jPen[q] = Math.min(jCap, jPen[q] + o.beta * Math.abs(c));
        }
      }
      for (let i = 0; i < n; i++) {
        for (let m = 0; m < cN[i]; m++) {
          contactEval(i, m, o.alphaContact);
          const q = i * MAXC + m;
          if (!softC) { cLam[3 * q] = cF[0]; cLam[3 * q + 1] = cF[1]; cLam[3 * q + 2] = cF[2]; }
          if (cF[0] < 0) cPen[3 * q] = Math.min(cCap, cPen[3 * q] + o.beta * Math.abs(cC[0]));
          if (cFric <= cBound) {
            cPen[3 * q + 1] = Math.min(cCap, cPen[3 * q + 1] + o.beta * Math.abs(cC[1]));
            cPen[3 * q + 2] = Math.min(cCap, cPen[3 * q + 2] + o.beta * Math.abs(cC[2]));
          }
        }
      }
    }
    // Velocities, BDF1 — with a little air drag, and a ceiling so that one
    // bad step is one bad frame and not an explosion.
    const keep = Math.exp(-o.drag * h), vMax = o.vMax;
    for (let i = 0; i < n; i++) {
      const p = 3 * i, q = 4 * i;
      VP[p] = V[p]; VP[p + 1] = V[p + 1]; VP[p + 2] = V[p + 2];
      let vx = (P[p] - P0[p]) / h * keep, vy = (P[p + 1] - P0[p + 1]) / h * keep, vz = (P[p + 2] - P0[p + 2]) / h * keep;
      const v = Math.hypot(vx, vy, vz);
      if (v > vMax) { vx *= vMax / v; vy *= vMax / v; vz *= vMax / v; }
      V[p] = vx; V[p + 1] = vy; V[p + 2] = vz;
      qsub(Q, q, Q0, q, tmp3);
      W[p] = tmp3[0] / h * keep; W[p + 1] = tmp3[1] / h * keep; W[p + 2] = tmp3[2] / h * keep;
    }
    stats.steps++;
  }

  /** Measure the joints as they stand: the worst gap, and all of them added up. */
  function measure() {
    let js = 0, sum = 0;
    for (let k = 0; k < NJ; k++) {
      const C = jointC(k, false);
      const g = Math.hypot(C[0], C[1], C[2]);
      if (g > js) js = g;
      sum += g;
    }
    stats.maxStretch = js;
    stats.sumStretch = sum;
    return stats;
  }

  /**
   * How far the worst link centre is inside a shape's surface, against the
   * shapes where they are now (`a1`, `b1`) — positive is inside, metres.
   * Ignored pairs are skipped, as in the solve. And which shape it was.
   * `floor` false leaves the floor out, so her body can be asked about on
   * its own — a chain that lies on the floor is 6 mm clear of it at rest,
   * and the worst of the two would always be the floor.
   */
  function depth(floor = true) {
    const sh = shapes;
    let worst = -1, who = -1, link = -1;
    for (let i = 0; i < n; i++) {
      const px = P[3 * i], py = P[3 * i + 1], pz = P[3 * i + 2];
      for (let s = 0; s < sh.count; s++) {
        if (sh.ignore[i] & (1 << s)) continue;
        const a = 3 * s;
        const ax = sh.a1[a], ay = sh.a1[a + 1], az = sh.a1[a + 2];
        const ex = sh.b1[a] - ax, ey = sh.b1[a + 1] - ay, ez = sh.b1[a + 2] - az;
        const ee = ex * ex + ey * ey + ez * ez;
        let t = ee > 1e-12 ? ((px - ax) * ex + (py - ay) * ey + (pz - az) * ez) / ee : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(px - ax - ex * t, py - ay - ey * t, pz - az - ez * t);
        const inside = sh.r[2 * s] + (sh.r[2 * s + 1] - sh.r[2 * s]) * t - d;
        if (inside > worst) { worst = inside; who = s; link = i; }
      }
      const fl = sh.floor1 - py;
      if (floor && fl > worst) { worst = fl; who = 31; link = i; }
    }
    stats.maxPen = worst;
    stats.penShape = who;
    stats.penLink = link;
    return worst;
  }

  /**
   * Lay the chain down along `at(u, out)` — u 0..1 of its length — at rest,
   * each link's run along the curve and turned a quarter from the last.
   */
  const _e = new Float64Array(6);
  function lay(at) {
    let ny = 0, nyy = 1, nyz = 0;   // a carried normal (see the old corkscrew)
    for (let i = 0; i < n; i++) {
      at(i / n, _e, 0); at((i + 1) / n, _e, 3);
      let tx = _e[3] - _e[0], ty = _e[4] - _e[1], tz = _e[5] - _e[2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      P[3 * i] = (_e[0] + _e[3]) * 0.5; P[3 * i + 1] = (_e[1] + _e[4]) * 0.5; P[3 * i + 2] = (_e[2] + _e[5]) * 0.5;
      // Carry the normal, then turn every other one a quarter.
      let d = ny * tx + nyy * ty + nyz * tz;
      let yx = ny - d * tx, yy = nyy - d * ty, yz = nyz - d * tz;
      let yl = Math.hypot(yx, yy, yz);
      if (yl < 1e-6) { yx = -ty; yy = tx; yz = 0; yl = Math.hypot(yx, yy, yz) || 1; if (yl < 1e-6) { yx = 0; yy = 0; yz = 1; yl = 1; } }
      yx /= yl; yy /= yl; yz /= yl;
      ny = yx; nyy = yy; nyz = yz;
      if (i & 1) {
        const cx = ty * yz - tz * yy, cy = tz * yx - tx * yz, cz = tx * yy - ty * yx;
        yx = cx; yy = cy; yz = cz;
      }
      const zx = ty * yz - tz * yy, zy = tz * yx - tx * yz, zz = tx * yy - ty * yx;
      avbdQuatFromBasis(tx, ty, tz, yx, yy, yz, zx, zy, zz, Q, 4 * i);
    }
    V.fill(0); W.fill(0); VP.fill(0);
    jPen.fill(AVBD.penMin); jLam.fill(0);
    cN.fill(0); cPen.fill(AVBD.penMin); cLam.fill(0);
  }

  return { n, half, P, Q, V, anchor, anchor0, shapes, setShapeCount, setJointK, step, lay, measure, depth, stats,
    cN, cC0, cId, MAXC, jointC };
}

/** Rotation matrix columns (x, y, z) to a quaternion, into out[o]. */
/**
 * ── A COPY OF THE SOLVER OF ITS OWN, FOR EVERY CHAIN ───────────────────────
 *
 * `avbdChain` keeps its state in closures — the reference's classes, flattened
 * into one function's locals so every hot loop reads typed arrays it can see.
 * That is fast for ONE chain and 2.5 times slower for two, measured: the wrist
 * chain at rest cost 0.30 ms a frame, and the same chain taken off and put
 * back on cost 0.76 from then on; with the ankle chain on as well (1.528.0)
 * both paid it all the time. It is the engine, not the arithmetic. V8 compiles
 * a closure specialised to the one set of variables it closes over, and the
 * moment a second closure is made from the same source it throws that away
 * for code that must fetch every array through whichever instance it is
 * handed — for every link, every iteration.
 *
 * So each chain gets its own compiled copy: the same source text made into a
 * new function, whose closures are the first and only ones of their kind.
 * The three names it uses from outside are handed in, because a function made
 * this way sees only the global scope. Parsing it costs about a millisecond,
 * once, when the cuffs go on. If the page ever cannot make functions from
 * text (a content-security policy), it falls back to the shared one, which is
 * correct and merely slower.
 */
function avbdChainOwn(o) {
  // AND EVERYTHING THE CALLER READS IS MADE OUT HERE. An object literal
  // inside the copy is a literal of the copy's, with a hidden class of its
  // own, so the caller's code — `chainTick`, `chainShapes`, reading
  // `sim.shapes.a0` and `sim.P` for every chain — saw a new class for every
  // chain put on and went megamorphic by the fourth: the fix made the second
  // chain fast and the fifth slow again. Made here, by this one function,
  // they are one class however many copies there are.
  const shapes = avbdShapes(o.n), stats = avbdStats();
  let s;
  try {
    const make = new Function('AVBD', 'avbdQuatFromBasis', 'avbdSolve6', 'avbdShapes', 'avbdStats',
      'return (' + avbdChain.toString() + ');');
    s = make(AVBD, avbdQuatFromBasis, avbdSolve6, avbdShapes, avbdStats)(Object.assign({ shapes, stats }, o));
  } catch (e) {
    console.warn('avbdChainOwn: ' + (e && e.message) + ' - using the shared solver');
    s = avbdChain(Object.assign({ shapes, stats }, o));
  }
  return { n: s.n, half: s.half, P: s.P, Q: s.Q, V: s.V, anchor: s.anchor, anchor0: s.anchor0,
    shapes: s.shapes, setShapeCount: s.setShapeCount, setJointK: s.setJointK, step: s.step,
    lay: s.lay, measure: s.measure, depth: s.depth, stats: s.stats,
    cN: s.cN, cC0: s.cC0, cId: s.cId, MAXC: s.MAXC, jointC: s.jointC };
}

/** A chain's world, and its numbers — see `avbdChainOwn` for why out here. */
function avbdShapes(n) {
  return { count: 0, a0: null, b0: null, a1: null, b1: null, r: null,
    ignore: new Uint32Array(n), floor0: -1e9, floor1: -1e9 };
}
function avbdStats() {
  return { maxStretch: 0, sumStretch: 0, maxPen: 0, penShape: -1, penLink: -1, contacts: 0, steps: 0 };
}

function avbdQuatFromBasis(m00, m10, m20, m01, m11, m21, m02, m12, m22, out, o) {
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
  }
  const l = 1 / Math.hypot(x, y, z, w);
  out[o] = x * l; out[o + 1] = y * l; out[o + 2] = z * l; out[o + 3] = w * l;
}

/**
 * The 6x6 SPD solve [lin crossᵀ; cross ang]·x = b by LDLᵀ — math.ts `solve6`,
 * unchanged. Only the lower triangle is read.
 */
function avbdSolve6(aLin, aAng, aCross, bLin, bAng, xLin, xAng) {
  const A11 = aLin[0];
  const A21 = aLin[3], A22 = aLin[4];
  const A31 = aLin[6], A32 = aLin[7], A33 = aLin[8];
  const A41 = aCross[0], A42 = aCross[1], A43 = aCross[2], A44 = aAng[0];
  const A51 = aCross[3], A52 = aCross[4], A53 = aCross[5], A54 = aAng[3], A55 = aAng[4];
  const A61 = aCross[6], A62 = aCross[7], A63 = aCross[8], A64 = aAng[6], A65 = aAng[7], A66 = aAng[8];

  const L21 = A21 / A11, L31 = A31 / A11, L41 = A41 / A11, L51 = A51 / A11, L61 = A61 / A11;
  const D1 = A11;
  const D2 = A22 - L21 * L21 * D1;
  const L32 = (A32 - L21 * L31 * D1) / D2;
  const L42 = (A42 - L21 * L41 * D1) / D2;
  const L52 = (A52 - L21 * L51 * D1) / D2;
  const L62 = (A62 - L21 * L61 * D1) / D2;
  const D3 = A33 - (L31 * L31 * D1 + L32 * L32 * D2);
  const L43 = (A43 - L31 * L41 * D1 - L32 * L42 * D2) / D3;
  const L53 = (A53 - L31 * L51 * D1 - L32 * L52 * D2) / D3;
  const L63 = (A63 - L31 * L61 * D1 - L32 * L62 * D2) / D3;
  const D4 = A44 - (L41 * L41 * D1 + L42 * L42 * D2 + L43 * L43 * D3);
  const L54 = (A54 - L41 * L51 * D1 - L42 * L52 * D2 - L43 * L53 * D3) / D4;
  const L64 = (A64 - L41 * L61 * D1 - L42 * L62 * D2 - L43 * L63 * D3) / D4;
  const D5 = A55 - (L51 * L51 * D1 + L52 * L52 * D2 + L53 * L53 * D3 + L54 * L54 * D4);
  const L65 = (A65 - L51 * L61 * D1 - L52 * L62 * D2 - L53 * L63 * D3 - L54 * L64 * D4) / D5;
  const D6 = A66 - (L61 * L61 * D1 + L62 * L62 * D2 + L63 * L63 * D3 + L64 * L64 * D4 + L65 * L65 * D5);

  const y1 = bLin[0];
  const y2 = bLin[1] - L21 * y1;
  const y3 = bLin[2] - L31 * y1 - L32 * y2;
  const y4 = bAng[0] - L41 * y1 - L42 * y2 - L43 * y3;
  const y5 = bAng[1] - L51 * y1 - L52 * y2 - L53 * y3 - L54 * y4;
  const y6 = bAng[2] - L61 * y1 - L62 * y2 - L63 * y3 - L64 * y4 - L65 * y5;
  const z1 = y1 / D1, z2 = y2 / D2, z3 = y3 / D3, z4 = y4 / D4, z5 = y5 / D5, z6 = y6 / D6;
  xAng[2] = z6;
  xAng[1] = z5 - L65 * xAng[2];
  xAng[0] = z4 - L54 * xAng[1] - L64 * xAng[2];
  xLin[2] = z3 - L43 * xAng[0] - L53 * xAng[1] - L63 * xAng[2];
  xLin[1] = z2 - L32 * xLin[2] - L42 * xAng[0] - L52 * xAng[1] - L62 * xAng[2];
  xLin[0] = z1 - L21 * xLin[1] - L31 * xLin[2] - L41 * xAng[0] - L51 * xAng[1] - L61 * xAng[2];
}

// ---------------------------------------------------------------------------
// ── AND ONE BALL ────────────────────────────────────────────────────────────
//
// Misha, 26 Sep 2026, after the ankle cuffs: *"the ball for doodle"*, and *"we
// wanna use AVBD for various stuff"*. The Slow Doodle's beach ball — BALL in
// src/43-ball.js — is one free rigid sphere, and it is solved here the way the
// chain's links are: the per-body 6x6 block solve over an inertial target,
// contact rows with a push-only normal and a Coulomb cone Taylor-expanded
// about the start of the step, the dual variable and the ramped penalty, the
// warm start matched by shape, the BDF1 velocities.
//
// IT IS NOT `avbdChain` WITH n = 1, and that was the first thing tried on
// paper. The chain is specialised to what a chain is — every body jointed to
// its neighbours, the two ends to moving anchors, its contacts at the link's
// centre with the angular part dropped (note (3) at the top) — and it is kept
// fast by being compiled once per chain (`avbdChainOwn`). A ball has no joints
// at all, and the one thing the chain threw away is the whole of a ball: the
// friction row's lever arm, which is what turns a slide into a roll. So this
// is the same solver written for a different body, over the same primitives
// (`avbdSolve6`, AVBD's clamps, the quaternion helpers just below, which are
// the chain's own `qaddv` and `qsub` lifted out), and the chain's hot loop is
// left exactly as it was measured.
//
// WHAT IS NEW, and why:
//
// (a) THE LEVER ARM. A contact is at the ball's surface, r = −R·n from its
// centre, so each friction row has an angular Jacobian r × t — the reference's
// `J[3..5]` for body A — and its stamp fills the cross block the chain's never
// touch. The normal row has none (r ∥ n for a sphere). Friction then sticks
// the contact point and the body rolls; nothing about rolling is scripted.
//
// (b) A POSITIVE GAP COUNTS IN FULL. The reference forgives `alpha` of a
// contact's starting error, which is right for a PENETRATION (ease it out) and
// wrong for a GAP (the contact is found `margin` early, so the body is still
// in the air). A ball arriving at 6 m/s is 5 cm from the floor one step out,
// and forgiving 90 % of that would stop it 4.5 cm up in mid-air and let it
// creep down over the next dozen steps. So a gap is counted whole and only a
// penetration is forgiven.
//
// (c) RESTITUTION, HONESTLY. AVBD's contact is inelastic: a hard row makes the
// relative normal velocity zero, and the paper has no bounce. So a bounce is
// a velocity pass after the solve, which is where position-based methods put
// it (Müller et al., "Detailed Rigid Body Simulation with Extended Position
// Based Dynamics", SCA 2020, sec. 3.6): for every contact that actually pushed
// this step, the relative normal velocity it arrived with (`cVn`, measured at
// the start of the step against the shape's own velocity) is reflected,
// times `e`, and written over what BDF1 said. Below `eMin` of approach there
// is no bounce, or a ball at rest would buzz on gravity's own 8 cm/s a step.
// The tangential velocity is the solve's — the cone did the spin.
//
// (d) ROLLING RESISTANCE. A rolling ball on a hard floor never stops in the
// solve, because the friction row holds rolling exactly. The vinyl flattens
// where it touches and the flags are not glass, so a torque of `roll`·N·R
// opposes the roll; applied at the velocity level it slows the contact's
// rolling by `roll`·g/(1 + I/mR²), and stops it when that is more than is
// left. Which also makes it a static threshold: a ball at rest stays at rest
// in a breeze that is less than `roll` of its weight.
//
// (e) THE FLOOR IS A FUNCTION, and it has steps. `world.floor(x, z)` is the
// promenade's own height query. A sphere against a height field is a contact
// under its centre (the normal off the slope there, unless one side of the
// slope is a step), plus a ring of eight probes a radius out: a probe that
// finds the ground higher is a step, bisected for its edge, and contacted as
// a wall (the ball's centre below the top) or as the edge's corner (above
// it). Without the ring, a ball rolling at a terrace is lifted up it through
// the wall on the frame its centre crosses.
//
// (f) BOXES. The promenade's walk-blockers, yawed boxes in the shore frame,
// handed in as world boxes: nearest point, normal from it, or out along the
// least-penetrated axis from inside.
//
// (g) WATER AND AIR, as forces in the inertial target and drag solved
// implicitly: buoyancy is the weight of the sea displaced by the cap under the
// waterline (π d²(3R − d)/3); drag is ½ρ·Cd·A|v|v against the water's drift
// and against the wind, each on its own share of the ball, and applied as
// v/(1 + k·h) so a ball that hits the sea at 8 m/s cannot overshoot to −8 in
// one step, which an explicit quadratic drag in water does at once.
//
// (h) PEOPLE ARE SPRINGS. A capsule on somebody is kinematic — infinitely
// heavy, going where the animation puts it — and the ground and the boxes
// are hard. Squeeze the ball between the two, which is what a creature
// nosing it along a terrace wall does, and there is no answer: a hard row
// each way, and whichever wins the ball goes through the other. It went
// through the terrace, and came out of the top at 6 m/s. So the capsules'
// rows are the reference's finite-stiffness contact (`capK` N/m, no
// multiplier — the chain's `contactK`), and in a squeeze it is the snout the
// ball gives into, a centimetre or two, and not the concrete.
// ---------------------------------------------------------------------------

/** q ← normalize(q + ½(v, 0)·q), the demo's `quat + float3`, out of place. */
function avbdQAddV(q, oq, vx, vy, vz, out, oo) {
  const ax = q[oq], ay = q[oq + 1], az = q[oq + 2], aw = q[oq + 3];
  const rx = vx * aw + vy * az - vz * ay;
  const ry = -vx * az + vy * aw + vz * ax;
  const rz = vx * ay - vy * ax + vz * aw;
  const rw = -vx * ax - vy * ay - vz * az;
  const x = ax + rx * 0.5, y = ay + ry * 0.5, z = az + rz * 0.5, w = aw + rw * 0.5;
  const l = 1 / Math.sqrt(x * x + y * y + z * z + w * w);
  out[oo] = x * l; out[oo + 1] = y * l; out[oo + 2] = z * l; out[oo + 3] = w * l;
}
/** The demo's `quat − quat`: 2·vec(a·b⁻¹), into out[0..2]. */
function avbdQSub(a, oa, b, ob, out) {
  const ax = a[oa], ay = a[oa + 1], az = a[oa + 2], aw = a[oa + 3];
  const bx = -b[ob], by = -b[ob + 1], bz = -b[ob + 2], bw = b[ob + 3];
  out[0] = 2 * (aw * bx + ax * bw + ay * bz - az * by);
  out[1] = 2 * (aw * by - ax * bz + ay * bw + az * bx);
  out[2] = 2 * (aw * bz + ax * by - ay * bx + az * bw);
}
/** A contact frame for normal n into out[o..o+8]: n, t1, t2. manifold.ts's `orthonormal`. */
function avbdOrtho(out, o, nx, ny, nz) {
  out[o] = nx; out[o + 1] = ny; out[o + 2] = nz;
  let tx, ty, tz;
  if (Math.abs(nx) > Math.abs(nz)) { tx = -ny; ty = nx; tz = 0; } else { tx = 0; ty = -nz; tz = ny; }
  const l = 1 / Math.sqrt(tx * tx + ty * ty + tz * tz);
  tx *= l; ty *= l; tz *= l;
  out[o + 3] = tx; out[o + 4] = ty; out[o + 5] = tz;
  out[o + 6] = ny * tz - nz * ty; out[o + 7] = nz * tx - nx * tz; out[o + 8] = nx * ty - ny * tx;
}

/**
 * Ids a contact is warm-started by. Capsules bring their own (`world.cid`),
 * which the caller keeps under 1000; the ground and the boxes are these.
 */
const AVBD_BALL_ID = { floor: 1000, step: 1001, box: 2000 };

/**
 * One ball. `o` — r (m), mass (kg), moment (kg·m², the same about every axis),
 * mu, e, eMin (m/s), roll (rolling-resistance coefficient), spin (1/s, how
 * fast a spin about the contact normal dies), iterations, alpha, beta, gamma,
 * gravity [x, y, z], margin (m), vMax (m/s), deep (m), sleep (s at rest before
 * it sleeps), capK (N/m, the capsules' stiffness — see (h)), air { rho, cd },
 * water { rho, cd, zeta, ang }.
 *
 * The world is `world`, filled by the caller before every step: kinematic
 * capsules at the start and end of the step (`a0 b0 a1 b1`, the radius at
 * each end in `cr`, and their own `ce`, `cmu`), static yawed boxes (`box`,
 * eleven numbers each — see `boxes`), `floor(x, z, y)`, `water(x, z)` (the
 * surface height, or NaN where there is no sea), the water's drift and the
 * wind.
 */
function avbdBall(o) {
  const R = o.r, mass = o.mass, Im = o.moment;
  const gx = o.gravity[0], gy = o.gravity[1], gz = o.gravity[2];
  const P = new Float64Array(3), Q = new Float64Array([0, 0, 0, 1]);
  const V = new Float64Array(3), W = new Float64Array(3), VP = new Float64Array(3);
  const P0 = new Float64Array(3), Q0 = new Float64Array(4);
  const PI = new Float64Array(3), QI = new Float64Array(4);

  // ── contacts: at most MAXC at once, matched step to step by id ────────
  const MAXC = 8;
  let cN = 0, pN = 0;
  const cId = new Int32Array(MAXC), pId = new Int32Array(MAXC);
  const cB = new Float64Array(9 * MAXC);          // n, t1, t2
  const cC0 = new Float64Array(MAXC);             // the gap at x-
  const cDq = new Float64Array(3 * MAXC);         // the shape's move this step
  const cPen = new Float64Array(3 * MAXC), cLam = new Float64Array(3 * MAXC);
  const pPen = new Float64Array(3 * MAXC), pLam = new Float64Array(3 * MAXC);
  const cE = new Float64Array(MAXC), cMu = new Float64Array(MAXC);
  const cVn = new Float64Array(MAXC);             // approach speed at x-, < 0 closing
  const cFn = new Float64Array(MAXC);             // the normal force it ended on, N
  const cArm = new Float64Array(6 * MAXC);        // r × t1, r × t2
  const cK = new Float64Array(MAXC);              // Infinity: hard; else N/m, see (h)

  const CAPS = 64, BOXES = 128;
  const world = {
    capN: 0, a0: new Float64Array(3 * CAPS), b0: new Float64Array(3 * CAPS),
    a1: new Float64Array(3 * CAPS), b1: new Float64Array(3 * CAPS),
    cr: new Float64Array(2 * CAPS), ce: new Float64Array(CAPS), cmu: new Float64Array(CAPS),
    // Each capsule's own id, which is what its contact is warm-started and
    // remembered by: the caller's list is rebuilt every frame and a shape's
    // place in it is not the same from one frame to the next.
    cid: new Int32Array(CAPS),
    capMax: CAPS,
    boxN: 0, box: new Float64Array(11 * BOXES), boxMax: BOXES,
    floor: null, floorE: o.e, floorMu: o.mu,
    water: null, flowX: 0, flowZ: 0,
    windX: 0, windY: 0, windZ: 0,
  };

  const stats = { steps: 0, contacts: 0, bounces: 0, rescues: 0, asleep: false, sub: 0,
    depth: 0, floorPen: 0, lastId: -1, lastV: 0, hits: 0 };
  // Which shapes pushed on it since the caller last cleared this — the dog's
  // snout asks whether it has touched the ball yet.
  const touched = new Set();

  let still = 0, asleep = false, surfWas = NaN;

  const aL = new Float64Array(9), aA = new Float64Array(9), aX = new Float64Array(9);
  const bL = new Float64Array(3), bA = new Float64Array(3);
  const dxL = new Float64Array(3), dxA = new Float64Array(3);
  const dth = new Float64Array(3);
  const cC = new Float64Array(3), cF = new Float64Array(3);
  let cBound = 0, cFric = 0;

  function addContact(id, nx, ny, nz, gap, mx, my, mz, e, mu, h, k = Infinity) {
    let m = cN;
    if (cN === MAXC) {
      let worst = -1, wg = gap;
      for (let j = 0; j < MAXC; j++) if (cC0[j] > wg) { wg = cC0[j]; worst = j; }
      if (worst < 0) return;
      m = worst;
    } else cN++;
    cId[m] = id;
    avbdOrtho(cB, 9 * m, nx, ny, nz);
    cC0[m] = gap;
    cDq[3 * m] = mx; cDq[3 * m + 1] = my; cDq[3 * m + 2] = mz;
    cE[m] = e; cMu[m] = mu; cFn[m] = 0; cK[m] = k;
    // The approach speed, against the shape's own velocity over the step.
    cVn[m] = nx * (V[0] - mx / h) + ny * (V[1] - my / h) + nz * (V[2] - mz / h);
    // The lever arm r = −R·n, and each friction row's angular Jacobian r × t.
    const rx = -nx * R, ry = -ny * R, rz = -nz * R;
    for (let r = 1; r < 3; r++) {
      const b = 9 * m + 3 * r, t0 = cB[b], t1 = cB[b + 1], t2 = cB[b + 2];
      const a = 6 * m + 3 * (r - 1);
      cArm[a] = ry * t2 - rz * t1; cArm[a + 1] = rz * t0 - rx * t2; cArm[a + 2] = rx * t1 - ry * t0;
    }
    // Warm start from the same shape last step (Eq. 19): the normal row's
    // multiplier, and every row's penalty. The friction rows' multipliers
    // were in last step's tangent basis and are not carried — the chain's
    // rule, for the chain's reason.
    let found = -1;
    for (let j = 0; j < pN; j++) if (pId[j] === id) { found = j; break; }
    for (let r = 0; r < 3; r++) {
      cLam[3 * m + r] = found >= 0 && r === 0 && k === Infinity ? pLam[3 * found] * o.alpha * o.gamma : 0;
      cPen[3 * m + r] = found >= 0
        ? Math.min(AVBD.penMax, k, Math.max(AVBD.penMin, pPen[3 * found + r] * o.gamma)) : AVBD.penMin;
    }
  }
  const wasTouching = (id) => { for (let j = 0; j < pN; j++) if (pId[j] === id) return true; return false; };

  /**
   * The boxes. Eleven numbers each: centre (x, y, z), the box's own long axis
   * in the horizontal (ux, uz), half extents along it, up and across, then
   * `e` and `mu`, and one spare.
   */
  function boxes(margin, h) {
    const B = world.box, px = P[0], py = P[1], pz = P[2];
    for (let k = 0; k < world.boxN; k++) {
      const b = 11 * k;
      const dx = px - B[b], dy = py - B[b + 1], dz = pz - B[b + 2];
      const ux = B[b + 3], uz = B[b + 4];
      const ha = B[b + 5], hy = B[b + 6], hc = B[b + 7];
      // Out of reach on the bounding sphere first: most of them are.
      const reach = R + margin + ha + hy + hc;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      const la = dx * ux + dz * uz, lc = -dx * uz + dz * ux;
      const qa = la < -ha ? -ha : la > ha ? ha : la;
      const qy = dy < -hy ? -hy : dy > hy ? hy : dy;
      const qc = lc < -hc ? -hc : lc > hc ? hc : lc;
      let na = la - qa, ny = dy - qy, nc = lc - qc;
      const d = Math.sqrt(na * na + ny * ny + nc * nc);
      let gap;
      if (d > 1e-7) { na /= d; ny /= d; nc /= d; gap = d - R; } else {
        // Centre inside: out through whichever face is nearest.
        const pa = ha - Math.abs(la), py2 = hy - Math.abs(dy), pc = hc - Math.abs(lc);
        na = 0; ny = 0; nc = 0;
        if (pa <= py2 && pa <= pc) { na = la < 0 ? -1 : 1; gap = -pa - R; } else if (py2 <= pc) {
          ny = dy < 0 ? -1 : 1; gap = -py2 - R;
        } else { nc = lc < 0 ? -1 : 1; gap = -pc - R; }
      }
      if (gap > margin) continue;
      addContact(AVBD_BALL_ID.box + k, na * ux - nc * uz, ny, na * uz + nc * ux, gap,
        0, 0, 0, B[b + 8], B[b + 9], h);
    }
  }

  /** The kinematic capsules: people and the dog. See the chain's `collide`. */
  function capsules(margin, h) {
    const w = world, px = P[0], py = P[1], pz = P[2];
    for (let s = 0; s < w.capN; s++) {
      const a = 3 * s;
      const ax = w.a0[a], ay = w.a0[a + 1], az = w.a0[a + 2];
      const ex = w.b0[a] - ax, ey = w.b0[a + 1] - ay, ez = w.b0[a + 2] - az;
      const ee = ex * ex + ey * ey + ez * ez;
      let t = ee > 1e-12 ? ((px - ax) * ex + (py - ay) * ey + (pz - az) * ez) / ee : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + ex * t, qy = ay + ey * t, qz = az + ez * t;
      const rr = w.cr[2 * s] + (w.cr[2 * s + 1] - w.cr[2 * s]) * t;
      // Where that point of it goes by the end of the step — which is also
      // how much further out it can reach the ball from.
      const mx = (w.a1[a] + (w.b1[a] - w.a1[a]) * t) - qx;
      const my = (w.a1[a + 1] + (w.b1[a + 1] - w.a1[a + 1]) * t) - qy;
      const mz = (w.a1[a + 2] + (w.b1[a + 2] - w.a1[a + 2]) * t) - qz;
      const mv = Math.sqrt(mx * mx + my * my + mz * mz);
      let nx = px - qx, ny = py - qy, nz = pz - qz;
      const lim = rr + R + margin + mv, dd = nx * nx + ny * ny + nz * nz;
      if (dd > lim * lim) continue;
      const d = Math.sqrt(dd);
      if (d < 1e-6) continue;
      const gap = d - rr - R;
      // The chain's rule, for the same reason: a ball found deep inside
      // somebody it was not touching did not get there by rolling into them
      // — a limb swept through it faster than a step — and shoving it out
      // along the nearest normal fires it across the promenade.
      if (gap < -o.deep && !wasTouching(w.cid[s])) continue;
      nx /= d; ny /= d; nz /= d;
      addContact(w.cid[s], nx, ny, nz, gap, mx, my, mz, w.ce[s], w.cmu[s], h, o.capK);
    }
  }

  /** The ground: under the centre, and the ring for the steps. See (e). */
  function ground(margin, h) {
    const F = world.floor;
    if (!F) return;
    const x = P[0], y = P[1], z = P[2], yb = y - R;
    const hc = F(x, z, yb);
    const ring = R + Math.min(margin, 0.10);
    stats.floorPen = Math.max(0, hc - yb);
    if (hc - yb > 0.5 * R) {
      // THE CENTRE IS OVER A STEP IT IS NOT ON TOP OF — squeezed into the
      // wall, or at it faster than the ring could see. Out of it is the
      // shortest way sideways to the lower ground, and not up on top: a
      // floor contact 55 cm deep, forgiven at 90 %, still threw the ball off
      // the terrace at 6 m/s. A wall contact from the inside, as far in as
      // the edge is, and eased out like any penetration.
      let best = Infinity, bx = 0, bz = 0;
      for (let k = 0; k < 8; k++) {
        const cx = Math.cos(k * Math.PI * 0.25), cz = Math.sin(k * Math.PI * 0.25);
        let lo = 0, hi = 2 * ring;
        if (F(x + cx * hi, z + cz * hi, yb) > yb + 0.02) continue;
        for (let it = 0; it < 5; it++) {
          const mid = (lo + hi) * 0.5;
          if (F(x + cx * mid, z + cz * mid, yb) > yb + 0.02) lo = mid; else hi = mid;
        }
        const re = (lo + hi) * 0.5;
        if (re < best) { best = re; bx = cx; bz = cz; }
      }
      if (best < Infinity) addContact(AVBD_BALL_ID.step, bx, 0, bz, -(best + R), 0, 0, 0, world.floorE, world.floorMu, h);
      return;
    }
    // The slope, off both sides where both are the same surface and off the
    // one that is where the other is a step: 3 cm over 7 is a 23-degree ramp,
    // and nothing out here is steeper than that without being a step.
    const e = 0.07, st = 0.03;
    const dxp = F(x + e, z, yb) - hc, dxm = hc - F(x - e, z, yb);
    const dzp = F(x, z + e, yb) - hc, dzm = hc - F(x, z - e, yb);
    const okxp = Math.abs(dxp) < st, okxm = Math.abs(dxm) < st;
    const okzp = Math.abs(dzp) < st, okzm = Math.abs(dzm) < st;
    const sx = okxp && okxm ? (dxp + dxm) / (2 * e) : okxp ? dxp / e : okxm ? dxm / e : 0;
    const sz = okzp && okzm ? (dzp + dzm) / (2 * e) : okzp ? dzp / e : okzm ? dzm / e : 0;
    const nl = 1 / Math.sqrt(sx * sx + 1 + sz * sz);
    const gap = (y - hc) * nl - R;
    if (gap < margin) {
      addContact(AVBD_BALL_ID.floor, -sx * nl, nl, -sz * nl, gap, 0, 0, 0, world.floorE, world.floorMu, h);
    }
    // The ring: the nearest step up within a radius and the margin.
    let bg = Infinity, bx = 0, by = 0, bz = 0;
    for (let k = 0; k < 8; k++) {
      const cx = Math.cos(k * Math.PI * 0.25), cz = Math.sin(k * Math.PI * 0.25);
      const hk = F(x + cx * ring, z + cz * ring, yb);
      if (hk - hc < 0.04) continue;
      let lo = 0, hi = ring;
      for (let it = 0; it < 5; it++) {
        const mid = (lo + hi) * 0.5;
        if (F(x + cx * mid, z + cz * mid, yb) - hc > 0.02) hi = mid; else lo = mid;
      }
      const re = (lo + hi) * 0.5;
      let g, nx2, ny2, nz2;
      if (y <= hk) { g = re - R; nx2 = -cx; ny2 = 0; nz2 = -cz; } else {
        const vy = y - hk, dl = Math.sqrt(re * re + vy * vy);
        g = dl - R; nx2 = -cx * re / dl; ny2 = vy / dl; nz2 = -cz * re / dl;
      }
      if (g < bg) { bg = g; bx = nx2; by = ny2; bz = nz2; }
    }
    if (bg < margin) addContact(AVBD_BALL_ID.step, bx, by, bz, bg, 0, 0, 0, world.floorE, world.floorMu, h);
  }

  /** Contact m: its three rows' C and the cone-clamped force, into cC, cF. */
  function contactEval(m, alpha) {
    const b = 9 * m;
    const dx = P[0] - P0[0] - cDq[3 * m], dy = P[1] - P0[1] - cDq[3 * m + 1], dz = P[2] - P0[2] - cDq[3 * m + 2];
    cC[0] = cB[b] * dx + cB[b + 1] * dy + cB[b + 2] * dz;
    // (b): a gap in full, a penetration forgiven — unless the contact is a
    // spring (h), which has nothing to forgive.
    const c0 = cC0[m], soft = cK[m] !== Infinity;
    cC[0] += c0 > 0 || soft ? c0 : c0 * (1 - alpha);
    for (let r = 1; r < 3; r++) {
      const a = 6 * m + 3 * (r - 1);
      cC[r] = cB[b + 3 * r] * dx + cB[b + 3 * r + 1] * dy + cB[b + 3 * r + 2] * dz
        + cArm[a] * dth[0] + cArm[a + 1] * dth[1] + cArm[a + 2] * dth[2];
    }
    for (let r = 0; r < 3; r++) cF[r] = cPen[3 * m + r] * cC[r] + (soft ? 0 : cLam[3 * m + r]);
    if (cF[0] > 0) cF[0] = 0;
    cBound = -cF[0] * cMu[m];
    cFric = Math.sqrt(cF[1] * cF[1] + cF[2] * cF[2]);
    if (cFric > cBound && cFric > 0) { const s = cBound / cFric; cF[1] *= s; cF[2] *= s; }
  }

  /** The circular segment of the ball's silhouette under a waterline d up it. */
  function segA(d) {
    if (d <= 0) return 0;
    if (d >= 2 * R) return Math.PI * R * R;
    const c = R - d;
    return R * R * Math.acos(c / R) - c * Math.sqrt(Math.max(0, R * R - c * c));
  }

  /** The water and the air: forces into `acc`, drag into V and W. See (g). */
  const acc = new Float64Array(3);
  function fluids(h) {
    const x = P[0], y = P[1], z = P[2];
    acc[0] = gx; acc[1] = gy; acc[2] = gz;
    const surf = world.water ? world.water(x, z) : NaN;
    let d = 0;
    if (surf === surf) d = Math.min(2 * R, Math.max(0, surf - (y - R)));
    stats.depth = d;
    const Wt = o.water, Ai = o.air;
    const Aw = segA(d), Aa = Math.PI * R * R - Aw;
    let kw = 0, kz = 0, wvy = 0;
    if (d > 0) {
      const Vs = Math.PI * d * d * (3 * R - d) / 3;
      acc[1] += Wt.rho * -gy * Vs / mass;
      const rx = V[0] - world.flowX, ry = V[1], rz = V[2] - world.flowZ;
      kw = 0.5 * Wt.rho * Wt.cd * Aw * Math.sqrt(rx * rx + ry * ry + rz * rz) / mass;
      // Bobbing is damped by the waves it makes, which no drag law has in
      // it: a fraction `zeta` of critical on the waterplane's stiffness.
      const dm = Math.min(d, R);
      const kb = Wt.rho * -gy * Math.PI * Math.max(0, 2 * R * dm - dm * dm) / mass;
      kz = 2 * Wt.zeta * Math.sqrt(kb);
      // And against the surface's own rise and fall, not against still water.
      wvy = surfWas === surfWas ? (surf - surfWas) / h : 0;
    }
    surfWas = surf;
    const ax = V[0] - world.windX, ay = V[1] - world.windY, az = V[2] - world.windZ;
    const ka = 0.5 * Ai.rho * Ai.cd * Aa * Math.sqrt(ax * ax + ay * ay + az * az) / mass;
    const den = 1 + h * (kw + ka);
    V[0] = (V[0] + h * (kw * world.flowX + ka * world.windX)) / den;
    V[2] = (V[2] + h * (kw * world.flowZ + ka * world.windZ)) / den;
    V[1] = (V[1] + h * (ka * world.windY + kz * wvy)) / (den + h * kz);
    const kAng = (d > 0 ? Wt.ang * d / (2 * R) : 0) + 0.05;
    const keep = 1 / (1 + h * kAng);
    W[0] *= keep; W[1] *= keep; W[2] *= keep;
  }

  /** One step of h seconds. */
  function step(h) {
    stats.sub = h;
    const speed = Math.sqrt(V[0] * V[0] + V[1] * V[1] + V[2] * V[2]);
    const margin = o.margin + speed * h * 1.5;
    if (asleep) {
      // Asleep: nothing is integrated until something comes at it. A shape
      // within reach, the floor gone from under it, or the sea come up.
      pN = cN; pId.set(cId); pPen.set(cPen); pLam.set(cLam);
      cN = 0;
      capsules(o.margin, h);
      let wake = cN > 0;
      cN = pN; cId.set(pId); cPen.set(pPen); cLam.set(pLam);
      if (!wake && world.floor && P[1] - R - world.floor(P[0], P[2], P[1] - R) > 0.02) wake = true;
      if (!wake && world.water && world.water(P[0], P[2]) > P[1] - R) wake = true;
      if (!wake) return;
      asleep = false; still = 0; stats.asleep = false;
    }
    fluids(h);
    // Contacts at x-, with every shape where it was at the start of the step.
    pN = cN; pId.set(cId); pPen.set(cPen); pLam.set(cLam);
    cN = 0;
    capsules(margin, h);
    boxes(margin, h);
    ground(margin, h);
    stats.contacts = cN;
    // The inertial target and the adaptive warm start, as the chain's.
    const h2 = h * h;
    const aa = Math.sqrt(acc[0] * acc[0] + acc[1] * acc[1] + acc[2] * acc[2]) || 1;
    PI[0] = P[0] + V[0] * h + acc[0] * h2;
    PI[1] = P[1] + V[1] * h + acc[1] * h2;
    PI[2] = P[2] + V[2] * h + acc[2] * h2;
    avbdQAddV(Q, 0, W[0] * h, W[1] * h, W[2] * h, QI, 0);
    let wgt = ((V[0] - VP[0]) * acc[0] + (V[1] - VP[1]) * acc[1] + (V[2] - VP[2]) * acc[2]) / h / (aa * aa);
    wgt = wgt > 1 ? 1 : wgt > 0 ? wgt : 0;
    P0.set(P); Q0.set(Q);
    P[0] += V[0] * h + acc[0] * wgt * h2;
    P[1] += V[1] * h + acc[1] * wgt * h2;
    P[2] += V[2] * h + acc[2] * wgt * h2;
    Q.set(QI);
    const mh = mass / h2, ih = Im / h2, alpha = o.alpha;
    for (let it = 0; it < o.iterations; it++) {
      // Primal: the one body's 6x6. A sphere's inertia is the same in every
      // frame, so the angular block starts as a diagonal.
      aL.fill(0); aA.fill(0); aX.fill(0);
      aL[0] = mh; aL[4] = mh; aL[8] = mh;
      aA[0] = ih; aA[4] = ih; aA[8] = ih;
      bL[0] = mh * (P[0] - PI[0]); bL[1] = mh * (P[1] - PI[1]); bL[2] = mh * (P[2] - PI[2]);
      avbdQSub(Q, 0, QI, 0, dth);
      bA[0] = ih * dth[0]; bA[1] = ih * dth[1]; bA[2] = ih * dth[2];
      avbdQSub(Q, 0, Q0, 0, dth);
      for (let m = 0; m < cN; m++) {
        contactEval(m, alpha);
        if (cF[0] >= 0) continue;           // not pushing: not there
        const b = 9 * m;
        for (let r = 0; r < 3; r++) {
          const k = cPen[3 * m + r], f = cF[r];
          const jx = cB[b + 3 * r], jy = cB[b + 3 * r + 1], jz = cB[b + 3 * r + 2];
          aL[0] += k * jx * jx; aL[1] += k * jx * jy; aL[2] += k * jx * jz;
          aL[3] += k * jy * jx; aL[4] += k * jy * jy; aL[5] += k * jy * jz;
          aL[6] += k * jz * jx; aL[7] += k * jz * jy; aL[8] += k * jz * jz;
          bL[0] += f * jx; bL[1] += f * jy; bL[2] += f * jz;
          if (r === 0) continue;
          // (a) The friction rows' lever arm: angular block, cross block and
          // the angular half of the right-hand side.
          const a = 6 * m + 3 * (r - 1);
          const qx = cArm[a], qy = cArm[a + 1], qz = cArm[a + 2];
          aA[0] += k * qx * qx; aA[1] += k * qx * qy; aA[2] += k * qx * qz;
          aA[3] += k * qy * qx; aA[4] += k * qy * qy; aA[5] += k * qy * qz;
          aA[6] += k * qz * qx; aA[7] += k * qz * qy; aA[8] += k * qz * qz;
          aX[0] += k * qx * jx; aX[1] += k * qx * jy; aX[2] += k * qx * jz;
          aX[3] += k * qy * jx; aX[4] += k * qy * jy; aX[5] += k * qy * jz;
          aX[6] += k * qz * jx; aX[7] += k * qz * jy; aX[8] += k * qz * jz;
          bA[0] += f * qx; bA[1] += f * qy; bA[2] += f * qz;
        }
      }
      bL[0] = -bL[0]; bL[1] = -bL[1]; bL[2] = -bL[2];
      bA[0] = -bA[0]; bA[1] = -bA[1]; bA[2] = -bA[2];
      avbdSolve6(aL, aA, aX, bL, bA, dxL, dxA);
      P[0] += dxL[0]; P[1] += dxL[1]; P[2] += dxL[2];
      avbdQAddV(Q, 0, dxA[0], dxA[1], dxA[2], Q, 0);
      // Dual (manifold.ts updateDual): the multiplier is the force, and the
      // penalty ramps on the rows still in error.
      avbdQSub(Q, 0, Q0, 0, dth);
      for (let m = 0; m < cN; m++) {
        contactEval(m, alpha);
        const cap = Math.min(AVBD.penMax, cK[m]);
        if (cK[m] === Infinity) { cLam[3 * m] = cF[0]; cLam[3 * m + 1] = cF[1]; cLam[3 * m + 2] = cF[2]; }
        cFn[m] = -cF[0];
        if (cF[0] < 0) cPen[3 * m] = Math.min(cap, cPen[3 * m] + o.beta * Math.abs(cC[0]));
        if (cFric <= cBound) {
          cPen[3 * m + 1] = Math.min(cap, cPen[3 * m + 1] + o.beta * Math.abs(cC[1]));
          cPen[3 * m + 2] = Math.min(cap, cPen[3 * m + 2] + o.beta * Math.abs(cC[2]));
        }
      }
    }
    // BDF1.
    VP.set(V);
    V[0] = (P[0] - P0[0]) / h; V[1] = (P[1] - P0[1]) / h; V[2] = (P[2] - P0[2]) / h;
    avbdQSub(Q, 0, Q0, 0, dth);
    W[0] = dth[0] / h; W[1] = dth[1] / h; W[2] = dth[2] / h;
    // (c) The bounce, and (d) the roll, at the velocity level.
    let onFloor = false;
    for (let m = 0; m < cN; m++) {
      if (cFn[m] <= 0) continue;
      touched.add(cId[m]);
      stats.hits++;
      const b = 9 * m, nx = cB[b], ny = cB[b + 1], nz = cB[b + 2];
      const svx = cDq[3 * m] / h, svy = cDq[3 * m + 1] / h, svz = cDq[3 * m + 2] / h;
      if (cVn[m] < -o.eMin) {
        const vn = nx * (V[0] - svx) + ny * (V[1] - svy) + nz * (V[2] - svz);
        const want = -cE[m] * cVn[m];
        if (want > vn) {
          V[0] += nx * (want - vn); V[1] += ny * (want - vn); V[2] += nz * (want - vn);
          stats.bounces++;
          stats.lastId = cId[m]; stats.lastV = -cVn[m];
        }
      }
      if (ny > 0.5) {
        onFloor = true;
        // The rolling part of the velocity, and the decel on it.
        const vn = nx * V[0] + ny * V[1] + nz * V[2];
        const tx = V[0] - nx * vn, ty = V[1] - ny * vn, tz = V[2] - nz * vn;
        const s = Math.sqrt(tx * tx + ty * ty + tz * tz);
        const dec = o.roll * cFn[m] / mass / (1 + Im / (mass * R * R)) * h;
        const cut = s > 1e-9 ? Math.min(1, dec / s) : 1;
        const cx = tx * cut, cy = ty * cut, cz = tz * cut;
        V[0] -= cx; V[1] -= cy; V[2] -= cz;
        // ω −= n × Δv / R: the roll that went with the speed that went.
        W[0] -= (ny * cz - nz * cy) / R; W[1] -= (nz * cx - nx * cz) / R; W[2] -= (nx * cy - ny * cx) / R;
        // And the spin about the normal, which nothing else would ever stop.
        const wn = nx * W[0] + ny * W[1] + nz * W[2];
        const kn = wn * Math.min(1, o.spin * h);
        W[0] -= nx * kn; W[1] -= ny * kn; W[2] -= nz * kn;
      }
    }
    const v = Math.sqrt(V[0] * V[0] + V[1] * V[1] + V[2] * V[2]);
    if (v > o.vMax) { V[0] *= o.vMax / v; V[1] *= o.vMax / v; V[2] *= o.vMax / v; }
    // Under the floor after all that, which is one bad step: put it back on
    // top, take the downward speed off, and count it. Only a little under —
    // a centre gone in under a step's top is the wall's to push out, above.
    if (world.floor) {
      const hc = world.floor(P[0], P[2], P[1] - R);
      const under = hc - (P[1] - R);
      if (under > 0.03 && under < 0.5 * R && stats.depth <= 0) {
        P[1] = hc + R;
        if (V[1] < 0) V[1] = 0;
        stats.rescues++;
      }
    }
    // Asleep once it has been still on the floor for `sleep` seconds.
    const wl = Math.sqrt(W[0] * W[0] + W[1] * W[1] + W[2] * W[2]);
    if (onFloor && stats.depth <= 0 && v < 0.03 && wl * R < 0.03) still += h; else still = 0;
    if (still > o.sleep) {
      asleep = true; stats.asleep = true;
      V.fill(0); W.fill(0); VP.fill(0);
    }
    stats.steps++;
  }

  /** Put it somewhere, at rest and awake. */
  function place(x, y, z) {
    P[0] = x; P[1] = y; P[2] = z;
    V.fill(0); W.fill(0); VP.fill(0);
    cN = 0; pN = 0; asleep = false; still = 0; stats.asleep = false; surfWas = NaN;
  }
  /** Send it off at (vx, vy, vz), spinning at (wx, wy, wz). */
  function launch(vx, vy, vz, wx = 0, wy = 0, wz = 0) {
    V[0] = vx; V[1] = vy; V[2] = vz; VP.set(V);
    W[0] = wx; W[1] = wy; W[2] = wz;
    asleep = false; still = 0; stats.asleep = false;
  }
  function wake() { asleep = false; still = 0; stats.asleep = false; }

  return { P, Q, V, W, world, stats, touched, step, place, launch, wake, MAXC, cId, cFn, cB,
    get asleep() { return asleep; }, get cN() { return cN; } };
}
