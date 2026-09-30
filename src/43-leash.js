// ---------------------------------------------------------------------------
// THE COLLAR AND THE LEASH — black leather on her neck, and a metre and a
// half of sparkle from it to your hand.
//
// Misha, 30 Sep 2026: *"assign a new additional play mode, of putting on the
// black collar with a diamond leash/chain, which we can pull, this could use
// those AVBD physics for the chain and yanking motion, and here we can also
// reuse the position where she's either 'kneeling' or 'on all fours' already,
// maybe also add some cool ragdoll stuff so it looks realistic, basically we
// need to be able to yank the collar around and lead her, even outside
// kabine, perhaps to the back where the hammock is. should also be possible
// to later take off the collar as well."*
//
// This file is the two objects: the chain (the physics and its drawing) and
// the collar (its geometry). Where the collar sits on her, what she does on
// the leash and how a tug lands on her are in 43-jadrija.js (`LEASH_ON`,
// `leashStep`, `leashRag*`); your hand, the key, the words and the game round
// it are in 90-app.js (`COLLAR`, `collarCmd`, `collarHandTick`).
//
// THE CHAIN IS THE CUFF CHAIN'S SOLVER (`avbdChainOwn`, 43-avbd.js), used for
// the case it was written for: rigid links jointed end to end, both end
// joints hanging off world points that MOVE — there, her two cuffs; here, the
// ring on the front of her collar and your fist round the loop. Her body is
// the nineteen-and-more capsules the cuff chains lie on (CHAIN_BODY), and a
// floor. Nothing in the solver was changed for it: the leash is one more
// customer of exactly the code the wrist chain runs, with its own numbers.
//
// A TUG IS NOT THE CHAIN PULLING HER. Both ends are kinematic — her ring
// rides her neck bone and your hand is your hand — so the chain cannot move
// her, and it is not asked to. What a yank does is taken off the geometry in
// 90-app.js: your hand goes back until the chain is at its length and past
// it by the draw, and the draw against your arm is the force (`COLLAR.yank`).
// That force goes to her partial ragdoll (`leashRag*` in 43-jadrija.js) as a
// spring on the collar ring, and to her feet as a lurch; and the chain,
// asked to span its own length, comes taut and straight between the two.
// ---------------------------------------------------------------------------

const LEASH = {
  /**
   * 1.50 m of chain, 56 links at 27 mm, each drawn 30 mm long so they
   * overlap the way a chain's links do (see CHAIN's note on why a chain
   * spaced at its own link length reads as a row of rings). `r` the oval's
   * short radius, `wire` its section, `long` how much longer than round.
   * The first cut was 48 links of 40 mm, and photographed against her it was
   * a toy: a chain that size is a dog's, not a piece of jewellery.
   */
  len: 1.50, links: 56, r: 0.0068, wire: 0.0023, long: 1.85,
  /**
   * THE STONES: one set in the middle of every link, a brilliant cut of
   * `gem` m radius — its girdle, its crown `crown` of that high and its
   * pavilion `pav` deep, `facets` round. That is what makes it a diamond
   * chain and not a steel one: a string of cut stones on plated links.
   */
  gem: 0.0040, crown: 0.45, pav: 0.85, facets: 8,
  /**
   * 5 g a link, 240 g the chain: a plated curb with stones set in it. Under
   * gravity alone the mass cancels out of how it hangs; it counts against
   * her skin's springs (`contactK`), where a lighter link is pushed about by
   * her shoulder rather than driven into it.
   */
  mass: 0.0042, g: 9.81,
  // The cuff chain's clock and its solver settings, measured there.
  step: 1 / 120, maxSteps: 4, iterations: 8, alpha: 0.9, alphaContact: 0.9,
  beta: 1e5, gamma: 0.999,
  // The quarter turn link to link (N·m/rad), the links rubbing (1/s), and a
  // ceiling on a link's speed — a yank throws the middle of it at 6 m/s.
  twist: 3e-3, drag: 0.9, vMax: 25,
  // A link as a collider; steel on skin.
  rLink: 0.0055, margin: 0.004, mu: 0.4, deep: 0.03,
  // Her skin gives and the chain does not — CHAIN.contactK, and firmer: a
  // leash draped over her back is pulled across it, not driven into it.
  contactK: 3000,
  /**
   * PAST ITS LENGTH THE JOINTS GIVE (CHAIN.tautK): drawn straight between a
   * ring and a hand that are the chain's length apart, a chain that has gone
   * round her shoulder on the way is longer than the line, and a hard joint
   * would pull it through her to make up the difference.
   */
  tautAt: 0.975, hardAt: 0.94, tautK: 8000,
  /**
   * CAUGHT ON HER (CHAIN.slip): a chain whose joints add up to `slip` m of
   * stretch for `trapFor` s has gone round her — over her back as she turned
   * on the spot under it — and a tug then stretches it round the far side of
   * her in a loop of parted links (PHOTOGRAPHED, the first yank from in
   * front of her). It is hung afresh between the ring and the hand.
   */
  slip: 0.08, trapFor: 0.20,
  /**
   * The links nearest the ring that do not meet her neck, head or chest —
   * the ring is ON her collar, so the first links are already touching the
   * neck's capsule, the way the wrist chain's first links touch the arm.
   */
  free: 4,
  // An end that moves this far in a frame has gone somewhere (the door's
  // cut, a teleport): hung afresh rather than dragged through the room. And
  // how many steps a fresh hang settles for before it is drawn.
  jump: 0.6, settle: 20,
  // The loop you hold, m: its radius and its wire.
  loop: 0.042, loopWire: 0.0055,
  // Colours: bright plated metal, and the stones' fire is in the shader.
  metal: [0.60, 0.61, 0.64], stone: [0.93, 0.95, 1.0],
  // The guard: any link faster than this, or NaN, and it is hung again.
  guard: 40,
};

