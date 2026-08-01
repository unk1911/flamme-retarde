// -----------------------------------------------------------------------------
// Canadair CL-415 — 28.6 m span, 19.8 m long, 6 137 litres.
//
// Built as a boat with wings, because that is what it is: the fuselage is
// lofted through hull stations with a hard chine and a planing step just aft of
// the wing, which is the shape that lets it put 13 tonnes down on the Adriatic
// at 130 km/h, fill up in twelve seconds and fly off again.
//
// Everything that should move is returned by name so the flight model can drive
// it: control surfaces, flaps, gear, props, water doors and the scoop probes.
// -----------------------------------------------------------------------------

const LIVERY = {
  yellow: 0xf5c518,
  red: 0xc9312099,
  redPure: 0xcf2027,
  white: 0xeceae4,
  hull: 0xe0b81a,
  glass: 0x16222e,
  dark: 0x191b1d,
  metal: 0x9aa0a6,
  prop: 0x24262a,
  tyre: 0x121315,
};

// The Blender airframe, once it has been loaded. Held at module scope because
// buildCanadair() has two synchronous callers — the player's aeroplane and each
// of the three wingmen — and threading a promise through both of them to load
// the same 330 KB blob four times would be worse than a variable.
let CANADAIR_RIG = null;

/**
 * Assemble the exported rig into the same {root, parts} the flight model poses.
 *
 * The .fr3d rig is a flat table of parts, parent before child, each holding its
 * pivot relative to its parent and a view on the shared vertex arrays — so the
 * hierarchy is one pass, and the whole aeroplane is one material. Colour is
 * baked per vertex by the exporter; there are no textures and nothing here
 * needs a second draw.
 *
 * The part names are not incidental. The Blender script authors `aileronL`,
 * `flapR`, `rudder`, `doorFL`, `probeR` and the rest against exactly the names
 * pose() reaches for, and every hinge is laid out so that the axis pose() turns
 * is the axis the real one turns about, once (bx, by, bz) -> (bx, bz, -by) has
 * been applied: a spanwise hinge lands on x, the fin's on y, a door's on z.
 */
function canadairFromRig(rig) {
  const root = new THREE.Group();
  const parts = {};
  const joints = [];

  const mat = solidMaterial(0xffffff, {
    spec: 0.30, specPower: 60,
    // Everything — yellow, the red tips, the cheatline, the chequy, the dark of
    // the anti-glare panel and the tyres — arrives in the vertex colour.
    body: 'base *= vVCol;',
  });
  const matGlass = solidMaterial(LIVERY.glass, { spec: 0.85, specPower: 180 });

  for (const p of rig.parts) {
    const g = new THREE.Group();
    g.position.set(p.pivot[0], p.pivot[1], p.pivot[2]);
    // Glazing is the one thing vertex colour cannot say, because what makes it
    // glass is the highlight and not the tint.
    g.add(new THREE.Mesh(p.geo, p.name === 'windscreen' ? matGlass : mat));
    (p.parent < 0 ? root : joints[p.parent]).add(g);
    joints.push(g);
    parts[p.name] = g;
  }

  // ── the handful of things pose() wants in a different shape ───────────────
  parts.props = [parts.propL, parts.propR].filter(Boolean);
  parts.probes = [parts.probeL, parts.probeR].filter(Boolean);
  parts.doors = [];
  for (const [name, side] of [['doorFL', -1], ['doorAL', -1],
    ['doorFR', 1], ['doorAR', 1]]) {
    if (parts[name]) parts.doors.push({ mesh: parts[name], side });
  }

  // The blur disc stays a runtime object rather than exported geometry: it is
  // an opacity that tracks rpm, not a shape, and it has to hang off the prop
  // hub so that it goes wherever the nacelle went.
  for (const [hub, key] of [[parts.propL, 'discL'], [parts.propR, 'discR']]) {
    if (!hub) continue;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.03, 32),
      solidMaterial(0xb8bcc2, { spec: 0.1, transparent: true, depthWrite: false }),
    );
    disc.material.uniforms.uEmissive.value = 0.25;
    disc.material.opacity = 0.0;
    disc.position.z = -0.30;
    disc.frustumCulled = false;
    hub.add(disc);
    parts[key] = disc;
  }

  if (parts.gear) parts.gear.visible = false;
  // pose() drives `parts.wing` on nothing, but the ejection work and the shadow
  // registration both want a handle on the airframe as a whole.
  root.frustumCulled = false;
  return { root, parts, materials: { mat, matGlass }, tris: rig.tris };
}

