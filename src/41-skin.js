// -----------------------------------------------------------------------------
// Skinned figures: a skeleton, a bank of clips, and a shader that puts the two
// together.
//
// Everything else with joints in this game is *rigid* — the ground crew and the
// bathers are eleven separate boxes on a tree of pivots (readFR3DRig in
// src/48-landmarks.js), which is the right answer for a person in heavy kit
// seen from a Canadair and the wrong one for somebody you can walk up to. This
// is the other path: one mesh, four bone influences a vertex, blended in the
// vertex shader.
//
// The cost is one blob and about a hundred lines. What it buys is that a pose
// stops being an asset. The frozen figure that used to stand on the Jadrija
// promenade was 427 KB for *one* attitude of one body — more than the entire
// Canadair — and a second pose would have cost another 427 KB. Skinned, the
// same body costs 470 KB once and every pose after that is a few kilobytes of
// quaternions.
//
// ── the palette ───────────────────────────────────────────────────────────────
//
// Bone matrices go up as a plain uniform array — 3 vec4 rows a bone, so 28
// bones is 84 vec4s — rather than as the float texture three.js uses. One
// figure does not need a texture unit, and 84 fits inside the 128 vec4s that
// even the oldest conforming WebGL implementation has to offer.
// -----------------------------------------------------------------------------

/**
 * Decode a .fr3d **v3** blob: mesh, skeleton, clips.
 *
 * Layout is fixed-size-first so that everything large can be a view straight
 * on to the decompressed buffer; only the variable-length tables at the end,
 * which are a few kilobytes, are walked with a DataView.
 */
function readFR3DSkin(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1),
    dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'FR3D') throw new Error('not an fr3d blob: ' + magic);
  const version = dv.getUint32(4, true);
  if (version !== 3) throw new Error('fr3d skin needs version 3, got ' + version);
  const nv = dv.getUint32(8, true);
  const ni = dv.getUint32(12, true);

  let o = 40;
  const pos = new Float32Array(buf, o, nv * 3); o += nv * 12;
  const nrm = new Float32Array(buf, o, nv * 3); o += nv * 12;
  const col = new Uint8Array(buf, o, nv * 3); o += nv * 3;
  const bidx = new Uint8Array(buf, o, nv * 4); o += nv * 4;
  const bwgt = new Uint8Array(buf, o, nv * 4); o += nv * 4;
  o = (o + 3) & ~3;                          // the exporter pads to match
  const idx = new Uint32Array(buf, o, ni); o += ni * 4;

  const dec = new TextDecoder();
  const nb = dv.getUint32(o, true); o += 4;
  const bones = [];
  for (let i = 0; i < nb; i++) {
    const len = dv.getUint16(o, true); o += 2;
    const name = dec.decode(new Uint8Array(buf, o, len)); o += len;
    // Offsets are measured from `parent`, not past it — 4 for the parent, 12
    // for the translation, 16 for the quaternion, 32 in all.
    const parent = dv.getInt32(o, true);
    bones.push({
      name, parent,
      t: [dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true),
        dv.getFloat32(o + 12, true)],
      q: [dv.getFloat32(o + 16, true), dv.getFloat32(o + 20, true),
        dv.getFloat32(o + 24, true), dv.getFloat32(o + 28, true)],
    });
    o += 32;
  }

  const nc = dv.getUint32(o, true); o += 4;
  const clips = {};
  for (let c = 0; c < nc; c++) {
    const len = dv.getUint16(o, true); o += 2;
    const name = dec.decode(new Uint8Array(buf, o, len)); o += len;
    const dur = dv.getFloat32(o, true);
    const nf = dv.getUint32(o + 4, true);
    const loop = dv.getUint8(o + 8) !== 0;
    o += 12;
    // Frame blocks land on whatever offset the clip's name happened to leave,
    // so this one is a copy: an Int16Array view has to be 2-byte aligned and a
    // name of odd length guarantees it will not be.
    const stride = 12 + nb * 8;
    const blk = new DataView(buf.slice(o, o + nf * stride)); o += nf * stride;
    const root = new Float32Array(nf * 3);
    const quat = new Int16Array(nf * nb * 4);
    for (let f = 0; f < nf; f++) {
      let p = f * stride;
      root[f * 3] = blk.getFloat32(p, true);
      root[f * 3 + 1] = blk.getFloat32(p + 4, true);
      root[f * 3 + 2] = blk.getFloat32(p + 8, true);
      p += 12;
      const q0 = f * nb * 4;
      for (let k = 0; k < nb * 4; k++) quat[q0 + k] = blk.getInt16(p + k * 2, true);
    }
    clips[name] = { name, dur, nf, loop, root, quat };
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('aVCol', new THREE.BufferAttribute(col, 3, true));
  // Indices are *not* normalised — they are bone numbers, and 27 has to arrive
  // in the shader as 27 and not as 27/255.
  g.setAttribute('aBoneIdx', new THREE.BufferAttribute(bidx, 4, false));
  g.setAttribute('aBoneWt', new THREE.BufferAttribute(bwgt, 4, true));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  // The bind pose's bounding sphere is not the animated one — a raised arm or
  // a somersault leaves it — and a figure that pops out of existence when she
  // reaches up is worse than one that is occasionally drawn off screen.
  g.boundingSphere.radius *= 1.9;
  return { geo: g, bones, clips, nv, tris: ni / 3 };
}