/**
 * The collar, as geometry — see COLLAR_FIT in 43-jadrija.js for where it
 * sits and the numbers it is sized from. Its own frame: +y up her neck, +x
 * out of her throat, +z to her right (her figure's frame, turned to lean
 * with the neck); the origin the middle of her neck at the strap's height.
 */
const COLLAR_GEO = {
  /** The strap: how wide up the neck, how thick, and the radius of its rounded edges. */
  wide: 0.028, thick: 0.0058, round: 0.0024,
  // Round the neck in this many steps; the buckle at this angle (rad from
  // her throat toward her left, -z), and the strap's tail past it.
  seg: 96, buckle: 2.25, tail: 0.34,
  // Colours: black leather, its stitching, the metal.
  leather: [0.030, 0.028, 0.030], stitch: [0.46, 0.45, 0.43], metal: [0.80, 0.80, 0.82],
  // The D-ring: its bar along the strap, the D's reach out from it, its wire.
  dBar: 0.019, dReach: 0.021, dWire: 0.0026,
};

/**
 * The chain: an `avbdChainOwn` between the collar ring (end 0) and your hand
 * (end 1), drawn as instanced links with the stones' fire in the shader.
 */
function leashChain(scene) {
  const C = LEASH, n = C.links, m = C.mass;
  const lx = 2 * (C.r * C.long + C.wire), ly = 2 * (C.r + C.wire), lz = 2 * C.wire;
  const sim = avbdChainOwn({ n, pitch: C.len / n, mass: m,
    moment: [m * (ly * ly + lz * lz) / 12, m * (lx * lx + lz * lz) / 12, m * (lx * lx + ly * ly) / 12],
    rLink: C.rLink, mu: C.mu, twist: C.twist,
    iterations: C.iterations, alpha: C.alpha, alphaContact: C.alphaContact,
    beta: C.beta, gamma: C.gamma, gravity: [0, -C.g, 0],
    drag: C.drag, vMax: C.vMax, margin: C.margin, deep: C.deep,
    contactK: C.contactK });

  // ── her body, as the solver wants it: where each capsule was at the start
  // of the frame and where it is now, stepped between ────────────────────
  let capsWas = null, capsNow = null, nCaps = 0;
  let floorWas = 0, floorNow = 0;
  const ringWas = new Float64Array(3), ringNow = new Float64Array(3);
  const handWas = new Float64Array(3), handNow = new Float64Array(3);
  function shapesAt(u0, u1) {
    const sh = sim.shapes;
    for (let k = 0; k < nCaps; k++) {
      for (let j = 0; j < 3; j++) {
        const a = 8 * k + j, b = 8 * k + 3 + j;
        sh.a0[3 * k + j] = capsWas[a] + (capsNow[a] - capsWas[a]) * u0;
        sh.b0[3 * k + j] = capsWas[b] + (capsNow[b] - capsWas[b]) * u0;
        sh.a1[3 * k + j] = capsWas[a] + (capsNow[a] - capsWas[a]) * u1;
        sh.b1[3 * k + j] = capsWas[b] + (capsNow[b] - capsWas[b]) * u1;
      }
    }
    sh.floor0 = floorWas + (floorNow - floorWas) * u0;
    sh.floor1 = floorWas + (floorNow - floorWas) * u1;
  }

  // ── the drawing ────────────────────────────────────────────────────────
  // One link, faceted: a torus of few sides with its normals left flat, so
  // every facet catches the sun on its own — the stones — and stretched
  // along its run into the oval a link is.
  const base = new THREE.TorusGeometry(C.r, C.wire, 5, 12).toNonIndexed();
  base.scale(C.long, 1, 1);
  base.computeVertexNormals();
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('normal', base.attributes.normal);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const iRot = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  const iScl = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
  const iCol = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  for (const [nm, at] of [['aInstPos', iPos], ['aInstRot', iRot], ['aInstScale', iScl], ['aInstColor', iCol]]) {
    at.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(nm, at);
  }
  // Each link a hair different in white, and that difference is also the
  // seed its stones twinkle off (see the shader).
  for (let i = 0; i < n; i++) {
    const s = 0.94 + 0.06 * ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    iCol.array[3 * i] = s; iCol.array[3 * i + 1] = s; iCol.array[3 * i + 2] = s;
  }
  geo.instanceCount = n;
  // THE FIRE. A pavé's is in `paveMaterial` (43-jadrija.js): a lobe far
  // tighter than the metal's, a different colour on every stone. Here each
  // facet is its own stone to the eye — which one is read off its normal, so
  // a facet flashes as the link it is on turns — and its fire comes and goes
  // a little with time so a leash lying still still glitters.
  //
  // THREE LIGHTS AND NOT ONE, because the sun alone is not in the kabina: in
  // there the whole of the shading is ambient, and a stone lit by the sun's
  // lobe only (times its shadow) was a grey ring. So the sun where there is
  // one, a lamp overhead that has no shadow (the pendant's, or the sky's),
  // and a glint along the line of sight — a stone catches your own eye.
  // (No backticks in the GLSL.)
  const sparkle = (seed, grain, k) => [
    '  {',
    '    vec3 fq = floor(n * ' + grain + ' + 0.5);',
    '    float sd = ' + seed + ';',
    '    float st = fract(sin(dot(fq, vec3(12.9898, 78.233, 37.719)) + sd * 311.0) * 43758.5453);',
    '    vec3 fire = 0.55 + 0.45 * cos(vec3(0.0, 2.1, 4.2) + st * 6.2831);',
    '    float tw = 0.55 + 0.45 * sin(uTime * (2.0 + 3.0 * st) + st * 40.0);',
    '    vec3 hs = normalize(uSunDir - viewDir);',
    '    vec3 hl = normalize(normalize(vec3(0.25, 1.0, 0.15)) - viewDir);',
    '    col += fire * uSunColor * pow(max(dot(n, hs), 0.0), 300.0) * ' + (2.6 * k).toFixed(3) + ' * sh * tw;',
    '    col += fire * vec3(1.0, 0.93, 0.82) * pow(max(dot(n, hl), 0.0), 180.0) * ' + (1.1 * k).toFixed(3) + ' * tw;',
    '    col += fire * pow(max(dot(n, -viewDir), 0.0), 70.0) * ' + (0.45 * k).toFixed(3) + ' * tw;',
    '  }',
  ].join('\n');
  const mat = solidMaterial(new THREE.Color(...C.metal), {
    instanced: true, vcol: false, spec: 0.95, specPower: 150,
    body: 'env = 0.65;',
    lit: sparkle('fract(vColor.r * 97.0)', '17.0', 0.5),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.castShadow = false;
  scene.add(mesh);
  // The stones: a brilliant cut — a table, a crown of `facets` down to the
  // girdle, a pavilion to the culet — faceted flat, set in the middle of
  // every link with its table out of the link's face, on the links' own
  // instance attributes so they go wherever the links go.
  const gemGeo = (() => {
    const R = C.gem, F = C.facets, hc = R * C.crown, hp = R * C.pav, rt = R * 0.55;
    const P = [];
    const tri = (a, b, c) => P.push(...a, ...b, ...c);
    for (let k = 0; k < F; k++) {
      const a0 = (k / F) * Math.PI * 2, a1 = ((k + 1) / F) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const T0 = [Math.cos(a0) * rt, Math.sin(a0) * rt, hc], T1 = [Math.cos(a1) * rt, Math.sin(a1) * rt, hc];
      const G0 = [Math.cos(a0) * R, Math.sin(a0) * R, 0], G1 = [Math.cos(a1) * R, Math.sin(a1) * R, 0];
      const Gm = [Math.cos(am) * R, Math.sin(am) * R, 0];
      tri([0, 0, hc], T0, T1);                    // the table
      tri(T0, G0, Gm); tri(T0, Gm, T1); tri(T1, Gm, G1);   // the crown's facets
      tri(G0, [0, 0, -hp], Gm); tri(Gm, [0, 0, -hp], G1);  // the pavilion's
    }
    const g0 = new THREE.BufferGeometry();
    g0.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g0.computeVertexNormals();
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', g0.attributes.position);
    g.setAttribute('normal', g0.attributes.normal);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    for (const [nm, at] of [['aInstPos', iPos], ['aInstRot', iRot], ['aInstScale', iScl], ['aInstColor', iCol]]) g.setAttribute(nm, at);
    g.instanceCount = n;
    return g;
  })();
  const gemMat = solidMaterial(new THREE.Color(...C.stone), {
    instanced: true, vcol: false, spec: 1.0, specPower: 220, side: THREE.DoubleSide,
    body: 'env = 0.85;',
    lit: sparkle('fract(vColor.r * 53.0)', '11.0', 1.7),
  });
  const gems = new THREE.Mesh(gemGeo, gemMat);
  gems.frustumCulled = false;
  gems.visible = false;
  gems.castShadow = false;
  scene.add(gems);
  // The loop in your fist, of the same links' look: a faceted ring.
  const loopGeo = new THREE.TorusGeometry(C.loop, C.loopWire, 6, 20).toNonIndexed();
  loopGeo.computeVertexNormals();
  const loopMat = solidMaterial(new THREE.Color(...C.stone), {
    vcol: false, spec: 0.95, specPower: 150, body: 'env = 0.7;',
    lit: sparkle('0.37', '15.0', 0.8),
  });
  const loop = new THREE.Mesh(loopGeo, loopMat);
  loop.frustumCulled = false;
  loop.visible = false;
  scene.add(loop);
  // And the clasp on the ring: a small bolt of metal where the chain meets it.
  const clasp = new THREE.Mesh(new THREE.CapsuleGeometry(0.0042, 0.014, 3, 8),
    solidMaterial(new THREE.Color(0.82, 0.82, 0.85), { vcol: false, spec: 0.9, specPower: 110 }));
  clasp.frustumCulled = false;
  clasp.visible = false;
  scene.add(clasp);

  // ── state ─────────────────────────────────────────────────────────────
  let on = false, acc = 0, rehang = true, trap = 0;
  const stats = { ms: 0, msMax: 0, msSum: 0, frames: 0, steps: 0, hangs: 0, rescues: 0, traps: 0, stretchSum: 0,
    contacts: 0, span: 0, taut: 0, stretch: 0, pen: 0 };
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();

  /** Which of her capsules the links near the ring leave alone — see `free`. */
  function setIgnore(near) {
    const sh = sim.shapes;
    for (let i = 0; i < n; i++) sh.ignore[i] = i < C.free ? near : 0;
  }

  /**
   * Hung afresh between the ring and the hand: a parabola let down from the
   * chord until it is the chain's length, never under the floor — so what
   * has nowhere lower to go lies along it — and then settled a moment.
   */
  const CURVE = new Float64Array(4 * 65);
  function hang() {
    const A = sim.anchor, S = 64;
    for (let k = 0; k < 3; k++) { A[k] = ringNow[k]; A[3 + k] = handNow[k]; }
    sim.anchor0.set(A);
    const lie = floorNow + C.rLink + 0.001;
    const curve = (sag) => {
      let len = 0;
      for (let j = 0; j <= S; j++) {
        const u = j / S, o = 4 * j, k = sag * 4 * u * (1 - u);
        CURVE[o] = A[0] + (A[3] - A[0]) * u;
        CURVE[o + 1] = Math.max(lie, A[1] + (A[4] - A[1]) * u - k);
        CURVE[o + 2] = A[2] + (A[5] - A[2]) * u;
        if (j) len += Math.hypot(CURVE[o] - CURVE[o - 4], CURVE[o + 1] - CURVE[o - 3], CURVE[o + 2] - CURVE[o - 2]);
        CURVE[o + 3] = len;
      }
      return len;
    };
    let lo = 0, hi = C.len * 2;
    if (curve(0) >= C.len) hi = 0;
    for (let it = 0; it < 30 && hi > 0; it++) {
      const mid = (lo + hi) * 0.5;
      if (curve(mid) < C.len) lo = mid; else hi = mid;
    }
    // Lying on the floor it can come out short of its length whatever the
    // sag; what is left is laid on along the floor past the low point.
    const total = curve(lo);
    sim.lay((u, out, o) => {
      const want = u * total;
      let j = 1;
      while (j < S && CURVE[4 * j + 3] < want) j++;
      const l0 = CURVE[4 * j - 1], l1 = CURVE[4 * j + 3];
      const f = l1 > l0 ? Math.min(1, (want - l0) / (l1 - l0)) : 0;
      for (let k = 0; k < 3; k++) out[o + k] = CURVE[4 * j - 4 + k] + (CURVE[4 * j + k] - CURVE[4 * j - 4 + k]) * f;
    });
    if (capsNow) { capsWas.set(capsNow); shapesAt(1, 1); }
    floorWas = floorNow;
    for (let s = 0; s < C.settle; s++) { sim.anchor0.set(sim.anchor); sim.step(C.step); }
    acc = 0;
    ringWas.set(ringNow); handWas.set(handNow);
    stats.hangs++;
    rehang = false;
  }

  function sane() {
    const P = sim.P, V = sim.V;
    for (let i = 0; i < 3 * n; i += 3) {
      if (!(P[i] === P[i] && P[i + 1] === P[i + 1] && P[i + 2] === P[i + 2])) return false;
      if (V[i] * V[i] + V[i + 1] * V[i + 1] + V[i + 2] * V[i + 2] > C.guard * C.guard) return false;
    }
    return true;
  }

  /**
   * A frame: `ring` and `hand` where they are now (THREE vectors, world);
   * `caps` her capsules (eight numbers each, `nc` of them), `near` the bit
   * mask of the ones round her neck that the first links leave alone;
   * `floor` a height; `boxes` (1.554.0) the static boxes it lies on besides —
   * the cot's mattress, seven numbers each (`cotBoxes`) — `nb` of them.
   */
  function step(dt, ring, hand, caps, nc, near, floor, boxes = null, nb = 0) {
    const t0 = performance.now();
    // THE MATTRESS UNDER IT (1.554.0), when she is on the cot or beside it:
    // the solver's static boxes, (7) in 43-avbd.js — draped over the edge of
    // it and not through it to the floor.
    const sh0 = sim.shapes;
    if (boxes && nb > 0) {
      if (!sh0.box || sh0.box.length < 7 * nb) sh0.box = new Float64Array(7 * nb);
      for (let k = 0; k < 7 * nb; k++) sh0.box[k] = boxes[k];
      sh0.boxN = nb;
    } else sh0.boxN = 0;
    ringNow[0] = ring.x; ringNow[1] = ring.y; ringNow[2] = ring.z;
    handNow[0] = hand.x; handNow[1] = hand.y; handNow[2] = hand.z;
    floorNow = floor;
    if (!capsNow || nCaps !== nc) {
      nCaps = Math.min(31, nc);
      capsNow = new Float64Array(8 * Math.max(1, nCaps));
      capsWas = new Float64Array(8 * Math.max(1, nCaps));
      sim.setShapeCount(nCaps);
      rehang = true;
    }
    capsNow.set(caps.subarray ? caps.subarray(0, 8 * nCaps) : caps.slice(0, 8 * nCaps));
    for (let k = 0; k < nCaps; k++) { sim.shapes.r[2 * k] = capsNow[8 * k + 6]; sim.shapes.r[2 * k + 1] = capsNow[8 * k + 7]; }
    setIgnore(near);
    const jump = Math.max(Math.hypot(ringNow[0] - ringWas[0], ringNow[1] - ringWas[1], ringNow[2] - ringWas[2]),
      Math.hypot(handNow[0] - handWas[0], handNow[1] - handWas[1], handNow[2] - handWas[2]));
    if (!on || rehang || jump > C.jump) { on = true; hang(); }
    acc += Math.min(dt, C.maxSteps * C.step);
    let k = Math.floor(acc / C.step + 1e-9);
    if (k > C.maxSteps) k = C.maxSteps;
    acc -= k * C.step;
    const A = sim.anchor;
    const span = Math.hypot(handNow[0] - ringNow[0], handNow[1] - ringNow[1], handNow[2] - ringNow[2]);
    if (span > C.len * C.tautAt) sim.setJointK(C.tautK);
    else if (span < C.len * C.hardAt) sim.setJointK(Infinity);
    for (let s = 1; s <= k; s++) {
      const u0 = (s - 1) / k, u1 = s / k;
      shapesAt(u0, u1);
      sim.anchor0.set(A);
      for (let j = 0; j < 3; j++) {
        A[j] = ringWas[j] + (ringNow[j] - ringWas[j]) * u1;
        A[3 + j] = handWas[j] + (handNow[j] - handWas[j]) * u1;
      }
      sim.step(C.step);
      stats.steps++;
    }
    if (k) {
      capsWas.set(capsNow); floorWas = floorNow;
      ringWas.set(ringNow); handWas.set(handNow);
    }
    if (!sane()) { stats.rescues++; hang(); }
    // Caught on her — see LEASH.slip.
    if (k) {
      sim.measure();
      stats.stretchSum = sim.stats.sumStretch;
      trap = sim.stats.sumStretch > C.slip ? trap + k * C.step : 0;
      if (trap > C.trapFor) { trap = 0; stats.traps++; hang(); }
    }
    stats.contacts = sim.stats.contacts;
    stats.span = span;
    stats.taut = span / C.len;
    draw(ring, hand);
    const ms = performance.now() - t0;
    stats.ms = ms; stats.msMax = Math.max(stats.msMax, ms); stats.msSum += ms; stats.frames++;
  }

  function draw(ring, hand) {
    const P = sim.P, Q = sim.Q;
    for (let i = 0; i < n; i++) {
      iPos.array[3 * i] = P[3 * i]; iPos.array[3 * i + 1] = P[3 * i + 1]; iPos.array[3 * i + 2] = P[3 * i + 2];
      iRot.array[4 * i] = Q[4 * i]; iRot.array[4 * i + 1] = Q[4 * i + 1];
      iRot.array[4 * i + 2] = Q[4 * i + 2]; iRot.array[4 * i + 3] = Q[4 * i + 3];
    }
    iPos.needsUpdate = true; iRot.needsUpdate = true;
    mesh.visible = true;
    gems.visible = true;
    // The loop, at the hand, hanging in the plane of the chain's last run.
    const L = 3 * (n - 1);
    _x.set(hand.x - P[L], hand.y - P[L + 1], hand.z - P[L + 2]);
    if (_x.lengthSq() < 1e-8) _x.set(0, 1, 0);
    _x.normalize();
    _y.set(0, 1, 0).cross(_x);
    if (_y.lengthSq() < 1e-6) _y.set(1, 0, 0);
    _y.normalize();
    _z.crossVectors(_x, _y);
    _m.makeBasis(_z, _x, _y);
    loop.quaternion.setFromRotationMatrix(_m);
    loop.position.set(hand.x, hand.y, hand.z).addScaledVector(_x, C.loop * 0.55);
    loop.visible = true;
    // The clasp: from the ring along the first link's run.
    _w.set(P[0] - ring.x, P[1] - ring.y, P[2] - ring.z);
    if (_w.lengthSq() < 1e-8) _w.set(0, -1, 0);
    _w.normalize();
    clasp.position.set(ring.x, ring.y, ring.z).addScaledVector(_w, 0.010);
    clasp.quaternion.setFromUnitVectors(_v.set(0, 1, 0), _w);
    clasp.visible = true;
  }

  function hide() {
    on = false;
    mesh.visible = false; gems.visible = false; loop.visible = false; clasp.visible = false;
  }

  /** The first link's run out of the ring, world — which way the D-ring is pulled. */
  function firstDir(out) {
    const P = sim.P, A = sim.anchor;
    return out.set(P[0] - A[0], P[1] - A[1], P[2] - A[2]).normalize();
  }

  return {
    sim, mesh, gems, loop, clasp, stats,
    get on() { return on; },
    step, hide, firstDir,
    /** Hang it afresh on the next step — after a cut. */
    rehang: () => { rehang = true; },
    /** The worst joint gap now, m, and how far the worst link is inside her. */
    measure: () => {
      sim.measure();
      stats.stretch = sim.stats.maxStretch;
      stats.pen = sim.depth(false);
      return { stretch: sim.stats.maxStretch, sum: sim.stats.sumStretch, pen: stats.pen, penShape: sim.stats.penShape,
        penLink: sim.stats.penLink };
    },
    /** Where each link is, world — for a probe. */
    links: () => Array.from({ length: n }, (_, i) => [sim.P[3 * i], sim.P[3 * i + 1], sim.P[3 * i + 2]]),
    /** How many links lie on the floor (within 5 mm of resting on it). */
    onFloor: () => {
      let c = 0;
      for (let i = 0; i < n; i++) if (sim.P[3 * i + 1] - floorNow - C.rLink < 0.005) c++;
      return c;
    },
  };
}

/**
 * The collar: a strap of black leather round her neck with its edges rounded
 * and stitched, a buckle on her left and the strap's tail through it, and a
 * D-ring at her throat that swings on its bar toward wherever the leash is.
 * `bore` is the inside of it, [out of her throat, across]; the band is built
 * starting at the buckle and going round to it, so `wrap(k)` draws the first
 * k of it — which is how it goes on: laid round her neck from the buckle.
 */
function collarBuild(bore) {
  const G = COLLAR_GEO, S = G.seg;
  const g = new THREE.Group();
  const ax = bore[0], az = bore[1];
  // Round the ellipse from the buckle: the point at angle a (0 her throat,
  // + toward her left, which is -z) and its outward normal.
  const at = (a, r) => [Math.cos(a) * (ax + r), 0, -Math.sin(a) * (az + r)];
  const nrm = (a) => {
    const x = Math.cos(a) / (ax * ax), z = -Math.sin(a) / (az * az), l = Math.hypot(x, z) || 1;
    return [x / l, 0, z / l];
  };
  // The section: a rounded rectangle, `thick` out and `wide` up, twelve
  // points. Its inside face on the bore.
  const H = G.wide / 2, T = G.thick, R = G.round;
  const sec = [];
  for (let q = 0; q < 4; q++) {
    // Corners: outside top, inside top, inside bottom, outside bottom.
    const cx = q === 0 || q === 3 ? T - R : R, cy = q < 2 ? H - R : -H + R;
    const a0 = [0, Math.PI / 2, Math.PI, 1.5 * Math.PI][q];
    for (let j = 0; j <= 2; j++) {
      const a = a0 + (j / 2) * Math.PI / 2;
      sec.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R, Math.cos(a), Math.sin(a)]);
    }
  }
  const P = sec.length;
  const pos = [], nor = [], col = [];
  const start = G.buckle, span = Math.PI * 2 + G.tail;
  const quad = (A, B, Cc, D) => { for (const v of [A, B, Cc, A, Cc, D]) { pos.push(v[0], v[1], v[2]); nor.push(v[3], v[4], v[5]); col.push(v[6], v[7], v[8]); } };
  const vert = (a, s, over) => {
    const o = nrm(a), c = at(a, s[0] + over);
    const cc = G.leather;
    return [c[0], s[1], c[2], o[0] * s[2], s[3], o[2] * s[2], cc[0], cc[1], cc[2]];
  };
  // The band — segment by segment from the buckle, so a draw range is a
  // length of strap. The tail runs on past the buckle, a strap's thickness
  // further out, over the start of itself.
  const segs = Math.round(S * span / (Math.PI * 2));
  const perSeg = 6 * P;
  for (let i = 0; i < segs; i++) {
    const a0 = start + (i / segs) * span, a1 = start + ((i + 1) / segs) * span;
    const over0 = a0 > start + Math.PI * 2 ? T : 0, over1 = a1 > start + Math.PI * 2 ? T : 0;
    for (let q = 0; q < P; q++) {
      const s0 = sec[q], s1 = sec[(q + 1) % P];
      quad(vert(a0, s0, over0), vert(a1, s0, over1), vert(a1, s1, over1), vert(a0, s1, over0));
    }
  }
  // The tail's end, closed, and the strap's start under the buckle.
  const endCap = (a, over, flip) => {
    const c = sec.map((s) => vert(a, s, over));
    const o = nrm(a), tx = -Math.sin(a), tz = -Math.cos(a);
    const mid = [0, 0, 0];
    for (const v of c) { mid[0] += v[0] / P; mid[1] += v[1] / P; mid[2] += v[2] / P; }
    const tl = Math.hypot(tx, tz) || 1, sg = flip ? -1 : 1;
    const cn = [tx / tl * sg, 0, tz / tl * sg];
    for (let q = 0; q < P; q++) {
      const A = c[q], B = c[(q + 1) % P];
      const tri = flip ? [mid, B, A] : [mid, A, B];
      for (const v of tri) { pos.push(v[0], v[1], v[2]); nor.push(cn[0], cn[1], cn[2]); col.push(G.leather[0], G.leather[1], G.leather[2]); }
    }
    void o;
  };
  endCap(start, 0, true);
  endCap(start + span, T, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aVCol', new THREE.Float32BufferAttribute(col, 3));
  // THE STITCHING, in the shader, off the band's own frame: a line of dashes
  // 3.4 mm in from each edge, on the outer face only, 4.2 mm a stitch. And a
  // little grain in the leather so the sun on it is a sheen and not a sheet.
  // (No backticks in the GLSL.)
  const bandMat = solidMaterial(0xffffff, {
    spec: 0.24, specPower: 26, side: THREE.DoubleSide,
    uniforms: { uCollar: { value: new THREE.Vector4(ax, az, H, T) },
      uStitch: { value: new THREE.Color(...G.stitch) } },
    decl: 'uniform vec4 uCollar; uniform vec3 uStitch;',
    body: [
      '  base *= vVCol;',
      '  {',
      '    vec2 e = vLocal.xz / uCollar.xy;',
      '    float rr = length(e);',
      '    float outer = step(1.0 + 0.8 * uCollar.w / uCollar.x, rr);',
      '    float ang = atan(-e.y, e.x);',
      '    float L = ang * 0.5 * (uCollar.x + uCollar.y);',
      '    float edge = 1.0 - smoothstep(0.00045, 0.0008, abs(abs(vLocal.y) - (uCollar.z - 0.0034)));',
      '    float dash = step(fract(L / 0.0042), 0.55);',
      '    base = mix(base, uStitch, outer * edge * dash);',
      '    float gr = fract(sin(dot(floor(vec2(L, vLocal.y) * 1400.0), vec2(12.9898, 78.233))) * 43758.5453);',
      '    base *= 0.92 + 0.16 * gr;',
      '    spec *= 0.8 + 0.4 * gr;',
      '  }',
    ].join('\n'),
  });
  const band = new THREE.Mesh(geo, bandMat);
  band.frustumCulled = false;
  g.add(band);
  const total = pos.length / 3, bandVerts = segs * perSeg;

  // ── the buckle: a frame standing on the strap where it closes, a prong
  // through it, and a keeper loop behind ─────────────────────────────────
  const metalMat = solidMaterial(new THREE.Color(...G.metal), { vcol: false, spec: 0.85, specPower: 90 });
  const buckle = new THREE.Group();
  {
    const bx = 0.0026, bl = 0.022, bw = G.wide * 0.5 + 0.0022, lift = T + bx * 0.5 + 0.0004;
    const box = (sx, sy, sz, x, y, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), metalMat);
      b.position.set(x, y, z);
      buckle.add(b);
    };
    // In a frame where x is out of her neck, y up it and z along the strap.
    box(bx, 2 * bw + bx, bx, lift, 0, -bl / 2);
    box(bx, 2 * bw + bx, bx, lift, 0, bl / 2);
    box(bx, bx, bl, lift, bw, 0);
    box(bx, bx, bl, lift, -bw, 0);
    box(bx * 0.8, bx * 0.8, bl * 0.9, lift + bx * 0.6, 0, 0.001);   // the prong
    box(bx * 0.7, G.wide + 0.004, 0.004, T + 0.0028, 0, bl * 0.5 + 0.009);   // the keeper
  }
  {
    const a = start + 0.012;
    const c = at(a, 0), o = nrm(a);
    buckle.position.set(c[0], 0, c[2]);
    // x out (the normal), y up, z along the strap (the tangent round).
    const xo = new THREE.Vector3(o[0], 0, o[2]), yo = new THREE.Vector3(0, 1, 0);
    const zo = new THREE.Vector3().crossVectors(xo, yo);
    buckle.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xo, yo, zo));
  }
  g.add(buckle);

  // ── the D-ring at her throat, on a bar along the strap ───────────────
  // Its pivot is the bar, on the outside of the strap at the front; the D is
  // built with its bar along z through the origin and its curve out along +x,
  // and turned about z to hang (-y) or point wherever the leash is.
  const dPivot = new THREE.Group();
  dPivot.position.set(ax + T + G.dWire, -G.wide * 0.16, 0);
  const D = new THREE.Group();
  {
    const w = G.dWire, half = G.dBar / 2, reach = G.dReach;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(w, w, G.dBar, 8), metalMat);
    bar.rotation.x = Math.PI / 2;
    D.add(bar);
    // Two straight sides out from the bar's ends, and a half-circle joining them.
    const side = reach - half;
    for (const sz of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(w, w, side, 8), metalMat);
      s.rotation.z = Math.PI / 2;
      s.position.set(side / 2, 0, sz * half);
      D.add(s);
    }
    // The torus's own x along the bar (z) and its y out along the D (+x), so
    // its half turn runs from one side round the far end to the other.
    const arc = new THREE.Mesh(new THREE.TorusGeometry(half, w, 6, 14, Math.PI), metalMat);
    arc.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)));
    arc.position.set(side, 0, 0);
    D.add(arc);
    // The strap's keeper over the bar: a little leather tab.
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, G.dBar * 0.72),
      solidMaterial(new THREE.Color(...G.leather), { vcol: false, spec: 0.2, specPower: 28 }));
    tab.position.set(-0.002, 0.004, 0);
    dPivot.add(tab);
  }
  dPivot.add(D);
  g.add(dPivot);
  for (const o of g.children) o.frustumCulled = false;
  g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  const tip = new THREE.Vector3();

  return {
    group: g, band, buckle, dPivot, D,
    /** The first `k` (0..1) of the strap drawn, from the buckle round. */
    wrap(k) {
      k = Math.max(0, Math.min(1, k));
      if (k >= 1) { geo.setDrawRange(0, total); band.visible = true; return; }
      const nv = Math.floor(bandVerts * k / perSeg) * perSeg;
      geo.setDrawRange(0, nv);
      band.visible = nv > 0;
    },
    /** Turn the D on its bar, rad: 0 straight out of her throat, −π/2 hanging. */
    swing(a) { D.rotation.z = a; },
    /** The D's far point — where the clasp is — in the collar's frame, into `out`. */
    tipLocal(out) {
      const r = G.dReach + G.dWire;
      return out.set(dPivot.position.x + Math.cos(D.rotation.z) * r,
        dPivot.position.y + Math.sin(D.rotation.z) * r, 0);
    },
    /** The D's far point, world (the group must have its matrix). */
    tipWorld(out) { return this.tipLocal(out).applyMatrix4(g.matrixWorld); },
    _tip: tip,
  };
}