/** One hull station: rounded deck above a hard chine, V-bottom below it. */
function hullRing(z, w, crown, keel, nUp = 22, nDown = 9) {
  const chine = keel + (0 - keel) * 0.72;
  const pts = [];
  // Deck: starboard chine, over the crown, to port chine.
  for (let i = 0; i <= nUp; i++) {
    const a = (i / nUp) * Math.PI;
    // Squash the section toward a superellipse — the real fuselage is much
    // boxier than a half-round, which is why it looks like a bus with wings.
    const c = Math.cos(a), s = Math.sin(a);
    const k = 1.35;
    const sx = Math.sign(c) * Math.pow(Math.abs(c), 2 / k);
    const sy = Math.pow(Math.abs(s), 2 / k);
    pts.push(new THREE.Vector3(w * sx, chine + (crown - chine) * sy, z));
  }
  // Bottom: port chine, down through the keel, back to starboard.
  for (let i = 1; i < nDown; i++) {
    const t = i / nDown;
    const x = -w * (1 - t) + w * t;
    // V-section with a little rocker so the forefoot is deeper than the keel.
    const v = 1 - Math.pow(Math.abs(x / (w || 1)), 1.7);
    pts.push(new THREE.Vector3(x, chine + (keel - chine) * v, z));
  }
  return pts;
}

