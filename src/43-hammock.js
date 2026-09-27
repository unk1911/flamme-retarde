// -----------------------------------------------------------------------------
// A hammock, in the pines behind the kabine — simulated, and big enough for her.
//
// Misha, 27 Sep 2026: *"I want to add some more AVBD stuff to the game. I was
// thinking in the magical forest area ... some people put up hammocks there. so
// maybe we can setup a hammock there and I can sorta swing baye on it"* — and,
// offered the plan below, *"yes go ahead and when done just send me the gps
// coordinates of it"*.
//
// There was a hammock already: a catenary of quads drawn into the static
// buffer in 1.276.0 off survey frame 1000150346, blue-and-teal with a red
// selvedge. It was a picture of a hammock. This one is a thing:
//
//   THE CLOTH is a grid of thin rigid plates, `nu` along by `nv` across,
//   jointed to their neighbours by a ball socket at the middle of each shared
//   edge — three-avbd's flag (bench-scenes.ts, `flag`) laid horizontal and
//   hung by its ends. A ball socket at an edge's middle lets two plates fold
//   against each other about any line through it, which is all a cloth is;
//   the plates themselves do not stretch, which is all canvas is.
//
//   THE GATHERED ENDS are strings — `avbdNet`'s one-row, pull-only rope — from
//   each row's last plate to a gather, one a side: the cloth running down to
//   the whipping in a fan, which is exactly how a gathered-end hammock is made
//   (and on a Mayan one, literally strings). Then one rope each from the
//   gather to a strap round a trunk, 1.45 m up, where 1.276.0 tied it.
//
//   SHE is one more body — fifty-five kilograms against plates of forty-five
//   grams — carrying the nineteen capsules measured off v2.0 for the cuff
//   chains and four more down her arms, in her own frame, rewritten every
//   frame from the pose she is in. The cloth is pushed by her capsules and
//   pushes back; she is held up by nothing else. So the cloth wraps her hips
//   and shoulders and runs deepest under her seat, and when the hammock
//   swings it carries her, because the only thing holding her is the cloth.
//
// That mass ratio, twelve hundred to one, is the case AVBD was written for and
// the reason this is AVBD and not a mass-spring cloth with a figure pinned in
// it: a penalty cloth stiff enough not to stretch under a person is too stiff
// to integrate, and one soft enough to integrate is a trampoline. Here every
// joint and every contact carries its force in a multiplier from iteration to
// iteration and step to step, and ten iterations hold the cloth to a fraction
// of a millimetre with her in it. See `avbdNet` in 43-avbd.js.
//
// Getting in and out is her own — sat on the edge, legs swung in, lain back —
// and while she does it her body is pulled along the animation by a finite
// joint from the world (the reference's Joint with `stiffnessAng`), stiff at
// the start and let go as she lies back, so the cloth takes her weight
// progressively and there is never a frame where she is put somewhere. The
// phases are `ham*` in 43-jadrija.js; this file is the hammock and nothing
// that decides anything.
//
// NO BACKTICKS IN THE GLSL BELOW.
// -----------------------------------------------------------------------------

