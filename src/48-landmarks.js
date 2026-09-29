// -----------------------------------------------------------------------------
// The four buildings that had to be modelled rather than generated.
//
// Everything else in this town comes out of OpenStreetMap footprints extruded
// to a guessed height, which is fine for eight thousand houses and hopeless for
// the one building the whole game is about. These four are built in Blender
// (tools/blender/landmarks.py), baked to a small binary blob, and inlined.
//
// The format is deliberately minimal — position, normal, colour, index — so the
// reader is thirty lines and there is no glTF parser in the bundle.
// -----------------------------------------------------------------------------

/**
 * Where each model goes. Positions come from the OSM place names, so they are
 * the real ones; the yaw is by eye against the aerial photographs, because
 * OSM will tell you where St James is but not which way it faces.
 */
const LANDMARKS = [
  { key: 'cathedral_fr3d', place: 'katedrala', yaw: -0.44, sink: 1.6, clear: 30,
    name: 'katedrala sv. Jakova' },
  { key: 'lighthouse_fr3d', place: 'svjetionik rt jadrija', yaw: 0.62, sink: 0.8,
    clear: 16, name: 'svjetionik Jadrija' },
  // The second landmark that is a place and not a piece of ground.
  //
  // It stands on the islet of Ljuljevac, which is 150 m across and therefore
  // twenty-three texels of a 6.35 m raster — and OSM's coastline way is not
  // drawn round it, so the bake never put any land there. `groundAt` at the
  // OSM centroid (-1237.7, 720.2) reads **-11.34 m**, which is the seabed, and
  // `sink: 2.4` took it a further 2.4 down. The model spans y -1.5..+13.0, so
  // the parapet of the fort that shut the Ottoman fleet out of this channel
  // has been sitting **0.74 m under the surface** since the day it went in.
  // Nothing showed it: the only other reader of `landmarkSites` is the city
  // generator, which wants a clearance radius and not a height.
  //
  // `atY: 0` — the same answer the bridge gets, for the same reason and with
  // one better: the Blender source calls the -1.5..+3.0 block "the battered
  // base, wider at sea level", so local y = 0 is where the model was drawn to
  // meet the water. Everything below it is scarp and belongs under.
  //
  // The yaw is measured now rather than eyeballed. The OSM polygon is a
  // three-lobed plan — a round bastion NNW, an arm E, and a 30° wedge whose
  // tip is 76 m from the centroid at bearing 198° — and the wedge is the point
  // Sanmicheli aimed down the channel at anything coming in. The model's own
  // point is at local -X, so the yaw that puts it on 198° is atan2(0.95, 0.31)
  // = 1.256. It was -0.54, which aimed it WNW at the open sea off Zablaće:
  // 106° out, and broadside-on from the one place you now sail past it.
  //
  // What is still missing is the islet. The walls rise straight out of the
  // water on the two seaward faces, which is why this reads at all — but on
  // the SE side there is a rock and sand spit joining the fort to the shore,
  // and there is no spit here.
  //
  // The model was also *half the fortress* until 23 August 2026, which nothing
  // caught because nothing looks at it from close enough to tell — the boat
  // was the first thing in this game to sail past it. See the note in
  // tools/blender/landmarks.py: the plan is now the 129.9 x 113.3 m the OSM
  // way traces, where it had been 74.2 x 58.0.
  //
  // `clear` went with it. It suppresses the extruded-box city inside a radius,
  // and 55 m was sized to the small model while the real footprint reaches
  // 79.4 m from its centroid — so the far corners of the fort's own way were
  // being extruded as a building *through* the landmark standing on them.
  { key: 'fort_nikola_fr3d', place: 'tvrđava svetog nikole', yaw: 1.256, atY: 0,
    clear: 82, name: 'tvrđava sv. Nikole' },
  { key: 'fort_mihovil_fr3d', place: 'tvrđava svetog mihovila', yaw: 0.38, sink: 5.0,
    clear: 48, name: 'tvrđava sv. Mihovila' },
  // The one landmark that is not a place but a span. OSM way 70310004 carries
  // bridge=yes and runs 389 m from (-1867, -3851) to (-1478, -3871), so it is
  // positioned from those two ends rather than from a name in places.json —
  // and it sits at *sea level*, because the ground under the middle of it is
  // forty metres of seabed. `clear` keeps the extruded-box city off the deck.
  { key: 'sibenski_most_fr3d', x: -1672.5, z: -3861, yaw: 0.0513, atY: 0,
    clear: 40, name: 'Šibenski most' },
];

/** Resolved once the world is loaded; the city generator reads it too. */
const landmarkSites = [];

function resolveLandmarks() {
  landmarkSites.length = 0;
  for (const L of LANDMARKS) {
    // Most of these are looked up by name in the OSM places index. The bridge
    // gives its own coordinates, because a 390 m span has two ends and no
    // centroid worth naming.
    if (L.x != null) { landmarkSites.push({ ...L }); continue; }
    const p = placeNamed(L.place);
    if (!p) { console.warn('landmark not in OSM places:', L.place); continue; }
    landmarkSites.push({ ...L, x: p.x, z: p.z });
  }
  return landmarkSites;
}