function buildCanadair() {
  // The Blender airframe when it is there, the hand-built one when it is not.
  // Keeping the procedural aeroplane alive is not sentiment: it is what draws
  // if the payload fails to inflate, and it is the only version that can be
  // read to find out what a part is *meant* to be.
  if (CANADAIR_RIG) return canadairFromRig(CANADAIR_RIG);

  const root = new THREE.Group();
  const parts = {};

  const matYellow = solidMaterial(LIVERY.yellow, { spec: 0.30, specPower: 60 });

  // Wing and tailplane: yellow, going red at the tips through a run of
  // chevron stripes. vLocal.x is spanwise on anything liftingSurface() makes.
  const tipRed = (halfSpan, from) => solidMaterial(LIVERY.yellow, {
    spec: 0.30, specPower: 60,
    body: `
      float sp = abs(vLocal.x) / ${halfSpan.toFixed(2)};
      float solid = smoothstep(${(from + 0.10).toFixed(3)}, ${(from + 0.13).toFixed(3)}, sp);
      float band = step(0.45, fract((sp - ${from.toFixed(3)}) * 22.0))
                 * step(${from.toFixed(3)}, sp) * step(sp, ${(from + 0.11).toFixed(3)});
      base = mix(base, vec3(0.81, 0.125, 0.152), max(solid, band));
    `,
  });
  const matHull = solidMaterial(LIVERY.hull, { spec: 0.26, specPower: 52 });
  const matRed = solidMaterial(LIVERY.redPure, { spec: 0.30, specPower: 60 });
  const matWhite = solidMaterial(LIVERY.white, { spec: 0.28, specPower: 56 });
  const matGlass = solidMaterial(LIVERY.glass, { spec: 0.85, specPower: 180 });
  const matDark = solidMaterial(LIVERY.dark, { spec: 0.18, specPower: 40 });
  const matMetal = solidMaterial(LIVERY.metal, { spec: 0.45, specPower: 90 });
  const matProp = solidMaterial(LIVERY.prop, { spec: 0.35, specPower: 70 });
  const matTyre = solidMaterial(LIVERY.tyre, { spec: 0.08, specPower: 20 });

  // The šahovnica on the fin, drawn in the shader from the fin's own local
  // coordinates so it stays put however the tail is scaled.
  const matCheck = solidMaterial(LIVERY.white, {
    spec: 0.30, specPower: 60,
    body: `
      // vLocal.x runs up the fin, vLocal.z aft along the chord.
      float up = vLocal.x, ch = -vLocal.z;
      base = vec3(0.961, 0.773, 0.094);
      // red leading edge, widening toward the tip
      base = mix(base, vec3(0.81, 0.125, 0.152),
                 smoothstep(0.55, 0.35, ch - up * 0.62));
      // and a run of stripes below it
      float st = step(0.5, fract((ch - up * 0.62 - 0.4) * 3.1));
      base = mix(base, vec3(0.81, 0.125, 0.152),
                 st * smoothstep(1.4, 0.7, ch - up * 0.62) * step(up, 6.5));
      // the šahovnica: 5x5 red and white, on a shield high on the fin
      vec2 shield = vec2((ch - 1.15) / 1.30, (up - 6.30) / 1.30);
      if (shield.x > 0.0 && shield.x < 1.0 && shield.y > 0.0 && shield.y < 1.0) {
        vec2 q = floor(shield * 5.0);
        float c = mod(q.x + q.y, 2.0);
        base = mix(vec3(0.94, 0.94, 0.93), vec3(0.81, 0.125, 0.152), c);
      }
    `,
  });

  const add = (geo, mat, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    if (name) parts[name] = m;
    return m;
  };

  // ── fuselage ────────────────────────────────────────────────────────────
  // z, halfWidth, crown, keel
  const STATIONS = [
    [-9.90, 0.10, 1.30, 1.05],
    [-9.40, 0.46, 1.70, 0.58],
    [-8.60, 0.86, 2.02, 0.10],
    [-7.40, 1.19, 2.24, -0.44],
    [-5.90, 1.40, 2.38, -0.82],
    [-3.80, 1.50, 2.44, -1.04],
    [-1.20, 1.52, 2.45, -1.14],
    [1.05, 1.52, 2.45, -1.16],
    [1.35, 1.51, 2.44, -0.70],   // the planing step
    [3.20, 1.42, 2.38, -0.46],
    [5.20, 1.20, 2.28, -0.10],
    [6.90, 0.92, 2.14, 0.38],
    [8.30, 0.52, 1.96, 0.92],
    [9.20, 0.14, 1.74, 1.42],
  ];
  const hullRings = STATIONS.map((s) => hullRing(...s));
  const fuse = add(loft(hullRings, { closed: true, caps: true }), matYellow, 'fuselage');
  root.add(fuse);

  // White hull below the chine, as a slightly inflated copy — cheaper and
  // cleaner than splitting the loft, and the overlap never shows.
  const bottomRings = STATIONS.map(([z, w, crown, keel]) => {
    const chine = keel + (0 - keel) * 0.72;
    const pts = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = -w * (1 - t) + w * t;
      const v = 1 - Math.pow(Math.abs(x / (w || 1)), 1.7);
      pts.push(new THREE.Vector3(x * 1.004, chine + (keel - chine) * v - 0.012, z));
    }
    for (let i = n - 1; i > 0; i--) {
      const t = i / n;
      const x = -w * (1 - t) + w * t;
      pts.push(new THREE.Vector3(x * 1.004, chine + 0.02, z));
    }
    return pts;
  });
  root.add(add(loft(bottomRings, { closed: true }), matHull, 'hullBottom'));

  // The cheatline is the Croatian tricolour at window level — red over white
  // over blue — running the length of the hull, not a red band at the chine.
  const TRICOLOUR = [[0.81, 0.125, 0.152], [0.95, 0.95, 0.94], [0.067, 0.20, 0.53]];
  TRICOLOUR.forEach((c, k) => {
    const mat = solidMaterial(new THREE.Color(c[0], c[1], c[2]).getHex(),
      { spec: 0.28, specPower: 56 });
    for (const side of [-1, 1]) {
      const rings = STATIONS.slice(2, 12).map(([z, w]) => {
        const y = 1.30 - k * 0.13;
        return [
          new THREE.Vector3(side * w * 1.010, y, z),
          new THREE.Vector3(side * w * 1.010, y + 0.12, z),
        ];
      });
      const band = new THREE.Mesh(loft(rings, { closed: false }), mat);
      band.frustumCulled = false;
      root.add(band);
    }
  });

  // Anti-glare panel on the nose.
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.2), matDark);
  glare.rotation.x = -Math.PI / 2 + 0.16;
  glare.position.set(0, 2.28, -6.6);
  glare.frustumCulled = false;
  root.add(glare);

  // ── glazing ─────────────────────────────────────────────────────────────
  // Windscreen: a faceted wrap, which is what the real one is.
  const wsRings = [
    [-8.15, 0.80, 2.06], [-7.55, 1.06, 2.30], [-6.60, 1.24, 2.44], [-6.20, 1.28, 2.46],
  ].map(([z, w, y]) => ([
    new THREE.Vector3(w, y - 0.02, z), new THREE.Vector3(w * 0.55, y + 0.30, z),
    new THREE.Vector3(-w * 0.55, y + 0.30, z), new THREE.Vector3(-w, y - 0.02, z),
  ]));
  root.add(add(loft(wsRings, { closed: false }), matGlass, 'windscreen'));

  // Cabin windows: a row of dark rounded squares each side.
  const winGeo = new THREE.PlaneGeometry(0.62, 0.52);
  for (let i = 0; i < 5; i++) {
    const z = -4.4 + i * 1.55;
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(winGeo, matGlass);
      w.position.set(s * 1.525, 1.72, z);
      w.rotation.y = s * Math.PI / 2;
      w.frustumCulled = false;
      root.add(w);
    }
  }

  // ── wing ────────────────────────────────────────────────────────────────
  const wing = new THREE.Group();
  const wingGeo = liftingSurface({
    span: CONFIG.wingspan, rootChord: 3.45, tipChord: 2.05,
    sweep: 0.30, dihedral: 0.035, thickness: 0.155, camber: 0.022,
    sections: 12, mirror: true, taperPow: 1.25,
  });
  wing.add(add(wingGeo, tipRed(CONFIG.wingspan / 2, 0.80), 'wingSkin'));
  wing.position.set(0, 2.30, -0.55);
  root.add(wing);
  parts.wing = wing;

  // Wing-root fairing, so the wing does not just intersect the deck.
  const fairRings = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, z = -3.0 + t * 5.2;
    const w = 1.55 * Math.sin(Math.PI * (0.18 + 0.82 * (1 - Math.abs(t - 0.45) * 1.6)));
    fairRings.push([
      new THREE.Vector3(Math.max(0.2, w), 2.30, z), new THREE.Vector3(0, 2.62, z),
      new THREE.Vector3(-Math.max(0.2, w), 2.30, z), new THREE.Vector3(0, 2.20, z),
    ]);
  }
  root.add(add(loft(fairRings, { closed: true, caps: true }), matYellow));

  // Ailerons and flaps hang off the trailing edge.
  const surf = (w, c, color = matYellow) => {
    const g = new THREE.BoxGeometry(w, 0.10, c);
    g.translate(0, 0, c * 0.5);
    return new THREE.Mesh(g, color);
  };
  for (const s of [-1, 1]) {
    const a = surf(4.6, 0.72);
    a.position.set(s * 11.2, 2.30 + 11.2 * Math.tan(0.035), -0.55 + 0.30 * (11.2 / 14.3) + 2.05 * 0.62);
    a.frustumCulled = false;
    root.add(a);
    parts[s < 0 ? 'aileronL' : 'aileronR'] = a;

    const f = surf(5.6, 0.92, matWhite);
    f.position.set(s * 5.0, 2.30 + 5.0 * Math.tan(0.035), -0.55 + 0.30 * (5.0 / 14.3) + 2.9 * 0.60);
    f.frustumCulled = false;
    root.add(f);
    parts[s < 0 ? 'flapL' : 'flapR'] = f;
  }

  // ── engines ─────────────────────────────────────────────────────────────
  parts.props = [];
  for (const s of [-1, 1]) {
    const nac = new THREE.Group();
    const rings = [
      [-4.75, 0.30, 0.30], [-4.30, 0.62, 0.66], [-3.40, 0.76, 0.80],
      [-1.60, 0.78, 0.80], [0.20, 0.66, 0.62], [1.30, 0.42, 0.36], [1.75, 0.16, 0.14],
    ].map(([z, w, h]) => {
      const pts = [];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        pts.push(new THREE.Vector3(Math.cos(a) * w, Math.sin(a) * h, z));
      }
      return pts;
    });
    nac.add(add(loft(rings, { closed: true, caps: true }), matYellow));

    // Exhaust stub and intake lip.
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.075, 8, 22), matMetal);
    lip.position.z = -4.28;
    lip.frustumCulled = false;
    nac.add(lip);

    // Spinner + four blades.
    const hub = new THREE.Group();
    const spin = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 16), matRed);
    spin.rotation.x = -Math.PI / 2;
    spin.position.z = -5.25;
    spin.frustumCulled = false;
    hub.add(spin);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Group();
      const bg = new THREE.BoxGeometry(0.30, 1.98, 0.075);
      bg.translate(0, 1.16, 0);
      const bm = new THREE.Mesh(bg, matProp);
      bm.frustumCulled = false;
      // A little twist, so the disc catches the light unevenly like a real one.
      bm.rotation.y = 0.42;
      blade.add(bm);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.22, 0.08), matWhite);
      tip.position.y = 2.05;
      tip.frustumCulled = false;
      blade.add(tip);
      blade.rotation.z = (b / 4) * TAU;
      hub.add(blade);
    }
    hub.position.z = -4.85;
    nac.add(hub);
    parts.props.push(hub);

    // Translucent disc, faded in with rpm.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.0, 32),
      solidMaterial(0xb8bcc2, { spec: 0.1, transparent: true, depthWrite: false }),
    );
    disc.material.uniforms.uEmissive.value = 0.25;
    disc.material.opacity = 0.0;
    disc.position.z = -4.95;
    disc.frustumCulled = false;
    nac.add(disc);
    parts[s < 0 ? 'discL' : 'discR'] = disc;

    nac.position.set(s * 5.15, 2.42 + 5.15 * Math.tan(0.035), -1.30);
    root.add(nac);
    parts[s < 0 ? 'nacelleL' : 'nacelleR'] = nac;
  }

  // ── tail ────────────────────────────────────────────────────────────────
  const finGeo = liftingSurface({
    span: 11.0, rootChord: 3.9, tipChord: 1.9, sweep: 2.35,
    dihedral: 0, thickness: 0.12, camber: 0, sections: 8, mirror: false,
  });
  const fin = add(finGeo, matCheck, 'fin');
  fin.rotation.z = -Math.PI / 2;     // span becomes vertical
  fin.rotation.y = Math.PI;
  fin.position.set(0, 2.30, 6.15);
  root.add(fin);

  // Dorsal fillet running forward off the fin.
  const dorsal = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, z = 2.6 + t * 3.7;
    const hgt = 2.38 + Math.pow(t, 2.0) * 1.0;
    dorsal.push([
      new THREE.Vector3(0.10, 2.30, z), new THREE.Vector3(0, hgt, z),
      new THREE.Vector3(-0.10, 2.30, z),
    ]);
  }
  root.add(add(loft(dorsal, { closed: true }), matYellow));

  const rud = new THREE.Mesh(new THREE.BoxGeometry(0.11, 4.4, 1.15), matCheck);
  rud.geometry.translate(0, 0, 0.575);
  rud.position.set(0, 6.4, 8.35);
  rud.frustumCulled = false;
  root.add(rud);
  parts.rudder = rud;

  const stabGeo = liftingSurface({
    span: 9.6, rootChord: 2.25, tipChord: 1.35, sweep: 0.55,
    dihedral: 0.02, thickness: 0.11, camber: 0, sections: 6, mirror: true,
  });
  const stab = add(stabGeo, tipRed(4.8, 0.72), 'stab');
  stab.position.set(0, 7.35, 7.55);
  root.add(stab);

  const elev = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.09, 0.78), matYellow);
  elev.geometry.translate(0, 0, 0.39);
  elev.position.set(0, 7.35, 8.95);
  elev.frustumCulled = false;
  root.add(elev);
  parts.elevator = elev;

  // ── sponsons ────────────────────────────────────────────────────────────
  // The stub floats that keep a wingtip out of the water at rest, and hold the
  // main gear when it comes up.
  for (const s of [-1, 1]) {
    const rings = [];
    for (let i = 0; i <= 7; i++) {
      const t = i / 7, z = -1.9 + t * 4.6;
      const taper = Math.sin(Math.PI * (0.12 + 0.88 * (1 - Math.abs(t - 0.42) * 1.4)));
      const outb = 1.28 * Math.max(0.18, taper);
      const pts = [];
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        pts.push(new THREE.Vector3(
          s * (1.42 + outb * (0.5 + 0.5 * Math.cos(a))),
          -0.42 + 0.40 * Math.sin(a),
          z,
        ));
      }
      rings.push(pts);
    }
    root.add(add(loft(rings, { closed: true, caps: true }),
      s < 0 ? matYellow : matYellow, s < 0 ? 'sponsonL' : 'sponsonR'));
  }

  // ── water doors and probes ──────────────────────────────────────────────
  parts.doors = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const g = new THREE.BoxGeometry(0.62, 0.07, 1.35);
      g.translate(0, 0, 0);
      const d = new THREE.Mesh(g, matHull);
      d.position.set(s * 0.42, -1.14, -0.5 + i * 1.5);
      d.frustumCulled = false;
      root.add(d);
      parts.doors.push({ mesh: d, side: s, home: d.position.clone() });
    }
  }
  parts.probes = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.62), matMetal);
    p.position.set(s * 0.62, -1.12, 1.15);
    p.frustumCulled = false;
    root.add(p);
    parts.probes.push(p);
  }

  // ── landing gear ────────────────────────────────────────────────────────
  const gear = new THREE.Group();
  const mkWheel = (r, w) => {
    const g = new THREE.CylinderGeometry(r, r, w, 14);
    g.rotateZ(Math.PI / 2);
    return new THREE.Mesh(g, matTyre);
  };
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 8), matMetal);
    strut.position.y = -0.75;
    leg.add(strut);
    const w = mkWheel(0.48, 0.30);
    w.position.y = -1.5;
    leg.add(w);
    leg.position.set(s * 2.1, -0.55, 0.9);
    leg.children.forEach((c) => { c.frustumCulled = false; });
    gear.add(leg);
  }
  const nose = new THREE.Group();
  const nstrut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.45, 8), matMetal);
  nstrut.position.y = -0.72;
  nose.add(nstrut);
  const nw = mkWheel(0.34, 0.24);
  nw.position.y = -1.42;
  nose.add(nw);
  nose.position.set(0, -0.5, -6.4);
  nose.children.forEach((c) => { c.frustumCulled = false; });
  gear.add(nose);
  gear.visible = false;
  root.add(gear);
  parts.gear = gear;

  root.traverse((o) => { o.frustumCulled = false; });
  return { root, parts, materials: { matYellow, matRed, matWhite, matHull, matGlass } };
}
