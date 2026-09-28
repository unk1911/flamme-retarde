// -----------------------------------------------------------------------------
// SITTERS WHO HAVE SAT DOWN — a ragdoll's settle into a chair, done once and
// kept.
//
// Misha, 27 Sep 2026, after Baye went into the hammock as a ragdoll (1.536.0):
// *"the ragdoll looks amazing! we should utilize ragdoll concept in other
// places too, it makes her look more natural/less robotic ... maybe even for
// the bathers when they sit at the cafes and stuff, maybe they can be more
// ragdolly and thus appear even more natural"*.
//
// A café sitter was a clip: one of six seated loops solved against a 0.46 m
// chair (see `sit_clips` in tools/blender/bathers_mh.py), the same pose to the
// degree on every body that plays it, holding itself up the way a clip does —
// every limb exactly where it was keyed, nothing resting on anything. What a
// person in a chair does that a clip does not is GIVE: the weight goes into
// the seat, the back rounds a little into the backrest, the head goes where
// its weight takes it, and an arm that is not doing anything lies on whatever
// is under it — the table, a thigh, the arm of the chair — or hangs.
//
// So each of them is let go into their chair ONCE, as a ragdoll (43-ragdoll.js)
// with their back held, their neck half held and their arms let go (`tone`),
// against the furniture they are actually sitting on —
// seat, backrest, table top, the chair's arms, the floor — and against
// themselves, forearm on thigh and knee on knee (the capsule pairs, (i) in
// 43-avbd.js). A second and a third of simulated time, off screen, a few
// milliseconds of it a frame. What comes back is a turn per bone — the settled
// pose against the first frame of their clip — and that is laid on top of the
// clip for as long as they sit there (the settle layer in 41-skin.js), so the
// clip's breathing and fidgeting go on under a body that has sat down.
//
// ── WHAT IT COSTS ────────────────────────────────────────────────────────────
//
// Nothing, once it has been done. The physics runs only while somebody is
// waiting to be settled, and a person is settled once: the answer is kept on
// the PERSON (`fg.settled`), so a quay sitter demoted and promoted again a
// minute later sits down exactly as they did before, without a step being
// taken. The layer itself is thirty quaternion products on a figure that is
// being posed anyway: MEASURED, 0.3 to 1.3 µs on a 6 µs pose, and the
// promenade's frame at t 330 and t 460 is the same before and after to within
// the run-to-run drift of the machine.
//
// A settle is 120 steps, 17 to 26 ms of solving warm (the first on a cold
// page, 35 to 46 ms), and it is never done in one go: `SETTLE.budget` a frame,
// one person at a time, the net and the capsules for a body in a frame of
// their own and the take-over in another. MEASURED with every sitter on the
// shore re-queued at once, the worst frame's share was 1.9 ms; on arrival, with
// the page's code still cold, 7 ms once, building the first body's net.
//
// ── WHY IT IS THE SAME EVERY TIME ────────────────────────────────────────────
//
// The ragdoll is taken over at REST from the clip's first frame
// (`rag.enterPose`), not off the figure as it happens to be drawn, and every
// multiplier and penalty in the net is reset before each settle — so the same
// person on the same chair lands the same way on every visit, whatever the
// clip was doing on the frame the request came in. What differs between
// people is theirs: their body (eight of them, each with capsules measured off
// its own skin — `settleCaps`), their clip, their chair, and a muscle tone and
// a slouch dealt off their seed (`crowdJit`, never `rng` — RULE 4 in
// 42-crowd.js).
// -----------------------------------------------------------------------------

