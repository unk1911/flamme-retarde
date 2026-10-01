// -----------------------------------------------------------------------------
// KNOCKED OFF — a crowd figure let go as a LIVE ragdoll, pushed by something,
// and got up again. The café sitters and the hose are its first customers.
//
// Misha, 28 Sep 2026: *"are these guys that sit at tables and are on their
// cellphones, u said they are now ragdolls? so if they are ragdolls, can i
// like, come up to them and when i spray them, can i wash them off from their
// chairs so they fall off on the ground...? later i wanna be able to do stuff
// like that, like blow them off from their e-scooters, bicycles (GTA VI style)
// ... for now just wondering if they ragdolls how much can i 'displace them
// around' through 3-D space, and so it looks natural and doesn't require
// careful orchestration beforehand"* — and then, *"yeah queue 'hose people off
// their chairs' as the next ragdoll feature"*.
//
// They were ragdolls for a second and a third, once, off screen (the settle,
// 43-settle.js), and then a pose laid over a clip for good. This is the same
// ragdoll (43-ragdoll.js) left ON: taken over from the figure exactly as it is
// drawn this frame — clip, settle and solved hands — against the same chair,
// table and floor the settle sat them down on, with the push applied to the
// bodies it lands on, every step it lands. Nothing about which way they go is
// written down anywhere: pushed square from the front a sitter goes back into
// the backrest and over it, from the side off the seat sideways, from behind
// face first over the table. The physics decides.
//
// ── THE LIFE OF ONE ─────────────────────────────────────────────────────────
//
//   wet     being pushed, and holding on: the push is summed as an impulse
//           that leaks away (`KNOCK.leak`), and a light spray never gets it to
//           `KNOCK.tip`. A flinch is the caller's (a head turned away, a yelp).
//   live    past it: a ragdoll, braced at first and let go over
//           `KNOCK.brace` s (tension `KNOCK.hold` → `KNOCK.limp`), and the
//           push goes on for as long as the water does.
//   (roll)  still, and on their back: rolled over by their own muscles —
//           aimed at all fours and given a spin about the spine — because
//           the only way up these rigs have is `getup`, which starts on all
//           fours face down. There is no `situp` for a bather (Baye's does
//           not transfer: MEASURED, her rest pose is up to 32 degrees off
//           theirs bone for bone, and her `getup`'s first frame up to 84).
//           Twelve of twelve knocked on to their backs came up face down.
//   up      still on the ground, face down: into `getup`'s first frame from
//           where they lie (`rag.groundFrame`), eased over `KNOCK.upFade` s,
//           then the clip, then standing. The net is free again from here.
//   reseat  never got off the chair (slumped in it, draped over the back):
//           the ragdoll's pose eased back into their seated clip.
//   away    the caller's — here, 43-jadrija.js walks them off and brings them
//           back later (`stepToppled`).
//
// ── THE API (for the next customer: riders off bicycles and scooters) ───────
//
//   const T = makeToppler({ geoOf, event })
//       `geoOf(fg)` — what they are against, in THEIR FIGURE'S frame:
//       `{ boxes: [cx, cy, cz, hx, hy, hz, yaw, …], floor }`, the floor a
//       height or a function of (x, z) — `sitGeo`'s shape (43-jadrija.js), so
//       the settle's answer is this one's; and `v` (m/s, figure frame) if they
//       were already moving — `wheelOffGeo`'s, off a bicycle or a scooter
//       (1.550.0). `event(fg, what, info)` is told
//       'wet' (first push of a spell), 'live', 'down' (landed), 'up' (standing,
//       `info` = { x, y, z, yaw } world), 'reseat', 'bail' (the guard gave up).
//   T.push(fg, f, F, at, dt)   a force F (N, world [x, y, z]) this frame, along
//                              a line through `at` (world) — the bodies nearest
//                              the line take it. Sums toward the tip-over.
//   T.knock(fg, f, J, at)      an impulse J (N·s, world) — live NOW, whatever
//                              the sum says. The bicycle's crash is this.
//   T.draw(fg, f, dt)          from the crowd's `step`: true when this owns the
//                              figure this frame (placed, posed, updated), false
//                              to let the crowd draw it (its easing-back still
//                              ticked here).
//   T.live(fg)                 the phase, or null.
//   T.where(fg)                the pelvis in the world while it is a ragdoll.
//   T.stats(), T.list(), T.release(fg, f), T.cfg()
//   T.handOff(fg, f, phase, at)  off the ragdoll mid-flight into a phase of the
//                              caller's (the mole's swimmers, 1.550.0): the
//                              pose written into `at` ({x, y, z, yaw} world)
//                              and left on at full weight; `o.draw(fg, f, dt)`
//                              draws every frame of a phase this file does
//                              not know.
//
// And a prop that goes over with them — here the café chair, which is what
// "tips back with the chair" needed: from the front the backrest held a
// sitter as a wall would (MEASURED, 140 N·s square on the chest moved the
// pelvis 0 mm, and they folded over their own lap). `geoOf`'s answer with
// `chair: true` says its first two boxes are a seat and a backrest; they
// become two welded bodies in the net (`chairOn`) with points on the feet,
// the seat's corners and the top of the backrest, and `o.chair(fg, p, q)` is
// told each frame where the seat is and how it has turned, to draw it. A
// bicycle is the same thing with wheels.
//
// A figure is `fg` (the person, where they are, `fg.x/y/z/yaw/hscale`) and `f`
// (the skinned figure drawing them, 41-skin.js). The mesh is left where the
// person was while they are a ragdoll — the simulation runs in that frame, as
// the settle's does — so a rider would be taken over with their bicycle's
// velocity (`rag.enter`'s v/w/c) and the world's boxes for whatever is around.
//
// ── WHAT IT COSTS ────────────────────────────────────────────────────────────
//
// Nothing while nobody is down: one number a person being sprayed. A live one
// is a fourteen-body net of its own (twelve of them and a chair; one pool of
// them a body kind, built on first use, 0.4 to 0.6 ms), stepped at `KNOCK.h`,
// at most three steps a frame. MEASURED, headless on the RTX 4090 laptop: a
// step is 0.26 to 0.30 ms, so one person down is 0.4 ms of a 60 Hz frame and
// four at once 1.6 to 1.8 ms; the worst single frame for one person was 3.6
// ms, the first steps on a cold page. No more than `KNOCK.cap` at once; past
// that people just get wet. The guard caught nothing in any run (rescues 0).
// -----------------------------------------------------------------------------