/** Depth-only vertex program for a skinned caster. Position, and nothing else. */
function skinCasterVert(nb) {
  return /* glsl */ `
attribute vec4 aBoneIdx;
attribute vec4 aBoneWt;
uniform vec4 uBones[${nb * 3}];
varying float vDepth;

mat4 boneMat(int i){
  vec4 a = uBones[i * 3], b = uBones[i * 3 + 1], c = uBones[i * 3 + 2];
  return mat4(a.x, b.x, c.x, 0.0,
              a.y, b.y, c.y, 0.0,
              a.z, b.z, c.z, 0.0,
              a.w, b.w, c.w, 1.0);
}

void main(){
  mat4 sm = boneMat(int(aBoneIdx.x)) * aBoneWt.x
          + boneMat(int(aBoneIdx.y)) * aBoneWt.y
          + boneMat(int(aBoneIdx.z)) * aBoneWt.z
          + boneMat(int(aBoneIdx.w)) * aBoneWt.w;
  vec3 p = (modelMatrix * sm * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vDepth = gl_Position.z / gl_Position.w * 0.5 + 0.5;
}
`;
}

// ── quaternion helpers ───────────────────────────────────────────────────────
//
// Written out on flat arrays rather than done with THREE.Quaternion, because
// this runs 28 times a bone-hierarchy pass, twice a frame while a crossfade is
// in flight, and the object churn is the whole cost of the feature.

/** out[o] = a[i] * b[j], all (x, y, z, w). Aliasing-safe. */
function qmul(out, o, a, i, b, j) {
  const ax = a[i], ay = a[i + 1], az = a[i + 2], aw = a[i + 3];
  const bx = b[j], by = b[j + 1], bz = b[j + 2], bw = b[j + 3];
  out[o] = aw * bx + ax * bw + ay * bz - az * by;
  out[o + 1] = aw * by - ax * bz + ay * bw + az * bx;
  out[o + 2] = aw * bz + ax * by - ay * bx + az * bw;
  out[o + 3] = aw * bw - ax * bx - ay * by - az * bz;
}

/** Rotate the vector at v[j] by the quaternion at q[i], into out[o]. */
function qrotv(out, o, q, i, v, j) {
  const x = q[i], y = q[i + 1], z = q[i + 2], w = q[i + 3];
  const vx = v[j], vy = v[j + 1], vz = v[j + 2];
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  out[o] = vx + w * tx + y * tz - z * ty;
  out[o + 1] = vy + w * ty + z * tx - x * tz;
  out[o + 2] = vz + w * tz + x * ty - y * tx;
}

/**
 * Normalised linear blend, shortest way round.
 *
 * Not slerp. At 30 samples a second adjacent frames are a couple of degrees
 * apart and nlerp is indistinguishable from slerp for a fraction of the cost;
 * the one place it would show — a crossfade between two clips whose poses are
 * far apart — is handled by keeping the fades short rather than by paying for a
 * trigonometric blend on every bone of every frame.
 */