const SETTLE = {
  // The step, and how many: 1/90 s, 120 of them — 1.33 s of sitting down,
  // which with the drag below is long enough for the slowest limb (a forearm
  // coming off a table edge) to have gone where it is going. See `dragEnd`
  // for how still it is at the end.
  h: 1 / 90, steps: 120, iterations: 8,
  // Milliseconds of settling a frame, whoever it is for. A settle is spread
  // over as many frames as it takes; the next one starts the frame after.
  budget: 1.6,
  // Air, 1/s, and a lot of it. Only the pose at rest is kept, so this is not
  // trying to look like anything while it runs: it is there so that it GETS
  // to rest in a second rather than swinging.
  drag: 4.0,
  // Muscle tone, RAGDOLL's `tension` — but a tone a PART, a person's own
  // between each pair. Baye lies in the hammock at 0.55 all over; somebody in
  // a café chair is holding their back up and their head, and not their arms.
  tone: { back: [0.85, 1.15], neck: [0.45, 0.80], arm: [0.20, 0.45], leg: [0.50, 0.80] },
  // The two hips held where the clip sits them, N/m each, as springs, and
  // the top of the pelvis (`holdTop`) more softly: the pelvis may tip and
  // sink a centimetre or two, and cannot slide out of the chair. 55 kg on
  // 2 × 6000 N/m is 4.5 cm if the seat were not there, which it is.
  //
  // THE THIRD SPRING IS NOT OPTIONAL. With the hips alone the pelvis is free
  // to pitch about the line between them, and what stops a trunk leant over
  // a table from pitching with it is the hip flexors against thighs that are
  // lying on a seat — which is to say nothing much: MEASURED, every sitter
  // at a table went forward over it, head on their hands, whatever their
  // tone. A real pelvis on a chair is held by the whole of the backside
  // under it, and that is what the third one is.
  hold: 6000,
  holdTop: 3000,
  // What each person brings to the chair, rad, figure space: how far the back
  // rounds (split between the belly and the chest), how far the head goes
  // forward, over to one side and round. The physics does the rest — these
  // only move where the muscles are aiming. The slouch goes BOTH ways: with
  // it forward only, every café on the shore leaned in over its tables like
  // a room of people reading the same menu (the first cut of this), and
  // somebody who has sat down is as often back in the chair with their
  // shoulders on the backrest, which catches them.
  slouch: [-0.08, 0.12], drop: [0.00, 0.16], tilt: 0.30, turn: 0.36,
  // Seconds to lay a fresh settle in over the clip — somebody easing back
  // into their chair, if you happen to be watching — and to take it off or
  // put it back when they play something it was not measured against.
  fade: 1.1, swap: 0.35,
  // The air over the last 40 % of the steps, added to `drag` — see `stepJob`.
  // A body in air this thick falls at g / drag and no faster, so this is what
  // decides how still the pose kept is: 40 left a forearm still sliding off
  // a thigh at 0.3 m/s on the last step.
  dragEnd: 150,
  // AND NO FURTHER THAN THIS, degrees a joint and metres for the hips. A
  // settle, not a fall: the clips were solved with forearms on a table edge
  // that is where `terraceSet` puts it to within centimetres, not exactly —
  // and a forearm that finds the corner of a square table instead of its
  // edge goes off it, and takes the shoulders with it. MEASURED at seat 26
  // (`sittable`, Caffe TRAMPULIN) with every muscle at full tone, the right
  // hand went 33 cm down and the head 22 cm forward, folded over the table's
  // corner — which is somebody asleep at the table, not somebody sitting at
  // it. So the physics decides which way and by how much, and this only says
  // when enough is enough.
  most: { root: 5, back: 8, neck: 16, arm: 28, forearm: 35, leg: 8, shin: 10, shift: 0.035 },
  // All of the above at once, for a probe: 0 is the clip's own aim.
  bend: 1,
};

/** `SETTLE.most` by bone name, in radians. */
const SETTLE_MOST = new Map();
for (const [n, v] of Object.entries({ pelvis: 'root', spine02: 'back', chest: 'back', neck: 'neck',
  armUL: 'arm', armUR: 'arm', armLL: 'forearm', armLR: 'forearm', legUL: 'leg', legUR: 'leg',
  legLL: 'shin', legLR: 'shin' })) SETTLE_MOST.set(n, SETTLE.most[v] * Math.PI / 180);

/** RAGDOLL's table by bone, both sides — the stiffness each part's tone is a share of. */
const SETTLE_DEF = new Map(ragdollTable().map((d) => [d.bone, d]));

/**
 * What a person brings to their seat — their slouch, how far their head goes
 * forward, over and round, rad — dealt off their seed and never off `rng`.
 * Shared with the instanced tier (the `sit` case of `pose` in 42-crowd.js),
 * which cannot run a ragdoll and draws the same person from fifty metres, so
 * the head that is down on their chest up close is down from over there too.
 * `back`: whether anything is behind them — with nothing, nobody leans back.
 */
function settleLean(fg, back = true) {
  const sd = (fg.seed || 0) * 977;
  const j = (k) => crowdJit(sd, 900 + k);
  const lo = (r, u) => r[0] + (r[1] - r[0]) * u;
  let slouch = lo(SETTLE.slouch, j(1));
  if (!back) slouch = Math.abs(slouch);
  return { j, lo, slouch, drop: lo(SETTLE.drop, j(2)), tilt: (j(3) - 0.5) * SETTLE.tilt,
    turn: (j(4) - 0.5) * SETTLE.turn };
}

/**
 * Capsules for a bather, in their bind pose, measured off their own skin.
 *
 * Baye's were measured by hand (CHAIN_BODY in 43-jadrija.js) and there are
 * eight bathers from a child to a heavy old man, so these are taken off the
 * mesh: each bone's segment, head to the next head, and a radius that is the
 * distance from that segment to the skin weighted to it — the `pct` quantile,
 * over the middle of the segment only, so the ends (a shoulder's, a knee's)
 * do not fatten it. A quantile and not the largest: the largest is hair, a
 * swimsuit's frill, a nose.
 *
 * The foot is the exception, because a foot is flat and its bone is not at
 * its sole: one capsule heel to toe with its underside ON the sole, which is
 * what stands on the floor.
 */