const HAMMOCK = {
  // ── where it hangs ──────────────────────────────────────────────────────
  // Up each trunk, which is where 1.276.0 tied it: high enough that the sag
  // clears the ground with somebody in it, low enough to sit into.
  tie: 1.45,
  // ── the cloth ───────────────────────────────────────────────────────────
  // A double hammock's bed, flat: 2.3 m of cloth between the gathered ends
  // and 1.3 m across. `nu` by `nv` plates.
  bed: 2.30, width: 1.30, nu: 9, nv: 5,
  // The fan, gather to the end of the cloth down its middle — the whipping
  // and the gathered cloth together, which in the photograph is a hand and a
  // half of rope and then the fabric opening out.
  fan: 0.45,
  // How much shorter the selvedge rows are strung than the middle one, as a
  // fraction of the fan — see the note over the strings in `hammockSim`.
  lip: 0.12,
  // Heavy canvas is 0.35-0.45 kg a square metre, so a plate of 0.26 by 0.26
  // is 25-30 g; 45 g is the ropes' and the selvedge's share spread over them,
  // and it makes the ratio to her twelve hundred rather than two thousand,
  // which the solve is happier with and nobody could see.
  plateMass: 0.045, thick: 0.012,
  // The edges: a hard ball socket at each shared edge's middle (the flag's),
  // and two soft ones `hinge` of the way out toward its ends, N/m, which
  // keep the edge closed without making it a hinge; and a soft bend, N·m/rad.
  hinge: 0.40, edgeK: 3000, bendK: 0,
  // THE BEND, N/m, across and along: a spring from each plate's middle to
  // the middle of the plate two away, at the flat distance — the skip-one
  // spring every cloth solver has, as the reference's Spring. Without it the
  // empty cloth, whose ends the gather draws in, folded shut like a closed
  // concertina along its whole length, its plates stacked on each other; the
  // angle lock (`bendK`) was tried first as the bend and it spun plates up
  // past a half turn, where the demo's quaternion difference takes the long
  // way round. Four newtons a metre folds under her like cloth and holds the
  // empty bed open like cloth.
  bendAcross: 4, bendAlong: 2,
  gatherMass: 0.20,
  // ── the ropes ───────────────────────────────────────────────────────────
  // Sized to the span, and not typed: the ropes are whatever takes the cloth
  // from the tie to a seat `seat` above the ground with her in it. A V from
  // each tie to the bottom, times `curl`, less the cloth's own half. `curl`
  // is MEASURED and it is under one: a body 1.6 m long spreads the bottom of
  // the sling where a V has a point, so at 1.044 (the first guess, "a bit
  // longer for the curve") the cloth under her came down to 0.22 m over the
  // ground on a 2.95 m span and 0.12 on a 4.21 m one, and both want the same
  // 0.15 off the half-length. And the reason it is the loaded seat and not
  // the empty sag that is set: the cloth and the ropes do not stretch, so
  // the empty hammock and the full one differ only in shape, and a hammock
  // sized to hang a twelfth of its span empty puts whoever gets in it at the
  // height of a bar stool.
  seat: 0.40,
  curl: 1.06,
  ropeMin: 0.22,
  // ── her ─────────────────────────────────────────────────────────────────
  herMass: 55,
  // The hand that guides her in and out: a finite joint from the world to
  // her body, N/m and N·m/rad, eased off over `release` s as she lies back.
  // SOFT, AND THAT IS MEASURED. At 60 000 N/m the guide and the cloth fought:
  // the clip asks for her seat a few centimetres below where the loaded edge
  // can go, the guide pushed with thousands of newtons to get it there, the
  // contacts under her ramped to meet it, and on the second second of
  // getting in the solve blew up. 12 000 on 55 kg rings at 2.4 Hz — a person
  // lowering themselves, not a crane — and where the clip and the cloth
  // disagree by 5 cm it is 600 N, about her weight, and the cloth wins.
  guideLin: 12000, guideAng: 2200, release: 1.1,
  // And while she is being guided her contacts are springs of this — see
  // (b) over `avbdNet` — for the ball's reason: a body an animation is
  // moving about is not a body that can be told no by a hard contact. Hard
  // again the moment the guide lets go.
  guidedK: 30000,
  // THE SLING'S HOLD ON HER, N/m: a spring from her centre to where she lay
  // down relative to the middle of the bed, on from the moment the guide
  // lets go. HONESTLY, this is the one thing here that is not the cloth. A
  // real sling holds its occupant by wrapping them — friction over a whole
  // side of a body — and a grid of forty-five rigid plates wraps a body in
  // a handful of contacts; MEASURED over four gets-in and five pushes each,
  // she rolled out over the rim twice, once a second after lying down. This
  // is what the missing wrap would have done: 3000 N/m is 300 N at 10 cm,
  // half her weight, where rolling out takes 40 cm — and it is nothing at
  // all while she swings, because she and the bed swing together.
  keep: 3000,
  // ── the solve ───────────────────────────────────────────────────────────
  // The chain's constants (CHAIN in 43-jadrija.js), and ten iterations at
  // 120 Hz, which is two steps a frame at 60.
  iterations: 10, sub: 1 / 120, alpha: 0.9, alphaContact: 0.9, beta: 1e5, betaAng: 100, gamma: 0.999,
  margin: 0.012, deep: 0.05, mu: 0.9, floorMu: 0.6, vMax: 12, wMax: 60,
  // Air on the cloth, 1/s. The swing's own decay is mostly BDF1's — implicit
  // Euler at 120 Hz takes about 4 % of a 2 s pendulum's amplitude a second —
  // and this is the rest of what a real one loses to the air and the bark.
  drag: 0.015, herDrag: 0.01,
  // ── the push ────────────────────────────────────────────────────────────
  // N·s, into her if she is in it and into the cloth by you if not. 38 on
  // 55 kg is 0.7 m/s at the hips: a shove with one hand from standing, which
  // on a 1 m pendulum is a swing of about 13 degrees. MEASURED: 14.6 off the
  // first push, 19.5 off the second in phase, 23.0 off the third, 29.5 off
  // the sixth — and from there 11 degrees again after twenty-five seconds.
  push: 38, pushEmpty: 1.4,
  // How near you have to be, measured to the cloth: an arm and a lean.
  reach: 1.35,
  // ── when it is simulated ────────────────────────────────────────────────
  // Past this from the camera it is not stepped at all; nearer, it sleeps
  // once it has been still for `sleepAfter` seconds with nobody in it.
  far: 60, sleepAfter: 2.0, still: 0.015,
  // AND THE LAST DEGREE IS HUSHED. Misha, 27 Sep 2026, offered "fix the
  // hammock's slow sleep properly, without changing how it hangs": *"both"*.
  // MEASURED, the empty hammock is a pendulum 3.58 s long (the ropes and the
  // bed swing about the line between the ties like a bob on 3.2 m) and it
  // loses 1.9 % of its swing a second — 6.8 % a swing, a time constant of
  // 53 s, which is `drag` and BDF1 and right for a swing anybody can see.
  // But `still` is a swing of 0.3 degrees (the fastest thing in it, the
  // gathers bobbing, at 0.045 m/s per degree), and at 1.9 % a second a
  // swing takes two minutes to get from a degree to that: the 11.7-degree
  // hammock that was 31 % of the page at Jadrija was hanging at rest to a
  // centimetre and awake for the last few millimetres. It is not solver
  // noise — at true rest the fastest thing in it is 0.0003 m/s. So: once
  // the fastest thing in the empty cloth has stayed under `hushV` (about a
  // degree of swing, 16 mm at the bed) for a whole window of `hushWin`,
  // longer than a swing, the cloth and the gathers take `hush` more air,
  // which lands them on the rest in two or three seconds instead of two
  // minutes, and it sleeps. Never with her in it; never before the swing
  // is down to a degree, so a push looks exactly as it did for as long as
  // anybody could tell; and off again the moment anything wakes it. 2.5/s
  // is MEASURED as the most that lands on the true rest: at 6 the swing is
  // overdamped and creeps, and stopped where the velocity ran out 3.6 mm
  // short of the rest; at 20, 14 mm short, and it swung again when let go.
  hush: 2.5, hushV: 0.045, hushWin: 4.0,
  // What counts as the net going wrong — see `wrong`. Measured when it is
  // right: the hard joints open 0.1-0.5 mm lying, 2.4 mm at worst getting in;
  // the fastest thing in it is a pushed swing at about 2 m/s.
  snapStretch: 0.015, snapV: 12,
  // How long the empty cloth is settled for at build, s — so the first time
  // anybody walks up to it, it is hanging and not falling.
  settle: 3.0,
  // AND THEN HUSHED TO ITS REST, at build, until the fastest thing in it
  // has been under `restV` for `restHold` s (at most `restMax` s). MEASURED:
  // the settle draws the gathered ends in, which sets the whole hammock
  // swinging 2.5 degrees either side of where it hangs, and left to itself
  // it swung like that for 75 s before it slept — which is what you walked
  // up to, every time, from anywhere past `far`. Hushed after the settle it
  // is at rest 3.5 s of steps later — 416 steps, about 0.22 s of build
  // beside the settle's 0.28 — within half a millimetre of where it hangs
  // after four minutes of swinging free, and it is built asleep.
  //
  // AFTER the settle, and not in it, and that is measured too. The empty
  // cloth has more than one way to hang — its gathered ends buckle one way
  // or another as they are drawn in, and which way decides everything
  // else: the way it has always hung is low 3.213, sag 0.925, the bed 11.5
  // degrees round from under the ties. Air in the second half of the settle
  // (a velocity bled 10 % a step, the first try) chose another, 5.2
  // degrees and 19 cm less sag; hushed from 2.0 s it chose a third, 0.6
  // degrees; hushed from 1.5 s it happened to choose the right one. From
  // 3.0 s every strength tried, 1.5 to 20, lands on the right one.
  restV: 0.005, restHold: 0.2, restMax: 5.0,
  // AND ITS PENALTIES AGED, once it is at rest. AVBD's penalty on a joint
  // ramps up with the joint's error and sheds a tenth of a percent a step
  // (`gamma`), and at ten iterations a joint is as stiff as its penalty —
  // so the solve remembers. Drawing the ends in leaves them high (joints
  // median 7100, ropes 8400), and a hammock that has hung free for a minute
  // has shed that (4400, 6000). Nothing about how it hangs changes, but how
  // it swings does: MEASURED, pushed straight from the hush its third swing
  // came 0.3 s late and the trace was 4.8 degrees rms off the old hammock's
  // over the first 8 s — which is the hammock you would have met pushing it
  // in the first few seconds after the page loaded, not the one you met
  // after it had slept. Forty more seconds of steps sheds it (0.23 rms),
  // at 4800 steps of build; scaling the hard joints' and the ropes'
  // penalties by this does it for nothing, the multipliers untouched so
  // not a thing moves: 0.2 to 0.7 degrees rms, three places pushed. 0.6
  // and 0.8 are 1.8 to 2.6 and 0.8 to 1.9.
  relax: 0.7,
  // Creak: at each end of a swing this big (rad), louder with more.
  creakAt: 0.12,
};

/**
 * Where she stands to get in: this far in front of the middle, across the
 * span, with her back to it — HAM_MARK in tools/blender/human_mh.py, which the
 * clips are authored against, and the two have to be one number.
 *
 * MEASURED, twice, because it depends on how the empty cloth hangs. It was
 * 0.62 first, when the cloth hung folded shut with its selvedges hanging
 * lowest (see the note over the strings in `hammockSim`): standing there her
 * calves were 74 mm into it on the first frame of `hamIn`. It went to 0.85,
 * and once the strings were fixed the empty cloth hung as what it is — a
 * narrow trough, its rims 0.21 to 0.29 m either side of the line between the
 * ties — and from 0.85 she sat down in the air 0.3 m short of it. At 0.60
 * her calves are 0.2 clear of the rim standing, her seat goes back 0.40 on
 * to it and opens it, and lying back takes her hips over the line.
 */
const HAM_MARK_M = 0.60;

/** Its colours, in the game's colour space. 1.276.0's, off the frame. */
const HAMMOCK_CLOTH = [0.118, 0.318, 0.372];      // teal
const HAMMOCK_EDGE = [0.545, 0.180, 0.118];       // the red-orange selvedge
const HAMMOCK_ROPE = [0.404, 0.372, 0.300];
const HAMMOCK_STRAP = [0.180, 0.170, 0.160];      // the webbing round the bark

/**
 * The simulation alone — no THREE in it, so a probe can build one in Node.
 *
 * `o.A`, `o.B`: the two tie points in the world, [x, y, z], on the bark
 * facing each other. `o.floor(x, z)`: the ground. Returns the net and where
 * everything is in it.
 */