/** base64 gzip -> ArrayBuffer. */
async function inflateBinary(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(s).arrayBuffer();
}

/** Decode one .fr3d blob into a BufferGeometry with baked vertex colours. */
function readFR3D(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1),
    dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'FR3D') throw new Error('not an fr3d blob: ' + magic);
  const nv = dv.getUint32(8, true);
  const ni = dv.getUint32(12, true);
  if (dv.getUint32(4, true) === 3) return readFR3Dq(buf, dv, nv, ni);
  if (dv.getUint32(4, true) === 7) return readFR3Dp(buf, dv, nv, ni);

  let o = 40;                                    // 4 magic + 3 u32 + 6 f32
  const pos = new Float32Array(buf, o, nv * 3); o += nv * 12;
  const nrm = new Float32Array(buf, o, nv * 3); o += nv * 12;
  const col = new Uint8Array(buf, o, nv * 3); o += nv * 3;
  // The colour bytes leave the index array on an arbitrary offset, and a typed
  // array view has to be aligned — so this one is a copy.
  const idx = new Uint32Array(buf.slice(o, o + ni * 4));

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('aVCol', new THREE.BufferAttribute(col, 3, true));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * The quantised .fr3d, v3 (`export_q` in tools/blender/frmesh.py): positions
 * as uint16 across the header's bounding box, normals as int8, the index as
 * uint16 under 65 536 vertices. Expanded straight back to floats here, so a
 * v3 geometry is a v1 geometry to everything that uses it. It exists for the
 * size of the page: a v1 blob is mostly float mantissa, which gzip cannot
 * shrink, and the cars' near tier was 1.14 MB of html as v1 (28 Sep).
 */
