// ---------------------------------------------------------------------------
// The report key — one line that says where you are and what you are looking
// at, on the clipboard.
//
// Misha, 2 Oct 2026, approving the pipeline list: "do all 5". This is the
// first of them. A note like "the thing on the wall by the door looks wrong"
// costs an agent a search; the same note with this line pasted under it costs
// nothing, because the line carries the build, the coordinates (world, and at
// Jadrija the resort's own t/s that every plan and probe is written in), the
// look, and what the crosshair is on — the hit point, how far, the mesh's name
// and its parents' names, and the room if the vikendica or the kabina knows
// one.
//
//   `  (Backquote — the key under Escape)   copies the line, toasts "copied"
//   __fr.report()                              the same thing as an object
//
// WHAT THE CROSSHAIR IS ON is a plain THREE.Raycaster from the middle of the
// picture, through the camera — the crosshair is the middle of the picture
// in every camera this game has — against every visible mesh that draws
// colour. The game's own picks are analytic (capsules on her, the hammock's
// cloth) and answer only for the thing they were written for; this one has to
// answer for anything. It is a single key-press, so its cost is not in a
// frame: measured at Jadrija in the probe this file was written with (see the
// CHANGELOG for 1.584.0).
//
// NAMES. Most of the world is merged blobs, and a merged blob has lost its
// Blender objects' names on the way: the vikendica's shell is ONE mesh with
// the cassette, the dish and the walls in it. So a hit on one says which blob
// (`vikendica:shell`, `vikendica:shell_ware`, `landmark:…`), the triangle, and
// that triangle's baked vertex colour — the colour bucket, which with the
// coordinates is enough to find the object in the .blend. Meshes with no name
// at all are reported as their type and id, beside the nearest named
// ancestor.
// ---------------------------------------------------------------------------