function hammockSim(o) {
  const H = HAMMOCK;
  const NU = H.nu, NV = H.nv;
  const len = H.bed / NU, wid = H.width / NV;
  // The frame: ex along the span (level), ey up, ez across.
  const Ax = o.A[0], Ay = o.A[1], Az = o.A[2], Bx = o.B[0], By = o.B[1], Bz = o.B[2];
  let ex = [Bx - Ax, 0, Bz - Az];
  const D = Math.hypot(ex[0], ex[2]);
  ex = [ex[0] / D, 0, ex[2] / D];
  const ey = [0, 1, 0];
  const ez = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
  const Mx = (Ax + Bx) / 2, My = (Ay + By) / 2, Mz = (Az + Bz) / 2;
  const floorM = o.floor(Mx, Mz);
  // The ropes — see HAMMOCK.seat. `drop` is from the ties to the seat.
  const drop = My - (floorM + H.seat);
  const half = Math.hypot(D / 2, drop) * H.curl;
  const rope = Math.max(H.ropeMin, half - H.bed / 2 - H.fan);

  const net = avbdNet({
    maxBodies: NU * NV + 3, maxJoints: 3 * ((NU - 1) * NV + NU * (NV - 1)) + 3,
    maxStrings: 2 * NV + 2 + NU * (NV - 2) + (NU - 2) * NV, maxPoints: NU * NV * 4, maxBoxes: NU * NV, maxCaps: 32, maxContacts: 900,
    pointsHitCaps: false,
    iterations: H.iterations, alpha: H.alpha, alphaContact: H.alphaContact, beta: H.beta,
    betaAng: H.betaAng, gamma: H.gamma, gravity: [0, -9.81, 0], drag: H.drag,
    vMax: H.vMax, wMax: H.wMax, margin: H.margin, deep: H.deep, mu: H.mu, floorMu: H.floorMu,
    capK: H.guidedK,
  });
  net.setFloor(o.floor);

  // ── laid out: the gathers on the V from the ties, the cloth a parabola ──
  // between them with the right length. Near enough to hang, and the settle
  // at the end does the rest.
  const bot = [Mx, My - drop, Mz];
  const gath = (T) => {
    const dx = bot[0] - T[0], dy = bot[1] - T[1], dz = bot[2] - T[2];
    const l = Math.hypot(dx, dy, dz);
    return [T[0] + dx / l * rope, T[1] + dy / l * rope, T[2] + dz / l * rope];
  };
  const GA = gath(o.A), GB = gath(o.B);
  // The centre line: a parabola from GA to GB, sag found so its length is
  // the cloth's plus both fans, then sampled by arc length.
  const chord = Math.hypot(GB[0] - GA[0], GB[2] - GA[2]);
  const Lc = H.bed + 2 * H.fan;
  const curve = (sag, u) => [u * chord, (GB[1] - GA[1]) * u - 4 * sag * u * (1 - u)];
  const arc = (sag) => {
    let L = 0, p = curve(sag, 0);
    for (let k = 1; k <= 64; k++) { const q = curve(sag, k / 64); L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
    return L;
  };
  let lo = 0, hi = 3;
  for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (arc(m) < Lc) lo = m; else hi = m; }
  const sag = Math.max(0, lo);
  const table = [];
  {
    let L = 0, p = curve(sag, 0);
    table.push([0, 0]);
    for (let k = 1; k <= 256; k++) {
      const q = curve(sag, k / 256);
      L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q;
      table.push([L, k / 256]);
    }
  }
  const atLen = (s) => {
    let k = 1;
    while (k < table.length - 1 && table[k][0] < s) k++;
    const [l0, u0] = table[k - 1], [l1, u1] = table[k];
    const u = u0 + (u1 - u0) * (l1 > l0 ? (s - l0) / (l1 - l0) : 0);
    const c = curve(sag, u), c2 = curve(sag, Math.min(1, u + 1e-3)), c1 = curve(sag, Math.max(0, u - 1e-3));
    const tx = c2[0] - c1[0], ty = c2[1] - c1[1], tl = Math.hypot(tx, ty);
    return [GA[0] + ex[0] * c[0], GA[1] + c[1], GA[2] + ex[2] * c[0], tx / tl, ty / tl];
  };

  // ── bodies ────────────────────────────────────────────────────────────
  const Ip = [
    H.plateMass * (H.thick * H.thick + wid * wid) / 12,
    H.plateMass * (len * len + wid * wid) / 12,
    H.plateMass * (len * len + H.thick * H.thick) / 12, 0, 0, 0];
  const plate = [];
  for (let i = 0; i < NU; i++) {
    plate.push([]);
    const c = atLen(H.fan + (i + 0.5) * len);
    // x along the curve, z across, y = z × x.
    const xx = [ex[0] * c[3], c[4], ex[2] * c[3]];
    const yy = [ez[1] * xx[2] - ez[2] * xx[1], ez[2] * xx[0] - ez[0] * xx[2], ez[0] * xx[1] - ez[1] * xx[0]];
    const q = [0, 0, 0, 1];
    avbdQuatFromBasis(xx[0], xx[1], xx[2], yy[0], yy[1], yy[2], ez[0], ez[1], ez[2], q, 0);
    for (let j = 0; j < NV; j++) {
      const zc = (j + 0.5 - NV / 2) * wid;
      const b = net.addBody(H.plateMass, Ip, c[0] + ez[0] * zc, c[1] + ez[1] * zc, c[2] + ez[2] * zc, q);
      plate[i].push(b);
      // Where it touches things: a thin box, which is what meets her (see
      // (e) over `avbdNet`), and its four corners, which meet the ground.
      const r = H.thick / 2;
      net.addBox(b, len / 2, r, wid / 2);
      for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) net.addPoint(b, sx * len, 0, sz * wid, r);
    }
  }
  const Ig = (2 / 5) * H.gatherMass * 0.04 * 0.04;
  const gA = net.addBody(H.gatherMass, [Ig, Ig, Ig, 0, 0, 0], GA[0], GA[1], GA[2]);
  const gB = net.addBody(H.gatherMass, [Ig, Ig, Ig, 0, 0, 0], GB[0], GB[1], GB[2]);
  // Her, last: solved first in every sweep, as the reference walks its list.
  const her = net.addBody(H.herMass, [8, 8, 1, 0, 0, 0], Mx, My - 1, Mz);
  net.setLive(her, false);
  net.drag[her] = H.herDrag;

  // ── joints: every shared edge, at its middle ─────────────────────────
  const HG = o.hinge == null ? H.hinge : o.hinge;
  const KE = o.edgeK == null ? H.edgeK : o.edgeK, KB = o.bendK == null ? H.bendK : o.bendK;
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      if (i + 1 < NU) net.addJoint(plate[i][j], [len / 2, 0, 0], plate[i + 1][j], [-len / 2, 0, 0], Infinity, KB, 1);
      if (j + 1 < NV) net.addJoint(plate[i][j], [0, 0, wid / 2], plate[i][j + 1], [0, 0, -wid / 2], Infinity, KB, 1);
      for (const f of KE > 0 ? [-HG, HG] : []) {
        if (i + 1 < NU) net.addJoint(plate[i][j], [len / 2, 0, f * wid], plate[i + 1][j], [-len / 2, 0, f * wid], KE);
        if (j + 1 < NV) net.addJoint(plate[i][j], [f * len, 0, wid / 2], plate[i][j + 1], [f * len, 0, -wid / 2], KE);
      }
    }
  }
  // ── the bend — see HAMMOCK.bendAcross ─────────────────────────────────
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      if (j + 2 < NV) net.addString(plate[i][j], [0, 0, 0], plate[i][j + 2], [0, 0, 0], 2 * wid, H.bendAcross);
      if (i + 2 < NU) net.addString(plate[i][j], [0, 0, 0], plate[i + 2][j], [0, 0, 0], 2 * len, H.bendAlong);
    }
  }
  // ── the gathered ends, and the ropes ─────────────────────────────────
  const fans = [];
  // EVERY ROW THE SAME LENGTH, AND THE EDGES A LITTLE LESS. The first cut
  // strung each row to the gather by the straight distance from it laid flat
  // — `hypot(fan, zc)` — which made the selvedge rows 0.24 m longer than the
  // middle one, and a longer row hangs lower: MEASURED, the empty cloth folded
  // shut like a book hanging spine-up, the middle row 0.37 m ABOVE the two
  // edges, and with her in it there was no cradle for her to lie in — at 17
  // degrees of swing she rolled out over the edge on to the ground. On a
  // gathered hammock every thread runs from whipping to whipping, the edges
  // no longer than the middle, so the ends are drawn in (the plates fold into
  // the gather) and the edges ride up round whoever is in it. `lip` takes a
  // little more off the selvedge than that, for the hem and the doubled
  // edge, which is what makes the rim of a hammock stand higher than its bed.
  for (let j = 0; j < NV; j++) {
    const zc = (j + 0.5 - NV / 2) * wid;
    const l = H.fan * (1 - H.lip * Math.abs(zc) / (H.width / 2));
    // Strung at the length it is laid out at, and drawn in to `l` by
    // `settle`: laid flat the ends are a metre thirty wide, and pulling them
    // in to the gather in one step is a quarter of a metre of error on a
    // forty-five-gram plate, which the first build of this blew up on.
    const l0 = Math.hypot(H.fan, zc);
    fans.push([net.addString(gA, [0, 0, 0], plate[0][j], [-len / 2, 0, 0], l0), l0, l]);
    fans.push([net.addString(gB, [0, 0, 0], plate[NU - 1][j], [len / 2, 0, 0], l0), l0, l]);
  }
  const ropeA = net.addString(-1, o.A, gA, [0, 0, 0], rope);
  const ropeB = net.addString(-1, o.B, gB, [0, 0, 0], rope);
  // ── the hand that guides her ─────────────────────────────────────────
  const guide = net.addJoint(-1, [0, 0, 0], her, [0, 0, 0], 0, 0, 1);
  // ── and the sling's hold on her — see HAMMOCK.keep ────────────────────
  const keep = net.addJoint(plate[NU >> 1][NV >> 1], [0, 0, 0], her, [0, 0, 0], 0, 0, 1);
  // ── her capsules, rewritten every frame by `herShape` ────────────────
  const caps = [];
  for (let k = 0; k < 32; k++) { const c = net.addCap(her, k); net.cpOn[c] = 0; caps.push(c); }
  net.finish();

  /** Hang it: `secs` of steps, the gathered ends drawn in over the first half. */
  function settle(secs, h) {
    const n = Math.round(secs / h);
    for (let k = 0; k < n; k++) {
      const u = Math.min(1, k / (0.5 * n));
      const e = u * u * (3 - 2 * u);
      for (const [si, l0, l] of fans) net.sLen[si] = l0 + (l - l0) * e;
      net.step(h);
    }
  }
  /** The fastest thing in it, m/s, |vx| + |vy| + |vz| — what `still` is measured in. */
  function motion() {
    let vmax = 0;
    const V = net.V;
    for (let b = 0; b < net.nb; b++) {
      if (!net.live[b]) continue;
      vmax = Math.max(vmax, Math.abs(V[3 * b]) + Math.abs(V[3 * b + 1]) + Math.abs(V[3 * b + 2]));
    }
    return vmax;
  }
  /** The empty cloth's extra air on or off — see HAMMOCK.hush. Her drag is her own. */
  function hush(on) {
    const d = on ? H.drag + H.hush : H.drag;
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) net.drag[plate[i][j]] = d;
    net.drag[gA] = d; net.drag[gB] = d;
  }
  /**
   * After `settle`: hushed until still, and the solve's memory of getting
   * there aged — see HAMMOCK.restV and HAMMOCK.relax. Answers whether it got
   * there; the hush is left on, for the caller to take off.
   */
  function rest(h) {
    hush(true);
    let t = 0, q = 0;
    while (t < H.restMax && q < H.restHold) {
      net.step(h); t += h;
      q = motion() < H.restV ? q + h : 0;
    }
    net.relax(H.relax);
    return q >= H.restHold;
  }

  return { net, plate, gA, gB, her, guide, keep, caps, ropeA, ropeB, ex, ey, ez, M: [Mx, My, Mz], settle, rest, hush, motion,
    D, rope, len, wid, NU, NV, floorM, drop };
}