function readFR3Dq(buf, dv, nv, ni) {
  const lo = [0, 1, 2].map((k) => dv.getFloat32(16 + k * 4, true));
  const hi = [0, 1, 2].map((k) => dv.getFloat32(28 + k * 4, true));
  let o = 40;
  const qp = new Uint16Array(buf, o, nv * 3); o += nv * 6;
  const qn = new Int8Array(buf, o, nv * 3); o += nv * 3;
  const col = new Uint8Array(buf, o, nv * 3); o += nv * 3;
  const idx = nv < 65536 ? new Uint16Array(buf, o, ni) : new Uint32Array(buf, o, ni);
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) {
    const k = i % 3;
    pos[i] = lo[k] + (qp[i] / 65535) * (hi[k] - lo[k]);
  }
  for (let i = 0; i < nv; i++) {
    const x = qn[i * 3], y = qn[i * 3 + 1], z = qn[i * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    nrm[i * 3] = x / l; nrm[i * 3 + 1] = y / l; nrm[i * 3 + 2] = z / l;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('aVCol', new THREE.BufferAttribute(col, 3, true));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * The packed .fr3d, v7 (tools/fr3d_q.py, `export_p` in frmesh.py): v3's
 * uint16 positions, int8 normals and index, laid out so gzip can see them.
 * Positions are per-axis zigzag deltas from the vertex before (mod 65 536) as
 * a run of low bytes and a run of high bytes; normals and colours one run per
 * axis; the index zigzag deltas from the index before (mod 2^32), four byte
 * runs, lowest first. Not a bit of precision differs from v3 — it exists
 * because v3's index was noise to gzip and it is not noise: the exporter emits
 * vertices in triangle order, so almost every index is the last one plus one.
 * Measured on the vikendica shell, 29 Sep: index 825 KB of gzip as v3, 16 as
 * v7; positions 1 006 against 356.
 */
function readFR3Dp(buf, dv, nv, ni) {
  const lo = [0, 1, 2].map((k) => dv.getFloat32(16 + k * 4, true));
  const hi = [0, 1, 2].map((k) => dv.getFloat32(28 + k * 4, true));
  const b = new Uint8Array(buf);
  let o = 40;
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  const col = new Uint8Array(nv * 3);
  for (let k = 0; k < 3; k++) {
    const s = (hi[k] - lo[k]) / 65535, l0 = lo[k];
    let acc = 0;
    for (let i = 0; i < nv; i++) {
      const u = b[o + i] | (b[o + nv + i] << 8);
      acc = (acc + ((u >>> 1) ^ -(u & 1))) & 0xffff;
      pos[i * 3 + k] = l0 + acc * s;
    }
    o += nv * 2;
  }
  for (let k = 0; k < 3; k++, o += nv) {
    for (let i = 0; i < nv; i++) nrm[i * 3 + k] = (b[o + i] << 24) >> 24;
  }
  for (let i = 0; i < nv; i++) {
    const x = nrm[i * 3], y = nrm[i * 3 + 1], z = nrm[i * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    nrm[i * 3] = x / l; nrm[i * 3 + 1] = y / l; nrm[i * 3 + 2] = z / l;
  }
  for (let k = 0; k < 3; k++, o += nv) {
    for (let i = 0; i < nv; i++) col[i * 3 + k] = b[o + i];
  }
  const idx = nv < 65536 ? new Uint16Array(ni) : new Uint32Array(ni);
  let acc = 0;
  for (let i = 0; i < ni; i++) {
    const u = (b[o + i] | (b[o + ni + i] << 8) | (b[o + 2 * ni + i] << 16)
      | (b[o + 3 * ni + i] << 24)) >>> 0;
    acc = (acc + ((u >>> 1) ^ -(u & 1))) >>> 0;
    idx[i] = acc;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('aVCol', new THREE.BufferAttribute(col, 3, true));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * Decode one .fr3d **v2** blob: the same vertex data, plus a table of rigid
 * parts and the joint each one hangs off.
 *
 * There is no skinning here and there is deliberately no glTF. Eleven rigid
 * pieces on a tree of pivots is what somebody in heavy kit reads as anyway, and
 * it means the runtime is this function and a loop that makes Groups, rather
 * than an importer, a skeleton solver and a skinned-mesh draw path.
 *
 * Every part's vertices sit in its own contiguous block with its own
 * indices rebased to zero, so each piece takes a *view* on the shared arrays
 * and one figure costs one copy of the model however many joints it has.
 */
function readFR3DRig(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1),
    dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'FR3D') throw new Error('not an fr3d blob: ' + magic);
  const version = dv.getUint32(4, true);
  if (version !== 2) throw new Error('fr3d rig needs version 2, got ' + version);
  const nv = dv.getUint32(8, true);
  const ni = dv.getUint32(12, true);

  let o = 40;
  const n = dv.getUint32(o, true); o += 4;
  const dec = new TextDecoder();
  const table = [];
  for (let i = 0; i < n; i++) {
    const len = dv.getUint16(o, true); o += 2;
    const name = dec.decode(new Uint8Array(buf, o, len)); o += len;
    const parent = dv.getInt32(o, true);
    const pivot = [dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true),
      dv.getFloat32(o + 12, true)];
    table.push({
      name, parent, pivot,
      vStart: dv.getUint32(o + 16, true), vCount: dv.getUint32(o + 20, true),
      iStart: dv.getUint32(o + 24, true), iCount: dv.getUint32(o + 28, true),
    });
    o += 32;
  }

  // The parts table is variable-length, so the float blocks land on whatever
  // offset it happens to end on — and a Float32Array view has to be 4-byte
  // aligned. One copy each, once, at load.
  const pos = new Float32Array(buf.slice(o, o + nv * 12)); o += nv * 12;
  const nrm = new Float32Array(buf.slice(o, o + nv * 12)); o += nv * 12;
  const col = new Uint8Array(buf, o, nv * 3); o += nv * 3;
  const idx = new Uint32Array(buf.slice(o, o + ni * 4));

  for (const p of table) {
    const g = new THREE.BufferGeometry();
    const v0 = p.vStart * 3, v1 = (p.vStart + p.vCount) * 3;
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(v0, v1), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm.subarray(v0, v1), 3));
    g.setAttribute('aVCol', new THREE.BufferAttribute(col.subarray(v0, v1), 3, true));
    g.setIndex(new THREE.BufferAttribute(
      idx.subarray(p.iStart, p.iStart + p.iCount), 1));
    g.computeBoundingSphere();
    p.geo = g;
  }
  return { parts: table, tris: ni / 3 };
}

/** Pull one rigged model out of the inlined payload. Null if it is not there. */
async function loadRig(key) {
  const b64 = PAYLOAD[key];
  if (!b64) { console.warn('no payload for rig', key); return null; }
  try {
    return readFR3DRig(await inflateBinary(b64));
  } catch (e) {
    console.warn('rig failed:', key, e.message);
    return null;
  }
}

async function buildLandmarks(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const placed = [];

  const mat = solidMaterial(0xffffff, {
    spec: 0.06,
    specPower: 26,
    // The Blender export bakes stone, lead, tile and glass into the vertex
    // colours, so one material draws the whole thing.
    body: 'base *= vVCol;',
  });

  for (const site of resolveLandmarks()) {
    const b64 = PAYLOAD[site.key];
    if (!b64) { console.warn('no payload for', site.key); continue; }
    let geo;
    try {
      geo = readFR3D(await inflateBinary(b64));
    } catch (e) {
      console.warn('landmark failed:', site.key, e.message);
      continue;
    }
    const mesh = new THREE.Mesh(geo, mat);
    // `atY` is an absolute height for anything that does not stand on the
    // ground it is over — which so far is the bridge.
    mesh.position.set(site.x,
      site.atY != null ? site.atY : groundAt(site.x, site.z) - (site.sink || 0),
      site.z);
    mesh.rotation.y = site.yaw;
    mesh.updateMatrixWorld();
    root.add(mesh);
    placed.push({ ...site, mesh, tris: geo.index.count / 3 });
  }

  return {
    root,
    list: placed,
    stats: () => placed.map((p) => p.name),
    tris: placed.reduce((s, p) => s + p.tris, 0),
  };
}
