// -----------------------------------------------------------------------------
// The baked world: decode the payloads build.py inlined, and expose the world
// to everything else as a handful of lookups.
//
// Height arrives as a 16-bit value split across the red and green channels of a
// PNG, because PNG is the only lossless compressor every browser already has.
// Footprints and roads arrive gzipped and are inflated with DecompressionStream.
// -----------------------------------------------------------------------------

const world = {
  grid: 0,
  height: null,        // Float32Array, metres
  cover: null,         // Uint8Array, COVER.*
  fuelJitter: null,    // Uint8Array 0..255
  urban: null,         // Uint8Array 0..255, how built-up
  shore: null,         // Uint8Array 0..255, distance to the waterline / 400 m
  heightTex: null,     // R32F  — sampled by every vertex shader
  coverTex: null,      // RGBA8 — nearest, sampled by the terrain fragment shader
  town: [],
  roads: [],
  rail: [],
  places: [],
  meta: null,
};

/** Decode a data-URI PNG into raw RGBA bytes. */
function decodePNG(dataUri) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      resolve({
        w: img.width, h: img.height,
        data: g.getImageData(0, 0, img.width, img.height).data,
      });
    };
    img.onerror = () => reject(new Error('payload image failed to decode'));
    img.src = dataUri;
  });
}

/** base64 gzip -> parsed JSON. */
async function inflateJSON(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

async function loadWorld(onStage) {
  const meta = world.meta = PAYLOAD.meta;
  const N = meta.grid;
  world.grid = N;

  onStage('load.karst');
  const hp = await decodePNG(PAYLOAD.terrain_h);
  const n2 = N * N;
  const height = new Float32Array(n2);
  const shore = new Uint8Array(n2);
  for (let i = 0; i < n2; i++) {
    const o = i * 4;
    const v = (hp.data[o] * 256 + hp.data[o + 1]) / 65535;
    height[i] = v * meta.heightScale + meta.heightBias;
    shore[i] = hp.data[o + 2];
  }
  world.height = height;
  world.shore = shore;

  onStage('load.cover');
  const cp = await decodePNG(PAYLOAD.terrain_c);
  const cover = new Uint8Array(n2);
  const fuelJitter = new Uint8Array(n2);
  const urban = new Uint8Array(n2);
  for (let i = 0; i < n2; i++) {
    const o = i * 4;
    cover[i] = Math.round(cp.data[o] / 25);
    fuelJitter[i] = cp.data[o + 1];
    urban[i] = cp.data[o + 2];
  }
  world.cover = cover;
  world.fuelJitter = fuelJitter;
  world.urban = urban;

  onStage('load.town');
  world.town = await inflateJSON(PAYLOAD.town_json);
  world.roads = await inflateJSON(PAYLOAD.roads_json);
  // The railway is small enough that a missing payload is not worth a branch
  // anywhere downstream — an empty list draws nothing.
  world.rail = PAYLOAD.rail_json ? await inflateJSON(PAYLOAD.rail_json) : [];
  world.places = PAYLOAD.places;

  // ── GPU copies ─────────────────────────────────────────────────────────
  // Height is a single float channel so the vertex shader can filter it
  // linearly; anything narrower shows terracing on the long shallow slopes
  // above the channel. Cover must not be filtered at all — a blend of "pine"
  // and "rock" is a class that does not exist.
  const ht = new THREE.DataTexture(height, N, N, THREE.RedFormat, THREE.FloatType);
  ht.magFilter = ht.minFilter = THREE.LinearFilter;
  ht.wrapS = ht.wrapT = THREE.ClampToEdgeWrapping;
  ht.needsUpdate = true;
  world.heightTex = ht;

  const packed = new Uint8Array(n2 * 4);
  for (let i = 0; i < n2; i++) {
    packed[i * 4] = cover[i];
    packed[i * 4 + 1] = fuelJitter[i];
    packed[i * 4 + 2] = urban[i];
    packed[i * 4 + 3] = shore[i];
  }
  const ct = new THREE.DataTexture(packed, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  ct.magFilter = ct.minFilter = THREE.NearestFilter;
  ct.wrapS = ct.wrapT = THREE.ClampToEdgeWrapping;
  ct.needsUpdate = true;
  world.coverTex = ct;

  U.uTerrain.value = ht;
  U.uCover = { value: ct };
  U.uHeightScale.value = 1;
  U.uHeightBias.value = 0;
}

// ------------------------------------------------------------------ lookups ---

/** World metres -> grid index, clamped. */
function gridIndex(x, z) {
  const N = world.grid;
  const gx = clamp(((x + HALF) / CONFIG.world) * (N - 1), 0, N - 1);
  const gz = clamp(((z + HALF) / CONFIG.world) * (N - 1), 0, N - 1);
  return { gx, gz };
}

/** Bilinear terrain height at a world position, in metres. */
function groundAt(x, z) {
  const N = world.grid;
  const { gx, gz } = gridIndex(x, z);
  const x0 = gx | 0, z0 = gz | 0;
  const x1 = Math.min(x0 + 1, N - 1), z1 = Math.min(z0 + 1, N - 1);
  const tx = gx - x0, tz = gz - z0;
  const h = world.height;
  return (
    h[z0 * N + x0] * (1 - tx) * (1 - tz) + h[z0 * N + x1] * tx * (1 - tz)
    + h[z1 * N + x0] * (1 - tx) * tz + h[z1 * N + x1] * tx * tz
  );
}

/** Nearest cover class at a world position. */
function coverAt(x, z) {
  const N = world.grid;
  const { gx, gz } = gridIndex(x, z);
  return world.cover[Math.round(gz) * N + Math.round(gx)];
}

function urbanAt(x, z) {
  const N = world.grid;
  const { gx, gz } = gridIndex(x, z);
  return world.urban[Math.round(gz) * N + Math.round(gx)] / 255;
}

/** Metres to the waterline, from whichever side you are on. Saturates at 400. */
function shoreAt(x, z) {
  const N = world.grid;
  const { gx, gz } = gridIndex(x, z);
  return (world.shore[Math.round(gz) * N + Math.round(gx)] / 255) * 400;
}

const isSea = (x, z) => coverAt(x, z) === COVER.SEA;

/** Ground normal, for shading hints and for how fast fire runs uphill. */
function normalAt(x, z, eps = 8) {
  const hx = groundAt(x + eps, z) - groundAt(x - eps, z);
  const hz = groundAt(x, z + eps) - groundAt(x, z - eps);
  return new THREE.Vector3(-hx, 2 * eps, -hz).normalize();
}

/** True if every sample on the segment is open water — used by the scoop. */
function waterRunClear(x, z, dx, dz, len, step = 25) {
  const n = Math.max(2, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * len;
    if (!isSea(x + dx * t, z + dz * t)) return false;
  }
  return true;
}

/** Named place lookup — the landmarks get their positions from OSM. */
function placeNamed(fragment) {
  const f = fragment.toLowerCase();
  return world.places.find((p) => p.n && p.n.toLowerCase().includes(f));
}