function settleCaps(fig) {
  const data = fig.data;
  if (data.settleCaps) return data.settleCaps;
  const B = fig.bones, T = fig.bindRest().bindT;
  const id = (n) => fig.boneIndex(n);
  const hd = (i) => [T[3 * i], T[3 * i + 1], T[3 * i + 2]];
  const pos = data.geo.getAttribute('position').array;
  const bi = data.geo.getAttribute('aBoneIdx').array, bw = data.geo.getAttribute('aBoneWt').array;
  const nv = pos.length / 3;
  // Each vertex's bone: the heaviest of its four.
  const dom = new Int16Array(nv);
  for (let v = 0; v < nv; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (bw[4 * v + k] > bw[4 * v + best]) best = k;
    dom[v] = bi[4 * v + best];
  }
  // And each bone's vertices, listed once, so a capsule reads only its own.
  const byBone = B.map(() => []);
  for (let v = 0; v < nv; v++) if (byBone[dom[v]]) byBone[dom[v]].push(v);
  /** The quantile of the distance from `set`'s vertices to segment a–e, over t in [t0, t1]. */
  function rad(a, e, set, t0, t1, pct, side = 0) {
    const ux = e[0] - a[0], uy = e[1] - a[1], uz = e[2] - a[2];
    const uu = ux * ux + uy * uy + uz * uz || 1;
    const d = [];
    for (const bb of set) for (const v of byBone[bb]) {
      const x = pos[3 * v], y = pos[3 * v + 1], z = pos[3 * v + 2];
      if (side && Math.sign(z) !== side) continue;
      const t = ((x - a[0]) * ux + (y - a[1]) * uy + (z - a[2]) * uz) / uu;
      if (t < t0 || t > t1) continue;
      d.push(Math.hypot(x - a[0] - ux * t, y - a[1] - uy * t, z - a[2] - uz * t));
    }
    if (d.length < 8) return 0;
    d.sort((p, q) => p - q);
    return d[Math.min(d.length - 1, Math.floor(pct * d.length))];
  }
  const bones = (...n) => new Set(n.map(id).filter((i) => i >= 0));
  const caps = [];
  const seg = (bone, a, e, set, pct = 0.62, side = 0) => {
    const b = id(bone);
    if (b < 0) return;
    const r0 = rad(a, e, set, 0.08, 0.45, pct, side), r1 = rad(a, e, set, 0.55, 0.92, pct, side);
    if (!(r0 > 0) || !(r1 > 0)) return;
    caps.push({ bone: b, a, e, r0, r1, name: bone });
  };
  const at = (n) => (id(n) >= 0 ? hd(id(n)) : null);
  const lerp3 = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u];
  // The trunk: hips (a capsule up from each hip joint, which is the seat of
  // them), belly, chest.
  const pel = bones('pelvis');
  for (const s of ['L', 'R']) {
    const h = at('legU' + s), top = at('spine02');
    if (!h || !top) continue;
    const e = [h[0], h[1] + (top[1] - h[1]) * 0.8, h[2] * 0.7];
    seg('pelvis', h, e, pel, 0.55, Math.sign(h[2]));
  }
  if (at('spine02') && at('chest')) seg('spine02', at('spine02'), at('chest'), bones('spine01', 'spine02', 'spine03'), 0.55);
  if (at('chest') && at('neck')) seg('chest', at('chest'), at('neck'), bones('chest', 'spine03', 'clavicleL', 'clavicleR'), 0.5);
  if (at('neck') && at('head')) seg('neck', at('neck'), at('head'), bones('neck'), 0.6);
  // The head: a ball on its own vertices' middle.
  {
    const h = id('head');
    if (h >= 0) {
      let cx = 0, cy = 0, cz = 0, n = 0;
      for (const v of byBone[h]) { cx += pos[3 * v]; cy += pos[3 * v + 1]; cz += pos[3 * v + 2]; n++; }
      if (n > 8) {
        const c = [cx / n, cy / n, cz / n];
        const r = rad(c, [c[0], c[1] + 1e-4, c[2]], bones('head'), -1e9, 1e9, 0.45);
        if (r > 0) caps.push({ bone: h, a: c, e: c, r0: r, r1: r, name: 'head' });
      }
    }
  }
  for (const s of ['L', 'R']) {
    if (at('armU' + s) && at('armL' + s)) seg('armU' + s, at('armU' + s), at('armL' + s), bones('armU' + s), 0.6);
    if (at('armL' + s) && at('hand' + s)) seg('armL' + s, at('armL' + s), at('hand' + s), bones('armL' + s), 0.6);
    if (at('hand' + s) && at('fingers' + s)) {
      const h = at('hand' + s), f = at('fingers' + s);
      seg('hand' + s, h, lerp3(h, f, 1.6), bones('hand' + s, 'fingers' + s, 'thumb' + s), 0.5);
    }
    if (at('legU' + s) && at('legL' + s)) seg('legU' + s, at('legU' + s), at('legL' + s), bones('legU' + s), 0.6);
    if (at('legL' + s) && at('foot' + s)) seg('legL' + s, at('legL' + s), at('foot' + s), bones('legL' + s), 0.6);
    // The sole: heel to toe tip, its underside on the lowest vertex.
    const ft = bones('foot' + s, 'toe' + s);
    if (ft.size && at('foot' + s)) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, zs = 0, n = 0;
      for (const bb of ft) for (const v of byBone[bb]) {
        x0 = Math.min(x0, pos[3 * v]); x1 = Math.max(x1, pos[3 * v]); y0 = Math.min(y0, pos[3 * v + 1]);
        zs += pos[3 * v + 2]; n++;
      }
      if (n > 8) {
        const r = Math.max(0.018, Math.min(0.04, (at('foot' + s)[1] - y0) * 0.45));
        const z = zs / n;
        caps.push({ bone: id('foot' + s), a: [x0 + r, y0 + r, z], e: [x1 - r, y0 + r, z], r0: r, r1: r * 0.8,
          name: 'foot' + s });
      }
    }
  }
  data.settleCaps = caps;
  return caps;
}

