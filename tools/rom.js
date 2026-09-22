/**
 * Range-of-motion limits, and the four joints we can honestly measure.
 *
 * ── WHERE THE NUMBERS COME FROM ──────────────────────────────────────────
 *
 * The table is posecode's, from `packages/posecode-parser/src/rom.ts` —
 * Apache-2.0, https://github.com/posecode-dev/posecode. Only that package and
 * the other Apache-2.0 ones are touched here; posecode's renderer, eval, MCP
 * and embed packages are AGPL-3.0-only and nothing from them is in this file
 * or anywhere near this repository, because this game ships as one public
 * HTML file and AGPL would take the whole of it.
 *
 * Their own note is worth repeating: these are implementation bounds informed
 * by cited references, not a clinical assessment. They are used here as an
 * ASSERTION, not as a clamp — nothing in the game reads this file at runtime.
 *
 * ── WHY IT EXISTS ────────────────────────────────────────────────────────
 *
 * `wheelLimb` has no joint limits, and on 21 Sep 2026 that cost six releases.
 * Her right arm during the coke beat measured, in her own frame:
 *
 *     shoulder extension 138 deg  (max  60)   over by 78
 *     shoulder adduction 150 deg  (max  50)   over by 100
 *
 * A shoulder cannot do either of those, and the elbow that resulted is what
 * Misha kept calling funky. Six rounds of looking at it did not name it; one
 * pass of this table does, in a number, in a second. Against the same table
 * the fix measures 54 deg of flexion and 9 of adduction, and the hand-authored
 * `YAWN` it was tuned against measures 64 and 16.
 *
 * ── WHAT IT CAN AND CANNOT SEE ───────────────────────────────────────────
 *
 * Four joints: both shoulders, both elbows, both hips, both knees. Those are
 * the ones whose clinical angle can be read off bone POSITIONS alone, which
 * is all a probe can get out of the running game. Spine, neck, head and wrist
 * have limits in the table too and are not checked, because reading them
 * needs each bone's roll and that is not exposed — a violation there will not
 * be caught and this file should not be read as saying the body is sound.
 */
'use strict';

// posecode ROM, degrees. Apache-2.0, see the note above.
const ROM = {
  shoulder: { flex: 180, extend: 60, abduct: 180, adduct: 50 },
  elbow: { flex: 154, extend: 10 },
  hip: { flex: 135, extend: 20, abduct: 45, adduct: 30 },
  knee: { flex: 144, extend: 5 },
};

const BONES = ['clavicleL', 'clavicleR', 'chest', 'pelvis',
  'armUL', 'armLL', 'handL', 'armUR', 'armLR', 'handR',
  'legUL', 'legLL', 'footL', 'legUR', 'legLR', 'footR'];

/**
 * The body's own frame and the eight angles, from bone positions.
 *
 * `b` is {name: [x, y, z]} in world metres, exactly as `__fr.jad.bones`
 * returns it. Everything below is expressed in HER axes and not the world's,
 * which is the whole point: at a 68-degree stoop "up" is not up.
 */
