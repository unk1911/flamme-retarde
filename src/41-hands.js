// ---------------------------------------------------------------------------
// Baye's right hand: an index finger and a thumb tip of their own.
//
// ── why ──────────────────────────────────────────────────────────────────────
//
// Misha, 24 Sep 2026, of the line: *"her right hand wraps around in a scooping
// way, but instead, really she should bring up the straw with her thumb and
// index finger (like making an OK sign)"*. On the rig she shipped with that was
// not a pose anybody could type. It has ONE bone for all four fingers
// (`fingersR`, pivoting at the middle knuckle) and one rigid bone for the
// thumb from its root to its last joint, so the only pinch there was is the
// one that shipped: all four fingers curled 65 degrees together round the
// straw — a scoop, because that is what one bone for four fingers can do.
// An OK sign is the index curled at all three of its joints to meet the thumb
// tip, with the other three left out in a gentle curve, and that needs the
// index to move without the middle finger.
//
// ── how, and why here rather than in Blender ─────────────────────────────────
//
// Five bones are ADDED AT LOAD, to the blob's skeleton, before the figure is
// built: the index's three phalanges (`idx1R` at its knuckle, `idx2R`, `idx3R`)
// and the thumb's two outer joints (`thb2R`, `thb3R`) off `thumbR`. The index
// hangs off the HAND and copies `fingersR`'s rest turn and every one of its
// clip keys — see HAND_BONES for why not off `fingersR` itself — and an `aim`
// on `fingersR` is an `aim` on it too (`loadSkinHands`); the other four have
// their parent's rest orientation and an identity key in every clip. So until
// something aims one of them directly the hand moves as it always did and no
// clip changes by more than a millimetre. The vertices that were `fingersR`'s
// on the index, and `thumbR`'s past the thumb's first joint, have that weight
// split along the new chain by where they are along the finger, smoothed
// across each joint.
//
// Rebaking would do the same thing slower and worse: a new bone in `BONES` in
// tools/blender/human_mh.py reruns bone heat on the whole body and moves
// weights everywhere, for both blobs and every figure that shares the file.
// This touches the index and the thumb tip of two figures and nothing else.
//
// Two figures, and they have to be the SAME two: v1.0 (`skinFig`, the one that
// is posed) and v2.0 (the one that is drawn), because v2.0 wears v1.0's palette
// bone for bone and `apprSameRig` checks that they agree. Both are built by
// `loadSkinHands` and nothing else is.
//
// The joints are MakeHuman's own `r-finger-*` markers off build/mh_base.obj,
// which is what `armature()` builds her from — `thumbR` sits on r-finger-1-1
// and `fingersR` on r-finger-3-1 to the tenth of a millimetre. Figure axes
// (+x forward, +y up, +z her right), bind pose. `aI`, `aT` and `aF` are the
// flex axes (positive curls into the palm), `vol` the palm's normal. All of it,
// and the pinch in 43-jadrija.js, comes out of tools/pinch_solve.py: the
// same reweighting in numpy, skinned on v2.0's mesh, solved and drawn.
// ---------------------------------------------------------------------------

const HAND_R = {
  j: {
    11: [0.2242, 1.1002, 0.4407], 12: [0.2493, 1.0950, 0.4302],
    13: [0.2818, 1.0796, 0.4185], 14: [0.3021, 1.0681, 0.4115],
    21: [0.2778, 1.0713, 0.4723], 22: [0.2998, 1.0571, 0.4760],
    23: [0.3176, 1.0414, 0.4763], 24: [0.3356, 1.0249, 0.4758],
    31: [0.2604, 1.0561, 0.4841], 32: [0.2827, 1.0337, 0.4950],
    33: [0.3000, 1.0143, 0.4986], 34: [0.3167, 0.9949, 0.5026],
    41: [0.2426, 1.0497, 0.4933], 42: [0.2585, 1.0279, 0.5054],
    43: [0.2723, 1.0078, 0.5104], 44: [0.2854, 0.9865, 0.5164],
    51: [0.2231, 1.0433, 0.4985], 52: [0.2333, 1.0242, 0.5050],
    53: [0.2397, 1.0109, 0.5074], 54: [0.2472, 0.9934, 0.5102],
  },
  aF: [0.7410, 0.5770, -0.3435],
  aI: [[0.5456, 0.7430, -0.3878], [0.6159, 0.6924, -0.3757], [0.6210, 0.6884, -0.3747]],
  aT: [[-0.3241, -0.8872, -0.3284], [-0.4893, -0.8290, -0.2708], [-0.5404, -0.8035, -0.2497]],
  vol: [-0.1219, -0.3874, -0.9138],
};