const report = (() => {
  const ray = new THREE.Raycaster();
  const mid = new THREE.Vector2(0, 0);
  const dir = new THREE.Vector3();
  const f2 = (v) => +(+v).toFixed(2);
  const f3 = (v) => +(+v).toFixed(3);
  const v3 = (p) => [f2(p.x), f2(p.y), f2(p.z)];

  // The room a world point is in, if anything that knows rooms is built.
  function roomAt(x, y, z) {
    try {
      const J = typeof jadrija !== 'undefined' ? jadrija : null;
      if (!J || !J.local) return null;
      const K = J.kabina;
      if (K && K.inside && K.inside(x, z) > 0.5
        && (K.floor == null || (y > K.floor - 0.6 && y < K.floor + 3.6))) return 'kabina';
      const v = J.vik;
      if (!v || !v.plan) return null;
      const P = v.plan;
      const [t, s] = J.local(x, z);
      const hx = t - VIK.t, hz = VIK.s - s;          // `toHouse` in 44-vikendica.js
      const up = y - v.base;
      const inR = (r) => r && hx > r.x0 && hx < r.x1 && hz > r.z0 && hz < r.z1;
      const pick = (rooms, storey) => {
        for (const k in rooms) if (inR(rooms[k])) return `vikendica ${storey}:${k}`;
        return inR(P.outer) ? `vikendica ${storey}` : null;
      };
      if (up < P.floorP - 0.6 || up > P.loftRidge + 1) return null;
      if (up < P.floor - 0.15) return pick(P.roomsP, 'ground');
      if (up < P.deck - 0.15 || !(v.parts && v.parts.loft && v.parts.loft.visible)) {
        return pick(P.rooms, 'upper');
      }
      return inR(P.outer) ? 'vikendica loft' : null;
    } catch (e) { return null; }
  }

  const jadTS = (x, z) => {
    try {
      if (typeof jadrija === 'undefined' || !jadrija || !jadrija.local) return null;
      const [t, s] = jadrija.local(x, z);
      return [f2(t), f2(s)];
    } catch (e) { return null; }
  };

  // WHO OWNS AN UNNAMED MESH. Most meshes in this game are made in a
  // builder and handed back as a field of what it returns (`jadrija.kabina…`,
  // `city.mesh`), never named. So the builders' results are the registry: a
  // walk two levels into each subsystem's return value, keeping every
  // Object3D found, as `subsystem.field[.field]`. Rebuilt per report — it is
  // a few hundred properties.
  const SUBSYS = () => ({
    terrain, sky, sea, fire, plane, waterfx, city, trees, landmarks, roads, rail,
    props, airfield, jadrija, ground, birds, mirror, mirrorP, swim, under, seabed,
    arms, kites, ride, you, brod, backlane, plunge, crabs, playground,
  });
  function owners() {
    const map = new Map();
    const seen = new Set();
    const walk = (v, path, depth) => {
      if (!v || typeof v !== 'object' || seen.has(v)) return;
      seen.add(v);
      if (v.isObject3D) { if (!map.has(v)) map.set(v, path); return; }
      if (depth >= 2 || Array.isArray(v) && v.length > 64) return;
      let keys;
      try { keys = Array.isArray(v) ? v.map((_, i) => i) : Object.keys(v); } catch (e) { return; }
      for (const k of keys.slice(0, 200)) {
        let x;
        try { x = v[k]; } catch (e) { continue; }
        walk(x, Array.isArray(v) ? `${path}[${k}]` : `${path}.${k}`, depth + 1);
      }
    };
    let S = {};
    try { S = SUBSYS(); } catch (e) { /* a name not declared in this build */ }
    for (const k in S) walk(S[k], k, 0);
    return map;
  }
  let OWN = null;
  const nameOf = (o) => (o.name ? o.name
    : (OWN && OWN.has(o) ? OWN.get(o) : `${o.type}#${o.id}`));

  // Every mesh that is on screen and puts colour there. Visibility is the
  // whole chain's, which `traverseVisible` already is; a material that writes
  // no colour (an occluder, a depth pre-pass) is not something you can see.
  function targets() {
    const out = [];
    scene.traverseVisible((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || m.visible === false || m.colorWrite === false) return;
      if (m.transparent && m.opacity === 0) return;
      out.push(o);
    });
    return out;
  }

  // Nearest bounding sphere first, and stop at the first sphere that starts
  // beyond the best hit so far. `intersectObjects` tests every mesh the ray
  // passes near — 0.4 s at Jadrija, most of it on meshes behind the hit.
  const sph = new THREE.Sphere();
  const pt = new THREE.Vector3();
  let slow = [], castN = 0;
  function castOrdered(list) {
    slow = [];
    const cand = [];
    for (const o of list) {
      const g = o.geometry;
      if (!g) continue;
      if (o.isInstancedMesh || o.isSkinnedMesh || o.isBatchedMesh) { cand.push([0, o]); continue; }
      if (!g.boundingSphere) g.computeBoundingSphere();
      sph.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
      if (sph.containsPoint(ray.ray.origin)) { cand.push([0, o]); continue; }
      if (!ray.ray.intersectSphere(sph, pt)) continue;
      const d = pt.distanceTo(ray.ray.origin);
      if (d <= ray.far) cand.push([d, o]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    castN = 0;
    const hits = [];
    let best = Infinity;
    for (const [d, o] of cand) {
      if (d > best) break;
      const got = [];
      const t = performance.now();
      castN++;
      try { o.raycast(ray, got); } catch (e) { continue; }
      const dt = performance.now() - t;
      if (dt > 5) slow.push(`${nameOf(o)} ${dt.toFixed(0)}ms`);
      for (const h of got) { hits.push(h); if (h.distance < best) best = h.distance; }
    }
    hits.sort((a, b) => a.distance - b.distance);
    return hits;
  }

  function hitInfo(h) {
    const o = h.object;
    const chain = [];
    for (let p = o.parent; p && p !== scene && chain.length < 8; p = p.parent) {
      chain.push(nameOf(p));
    }
    const isAnon = (n) => /#\d+$/.test(n);
    const named = !isAnon(nameOf(o)) ? nameOf(o) : (chain.find((n) => !isAnon(n)) || null);
    const g = o.geometry;
    let vcol = null;
    const ca = g && (g.getAttribute('aVCol') || g.getAttribute('color'));
    if (ca && h.face) {
      const c = [ca.getX(h.face.a), ca.getY(h.face.a), ca.getZ(h.face.a)];
      const k = ca.normalized || c.every((u) => u <= 1) ? 255 : 1;
      vcol = '#' + c.map((u) => Math.round(Math.min(255, u * k)).toString(16).padStart(2, '0')).join('');
    }
    // A plain material's own colour: for a runtime part with no vertex
    // colours it is the next best thing to a name.
    const mt = Array.isArray(o.material) ? o.material[0] : o.material;
    let mcol = null;
    const mc = mt && (mt.color || (mt.uniforms && (mt.uniforms.uBase || mt.uniforms.uColor || {}).value));
    if (!vcol && mc && mc.isColor) mcol = '#' + mc.getHexString();
    const r = {
      at: v3(h.point),
      dist: f2(h.distance),
      mesh: nameOf(o),
      named,
      chain,
      kind: o.isInstancedMesh ? 'instanced' : o.isSkinnedMesh ? 'skinned' : 'mesh',
      tris: g && g.index ? g.index.count / 3 : g && g.attributes.position ? g.attributes.position.count / 3 : 0,
      face: h.faceIndex ?? null,
      vcol,
      mcol,
      jad: jadTS(h.point.x, h.point.z),
      room: roomAt(h.point.x, h.point.y, h.point.z),
    };
    if (h.instanceId != null) r.instance = h.instanceId;
    if (h.batchId != null) r.batch = h.batchId;
    return r;
  }

  /** The report, as an object. `line` is what the key puts on the clipboard. */
  function build() {
    const t0 = performance.now();
    camera.updateMatrixWorld();
    camera.getWorldDirection(dir);
    const cam = camera.position;
    // The ground mission's own convention: dir = (−sin yaw·cos p, sin p, −cos yaw·cos p).
    const yaw = Math.atan2(-dir.x, -dir.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    const eye = typeof personAt === 'function' ? personAt().clone() : cam.clone();

    ray.setFromCamera(mid, camera);
    ray.camera = camera;
    ray.near = camera.near;
    ray.far = 3000;
    OWN = owners();
    const tA = performance.now();
    const list = targets();
    const tB = performance.now();
    const hits = castOrdered(list);
    const tC = performance.now();
    const first = hits.find((h) => h.object && h.object.visible) || null;

    const foot = state.phase === 'ground' && ground && ground.you;
    const r = {
      v: BUILD.v,
      date: BUILD.date,
      phase: state.phase,
      you: v3(eye),
      youJad: jadTS(eye.x, eye.z),
      youRoom: roomAt(eye.x, eye.y, eye.z),
      cam: v3(cam),
      camJad: jadTS(cam.x, cam.z),
      yaw: f3(yaw),
      pitch: f3(pitch),
      lookYaw: foot ? f3(ground.you.yaw) : null,
      lookPitch: foot ? f3(ground.you.pitch) : null,
      hit: first ? hitInfo(first) : null,
      also: hits.slice(1, 4).filter((h) => h.object !== (first && first.object))
        .map((h) => `${nameOf(h.object)} ${f2(h.distance)}m`),
      ms: 0,
    };
    r.ms = +(performance.now() - t0).toFixed(1);
    r.cost = { meshes: list.length, list: +(tB - tA).toFixed(1), cast: +(tC - tB).toFixed(1),
      owners: +(tA - t0).toFixed(1), tested: castN, slow };
    r.line = lineOf(r);
    return r;
  }

  function lineOf(r) {
    const xyz = (a) => a.join(',');
    const parts = [`fr ${r.v} (${r.date})`, `phase ${r.phase}`];
    let you = `you ${xyz(r.you)}`;
    if (r.youJad) you += ` jad t ${r.youJad[0]} s ${r.youJad[1]}`;
    if (r.youRoom) you += ` [${r.youRoom}]`;
    parts.push(you);
    let cam = `cam ${xyz(r.cam)} yaw ${r.yaw} pitch ${r.pitch}`;
    if (r.lookYaw != null) cam += ` (look ${r.lookYaw},${r.lookPitch})`;
    parts.push(cam);
    if (r.hit) {
      const h = r.hit;
      let s = `hit ${h.mesh}`;
      if (h.chain.length) s += ' < ' + h.chain.join(' < ');
      if (!h.named || h.named !== h.mesh) s += ` (≈ ${h.named || 'unnamed'})`;
      s += ` @ ${xyz(h.at)} ${h.dist} m`;
      if (h.jad) s += ` jad t ${h.jad[0]} s ${h.jad[1]}`;
      if (h.room) s += ` [${h.room}]`;
      s += ` ${h.kind} ${h.tris} tris face ${h.face}`;
      if (h.instance != null) s += ` inst ${h.instance}`;
      if (h.vcol) s += ` vcol ${h.vcol}`;
      if (h.mcol) s += ` mat ${h.mcol}`;
      parts.push(s);
    } else parts.push('hit nothing within 3 km');
    return parts.join(' · ');
  }

  // The async clipboard is only there in a secure context, and this page is
  // opened over plain http on the LAN and from file:// as often as not — so a
  // selected textarea and the old `execCommand` go first, and the async one is
  // the second try.
  async function copy(text) {
    // The old way first: inside a real key press it works at once, on http
    // and file:// alike, and needs no permission.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (ok) return true;
    } catch (e) { /* the async one, then */ }
    try {
      // Raced: without focus or permission the promise can simply never
      // settle (it does exactly that in a headless Chrome).
      if (navigator.clipboard && window.isSecureContext) {
        const ok = await Promise.race([
          navigator.clipboard.writeText(text).then(() => true, () => false),
          new Promise((r) => setTimeout(() => r(false), 600)),
        ]);
        if (ok) return true;
      }
    } catch (e) { /* nothing left to try */ }
    return false;
  }

  async function key() {
    const r = build();
    console.log('[report] ' + r.line);
    const ok = await copy(r.line);
    toast(T(ok ? 'report.copied' : 'report.failed'));
    return r;
  }

  addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote' || e.repeat) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (keyboardIsBusy(e)) return;
    if (typeof computer !== 'undefined' && computer.active) return;
    e.preventDefault();
    key();
  });

  return { build, key, line: () => build().line };
})();

if (typeof window !== 'undefined' && window.__fr) {
  /** `__fr.report()` — the report key's line as an object (`.line` is the line). */
  window.__fr.report = () => report.build();
  window.__fr.reportKey = () => report.key();
}