function romAngles(b, ROM) {
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const len = (p) => Math.hypot(p[0], p[1], p[2]);
  const nrm = (p) => { const l = len(p) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1],
    p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const DEG = 180 / Math.PI;

  // Shoulder to shoulder is lateral; chest down to pelvis is the torso axis.
  // Orthogonalised, because a shrug puts a degree or two of tilt in the first.
  const right = nrm(sub(b.clavicleR, b.clavicleL));
  const d0 = sub(b.pelvis, b.chest);
  const down = nrm((() => { const k = dot(d0, right);
    return [d0[0] - right[0] * k, d0[1] - right[1] * k, d0[2] - right[2] * k]; })());
  // `down x right` is BACKWARD, which is a sign error worth one line of
  // comment because it was made once already: negate it for forward.
  const back = nrm(cross(down, right));
  const fwd = [-back[0], -back[1], -back[2]];

  const out = {};
  // A hinge's flexion is 180 minus the angle the two segments open to.
  const hinge = (a, m, e) => 180 - DEG * Math.acos(Math.max(-1, Math.min(1,
    dot(nrm(sub(m, a)), nrm(sub(e, m))) * -1)));
  // ── A BALL JOINT NEEDS AN ENVELOPE, NOT TWO ANGLES ────────────────────
  //
  // Two independent angles were tried twice and were wrong twice, both times
  // by the same mechanism — a decomposition that degenerates when the limb
  // leaves the quadrant it was written for.
  //
  //   atan2(lateral, down)  went to 180 for a straight thigh in a deep stoop,
  //                         because `down` turns negative past 90 of flexion,
  //                         and reported hip abduction of 157 degrees.
  //   asin for the frontal, atan2 for the sagittal, fixed that and then read
  //                         an arm raised OVERHEAD as 162 degrees of shoulder
  //                         EXTENSION, because an arm straight up is at
  //                         atan2(+/-epsilon, -1) and the sign of epsilon
  //                         decides between flexion and extension.
  //
  // A shoulder does not have a flexion limit and an abduction limit that hold
  // independently; it has one limit that depends on WHICH WAY the arm is
  // going. So: elevation is the angle off the torso axis, 0 to 180 and never
  // ambiguous, and the plane of elevation says which of the four limits is
  // the one that applies, interpolated between them. Straight up is 180 of
  // elevation in whatever plane, and 180 is what flexion and abduction both
  // allow, so it passes — as it must, because people do it.
  const envelope = (seg, lat, lim) => {
    const u = nrm(seg);
    const d = Math.max(-1, Math.min(1, dot(u, down)));
    const elev = DEG * Math.acos(d);
    // 0 straight forward, 90 straight out, 180 straight back, -90 across.
    const plane = DEG * Math.atan2(dot(u, right) * lat, dot(u, fwd));
    // The four cardinal limits, linearly interpolated round the circle.
    const at = (deg) => {
      const a = ((deg % 360) + 360) % 360;
      const pts = [[0, lim.flex], [90, lim.abduct], [180, lim.extend],
        [270, lim.adduct], [360, lim.flex]];
      for (let i = 0; i < 4; i++) {
        if (a >= pts[i][0] && a <= pts[i + 1][0]) {
          const f = (a - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
          return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
        }
      }
      return lim.flex;
    };
    // AND THE PLANE STOPS MEANING ANYTHING AT THE POLES. A limb lying along
    // the torso axis — straight down, or straight overhead — has a transverse
    // component of nothing, so which way it is "going" is decided by rounding
    // error: the same arm raised overhead read 177 deg of EXTENSION with z at
    // +0.01 and passed clean at -0.01. So the directional limit is weighted by
    // `sin(elev)`, which is 1 where the plane is well defined and 0 at both
    // poles, and what it relaxes to is the most permissive of the four.
    //
    // This is not a fudge, it is the anatomy: an arm horizontal and straight
    // back is 90 deg of extension and impossible, an arm vertical is 180 deg
    // of elevation and ordinary, and the envelope has to be tighter in the
    // middle than at the top. Checked: horizontal-and-back violates by 18,
    // overhead does not violate at all, and 45 deg of extension passes.
    const w = Math.sin(elev * Math.PI / 180);
    const perm = Math.max(lim.flex, lim.abduct);
    const limit = perm + (at(plane) - perm) * w;
    const dir = Math.abs(plane) <= 45 ? 'flex'
      : plane > 45 && plane <= 135 ? 'abduct'
        : Math.abs(plane) > 135 ? 'extend' : 'adduct';
    return { elev: +elev.toFixed(1), plane: +plane.toFixed(1),
      limit: +limit.toFixed(1), dir };
  };
  for (const [s, lat] of [['R', 1], ['L', -1]]) {
    // Positive lateral is away from the midline whichever limb it is.
    out['shoulder' + s] = envelope(sub(b['armL' + s], b['armU' + s]), lat, ROM.shoulder);
    out['elbow' + s] = { hinge: hinge(b['armU' + s], b['armL' + s], b['hand' + s]) };
    out['hip' + s] = envelope(sub(b['legL' + s], b['legU' + s]), lat, ROM.hip);
    out['knee' + s] = { hinge: hinge(b['legU' + s], b['legL' + s], b['foot' + s]) };
  }
  return out;
}

/** Every angle that is past its limit, with by how much. */
function romViolations(b, slack = 0) {
  const a = romAngles(b, ROM), bad = [];
  const ball = (joint) => {
    const r = a[joint];
    if (r.elev > r.limit + slack) {
      bad.push({ joint, action: r.dir, deg: r.elev, max: r.limit,
        over: +(r.elev - r.limit).toFixed(1), plane: r.plane });
    }
  };
  const hingeAt = (joint, kind) => {
    const v = a[joint].hinge;
    const act = v >= 0 ? 'flex' : 'extend', lim = ROM[kind][act];
    if (Math.abs(v) > lim + slack) {
      bad.push({ joint, action: act, deg: +Math.abs(v).toFixed(1),
        max: lim, over: +(Math.abs(v) - lim).toFixed(1) });
    }
  };
  for (const s of ['R', 'L']) {
    ball('shoulder' + s); ball('hip' + s);
    hingeAt('elbow' + s, 'elbow'); hingeAt('knee' + s, 'knee');
  }
  return bad;
}

module.exports = { ROM, BONES, romAngles, romViolations };
module.exports.SOURCE = `(${romAngles})(B)`;
/** The whole check as one expression a `shoot.mjs` plan can use as its probe. */
module.exports.probe = (bonesExpr, slack = 0) => `(() => {
  const B = ${bonesExpr};
  if (!B || !B.chest) return { rom: 'no bones' };
  const romAngles = ${romAngles};
  const romViolations = ${romViolations};
  const ROM = ${JSON.stringify(ROM)};
  return { bad: romViolations(B, ${slack}) };
})()`;