/**
 * The added bones: name, parent, the joint its head sits on, and — for the
 * index's first — the bone whose rest turn and whose every clip key it
 * copies.
 *
 * THE INDEX HANGS OFF THE HAND, NOT OFF `fingersR`, and moves with it by
 * copying it. Hung off `fingersR` it was carried by that bone's pivot, which
 * is the MIDDLE finger's knuckle: curling the other three for the plate moved
 * the index's knuckle 2 mm and opened the OK sign by as much, measured, with
 * the index's own turn held exactly. Copying the keys instead gives every
 * clip the same index it always had, turned about its own knuckle rather
 * than its neighbour's — the two knuckles lie along the curl's axis to within
 * 2.3 mm, so at the clips' 26 degrees that is under a millimetre — and leaves
 * the pinch owing nothing to the other three fingers.
 */
const HAND_BONES = [
  ['idx1R', 'handR', 21, 'fingersR'], ['idx2R', 'idx1R', 22], ['idx3R', 'idx2R', 23],
  ['thb2R', 'thumbR', 12], ['thb3R', 'thb2R', 13],
];

/**
 * Add the bones to a parsed blob, in place. Idempotent; a blob without the two
 * right-hand bones it hangs them off is left alone. Returns how many vertices
 * were reweighted.
 */
