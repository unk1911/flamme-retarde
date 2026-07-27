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
];

/** Resolved once the world is loaded; the city generator reads it too. */
const landmarkSites = [];

function resolveLandmarks() {
  landmarkSites.length = 0;
  for (const L of LANDMARKS) {
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
    mesh.position.set(site.x, groundAt(site.x, site.z) - site.sink, site.z);
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