/**
 * Build it. `J`:
 *   A, B          the two ties, world [x, y, z], on the bark
 *   trunks        [[x, z, r], [x, z, r]] — the two trees, for the straps
 *   floor(x, z)   the ground
 *
 * Returns the handle 43-jadrija.js keeps.
 */
function buildHammock(scene, J) {
  const H = HAMMOCK;
  const S = hammockSim(J);
  const net = S.net, NU = S.NU, NV = S.NV, len = S.len, wid = S.wid;

  // ── the cloth's mesh ────────────────────────────────────────────────────
  //
  // The plates are rigid and their corners do not quite meet — a ball socket
  // at an edge's middle lets the corners open as two plates fold — so the
  // surface drawn is the one through the MEAN of the corners that meet at
  // each grid point, which is where the cloth between them would be. Then
  // two columns of fan either side, down to the gather, and the whole grid
  // run through a Catmull-Rom surface at twice the density so the folds
  // under her are curves and not facets.
  const GU = NU + 1 + 2 * 2 + 2;   // node columns: gather, 2 fan, NU+1, 2 fan, gather
  const GV = NV + 1;
  const node = new Float64Array(GU * GV * 3);
  // Where each drawn column and row falls on the node grid. The rows carry
  // the selvedge — a hand's breadth at each edge in the red-orange, with a
  // doubled row at its inner edge so the stripe has an edge of its own.
  const US = 2;
  const cols = [];
  for (let k = 0; k <= (GU - 1) * US; k++) cols.push(k / US);
  const rows = [];            // [node v, colour 0 cloth 1 edge]
  const edgeV = 0.09 * NV;    // the selvedge's inner line, in node units
  rows.push([0, 1]);
  rows.push([edgeV, 1]); rows.push([edgeV, 0]);
  for (let k = 1; k < NV * 2; k++) {
    const v = k / 2;
    if (v > edgeV + 0.05 && v < NV - edgeV - 0.05) rows.push([v, 0]);
  }
  rows.push([NV - edgeV, 0]); rows.push([NV - edgeV, 1]);
  rows.push([NV, 1]);
  const NCOL = cols.length, NROW = rows.length;
  // Two sheets — the top and the underside — so each face lights as itself
  // and the cloth has the thickness of a canvas rather than of a page.
  const NVtx = NCOL * NROW;
  const pos = new Float32Array(NVtx * 2 * 3);
  const col = new Float32Array(NVtx * 2 * 3);
  const idx = [];
  for (let s = 0; s < 2; s++) {
    for (let r = 0; r < NROW; r++) {
      const c3 = rows[r][1] ? HAMMOCK_EDGE : HAMMOCK_CLOTH;
      // The underside a shade darker: it is in its own shadow.
      const k = s ? 0.78 : 1;
      for (let c = 0; c < NCOL; c++) {
        const v = s * NVtx + r * NCOL + c;
        col[3 * v] = c3[0] * k; col[3 * v + 1] = c3[1] * k; col[3 * v + 2] = c3[2] * k;
      }
    }
    for (let r = 0; r + 1 < NROW; r++) {
      if (rows[r + 1][0] - rows[r][0] < 1e-6) continue;       // the doubled seam
      for (let c = 0; c + 1 < NCOL; c++) {
        const a = s * NVtx + r * NCOL + c, b = a + 1, d = a + NCOL, e = d + 1;
        if (s === 0) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  const posA = new THREE.BufferAttribute(pos, 3);
  posA.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posA);
  geo.setAttribute('aVCol', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const cloth = new THREE.Mesh(geo, solidMaterial(0xffffff, {
    spec: 0.05, specPower: 12, side: THREE.DoubleSide,
    body: 'base *= vVCol;\n  n = gl_FrontFacing ? n : -n;',
  }));
  cloth.name = 'hammock:cloth';
  cloth.frustumCulled = false;
  scene.add(cloth);

  // The ropes and the whippings: unit cylinders along +y, stretched and
  // turned into place every frame. And the straps, round the bark, still.
  const ropeMat = solidMaterial(new THREE.Color(...HAMMOCK_ROPE).getHex(), { vcol: false, spec: 0.04 });
  const ropeGeo = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true);
  const ropes = [0, 1].map(() => {
    const m = new THREE.Mesh(ropeGeo, ropeMat);
    m.name = 'hammock:rope';
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });
  const whip = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.55, 1, 9, 1, false), ropeMat);
    m.name = 'hammock:whipping';
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });
  const strapMat = solidMaterial(new THREE.Color(...HAMMOCK_STRAP).getHex(), { vcol: false, spec: 0.03 });
  for (const [tx, tz, tr] of J.trunks) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(tr + 0.012, 0.018, 5, 18), strapMat);
    m.rotation.x = Math.PI / 2;
    m.position.set(tx, J.floor(tx, tz) + H.tie, tz);
    m.name = 'hammock:strap';
    scene.add(m);
  }

  // ── drawing it ──────────────────────────────────────────────────────────
  const P = net.P, Q = net.Q;
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const corner = new Float64Array(3);
  /** A plate's corner (sx, sz = ±1) in the world, into `corner`. */
  function plateCorner(b, sx, sz) {
    _q.set(Q[4 * b], Q[4 * b + 1], Q[4 * b + 2], Q[4 * b + 3]);
    _v.set(sx * len / 2, 0, sz * wid / 2).applyQuaternion(_q);
    corner[0] = P[3 * b] + _v.x; corner[1] = P[3 * b + 1] + _v.y; corner[2] = P[3 * b + 2] + _v.z;
  }
  function nodeSet(u, v, x, y, z) { const k = 3 * (v * GU + u); node[k] = x; node[k + 1] = y; node[k + 2] = z; }
  function fillNodes() {
    // The cloth: each grid point the mean of the corners meeting there.
    const acc = new Float64Array((NU + 1) * (NV + 1) * 4);
    for (let i = 0; i < NU; i++) {
      for (let j = 0; j < NV; j++) {
        const b = S.plate[i][j];
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            plateCorner(b, sx, sz);
            const gi = i + (sx > 0 ? 1 : 0), gj = j + (sz > 0 ? 1 : 0), k = 4 * (gj * (NU + 1) + gi);
            acc[k] += corner[0]; acc[k + 1] += corner[1]; acc[k + 2] += corner[2]; acc[k + 3]++;
          }
        }
      }
    }
    for (let gj = 0; gj <= NV; gj++) {
      for (let gi = 0; gi <= NU; gi++) {
        const k = 4 * (gj * (NU + 1) + gi), n = acc[k + 3];
        nodeSet(gi + 3, gj, acc[k] / n, acc[k + 1] / n, acc[k + 2] / n);
      }
    }
    // The fans: gather, then two columns a third and two thirds of the way to
    // the end of the cloth, pulled in toward the middle row — the gathered
    // cloth is bunched, not stretched straight.
    for (const [g, c0, sgn] of [[S.gA, 3, -1], [S.gB, 3 + NU, 1]]) {
      const gx = P[3 * g], gy = P[3 * g + 1], gz = P[3 * g + 2];
      const mid = 3 * ((NV >> 1) * GU + c0);
      for (let gj = 0; gj <= NV; gj++) {
        const e = 3 * (gj * GU + c0);
        for (const [f, off] of [[2 / 3, 1], [1 / 3, 2]]) {
          const pull = 0.25 * (1 - f);
          const x = gx + (node[e] - gx) * f, y = gy + (node[e + 1] - gy) * f, z = gz + (node[e + 2] - gz) * f;
          const mx = gx + (node[mid] - gx) * f, my = gy + (node[mid + 1] - gy) * f, mz = gz + (node[mid + 2] - gz) * f;
          nodeSet(c0 + sgn * off, gj, x + (mx - x) * pull, y + (my - y) * pull, z + (mz - z) * pull);
        }
        nodeSet(c0 + sgn * 3, gj, gx, gy, gz);
      }
    }
  }
  // Catmull-Rom through four values.
  const cr = (a, b, c, d, t) => {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  };
  const tmpU = new Float64Array(4 * 3);
  function surf(u, v, out, oo) {
    const iu = Math.min(GU - 2, Math.floor(u)), fu = u - iu;
    const iv = Math.min(GV - 2, Math.floor(v)), fv = v - iv;
    for (let a = 0; a < 4; a++) {
      const vv = Math.max(0, Math.min(GV - 1, iv - 1 + a));
      for (let k = 0; k < 3; k++) {
        const g = (uu) => node[3 * (vv * GU + Math.max(0, Math.min(GU - 1, uu))) + k];
        tmpU[3 * a + k] = cr(g(iu - 1), g(iu), g(iu + 1), g(iu + 2), fu);
      }
    }
    for (let k = 0; k < 3; k++) out[oo + k] = cr(tmpU[k], tmpU[3 + k], tmpU[6 + k], tmpU[9 + k], fv);
  }
  const nrm = new Float32Array(NVtx * 3);
  function draw() {
    fillNodes();
    for (let r = 0; r < NROW; r++) {
      for (let c = 0; c < NCOL; c++) surf(cols[c], rows[r][0], pos, 3 * (r * NCOL + c));
    }
    // Normals off the grid, and the underside moved 6 mm under the top along
    // them — the canvas's thickness.
    for (let r = 0; r < NROW; r++) {
      for (let c = 0; c < NCOL; c++) {
        const v = r * NCOL + c;
        const cl = Math.max(0, c - 1), ch = Math.min(NCOL - 1, c + 1);
        let rl = Math.max(0, r - 1), rh = Math.min(NROW - 1, r + 1);
        if (rows[rh][0] - rows[rl][0] < 1e-6) { rl = Math.max(0, rl - 1); rh = Math.min(NROW - 1, rh + 1); }
        const ux = pos[3 * (r * NCOL + ch)] - pos[3 * (r * NCOL + cl)];
        const uy = pos[3 * (r * NCOL + ch) + 1] - pos[3 * (r * NCOL + cl) + 1];
        const uz = pos[3 * (r * NCOL + ch) + 2] - pos[3 * (r * NCOL + cl) + 2];
        const vx = pos[3 * (rh * NCOL + c)] - pos[3 * (rl * NCOL + c)];
        const vy = pos[3 * (rh * NCOL + c) + 1] - pos[3 * (rl * NCOL + c) + 1];
        const vz = pos[3 * (rh * NCOL + c) + 2] - pos[3 * (rl * NCOL + c) + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        // Up, on the top sheet.
        if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const l = Math.hypot(nx, ny, nz) || 1;
        nrm[3 * v] = nx / l; nrm[3 * v + 1] = ny / l; nrm[3 * v + 2] = nz / l;
        const w = NVtx + v;
        pos[3 * w] = pos[3 * v] - nrm[3 * v] * 0.006;
        pos[3 * w + 1] = pos[3 * v + 1] - nrm[3 * v + 1] * 0.006;
        pos[3 * w + 2] = pos[3 * v + 2] - nrm[3 * v + 2] * 0.006;
      }
    }
    posA.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    // The ropes: tie to gather, 11 mm; and the whipping, the last 16 cm of
    // it, fatter, where the rope is wound round the gathered cloth.
    for (const [m, w, T, g] of [[ropes[0], whip[0], J.A, S.gA], [ropes[1], whip[1], J.B, S.gB]]) {
      const gx = P[3 * g], gy = P[3 * g + 1], gz = P[3 * g + 2];
      _v.set(gx - T[0], gy - T[1], gz - T[2]);
      const l = _v.length();
      _w.copy(_v).normalize();
      m.position.set((gx + T[0]) / 2, (gy + T[1]) / 2, (gz + T[2]) / 2);
      m.quaternion.setFromUnitVectors(_v.set(0, 1, 0), _w);
      m.scale.set(0.011, l, 0.011);
      w.quaternion.copy(m.quaternion);
      w.position.set(gx + _w.x * 0.02, gy + _w.y * 0.02, gz + _w.z * 0.02);
      w.scale.set(0.030, 0.16, 0.030);
    }
  }

  // ── her ─────────────────────────────────────────────────────────────────
  //
  // Her body's origin is her centre of mass, and it moves with the pose —
  // sitting, lying back, drawing a knee up — so it is worked out afresh every
  // frame from the capsules she is made of, and the body re-centred on it
  // without moving a thing: the mesh is where it was, and the velocity at the
  // new centre is the old one plus the spin times the shift. `com` is in the
  // MESH's frame; the body's attitude is the mesh's.
  const her = S.her;
  const com = new Float64Array(3);
  // The line between the ties, which is over the whole bed: the cloth's
  // inside is the face toward it — see (g) over `avbdNet`.
  const tiesLine = (() => {
    const dx = J.B[0] - J.A[0], dy = J.B[1] - J.A[1], dz = J.B[2] - J.A[2], l = Math.hypot(dx, dy, dz);
    return [J.A[0], J.A[1], J.A[2], dx / l, dy / l, dz / l];
  })();
  let herIn = false, kept = false;
  const _hq = new THREE.Quaternion(), _hv = new THREE.Vector3();
  /**
   * Her capsules this frame, in her mesh's own frame: [ax, ay, az, bx, by,
   * bz, r0, r1] each. Her centre of mass and her inertia follow from them —
   * each capsule a solid of its volume at one density, 55 kg in all.
   */
  function herShape(list, twoFrom = Infinity) {
    let vol = 0, cx = 0, cy = 0, cz = 0;
    const w = [];
    for (const c of list) {
      const r = (c[6] + c[7]) / 2, L = Math.hypot(c[3] - c[0], c[4] - c[1], c[5] - c[2]);
      const v = Math.PI * r * r * L + (4 / 3) * Math.PI * r * r * r;
      w.push(v); vol += v;
      cx += v * (c[0] + c[3]) / 2; cy += v * (c[1] + c[4]) / 2; cz += v * (c[2] + c[5]) / 2;
    }
    if (vol <= 0) return;
    cx /= vol; cy /= vol; cz /= vol;
    // The inertia about that centre: each capsule a rod along its axis with
    // its radius about it, moved out by the parallel-axis rule.
    const I = [0, 0, 0, 0, 0, 0];
    list.forEach((c, k) => {
      const m = H.herMass * w[k] / vol, r = (c[6] + c[7]) / 2;
      let ux = c[3] - c[0], uy = c[4] - c[1], uz = c[5] - c[2];
      const L = Math.hypot(ux, uy, uz) || 1;
      ux /= L; uy /= L; uz /= L;
      const across = m * (L * L / 12 + r * r / 4), along = m * r * r / 2;
      const dx = (c[0] + c[3]) / 2 - cx, dy = (c[1] + c[4]) / 2 - cy, dz = (c[2] + c[5]) / 2 - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      // across·(I − uuᵀ) + along·uuᵀ + m(d²I − ddᵀ)
      I[0] += across * (1 - ux * ux) + along * ux * ux + m * (d2 - dx * dx);
      I[1] += across * (1 - uy * uy) + along * uy * uy + m * (d2 - dy * dy);
      I[2] += across * (1 - uz * uz) + along * uz * uz + m * (d2 - dz * dz);
      I[3] += (along - across) * ux * uy - m * dx * dy;
      I[4] += (along - across) * ux * uz - m * dx * dz;
      I[5] += (along - across) * uy * uz - m * dy * dz;
    });
    // Re-centred: the body moves by R·(new − old), the mesh does not.
    if (herIn) {
      _hq.set(Q[4 * her], Q[4 * her + 1], Q[4 * her + 2], Q[4 * her + 3]);
      _hv.set(cx - com[0], cy - com[1], cz - com[2]).applyQuaternion(_hq);
      P[3 * her] += _hv.x; P[3 * her + 1] += _hv.y; P[3 * her + 2] += _hv.z;
      const Wv = net.W, Vv = net.V, o3 = 3 * her;
      Vv[o3] += Wv[o3 + 1] * _hv.z - Wv[o3 + 2] * _hv.y;
      Vv[o3 + 1] += Wv[o3 + 2] * _hv.x - Wv[o3] * _hv.z;
      Vv[o3 + 2] += Wv[o3] * _hv.y - Wv[o3 + 1] * _hv.x;
    }
    com[0] = cx; com[1] = cy; com[2] = cz;
    for (let k = 0; k < 6; k++) net.inert[6 * her + k] = I[k];
    // And the capsules, in the body's frame: the mesh's, less the centre.
    for (let k = 0; k < S.caps.length; k++) {
      const cp = S.caps[k];
      if (k >= list.length) { net.cpOn[cp] = 0; continue; }
      const c = list[k];
      net.setCap(cp, c[0] - cx, c[1] - cy, c[2] - cz, c[3] - cx, c[4] - cy, c[5] - cz, c[6], c[7]);
      net.cpOn[cp] = 1;
      net.cpTwo[cp] = k >= twoFrom ? 1 : 0;
    }
  }
  /** Into the hammock: her body live, where her mesh is, held there by the guide. */
  function herEnter(mp, mq, list, twoFrom) {
    herIn = false;
    herShape(list, twoFrom);
    _hq.copy(mq);
    _hv.set(com[0], com[1], com[2]).applyQuaternion(_hq);
    net.setLive(her, true);
    net.place(her, mp.x + _hv.x, mp.y + _hv.y, mp.z + _hv.z, [mq.x, mq.y, mq.z, mq.w]);
    herIn = true;
    rouse();
    forget();
    herGuide(mp, mq, H.guideLin, H.guideAng);
  }
  /** Where the guide wants her mesh, and how hard; 0 and 0 lets her go. */
  function herGuide(mp, mq, kLin, kAng) {
    if (!herIn) return;
    _hq.copy(mq);
    _hv.set(com[0], com[1], com[2]).applyQuaternion(_hq);
    net.setTarget(S.guide, mp.x + _hv.x, mp.y + _hv.y, mp.z + _hv.z, [mq.x, mq.y, mq.z, mq.w]);
    net.setJointK(S.guide, kLin, kAng);
    // Springs to the cloth while anything is guiding her; hard once nothing is.
    net.softBody[her] = kLin > 0 || kAng > 0 ? 1 : 0;
    // And the sling's hold on her, from the moment nothing else holds her —
    // taken where she lies then, relative to the middle of the bed.
    if (kLin > 0 || kAng > 0) { if (kept) { net.setJointK(S.keep, 0, 0); kept = false; } } else if (!kept) {
      const m = S.plate[NU >> 1][NV >> 1];
      _hq.set(Q[4 * m], Q[4 * m + 1], Q[4 * m + 2], Q[4 * m + 3]).invert();
      _hv.set(P[3 * her] - P[3 * m], P[3 * her + 1] - P[3 * m + 1], P[3 * her + 2] - P[3 * m + 2]).applyQuaternion(_hq);
      net.setTarget(S.keep, _hv.x, _hv.y, _hv.z);
      net.setJointK(S.keep, H.keep, 0);
      kept = true;
    }
    // And the cloth one-sided the whole time she is in it — (g) over
    // `avbdNet`. Not only while she is guided, which is what it was first,
    // and MEASURED the switch back to two-sided at the end of getting in was
    // the worst frame in the hammock: whatever of her had come in through
    // the outside of the trough was suddenly a contact from the wrong side,
    // and one time in two she was put out over the rim and on to the ground
    // within a second of lying down. From inside, the cloth holds her; a
    // leg over the rim is a leg over the rim.
    net.setOneSided(true, tiesLine);
  }
  /** Where her mesh is to be drawn: the body, less the centre of mass. */
  function herPose(outP, outQ) {
    if (!herIn) return false;
    outQ.set(Q[4 * her], Q[4 * her + 1], Q[4 * her + 2], Q[4 * her + 3]);
    _hv.set(com[0], com[1], com[2]).applyQuaternion(outQ);
    outP.set(P[3 * her] - _hv.x, P[3 * her + 1] - _hv.y, P[3 * her + 2] - _hv.z);
    return true;
  }
  function herLeave() {
    herIn = false;
    net.setJointK(S.guide, 0, 0);
    net.setJointK(S.keep, 0, 0); kept = false;
    net.setOneSided(false);
    net.setLive(her, false);
    for (const c of S.caps) net.cpOn[c] = 0;
    rouse();
    forget();
  }

  // ── the swing ───────────────────────────────────────────────────────────
  //
  // How far round the line between the ties the hammock is swung: the angle
  // of whatever is heaviest in it — her, or the middle of the cloth — about
  // that line, from hanging straight down. And how fast.
  const mid = S.plate[NU >> 1][NV >> 1];
  let swingA = 0, swingW = 0, swingAWas = 0, swingPeak = 0, swingWas = 0;
  let creaks = 0, pushes = 0;
  function swingNow() {
    const b = herIn ? her : mid;
    const dx = P[3 * b] - S.M[0], dy = P[3 * b + 1] - S.M[1], dz = P[3 * b + 2] - S.M[2];
    const across = dx * S.ez[0] + dz * S.ez[2];
    return Math.atan2(across, -dy);
  }

  /**
   * A push, from you at (x, z): the nearest of her or the cloth, away from
   * you and across the span. Answers the velocity it gave, or null if you
   * are out of reach.
   */
  function push(x, z) {
    const n = nearest(x, z);
    if (!n || n.d > H.reach) return null;
    // Across the span, away from you.
    const side = (x - S.M[0]) * S.ez[0] + (z - S.M[2]) * S.ez[2];
    const sg = side > 0 ? -1 : 1;
    let dv;
    if (herIn) {
      // THE WHOLE HAMMOCK, HER AND THE CLOTH ALIKE, and not her alone. A
      // hand on somebody in a hammock pushes the sling they are in; the first
      // cut kicked her body and the cloth at four fifths of it, and MEASURED
      // the difference was enough to roll her over inside the cloth instead
      // of swinging it — six pushes, the swing creeping to 12 degrees one
      // way and never coming back, her rolled three quarters on to her side.
      // The impulse is hers (her mass is 96 % of the lot), spread as one
      // velocity over every body in it, so nothing moves against anything.
      dv = H.push / (H.herMass + NU * NV * H.plateMass);
      net.kick(her, S.ez[0] * dv * sg, 0, S.ez[2] * dv * sg);
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
        net.kick(S.plate[i][j], S.ez[0] * dv * sg, 0, S.ez[2] * dv * sg);
      }
      net.kick(S.gA, S.ez[0] * dv * sg, 0, S.ez[2] * dv * sg);
      net.kick(S.gB, S.ez[0] * dv * sg, 0, S.ez[2] * dv * sg);
    } else {
      dv = H.pushEmpty;
      for (let i = 0; i < NU; i++) {
        for (let j = 0; j < NV; j++) {
          const b = S.plate[i][j];
          const d = Math.hypot(P[3 * b] - n.x, P[3 * b + 2] - n.z);
          const k = Math.max(0, 1 - d / 1.2);
          if (k > 0) net.kick(b, S.ez[0] * dv * sg * k, 0, S.ez[2] * dv * sg * k);
        }
      }
    }
    rouse();
    pushes++;
    return { dv: +(dv * sg).toFixed(3), at: [n.x, n.y, n.z] };
  }
  /** The nearest point of the cloth (or her) to (x, z): plate centres, horizontally. */
  function nearest(x, z) {
    let best = null, bd = Infinity;
    const test = (b) => {
      const d = Math.hypot(P[3 * b] - x, P[3 * b + 2] - z);
      if (d < bd) { bd = d; best = { x: P[3 * b], y: P[3 * b + 1], z: P[3 * b + 2], d }; }
    };
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) test(S.plate[i][j]);
    if (herIn) test(her);
    return best;
  }

  // ── stepping ────────────────────────────────────────────────────────────
  let asleep = false, still = 0, acc = 0, far = false;
  // The hush — see HAMMOCK.hush: whether it is on, and the fastest thing in
  // the empty cloth over the window before this one and this one so far.
  // Infinity before a whole window has been seen, so nothing is hushed on
  // less than one.
  let hushed = false, winT = 0, winCur = 0, winWas = Infinity;
  /** Anything that moves it — a push, her, a debug kick — wakes it and takes the hush off. */
  function rouse() {
    asleep = false; still = 0;
    if (hushed) { S.hush(false); hushed = false; }
    winT = 0; winCur = 0; winWas = Infinity;
  }
  const stats = { ms: 0, msMax: 0, msSum: 0, frames: 0, steps: 0, sleep: 0, rescues: 0, bails: 0 };
  // The last good state — see the guard in `step`.
  const goodP = new Float64Array(P.length), goodQ = new Float64Array(Q.length);
  const finite = () => {
    for (let k = 0; k < 3 * net.nb; k++) if (!(P[k] === P[k]) || Math.abs(P[k]) > 1e5) return false;
    return true;
  };
  const keep = () => { goodP.set(P); goodQ.set(Q); };
  function restore() {
    P.set(goodP); Q.set(goodQ);
    for (let b = 0; b < net.nb; b++) {
      net.place(b, P[3 * b], P[3 * b + 1], P[3 * b + 2],
        [Q[4 * b], Q[4 * b + 1], Q[4 * b + 2], Q[4 * b + 3]]);
    }
    net.resetDuals();
  }
  // AND ONE BAD SECOND IS ONE BAD SECOND. Misha, 27 Sep 2026: *"somehow the
  // hammock broke now, she gets there and it breaks and gets thrown into the
  // sky or something"*. The guard above only knows a number from not a
  // number, and this was numbers: MEASURED, one run in three, she lands in
  // the cloth 0.3 m off where she lands every other time and 4 cm high,
  // creeps along it for three seconds, and then the joints open — 1.7 mm,
  // 39, 62 — and the next half second everything is kilometres away, every
  // coordinate finite. The two runs in three that land true lie there for
  // seventy seconds at 0.2 mm.
  //
  // So the net is also watched for going WRONG, not only for going to NaN:
  // a hard joint open past `H.snapStretch`, a body faster than `H.snapV`,
  // or anything further from the ties than a hammock can reach. Wrong, it
  // goes back to the state of half a second ago — a snapshot every quarter
  // second while it is right, the oldest of three kept — at rest and with
  // its multipliers cold. And if it goes wrong three times in four seconds
  // the lie is not recoverable from where it is: she is taken out of it,
  // the cloth goes back to hanging empty as it was built, and `hamHeld`
  // finds her out and walks her home. A woman getting out of a hammock is
  // a thing that happens; a hammock in the sky is not.
  const snaps = [0, 1, 2].map(() => ({ P: new Float64Array(P.length), Q: new Float64Array(Q.length), ok: false }));
  const restP = new Float64Array(P.length), restQ = new Float64Array(Q.length);
  let snapT = 0, simT = 0, trips = [];
  const sane = () => {
    const R = S.D * 0.5 + S.rope + 2.5;
    for (let b = 0; b < net.nb; b++) {
      if (!net.live[b]) continue;
      const dx = P[3 * b] - S.M[0], dy = P[3 * b + 1] - S.M[1], dz = P[3 * b + 2] - S.M[2];
      if (dx * dx + dy * dy + dz * dz > R * R) { stats.why = 'far ' + b; return false; }
      const V = net.V;
      if (V[3 * b] * V[3 * b] + V[3 * b + 1] * V[3 * b + 1] + V[3 * b + 2] * V[3 * b + 2] > H.snapV * H.snapV) { stats.why = 'fast ' + b; return false; }
    }
    net.measure();
    if (net.stats.maxStretch >= H.snapStretch) { stats.why = 'open ' + net.stats.maxStretch.toFixed(4); return false; }
    return true;
  };
  const putBack = (sp, sq) => {
    P.set(sp); Q.set(sq);
    for (let b = 0; b < net.nb; b++) {
      net.place(b, P[3 * b], P[3 * b + 1], P[3 * b + 2],
        [Q[4 * b], Q[4 * b + 1], Q[4 * b + 2], Q[4 * b + 3]]);
    }
    net.resetDuals();
    keep();
  };
  const forget = () => { for (const sn of snaps) sn.ok = false; snapT = 0; };
  function wrong() {
    stats.rescues++;
    trips = trips.filter((t) => simT - t < 4);
    trips.push(simT);
    const old = snaps.find((sn) => sn.ok);
    if (trips.length < 3 && old) {
      putBack(old.P, old.Q);
      forget();
      return;
    }
    // Out, and hung up again empty.
    stats.bails++;
    if (herIn) herLeave();
    putBack(restP, restQ);
    forget();
    trips = [];
  }
  function snapNow(h) {
    snapT += h;
    if (snapT < 0.25) return;
    snapT = 0;
    const sn = snaps.shift();
    sn.P.set(P); sn.Q.set(Q); sn.ok = true;
    snaps.push(sn);
  }

  let onCreak = null;
  function step(dt, cam) {
    const dx = S.M[0] - cam.x, dz = S.M[2] - cam.z;
    far = dx * dx + dz * dz > H.far * H.far;
    if (far && !herIn) return;
    if (asleep) { stats.sleep++; return; }
    const t0 = performance.now();
    // Fixed steps, at most three a frame; the rest carried to the next.
    acc = Math.min(acc + dt, 3 * H.sub);
    let n = 0;
    while (acc >= H.sub - 1e-9 && n < 3) {
      net.step(H.sub); acc -= H.sub; n++; stats.steps++;
      // ONE BAD STEP IS ONE BAD STEP. If anything came out of it not a
      // number, the whole net goes back to the last step that was good, at
      // rest — which is a hitch nobody sees, where the alternative is the
      // hammock and her gone from the world for good. Counted, so a probe
      // can say whether it ever happens.
      if (!finite()) { restore(); stats.rescues++; break; }
      keep();
    }
    if (!n) return;
    simT += n * H.sub;
    if (!sane()) wrong(); else snapNow(n * H.sub);
    // The swing, and its creak at each end.
    swingAWas = swingA;
    swingA = swingNow();
    swingW = (swingA - swingAWas) / Math.max(1e-4, n * H.sub);
    if (Math.sign(swingW) !== Math.sign(swingWas) && swingWas !== 0) {
      if (Math.abs(swingA) > H.creakAt && onCreak) { creaks++; onCreak(Math.abs(swingA), Math.hypot(dx, dz)); }
    }
    if (swingW !== 0) swingWas = swingW;
    swingPeak = Math.max(swingPeak * Math.exp(-dt * 0.35), Math.abs(swingA));
    // Asleep once nobody is in it and nothing has moved for a while.
    if (!herIn) {
      const vmax = S.motion();
      // Hushed once a whole window and this one have stayed under a degree.
      winCur = Math.max(winCur, vmax);
      winT += n * H.sub;
      if (winT >= H.hushWin) { winWas = winCur; winCur = 0; winT = 0; }
      if (!hushed && Math.max(winWas, winCur) < H.hushV) { S.hush(true); hushed = true; }
      still = vmax < H.still ? still + dt : 0;
      if (still > H.sleepAfter) asleep = true;
    }
    draw();
    const ms = performance.now() - t0;
    stats.ms = ms; stats.msMax = Math.max(stats.msMax, ms); stats.msSum += ms; stats.frames++;
  }

  // Hung at build: settled empty, so the first time anybody walks up to it
  // it is hanging and not falling — and hushed to its rest and asleep, so
  // it is hanging still and costs nothing until something moves it. See
  // HAMMOCK.restV.
  {
    S.settle(H.settle, H.sub);
    hushed = true;
    asleep = S.rest(H.sub);
    keep();
    restP.set(P); restQ.set(Q);
    draw();
    swingA = swingNow();
  }

  /** The two places to get in from, one each side of the middle: [x, z, yaw to face out]. */
  function marks(off = HAM_MARK_M) {
    return [1, -1].map((sg) => ({
      x: S.M[0] + S.ez[0] * off * sg, z: S.M[2] + S.ez[2] * off * sg, side: sg,
      // Her back to the hammock: facing out along ±ez.
      out: [S.ez[0] * sg, S.ez[2] * sg],
    }));
  }

  const api = {
    sim: S, net, cloth,
    get herIn() { return herIn; },
    get asleep() { return asleep; },
    get far() { return far; },
    herEnter, herGuide, herShape, herPose, herLeave, push, nearest, marks,
    wake: () => rouse(),
    /** Debug: throw everything in it upward, to watch `wrong` catch it. */
    blowUp: (v = 40) => {
      for (let b = 0; b < net.nb; b++) if (net.live[b]) net.kick(b, 0, v * (0.5 + 0.5 * Math.sin(b * 7.1)), 0);
      rouse();
    },
    set onCreak(fn) { onCreak = fn; },
    /** How far it is swung (rad), how fast, and the recent peak. */
    swing: () => ({ a: swingA, w: swingW, peak: swingPeak }),
    /** The middle, the span's direction and across. */
    frame: () => ({ M: S.M.slice(), ex: S.ex.slice(), ez: S.ez.slice(), D: S.D, rope: S.rope }),
    /** Debug: the numbers. */
    stats: () => {
      net.measure();
      // Her body without her arms first — the arms lie out over the rims —
      // and then all of her, which leaves `penWho` naming the worst of all.
      const depthBody = herIn ? net.depth(true) : null;
      const depth = herIn ? net.depth() : null;
      const low = (() => {
        let y = Infinity;
        for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) y = Math.min(y, P[3 * S.plate[i][j] + 1]);
        return y;
      })();
      return {
        span: +S.D.toFixed(3), rope: +S.rope.toFixed(3), ties: +S.M[1].toFixed(3),
        floor: +S.floorM.toFixed(3),
        low: +low.toFixed(3), sag: +(S.M[1] - low).toFixed(3), sagOfSpan: +((S.M[1] - low) / S.D).toFixed(3),
        seat: +(low - S.floorM).toFixed(3),
        herIn, her: herIn ? [P[3 * her], P[3 * her + 1], P[3 * her + 2]].map((v) => +v.toFixed(3)) : null,
        support: herIn ? +net.support(her).toFixed(1) : null,
        swing: +swingA.toFixed(3), swingDeg: +(swingA * 180 / Math.PI).toFixed(1),
        peakDeg: +(swingPeak * 180 / Math.PI).toFixed(1),
        stretchMm: +(net.stats.maxStretch * 1000).toFixed(2),
        stringMm: +(net.stats.maxString * 1000).toFixed(2),
        penMm: depth == null ? null : +(depth * 1000).toFixed(1), penWho: net.stats.penWho,
        penBodyMm: depthBody == null ? null : +(depthBody * 1000).toFixed(1),
        contacts: net.nc, lost: net.stats.lost, refused: net.stats.refused,
        ms: +stats.ms.toFixed(3), msMax: +stats.msMax.toFixed(3),
        msMean: stats.frames ? +(stats.msSum / stats.frames).toFixed(3) : 0,
        frames: stats.frames, steps: stats.steps, asleep, hushed, creaks, pushes, rescues: stats.rescues, bails: stats.bails, why: stats.why, snaps: snaps.filter((q) => q.ok).length,
      };
    },
    resetStats: () => { stats.msMax = 0; stats.msSum = 0; stats.frames = 0; net.stats.refused = 0; },
  };
  return { api, step };
}