/**
 * THE QUAY SITTERS' LEGS, LAID ON THE CEMENT (1.538.2).
 *
 * Misha, 28 Sep 2026, a man in yellow trunks and a woman in a teal bikini
 * sitting on the quay by a ladder: *"some bathers like these, they have their
 * legs sorta 'planted' into the cement which looks odd. their legs should be
 * on the cement."*
 *
 * Their clip (`sitquay`, `quaytalk` — `quay_clips` in bathers_mh.py) was
 * solved for somebody on the lip of the quay with their shins hanging over the
 * water, and it was never played there. Every quay sitter is placed
 * `B(t, 0.55, y, Math.PI, 'sit')`, and `ang` is a bearing off the shore's +t,
 * not off its normal (`rigYaw`): Math.PI is straight down the shore. So all
 * eleven sit on the flat of the lowest platform, side-on to the water, with
 * a hundred metres of concrete in front of them — and their shins went 0.3 m
 * down into it. Nobody is at an edge a leg could hang over, so nobody keeps
 * the old legs.
 *
 * So they sit with their legs out along the ground, which is the one
 * position that leaves everything the clip got right where it was: the clip's
 * thighs are already level at the hip's height (`_quay_solve`), so the hips,
 * the trunk and both hands resting half way down the thighs are untouched,
 * and only the knee opens and the foot turns up off its heel. The shin and
 * the foot are solved every frame onto the floor (`legRest` in 41-skin.js)
 * from the numbers here, which are this body's own:
 *
 * - `calf`: how far the skin of the shin stands behind its bone, in a dozen
 *   bands from knee to ankle — what, when the leg lies out, is underneath it.
 * - `foot`: every foot vertex as (along the foot bone, over it, outward), so
 *   how high the ankle sits off the back of the heel can be read for any
 *   lean and splay a person is dealt (`heelOf`).
 *
 * Measured in the bind pose off the skin weights, as `settleCaps` is.
 */
function legRestOf(fig) {
  const data = fig.data;
  if (data.legRest !== undefined) return data.legRest;
  const T = fig.bindRest().bindT;
  const id = (n) => fig.boneIndex(n);
  const hd = (i) => [T[3 * i], T[3 * i + 1], T[3 * i + 2]];
  const pos = data.geo.getAttribute('position').array;
  const bi = data.geo.getAttribute('aBoneIdx').array, bw = data.geo.getAttribute('aBoneWt').array;
  const nv = pos.length / 3, nb = fig.bones.length;
  const dom = new Int16Array(nv);
  for (let v = 0; v < nv; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (bw[4 * v + k] > bw[4 * v + best]) best = k;
    dom[v] = bi[4 * v + best];
  }
  const R = { at: new Int8Array(nb), child: new Int16Array(nb), side: new Int8Array(nb),
    calf: [], foot: [] };
  const sides = ['L', 'R'];
  for (let sd = 0; sd < 2; sd++) {
    const s = sides[sd];
    const sh = id('legL' + s), ft = id('foot' + s), to = id('toe' + s);
    if (sh < 0 || ft < 0 || to < 0) { data.legRest = null; return null; }
    R.at[sh] = 1; R.child[sh] = ft; R.side[sh] = sd;
    R.at[ft] = 2; R.child[ft] = to; R.side[ft] = sd;
    const K = hd(sh), A = hd(ft), P = hd(to);
    // The calf. `down` is what the shin's back becomes when the leg lies
    // along the ground: its axis turned a quarter back in the side plane.
    const ax = A[0] - K[0], ay = A[1] - K[1], L2 = ax * ax + ay * ay;
    const al = Math.sqrt(L2) || 1, dnx = ay / al, dny = -ax / al;
    const NB = 12, band = new Float32Array(NB * 2).fill(-1);
    // The foot, in its own bone's frame: `f` along it, `n` over it (its
    // top), `o` out to this side (the figure's left is −z).
    let fx = P[0] - A[0], fy = P[1] - A[1];
    const fl = Math.hypot(fx, fy) || 1;
    fx /= fl; fy /= fl;
    const out = sd ? 1 : -1, pts = [];
    for (let v = 0; v < nv; v++) {
      const b = dom[v];
      const x = pos[3 * v], y = pos[3 * v + 1], z = pos[3 * v + 2];
      if (b === sh) {
        const u = ((x - K[0]) * ax + (y - K[1]) * ay) / (L2 || 1);
        if (u < 0.08 || u > 1) continue;
        const k = Math.min(NB - 1, Math.floor(u * NB));
        const back = (x - K[0]) * dnx + (y - K[1]) * dny;
        if (back > band[2 * k + 1]) { band[2 * k] = u; band[2 * k + 1] = back; }
      } else if (b === ft || b === to) {
        const dx = x - A[0], dy = y - A[1];
        pts.push(dx * fx + dy * fy, dx * -fy + dy * fx, (z - A[2]) * out);
      }
    }
    const bins = [];
    for (let k = 0; k < NB; k++) if (band[2 * k + 1] > 0) bins.push(band[2 * k], band[2 * k + 1]);
    R.calf.push(Float32Array.from(bins));
    R.foot.push(Float32Array.from(pts));
  }
  data.legRest = R;
  return R;
}

