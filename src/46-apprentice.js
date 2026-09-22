// ---------------------------------------------------------------------------
// Baye v2.0 — the textured figure, walking a couple of paces behind v1.0.
//
// ── what she is ────────────────────────────────────────────────────────────
//
// The same skeleton, the same bind pose and the same forty-nine clips as the
// woman on the terrace: `tools/blender/baye2.py` builds her through the same
// `armature()` and the same `skin()` that `human_mh.py` uses, so the two blobs
// carry bone-for-bone identical rigs. What is different is one thing. v1.0
// paints a person with GEOMETRY — subdivided, decimated to 26 000 triangles,
// coloured by a few dozen hand-placed cutters, carrying no UVs at all. v2.0
// keeps the base mesh's own topology and its own UV layout and puts a
// photographic skin on it, with a hairstyle, eyebrows, eyelashes and a fishnet
// that were modelled by people who model those things.
//
// ── why she is an apprentice and not a replacement ─────────────────────────
//
// Because nobody has watched her do the other forty-seven clips yet. v1.0 can
// be told what to do, can hold a straw, can cartwheel down a promenade and put
// her feet on the concrete each time; all of that is years of work that lives
// in `43-jadrija.js` and none of it has been asked of this mesh. So she
// shadows: she stands off the leader's shoulder and does whatever the leader
// has just started doing, and anything that goes wrong with her goes wrong
// where it can be seen and next to a known-good version of the same movement.
//
// The lag is the whole trick. Copying the leader's clip on the same frame
// makes two dancers in lockstep, which reads as one figure drawn twice; a
// third of a second behind reads as somebody following along. The position is
// lagged through the same ring buffer for the same reason — she walks where
// the leader walked rather than beside her on a rail.
// ---------------------------------------------------------------------------

/** How far behind, in seconds, and how far off the leader's shoulder. */
const APPR = {
  lag: 0.34,              // s of delay on both the clip and the path
  side: 1.15,             // m to the leader's left, in the leader's own frame
  back: 1.30,             // m behind her
  // AND INDOORS SHE QUEUES UP INSTEAD OF STANDING OFF THE SHOULDER.
  //
  // The kabina is 1.45 m wide. Carrying 1.15 m of side offset in there puts
  // her through a wall — measured, 1.7 m from the middle of a room half that
  // across — and no amount of clamping makes standing beside somebody work in
  // a space where there is no beside. Behind is the only free direction, and
  // behind is also where she already is: the leader walks in facing the back
  // wall, so "further along her own backward axis" is straight down the room
  // toward the door.
  sideIn: 0.0,
  backIn: 1.75,
  ring: 64,               // samples of history; 64 at 60 fps is a second
  // Hair, brows and lashes are dark keratin, not black paint. The sheen is
  // what separates the two and it is the one thing the assets cannot carry,
  // because they ship with no texture at all — `diffuseColor 0 0 0` and
  // `backfaceCull False` is the whole of their material.
  hairCol: 0x6b4f3c,
  browCol: 0x2a1f18,
};

let appr = null;                 // the figure
let apprRing = null;             // Float32Array of [x, y, z, yaw] * APPR.ring
let apprHead = 0, apprN = 0, apprClock = 0;
let apprClip = null;             // what the leader was last seen playing
let apprEye = null;              // her iris and blink uniforms

/**
 * Build her. Returns null — quietly — if the blob is not in this build, which
 * is the same failure `loadSkin` already has and the same one it deserves:
 * the game without an apprentice is the game that shipped yesterday.
 */
