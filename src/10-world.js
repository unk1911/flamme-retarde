// -----------------------------------------------------------------------------
// The ground. A fixed grid of world-anchored tiles, each drawn at one of five
// resolutions depending on how far away it is, batched into one instanced draw
// call per level. Anchoring the tiles to the world rather than to the camera is
// what stops the terrain from swimming underneath you at 90 m/s; the skirts
// round each tile are what hide the cracks where two levels meet.
//
// Height comes from the baked DEM. Everything else — the karst fluting, the
// dry-stone walls, the burn scars, the wet ground behind a drop — is computed
// in the fragment shader from the cover map.
// -----------------------------------------------------------------------------

const TERRAIN = {
  tiles: 40,                     // 40 x 40 tiles of 325 m
  lods: [64, 32, 16, 8, 4],      // quads per tile side
  lodDist: [700, 1600, 3200, 6400],
  skirt: 60,                     // metres the border ring drops
};

/**
 * One tile geometry: an n x n grid in local metres, plus a skirt ring around
 * the edge that the shader pushes downward. Positions carry x and z; y is the
 * skirt flag, because a whole attribute for one bit is not worth the bandwidth.
 */
function tileGeometry(n, size) {
  const step = size / n;
  const verts = (n + 1) * (n + 1);
  const skirtVerts = 4 * (n + 1);
  const pos = new Float32Array((verts + skirtVerts) * 3);

  let p = 0;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      pos[p++] = i * step;
      pos[p++] = 0;
      pos[p++] = j * step;
    }
  }
  // Skirt ring: same xz as the border, flagged so the shader drops it.
  const edge = [];
  for (let i = 0; i <= n; i++) edge.push([i * step, 0]);               // north
  for (let i = 0; i <= n; i++) edge.push([size, i * step]);            // east
  for (let i = 0; i <= n; i++) edge.push([size - i * step, size]);     // south
  for (let i = 0; i <= n; i++) edge.push([0, size - i * step]);        // west
  for (const [x, z] of edge) {
    pos[p++] = x;
    pos[p++] = 1;
    pos[p++] = z;
  }

  const idx = [];
  const at = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      idx.push(a, d, b, b, d, c);
    }
  }
  // Stitch the skirt to the border it shadows.
  const borderIndex = [];
  for (let i = 0; i <= n; i++) borderIndex.push(at(i, 0));
  for (let i = 0; i <= n; i++) borderIndex.push(at(n, i));
  for (let i = 0; i <= n; i++) borderIndex.push(at(n - i, n));
  for (let i = 0; i <= n; i++) borderIndex.push(at(0, n - i));
  for (let k = 0; k < borderIndex.length - 1; k++) {
    const a = borderIndex[k], b = borderIndex[k + 1];
    const sa = verts + k, sb = verts + k + 1;
    idx.push(a, sa, b, b, sa, sb);
  }

  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  // The tiles are placed by instance offset, so a bounding sphere that only
  // covers the prototype would cull everything. We cull on the CPU instead.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  return g;
}

