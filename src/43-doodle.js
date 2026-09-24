// -----------------------------------------------------------------------------
// The Slow Doodle, on the promenade at Jadrija.
//
// Misha, 23 Sep 2026: *"put the Slow Doodle creature on the jadrija promenade.
// the creature should walk around, kinda without too much purpose but creating
// a certain presence, and occasionally cycle through one of its skills .. the
// 'lazy sway', the 'long yawn', ... it should just kinda randomly occasionally
// go from one thing to another, later we will have more tasks for him"*.
//
// He is the creature on slowdoodle.html — a black doberman-built dog with a
// flame-orange mane, a gold breastplate and gold boots — brought in through the
// same door as the pug and the cat: a skinned .fr3d v5 made from the viewer's
// own GLB by tools/slowdoodle/game.py, drawn by `skinnedFigure`, lit by the
// same `solidMaterial` as the concrete he walks on. Nothing about the viewer's
// renderer comes with him; see the note in tools/slowdoodle/fr3d.py.
//
// Credits, carried from the viewer: body, rig and animation are "Wolf" by
// Quaternius, CC0 1.0; the mane's strand texture is from the MakeHuman
// community hair01 pack, CC0. The rest was made in this repository.
//
// ── what he does ─────────────────────────────────────────────────────────────
//
// Nothing much, on purpose, and that is the brief. Four modes:
//
//   wander   drift to somewhere nearby that is clear, at a slow walk
//   skill    stand and do one of his things; sometimes another after it
//   pause    stand, between things
//   task     reserved — a caller has him; see `api.task`
//
// The wandering is a point picked at random inside his stretch of deck, kept
// only if the straight line to it clears every blocker the person collider
// knows about (`blockedAt`, the same list), so he walks round benches and
// parasols by never choosing a line through one. Stopping is scheduled, not
// reactive: a leg of walk sometimes ends early and he does something where he
// stands. If somebody is in his way — you, Baye, a bather, a bicycle — he stops
// and waits for them; a dog this slow does not step round people, people step
// round him.
//
// The gallop is his joke and it stays one: "hurry (no)" on the viewer. Very
// rarely he starts one, thinks better of it inside a stride, and yawns.
//
// The state machine is a `mode` and a `timer` and nothing that knows about the
// promenade beyond what `J` hands in, so a task later is a new mode.
//
// NO BACKTICKS IN THE GLSL BELOW. A backtick in a shader comment ends the
// template literal and the build with it.
// -----------------------------------------------------------------------------

const DOODLE = {
  // m/s his paws cover with the walk clip at rate 1 — measured off the clip by
  // tools/slowdoodle/fr3d.py (the mean of the four paws' fore-aft travel over
  // the cycle). Everything moving him divides by this, so his legs and the
  // ground agree at whatever pace he goes. Change the bake, change this.
  walk: 0.568,
  // The rate the walk is played at. 0.55 on the viewer, "slow walk": he is the
  // slow doodle. 0.6 here is 0.34 m/s over the ground, which is a dog out for
  // no reason at all.
  rate: 0.6,
  turn: 0.85,              // rad/s — a big dog in no hurry comes round slowly
  near: 110,               // past this he is not posed and does not move
  // His stretch of deck: how far along the shore either side of home he goes,
  // and the band across it he keeps to. 9.6 is 1.2 m inland of the kerb down
  // to the middle terrace, so he never walks off the promenade into the sea
  // steps; 16.2 is a metre short of the front row of kabine.
  span: 16,
  s: [9.6, 16.2],
  leg: [3.0, 11.0],        // how far one wander goes, metres
  // Clearance, in metres, from any blocker box: along a route (half his
  // width and a margin) and at a place he will stand and turn (half his
  // length, because standing there he can end up pointing any way).
  padPath: 0.45,
  padStop: 0.80,
  // How often a leg ends early for no reason and he does a thing where he is.
  stopEarly: 0.30,
  // After a skill, the chance he goes straight into another one.
  chain: 0.45,
  pause: [0.8, 3.5],       // standing about between things, seconds
  // Bodies he waits for: how far ahead of his chest he looks, and how wide.
  wait: { ahead: 1.1, r: 0.55, every: 0.25 },
  // Where he is solid to you: two discs along his back.
  disc: { r: 0.26, off: 0.34, top: 0.95 },
  // HIS NOSE IN THE KABINA. Misha, 24 Sep 2026: *"slow-doodle, he should
  // periodically, like maybe once every 5 minutes or so, insert his muzzle
  // inside the kabine to see what's going on in there"*. Every `peekEvery`
  // seconds (a range, so it is not a clock) he goes to the door, faces it,
  // and edges in until his root is `peekIn` short of the doorway — which, a
  // muzzle being about three quarters of a metre ahead of his root, puts his
  // nose some thirty centimetres inside — has a look for `peekLook`, and
  // goes back to his stretch. His body stays on the deck; only his head goes
  // through the curtain.
  peekEvery: [240, 360],
  peekIn: 0.12,
  peekLook: [6, 10],
  // Mesh lift. The walk and the clover carry his paws up to 28 mm under the
  // floor he was placed on (fr3d.py prints the lowest vertex of each clip) —
  // a cuff edge at the bottom of a stride. The idle is 6 mm under. Split
  // between the two so neither floats nor sinks visibly.
  lift: 0.012,
  // How far his head comes round to you, and from how near.
  look: { r: 4.5, max: 0.75, rate: 2.4 },
};