const KNOCK = {
  // A step, and the iterations in one. 1/90 is the settle's, 8 its count.
  h: 1 / 90, iterations: 8, maxSteps: 3,
  // How many can be down at once. The fifth person you hose just gets wet.
  cap: 4,
  // The tip-over, N·s: the push summed, leaking away at 1/leak per second —
  // so what counts is a SPELL of it, not the total over a session. The sum's
  // ceiling at a steady push F is F·leak, so with `force` and its falloff
  // below: at 2 m, 150 N, over in 0.76 s; at 3 m, 131 N, 0.94 s; at 4 m,
  // 112 N, 1.25 s; at 5 m, 94 N, 1.9 s; and from 6 m (75 N, a ceiling of 75)
  // never — you soak them and they stay put. The first cut, 70 at a leak of
  // 0.8, MEASURED 66 N·s off one 0.35 s squirt at 3 m: a flick of the branch
  // was nearly a person on the floor, which is an accident, not a decision.
  tip: 80, leak: 1.0,
  // The jet's push, N, at the branch and how it falls off: full to `near` m,
  // nothing past `far`. A 9.2 L/s branch at 23 m/s carries ρQv = 212 N of
  // momentum out of the nozzle; what lands on a body a few metres off is less,
  // the jet broken up and spread. 150 N is a hard shove held on you, which is
  // what a hose on somebody sitting down is.
  force: 150, near: 2.0, far: 10.0,
  // And once they are a ragdoll, more of it: the same water on a body that has
  // stopped holding on to anything. A multiplier on `force`.
  liveGain: 1.6,
  // Muscle tone (RAGDOLL's tension): held when the water gets them, let go
  // over `brace` s — a brace, and then gone — and on the ground.
  hold: 0.9, limp: 0.14, brace: 0.5, ground: 0.12,
  // ON THE GROUND AND STILL BEING HOSED (1.554.2). Misha, 30 Sep 2026: *"why
  // they wrythe so much?"* MEASURED, the jet held on somebody lying down: a
  // mean of 52 to 95 J in them, peaks of 400 to 565, the fastest body 8.5
  // m/s, and once flung 4 m along the terrace — the whole 240 N (`force` ×
  // `liveGain`) put on whichever two or three bodies were nearest the jet's
  // line, which on a forearm alone is 170 m/s². Now, once they are down,
  // the water pushes no harder than it would push `catchKg` of body (a
  // forearm in it alone takes its own share of that, not the whole jet), at
  // `downGain` of `force`, and they curl up against it (`wetTone`, toward the pose
  // they were in when it got them — sitting, which on the ground is curled),
  // and let go again when it stops. Not at all before they land: the fall
  // off the chair is what it was.
  catchKg: 20, downGain: 1.0, wetTone: 0.3,
  // A beat on the ground, s, before they roll over or get up.
  downMin: 0.7,
  // THE CONTACTS THAT CANNOT LET GO — (l) in 43-avbd.js. The body against
  // itself (`pairK`) and the chair against the body (`boxK`), N/m: springs,
  // not hard rows. MEASURED hard, lying still: an upper arm 4.6 cm into the
  // belly with the shoulder holding it there, 1,400 N on that contact
  // climbing to 8,000 in two seconds; the chair's seat across the legs,
  // 2,500 N to 16,600 in three. Every one of the writhes was that: the arms
  // at the 40 rad/s ceiling, the get-up only ever reached through `restMax`,
  // and the roll-over failing and trying again (three tries in four of
  // twelve knocks, and five of the twelve got up off their backs). As springs that arm is a steady 230 N and the chair 270,
  // nothing turns faster than 10 rad/s a second after they land, and one
  // roll does it. 5000 is a forearm's weight on the chest in 3 mm; 20000 the
  // chair's on a leg in 1.5.
  pairK: 5000, boxK: 20000,
  // The bodies the push goes to: by distance from the jet's line, m.
  spread: 0.30,
  // Air, 1/s, and the solver's speed caps (m/s, rad/s).
  drag: 0.08, vMax: 9, wMax: 40,
  // Landed: pelvis this near the floor, m. Still: nothing faster than `rest`
  // m/s for `restFor` s with no water on them — or `restMax` s dry, whatever
  // is still moving: MEASURED, somebody lying with the chair across their
  // legs read 2.5 m/s for good, a hand and the seat arguing, and never got
  // up. `stuck` s still and NOT down — on the chair still, or over it — is a
  // reseat.
  landed: 0.34, rest: 0.18, restFor: 0.6, stuck: 1.4, restMax: 2.5,
  // Rolling over off their back: spin rad/s about the spine, tone meanwhile,
  // tries before giving up and easing into the get-up from there.
  // MEASURED on four knocked flat on their backs at once: at 6.5 rad/s and
  // two tries, three of the four were still face up at the get-up; at 9 to
  // 12, one in four, whichever way it was sent — the arm it rolls toward is
  // what stops it. So a third try goes the other way.
  // MEASURED again once the stuck contacts were springs (1.554.2, `pairK`),
  // on the café's own knocks and the jet: at 10, 70 % over on the first try
  // and two in eighteen still face up after three; at 12.5, 31 of 36 on the
  // first; and with the second try the other way (`rollFlip`, the try from
  // which they alternate), none of 24 left face up. A roll that fails and
  // tries again IS the writhe, so the first one has to count.
  roll: 12.5, rollLift: 0.6, rollTone: 0.45, rolls: 3, rollFor: 1.2, rollFlip: 1,
  // Easing into `getup`'s first frame, s, and back into the chair.
  upFade: 0.75, reseatFade: 0.7,
  // The chair: whether it goes over with them at all, the seat's and the
  // backrest's mass, kg (a moulded monobloc is 2.5 to 3 of it), and the feet's
  // radius, m.
  chair: { on: true, seat: 1.9, back: 0.9, foot: 0.02 },
  // The guard: nothing further than `far` m from where they sat, nothing
  // faster than `fast` m/s, no socket open more than `open` m. Wrong, back to
  // the state of `snapEvery`×2 s ago, cold; three times in four seconds and
  // they are taken off the ragdoll (`bail`) and eased into the get-up.
  guardFar: 6, guardFast: 14, guardOpen: 0.06, snapEvery: 0.25,
};

