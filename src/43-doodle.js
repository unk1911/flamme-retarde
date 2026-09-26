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
// EXCEPT ONCE, ON COMMAND: the slow lick. Misha, 25 Sep 2026: *"if you're
// somewhere near him and say 'lick', the Slow Doodle executes one of his
// superpowers: the slow lick. He runs toward either Baye or toward the
// player, goes for the FACE, and does a slurpy, messy lick-lick-lick. While
// he's licking, the victim laughs uncontrollably from ticklishness"*. The one
// time the slow dog is fast is the gallop in; the joke comes back on the way
// out, which is at his own pace. See `── the slow lick ──` below, `lickHer`
// in 43-jadrija.js for what it does to her, and `doodleLickView` at the
// bottom of this file for what it does to you.
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
 * THE SLOW LICK. See the note at the top of the file and `── the slow lick ──`
 * inside `buildDoodle`. Every length is metres, every angle radians, and the
 * two that are not typed were measured off his own rig in the game.
 */
const DOODLE_LICK = {
  // How near you have to be for him to hear it. His stretch of deck is 32 m
  // long (`span` either side of home), so from the middle of it he hears you
  // at either end with 9 m to spare; from the kabina's door, 12 m west of his
  // home, everywhere but the last few metres of his far end. Past that he is
  // a dog on somebody else's bit of beach.
  hear: 25,
  // And how far he will go for her. The gallop is 3.4 m/s, so 35 m is ten
  // seconds of it, which is as long as a joke about a slow dog being fast can
  // be kept up.
  reach: 35,
  // m/s over the ground at clip rate 1, MEASURED off the clip in the game and
  // not off the formula `walk` uses: a gallop has most of each stride in the
  // air, so the paw's range over the cycle divided by the cycle (1.56 m/s) is
  // less than half of how fast the ground actually goes past under it. The
  // front paw covers 0.46 m of stance in 0.139 s (3.3 m/s) and the hind
  // 0.30 m in 0.07 s (4.2); the clip is 0.417 s round.
  gallop: 3.4,
  rate: 1.05,              // so he runs at 3.6 m/s: a little faster than you walk
  turn: 4.5,               // rad/s while he runs; the wander's 0.85 is a stroll
  // And the last metre: slowing from the gallop into the jump up, rather than
  // arriving at full speed and stopping dead in one frame.
  brake: 1.4,
  up: 0.42,                // s to get up on his hind legs
  licks: 4.0,              // s of it
  hz: 3.4,                 // licks a second
  down: 0.55,              // s back down on all fours
  off: [3.5, 6.0],         // and how far he saunters away after
  offRate: 0.5,            // at a slower walk than even his own
  give: 24,                // s from the command to giving up on a moving target
  // THE POSE, as one number `s` from -1 to 1, solved every frame for the
  // height her face is at. s > 0 is up on his hind legs: the body pitched up
  // by s * `pitch` about his hips, the hind legs and the tail given back what
  // the body took so they still stand and hang the way the clip has them, the
  // neck bent back down by `neck` of the pitch so his muzzle comes at a face
  // and not at the sky, and the forelegs reached forward (`paws`, until
  // `pawsOn` puts them on her shoulders). s < 0 is his head down to somebody
  // lying: the neck alone, `bow` at -1. MEASURED, nose above the floor his
  // hind paws are on: 0.34 m at -1, 0.81 at 0 (his own height standing),
  // 1.50 at 1 — of which 0.11 is `hind`, the hind legs straightening; with
  // them left bent as the clip has them he topped out at 1.37 and her face,
  // bent over him, is at 1.44.
  pitch: 1.40,
  neck: 0.70,
  paws: 0.55,
  hind: 0.50,
  bow: 1.55,
  // How far the tip of his nose stays off the skin, along her face's own
  // normal: the tongue does the touching. A nose 50 mm off with a tongue out
  // 95 mm past his lips reaches across the gap on every stroke.
  gap: 0.05,
  // And further off a face that is looking up at him: his muzzle points
  // down into it, so the jaw opening and the downstroke of the lick both go
  // TOWARD her rather than past her.
  gapDown: 0.10,
  stroke: 0.17,            // rad of head sweep, up the face and back
  tongue: 0.095,           // m out past his lips at the top of a stroke
  jaw: 0.30,               // rad of mouth open, licking
  // In his bind frame, off the mesh (fr3d.py's own materials): the front of
  // the nose leather, and where the tongue comes out between the lips — a
  // little behind the nose and at the line `cut_jaw` in parts.py cut.
  tip: [0.715, 0.800, 0],
  root: [0.655, 0.752, 0],
  // The tongue itself, procedural: his baked one is welded to the floor of
  // his jaw and was only ever meant to be seen during a yawn. Half-width and
  // half-thickness: 48 mm across and 14 mm thick.
  tongueW: 0.024, tongueT: 0.007,
  // Clearance from the furniture along the gallop. Less than the stroll's
  // `padPath`, because a running line is planned once and kept, and the
  // stroll's margin shuts him out of the kabina's doorway (1.45 m clear).
  pad: 0.36,
  // How far short of her face his nose is when he stops running, and when
  // he is back down.
  short: 0.14,
};

/**
 * What the lick is doing to YOUR view — see `doodleLickView` at the bottom of
 * the file. Written by the dog's step, read by the frame loop.
 */
const DOODLE_VIEW = { want: 0, k: 0, t: 0, smear: 0, dipNow: 0, el: null };

/**
 * What to tell you when he will not, keyed off what `api.lick` answers. The
 * ears panel prints these after "doodle: ".
 */