function qnlerp(out, o, a, i, b, j, u) {
  let bx = b[j], by = b[j + 1], bz = b[j + 2], bw = b[j + 3];
  const ax = a[i], ay = a[i + 1], az = a[i + 2], aw = a[i + 3];
  if (ax * bx + ay * by + az * bz + aw * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let x = ax + (bx - ax) * u, y = ay + (by - ay) * u;
  let z = az + (bz - az) * u, w = aw + (bw - aw) * u;
  const l = Math.hypot(x, y, z, w) || 1;
  out[o] = x / l; out[o + 1] = y / l; out[o + 2] = z / l; out[o + 3] = w / l;
}

/**
 * Wrap a decoded v3 blob into something that can be posed.
 *
 * Returns the mesh, a `play(name, opts)` and an `update(dt)`. The bone palette
 * lives in a uniform shared by the surface material and the shadow caster, so
 * a figure is skinned exactly once a frame no matter how many times she is
 * drawn.
 */
function skinnedFigure(data, opts = {}) {
  const nb = data.bones.length;
  const uBones = { value: new Float32Array(nb * 12) };

  const mat = solidMaterial(0xffffff, {
    ...opts,
    defines: { FR_SKIN: '', FR_BONES: nb },
    uniforms: { uBones, ...(opts.uniforms || {}) },
  });
  const mesh = new THREE.Mesh(data.geo, mat);

  // Rest hierarchy, and the inverse bind that undoes it. Both are derived here
  // rather than shipped: the blob carries the parent-relative rest transform
  // and nothing else, so there is no way for the two to disagree.
  const restQ = new Float32Array(nb * 4), restT = new Float32Array(nb * 3);
  const bindQ = new Float32Array(nb * 4), bindT = new Float32Array(nb * 3);
  const invQ = new Float32Array(nb * 4), invT = new Float32Array(nb * 3);
  for (let i = 0; i < nb; i++) {
    const b = data.bones[i];
    restQ.set(b.q, i * 4);
    restT.set(b.t, i * 3);
    if (b.parent < 0) {
      bindQ.set(b.q, i * 4);
      bindT.set(b.t, i * 3);
    } else {
      qmul(bindQ, i * 4, bindQ, b.parent * 4, restQ, i * 4);
      qrotv(bindT, i * 3, bindQ, b.parent * 4, restT, i * 3);
      bindT[i * 3] += bindT[b.parent * 3];
      bindT[i * 3 + 1] += bindT[b.parent * 3 + 1];
      bindT[i * 3 + 2] += bindT[b.parent * 3 + 2];
    }
    invQ[i * 4] = -bindQ[i * 4];
    invQ[i * 4 + 1] = -bindQ[i * 4 + 1];
    invQ[i * 4 + 2] = -bindQ[i * 4 + 2];
    invQ[i * 4 + 3] = bindQ[i * 4 + 3];
    qrotv(invT, i * 3, invQ, i * 4, bindT, i * 3);
    invT[i * 3] *= -1; invT[i * 3 + 1] *= -1; invT[i * 3 + 2] *= -1;
  }

  // Scratch, allocated once.
  const localQ = new Float32Array(nb * 4), localT = new Float32Array(nb * 3);
  const mixQ = new Float32Array(nb * 4), mixT = new Float32Array(nb * 3);
  const worldQ = new Float32Array(nb * 4), worldT = new Float32Array(nb * 3);
  const tmp = new Float32Array(4);

  function sample(clip, t, outQ, outT) {
    const nf = clip.nf;
    let u = clip.loop ? ((t % clip.dur) + clip.dur) % clip.dur
      : Math.min(Math.max(t, 0), clip.dur);
    const fp = clip.loop ? (u / clip.dur) * nf : (u / clip.dur) * (nf - 1);
    let f0 = Math.floor(fp);
    const a = fp - f0;
    let f1 = f0 + 1;
    if (clip.loop) { f0 = ((f0 % nf) + nf) % nf; f1 = f1 % nf; }
    else { f0 = Math.min(Math.max(f0, 0), nf - 1); f1 = Math.min(f1, nf - 1); }
    const r = clip.root, q = clip.quat;
    for (let k = 0; k < 3; k++) {
      outT[k] = r[f0 * 3 + k] + (r[f1 * 3 + k] - r[f0 * 3 + k]) * a;
    }
    const o0 = f0 * nb * 4, o1 = f1 * nb * 4;
    for (let i = 0; i < nb; i++) {
      const p = i * 4;
      let bx = q[o1 + p] / 32767, by = q[o1 + p + 1] / 32767;
      let bz = q[o1 + p + 2] / 32767, bw = q[o1 + p + 3] / 32767;
      const ax = q[o0 + p] / 32767, ay = q[o0 + p + 1] / 32767;
      const az = q[o0 + p + 2] / 32767, aw = q[o0 + p + 3] / 32767;
      if (ax * bx + ay * by + az * bz + aw * bw < 0) {
        bx = -bx; by = -by; bz = -bz; bw = -bw;
      }
      let x = ax + (bx - ax) * a, y = ay + (by - ay) * a;
      let z = az + (bz - az) * a, w = aw + (bw - aw) * a;
      const l = Math.hypot(x, y, z, w) || 1;
      outQ[p] = x / l; outQ[p + 1] = y / l; outQ[p + 2] = z / l; outQ[p + 3] = w / l;
    }
  }

  const st = {
    cur: null, curT: 0, prev: null, prevT: 0, fade: 0, fadeLen: 0,
    next: null, speed: 1,
  };

  /**
   * @param name   clip to play
   * @param fade   seconds to cross into it
   * @param next   clip to fall back to when a one-shot finishes
   */
  function play(name, { fade = 0.25, next = null, from = 0 } = {}) {
    const clip = data.clips[name];
    if (!clip || clip === st.cur) return false;
    if (st.cur && fade > 0) {
      st.prev = st.cur; st.prevT = st.curT; st.fade = 0; st.fadeLen = fade;
    } else {
      st.prev = null; st.fadeLen = 0;
    }
    st.cur = clip; st.curT = from; st.next = next;
    return true;
  }

  function update(dt) {
    if (!st.cur) return;
    const step = dt * st.speed;
    st.curT += step;
    if (!st.cur.loop && st.curT >= st.cur.dur && st.next) {
      const back = st.next;
      st.next = null;
      play(back, { fade: 0.28 });
      st.curT += step;
    }

    sample(st.cur, st.curT, localQ, localT);
    if (st.prev) {
      st.fade += step;
      const u = Math.min(1, st.fade / st.fadeLen);
      st.prevT += step;
      sample(st.prev, st.prevT, mixQ, mixT);
      for (let i = 0; i < nb; i++) qnlerp(localQ, i * 4, mixQ, i * 4, localQ, i * 4, u);
      for (let k = 0; k < 3; k++) localT[k] = mixT[k] + (localT[k] - mixT[k]) * u;
      if (u >= 1) st.prev = null;
    }

    const P = uBones.value;
    for (let i = 0; i < nb; i++) {
      const p = data.bones[i].parent;
      // The root's translation is the clip's; everything below it hangs off the
      // rest skeleton, because bone lengths do not animate.
      const tx = p < 0 ? localT[0] : restT[i * 3];
      const ty = p < 0 ? localT[1] : restT[i * 3 + 1];
      const tz = p < 0 ? localT[2] : restT[i * 3 + 2];
      if (p < 0) {
        worldQ[0] = localQ[0]; worldQ[1] = localQ[1];
        worldQ[2] = localQ[2]; worldQ[3] = localQ[3];
        worldT[0] = tx; worldT[1] = ty; worldT[2] = tz;
      } else {
        qmul(worldQ, i * 4, worldQ, p * 4, localQ, i * 4);
        tmp[0] = tx; tmp[1] = ty; tmp[2] = tz;
        qrotv(worldT, i * 3, worldQ, p * 4, tmp, 0);
        worldT[i * 3] += worldT[p * 3];
        worldT[i * 3 + 1] += worldT[p * 3 + 1];
        worldT[i * 3 + 2] += worldT[p * 3 + 2];
      }

      // skin = world * bind^-1, written straight out as three rows of a 3x4.
      const sq = i * 4;
      qmul(mixQ, sq, worldQ, sq, invQ, sq);
      qrotv(mixT, i * 3, worldQ, sq, invT, i * 3);
      const x = mixQ[sq], y = mixQ[sq + 1], z = mixQ[sq + 2], w = mixQ[sq + 3];
      const x2 = x + x, y2 = y + y, z2 = z + z;
      const xx = x * x2, xy = x * y2, xz = x * z2;
      const yy = y * y2, yz = y * z2, zz = z * z2;
      const wx = w * x2, wy = w * y2, wz = w * z2;
      const o = i * 12;
      P[o] = 1 - (yy + zz); P[o + 1] = xy - wz; P[o + 2] = xz + wy;
      P[o + 3] = worldT[i * 3] + mixT[i * 3];
      P[o + 4] = xy + wz; P[o + 5] = 1 - (xx + zz); P[o + 6] = yz - wx;
      P[o + 7] = worldT[i * 3 + 1] + mixT[i * 3 + 1];
      P[o + 8] = xz - wy; P[o + 9] = yz + wx; P[o + 10] = 1 - (xx + yy);
      P[o + 11] = worldT[i * 3 + 2] + mixT[i * 3 + 2];
    }
  }

  /** Register with the shadow pass, sharing this figure's bone palette. */
  function cast(shadow, o = {}) {
    return shadow.cast(mesh, {
      near: o.near !== false, dynamic: true,
      material: shadow.casterMaterial(skinCasterVert(nb), { uBones }),
    });
  }

  update(0);
  return {
    mesh, material: mat, bones: data.bones, uBones, cast,
    clips: Object.keys(data.clips), tris: data.tris, nv: data.nv,
    play, update, state: st,
    playing: () => (st.cur ? st.cur.name : null),
  };
}

/** Pull one skinned model out of the inlined payload. Null if it is not there. */
async function loadSkin(key, opts) {
  const b64 = PAYLOAD[key];
  if (!b64) { console.warn('no payload for skin', key); return null; }
  try {
    return skinnedFigure(readFR3DSkin(await inflateBinary(b64)), opts);
  } catch (e) {
    console.warn('skin failed:', key, e.message);
    return null;
  }
}