async function loadApprentice() {
  if (!PAYLOAD.baye2_fr3d) return null;
  // Everything about how a v5 figure is put together lives in 41-skin.js, so
  // that she and Chloe cannot drift apart. What is hers is the four lines
  // below: which maps, and what colour her hair is.
  const look = v5Parts({
    hairTex: 'baye2_hair', legTex: 'baye2_leg',
    hairCol: APPR.hairCol, browCol: APPR.browCol, lidCol: 0xcf9e86,
  });
  apprEye = look.eye;

  const fig = await loadSkin('baye2_fr3d', {
    spec: 0.10, specPower: 26, vcol: false,
    uniforms: { uSkin: { value: v5Tex('baye2_skin') } },
    decl: 'uniform sampler2D uSkin;',
    // The whole of what makes her a different figure: one texture lookup.
    body: 'base = texture2D(uSkin, vUv).rgb;',
    parts: look.parts,
  });
  if (!fig) return null;

  // The eyes, measured off the geometry rather than guessed.
  v5Eyes(fig, apprEye);

  appr = fig;
  apprRing = new Float32Array(APPR.ring * 4);
  apprHead = 0; apprN = 0; apprClock = 0; apprClip = null;
  fig.play('idle', { fade: 0 });
  fig.mesh.visible = false;      // until the leader has been somewhere
  return fig;
}

/**
 * One frame of following.
 *
 * Called from `stepShow` immediately after the leader's own
 * `updateMatrixWorld`, because what she follows is where the leader ENDED UP
 * this frame and not where the movers thought she was going.
 */
function apprenticeStep(dt, leader, inside = null, floorY = null) {
  if (!appr || !leader || !leader.mesh) return;
  // Leader gone — into the kabina, out of range, off the phase that has her
  // at all. An apprentice with nobody to follow stands and waits.
  if (!leader.mesh.visible) { appr.mesh.visible = false; return; }

  apprClock += dt;
  const m = leader.mesh;
  apprRing[apprHead * 4] = m.position.x;
  apprRing[apprHead * 4 + 1] = m.position.y;
  apprRing[apprHead * 4 + 2] = m.position.z;
  apprRing[apprHead * 4 + 3] = m.rotation.y;
  apprHead = (apprHead + 1) % APPR.ring;
  apprN = Math.min(apprN + 1, APPR.ring);

  // How many frames back `lag` seconds is, on THIS frame's dt rather than on
  // an assumed 60 — the promenade drops to 30 with the fire up and a lag
  // counted in frames would double when it did.
  const back = Math.min(apprN - 1, Math.max(1, Math.round(APPR.lag / Math.max(dt, 1 / 240))));
  const i = ((apprHead - 1 - back) % APPR.ring + APPR.ring) % APPR.ring;
  const x = apprRing[i * 4], y = apprRing[i * 4 + 1], z = apprRing[i * 4 + 2];
  let yaw = apprRing[i * 4 + 3];

  // Off her shoulder, in the LEADER's frame at that moment, so the offset
  // swings round with her instead of being a fixed compass bearing. The
  // figure faces +x in its own space and `rotation.y` turns that, so forward
  // is (cos, -sin) and her left is (sin, cos) — the same pair `faceYaw`
  // produces and the same handedness the horns ride on.
  const fx = Math.cos(yaw), fz = -Math.sin(yaw);
  const sx = Math.sin(yaw), sz = Math.cos(yaw);
  // How far into the kabina the LEADER is, 0..1. The resort's own test, in
  // world metres, so nothing here needs to know about the (t, s) frame — and
  // it is already a ramp across the threshold rather than a boolean, which is
  // what keeps the offsets from stepping as she crosses the doorway.
  const inK = inside ? inside(x, z) : 0;
  const bk = APPR.back + (APPR.backIn - APPR.back) * inK;
  const sd = APPR.side + (APPR.sideIn - APPR.side) * inK;
  // AND INDOORS SHE IS ON THE FLOOR, whatever the leader is on.
  //
  // The ring buffer carries the leader's y, which is right while both of them
  // are walking on the same concrete and wrong the moment the leader lies
  // down on the cot: that lift is a PLACE and not a body motion, and the
  // apprentice is 1.75 m down the room from it. Copied, it hangs her in the
  // air off the end of the bed. Outdoors the same y carries a somersault,
  // which is a body motion and must be copied, so this is gated on the room
  // — where the floor is one number and there is nothing to somersault over.
  const py = floorY == null ? y : y + (floorY - y) * inK;
  appr.mesh.position.set(x - fx * bk + sx * sd, py, z - fz * bk + sz * sd);
  appr.mesh.rotation.y = yaw;
  appr.mesh.visible = apprN > 4;

  // And the clip. `playing()` is the leader's current clip by name, so this
  // fires once per change rather than once per frame, and the fade is the
  // same one a caller would have asked for.
  const want = leader.playing();
  if (want && want !== apprClip) {
    apprClip = want;
    // No `loop` argument: a clip carries its own out of the blob, and both
    // figures were baked from the same `CLIPS`, so the flag is already the
    // leader's.
    appr.play(want, { fade: 0.18 });
  }
  // The leader's clip clock is scaled by how fast she is travelling; an
  // apprentice walking at a different cadence to the person in front of her
  // is the one thing that would give the whole arrangement away.
  if (leader.state) appr.state.speed = leader.state.speed;
  v5Blink(apprEye, dt);
  appr.update(dt);
  appr.mesh.updateMatrixWorld();
}