/**
 * What he can do, as the viewer names them. `clip` and `rate` are the viewer's
 * own numbers; `loops` is how many times round a looping clip goes before he
 * thinks of something else, `w` how likely he is to think of it.
 */
const DOODLE_SKILLS = {
  idle: { clip: 'idle', label: 'idle', rate: 1.0, loops: [1, 2.5], w: 2.5 },
  sway: { clip: 'sway', label: 'lazy sway', rate: 1.0, loops: [1, 2], w: 3.0 },
  yawn: { clip: 'yawn', label: 'big yawn', rate: 1.0, once: true, w: 1.6 },
  gaze: { clip: 'gaze', label: 'soulful gaze', rate: 1.0, loops: [1, 2], w: 2.4 },
  clover: { clip: 'clover', label: 'the clover', rate: 0.8, loops: [2, 4], w: 2.0 },
  breeze: { clip: 'breeze', label: 'the breeze', rate: 1.0, loops: [1, 3], w: 2.4 },
  // "hurry (no)". A stride and a half of gallop on the spot and then a yawn:
  // he considered it.
  hurry: { clip: 'gallop', label: 'hurry (no)', rate: 0.8, secs: 0.62, then: 'yawn', w: 0.18 },
};

/** The things he can do with his head turned to you. */
const DOODLE_LOOKS = { idle: 1, sway: 1, breeze: 1 };

/**
 * The palette the body's fragment switches on, in the order fr3d.py numbers
 * the materials (`PALETTE` there). Colours are the game's own space — sRGB
 * bytes read as linear, like every vertex colour here — and not the viewer's.
 * `spec` is the sun lobe and `env` the sky mirror; gold is mostly the second.
 */
const DOODLE_PAL = [
  { name: 'coat', c: 0x19181a, spec: 0.16, env: 0.05 },
  { name: 'coat-light', c: 0x2a221c, spec: 0.14, env: 0.04 },
  { name: 'eyes', c: 0x3a0e08, spec: 0.90, env: 0.35 },
  { name: 'nose', c: 0x0a0909, spec: 0.55, env: 0.12 },
  { name: 'gold', c: 0xc98a1c, spec: 1.10, env: 0.30 },
  { name: 'gem', c: 0xe0152e, spec: 1.20, env: 0.30 },
  { name: 'mouth', c: 0x2a0b0c, spec: 0.10, env: 0.0 },
  { name: 'teeth', c: 0xece3cc, spec: 0.35, env: 0.08 },
  { name: 'tongue', c: 0xb04a58, spec: 0.45, env: 0.10 },
];

