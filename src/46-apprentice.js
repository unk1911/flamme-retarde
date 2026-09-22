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

/** A payload image as a texture, decoded off the data URI. */
function apprTex(key, wrap) {
  const b64 = PAYLOAD[key];
  if (!b64) return null;
  const img = new Image();
  const t = new THREE.Texture(img);
  // NoColorSpace, like every other texture in this game and for the same
  // reason: `aVCol` is sRGB bytes handed to the shader as linear, so the whole
  // palette is authored in that stretched space. A skin decoded to linear here
  // would be the only surface in Šibenik that was not, and she would read as
  // washed out standing next to a wall that was not.
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  if (wrap) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  // The payload is a data URI, so this decode is a microtask rather than a
  // request — but it is still not synchronous, and a texture whose image has
  // no width yet uploads as nothing at all.
  img.onload = () => { t.needsUpdate = true; };
  img.src = b64;
  return t;
}

/**
 * Build her. Returns null — quietly — if the blob is not in this build, which
 * is the same failure `loadSkin` already has and the same one it deserves:
 * the game without an apprentice is the game that shipped yesterday.
 */
async function loadApprentice() {
  if (!PAYLOAD.baye2_fr3d) return null;
  const skin = apprTex('baye2_skin');
  const hair = apprTex('baye2_hair');
  const leg = apprTex('baye2_leg');

  const fig = await loadSkin('baye2_fr3d', {
    spec: 0.10, specPower: 26, vcol: false,
    uniforms: { uSkin: { value: skin } },
    decl: 'uniform sampler2D uSkin;',
    // The whole of what makes her a different figure: one texture lookup.
    body: 'base = texture2D(uSkin, vUv).rgb;',
    parts: {
      // The eyeballs' UV layout is not known to us, so the iris is drawn in
      // BIND space instead — `vLocal` is the unskinned position, so an eye
      // socket that has been carried across the beach by the head bone is
      // still at the coordinates this was measured at. Filled in below, once
      // there is geometry to measure.
      eyes: { color: 0xcfc8bd, spec: 0.55, specPower: 90,
        uniforms: { uEyeL: { value: new THREE.Vector3() },
          uEyeR: { value: new THREE.Vector3() },
          uEyeF: { value: new THREE.Vector3(1, 0, 0) } },
        decl: 'uniform vec3 uEyeL;\nuniform vec3 uEyeR;\nuniform vec3 uEyeF;',
        body: `
          vec3 ec = distance(vLocal, uEyeL) < distance(vLocal, uEyeR) ? uEyeL : uEyeR;
          vec3 rd = normalize(vLocal - ec);
          float a = dot(rd, normalize(uEyeF));
          float iris = smoothstep(0.918, 0.941, a);
          float pupil = smoothstep(0.9885, 0.9925, a);
          float limb = smoothstep(0.925, 0.937, a) * (1.0 - smoothstep(0.945, 0.960, a));
          base = mix(base, vec3(0.30, 0.40, 0.34), iris);
          base = mix(base, vec3(0.02), pupil);
          base *= 1.0 - 0.75 * limb;
        ` },
      mouth: { color: 0xd8b3ae, spec: 0.20 },
      // Hair cards are rectangles that only look like hair because most of
      // each one is cut away by its alpha. A discard rather than blending, so
      // they sort against each other without a depth-sorted pass.
      hair: { color: APPR.hairCol, side: THREE.DoubleSide,
        spec: 0.20, specPower: 30,
        uniforms: { uHair: { value: hair } },
        decl: 'uniform sampler2D uHair;',
        body: 'vec4 hc = texture2D(uHair, vUv);\n'
          + 'if (hc.a < 0.5) discard;\n'
          + 'base *= hc.rgb * 1.6;' },
      // Eyebrows and eyelashes carry no map at all, so they are a colour and
      // a sheen and nothing else. Double-sided because their own material
      // says `backfaceCull False` and a strand seen from the far side is half
      // of every strand.
      brow: { color: APPR.browCol, side: THREE.DoubleSide, spec: 0.18 },
      lash: { color: APPR.browCol, side: THREE.DoubleSide, spec: 0.18 },
      // A fishnet is not skin and must not take skin's lift. `SKIN_EMISSIVE`
      // exists because light entering skin scatters under it and leaves
      // somewhere else; a thread of nylon does no such thing, and a black net
      // handed 0.16 of unconditional ambient over a pale leg comes out silver.
      leg: { color: 0xffffff, side: THREE.DoubleSide, spec: 0.05, specPower: 40,
        emissive: 0.03,
        uniforms: { uLeg: { value: leg } },
        decl: 'uniform sampler2D uLeg;',
        body: 'vec4 lc = texture2D(uLeg, vUv);\n'
          + 'if (lc.a < 0.5) discard;\n'
          + 'base *= lc.rgb;' },
    },
  });
  if (!fig) return null;

  // The eyes, measured off the geometry rather than guessed. Same argument as
  // `faceAnchors` for v1.0: the eyeballs say exactly where the eyes are, and a
  // number typed here is a number that goes wrong the day the mesh changes.
  const eyes = fig.parts && fig.parts.eyes;
  if (eyes) {
    const pos = fig.mesh.geometry.getAttribute('position');
    const ix = fig.mesh.geometry.getIndex();
    const seen = new Set();
    let lx = 0, ly = 0, lz = 0, ln = 0, rx = 0, ry = 0, rz = 0, rn = 0;
    const start = eyes.geometry.drawRange.start;
    const count = eyes.geometry.drawRange.count;
    for (let i = start; i < start + count; i++) {
      const v = ix.getX(i);
      if (seen.has(v)) continue;
      seen.add(v);
      // Her right and her left, split on the figure's own z — the export puts
      // her facing +x, so z is across her.
      const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
      if (z >= 0) { lx += x; ly += y; lz += z; ln++; } else { rx += x; ry += y; rz += z; rn++; }
    }
    if (ln && rn) {
      const u = eyes.material.uniforms;
      u.uEyeL.value.set(lx / ln, ly / ln, lz / ln);
      u.uEyeR.value.set(rx / rn, ry / rn, rz / rn);
      // Which way she looks: from the midpoint of the two eyes, along the
      // axis the export faces. Measured as a direction rather than assumed so
      // that it stays right if the export's facing ever changes — the two eye
      // centres and the figure's own forward are the only things involved.
      u.uEyeF.value.set(1, 0, 0);
    }
  }
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
function apprenticeStep(dt, leader) {
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
  appr.mesh.position.set(x - fx * APPR.back + sx * APPR.side,
    y, z - fz * APPR.back + sz * APPR.side);
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
function apprenticePose(name, at, settle, leader) {
  if (!appr) return null;
  if (leader && leader.mesh) {
    const yaw = leader.mesh.rotation.y;
    const fx = Math.cos(yaw), fz = -Math.sin(yaw);
    const sx = Math.sin(yaw), sz = Math.cos(yaw);
    appr.mesh.position.set(
      leader.mesh.position.x - fx * APPR.back + sx * APPR.side,
      leader.mesh.position.y,
      leader.mesh.position.z - fz * APPR.back + sz * APPR.side);
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