const DOODLE_LICK_WHY = {
  nodog: 'there is no Slow Doodle here',
  far: 'he is too far away to hear you',
  busy: 'he is already licking somebody',
  blocked: 'there is no way through to anybody\'s face',
  // And hers, when she was asked for by name — see `lickWhyNot` in
  // 43-jadrija.js. Asked for either, he just goes for you instead.
  'she.busy': 'she is in the middle of something',
  'she.water': 'she is in the water',
  'she.inside': 'she is in the kabina and you are not',
  'she.gone': 'she is not here',
};

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
 *   local(x, z), walkY(x, z)        world to shore frame, and the floor there
 *   lickFaces()                     who there is to lick — see the slow lick
 *   lickHer(o), slurp, laugh, ...   and what it does to them
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
    // Decoded on the walk over, so it is there when his nose is.
    if (J.hmmWarm) J.hmmWarm();
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
        // His nose is through the curtain: "hmm?". Misha, 25 Sep 2026. Once,
        // here, on the frame he arrives — `d.dist` is how far you are.
        const said = J.hmm ? J.hmm(d.dist) : false;
        note(said ? 'peek.hmm' : 'peek.hmm.silent');
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

  // ── the slow lick ────────────────────────────────────────────────────────
  //
  // Five stages on `d.lk.stage`, all of them `mode` 'lick', which is what
  // takes his neck away from `lookStep` and his mesh away from `place` for
  // the length of it:
  //
  //   go     the gallop, along a route that clears the furniture and goes
  //          through the kabina's door if one of you is in there
  //   up     on to his hind legs, the hind paws planted where he stopped
  //   lick   `licks` seconds of it, the pose solved every frame to her face
  //   down   back on all fours
  //   off    and away, at a walk slower than his own
  //
  // THE REAR IS SOLVED, NOT KEYED. The Wolf has no clip for standing up — the
  // eight in fr3d.py are all four-footed — so it is `aim`s over his idle, and
  // one number `s` says how far (see `pitch` in DOODLE_LICK). Every frame of
  // `up`, `lick` and `down` bisects for the `s` that puts the tip of his nose
  // at the height of the face he is licking, poses him with it, and then puts
  // his MESH where the answer says: hind paws on the floor, nose on the face.
  // So a woman who ducks and sways while she laughs is followed, and nothing
  // in here knows how tall anybody is.
  const LK = DOODLE_LICK;
  const bi = {};
  for (const n of ['Head', 'Jaw', 'Neck1', 'FFB.L', 'FFB.R']) {
    bi[n] = fig.boneIndex(n);
  }
  const REAR_BONES = ['Body', 'BackShoulder.L', 'BackShoulder.R', 'Tail1',
    'FrontUpperLeg.L', 'FrontUpperLeg.R', 'FrontLowerLeg.L', 'FrontLowerLeg.R',
    'BackUpperLeg.L', 'BackUpperLeg.R', 'BackLowerLeg.L', 'BackLowerLeg.R',
    'Neck1', 'Neck2', 'Head', 'Jaw'];
  // Every bone's bind-pose head, composed once off the rest — the same thing
  // `bindHeadsOf` in 43-jadrija.js does for her — so a point measured on his
  // bind mesh can be carried on the bone it belongs to.
  const bindT = [];
  {
    const Q = [];
    fig.bones.forEach((b) => {
      const q = new THREE.Quaternion(b.q[0], b.q[1], b.q[2], b.q[3]);
      const t = new THREE.Vector3(b.t[0], b.t[1], b.t[2]);
      if (b.parent < 0) { bindT.push(t); Q.push(q); } else {
        bindT.push(t.applyQuaternion(Q[b.parent]).add(bindT[b.parent]));
        Q.push(Q[b.parent].clone().multiply(q));
      }
    });
  }
  const _lq = new THREE.Quaternion(), _lq2 = new THREE.Quaternion();
  const _lv = new THREE.Vector3(), _lw = new THREE.Vector3();
  /** A bind-frame point on bone `i`, where the pose has put it, figure space. */
  function onBone(i, p, out) {
    _lv.set(p[0], p[1], p[2]).sub(bindT[i]).applyQuaternion(fig.boneTurn(i, _lq));
    return fig.boneAt(i, out).add(_lv);
  }

  /**
   * The rear, as aims. `ph` is where in a stroke he is and `on` how much he
   * is licking at all. All turns are about figure z, which is his lateral
   * axis: +x is where his nose points and +y is up, so a positive turn is
   * nose-up. Aims compose down the chain, so the hind legs' −θ undoes the
   * body's +θ and leaves them standing as the clip has them, only lower and
   * further back — which `lkPose` then puts back on the floor.
   */
  function rearAims(s, ph = 0, on = 0) {
    const up = Math.max(0, s);
    const th = up * LK.pitch;
    const nk = th * LK.neck + Math.max(0, -s) * LK.bow;
    // Up the face and back once a stroke: chin first, and the head leading.
    // Half of it with his head down to somebody lying: there the bottom of
    // the stroke is his muzzle going INTO the face under him, and at the full
    // sweep the tip of his tongue started 4 cm behind her lips' plane.
    const sw = on * LK.stroke * (s < 0 ? 0.5 : 1) * Math.sin(ph * TAU - Math.PI * 0.5);
    fig.aim('Body', 0, 0, 1, th);
    fig.aim('BackShoulder.L', 0, 0, 1, -th);
    fig.aim('BackShoulder.R', 0, 0, 1, -th);
    // The tail most of the way back, not all: stood up, a dog's tail hangs
    // behind him, not along the line of a spine that is now vertical.
    fig.aim('Tail1', 0, 0, 1, -th * 0.7);
    fig.aim('FrontUpperLeg.L', 0, 0, 1, up * LK.paws);
    fig.aim('FrontUpperLeg.R', 0, 0, 1, up * LK.paws);
    // Up on them, the hind legs straighten: the long middle bone swung
    // toward the vertical and the one under it given most of that back, so
    // the paw is still under the hock. That is 8 cm of height at the top.
    for (const sd of ['L', 'R']) {
      fig.aim('BackUpperLeg.' + sd, 0, 0, 1, up * LK.hind);
      fig.aim('BackLowerLeg.' + sd, 0, 0, 1, -up * LK.hind * 1.5);
    }
    fig.aim('Neck1', 0, 0, 1, -nk * 0.45);
    fig.aim('Neck2', 0, 0, 1, -nk * 0.30);
    fig.aim('Head', 0, 0, 1, -nk * 0.25 + sw);
    // And his mouth, less of it head down for the same reason.
    fig.aim('Jaw', 0, 0, 1, -on * LK.jaw * (s < 0 ? 0.6 : 1) * (0.75 + 0.25 * Math.sin(ph * TAU)));
  }
  function rearClear() { for (const n of REAR_BONES) fig.aim(n, 0, 1, 0, 0); }

  /** Pose him at `s` and read back his nose tip and his hind paws, figure space. */
  const M = { nx: 0, ny: 0, nz: 0, hx: 0, hy: 0, hz: 0 };
  function measure(s, ph = 0, on = 0) {
    rearAims(s, ph, on);
    fig.update(0);
    onBone(bi.Head, LK.tip, _lw);
    M.nx = _lw.x; M.ny = _lw.y; M.nz = _lw.z;
    fig.boneAt(bi['FFB.L'], _lv);
    const ax = _lv.x, ay = _lv.y, az = _lv.z;
    fig.boneAt(bi['FFB.R'], _lv);
    M.hx = (ax + _lv.x) * 0.5; M.hy = (ay + _lv.y) * 0.5; M.hz = (az + _lv.z) * 0.5;
    return M;
  }

  /**
   * How his reach goes with `s`, tabulated once off the idle when he is
   * built: the nose's height above the floor his hind paws are on, and how
   * far ahead of them it is. The route is planned on this, because solving
   * the real pose while he is mid-gallop would be solving it on a gallop.
   */
  let REAR = null;
  function rearTable() {
    const rows = [];
    measure(0);
    const hy0 = M.hy;
    for (let k = 0; k <= 40; k++) {
      const s = -1 + k / 20;
      measure(s);
      rows.push({ s, h: M.ny - M.hy + hy0 + DOODLE.lift, e: M.nx - M.hx });
    }
    rearClear();
    fig.update(0);
    return rows;
  }
  /** Off the table: the `s` and the reach `e` for a nose `h` above the floor. */
  function rearFor(h) {
    const R = REAR;
    if (h <= R[0].h) return R[0];
    for (let k = 1; k < R.length; k++) {
      if (h <= R[k].h) {
        const u = (h - R[k - 1].h) / Math.max(1e-6, R[k].h - R[k - 1].h);
        return { s: lerp(R[k - 1].s, R[k].s, u), h, e: lerp(R[k - 1].e, R[k].e, u) };
      }
    }
    return R[R.length - 1];
  }

  /**
   * The `s` that puts his nose `h` above the floor, solved on the pose he is
   * actually in — the idle breathes, and the table is a still of it. Leaves
   * him posed at the answer, with `M` read off it.
   */
  function solveS(h, hy0) {
    let lo = -1, hi = 1;
    measure(hi);
    if (M.ny - M.hy + hy0 + DOODLE.lift <= h) return hi;
    for (let k = 0; k < 13; k++) {
      const m = (lo + hi) * 0.5;
      measure(m);
      if (M.ny - M.hy + hy0 + DOODLE.lift < h) lo = m; else hi = m;
    }
    return (lo + hi) * 0.5;
  }

  // ── the route ──
  //
  // The same box test the wander uses, against the blockers along the way
  // rather than along his stretch — she can be thirty metres off it — and
  // with the people he is running at as discs, so the gallop goes round her
  // to reach her front and not through her. The last 0.9 m of the route is
  // exempt from the discs: that is where she is.
  let avoid = [];
  // And the cot, when she is lying on it, as a box in (t, s) — see `cot` in
  // `lickFace`. The collider's own box for it is drawn in snug so that YOU
  // can stand against it; a dog's paw on the mattress is on the mattress.
  let avoidBox = null;
  function inBox(t, s, pad) {
    const B = avoidBox;
    return !!B && Math.abs(t - B[0]) < B[2] + pad && Math.abs(s - B[1]) < B[3] + pad;
  }
  /**
   * Is (t, s) somewhere his body can be, as far as the kabina's own walls go?
   * The blocker list cannot answer it — see `room` in 43-jadrija.js — so the
   * big room is asked as a rectangle, with the doorway (1.45 m clear) the one
   * way through its front wall. Only while the big room is the one drawn,
   * which is only while you are in it.
   */
  function roomOK(t, s, pad) {
    const R = J.room ? J.room() : null;
    if (!R || !R.inside) return true;
    if (t < R.t0 - 0.3 || t > R.t1 + 0.3 || s < R.face - 0.35) return true;
    if (s < R.face + 0.35) return Math.abs(t - R.dc) < 0.72 - Math.min(pad, 0.2);
    return t > R.t0 + pad && t < R.t1 - pad && s > R.face + pad && s < R.s1 - pad;
  }
  function gatherSpan(ta, tb) {
    mine = J.blockers.filter((b) => !b.off && b.a >= 0 && b.c >= 0
      && b.t + b.a + b.c > ta && b.t - b.a - b.c < tb);
  }
  function lkLine(a, b, goal) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / 0.25));
    for (let k = 1; k <= n; k++) {
      const u = k / n;
      const t = a[0] + (b[0] - a[0]) * u, s = a[1] + (b[1] - a[1]) * u;
      if (!clearAt(t, s, LK.pad) || inBox(t, s, 0.25) || !roomOK(t, s, 0.3)) return false;
      if (avoid.length && Math.hypot(t - goal[0], s - goal[1]) > 0.9) {
        for (const [at, as, r] of avoid) if (Math.hypot(t - at, s - as) < r) return false;
      }
    }
    return true;
  }
  /** A leg, straight if it can be and round one waypoint if not. */
  function lkLeg(a, b, goal) {
    if (lkLine(a, b, goal)) return [b];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ut = (b[0] - a[0]) / L, us = (b[1] - a[1]) / L;
    for (const off of [1.0, 2.0, 3.2, 4.5]) {
      for (const sg of [1, -1]) {
        const m = [(a[0] + b[0]) * 0.5 - us * off * sg, (a[1] + b[1]) * 0.5 + ut * off * sg];
        if (lkLine(a, m, goal) && lkLine(m, b, goal)) return [m, b];
      }
    }
    return null;
  }
  /** Is (t, s) inside the kabina, as opposed to on the deck in front of it? */
  function inKab(t, s) {
    return !!J.door && s > J.door[1] - 0.05 && Math.abs(t - J.door[0]) < 3.6;
  }
  /** From where he is to `g`, through the kabina's doorway if it is between. */
  function lkRoute(g) {
    gatherSpan(Math.min(d.t, g[0]) - 6, Math.max(d.t, g[0]) + 6);
    const legs = [];
    const a0 = inKab(d.t, d.s), b0 = inKab(g[0], g[1]);
    if (a0 !== b0) {
      const [dc, face] = J.door;
      const out = [dc, face - 0.9], inn = [dc, face + 0.9];
      if (a0) legs.push(inn, out); else legs.push(out, inn);
    }
    legs.push(g);
    const path = [];
    let a = [d.t, d.s];
    for (const b of legs) {
      const seg = lkLeg(a, b, g);
      if (!seg) return null;
      path.push(...seg);
      a = b;
    }
    return path;
  }

  // ── the plan ──
  //
  // Where to stand so that, up on his hind legs, his nose is on the face:
  // `rearFor` gives the reach `e` for her face's height, so his hind paws go
  // `e` back from it along `n`, the way he is coming from. `n` is tried in a
  // fan round the obvious one until his footprint is clear and a route there
  // exists. For somebody lying down his footprint must also keep off her —
  // he stands beside her with his head over her, not on her.
  /** The point the tip of his nose goes to, and which way off it he stands. */
  function aimOf(F) {
    // Her: `gap` off her skin along her face's own normal, and a centimetre
    // under the middle of her mouth: the tongue comes out under his nose and
    // curls up as it goes, so aimed there it works her mouth, her chin and
    // her nose. Aimed 2.5 cm higher it spent half of each stroke on her eyes.
    // You: 21 cm in front of your eye and 2 under it — your face is the
    // camera, and his is going to fill it, the tongue coming up out of the
    // bottom of the frame at you. Aimed 7 cm under, the first cut, what
    // filled it was the top of his skull; level at 17 cm, the tongue alone
    // filled it and you could not see who it belonged to.
    if (F.who === 'you') {
      return { x: F.x + F.fx * 0.21, y: F.y - 0.02 - DOODLE_VIEW.dipNow, z: F.z + F.fz * 0.21 };
    }
    const g = F.lying ? LK.gapDown : LK.gap;
    return { x: F.x + F.fx * g, y: F.y - 0.01 + F.fy * g, z: F.z + F.fz * g };
  }
  function footClear(hx, hz, nx, nz, s, F) {
    // His hind paws, his middle, and his front paws if they are on the floor
    // — stood up, they are on her — each with its own margin off the cot: a
    // front leg may stand against the side of it, a hind quarter may not.
    const pts = [[hx, hz, 0.15], [hx - nx * 0.25, hz - nz * 0.25, 0.10]];
    if (s < 0.35) pts.push([hx - nx * 0.55, hz - nz * 0.55, 0.02]);
    for (const [x, z, pad] of pts) {
      const [t, s2] = J.local(x, z);
      if (!clearAt(t, s2, 0.18) || inBox(t, s2, pad) || !roomOK(t, s2, 0.28)) return false;
      if (F.body) for (const [bx, bz] of F.body) if (Math.hypot(x - bx, z - bz) < 0.30) return false;
    }
    return true;
  }
  function planFor(F, keepN = null) {
    const T = aimOf(F);
    let fans = F.who === 'you' ? [0, 0.4, -0.4, 0.8, -0.8]
      : [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5];
    // Which way is "from him": for you, the way you are looking, so he comes
    // at you from in front and you see him coming; for her, from where he is.
    let bx = F.who === 'you' ? F.fx : mesh.position.x - T.x;
    let bz = F.who === 'you' ? F.fz : mesh.position.z - T.z;
    // Lying down, from her side at her head, or past the top of it: across
    // her body from the side of it, never along it from her feet. Her body's
    // line is her face to her pelvis, and the fan goes from square to it
    // round over her crown to square on the other side.
    if (F.lying && F.body && F.body.length) {
      const ax = F.body[0][0] - T.x, az = F.body[0][1] - T.z;
      const al = Math.hypot(ax, az) || 1;
      // Square to her, on his own side of her first.
      bx = -az / al; bz = ax / al;
      if (bx * (mesh.position.x - T.x) + bz * (mesh.position.z - T.z) < 0) { bx = -bx; bz = -bz; }
      const over = Math.atan2(-(bx * az - bz * ax) / al, -(bx * ax + bz * az) / al);
      fans = [0, over * 0.5, over, Math.PI, Math.PI - over * 0.5];
    }
    avoidBox = F.cot || null;
    if (keepN) { bx = keepN[0]; bz = keepN[1]; }
    const bl = Math.hypot(bx, bz) || 1;
    bx /= bl; bz /= bl;
    const [ft, fs] = J.local(T.x, T.z);
    gatherSpan(Math.min(d.t, ft) - 6, Math.max(d.t, ft) + 6);
    avoid = F.who === 'you' || !F.lying ? [[F.t, F.s, 0.55]] : [];
    for (const a of keepN ? [0] : fans) {
      const c = Math.cos(a), sn = Math.sin(a);
      const nx = bx * c - bz * sn, nz = bx * sn + bz * c;
      // The floor where he will stand, asked twice because where he stands
      // depends on how high the face is above it.
      let floor = J.walkY(T.x + nx * 0.5, T.z + nz * 0.5);
      let r = rearFor(T.y - floor);
      floor = J.walkY(T.x + nx * r.e, T.z + nz * r.e);
      r = rearFor(T.y - floor);
      const hx = T.x + nx * r.e, hz = T.z + nz * r.e;
      if (!footClear(hx, hz, nx, nz, r.s, F)) continue;
      // His root when he arrives on all fours. NOT under the face: on all
      // fours his nose is 0.91 m ahead of his hind paws and up on her it is a
      // third of that, so a dog that ran to where his hind paws end up would
      // arrive with his head through her. He stops with his nose `LK.short`
      // short of her and the rear carries him the rest — up and forward on
      // to her, which is what a dog jumping up does. His root is `REAR0`
      // ahead of his hind paws.
      const back = REAR[20].e + LK.short;
      const gx = T.x + nx * back - nx * REAR0, gz = T.z + nz * back - nz * REAR0;
      const g = J.local(gx, gz);
      const path = lkRoute(g);
      if (!path) continue;
      return { T, nx, nz, hx, hz, s: r.s, e: r.e, g, path, floor };
    }
    return null;
  }
  let REAR0 = 0.18;

  /**
   * Send him. `who` is 'baye', 'you', or left out for either at random among
   * the ones he can get to. Answers who he went for, or why he did not — a
   * key of DOODLE_LICK_WHY.
   */
  function lickCmd(who = null) {
    // On his way off after one he can be sent again — and turns round and
    // runs, which is the joke told twice. In the middle of one he cannot.
    if (d.mode === 'lick' && d.lk.stage !== 'off') return 'busy';
    const me = d.who;
    if (d.far || !me || Math.hypot(me.t - d.t, me.s - d.s) > LK.hear) return 'far';
    const faces = J.lickFaces ? J.lickFaces() : null;
    if (!faces) return 'blocked';
    const opts = [];
    const her = faces.baye;
    if ((!who || who === 'baye') && her && her.ok
      && Math.hypot(her.t - d.t, her.s - d.s) < LK.reach) {
      const p = planFor(her);
      if (p) opts.push(['baye', her, p]);
    }
    if ((!who || who === 'you') && faces.you) {
      const p = planFor(faces.you);
      if (p) opts.push(['you', faces.you, p]);
    }
    if (!opts.length) {
      // Asked for her by name and she is not to be had: say why.
      if (who === 'baye' && her && !her.ok) return 'she.' + (her.why || 'gone');
      return 'blocked';
    }
    const [w, F, plan] = opts[Math.floor(Math.random() * opts.length)];
    if (d.mode === 'lick') {
      // The one he is walking away from: let her go, and you.
      const L = d.lk;
      if (!L.freed && L.who === 'baye' && J.lickHer) J.lickHer(null);
      if (L.who === 'you') DOODLE_VIEW.want = 0;
      d.lkLast = { who: L.who, all: +L.all.toFixed(2), strokes: L.strokes, trace: L.trace };
    }
    lickStart(w, F, plan);
    return w;
  }

  function lickStart(who, F, plan) {
    d.mode = 'lick'; d.path = null; d.skill = null; d.queue.length = 0;
    d.pk = null; d.task = null; d.look = 0;
    rearClear();
    // The frustum test is the bind pose's sphere, and stood up his head is a
    // metre above where that sphere thinks he is.
    mesh.frustumCulled = false;
    d.lk = { who, F, plan, stage: 'go', t: 0, all: 0, wp: 0, path: plan.path,
      n: [plan.nx, plan.nz], s: 0, k: 0, ph: 0, strokes: 0, re: 0.35,
      hw: null, hw0: null, laughing: false, chase: false, gap: null, tip: null,
      trace: [] };
    fig.play('gallop', { fade: 0.2 });
    fig.state.speed = LK.rate;
    if (J.lickWarm) J.lickWarm();
    if (who === 'baye' && J.lickHer) J.lickHer({ k: 0, to: plan.g });
    note('lick.' + who);
  }

  function lkAbort(why) {
    const L = d.lk;
    note('lick.' + why);
    if (L.stage === 'go') lkOff(); else { L.stage = 'down'; L.t = 0; L.chase = false; }
  }

  function lkReplan() {
    const L = d.lk;
    const faces = J.lickFaces ? J.lickFaces() : null;
    const F = faces && faces[L.who === 'you' ? 'you' : 'baye'];
    if (!F || (L.who === 'baye' && !F.ok)) { L.why = F ? F.why : 'none'; return false; }
    L.F = F;
    // The same side of her as before while he is on his way — a plan that
    // swung round her every third of a second would be a dog circling.
    let p = planFor(F, L.n);
    if (!p) p = planFor(F);
    if (!p) return true;       // nothing better: carry on to the old one
    const old = L.plan.g;
    L.plan = p;
    L.n = [p.nx, p.nz];
    if (Math.hypot(p.g[0] - old[0], p.g[1] - old[1]) > 0.02) { L.path = p.path; L.wp = 0; }
    if (L.who === 'baye' && J.lickHer) J.lickHer({ k: L.k, to: p.g });
    return true;
  }

  function lkGo(dt) {
    const L = d.lk;
    L.re -= dt;
    if (L.re <= 0) {
      L.re = 0.35;
      // Three misses running, not one: MEASURED once in a dozen runs into
      // the kabina, a single frame of her face not being there (her lip
      // uniforms between two writes) called the whole lick off at 4.6 s.
      if (!lkReplan()) {
        L.miss = (L.miss || 0) + 1;
        if (L.miss >= 3) { lkAbort('gone.' + L.why); return; }
      } else L.miss = 0;
    }
    if (L.all > LK.give) { lkAbort('gaveup'); return; }
    const g = L.path[Math.min(L.wp, L.path.length - 1)];
    const last = L.wp >= L.path.length - 1;
    const dtt = g[0] - d.t, dss = g[1] - d.s;
    const gap = Math.hypot(dtt, dss);
    if (gap < (last ? 0.10 : 0.35)) {
      if (!last) { L.wp++; return; }
      lkUp();
      return;
    }
    let e = Math.atan2(dss, dtt) - d.head;
    while (e > Math.PI) e -= TAU;
    while (e < -Math.PI) e += TAU;
    d.head += Math.sign(e) * Math.min(Math.abs(e), LK.turn * dt);
    const k = clamp(Math.cos(e), 0.25, 1);
    const vMax = LK.gallop * LK.rate;
    const v = (last ? Math.min(vMax, 0.8 + LK.brake * 2.2 * gap) : vMax) * k;
    fig.play('gallop', { fade: 0.2 });
    fig.state.speed = Math.max(0.45, v / LK.gallop);
    const st = Math.min(v * dt, gap);
    d.t += Math.cos(d.head) * st;
    d.s += Math.sin(d.head) * st;
    lkPlace();
    // She sees him coming: a giggle before he is even there.
    if (L.who !== 'you') L.k = damp(L.k, gap < 3 && last ? 0.3 : 0.1, 3, dt);
  }

  /** On to his hind legs from wherever the gallop stopped him. */
  function lkUp() {
    const L = d.lk;
    L.stage = 'up'; L.t = 0;
    fig.play('idle', { fade: 0.22 });
    fig.state.speed = 1;
    // Where his hind paws are now, which is where the rear starts from.
    measure(0);
    const c = Math.cos(mesh.rotation.y), sn = Math.sin(mesh.rotation.y);
    L.hw0 = [mesh.position.x + M.hx * c + M.hz * sn, mesh.position.z - M.hx * sn + M.hz * c];
    L.hw = L.hw0.slice();
    L.hwD = null;
    rearClear();
    note('lick.up');
  }

  /**
   * The pose and the place, every frame of `up`, `lick` and `down`: solve the
   * `s` for the face's height, pose him at it with the stroke on top, and put
   * the mesh so the hind paws are on the floor at `hw` and the nose is on the
   * face. `u` is how far up he is, 0 on all fours and 1 at the face.
   */
  function lkPose(dt, u, on) {
    const L = d.lk;
    const T = aimOf(L.F);
    const floor = J.walkY(L.hw[0], L.hw[1]);
    measure(0);
    const hy0 = M.hy;
    const sT = solveS(T.y - floor, hy0);
    const eT = M.nx - M.hx;
    // Where the hind paws have to be for the nose to be on the face, along
    // the side he came in from.
    const want = [T.x + L.n[0] * eT, T.z + L.n[1] * eT];
    if (L.stage === 'up') {
      const e = u * u * (3 - 2 * u);
      L.hw = [lerp(L.hw0[0], want[0], e), lerp(L.hw0[1], want[1], e)];
    } else if (L.stage === 'lick') {
      // A face that moves is followed by the paws, a shuffle and not a
      // slide: a metre a second at most. Further than 0.8 m and she has gone
      // somewhere — back down and after her.
      const gx = want[0] - L.hw[0], gz = want[1] - L.hw[1];
      const gl = Math.hypot(gx, gz);
      if (gl > 0.8) { L.stage = 'down'; L.t = 0; L.chase = true; return; }
      const st = Math.min(gl, 1.0 * dt);
      if (gl > 1e-4) { L.hw[0] += gx / gl * st; L.hw[1] += gz / gl * st; }
    } else if (L.stage === 'down') {
      // And back off her as he comes down, to where he stood before he went
      // up: dropped where he was, on all fours, his head would be in her.
      if (!L.hwD) L.hwD = L.hw.slice();
      const back = REAR[20].e + LK.short;
      const e = 1 - u;
      const k = e * e * (3 - 2 * e);
      L.hw = [lerp(L.hwD[0], T.x + L.n[0] * back, k), lerp(L.hwD[1], T.z + L.n[1] * back, k)];
    }
    L.s = sT * u;
    measure(L.s, L.ph, on);
    // Turned to face the face, from where his hind paws are.
    const [ht, hs] = J.local(L.hw[0], L.hw[1]);
    const [tt, ts] = J.local(T.x, T.z);
    let e = Math.atan2(ts - hs, tt - ht) - d.head;
    while (e > Math.PI) e -= TAU;
    while (e < -Math.PI) e += TAU;
    d.head += Math.sign(e) * Math.min(Math.abs(e), LK.turn * dt);
    mesh.rotation.y = J.rigYaw(ht, d.head);
    const c = Math.cos(mesh.rotation.y), sn = Math.sin(mesh.rotation.y);
    mesh.position.set(
      L.hw[0] - (M.hx * c + M.hz * sn),
      floor + DOODLE.lift - (M.hy - hy0),
      L.hw[1] - (-M.hx * sn + M.hz * c));
    const [rt, rs] = J.local(mesh.position.x, mesh.position.z);
    d.t = rt; d.s = rs;
    // What a probe measures: the nose against where it was sent, and the tip
    // of the tongue against her.
    const nwx = mesh.position.x + M.nx * c + M.nz * sn;
    const nwy = mesh.position.y + M.ny;
    const nwz = mesh.position.z - M.nx * sn + M.nz * c;
    L.gap = Math.hypot(nwx - T.x, nwy - T.y, nwz - T.z);
    // And his forepaws on her shoulders — see `pawsOn`. Off the rise and not
    // off `s`, so the paws go up with him from the first frame.
    pawsOn(L, L.stage === 'down' ? u : sat(u * 1.25));
  }

  /**
   * A two-bone reach, in figure space: `wheelLimb` in 43-jadrija.js, which
   * lives inside that file's closure, written again for one dog. The upper
   * bone's aim turns it from where the pose has it to where the solve wants
   * it; the lower bone's rest direction is turned by that first, then aimed.
   */
  const _k = [0, 1, 2, 3, 4, 5, 6].map(() => new THREE.Vector3());
  const _kq = new THREE.Quaternion(), _kr = new THREE.Quaternion();
  function limb2(nU, nL, root, mid, end, goal, pole) {
    const [D, V, dU, knee, dL, rU, rL] = _k;
    const l1 = mid.distanceTo(root), l2 = end.distanceTo(mid);
    D.copy(goal).sub(root);
    const dl = D.length() || 1e-3;
    D.multiplyScalar(1 / dl);
    const dd = clamp(dl, Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
    const ca = clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1);
    const sa = Math.sqrt(1 - ca * ca);
    V.copy(pole).addScaledVector(D, -pole.dot(D));
    if (V.lengthSq() < 1e-8) V.set(1, 0, 0).addScaledVector(D, -D.x);
    V.normalize();
    dU.copy(D).multiplyScalar(ca).addScaledVector(V, sa);
    knee.copy(root).addScaledVector(dU, l1);
    dL.copy(root).addScaledVector(D, dd).sub(knee).normalize();
    rU.copy(mid).sub(root).normalize();
    _kq.setFromUnitVectors(rU, dU);
    rL.copy(end).sub(mid).normalize().applyQuaternion(_kq);
    _kr.setFromUnitVectors(rL, dL);
    armAimQ(fig, nU, _kq);
    armAimQ(fig, nL, _kr);
  }

  /**
   * HIS FOREPAWS ON HER SHOULDERS. Misha: *"he rears up and puts his front
   * paws on her shoulders/chest"*. Up on his hind legs his front shoulders
   * are a metre off the floor and a fifth of a metre ahead of his hind paws,
   * and hers are about 0.4 m from there — inside what a foreleg reaches
   * (0.10 m of upper bone and 0.35 of lower). So each foreleg is solved on to
   * the top of the shoulder on its own side, 8 cm up and 4 cm out toward him
   * so the paw rests on her and not in her (up, since the bone is at
   * his wrist and the paw hangs under it); `w` blends it in as he gets up.
   * For you, the same two points on where your shoulders would be, which is
   * the bottom of the frame: you see his paws come up at you.
   */
  const _pw = new THREE.Vector3(), _pS = new THREE.Vector3();
  const _pE = new THREE.Vector3(), _pW = new THREE.Vector3(), _pP = new THREE.Vector3();
  function pawsOn(L, w) {
    const sh = L.F && L.F.shoulders;
    if (!sh || w <= 0.001) return;
    const e = w * w * (3 - 2 * w);
    const c = Math.cos(mesh.rotation.y), sn = Math.sin(mesh.rotation.y);
    const px = mesh.position.x, py = mesh.position.y, pz = mesh.position.z;
    for (const sd of ['L', 'R']) {
      fig.aim('FrontUpperLeg.' + sd, 0, 1, 0, 0);
      fig.aim('FrontLowerLeg.' + sd, 0, 1, 0, 0);
    }
    fig.update(0);
    for (const sd of ['L', 'R']) {
      fig.boneAt(fig.boneIndex('FrontUpperLeg.' + sd), _pS);
      fig.boneAt(fig.boneIndex('FrontLowerLeg.' + sd), _pE);
      fig.boneAt(fig.boneIndex('FF.' + sd), _pW);
      // His left is figure −z (Ear1.L is at z −0.07), and facing her his left
      // paw goes to her right shoulder — the one on his left.
      const tg = sh.reduce((best, q) => {
        const dx = q[0] - px, dz = q[2] - pz;
        const fz = sn * dx + c * dz;
        return (sd === 'L' ? fz < best.z : fz > best.z) ? { q, z: fz } : best;
      }, { q: null, z: sd === 'L' ? Infinity : -Infinity }).q;
      if (!tg) continue;
      const dx = tg[0] - px, dz = tg[2] - pz;
      _pw.set(c * dx - sn * dz - 0.04, tg[1] - py + 0.08, sn * dx + c * dz);
      // From where the clip has the paw to her shoulder, ON AN ARC OUT
      // TOWARD HIM: measured on a straight line, halfway up, both paws went
      // within 7 cm of her thighs and her pelvis. Bowed back 25 cm at the
      // middle of the lift they come up his own chest and over on to her.
      _pw.lerpVectors(_pW, _pw, e);
      _pw.x -= 0.25 * Math.sin(Math.PI * e);
      _pw.y += 0.10 * Math.sin(Math.PI * e);
      // The elbow goes down and back, the way a dog's does.
      _pP.set(-1, -0.4, 0).normalize();
      limb2('FrontUpperLeg.' + sd, 'FrontLowerLeg.' + sd, _pS, _pE, _pW, _pw, _pP);
    }
    fig.update(0);
  }

  /** The tongue, out and back once a stroke, curling up as it goes. */
  let tongue = null;
  function tongueMesh() {
    if (tongue) return tongue;
    const g = new THREE.SphereGeometry(1, 22, 12);
    // A flattened ellipsoid from x = 0 to x = 1, so its scale is its length.
    g.translate(1, 0, 0);
    g.scale(0.5, 1, 1);
    const m = solidMaterial(0xffffff, { spec: 0.65, specPower: 30, vcol: false });
    // His own tongue's colour, in the game's space — sRGB bytes read as
    // linear, like DOODLE_PAL — and NOT through `Color(hex)`, which would
    // convert it and come out a third as bright as the tongue in his mouth.
    const p = DOODLE_PAL.find((q) => q.name === 'tongue').c;
    m.uniforms.uBase.value.setRGB(((p >> 16) & 255) / 255, ((p >> 8) & 255) / 255,
      (p & 255) / 255, THREE.LinearSRGBColorSpace);
    tongue = new THREE.Mesh(g, m);
    tongue.name = 'slow-doodle-tongue';
    tongue.frustumCulled = false;
    tongue.visible = false;
    mesh.add(tongue);
    return tongue;
  }
  const _tr = new THREE.Vector3(), _td = new THREE.Vector3();
  function tonguePose(out, F) {
    const tg = tongueMesh();
    if (out < 0.02) { tg.visible = false; return; }
    tg.visible = true;
    onBone(bi.Jaw, LK.root, tg.position);
    // The jaw's own turn, then a curl up at the tip as it comes out — a dog's
    // tongue scoops, it does not poke.
    fig.boneTurn(bi.Jaw, _lq);
    _lq2.setFromAxisAngle(_lv.set(0, 0, 1), 0.10 + 0.45 * out);
    tg.quaternion.copy(_lq2).premultiply(_lq);
    // 60 mm of it is behind his lips; the rest comes out — as far as the
    // face and no further. MEASURED, before this: licking her lying on the
    // cot, his muzzle points down into her face and a tongue of fixed length
    // went 88 mm past the plane of her lips at the median stroke, which is
    // into her head. So the face is a plane — her lips' own, 15 mm out from
    // the lip point (which is inside her teeth), along her face's normal;
    // for you, 7 cm in front of your eye, where the near plane cannot cut
    // it — and the tongue stops on it.
    let len = 0.06 + LK.tongue * out;
    _tr.copy(tg.position).applyMatrix4(mesh.matrixWorld);
    _td.set(1, 0, 0).applyQuaternion(tg.quaternion).applyQuaternion(mesh.quaternion);
    if (F && F.fx != null) {
      const fy = F.fy || 0;
      const off = F.who === 'you' ? 0.07 : 0.015;
      const dn = _td.x * F.fx + _td.y * fy + _td.z * F.fz;
      if (dn < -0.05) {
        const h = ((F.x + F.fx * off - _tr.x) * F.fx + (F.y + fy * off - _tr.y) * fy
          + (F.z + F.fz * off - _tr.z) * F.fz) / dn;
        len = clamp(Math.min(len, h + 0.004), 0.06, len);
      }
    }
    tg.scale.set(len, LK.tongueT, LK.tongueW * (0.8 + 0.2 * out));
    // Where the tip is, in the world: along the tongue's own axis, curl and
    // all, which is what the ellipsoid is drawn along.
    tg.userData.tip = _tr.clone().addScaledVector(_td, len);
  }

  function lkLick(dt) {
    const L = d.lk;
    const was = L.ph;
    L.ph = (L.ph + dt * LK.hz) % 1;
    // One slurp a stroke, on the way up the face.
    if (was < 0.2 && L.ph >= 0.2) {
      L.strokes++;
      if (J.slurp) J.slurp(d.dist);
      if (L.who === 'you') DOODLE_VIEW.smear = Math.min(1.2, DOODLE_VIEW.smear + 0.16);
    }
  }

  /** And away, slowly — out of the kabina first if that is where he is. */
  function lkOff() {
    const L = d.lk;
    L.stage = 'off'; L.t = 0;
    rearClear();
    if (tongue) tongue.visible = false;
    if (L.laughing && J.laughStop) J.laughStop(L.who);
    L.laughing = false;
    const path = [];
    let at = [d.t, d.s];
    if (inKab(d.t, d.s)) {
      const [dc, face] = J.door;
      path.push([dc, face + 0.9], [dc, face - 1.2]);
      at = [dc, face - 1.2];
    }
    // Somewhere a few metres off, AWAY from whoever he licked — the side he
    // came in from, give or take a right angle — on his stretch if it is
    // near, and clear. Anywhere at all, and a third of the time the way off
    // is straight back through her.
    gatherSpan(at[0] - 10, at[0] + 10);
    const [ft, fs] = J.local(L.F.x, L.F.z);
    const away = Math.atan2(at[1] - fs, at[0] - ft);
    let g = null;
    for (let k = 0; k < 24 && !g; k++) {
      const a = away + (Math.random() - 0.5) * 2.6;
      const r = rnd(LK.off[0], LK.off[1]);
      const tt = at[0] + Math.cos(a) * r;
      const ss = clamp(at[1] + Math.sin(a) * r, DOODLE.s[0], DOODLE.s[1]);
      if (Math.hypot(tt - at[0], ss - at[1]) > 1.5 && lineClear(at[0], at[1], tt, ss)) g = [tt, ss];
    }
    if (g) path.push(g);
    L.path = path; L.wp = 0;
    fig.play('walk', { fade: 0.6 });
    note('lick.off');
  }

  function lkPlace() {
    const p = J.toWorld(d.t, d.s);
    mesh.position.set(p[0], J.walkY(p[0], p[2]) + DOODLE.lift, p[2]);
    mesh.rotation.y = J.rigYaw(d.t, d.head);
  }

  function lickStep(dt) {
    const L = d.lk;
    L.t += dt;
    L.all += dt;
    if (L.stage === 'go') {
      lkGo(dt);
    } else if (L.stage === 'up' || L.stage === 'lick' || L.stage === 'down') {
      // The face he is on, live: she ducks and sways, you walk about.
      const faces = J.lickFaces ? J.lickFaces() : null;
      const F = faces && faces[L.who === 'you' ? 'you' : 'baye'];
      if (F && (L.who === 'you' || F.ok)) { L.F = F; L.gone = 0; } else {
        // The same allowance here: half a second of the last face he had.
        L.gone = (L.gone || 0) + dt;
        if (L.gone > 0.5 && L.stage !== 'down') { lkAbort('gone.' + (F ? F.why : 'none')); return; }
      }
      let u = 1, on = 0;
      if (L.stage === 'up') {
        u = sat(L.t / LK.up);
        on = sat((L.t - LK.up * 0.6) / (LK.up * 0.4));
        L.k = damp(L.k, 1, 6, dt);
        if (L.t >= LK.up) {
          L.stage = 'lick'; L.t = 0; L.ph = 0;
          if (J.laugh) J.laugh(L.who, d.dist);
          L.laughing = true;
        }
      } else if (L.stage === 'lick') {
        on = 1;
        L.k = damp(L.k, 1, 6, dt);
        lkLick(dt);
        if (L.t >= LK.licks) { L.stage = 'down'; L.t = 0; }
      } else {
        const e = sat(L.t / LK.down);
        u = 1 - e * e * (3 - 2 * e);
        on = Math.max(0, 1 - L.t / (LK.down * 0.4));
        if (L.t >= LK.down) {
          if (L.chase && L.all < LK.give && lkReplan()) {
            if (L.laughing && J.laughStop) J.laughStop(L.who);
            L.laughing = false;
            L.stage = 'go'; L.t = 0; L.chase = false;
            fig.play('gallop', { fade: 0.2 });
          } else lkOff();
          return;
        }
      }
      lkPose(dt, u, on);
      // Out on the way up the face, back in on the way down.
      const ph = L.ph;
      const out = on * smoothstep(0.0, 0.14, ph) * (1 - smoothstep(0.42, 0.62, ph));
      mesh.updateMatrixWorld();
      tonguePose(out, L.F);
      L.tip = tongueMesh().visible ? tongueMesh().userData.tip : null;
      // How far the tip of the tongue is from the middle of the mouth it is
      // licking — for the probe's "within a few cm, and not through her head".
      L.tipGap = L.tip && L.F ? L.tip.distanceTo(_lw.set(L.F.x, L.F.y, L.F.z)) : null;
      // And against her face as a surface: how far the tip is off the plane
      // of her lips along her face's normal (negative is into her), and how
      // far across it from her mouth. The lip point is 14 mm inside her
      // teeth — see `apprenticeLipBind` — so the skin is taken 15 mm out.
      if (L.tip && L.F && L.F.fx != null) {
        const dx = L.tip.x - L.F.x, dy = L.tip.y - L.F.y, dz = L.tip.z - L.F.z;
        const dn = dx * L.F.fx + dy * (L.F.fy || 0) + dz * L.F.fz;
        L.tipN = dn - 0.015;
        L.tipP = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - dn * dn));
      } else { L.tipN = null; L.tipP = null; }
    } else {
      // Off: the laugh dies down behind him, and he does not hurry. She is
      // let go the moment it has, not when he has got where he is going —
      // a turn and a stroll at his pace can be twenty seconds.
      L.k = damp(L.k, 0, 1.6, dt);
      if (L.k < 0.03 && !L.freed) {
        L.freed = true;
        if (L.who === 'baye' && J.lickHer) J.lickHer(null);
        if (L.who === 'you') DOODLE_VIEW.want = 0;
      }
      const g = L.path[L.wp];
      if (!g || moveTo(g, dt, LK.offRate) < 0.12 || L.t > 30) {
        if (g && L.wp < L.path.length - 1) L.wp++;
        else if (L.k < 0.03) { lickEnd(); return; }
        else { fig.play('idle', { fade: 0.6 }); fig.state.speed = 1; }
      }
      lkPlace();
    }
    // Who it is happening to.
    if (L.who === 'baye' && J.lickHer && !L.freed) {
      // Where her hands go: either side of the base of his neck, which up on
      // his hind legs is at the height of her chest.
      const grip = L.stage === 'up' || L.stage === 'lick' || L.stage === 'down'
        ? [-0.085, 0.085].map((z) => {
          fig.boneAt(bi.Neck1, _lv);
          _lv.z += z;
          _lv.applyMatrix4(mesh.matrixWorld);
          return [_lv.x, _lv.y, _lv.z];
        }) : null;
      J.lickHer({ k: L.k, to: L.plan.g, grip, up: L.stage === 'go' || L.stage === 'off' ? 0 : L.s });
    }
    if (L.who === 'you' && !L.freed) DOODLE_VIEW.want = L.k;
    if (L.trace.length < 2000) {
      L.trace.push([+L.all.toFixed(3), L.stage, +L.s.toFixed(3), L.gap == null ? null : +L.gap.toFixed(3),
        +d.t.toFixed(2), +d.s.toFixed(2), L.tipGap == null ? null : +L.tipGap.toFixed(3),
        +L.ph.toFixed(2), L.tipN == null ? null : +L.tipN.toFixed(3),
        L.tipP == null ? null : +L.tipP.toFixed(3)]);
    }
  }

  function lickEnd() {
    const L = d.lk;
    if (L.who === 'baye' && J.lickHer && !L.freed) J.lickHer(null);
    if (L.who === 'you') DOODLE_VIEW.want = 0;
    d.lkLast = { who: L.who, all: +L.all.toFixed(2), strokes: L.strokes, trace: L.trace };
    d.lk = null;
    mesh.frustumCulled = true;
    d.mode = 'pause';
    d.timer = rnd(DOODLE.pause[0], DOODLE.pause[1]);
    fig.play('idle', { fade: 0.8 });
    fig.state.speed = 1;
    note('lick.done');
  }

  function step(cam, who, dt) {
    const dx = cam.x - mesh.position.x, dz = cam.z - mesh.position.z;
    d.dist = Math.hypot(dx, dz);
    d.far = d.dist > DOODLE.near;
    if (d.far) return;
    d.who = who;
    // Walked into mid-lick: he has more important things on.
    if (d.bumped && d.mode === 'lick') d.bumped = 0;
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
    if (d.mode === 'lick') {
      // The clip first and the lick after it, because the lick solves its
      // pose on the frame the clip has got to, and places the mesh itself.
      fig.update(dt);
      lickStep(dt);
      if (d.mode === 'lick') return;
      // Just finished: the step below puts him down as a wandering dog again.
      dt = 0;
    } else if (d.mode === 'task' && d.task && d.task.step) {
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
  // The rear, tabulated off the idle he is standing in — see `rearTable` —
  // and how far behind his root his hind paws are on all fours.
  REAR = rearTable();
  measure(0);
  REAR0 = -M.hx;
  rearClear();
  fig.update(0);

  // ── the handle a task, a probe or the console gets ──────────────────────
  const api = {
    /** Where he is, what he is doing, and why he is not moving if he is not. */
    stats: () => ({
      t: +d.t.toFixed(2), s: +d.s.toFixed(2), head: +d.head.toFixed(3),
      at: [+mesh.position.x.toFixed(2), +mesh.position.y.toFixed(3), +mesh.position.z.toFixed(2)],
      mode: d.mode, skill: d.skill, peek: d.pk, peekIn: +d.peekIn.toFixed(1),
      lick: d.lk ? d.lk.who + ':' + d.lk.stage : null,
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
    /**
     * The slow lick, now: 'baye', 'you', or nothing for either at random.
     * Answers who he went for, or a key of DOODLE_LICK_WHY.
     */
    lick: (who = null) => lickCmd(who),
    /**
     * Where the lick has got to, for a probe: the stage, the pose number, how
     * far his nose is from where it was sent (`gap`, metres), and where the
     * tip of his tongue is. `last` is the whole trace of the one before.
     */
    lickStats: () => {
      const L = d.lk;
      const tip = L && L.tip ? [L.tip.x, L.tip.y, L.tip.z].map((v) => +v.toFixed(3)) : null;
      return {
        on: !!L, who: L ? L.who : null, stage: L ? L.stage : null,
        t: L ? +L.t.toFixed(2) : null, all: L ? +L.all.toFixed(2) : null,
        s: L ? +L.s.toFixed(3) : null, k: L ? +L.k.toFixed(3) : null,
        gap: L && L.gap != null ? +L.gap.toFixed(3) : null, tip, strokes: L ? L.strokes : null,
        hw: L && L.hw ? L.hw.map((v) => +v.toFixed(3)) : null,
        goal: L ? L.plan.g.map((v) => +v.toFixed(2)) : null,
        path: L ? L.path.map((p) => p.map((v) => +v.toFixed(2))) : null,
        aim: L ? Object.values(aimOf(L.F)).map((v) => +v.toFixed(3)) : null,
        at: [+mesh.position.x.toFixed(3), +mesh.position.y.toFixed(3), +mesh.position.z.toFixed(3)],
        table: REAR ? [REAR[0], REAR[20], REAR[40]].map((r) => [+r.s.toFixed(2), +r.h.toFixed(3), +r.e.toFixed(3)]) : null,
        last: d.lkLast ? { who: d.lkLast.who, all: d.lkLast.all, strokes: d.lkLast.strokes } : null,
      };
    },
    lickTrace: () => (d.lk ? d.lk.trace : d.lkLast ? d.lkLast.trace : null),
    /**
     * Debug: change DOODLE_LICK's pose numbers and re-tabulate the reach —
     * `rearTune({ pitch: 1.45 })` — answering the table at s -1, 0, 0.5, 1
     * as [s, nose height, reach], and where his front shoulders get to.
     */
    rearTune: (o = {}) => {
      if (d.mode === 'lick') return null;
      Object.assign(LK, o);
      REAR = rearTable();
      const v = new THREE.Vector3();
      measure(1);
      const sh = fig.boneAt(fig.boneIndex('FrontUpperLeg.L'), v).toArray().map((x) => +x.toFixed(3));
      const hy = +M.hy.toFixed(3), hx = +M.hx.toFixed(3);
      rearClear();
      fig.update(0);
      return { rows: [0, 20, 30, 40].map((k) => [REAR[k].s, +REAR[k].h.toFixed(3), +REAR[k].e.toFixed(3)]),
        shoulderAt1: sh, hindAt1: [hx, hy] };
    },
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
      // Stood up on somebody he is one small disc where his hind paws are:
      // the two along his back are a dog on all fours, and on you they would
      // shove you back out of reach of your own face.
      const L = d.lk;
      if (L && L.hw && (L.stage === 'up' || L.stage === 'lick' || L.stage === 'down')) {
        push(L.hw[0], L.hw[1], 0.18, y, y + 1.2);
        return;
      }
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

/**
 * YOU, BEING LICKED.
 *
 * Misha, 25 Sep 2026, of the player's half of the slow lick: the camera gets
 * a jostle, the view a quick wet smear, his head fills the view, and Chloe
 * laughs. The laugh is `lickLaugh` in 80-audio.js and his head is the rear
 * solve in `buildDoodle`, aimed 21 cm in front of your eye; this is the rest.
 *
 * Called by the frame loop AFTER the camera is posed and after the near plane
 * is set, because it changes both — see 90-app.js. `mode` is 1 on foot in the
 * first person, 2 in the third, 0 for anything else, where it only lets go.
 *
 *   the dip      doubled over laughing, 22 cm down at the height of it — which
 *                is also what brings your face into his reach: stood up he
 *                gets his nose to about 1.5 m and your eye is at 1.66. First
 *                person only; in the third the body you look at does not bend.
 *   the shake    a slow turn away and back (0.8 Hz) with the fast shudder of a
 *                laugh on top of it (5 Hz), and a roll under both
 *   the near     his nose is 21 cm from your eye, and the front plane on the
 *                promenade is 1.2 m: without this you would see the back of
 *                his neck and nothing in front of it. 5 cm while it lasts.
 *   the smear    a blur in the middle of the view that thickens with every
 *                lick and dries off over two and a half seconds after
 */
function doodleLickView(camera, dt, mode) {
  const V = DOODLE_VIEW;
  const want = mode ? V.want : 0;
  V.k = damp(V.k, want, want > V.k ? 5 : 2.2, dt);
  V.smear = mode ? Math.max(0, V.smear - dt * 0.42) : 0;
  if (V.smear > 0.003 && !V.el && typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.id = 'doodle-smear';
    const mask = 'radial-gradient(ellipse 62% 52% at 50% 62%, #000 25%, transparent 78%)';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;'
      + 'backdrop-filter:blur(3px) saturate(1.12);-webkit-backdrop-filter:blur(3px) saturate(1.12);'
      + 'background:radial-gradient(ellipse 55% 45% at 50% 62%, rgba(236,240,246,0.16),'
      + ' rgba(222,230,240,0.06) 60%, rgba(0,0,0,0) 100%);'
      + 'mask-image:' + mask + ';-webkit-mask-image:' + mask + ';';
    document.body.appendChild(el);
    V.el = el;
  }
  if (V.el) {
    const o = Math.min(1, V.smear);
    V.el.style.opacity = o.toFixed(3);
    V.el.style.display = o > 0.003 ? '' : 'none';
  }
  if (V.k < 0.002 || !mode) { V.dipNow = 0; V.t = 0; return; }
  V.t += dt;
  const k = V.k, t = V.t;
  V.dipNow = mode === 1 ? 0.22 * k : 0;
  camera.position.y -= V.dipNow;
  camera.rotateY(k * (0.045 * Math.sin(t * TAU * 0.8) + 0.010 * Math.sin(t * TAU * 5.3 + 1.1)));
  camera.rotateX(k * (0.020 * Math.sin(t * TAU * 0.55) + 0.016 * Math.sin(t * TAU * 4.6)));
  camera.rotateZ(k * (0.035 * Math.sin(t * TAU * 0.7 + 0.4) + 0.008 * Math.sin(t * TAU * 6.1)));
  if (mode === 1 && camera.near > 0.05) {
    camera.near = 0.05;
    camera.updateProjectionMatrix();
  }
}