/**
 * How high a foot stood up off its heel holds the ankle: the lowest of its
 * vertices, with the bone leant `lean` past upright toward the toes and
 * turned `splay` outward about the shin. See `legRest` for the frame.
 */
function heelOf(pts, lean, splay) {
  const a = Math.cos(lean) * Math.cos(splay), b = Math.sin(lean) * Math.cos(splay), c = -Math.sin(splay);
  let lo = 0;
  for (let k = 0; k < pts.length; k += 3) {
    const y = pts[k] * a + pts[k + 1] * b + pts[k + 2] * c;
    if (y < lo) lo = y;
  }
  return -lo;
}

/**
 * One quay sitter's legs on one body: the body's numbers above and this
 * person's own way of lying them out — the legs a little apart, the feet
 * leant and fallen outward by their own amounts — off their seed, never
 * `rng` (RULE 4 in 42-crowd.js). Kept on the person for as long as the same
 * body draws them.
 */
function legRestFor(fg, f) {
  const R = legRestOf(f);
  if (!R) return null;
  const L = fg.legRestL;
  if (L && L.data === f.data) return L;
  const j = (k) => crowdJit((fg.seed || 0) * 977 + 31, 940 + k);
  const lean = 0.18 + 0.30 * j(1);
  const splay = [0.12 + 0.30 * j(2), 0.12 + 0.30 * j(3)];
  const N = {
    data: f.data, w: 1, at: R.at, child: R.child, side: R.side, calf: R.calf,
    spread: [0.02 + 0.07 * j(4), 0.02 + 0.07 * j(5)], lean, splay,
    // A couple of millimetres of skin into the concrete rather than a hair
    // over it: a heel resting on a floor presses on it.
    heel: [heelOf(R.foot[0], lean, splay[0]) - 0.002, heelOf(R.foot[1], lean, splay[1]) - 0.002],
  };
  fg.legRestL = N;
  return N;
}

/**
 * The settler: one small net a body (the eight bathers are eight skeletons),
 * a queue, and a budget. `geoOf(fg)` is the caller's — what this person is
 * sitting on, in their own figure's frame (see `sitGeo` in 43-jadrija.js):
 * `{ boxes: [cx, cy, cz, hx, hy, hz, yaw, …], floor }` — the floor a height or
 * a function of (x, z).
 */