/**
 * Freeze her on one clip, beside a frozen leader.
 *
 * `jad.pose` stops `stepShow`, and `apprenticeStep` is called from inside
 * `stepShow` — so posing the leader leaves the apprentice holding whatever
 * she happened to be doing, three metres away, facing wherever she last
 * walked. Every check on her then costs ten screenshots and a montage while
 * the two of them crawl around the deck, which is how the first look at her
 * pubic hair went.
 *
 * So the pose goes through to both. Same offset as `apprenticeStep` uses, so
 * a frozen pair stand exactly where a moving pair would.
 */
function apprenticePose(name, at, settle, leader, inside = null) {
  if (!appr) return null;
  if (leader && leader.mesh) {
    const yaw = leader.mesh.rotation.y;
    const fx = Math.cos(yaw), fz = -Math.sin(yaw);
    const sx = Math.sin(yaw), sz = Math.cos(yaw);
    const inK = inside ? inside(leader.mesh.position.x, leader.mesh.position.z) : 0;
    const bk = APPR.back + (APPR.backIn - APPR.back) * inK;
    const sd = APPR.side + (APPR.sideIn - APPR.side) * inK;
    appr.mesh.position.set(
      leader.mesh.position.x - fx * bk + sx * sd,
      leader.mesh.position.y,
      leader.mesh.position.z - fz * bk + sz * sd);
    appr.mesh.rotation.y = yaw;
  }
  if (!name) { appr.mesh.updateMatrixWorld(); return { posed: appr.playing() }; }
  if (!appr.clips.includes(name)) return { posed: null, clips: appr.clips };
  apprClip = name;
  appr.play(name, { fade: 0 });
  appr.state.prev = null;
  const n = Math.max(1, Math.round((settle == null ? 1.5 : settle) * 60));
  for (let i = 0; i < n; i++) { appr.state.curT = at || 0; appr.update(1 / 60); }
  appr.state.curT = at || 0;
  appr.mesh.visible = true;
  appr.mesh.updateMatrixWorld();
  return { posed: name, at: at || 0 };
}

/** Where she is and which way she is facing, in world metres. */
function apprenticeAt() {
  if (!appr) return null;
  return { x: appr.mesh.position.x, y: appr.mesh.position.y,
    z: appr.mesh.position.z, yaw: appr.mesh.rotation.y };
}

/** Debug: turn her to an absolute yaw, without waiting for her to wander. */
function apprenticeFace(yaw) {
  if (!appr) return null;
  appr.mesh.rotation.y = yaw;
  appr.mesh.updateMatrixWorld();
  return +yaw.toFixed(3);
}

/** What she is doing, for `__fr.stats().jadrija.apprentice`. */
function apprenticeStats() {
  if (!appr) return 'none';
  return {
    tris: appr.tris, nv: appr.nv,
    parts: Object.keys(appr.parts || {}).join('+') || 'none',
    clips: appr.clips.length,
    shown: !!appr.mesh.visible,
    playing: appr.playing(),
    at: [+appr.mesh.position.x.toFixed(2), +appr.mesh.position.y.toFixed(2),
      +appr.mesh.position.z.toFixed(2)],
  };
}