const TERRAIN_VERT = /* glsl */ `
attribute vec2 aOffset;      // tile origin in world metres

uniform float uSkirt;

varying vec3 vWorld;
varying vec2 vUv2;
varying float vHeight;

${GLSL_TERRAIN}

void main(){
  vec2 wxz = aOffset + position.xz;
  float h = texture2D(uTerrain, worldToUv(wxz)).r;
  vHeight = h;
  // Skirt vertices (flagged by y = 1) hang below the surface, out of sight,
  // filling the seam where a coarser neighbour disagrees about the height.
  h -= position.y * uSkirt;
  vWorld = vec3(wxz.x, h, wxz.y);
  vUv2 = worldToUv(wxz);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

const TERRAIN_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uCover;
uniform vec3 uCoverColor[10];
uniform float uTexelWorld;

varying vec3 vWorld;
varying vec2 vUv2;
varying float vHeight;

${GLSL_NOISE}
${GLSL_TERRAIN}
${GLSL_SKY}
${GLSL_HAZE}
${GLSL_WATER}
${GLSL_SHADOW}

uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform float uAmbI;
uniform float uNight;

void main(){
  // ── normal, from the height field rather than from the mesh ─────────────
  // The mesh is four different resolutions; the normals must not be, or every
  // LOD boundary shows up as a shading seam.
  float e = uTexelWorld;
  float hL = heightAt(vWorld.xz - vec2(e, 0.0));
  float hR = heightAt(vWorld.xz + vec2(e, 0.0));
  float hD = heightAt(vWorld.xz - vec2(0.0, e));
  float hU = heightAt(vWorld.xz + vec2(0.0, e));
  vec3 n = normalize(vec3(hL - hR, 2.0 * e, hD - hU));

  vec4 cv = texture2D(uCover, vUv2);
  int klass = int(cv.r * 255.0 + 0.5);
  float jitter = cv.g;
  float urban = cv.b;

  vec3 base = uCoverColor[0];
  for (int i = 0; i < 10; i++) if (i == klass) base = uCoverColor[i];

  float slope = 1.0 - n.y;

  // ── karst ───────────────────────────────────────────────────────────────
  // Limestone here weathers into fluted ribs that follow the dip of the beds.
  // Ridged noise at two scales, pushed hardest where the slope is steepest,
  // is most of what makes this read as Dalmatia rather than as generic hill.
  vec2 p = vWorld.xz;
  float rib = ridge2(p * 0.017, 4);
  float fine = fbm2(p * 0.14, 3);
  float rock = smoothstep(0.10, 0.42, slope);
  vec3 limestone = vec3(0.78, 0.755, 0.695);
  base = mix(base, limestone, rock * (0.35 + 0.45 * rib));
  base *= 0.86 + 0.28 * mix(fine, rib, 0.5);
  base *= 0.90 + 0.20 * jitter;

  // Dry-stone walls and field edges: bright thin lines on the gentler ground.
  float wall = smoothstep(0.86, 0.97, ridge2(p * 0.055 + 13.7, 2));
  base = mix(base, limestone * 1.06, wall * (1.0 - rock) * 0.5);

  // ── the flat ground ─────────────────────────────────────────────────────
  // Everything above is a slope feature: the ribs are pushed by the rock mask
  // and do nothing where the land lies flat. So the flats — Jadrija's shore, the
  // fields, the ground between the houses — came out as one unbroken colour,
  // which is what made a low pass read as painted card rather than as a place.
  // Real ground at this scale is mottled at three sizes at once.
  // (Naming note: flat and patch are both reserved words in GLSL ES, and
  // so is the backtick in this comment, which is inside a template literal.)
  float lowland = 1.0 - rock;
  float mottle = fbm2(p * 0.011 + 5.3, 2);            // ~90 m: grass into scrub
  float stony  = fbm2(p * 0.047 + 31.7, 2);           // ~21 m: stone breaking out
  base = mix(base, base * vec3(0.83, 0.90, 0.72),
             lowland * smoothstep(0.40, 0.82, mottle) * 0.55);
  base = mix(base, limestone * 0.90,
             lowland * smoothstep(0.60, 0.94, stony) * 0.40);
  // Two metres: gravel and thyme. Invisible from a thousand feet and the whole
  // difference between ground and a coloured plane when you are down at fifty.
  base *= 0.92 + 0.16 * fbm2(p * 0.62, 2);

  // Bleach the ground near the waterline — salt, shingle and glare.
  float shoreT = 1.0 - smoothstep(0.0, 0.055, cv.a);
  base = mix(base, vec3(0.86, 0.82, 0.72), shoreT * 0.5);

  // ── the seabed ──────────────────────────────────────────────────────────
  // The ground does not stop at the waterline — it has always run straight on
  // down, because it is one height field and there was never anywhere for it
  // to stop. What it did stop doing was looking like anything: below zero the
  // cover class is SEA and every one of those metres was painted a single flat
  // blue, which from underneath is a fog bank with a horizon in it. The sea
  // surface is opaque from above, so nobody ever saw it, and then somebody
  // could swim.
  //
  // A Dalmatian bottom is four things and they sort themselves by depth and by
  // slope, which is exactly what this shader already has to hand. Shell sand
  // and broken shingle in the first few metres where the swell keeps it moving;
  // posidonia — the meadow, the thing the whole Adriatic ecosystem stands on —
  // from about two metres down to fifteen wherever it is flat enough to root;
  // bare grazed limestone on anything steep; and out past the light, the fine
  // grey mud that everything eventually settles into.
  float wetD = max(0.0, -vWorld.y);
  // How far the fragment is, which the relief below needs and the haze needs
  // again later. Fine detail has to be faded out with range or it aliases:
  // a 33 cm ripple seen from twenty metres is well under a pixel, and what a
  // sub-pixel corrugation does on screen is crawl.
  float vdist = length(vWorld - uCamPos);
  float nearby = 1.0 - smoothstep(7.0, 24.0, vdist);
  if (wetD > 0.0) {
    vec3 shell = vec3(0.845, 0.815, 0.720);     // shell sand, nearly white
    vec3 shingle = vec3(0.660, 0.645, 0.590);   // and where the swell sorts it
    vec3 weed = vec3(0.150, 0.185, 0.105);      // posidonia, which is nearly black
    vec3 silt = vec3(0.335, 0.345, 0.320);      // the mud out past the meadow

    // The meadow. Patches with hard edges, because that is what a posidonia bed
    // looks like: it grows to a boundary and stops, and between the beds there
    // are winding lanes of clean sand that have their own name — intermattes.
    //
    // The scale is the whole of it. This was 0.0135 first, which is a feature
    // every seventy metres, and a swimmer can see about twenty: every dive
    // landed wholly inside one patch or wholly outside it, so the bottom came
    // out as one flat colour and all the work above did nothing. A real
    // Adriatic meadow breaks up at four or five metres, which is 0.2, and it
    // does it at three scales at once.
    // Three scales, because a swimmer three metres off the bottom can see about
    // a five-metre circle of it and a swimmer at the surface can see fifty.
    // One scale serves whichever of those it was tuned at and nothing else.
    float mead = fbm2(p * 0.042 + 71.3, 3) * 0.50
               + fbm2(p * 0.190 + 8.9, 2) * 0.30
               + fbm2(p * 0.640 + 44.1, 2) * 0.20;
    float lanes = ridge2(p * 0.088 + 4.1, 2);
    // Narrow, so the edge of a bed is an edge. Posidonia grows to a front and
    // stops dead — the boundary between meadow and clean sand is a step you
    // can see from the surface, not a gradient.
    float rooted = smoothstep(0.455, 0.525, mead)
                 * (1.0 - smoothstep(0.50, 0.70, lanes));
    // It needs light and it needs something to hold on to: nothing above the
    // low-water mark, nothing past about fifteen metres here, nothing on a
    // slope it would slide off.
    rooted *= smoothstep(0.9, 2.6, wetD) * (1.0 - smoothstep(13.0, 19.0, wetD));
    rooted *= 1.0 - smoothstep(0.12, 0.34, slope);

    vec3 bed = mix(shell, shingle, smoothstep(1.5, 7.0, wetD));
    bed = mix(bed, silt, smoothstep(14.0, 34.0, wetD));
    // Bare rock wherever it is too steep to hold anything, which around here
    // is most of it: this coast is drowned karst and the bottom is the same
    // fluted limestone as the hill, only with nothing growing on it.
    bed = mix(bed, limestone * 0.80, smoothstep(0.10, 0.40, slope) * 0.85);
    // Boulders and outcrop. The bottom of a drowned karst coast is not a plain
    // — it is the same broken limestone as the hill above it with the sand
    // collected in the hollows between, and at swimming range the pale blocks
    // standing out of the dark weed are most of what there is to look at.
    float boul = ridge2(p * 0.145 + 27.3, 3) * 0.6 + ridge2(p * 0.52 + 61.0, 2) * 0.4;
    float outcrop = smoothstep(0.46, 0.68, boul) * (1.0 - smoothstep(18.0, 30.0, wetD));
    bed = mix(bed, limestone * (0.62 + 0.30 * fbm2(p * 0.9, 2)), outcrop * 0.80);
    bed *= 0.80 + 0.40 * fbm2(p * 0.33 + 12.9, 3);
    bed *= 0.84 + 0.32 * fbm2(p * 1.7 + 3.1, 2);
    bed = mix(bed, weed * (0.70 + 0.6 * fbm2(p * 0.62, 3)),
              rooted * (1.0 - outcrop) * 0.94);

    base = mix(base, bed, smoothstep(0.0, 0.35, wetD));

    // ── relief ─────────────────────────────────────────────────────────────
    // The bottom was a painting on a plate, and the plate is not negotiable:
    // the DEM is one sample every 6.35 m and the finest terrain tile is a 5 m
    // quad, so every triangle a swimmer can see is flat and stays flat as he
    // moves over it. That is the whole of what was wrong with the seabed. No
    // amount of colour fixes it, because the thing that is missing is not
    // colour — it is the light moving.
    //
    // So the shading normal is perturbed from the same fields that painted it.
    // Nothing here is geometry and nothing here costs a vertex; it is all paid
    // in the fragment shader and only below the waterline, where the if this
    // sits inside has already been taken.
    //
    // Reconstructed as a gradient rather than added to n directly: n came
    // out of the height field as (-dh/dx, 1, -dh/dz) normalised, so dividing
    // the horizontal components back out by n.y recovers the slope, the detail
    // adds to it, and one normalize puts it back. The clamp on n.y is for the
    // cliffs, where the recovered slope would otherwise run away.
    vec2 dn = vec2(0.0);

    // Sand ripples. The one thing everybody who has snorkelled over this coast
    // remembers, and the only one nobody ever models: parallel corrugations a
    // hand's breadth apart lying across the run of the swell, sharp-crested,
    // and gone the moment the water is deep enough for the swell to stop
    // reaching the bottom. They are on the clean sand and nowhere else — weed
    // holds the sand still and rock has none to move.
    float ripD = (1.0 - smoothstep(4.5, 11.0, wetD))
               * smoothstep(0.15, 0.9, wetD)
               * (1.0 - smoothstep(0.05, 0.20, slope))
               * (1.0 - rooted) * (1.0 - outcrop) * nearby;
    // Not a grating. The crest lines wander over a few metres and the spacing
    // wanders with them, which is the difference between sand and corduroy.
    vec2 rdir = normalize(vec2(0.62, 0.78));
    float rk = 19.0 + 4.0 * fbm2(p * 0.035 + 12.1, 2);
    float rph = dot(p, rdir) * rk + fbm2(p * 0.11 + 5.7, 2) * 5.2;
    dn += rdir * cos(rph) * 0.155 * ripD;
    // And the troughs are darker, because that is where the fine dark stuff
    // ends up. Free, now that the phase is to hand.
    base *= 1.0 + 0.065 * sin(rph) * ripD;

    // Boulders. Central differences on the same ridged field the outcrop was
    // cut from, at a third of a metre, which is about the size of the blocks.
    // Four extra noise fetches and they are what turns the pale patches from
    // stains into stones.
    float eB = 0.34;
    vec2 gb = vec2(
      ridge2((p + vec2(eB, 0.0)) * 0.145 + 27.3, 2)
        - ridge2((p - vec2(eB, 0.0)) * 0.145 + 27.3, 2),
      ridge2((p + vec2(0.0, eB)) * 0.145 + 27.3, 2)
        - ridge2((p - vec2(0.0, eB)) * 0.145 + 27.3, 2));
    dn += gb * (0.85 / eB) * smoothstep(0.30, 0.62, boul)
        * (1.0 - smoothstep(20.0, 32.0, wetD));

    // And the meadow, which is not a lawn. Posidonia is a mat of leaf blades
    // half a metre long lying over each other, and at swimming range what you
    // see of it is a rough surface with the light broken up all over it — a
    // flat dark green patch reads as a hole in the bottom rather than as the
    // densest plant community in the Mediterranean.
    float eW = 0.11;
    vec2 gw = vec2(
      vnoise2((p + vec2(eW, 0.0)) * 5.2) - vnoise2((p - vec2(eW, 0.0)) * 5.2),
      vnoise2((p + vec2(0.0, eW)) * 5.2) - vnoise2((p - vec2(0.0, eW)) * 5.2));
    dn += gw * (0.16 / eW) * rooted * nearby;

    float ny = max(n.y, 0.28);
    n = normalize(vec3(n.x / ny - dn.x, 1.0, n.z / ny - dn.y));

    // ── caustics ──────────────────────────────────────────────────────────
    // The one thing everybody recognises, and it is not a texture: it is the
    // sun refracted by the *surface*, so it belongs to world xz and to the
    // swell that made it, not to the bottom it lands on. Two ridged layers
    // drifting against each other at slightly different rates, sharpened hard,
    // because a caustic is a caustic exactly where two wavefronts have folded
    // and is nothing at all a centimetre either side.
    float cw = uTime * 0.42;
    float c1 = ridge2(p * 0.55 + vec2(cw, cw * 0.6), 2);
    float c2 = ridge2(p * 0.81 - vec2(cw * 0.7, cw * 1.1) + 19.0, 2);
    float caust = pow(max(c1 * c2, 0.0), 3.4) * 3.6;
    // They only exist where the light does, they die out on a slope facing
    // away from the sun, and they are strongest just under the surface.
    caust *= (1.0 - smoothstep(1.0, 16.0, wetD)) * max(dot(n, uSunDir), 0.0);
    base += vec3(0.75, 0.94, 0.86) * caust * 0.42 * smoothstep(0.0, 0.5, wetD);
  }

  // ── fire ────────────────────────────────────────────────────────────────
  vec4 f = fireAt(vWorld.xz);
  float burning = f.r, scorch = 1.0 - f.g, wet = f.b;
  // Scorched ground: not black, but the grey-black of burnt maquis over pale
  // rock, with the rock showing through more as the fuel is used up.
  vec3 ash = mix(vec3(0.085, 0.072, 0.066), limestone * 0.55, 0.35 * scorch);
  base = mix(base, ash, smoothstep(0.06, 0.55, scorch));
  // Wet ground goes dark and saturated, and stays that way for a while.
  base = mix(base, base * 0.62, wet * 0.75);

  // ── light ───────────────────────────────────────────────────────────────
  float ndl = max(dot(n, uSunDir), 0.0);
  float shadow = shadowAt(vWorld);
  vec3 col = base * uSunColor * uSunI * ndl * shadow * INV_PI;
  col += base * ambientAt(n, uAmbSky, uAmbGround, uAmbI) * INV_PI * 2.2;

  // Wet ground picks up a specular sheen, which is how a drop reads from above
  // long after the steam has gone.
  vec3 viewDir = normalize(vWorld - uCamPos);
  vec3 h2 = normalize(uSunDir - viewDir);
  float spec = pow(max(dot(n, h2), 0.0), 60.0) * wet * shadow;
  col += uSunColor * spec * 0.5;

  // Ground glow under an active flame front.
  col += vec3(1.0, 0.34, 0.08) * burning * 0.55;

  float dist = vdist;
  // Haze first, then the water: air is what the light crossed before it got to
  // the surface, water is what it crossed after. Doing them in the other order
  // would put a Mediterranean horizon-white over a seabed ten metres down.
  col = applyHaze(col, dist, vWorld, uSunDir, viewDir);
  col = applyWater(col, dist, vWorld);

  gl_FragColor = vec4(col, 1.0);
}
`;