function makeSettler(geoOf) {
  const kinds = new Map();
  const queue = [];
  let job = null;
  const O = new THREE.Vector3(), I = new THREE.Quaternion();
  const stats = { done: 0, steps: 0, ms: 0, msMax: 0, frameMs: 0, frameMax: 0, frames: 0, queued: 0,
    failed: 0, restV: 0, per: [] };

  /** The net and the ragdoll for this body, built the first time anybody wearing it sits. */
  function kindOf(f) {
    let K = kinds.get(f.data);
    if (K) return K;
    const caps = settleCaps(f);
    const net = avbdNet({
      maxBodies: 16, maxJoints: 16, maxStrings: 3, maxPoints: 0, maxBoxes: 0, maxCaps: caps.length + 1,
      maxContacts: 400, maxAngles: 16, maxWorldBoxes: 8, maxCapPairs: 96, limK: RAGDOLL.limK,
      iterations: SETTLE.iterations, alpha: 0.9, alphaContact: 0.9, beta: 1e5, betaAng: 100, gamma: 0.999,
      gravity: [0, -9.81, 0], drag: SETTLE.drag, vMax: 4, wMax: 20, margin: 0.01, deep: 0.03,
      mu: 0.8, floorMu: 0.9, capK: 30000,
    });
    const rag = ragdollBuild(net, f, caps, { idBase: 1 });
    for (const b of rag.bodies) net.drag[b] = SETTLE.drag;
    const holds = [SETTLE.hold, SETTLE.hold, SETTLE.holdTop]
      .map((k) => net.addString(-1, [0, 0, 0], rag.pelvis, [0, 0, 0], 0, k));
    net.finish();
    for (const s of holds) net.setString(s, null, null, false);
    // Which capsules meet which: a forearm or a hand against the trunk and
    // both legs, an upper arm against the belly and the hips and the thighs,
    // and each leg against the other. Never two bodies that share a socket
    // (an upper arm and the chest), which touch by construction.
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
    net.setCapPairs(pairs, pairs.length / 2);
    const nb = f.bones.length;
    K = { net, rag, holds, nb, pairs: pairs.length / 2,
      refQ: new Float32Array(nb * 4), refT: new Float32Array(3), drv: new Float32Array(nb * 4),
      fkW: new Float64Array(nb * 4), fkT: new Float64Array(nb * 3),
      out: { q: new Float32Array(nb * 4), t: new Float32Array(3) },
      hipL: f.boneIndex('legUL'), hipR: f.boneIndex('legUR'), top: f.boneIndex('spine02') };
    kinds.set(f.data, K);
    return K;
  }

  /** A figure-space turn of `ang` about axis k (0 x, 1 y, 2 z) laid on bone i's target. */
  const _r = new Float64Array(4), _p = new Float64Array(4), _t = new Float64Array(4);
  function bend(K, f, name, k, ang) {
    const i = f.boneIndex(name);
    if (i < 0 || !ang) return;
    const p = f.bones[i].parent;
    _r[0] = _r[1] = _r[2] = 0; _r[k] = Math.sin(ang / 2); _r[3] = Math.cos(ang / 2);
    // local' = Wp⁻¹ · R · Wp · local
    if (p >= 0) {
      avbdQMul(K.fkW, 4 * p, _r, 0, _t, 0, true);
      avbdQMul(_t, 0, K.fkW, 4 * p, _p, 0);
    } else _p.set(_r);
    avbdQMul(_p, 0, K.drv, 4 * i, _t, 0);
    const l = Math.hypot(_t[0], _t[1], _t[2], _t[3]) || 1;
    for (let c = 0; c < 4; c++) K.drv[4 * i + c] = _t[c] / l;
  }

  function start(J) {
    const K = kindOf(J.f), { net, rag } = K, f = J.f;
    J.K = K;
    if (!f.sample(J.clip, 0, K.refQ, K.refT)) return false;
    const g = geoOf(J.fg);
    if (!g) return false;
    net.resetDuals();
    net.setWorldBoxes(g.boxes, g.boxes.length / 7);
    const fy = g.floor;
    net.setFloor(typeof fy === 'function' ? fy : () => fy);
    rag.enterPose(K.refQ, K.refT, O, I);
    for (const b of rag.bodies) net.drag[b] = SETTLE.drag;
    // The hips, held where the clip sits them.
    ragdollFK(f, K.refQ, K.refT, K.fkW, K.fkT);
    const pb = rag.pelvis, P = net.P, Q = net.Q;
    const qi = [-Q[4 * pb], -Q[4 * pb + 1], -Q[4 * pb + 2], Q[4 * pb + 3]];
    [K.hipL, K.hipR, K.top].forEach((h, n) => {
      if (h < 0) return;
      const w = [K.fkT[3 * h], K.fkT[3 * h + 1], K.fkT[3 * h + 2]];
      const d = [w[0] - P[3 * pb], w[1] - P[3 * pb + 1], w[2] - P[3 * pb + 2]];
      const rb = [0, 0, 0];
      qrotv(rb, 0, qi, 0, d, 0);
      net.setString(K.holds[n], w, 0, true, rb);
    });
    // What the muscles aim at: the clip's first frame, with this person's
    // own slouch and head laid on it — dealt off their seed, never `rng`.
    const L = settleLean(J.fg, g.back);
    const j = L.j, lo = L.lo;
    K.drv.set(K.refQ);
    // Forward is +x, up +y and the figure's left −z, so a head going forward
    // is a turn about −z, and one going over to its right a turn about +x.
    const bs = SETTLE.bend;
    bend(K, f, 'spine02', 2, -L.slouch * 0.55 * bs);
    bend(K, f, 'chest', 2, -L.slouch * 0.45 * bs);
    bend(K, f, 'neck', 2, -L.drop * bs);
    bend(K, f, 'neck', 0, L.tilt * bs);
    bend(K, f, 'neck', 1, L.turn * bs);
    rag.drive(K.drv);
    // The tone, a part at a time: RAGDOLL's own stiffness for the joint times
    // this person's share, the damping with its square root as `tension` does.
    rag.tension(1);
    const T = SETTLE.tone;
    const tk = { back: lo(T.back, j(5)), neck: lo(T.neck, j(6)), arm: lo(T.arm, j(7)), leg: lo(T.leg, j(8)) };
    for (const [name, m] of rag.angles) {
      const d = SETTLE_DEF.get(name);
      if (!d) continue;
      const g = /^arm/.test(name) ? 'arm' : /^leg/.test(name) ? 'leg' : name === 'neck' ? 'neck' : 'back';
      const k = tk[g];
      net.setAngleK(m, d.k * k, d.kd * Math.max(0.35, Math.sqrt(k)));
    }
    J.n = 0; J.ms = 0;
    return true;
  }

  /**
   * One step of a settle, and the air thickening over its last 40 %: what
   * is kept is the pose at REST, and a forearm still swinging off a table
   * edge on the last step is a pose nobody holds. MEASURED at a flat
   * `drag` the fastest body at the end was up to 0.9 m/s — an arm rocking on
   * the rim of a table — and with the ramp it is under a centimetre a second.
   */
  function stepJob(J) {
    const u = (J.n / SETTLE.steps - 0.6) / 0.4;
    if (u > 0) {
      const dr = SETTLE.drag + SETTLE.dragEnd * u * u;
      for (const b of J.K.rag.bodies) J.K.net.drag[b] = dr;
    }
    J.K.net.step(SETTLE.h);
    J.n++;
  }

  function finish(J) {
    const K = J.K, { net, rag } = K, nb = K.nb;
    const out = K.out;
    rag.write(out, O, I, K.refQ);
    // The turn per bone off the clip's first frame: d = ref⁻¹ · settled.
    const d = new Float32Array(nb * 4);
    for (let i = 0; i < nb; i++) {
      const o = 4 * i;
      qmul(_t, 0, [-K.refQ[o], -K.refQ[o + 1], -K.refQ[o + 2], K.refQ[o + 3]], 0, out.q, o);
      const l = (_t[3] < 0 ? -1 : 1) / (Math.hypot(_t[0], _t[1], _t[2], _t[3]) || 1);
      d[o] = _t[0] * l; d[o + 1] = _t[1] * l; d[o + 2] = _t[2] * l; d[o + 3] = _t[3] * l;
      // A quay sitter's legs are not the settle's: they are laid on the
      // concrete every frame (`legRestOf`), and what the ragdoll made of the
      // clip's hanging shins — sunk through the same floor — is thrown away.
      if (J.fg.ground && /^(leg|foot|toe)/.test(J.f.bones[i].name)) {
        d[o] = d[o + 1] = d[o + 2] = 0; d[o + 3] = 1;
        continue;
      }
      // And no further than `most` for its part — see there.
      const lim = SETTLE_MOST.get(J.f.bones[i].name);
      const ang = 2 * Math.acos(Math.min(1, d[o + 3]));
      if (lim != null && ang > lim) {
        const sn = Math.sin(ang / 2) || 1, k = Math.sin(lim / 2) / sn;
        d[o] *= k; d[o + 1] *= k; d[o + 2] *= k; d[o + 3] = Math.cos(lim / 2);
        stats.clamped = (stats.clamped || 0) + 1;
      }
    }
    const t = new Float32Array([out.t[0] - K.refT[0], out.t[1] - K.refT[1], out.t[2] - K.refT[2]]);
    const tl = Math.hypot(t[0], t[1], t[2]);
    if (tl > SETTLE.most.shift) for (let k = 0; k < 3; k++) t[k] *= SETTLE.most.shift / tl;
    const v = rag.speed();
    stats.restV = Math.max(stats.restV, v);
    rag.leave();
    for (const s of K.holds) net.setString(s, null, null, false);
    net.setWorldBoxes(null, 0);
    J.fg.settled = { data: J.f.data, clip: J.clip, q: d, t, fresh: true };
    J.fg.settleQ = false;
    stats.done++;
    stats.ms += J.ms;
    stats.msMax = Math.max(stats.msMax, J.ms);
    if (stats.per.length < 64) stats.per.push({ idx: J.fg.idx, clip: J.clip, ms: +J.ms.toFixed(2), v: +v.toFixed(3) });
  }

  return {
    /** Ask for `fg` to be settled on figure `f`, playing `clip`. Once; asking again is free. */
    want(fg, f, clip) {
      if (fg.settleQ) return;
      fg.settleQ = true;
      queue.push({ fg, f, clip });
      stats.queued++;
    },
    /** A frame's worth: settle whoever is nearest `cam` for up to `budget` ms. */
    tick(cam) {
      const t0 = performance.now();
      let spent = 0;
      while (spent < SETTLE.budget) {
        if (!job) {
          if (!queue.length) break;
          // Nearest first: the one you are looking at sits down first.
          let k = 0, bd = Infinity;
          for (let i = 0; i < queue.length; i++) {
            const q = queue[i].fg, d = (q.x - cam.x) ** 2 + (q.z - cam.z) ** 2;
            if (d < bd) { bd = d; k = i; }
          }
          job = queue.splice(k, 1)[0];
          // A body nobody has sat in yet: its net and its capsules are this
          // frame's work, and the settle starts on the next.
          if (!kinds.has(job.f.data)) {
            const b0 = performance.now();
            kindOf(job.f);
            stats.buildMax = Math.max(stats.buildMax || 0, performance.now() - b0);
            spent = performance.now() - t0;
            break;
          }
        }
        if (!job.K) {
          const b0 = performance.now(), ok = start(job);
          stats.startMax = Math.max(stats.startMax || 0, performance.now() - b0);
          if (!ok) {
            job.fg.settleQ = false;
            job.fg.settled = { failed: true, data: job.f.data, clip: job.clip };
            stats.failed++; job = null; continue;
          }
          // Taken over this frame; stepped from the next, with the whole budget.
          spent = performance.now() - t0;
          break;
        }
        const s0 = performance.now();
        while (job.n < SETTLE.steps && performance.now() - t0 < SETTLE.budget) {
          stepJob(job);
          stats.steps++;
        }
        job.ms += performance.now() - s0;
        spent = performance.now() - t0;
        if (job.n >= SETTLE.steps) {
          const b0 = performance.now();
          finish(job); job = null;
          stats.finishMax = Math.max(stats.finishMax || 0, performance.now() - b0);
          spent = performance.now() - t0;
          // One person a frame at most: the next starts on the next.
          break;
        }
      }
      if (spent > 0.001) {
        stats.frames++;
        stats.frameMs += spent;
        stats.frameMax = Math.max(stats.frameMax, spent);
      }
    },
    /**
     * A probe's: settle `fg` on `f` now, synchronously, and say how each joint
     * went — its angle (deg, its own axes) at the start and the end, and
     * where the pelvis went. Leaves nobody's settle changed.
     */
    trace(fg, f, clip, steps = SETTLE.steps, keep = false) {
      if (job) return null;
      const J = { fg, f, clip };
      if (!start(J)) return null;
      const { net, rag } = J.K;
      const deg = 180 / Math.PI, rd = (v) => v.map((x) => +(x * deg).toFixed(1));
      const a0 = rag.angles.map(([n, m]) => [n, rd(net.angleNow(m))]);
      const P0 = Float64Array.from(net.P);
      const p0 = [net.P[3 * rag.pelvis], net.P[3 * rag.pelvis + 1], net.P[3 * rag.pelvis + 2]];
      const seq = [];
      for (let i = 0; i < steps; i++) {
        stepJob(J);
        if (i % 20 === 19) seq.push([i + 1, rd(net.angleNow(rag.angles.find((x) => x[0] === 'spine02')[1])), +rag.speed().toFixed(3), net.nc]);
      }
      const a1 = rag.angles.map(([n, m]) => [n, rd(net.angleNow(m))]);
      const bodies = rag.capsOf().map((c) => [c.bone, [0, 1, 2].map((k) => +(net.P[3 * c.i + k] - P0[3 * c.i + k]).toFixed(3)),
        +Math.hypot(net.V[3 * c.i], net.V[3 * c.i + 1], net.V[3 * c.i + 2]).toFixed(2)]);
      const p1 = [net.P[3 * rag.pelvis], net.P[3 * rag.pelvis + 1], net.P[3 * rag.pelvis + 2]];
      // The pose written back, through FK, against the clip's: where the
      // head and the hands went, which must agree with the bodies above.
      const K = J.K, out = K.out, nbn = K.nb;
      rag.write(out, O, I, K.refQ);
      const W1 = new Float64Array(4 * nbn), T1 = new Float64Array(3 * nbn);
      const W0 = new Float64Array(4 * nbn), T0 = new Float64Array(3 * nbn);
      ragdollFK(f, out.q, out.t, W1, T1);
      ragdollFK(f, K.refQ, K.refT, W0, T0);
      const fk = ['pelvis', 'chest', 'neck', 'head', 'handL', 'handR', 'footL'].map((n) => {
        const i = f.boneIndex(n);
        return [n, [0, 1, 2].map((k) => +(T1[3 * i + k] - T0[3 * i + k]).toFixed(3))];
      });
      if (keep) { J.ms = 0; finish(J); return { fk, bodies }; }
      rag.leave();
      for (const s of J.K.holds) net.setString(s, null, null, false);
      net.setWorldBoxes(null, 0);
      fg.settleQ = false;
      return { fk, a0, a1, bodies, seq, pelvis: p1.map((v, k) => +(v - p0[k]).toFixed(3)), stats: { ...net.stats } };
    },
    /** What `fg` is sitting on, the caller's own answer — the hands rest on it too (`HANDS` in 42-crowd.js). */
    geo: (fg) => geoOf(fg),
    stats: () => ({ ...stats, waiting: queue.length + (job ? 1 : 0), kinds: kinds.size,
      caps: [...kinds.values()].map((K) => K.rag.caps), pairs: [...kinds.values()].map((K) => K.pairs) }),
    /** Forget everybody's settle — a probe re-running them all (and the before shot). */
    reset(off) {
      queue.length = 0; job = null; kinds.clear();
      Object.assign(stats, { done: 0, steps: 0, ms: 0, msMax: 0, frameMs: 0, frameMax: 0, frames: 0, queued: 0,
        failed: 0, restV: 0, per: [] });
      SETTLE.off = !!off;
      return true;
    },
  };
}