/** The capsule pairs a body meets itself with — the settle's list (43-settle.js). */
function toppleCapPairs(rag) {
  const by = new Map(rag.capsOf().map((c) => [c.bone, c.cp]));
  const cp = (n) => by.get(n) || [];
  const pairs = [];
  const meet = (A, Bs) => { for (const a of cp(A)) for (const n of Bs) for (const b of cp(n)) pairs.push(a, b); };
  for (const s of ['L', 'R']) {
    meet('armL' + s, ['pelvis', 'spine02', 'chest', 'legUL', 'legUR', 'legLL', 'legLR']);
    meet('armU' + s, ['pelvis', 'spine02', 'legUL', 'legUR']);
  }
  meet('armLL', ['armLR']);
  meet('legUL', ['legUR']);
  meet('legLL', ['legLR', 'legUR']);
  meet('legLR', ['legUL']);
  return pairs;
}

function makeToppler(o) {
  const geoOf = o.geoOf, event = o.event || (() => {});
  const pools = new Map();          // f.data → [slot]
  const liveSet = new Set();        // fg with a slot
  const O = new THREE.Vector3(), I = new THREE.Quaternion();
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0);
  const _P = new THREE.Vector3(), _Q = new THREE.Quaternion();
  const up0 = { q: null, t: new Float32Array(3) };
  let clock = 0;
  const stats = { knocked: 0, live: 0, liveMax: 0, steps: 0, ms: 0, msMax: 0, frameMs: 0, frameMax: 0,
    frames: 0, builds: 0, buildMax: 0, rescues: 0, bails: 0, rolls: 0, ups: 0, reseats: 0, landed: 0,
    faceUp: 0, faceDown: 0, capped: 0, per: [] };

  /** A net for body kind `f.data` nobody is using, built if there is none. */
  function slotFor(f) {
    let L = pools.get(f.data);
    if (!L) pools.set(f.data, L = []);
    for (const s of L) if (!s.fg) return s;
    const b0 = performance.now();
    const caps = settleCaps(f);
    const net = avbdNet({
      maxBodies: 16, maxJoints: 16, maxStrings: 1, maxPoints: 10, maxBoxes: 2, maxCaps: caps.length + 1,
      maxContacts: 400, maxAngles: 16, maxWorldBoxes: 8, maxCapPairs: 96, limK: RAGDOLL.limK,
      iterations: KNOCK.iterations, alpha: 0.9, alphaContact: 0.9, beta: 1e5, betaAng: 100, gamma: 0.999,
      gravity: [0, -9.81, 0], drag: KNOCK.drag, vMax: KNOCK.vMax, wMax: KNOCK.wMax, margin: 0.01, deep: 0.03,
      mu: 0.7, floorMu: 0.8, capK: 30000, pointsHitCaps: false, pairK: KNOCK.pairK, boxK: KNOCK.boxK,
    });
    // THE CHAIR, which goes over with them — see `KNOCK.chair`. Two bodies
    // welded, the seat and the backrest, each the settle's own box for it,
    // and the four feet as points on the floor. Asleep until somebody who is
    // sitting on one is knocked, and sized when they are (`chairOn`).
    const C = KNOCK.chair;
    const seat = net.addBody(C.seat, [0.01, 0.01, 0.01, 0, 0, 0], 0, -100, 0);
    const back = net.addBody(C.back, [0.01, 0.01, 0.01, 0, 0, 0], 0, -100, 0);
    const bxSeat = net.addBox(seat, 0.24, 0.03, 0.23), bxBack = net.addBox(back, 0.24, 0.2, 0.03);
    // A box meets people and not the floor, so what of the chair can land is
    // points: the feet, the seat's corners, the top of the backrest's —
    // MEASURED without the last six, a chair tipped over backwards went down
    // through the terrace on its back.
    const feet = [0, 1, 2, 3].map(() => net.addPoint(seat, 0, 0, 0, C.foot));
    const rims = [0, 1, 2, 3].map(() => net.addPoint(seat, 0, 0, 0, C.foot));
    const tops = [0, 1].map(() => net.addPoint(back, 0, 0, 0, C.foot));
    const weld = net.addJoint(seat, [0, 0, 0], back, [0, 0, 0], Infinity, Infinity, 0.3);
    for (const b of [seat, back]) { net.setLive(b, false); net.drag[b] = KNOCK.drag; }
    const rag = ragdollBuild(net, f, caps, { idBase: 1 });
    for (const b of rag.bodies) net.drag[b] = KNOCK.drag;
    const pairs = toppleCapPairs(rag);
    net.setCapPairs(pairs, pairs.length / 2);
    const nb = f.bones.length;
    const s = { net, rag, fg: null, f: null, nb, chair: { seat, back, bxSeat, bxBack, feet, rims, tops, weld, on: false,
      q0: new THREE.Quaternion() },
      snaps: [0, 1, 2].map(() => ({ P: new Float64Array(net.P.length), Q: new Float64Array(net.Q.length), ok: false })),
      snapT: 0, trips: [] };
    L.push(s);
    const ms = performance.now() - b0;
    stats.builds++;
    stats.buildMax = Math.max(stats.buildMax, ms);
    return s;
  }

  /** World → the person's figure frame (a direction when `dir`). */
  function toFig(fg, w, out, dir = false) {
    const k = 1 / (fg.hscale || 1), c = Math.cos(fg.yaw), sn = Math.sin(fg.yaw);
    const dx = dir ? w[0] : w[0] - fg.x, dy = dir ? w[1] : w[1] - fg.y, dz = dir ? w[2] : w[2] - fg.z;
    out[0] = (dx * c - dz * sn) * k; out[1] = dy * k; out[2] = (dx * sn + dz * c) * k;
    return out;
  }
  /** The figure frame → world (a point). */
  function toWorld(fg, p, out) {
    const k = fg.hscale || 1, c = Math.cos(fg.yaw), sn = Math.sin(fg.yaw);
    out[0] = fg.x + (p[0] * c + p[2] * sn) * k; out[1] = fg.y + p[1] * k; out[2] = fg.z + (-p[0] * sn + p[2] * c) * k;
    return out;
  }

  function state(fg) {
    let X = fg.topple;
    if (!X) {
      X = fg.topple = { phase: 'wet', J: 0, jAt: clock, F: [0, 0, 0], at: [0, 0, 0], dir: [0, 0, 0], fT: 0,
        hits: 0, dry: 0, sp: 0, slot: null, pose: null, t: 0, rest: 0, still: 0, landed: false, rolls: 0, rollT: 0,
        acc: 0, fade: 0, up: null, seat: { x: fg.x, y: fg.y, z: fg.z, yaw: fg.yaw } };
    }
    return X;
  }

  const _w = [0, 0, 0], _d = [0, 0, 0];
  function push(fg, f, F, at, dt) {
    const X = state(fg);
    if (X.phase === 'wet') {
      // The sum, leaking — see `KNOCK.tip`.
      const gone = Math.max(0, clock - X.jAt);
      X.J *= Math.exp(-gone / KNOCK.leak);
      X.jAt = clock;
      if (X.J < 1 && X.hits > 0) X.hits = 0;
      if (!X.hits) event(fg, 'wet', null);
      X.hits++;
      X.J += Math.hypot(F[0], F[1], F[2]) * dt;
      if (X.J >= KNOCK.tip) {
        if (liveSet.size >= KNOCK.cap) { stats.capped++; X.J = KNOCK.tip * 0.9; return X.phase; }
        if (!goLive(fg, f)) return X.phase;
      } else return X.phase;
    }
    if (X.phase !== 'live') return X.phase;
    // Held on a body that has let go: more of it, along the jet's line —
    // and on one lying down, less (`downGain`).
    toFig(fg, F, _d, true);
    const g = (X.landed ? KNOCK.downGain : KNOCK.liveGain) / (fg.hscale || 1);
    X.F[0] = _d[0] * g; X.F[1] = _d[1] * g; X.F[2] = _d[2] * g;
    toFig(fg, at, X.at);
    const l = Math.hypot(_d[0], _d[1], _d[2]) || 1;
    X.dir[0] = _d[0] / l; X.dir[1] = _d[1] / l; X.dir[2] = _d[2] / l;
    X.fT = 0.12;               // held over the frames a trace misses
    return X.phase;
  }

  function knock(fg, f, J, at) {
    const X = state(fg);
    if (X.phase !== 'wet' && X.phase !== 'live') return false;
    if (X.phase === 'wet' && !goLive(fg, f)) return false;
    const s = X.slot, { net, rag } = s;
    toFig(fg, J, _d, true);
    toFig(fg, at || [fg.x, fg.y + 1.0, fg.z], X.at);
    const l = Math.hypot(_d[0], _d[1], _d[2]) || 1;
    X.dir[0] = _d[0] / l; X.dir[1] = _d[1] / l; X.dir[2] = _d[2] / l;
    const w = weights(s, X);
    rag.bodies.forEach((b, k) => {
      if (!w[k]) return;
      const m = net.mass[b];
      net.kick(b, _d[0] * w[k] / m, _d[1] * w[k] / m, _d[2] * w[k] / m);
    });
    return true;
  }

  /**
   * How the push is shared: each body by its distance from the jet's line,
   * over at least `minKg` of body — what the water can push is what it
   * catches, so two bodies near its line do not take all of it between them.
   */
  function weights(s, X, minKg = 0) {
    const { net, rag } = s, P = net.P;
    const w = s.w || (s.w = new Float64Array(rag.bodies.length));
    let sum = 0;
    rag.bodies.forEach((b, k) => {
      const rx = P[3 * b] - X.at[0], ry = P[3 * b + 1] - X.at[1], rz = P[3 * b + 2] - X.at[2];
      const along = rx * X.dir[0] + ry * X.dir[1] + rz * X.dir[2];
      const d2 = rx * rx + ry * ry + rz * rz - along * along;
      w[k] = Math.exp(-Math.max(0, d2) / (KNOCK.spread * KNOCK.spread)) * net.mass[b];
      sum += w[k];
    });
    // Nothing near the line (the catch is a fan a metre wide): the trunk.
    if (sum < 1e-6) {
      rag.bodies.forEach((b, k) => { w[k] = b === rag.body('chest') || b === rag.body('spine02') ? 1 : 0; });
      sum = 2;
    }
    sum = Math.max(sum, minKg);
    for (let k = 0; k < w.length; k++) w[k] /= sum;
    return w;
  }

  function goLive(fg, f) {
    const X = state(fg);
    const g = geoOf(fg);
    if (!g) return false;
    const s = slotFor(f);
    const { net, rag } = s;
    s.fg = fg; s.f = f;
    X.slot = s;
    liveSet.add(fg);
    stats.knocked++;
    stats.live = liveSet.size;
    stats.liveMax = Math.max(stats.liveMax, liveSet.size);
    // Off everything that was laid over the clip: the settle, the solved
    // hands and the legs on the concrete. The ragdoll is taken from the
    // figure AS DRAWN, which has all three in it, and nothing but the
    // ragdoll writes them from here.
    if (f.sitL && f.sitL.on) { f.settle(null); f.sitL.on = false; f.sitL.who = null; }
    if (f.legsOn && f.legs) { f.legs(null); f.legsOn = false; }
    net.resetDuals();
    // The chair as a body, if the caller says which of its boxes are the
    // chair — and then they are not the world's any more.
    const nch = g.chair && KNOCK.chair.on ? chairOn(s, g) : 0;
    net.setWorldBoxes(g.boxes.slice(7 * nch), g.boxes.length / 7 - nch);
    X.chair = nch > 0;
    const fy = g.floor;
    X.floor = typeof fy === 'function' ? fy : () => fy;
    net.setFloor(X.floor);
    // Moving already, if the caller says so — `g.v` (m/s) and `g.w` (rad/s,
    // about `g.c`), figure frame: a rider taken over at the speed their
    // machine was doing (1.550.0), which is most of what makes it a crash.
    rag.enter(f, O, I, g.v || null, g.v ? g.w || [0, 0, 0] : null, g.v ? g.c || [0, 0, 0] : null);
    for (const b of rag.bodies) net.drag[b] = KNOCK.drag;
    const nb = f.bones.length;
    X.pose = { q: new Float32Array(nb * 4), t: new Float32Array(3), w: 1,
      clip: { q: new Float32Array(nb * 4), t: new Float32Array(3) } };
    const L = f.local();
    X.pose.clip.q.set(L.q); X.pose.clip.t.set(L.t.subarray(0, 3));
    rag.write(X.pose, O, I, X.pose.clip.q);
    // The hands' last solve off the mesh: an `aim` outlives the pose it was
    // laid on, and after the get-up these arms are somebody standing.
    for (const b of f.bones) if (/^(arm|hand|finger|thumb|spine01|chest|head|neck)/.test(b.name)) f.aim(b.name, 0, 1, 0, 0);
    fg.aimed = false;
    f.manual(X.pose);
    X.phase = 'live'; X.t = 0; X.dry = 0; X.rest = 0; X.still = 0; X.landed = false; X.landT = 0; X.rolls = 0; X.rollT = 0; X.acc = 0;
    s.snapT = 0; s.trips = []; for (const sn of s.snaps) sn.ok = false;
    rag.tension(KNOCK.hold);
    event(fg, 'live', null);
    return true;
  }

  /**
   * The seat and the backrest from the first two of `g.boxes` (figure frame,
   * seven numbers a box), welded where they stand, feet on the floor under
   * the seat's corners. Returns how many boxes it took.
   */
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
  function chairOn(s, g) {
    const { net } = s, C = s.chair, B = g.boxes;
    const fl = typeof g.floor === 'function' ? g.floor : () => g.floor;
    const put = (b, o, bx) => {
      _qa.setFromAxisAngle(_Y, B[o + 6]);
      net.setLive(b, true);
      net.place(b, B[o], B[o + 1], B[o + 2], [_qa.x, _qa.y, _qa.z, _qa.w]);
      net.setBox(bx, B[o + 3], B[o + 4], B[o + 5]);
      const m = net.mass[b], hx = B[o + 3], hy = B[o + 4], hz = B[o + 5];
      net.inert[6 * b] = m * (hy * hy + hz * hz) / 3; net.inert[6 * b + 1] = m * (hx * hx + hz * hz) / 3;
      net.inert[6 * b + 2] = m * (hx * hx + hy * hy) / 3;
      net.inert[6 * b + 3] = net.inert[6 * b + 4] = net.inert[6 * b + 5] = 0;
    };
    put(C.seat, 0, C.bxSeat);
    put(C.back, 7, C.bxBack);
    // The weld: the backrest's middle in the seat's frame.
    _v.set(B[7] - B[0], B[8] - B[1], B[9] - B[2]).applyQuaternion(_qa.setFromAxisAngle(_Y, B[6]).invert());
    net.setJointArms(C.weld, [_v.x, _v.y, _v.z], [0, 0, 0]);
    // Feet: under the seat's corners, a little in, on the floor.
    const h = B[1] - fl(B[0], B[2]), r = KNOCK.chair.foot;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c], k) => {
      net.setPoint(C.feet[k], a * (B[3] - 0.05), -h + r, c * (B[5] - 0.06));
      net.setPoint(C.rims[k], a * (B[3] - r), 0, c * (B[5] - r));
    });
    [-1, 1].forEach((a, k) => net.setPoint(C.tops[k], a * (B[10] - r), B[11] - r, 0));
    _qa.setFromAxisAngle(_Y, B[6]);
    C.q0.copy(_qa);
    C.p0 = [B[0], B[1], B[2]];
    C.on = true;
    return 2;
  }
  /** Where the seat is now, world, and its turn off where it started. */
  function chairPose(fg, s, outP, outQ) {
    const { net } = s, C = s.chair, b = C.seat;
    const w = toWorld(fg, [net.P[3 * b], net.P[3 * b + 1], net.P[3 * b + 2]], [0, 0, 0]);
    outP.set(w[0], w[1], w[2]);
    _qb.set(net.Q[4 * b], net.Q[4 * b + 1], net.Q[4 * b + 2], net.Q[4 * b + 3]);
    // World turn = R(yaw)·q, and the drawn chair is posed off its rest:
    // R(yaw)·q·q0⁻¹·R(yaw)⁻¹ about the seat.
    _qa.setFromAxisAngle(_Y, fg.yaw);
    outQ.copy(_qa).multiply(_qb).multiply(C.q0.clone().invert()).multiply(_qa.clone().invert());
    return true;
  }
  const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion();

  function free(fg) {
    const X = fg.topple;
    if (!X || !X.slot) return;
    if (X.slot.chair.on) {
      for (const b of [X.slot.chair.seat, X.slot.chair.back]) X.slot.net.setLive(b, false);
      X.slot.chair.on = false;
    }
    X.slot.rag.leave();
    X.slot.net.setWorldBoxes(null, 0);
    X.slot.fg = null; X.slot.f = null;
    X.slot = null;
    liveSet.delete(fg);
    stats.live = liveSet.size;
  }

  // ── the guard (the hammock's, 43-hammock.js) ────────────────────────────
  function sane(s) {
    const { net, rag } = s, P = net.P, V = net.V;
    const R2 = KNOCK.guardFar * KNOCK.guardFar, V2 = KNOCK.guardFast * KNOCK.guardFast;
    for (const b of rag.bodies) {
      const x = P[3 * b], y = P[3 * b + 1], z = P[3 * b + 2];
      if (!Number.isFinite(x + y + z)) return false;
      if (x * x + y * y + z * z > R2) return false;
      if (V[3 * b] ** 2 + V[3 * b + 1] ** 2 + V[3 * b + 2] ** 2 > V2) return false;
    }
    net.measure();
    return !(net.stats.maxLoose >= KNOCK.guardOpen);
  }
  function wrong(fg, s) {
    stats.rescues++;
    const X = fg.topple;
    s.trips = s.trips.filter((t) => X.t - t < 4);
    s.trips.push(X.t);
    const old = s.snaps.find((sn) => sn.ok);
    if (s.trips.length < 3 && old) {
      const { net } = s;
      for (let b = 0; b < net.nb; b++) {
        net.place(b, old.P[3 * b], old.P[3 * b + 1], old.P[3 * b + 2],
          [old.Q[4 * b], old.Q[4 * b + 1], old.Q[4 * b + 2], old.Q[4 * b + 3]]);
      }
      net.resetDuals();
      for (const sn of s.snaps) sn.ok = false;
      return true;
    }
    stats.bails++;
    return false;
  }
  function snap(s, h) {
    s.snapT += h;
    if (s.snapT < KNOCK.snapEvery) return;
    s.snapT = 0;
    const sn = s.snaps.shift();
    sn.P.set(s.net.P); sn.Q.set(s.net.Q); sn.ok = true;
    s.snaps.push(sn);
  }

  /** One live person's frame: the steps, the guard, the pose back. */
  function stepLive(fg, f, dt) {
    const X = fg.topple, s = X.slot, { net, rag } = s;
    const t0 = performance.now();
    X.acc = Math.min(X.acc + dt, KNOCK.maxSteps * KNOCK.h);
    let n = 0;
    let bail = false;
    while (X.acc >= KNOCK.h - 1e-9 && n < KNOCK.maxSteps) {
      X.acc -= KNOCK.h; n++;
      X.t += KNOCK.h;
      // The tone: braced, then gone; on the ground, a rag, or curled up while
      // the water is still on them; rolling, held.
      let k;
      if (X.rollT > 0) { k = KNOCK.rollTone; X.rollT -= KNOCK.h; } else if (X.landed) k = X.fT > 0 ? KNOCK.wetTone : KNOCK.ground;
      else {
        const u = Math.min(1, X.t / KNOCK.brace);
        k = KNOCK.hold + (KNOCK.limp - KNOCK.hold) * u * u * (3 - 2 * u);
      }
      if (Math.abs(k - rag.tens) > 1e-3) rag.tension(k);
      // The water, on the bodies along its line.
      if (X.fT > 0) {
        X.fT -= KNOCK.h;
        const w = weights(s, X, X.landed ? KNOCK.catchKg : 0);
        rag.bodies.forEach((b, j) => {
          if (!w[j]) return;
          const m = net.mass[b], q = w[j] * KNOCK.h / m;
          net.kick(b, X.F[0] * q, X.F[1] * q, X.F[2] * q);
        });
      }
      net.step(KNOCK.h);
      stats.steps++;
      if (!sane(s)) { if (!wrong(fg, s)) { bail = true; break; } } else snap(s, KNOCK.h);
    }
    const ms = performance.now() - t0;
    stats.ms += ms; stats.msMax = Math.max(stats.msMax, ms);
    if (bail) { event(fg, 'bail', null); upStart(fg, f, true); return; }
    if (KNOCK.trace) trace(fg, s, X);
    rag.write(X.pose, O, I, X.pose.clip.q);
    X.pose.w = 1;
    if (X.chair && s.chair.on && o.chair) { chairPose(fg, s, _cp, _cq); o.chair(fg, _cp, _cq); }
    // Down, still, stuck.
    const pv = rag.headWorld(f.boneIndex('pelvis'));
    const hy = pv[1] - X.floor(pv[0], pv[2]);
    if (!X.landed && hy < KNOCK.landed) { X.landed = true; X.landT = X.t; stats.landed++; event(fg, 'down', null); }
    const sp = rag.speed();
    const wet = X.fT > 0;
    X.rest = !wet && sp < KNOCK.rest ? X.rest + dt : 0;
    X.dry = wet ? 0 : X.dry + dt;
    X.sp = sp;
    if (X.rollT > 0) return;
    // Still — or, a limb twitching on for ever against something, dry for
    // long enough that it is still for every purpose that matters.
    const still = X.rest > KNOCK.restFor || X.dry > KNOCK.restMax;
    if (X.landed && still && X.t - X.landT >= KNOCK.downMin) {
      // On their back: over on to their front, by themselves, first.
      if (rag.faceUp() > 0.15 && X.rolls < KNOCK.rolls) { rollOver(fg, f, s); return; }
      upStart(fg, f, false);
    } else if (!X.landed && (X.rest > KNOCK.stuck || X.dry > KNOCK.restMax)) reseat(fg, f);
  }

  /**
   * A probe's record of one live person's frame, while `KNOCK.trace` is an
   * array (`__fr.jad.raw().crowd.topple.cfg().KNOCK.trace = []`): what they
   * are doing, their kinetic energy (J, moving and turning), the fastest
   * body and the fastest-turning one, the chair's energy, and the deepest
   * capsule pair and the hardest-pressed contact — which is how the stuck
   * rows of (l) in 43-avbd.js were found. Nothing while it is not.
   */
  function trace(fg, s, X) {
    const { net, rag } = s, V = net.V, Wv = net.W, Q = net.Q, M = net.inert;
    const names = s.names || (s.names = rag.capsOf().map((c) => c.bone));
    let ke = 0, kr = 0, vm = 0, wm = 0, wb = 0;
    rag.bodies.forEach((b, j) => {
      const m = net.mass[b], o3 = 3 * b;
      const v2 = V[o3] ** 2 + V[o3 + 1] ** 2 + V[o3 + 2] ** 2;
      ke += 0.5 * m * v2; vm = Math.max(vm, Math.sqrt(v2));
      _q.set(-Q[4 * b], -Q[4 * b + 1], -Q[4 * b + 2], Q[4 * b + 3]);
      _v.set(Wv[o3], Wv[o3 + 1], Wv[o3 + 2]).applyQuaternion(_q);
      const I = 6 * b, x = _v.x, y = _v.y, z = _v.z;
      kr += 0.5 * (M[I] * x * x + M[I + 1] * y * y + M[I + 2] * z * z
        + 2 * (M[I + 3] * x * y + M[I + 4] * x * z + M[I + 5] * y * z));
      const w = Math.hypot(x, y, z);
      if (w > wm) { wm = w; wb = j; }
    });
    let kc = 0, pg = 0, pf = 0, ff = 0;
    if (s.chair.on) for (const b of [s.chair.seat, s.chair.back]) kc += 0.5 * net.mass[b] * (V[3 * b] ** 2 + V[3 * b + 1] ** 2 + V[3 * b + 2] ** 2);
    net.eachContact((a, b, gap, fn, pair) => {
      if (pair) { pg = Math.min(pg, gap); pf = Math.max(pf, fn); } else ff = Math.max(ff, fn);
    });
    const T = KNOCK.trace;
    if (T.length < 40000) T.push({ id: fg.idx, t: +X.t.toFixed(3), landed: X.landed ? 1 : 0, roll: X.rollT > 0 ? 1 : 0,
      wet: X.fT > 0 ? 1 : 0, k: +rag.tens.toFixed(2), ke: +ke.toFixed(3), kr: +kr.toFixed(3), v: +vm.toFixed(3),
      w: +wm.toFixed(2), wb: names[wb], at: [+net.P[3 * rag.pelvis].toFixed(2), +net.P[3 * rag.pelvis + 2].toFixed(2)], kc: +kc.toFixed(3), pg: +pg.toFixed(3), pf: Math.round(pf), ff: Math.round(ff) });
  }

  /** A spin about the spine, pelvis to chest, the way a body rolls itself over. */
  function rollOver(fg, f, s) {
    const X = fg.topple, { net, rag } = s, P = net.P;
    // And the muscles aimed at all fours — `getup`'s first frame, which is
    // where this is going — so the knees and elbows come in under the body
    // that is turning over them rather than lying out as levers against it.
    if (f.clips.includes('getup')) {
      if (!up0.q || up0.q.length !== f.bones.length * 4) up0.q = new Float32Array(f.bones.length * 4);
      f.sample('getup', 0, up0.q, up0.t);
      rag.drive(up0.q);
    }
    const a = rag.pelvis, c = rag.body('chest');
    let ax = P[3 * c] - P[3 * a], ay = P[3 * c + 1] - P[3 * a + 1], az = P[3 * c + 2] - P[3 * a + 2];
    const l = Math.hypot(ax, ay, az) || 1;
    ax /= l; ay /= l; az /= l;
    // Which way: toward the side the body already leans to, so the arm on
    // that side is not rolled over. The chest's +z is the figure's right.
    _v.set(0, 0, 1).applyQuaternion(_q.set(net.Q[4 * c], net.Q[4 * c + 1], net.Q[4 * c + 2], net.Q[4 * c + 3]));
    const sg = (_v.y > 0 ? 1 : -1) * (X.rolls >= KNOCK.rollFlip && (X.rolls - KNOCK.rollFlip) % 2 === 0 ? -1 : 1);
    const om = KNOCK.roll * sg;
    const cx = (P[3 * a] + P[3 * c]) / 2, cy = (P[3 * a + 1] + P[3 * c + 1]) / 2, cz = (P[3 * a + 2] + P[3 * c + 2]) / 2;
    for (const b of rag.bodies) {
      const rx = P[3 * b] - cx, ry = P[3 * b + 1] - cy, rz = P[3 * b + 2] - cz;
      const wx = ax * om, wy = ay * om, wz = az * om;
      net.kick(b, wy * rz - wz * ry, wz * rx - wx * rz + KNOCK.rollLift, wx * ry - wy * rx);
      net.W[3 * b] += wx; net.W[3 * b + 1] += wy; net.W[3 * b + 2] += wz;
    }
    X.rolls++; X.rollT = KNOCK.rollFor; X.rest = 0; X.dry = 0;
    stats.rolls++;
  }

  /** Still on the ground: into `getup` from where they lie. */
  function upStart(fg, f, bailed) {
    const X = fg.topple, s = X.slot, rag = s.rag;
    const clip = f.clips.includes('getup') ? 'getup' : null;
    if (!clip) { reseat(fg, f); return; }
    if (rag.faceUp() > 0) stats.faceUp++; else stats.faceDown++;
    if (!up0.q || up0.q.length !== f.bones.length * 4) up0.q = new Float32Array(f.bones.length * 4);
    f.sample(clip, 0, up0.q, up0.t);
    const g = rag.groundFrame(up0.q, up0.t, X.floor);
    _P.set(g[0], g[1], g[2]);
    _Q.setFromAxisAngle(_Y, g[3]);
    // The ragdoll's pose, in the frame the get-up will be drawn in.
    rag.write(X.pose, _P, _Q, X.pose.clip.q);
    X.pose.w = 1;
    // Where that is in the world.
    const wp = toWorld(fg, [g[0], g[1], g[2]], [0, 0, 0]);
    X.up = { x: wp[0], y: wp[1], z: wp[2], yaw: fg.yaw + g[3], fade: KNOCK.upFade * (bailed || rag.faceUp() > 0 ? 1.6 : 1),
      // Drawn at their own stature: the ground frame is in figure units, so
      // somebody who is not 1 (the mole's, 1.550.0) is placed at it.
      k: fg.hscale || 1 };
    X.up.fade0 = X.up.fade;
    free(fg);
    f.play(clip, { fade: 0, next: 'idle' });
    f.state.speed = 0;
    X.phase = 'up';
    stats.ups++;
    if (stats.per.length < 32) stats.per.push({ idx: fg.idx, t: +X.t.toFixed(2), rolls: X.rolls, bailed: !!bailed,
      at: [+g[0].toFixed(2), +g[2].toFixed(2)] });
  }

  /** Never got off it: back into the chair, from however they are over it. */
  function reseat(fg, f) {
    const X = fg.topple;
    free(fg);
    X.phase = 'reseat';
    X.fade = KNOCK.reseatFade;
    stats.reseats++;
    event(fg, 'reseat', null);
  }

  function placeAt(f, x, y, z, yaw, k) {
    f.mesh.position.set(x, y, z);
    f.mesh.rotation.set(0, yaw, 0);
    f.mesh.scale.setScalar(k);
    f.mesh.updateMatrixWorld();
  }

  function draw(fg, f, dt) {
    const X = fg.topple;
    if (!X) return false;
    switch (X.phase) {
      case 'live': {
        placeAt(f, fg.x, fg.y, fg.z, fg.yaw, fg.hscale || 1);
        stepLive(fg, f, dt);
        if (X.phase === 'live') f.update(dt);
        else if (X.phase === 'up') { placeUp(f, X); f.update(0); } else return false;
        return true;
      }
      case 'up': {
        placeUp(f, X);
        const S = f.state;
        if (X.up.fade > 0) {
          X.up.fade = Math.max(0, X.up.fade - dt);
          const u = X.up.fade / X.up.fade0;
          X.pose.w = u * u * (3 - 2 * u);
          S.speed = 0;
          if (X.up.fade <= 0) { f.manual(null); S.speed = 1; }
          f.update(dt);
          return true;
        }
        f.update(dt);
        if (f.playing() === 'getup') return true;
        // Standing: where the pelvis is, facing the way the clip ended.
        f.boneAt(f.boneIndex('pelvis'), _v);
        _v.applyMatrix4(f.mesh.matrixWorld);
        X.phase = 'away';
        event(fg, 'up', { x: _v.x, y: X.up.y, z: _v.z, yaw: X.up.yaw });
        return true;
      }
      case 'reseat': {
        // The crowd draws them in their chair again; this eases the ragdoll's
        // last pose off over the top of it.
        X.fade = Math.max(0, X.fade - dt);
        const u = X.fade / KNOCK.reseatFade;
        X.pose.w = u * u * (3 - 2 * u);
        if (X.fade <= 0) { f.manual(null); fg.topple = null; }
        return false;
      }
      default:
        // A phase the caller made (`handOff`): theirs to draw, if they say so.
        return o.draw ? !!o.draw(fg, f, dt) : false;
    }
  }
  function placeUp(f, X) { placeAt(f, X.up.x, X.up.y, X.up.z, X.up.yaw, X.up.k || 1); }

  /**
   * OFF THE RAGDOLL AND INTO THE CALLER'S HANDS, mid-flight — the mole's sea
   * (1.550.0, `DUNK` in 43-jadrija.js): somebody hosed off the edge is a
   * ragdoll until they reach the water, and a swimmer from there, which is
   * nothing this file knows how to draw. The ragdoll's pose is written into
   * the frame the caller will draw them in (`at`, world, with their yaw) and
   * left on the figure at full weight (`fg.topple.pose`, `w` 1) for the
   * caller to ease off; the net is freed; the phase is the caller's name for
   * it, and `draw` hands every frame of it to `o.draw`.
   */
  const _hw = [0, 0, 0];
  function handOff(fg, f, phase, at) {
    const X = fg && fg.topple;
    if (!X || X.phase !== 'live' || !X.slot) return false;
    toFig(fg, [at.x, at.y, at.z], _hw);
    _P.set(_hw[0], _hw[1], _hw[2]);
    _Q.setFromAxisAngle(_Y, at.yaw - fg.yaw);
    X.slot.rag.write(X.pose, _P, _Q, X.pose.clip.q);
    X.pose.w = 1;
    free(fg);
    X.phase = phase;
    return true;
  }

  return {
    push, knock, draw, handOff,
    /** The world clock the leak is measured on — once a frame, from the crowd. */
    tick(dt) {
      clock += dt;
      if (liveSet.size) {
        stats.frames++;
      }
    },
    live: (fg) => (fg && fg.topple ? fg.topple.phase : null),
    /** Where their pelvis is in the world, while they are a ragdoll. */
    where(fg) {
      const X = fg && fg.topple;
      if (!X || !X.slot) return null;
      const p = X.slot.rag.headWorld(X.slot.f.boneIndex('pelvis'));
      return toWorld(fg, [p[0], p[1], p[2]], [0, 0, 0]);
    },
    /** Let go of whoever this is, whatever they were doing (a probe, a teardown). */
    release(fg, f) {
      if (!fg || !fg.topple) return;
      free(fg);
      if (f) f.manual(null);
      fg.topple = null;
    },
    stats: () => ({ ...stats, pools: [...pools.values()].reduce((n, L) => n + L.length, 0), clock: +clock.toFixed(2) }),
    list: () => [...liveSet].map((fg) => ({ idx: fg.idx, seat: fg.seat, phase: fg.topple.phase,
      t: +fg.topple.t.toFixed(2), landed: fg.topple.landed, rolls: fg.topple.rolls })),
    cfg: () => KNOCK,
  };
}