function buildTerrain(scene) {
  const size = CONFIG.world / TERRAIN.tiles;
  const uniforms = {
    ...shareLight(), ...shareHaze(), ...shareTerrain(), ...shareShadow(),
    ...shareWater(),
    uCover: U.uCover,
    uCamPos: U.uCamPos,
    uSkirt: { value: TERRAIN.skirt },
    uTexelWorld: { value: CONFIG.world / world.grid },
    uCoverColor: { value: COVER_COLOR.map((c) => new THREE.Color(c[0], c[1], c[2])) },
  };

  const levels = TERRAIN.lods.map((n) => {
    const g = tileGeometry(n, size);
    const max = TERRAIN.tiles * TERRAIN.tiles;
    const off = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
    off.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aOffset', off);
    const m = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    scene.add(mesh);
    return { mesh, off, n };
  });

  // Tile centres, precomputed once.
  const T = TERRAIN.tiles;
  const centres = new Float32Array(T * T * 2);
  for (let j = 0; j < T; j++) {
    for (let i = 0; i < T; i++) {
      centres[(j * T + i) * 2] = -HALF + i * size;
      centres[(j * T + i) * 2 + 1] = -HALF + j * size;
    }
  }

  const _sphere = new THREE.Sphere(new THREE.Vector3(), 1);
  const counts = new Int32Array(levels.length);

  /** Pick a level per tile by distance, cull to the frustum, refill the batches. */
  function update(camera, frustum) {
    counts.fill(0);
    const cx = camera.position.x, cz = camera.position.z;
    const half = size * 0.5;
    // A generous radius: tiles are flat in xz but the terrain inside them is
    // not, so the sphere has to cover the tallest thing they might hold.
    const radius = Math.hypot(half, half) + 260;

    for (let t = 0; t < T * T; t++) {
      const ox = centres[t * 2], oz = centres[t * 2 + 1];
      const mx = ox + half, mz = oz + half;
      const d = Math.hypot(mx - cx, mz - cz);

      let lod = TERRAIN.lodDist.length;
      for (let k = 0; k < TERRAIN.lodDist.length; k++) {
        if (d < TERRAIN.lodDist[k]) { lod = k; break; }
      }

      _sphere.center.set(mx, 40, mz);
      _sphere.radius = radius;
      if (!frustum.intersectsSphere(_sphere)) continue;

      const L = levels[lod];
      const c = counts[lod]++;
      L.off.array[c * 2] = ox;
      L.off.array[c * 2 + 1] = oz;
    }

    for (let k = 0; k < levels.length; k++) {
      levels[k].mesh.geometry.instanceCount = counts[k];
      levels[k].off.addUpdateRange(0, counts[k] * 2);
      levels[k].off.needsUpdate = true;
    }
  }

  return { update, levels, stats: () => Array.from(counts) };
}
