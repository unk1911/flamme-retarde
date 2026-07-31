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
  { key: 'fort_nikola_fr3d', place: 'tvrđava svetog nikole', yaw: -0.54, sink: 2.4,
    clear: 55, name: 'tvrđava sv. Nikole' },
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