function doodleBodyGLSL() {
  const v3 = (hex) => 'vec3(' + [16, 8, 0].map((k) => (((hex >> k) & 255) / 255).toFixed(4)).join(', ') + ')';
  let s = 'float dId = floor(vUv.x + 0.5);\n';
  DOODLE_PAL.forEach((p, i) => {
    s += (i ? 'else ' : '') + 'if (dId < ' + (i + 0.5).toFixed(1) + ') { base = ' + v3(p.c)
      + '; spec = ' + p.spec.toFixed(3) + '; env = ' + p.env.toFixed(3) + '; }\n';
  });
  return s;
}

/**
 * Build him. `J` is what the promenade lends him:
 *
 *   toWorld(t, s), rigYaw(t, ang)   the shore frame, from 43-jadrija.js
 *   blockers                        the person collider's own boxes, (t, s)
 *   others(x, z, pad, fn)           everybody near (x, z) who is not him
 *   home                            the t his stretch is centred on
 *
 * Returns null when there is no payload, so the promenade is exactly what it
 * was without him.
 */
async function buildDoodle(scene, J) {
  if (typeof PAYLOAD === 'undefined' || !PAYLOAD.doodle_fr3d) return null;
  const hairTex = v5Tex('doodle_hair');
  const fig = await loadSkin('doodle_fr3d', {
    spec: 0.16, specPower: 36,
    body: doodleBodyGLSL(),
    parts: {
      // The mane and the tuft: alpha-cut cards, dyed by the strand texture's
      // luminance the way the viewer does it — orange at the root, the tips
      // pushed toward yellow — with a little lift of its own, because in the
      // picture the mane is backlit and burns. A discard and not a blend, so
      // the cards sort against each other without a sorted pass.
      mane: {
        color: 0xffffff, side: THREE.DoubleSide, spec: 0.22, specPower: 24,
        emissive: 0.30,
        uniforms: { uHair: { value: hairTex } },
        decl: 'uniform sampler2D uHair;',
        body: [
          'vec4 hc = texture2D(uHair, vUv);',
          'if (hc.a < 0.42) discard;',
          'float hl = hc.r;',
          // v is 0 at the root and 1 at the tip in Blender UVs.
          'vec3 dye = mix(vec3(1.00, 0.46, 0.10), vec3(1.00, 0.80, 0.42), smoothstep(0.45, 1.0, vUv.y));',
          'base = dye * (0.50 + 0.95 * hl);',
        ].join('\n'),
      },
    },
  });
  if (!fig) return null;
  const mesh = fig.mesh;
  mesh.name = 'slow-doodle';
  scene.add(mesh);

  const rnd = (a, b) => a + Math.random() * (b - a);
  // Whether a positive bearing in (t, s) is a positive turn of the rig about
  // y. It depends on which way round the shore frame is, which is a fact
  // about the coastline, so it is asked of `rigYaw` and not assumed.
  const ySign = Math.sign(Math.sin(J.rigYaw(J.home, 0.1) - J.rigYaw(J.home, 0))) || 1;
  const home = J.home;
  const t0 = home - DOODLE.span, t1 = home + DOODLE.span;

  const d = {
    fig, mesh, tris: fig.tris,
    t: home, s: (DOODLE.s[0] + DOODLE.s[1]) * 0.5, head: Math.PI * 0.5,
    mode: 'pause', timer: 1.0,
    skill: null, skillLeft: 0, queue: [],
    path: null, wp: 0, stopAt: Infinity, walked: 0,
    waiting: 0, waitCheck: 0, blocked: null,
    look: 0, lookWant: 0,
    far: false, dist: 0, bumped: 0, who: null, pickMs: 0,
    task: null,
    peekIn: rnd(60, 120),     // the first one sooner, so it is seen at all
    pk: null, pkT: 0,
    log: [],                  // the last few things he did, newest last
    counts: {},               // and how often each has come up
  };

  // ── where he may go ───────────────────────────────────────────────────────

  // The blockers that can matter to him, cut out of the promenade's list once
  // a leg rather than once a sample. A leg's search is a couple of dozen
  // candidate lines of a few dozen samples each, and asking all five hundred
  // blockers on the shore at every one of them is a frame hitch for boxes
  // two hundred metres away. The same box test as `blockedAt`, on fewer boxes.
  let mine = [];
  function gather() {
    mine = J.blockers.filter((b) => !b.off && b.a >= 0 && b.c >= 0
      && b.t + b.a + b.c > t0 - 3 && b.t - b.a - b.c < t1 + 3);
  }
  function clearAt(t, s, pad) {
    for (const b of mine) {
      const co = b.rot ? Math.cos(b.rot) : 1, sn = b.rot ? Math.sin(b.rot) : 0;
      const dt0 = t - b.t, ds0 = s - b.s;
      if (Math.abs(dt0 * co + ds0 * sn) < b.a + pad
        && Math.abs(-dt0 * sn + ds0 * co) < b.c + pad) return false;
    }
    return true;
  }

  /** Does the straight line from here to (t, s) clear everything? */
  function lineClear(ta, sa, tb, sb) {
    const L = Math.hypot(tb - ta, sb - sa);
    const n = Math.max(1, Math.ceil(L / 0.3));
    for (let k = 1; k <= n; k++) {
      const u = k / n;
      if (!clearAt(ta + (tb - ta) * u, sa + (sb - sa) * u, DOODLE.padPath)) return false;
    }
    return clearAt(tb, sb, DOODLE.padStop);
  }

  /** Somewhere to drift to. Null if nowhere nearby is clear. */
  function pickGoal() {
    gather();
    for (let k = 0; k < 24; k++) {
      const a = Math.random() * TAU;
      // Along the shore more than across it: the deck is long and narrow and
      // a dog on it ambles along it. And back toward home the further out he
      // has got, so he is somewhere different each time you look and never
      // somewhere else entirely.
      const r = rnd(DOODLE.leg[0], DOODLE.leg[1]);
      let tt = d.t + Math.cos(a) * r - (d.t - home) * 0.35;
      const ss = clamp(d.s + Math.sin(a) * r * 0.45, DOODLE.s[0], DOODLE.s[1]);
      tt = clamp(tt, t0, t1);
      if (Math.hypot(tt - d.t, ss - d.s) < 1.5) continue;
      if (lineClear(d.t, d.s, tt, ss)) return [tt, ss];
    }
    return null;
  }

  // ── what he does ──────────────────────────────────────────────────────────

  function note(what) {
    d.log.push(what);
    if (d.log.length > 12) d.log.shift();
    d.counts[what] = (d.counts[what] || 0) + 1;
  }

  function pickSkill(not) {
    let tot = 0;
    for (const [k, v] of Object.entries(DOODLE_SKILLS)) if (k !== not) tot += v.w;
    let r = Math.random() * tot;
    for (const [k, v] of Object.entries(DOODLE_SKILLS)) {
      if (k === not) continue;
      r -= v.w;
      if (r <= 0) return k;
    }
    return 'idle';
  }

  /** Start one of his things. Returns false if there is no such thing. */
  function doSkill(name, fade = 0.6) {
    const k = DOODLE_SKILLS[name];
    if (!k || !fig.clips.includes(k.clip)) return false;
    const dur = durs[k.clip] || 3;
    // A one-shot hands back to the idle when it ends, on its own clock. A clip
    // that is already current is not restarted by `play`, which only ever
    // happens to the idle, where there is no top to start from.
    fig.play(k.clip, { fade, next: k.once ? 'idle' : null });
    fig.state.speed = k.rate;
    d.mode = 'skill';
    d.skill = name;
    d.skillLeft = k.secs != null ? k.secs
      : k.once ? dur / k.rate
        : (dur / k.rate) * rnd(k.loops[0], k.loops[1]);
    note(name);
    return true;
  }

  function startWalk(goal) {
    d.path = [goal];
    d.wp = 0;
    d.walked = 0;
    const L = Math.hypot(goal[0] - d.t, goal[1] - d.s);
    d.stopAt = Math.random() < DOODLE.stopEarly ? L * rnd(0.35, 0.75) : Infinity;
    d.mode = 'wander';
    d.skill = null;
    fig.play('walk', { fade: 0.7 });
    note('walk');
  }

  function next() {
    // Something else, or on his way. Never two walks with nothing between:
    // stopping is the point of him.
    if (d.queue.length) { doSkill(d.queue.shift()); return; }
    if (d.mode === 'skill' && Math.random() < DOODLE.chain) {
      doSkill(pickSkill(d.skill));
      return;
    }
    if (d.mode === 'skill') {
      d.mode = 'pause';
      d.skill = null;
      d.timer = rnd(DOODLE.pause[0], DOODLE.pause[1]);
      fig.play('idle', { fade: 0.8 });
      fig.state.speed = 1;
      return;
    }
    const c0 = performance.now();
    const g = pickGoal();
    d.pickMs = Math.max(d.pickMs, performance.now() - c0);
    if (g) startWalk(g);
    else { d.counts.boxedIn = (d.counts.boxedIn || 0) + 1; doSkill(pickSkill(null)); }
  }

  // Durations, read once off the figure: `skinnedFigure` keeps its clips to
  // itself and hands out names, but the current one is on `state.cur`.
  const durs = {};
  for (const k of Object.values(DOODLE_SKILLS)) {
    if (!fig.clips.includes(k.clip)) continue;
    fig.play(k.clip, { fade: 0 });
    if (fig.state.cur) durs[k.clip] = fig.state.cur.dur;
  }
  fig.play('idle', { fade: 0 });
  fig.update(0);

  // ── the step ──────────────────────────────────────────────────────────────

  /** Is anybody standing where he is about to walk? Checked a few times a second. */
  function someoneAhead() {
    const W = DOODLE.wait;
    const p = J.toWorld(d.t + Math.cos(d.head) * W.ahead, d.s + Math.sin(d.head) * W.ahead);
    let hit = null;
    // You first, who are not in the collider's list of bodies — it is the list
    // of things YOU are pushed out of — and are the likeliest thing in his way.
    if (d.who && Math.hypot(d.who.t - (d.t + Math.cos(d.head) * W.ahead),
      d.who.s - (d.s + Math.sin(d.head) * W.ahead)) < W.r + 0.30) return 'you';
    J.others(p[0], p[2], W.r, (b) => {
      const dx = b.x - p[0], dz = b.z - p[2];
      if (!hit && Math.hypot(dx, dz) < W.r + b.r) hit = b.kind;
    });
    return hit;
  }

  function turnToward(ang, dt) {
    let e = ang - d.head;
    while (e > Math.PI) e -= TAU;
    while (e < -Math.PI) e += TAU;
    d.head += Math.sign(e) * Math.min(Math.abs(e), DOODLE.turn * dt);
    return e;
  }

  function walkStep(dt) {
    // Wandering with nowhere to go: a skill that declined (its clip missing,
    // or already the one playing) leaves the mode where it was and the path
    // gone. That is a pause, not a crash in the crowd's frame.
    if (!d.path || !d.path[d.wp]) { d.path = null; d.mode = 'pause'; d.timer = 0.5; return; }
    const g = d.path[d.wp];
    const dtt = g[0] - d.t, dss = g[1] - d.s;
    const gap = Math.hypot(dtt, dss);
    if (gap < 0.12 || d.walked >= d.stopAt) {
      d.path = null;
      // Arrived, or stopped on the way: one of his things, where he stands.
      doSkill(pickSkill(null), 0.8);
      return;
    }
    d.waitCheck -= dt;
    if (d.waitCheck <= 0) {
      d.waitCheck = DOODLE.wait.every;
      d.blocked = someoneAhead();
    }
    const e = turnToward(Math.atan2(dss, dtt), dt);
    // Round a big error in a tight arc at a creep rather than spinning on the
    // spot: legs that step while the body turns read as a dog turning, and a
    // body rotating over still legs reads as a statue on a turntable.
    const k = d.blocked ? 0 : clamp(Math.cos(e), 0.18, 1);
    const v = DOODLE.walk * DOODLE.rate * k;
    if (d.blocked) {
      // Somebody is in the way. He waits for them to go, idling — and if they
      // do not, he gives up on this way and finds another.
      d.waiting += dt;
      fig.play('idle', { fade: 0.5 });
      fig.state.speed = 1;
      if (d.waiting > 5) { d.waiting = 0; d.path = null; doSkill(pickSkill(null)); }
      return;
    }
    d.waiting = 0;
    fig.play('walk', { fade: 0.5 });
    fig.state.speed = DOODLE.rate * k;
    const step = Math.min(v * dt, gap);
    d.t += Math.cos(d.head) * step;
    d.s += Math.sin(d.head) * step;
    d.walked += step;
  }

  function lookStep(who, dt) {
    // His head comes round to you when you are near and he is not walking.
    // `aim` is in figure space: +y up, so a turn about y is a turn of the neck.
    // Only while he is doing nothing in particular: the gaze, the clover and
    // the yawn are ABOUT where his head goes, and a neck turned to you on top
    // of them is a different thing from the one he is doing.
    let want = 0;
    if (who && (d.mode === 'pause' || (d.mode === 'skill' && DOODLE_LOOKS[d.skill]))) {
      const [wt, ws] = [who.t, who.s];
      const dt0 = wt - d.t, ds0 = ws - d.s;
      if (Math.hypot(dt0, ds0) < DOODLE.look.r) {
        let e = Math.atan2(ds0, dt0) - d.head;
        while (e > Math.PI) e -= TAU;
        while (e < -Math.PI) e += TAU;
        // A bearing in the shore frame, turned into the figure's own sense
        // of a turn about y — measured once below rather than argued.
        if (Math.abs(e) < 2.4) want = clamp(e, -DOODLE.look.max, DOODLE.look.max) * ySign;
      }
    }
    // In the doorway his head goes round the room instead — see the peek.
    if (d.mode === 'peek' && d.pk === 'look') want = d.lookWant * ySign;
    d.look = damp(d.look, want, DOODLE.look.rate, dt);
    fig.aim('Neck1', 0, 1, 0, Math.abs(d.look) > 1e-3 ? d.look * 0.55 : 0);
    fig.aim('Head', 0, 1, 0, Math.abs(d.look) > 1e-3 ? d.look * 0.45 : 0);
  }

  function place() {
    const p = J.toWorld(d.t, d.s);
    mesh.position.set(p[0], p[1] + DOODLE.lift, p[2]);
    mesh.rotation.y = J.rigYaw(d.t, d.head);
  }

  /**
   * One frame. `cam` gates (is anybody close enough to see him); `who` is the
   * person, as (t, s), for the things he does about you.
   */
  // ── the peek ─────────────────────────────────────────────────────────────
  //
  // Four stages: to the front of the door, round to face it, in until his
  // nose is through, a look, and then back to wandering. A stage that cannot
  // be done — the way to the door not clear — gives the peek up for this
  // time and tries again later: he is a dog, not an errand.
  function moveTo(g, dt, rate) {
    const dtt = g[0] - d.t, dss = g[1] - d.s;
    const gap = Math.hypot(dtt, dss);
    if (gap < 0.05) return 0;
    const e = turnToward(Math.atan2(dss, dtt), dt);
    const k = clamp(Math.cos(e), 0.15, 1);
    fig.play('walk', { fade: 0.5 });
    fig.state.speed = rate * k;
    const st = Math.min(DOODLE.walk * rate * k * dt, gap);
    d.t += Math.cos(d.head) * st;
    d.s += Math.sin(d.head) * st;
    return gap - st;
  }

  function startPeek() {
    d.peekIn = rnd(DOODLE.peekEvery[0], DOODLE.peekEvery[1]);
    if (!J.door) return false;
    const front = [J.door[0], J.door[1] - 1.7];
    gather();
    if (!lineClear(d.t, d.s, front[0], front[1])) { note('peek.blocked'); return false; }
    d.mode = 'peek'; d.pk = 'go'; d.pkT = 0; d.path = null; d.skill = null;
    note('peek');
    return true;
  }

  function peekStep(dt) {
    const [dc, face] = J.door;
    d.pkT += dt;
    if (d.pk === 'go') {
      if (moveTo([dc, face - 1.7], dt, DOODLE.rate) < 0.12) { d.pk = 'turn'; d.pkT = 0; }
      if (d.pkT > 90) d.pk = 'back';
    } else if (d.pk === 'turn') {
      // Round to face the doorway, walking the turn rather than spinning.
      fig.play('idle', { fade: 0.5 });
      fig.state.speed = 1;
      if (Math.abs(turnToward(Math.PI * 0.5, dt)) < 0.04) { d.pk = 'in'; d.pkT = 0; }
    } else if (d.pk === 'in') {
      // Slower than a walk: nosing in, not arriving.
      if (moveTo([dc, face - DOODLE.peekIn], dt, DOODLE.rate * 0.6) < 0.03) {
        d.pk = 'look'; d.pkT = 0;
        d.pkFor = rnd(DOODLE.peekLook[0], DOODLE.peekLook[1]);
        fig.play('idle', { fade: 0.6 });
        fig.state.speed = 1;
      }
    } else if (d.pk === 'look') {
      // Looking round the room: the neck swung slowly one way and the other.
      d.lookWant = Math.sin(d.pkT * 0.9) * 0.45;
      if (d.pkT > d.pkFor) { d.pk = 'back'; d.pkT = 0; d.lookWant = 0; }
    } else {
      // Out, and back to where he wanders.
      if (moveTo([dc + 1.5, face - 3.2], dt, DOODLE.rate) < 0.2 || d.pkT > 40) {
        d.pk = null;
        d.mode = 'pause';
        d.timer = rnd(DOODLE.pause[0], DOODLE.pause[1]);
        fig.play('idle', { fade: 0.8 });
        fig.state.speed = 1;
      }
    }
  }

  function step(cam, who, dt) {
    const dx = cam.x - mesh.position.x, dz = cam.z - mesh.position.z;
    d.dist = Math.hypot(dx, dz);
    d.far = d.dist > DOODLE.near;
    if (d.far) return;
    d.who = who;
    if (d.bumped) {
      // Walked into. He stops whatever it was and looks at you about it.
      d.bumped = 0;
      d.path = null;
      d.queue.length = 0;
      doSkill(Math.random() < 0.5 ? 'gaze' : 'sway', 0.4);
    }
    // Time for a look in the kabina — only between things, never mid-walk or
    // mid-skill, and never while a task has him.
    d.peekIn -= dt;
    if (d.peekIn <= 0 && d.mode === 'pause') startPeek();
    if (d.mode === 'task' && d.task && d.task.step) {
      if (d.task.step(d, dt) === false) { d.task = null; d.mode = 'pause'; d.timer = 0.5; }
    } else if (d.mode === 'peek') {
      peekStep(dt);
    } else if (d.mode === 'wander') {
      walkStep(dt);
    } else if (d.mode === 'skill') {
      d.skillLeft -= dt;
      if (d.skillLeft <= 0) {
        const k = DOODLE_SKILLS[d.skill];
        if (k && k.then) { d.queue.unshift(k.then); d.mode = 'pause'; next(); } else next();
      }
    } else {
      d.timer -= dt;
      if (d.timer <= 0) next();
    }
    lookStep(who, dt);
    fig.update(dt);
    place();
  }

  // Somewhere clear to start: his home is a number, and a number can land on
  // a bench.
  gather();
  search: for (let r = 0; r <= 12; r += 0.5) {
    for (const [dt0, ds0] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const ss = clamp(d.s + ds0, DOODLE.s[0], DOODLE.s[1]);
      if (clearAt(d.t + dt0, ss, DOODLE.padStop)) { d.t += dt0; d.s = ss; break search; }
    }
  }
  place();

  // ── the handle a task, a probe or the console gets ──────────────────────
  const api = {
    /** Where he is, what he is doing, and why he is not moving if he is not. */
    stats: () => ({
      t: +d.t.toFixed(2), s: +d.s.toFixed(2), head: +d.head.toFixed(3),
      at: [+mesh.position.x.toFixed(2), +mesh.position.y.toFixed(3), +mesh.position.z.toFixed(2)],
      mode: d.mode, skill: d.skill, peek: d.pk, peekIn: +d.peekIn.toFixed(1),
      label: d.skill ? DOODLE_SKILLS[d.skill].label : d.mode === 'wander' ? 'slow walk' : null,
      playing: fig.playing(), speed: +fig.state.speed.toFixed(3),
      left: +(d.mode === 'skill' ? d.skillLeft : d.timer).toFixed(2),
      goal: d.path ? d.path[d.wp].map((v) => +v.toFixed(2)) : null,
      walked: +d.walked.toFixed(2), blocked: d.blocked, far: d.far,
      dist: +d.dist.toFixed(1), look: +d.look.toFixed(3),
      stretch: [+t0.toFixed(1), +t1.toFixed(1), DOODLE.s[0], DOODLE.s[1]],
      boxes: mine.length, pickMs: +d.pickMs.toFixed(2),
      tris: fig.tris, clips: fig.clips.slice(), log: d.log.slice(), counts: { ...d.counts },
    }),
    skills: () => Object.fromEntries(Object.entries(DOODLE_SKILLS).map(([k, v]) => [k, v.label])),
    /** Make him do one now. `then` queues more after it. */
    skill: (name, ...then) => {
      d.path = null;
      d.queue = then.filter((n) => DOODLE_SKILLS[n]);
      return doSkill(name, 0.4) ? api.stats() : null;
    },
    /** Put him somewhere, facing `head` (radians in the shore frame, +t is 0). */
    place: (t, s, head = null) => {
      d.t = t; d.s = s;
      if (head != null) d.head = head;
      d.path = null; d.mode = 'pause'; d.timer = 1.5;
      fig.play('idle', { fade: 0 });
      place();
      mesh.updateMatrixWorld();
      return api.stats();
    },
    /** Walk him to (t, s) — if the line there is clear; false if it is not. */
    go: (t, s) => {
      gather();
      if (!lineClear(d.t, d.s, t, s)) return false;
      startWalk([t, s]);
      return true;
    },
    /**
     * Hand him over to a task: `{ step(d, dt) }`, called every frame instead of
     * his own routine until it returns false. `d` is his whole state — `t`,
     * `s`, `head`, `fig` — so a task can walk him (`api.go`) or play anything.
     */
    task: (task) => {
      if (!task) { d.task = null; d.mode = 'pause'; d.timer = 0.5; return true; }
      d.task = task; d.mode = 'task'; d.path = null;
      return true;
    },
    /** Hold one frame of one clip, for a still that is the same every time. */
    hold: (clip, at = 0) => {
      if (!fig.clips.includes(clip)) return false;
      fig.play(clip, { fade: 0, from: at });
      fig.state.prev = null;
      fig.state.speed = 0;
      fig.update(0);
      d.mode = 'task'; d.task = { step: () => true };
      return true;
    },
    release: () => api.task(null),
    /** Send him to look in the kabina now (see the peek). */
    peek: () => { d.path = null; d.mode = 'pause'; return startPeek() ? api.stats() : false; },
    nudge: () => { d.bumped = 1; },
    raw: () => d,
  };

  return {
    fig, mesh, api, step,
    /**
     * Him, as the person collider sees him: two discs along his back, pushed
     * through whatever `push(x, z, r, y0, top)` the promenade hands in.
     */
    discs(push) {
      if (d.far) return;
      const y = mesh.position.y;
      const ax = Math.cos(mesh.rotation.y), az = -Math.sin(mesh.rotation.y);
      const D = DOODLE.disc;
      push(mesh.position.x + ax * D.off, mesh.position.z + az * D.off, D.r, y, y + D.top);
      push(mesh.position.x - ax * D.off, mesh.position.z - az * D.off, D.r, y, y + D.top);
    },
    get t() { return d.t; },
    get s() { return d.s; },
    get far() { return d.far; },
    nudge: api.nudge,
  };
}