function fingerBones(data) {
  const names = data.bones.map((b) => b.name);
  if (names.includes('idx1R')) return 0;
  const iF = names.indexOf('fingersR'), iT = names.indexOf('thumbR');
  if (iF < 0 || iT < 0) return 0;
  const n0 = data.bones.length;
  // Bind orientation and head of every bone, composed off the rest.
  const BQ = [], BT = [];
  for (const b of data.bones) {
    const q = new THREE.Quaternion(b.q[0], b.q[1], b.q[2], b.q[3]);
    const t = new THREE.Vector3(b.t[0], b.t[1], b.t[2]);
    if (b.parent < 0) { BQ.push(q); BT.push(t); } else {
      BT.push(t.applyQuaternion(BQ[b.parent]).add(BT[b.parent]));
      BQ.push(BQ[b.parent].clone().multiply(q));
    }
  }
  const J = (k) => new THREE.Vector3(...HAND_R.j[k]);
  const ix = {}, copy = {};
  for (const [name, parent, joint, like] of HAND_BONES) {
    const p = names.indexOf(parent);
    const t = J(joint).sub(BT[p]).applyQuaternion(BQ[p].clone().invert());
    const src = like ? names.indexOf(like) : -1;
    const q = src >= 0 ? data.bones[src].q.slice() : [0, 0, 0, 1];
    ix[name] = names.length;
    if (src >= 0) copy[names.length] = src;
    names.push(name);
    data.bones.push({ name, parent: p, t: [t.x, t.y, t.z], q });
    BQ.push(BQ[p].clone().multiply(new THREE.Quaternion(q[0], q[1], q[2], q[3])));
    BT.push(J(joint));
  }
  const n1 = data.bones.length;
  // Every clip keys the new bones at identity — they do what their parent
  // does — except the one that copies a bone, which takes that bone's keys.
  for (const c of Object.values(data.clips)) {
    const q = new Int16Array(c.nf * n1 * 4);
    for (let f = 0; f < c.nf; f++) {
      const o = f * n1 * 4;
      q.set(c.quat.subarray(f * n0 * 4, (f + 1) * n0 * 4), o);
      for (let k = n0; k < n1; k++) {
        if (copy[k] != null) {
          for (let j = 0; j < 4; j++) q[o + k * 4 + j] = c.quat[f * n0 * 4 + copy[k] * 4 + j];
        } else q[o + k * 4 + 3] = 32767;
      }
    }
    c.quat = q;
  }

  // ── the weights ──
  const g = data.geo;
  const P = g.attributes.position.array;
  const bi = g.attributes.aBoneIdx.array, bw = g.attributes.aBoneWt.array;
  const polys = [1, 2, 3, 4, 5].map((k) => [1, 2, 3, 4].map((j) => J(k * 10 + j)));
  const I0 = J(21), uI = J(24).sub(I0).normalize();
  const T0 = J(11), uT = J(14).sub(T0).normalize();
  const sI = [21, 22, 23].map((k) => J(k).sub(I0).dot(uI));
  const sT = [11, 12, 13].map((k) => J(k).sub(T0).dot(uT));
  const ss = (x) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
  const v = new THREE.Vector3(), ab = new THREE.Vector3(), q = new THREE.Vector3();
  const segD = (a, b) => {
    ab.copy(b).sub(a);
    const t = Math.max(0, Math.min(1, q.copy(v).sub(a).dot(ab) / ab.lengthSq()));
    return q.copy(a).addScaledVector(ab, t).distanceTo(v);
  };
  let moved = 0;
  for (let i = 0; i < data.nv; i++) {
    const o = i * 4;
    let has = false;
    for (let s = 0; s < 4; s++) if (bw[o + s] && (bi[o + s] === iF || bi[o + s] === iT)) has = true;
    if (!has) continue;
    v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    let lab = 0, best = 1e9;
    for (let k = 0; k < 5; k++) {
      const pl = polys[k];
      const d = Math.min(segD(pl[0], pl[1]), segD(pl[1], pl[2]), segD(pl[2], pl[3]));
      if (d < best) { best = d; lab = k + 1; }
    }
    if (best > 0.03 || (lab !== 1 && lab !== 2)) continue;
    const w = new Map();
    for (let s = 0; s < 4; s++) {
      if (bw[o + s]) w.set(bi[o + s], (w.get(bi[o + s]) || 0) + bw[o + s] / 255);
    }
    if (lab === 2) {
      // The index. Heat bled eight per cent of the thumb into every vertex of
      // it — a thumb that swings drags the index 5 mm with it — so past the
      // knuckle that goes to the finger first, and then the finger's weight is
      // split down the chain.
      const s = q.copy(v).sub(I0).dot(uI);
      const mv = (w.get(iT) || 0) * ss((s + 0.015) / 0.015);
      if (mv > 0) { w.set(iT, w.get(iT) - mv); w.set(iF, (w.get(iF) || 0) + mv); }
      const F = w.get(iF) || 0;
      const g1 = ss((s - (sI[0] - 0.006)) / 0.012);
      const g2 = ss((s - (sI[1] - 0.005)) / 0.010);
      const g3 = ss((s - (sI[2] - 0.004)) / 0.008);
      w.set(iF, F * (1 - g1));
      w.set(ix.idx1R, F * g1 * (1 - g2));
      w.set(ix.idx2R, F * g1 * g2 * (1 - g3));
      w.set(ix.idx3R, F * g1 * g2 * g3);
    } else {
      const s = q.copy(v).sub(T0).dot(uT);
      const Tw = w.get(iT) || 0;
      const g2 = ss((s - (sT[1] - 0.006)) / 0.012);
      const g3 = ss((s - (sT[2] - 0.005)) / 0.010);
      w.set(iT, Tw * (1 - g2));
      w.set(ix.thb2R, Tw * g2 * (1 - g3));
      w.set(ix.thb3R, Tw * g2 * g3);
    }
    // The four heaviest, back to bytes that sum to 255.
    const top = [...w.entries()].filter((e) => e[1] > 1e-4)
      .sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = top.reduce((a, e) => a + e[1], 0);
    let left = 255;
    for (let s = 0; s < 4; s++) {
      if (s < top.length) {
        const b = s === 0 ? 0 : Math.round(top[s][1] / tot * 255);
        bi[o + s] = top[s][0];
        bw[o + s] = b;
        if (s > 0) left -= b;
      } else { bi[o + s] = 0; bw[o + s] = 0; }
    }
    bw[o] = left;
    moved++;
  }
  g.attributes.aBoneIdx.needsUpdate = true;
  g.attributes.aBoneWt.needsUpdate = true;
  return moved;
}

/** `loadSkin`, with the hand added between the parse and the build. */
async function loadSkinHands(key, opts) {
  const b64 = PAYLOAD[key];
  if (!b64) { console.warn('no payload for skin', key); return null; }
  try {
    const data = readFR3DSkin(await inflateBinary(b64));
    fingerBones(data);
    const fig = skinnedFigure(data, opts);
    // AN AIM ON THE FINGERS IS AN AIM ON THE INDEX TOO. It hangs off the hand
    // and copies the fingers' clip keys (see HAND_BONES), which covers every
    // clip and nothing solved at runtime: the grip round a bottle or a phone
    // curls `fingersR` by `aim`, and without this the index would stay
    // straight while the other three closed. Same figure-space turn, about
    // its own knuckle. Anything that then aims `idx1R` itself — the line —
    // does so after, and wins.
    if (fig && data.bones.some((b) => b.name === 'idx1R')) {
      const aim0 = fig.aim;
      fig.aim = (name, ax, ay, az, ang) => {
        const r = aim0(name, ax, ay, az, ang);
        if (name === 'fingersR') aim0('idx1R', ax, ay, az, ang);
        return r;
      };
    }
    return fig;
  } catch (e) {
    console.warn('skin failed:', key, e.message);
    return null;
  }
}
