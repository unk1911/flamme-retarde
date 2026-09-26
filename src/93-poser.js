// ---------------------------------------------------------------------------
// ?pose — Baye's joints, in the game, by hand.
//
// ── why ──────────────────────────────────────────────────────────────────────
//
// Misha, 26 Sep 2026: *"u know how we spend sometimes 1h-2h trying to perfect
// some move … maybe we can accelerate this process … with all the joints and
// fingers that i can rotate .. and like.. u can record what i do, and then
// later replay those things in the game"*.
//
// The hours were never the angles. They were (1) a round trip — a pose typed
// in tools/blender/human_mh.py, a four-minute rebake, a page build and a
// headless still, to find out what one number did — and (2) the millimetres
// where a hand meets skin. This takes (1) out of the loop entirely: she is
// posed where she stands, on her own mesh, in her own shader, in the room she
// is in, and what comes out is the dict `human_mh.py` already reads. (2) stays
// with the solvers, which are good at millimetres and blind to "does it look
// right" — which is the half a person is good at.
//
// ── the one thing that has to be exactly right ──────────────────────────────
//
// THE ANGLES ARE BLENDER'S, NOT OURS. A pose dict is `{bone: (x, y, z)}` in
// degrees, a bone-local XYZ Euler in Blender's axes, and the exporter
// (`_bake_clip`) ships `CONV @ (rest @ euler) @ CONV⁻¹` per bone, where the
// shipped rest is `CONV @ rest @ CONV⁻¹`. Conjugation distributes, so the
// local quaternion here is `restQ · conv(euler)`, and `conv` of a rotation
// about Blender's x, y, z is the same rotation about figure +x, −z, +y. That
// is all of it: no bone's roll needs to be known, because the rest quaternion
// the blob already carries has it. `__fr.poser.verify()` replays every baked
// key of a clip through this and reports the worst bone, in degrees.
//
// The root: `@root` is Blender armature space and converts as a point, so its
// figure-space translation is `restT₀ + (x, z, −y)`. `@roll`/`@turn` are not
// kept separately — they premultiply the root bone, so they come back out as
// pelvis Eulers that bake to the same quaternion.
//
// Five bones on her right hand are not Blender's at all — the index's three
// joints and the thumb's outer two, added at load by src/41-hands.js. They
// pose here like any other, in the same convention, and export in a block of
// their own, because `human_mh.py` has nowhere to put them. `idx1R` copies
// `fingersR` and its extra turn is on top of that, as in the game.
//
// ── mirroring ───────────────────────────────────────────────────────────────
//
// NOT by flipping signs. `_mirror_pose`'s rule (share x, negate y and z) is
// exact for the arm and WRONG for the fingers — see the spread, 1.519.0,
// where it made the right hand a claw ten centimetres off her. So the mirror
// is computed: each side bone's turn relative to its parent, in the bind
// frame, reflected through her midline (figure z), and handed back as the
// partner's Euler. Whatever the rolls are, that is the mirror image.
// ---------------------------------------------------------------------------

const poser = (() => {
  const ENABLED = QUERY.has('pose');
  const RUNTIME = ['idx1R', 'idx2R', 'idx3R', 'thb2R', 'thb3R'];
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;

  // ── quaternions, [x, y, z, w] ─────────────────────────────────────────────
  const qm = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qi = (a) => [-a[0], -a[1], -a[2], a[3]];
  const qax = (x, y, z, ang) => {
    const s = Math.sin(ang / 2);
    return [x * s, y * s, z * s, Math.cos(ang / 2)];
  };
  // Reflection through the figure's midline, z = 0: M R M with M = diag(1,1,−1).
  const qrefl = (a) => [-a[0], -a[1], a[2], a[3]];
  const qdot = (a, b) => Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  const qang = (a, b) => 2 * Math.acos(Math.min(1, qdot(a, b))) * R2D;

  /** Blender XYZ Euler (degrees) → the same turn in figure axes. */
  function eulQ(e) {
    // Blender "XYZ" is R = Rz·Ry·Rx; its x, y, z are figure +x, −z, +y.
    return qm(qm(qax(0, 1, 0, e[2] * D2R), qax(0, 0, -1, e[1] * D2R)),
      qax(1, 0, 0, e[0] * D2R));
  }
  const wrap = (a) => { a = ((a + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; };
  /** The inverse, nearest to `near` of the two Euler triples that make it. */
  function qEul(q, near) {
    // Back into Blender's axes: a figure axis (x, y, z) is Blender (x, −z, y).
    const x = q[0], y = -q[2], z = q[1], w = q[3];
    const m00 = 1 - 2 * (y * y + z * z), m10 = 2 * (x * y + z * w);
    const m20 = 2 * (x * z - y * w), m21 = 2 * (y * z + x * w), m22 = 1 - 2 * (x * x + y * y);
    const m01 = 2 * (x * y - z * w), m11 = 1 - 2 * (x * x + z * z);
    const sb = Math.max(-1, Math.min(1, -m20));
    let a, b = Math.asin(sb), c;
    if (Math.abs(sb) > 0.99999) { a = 0; c = Math.atan2(-m01, m11); }
    else { a = Math.atan2(m21, m22); c = Math.atan2(m10, m00); }
    const e1 = [wrap(a * R2D), wrap(b * R2D), wrap(c * R2D)];
    const e2 = [wrap(a * R2D + 180), wrap(180 - b * R2D), wrap(c * R2D + 180)];
    const cost = (e) => (near
      ? e.reduce((s, v, i) => s + Math.abs(wrap(v - near[i])), 0)
      : e.reduce((s, v) => s + Math.abs(v), 0));
    const pick = cost(e2) < cost(e1) ? e2 : e1;
    return pick.map((v) => Math.round(v * 1000) / 1000);
  }

  // ── the figure ────────────────────────────────────────────────────────────
  let fig = null, nb = 0, names = [], parent = [], restQ = [], restT0 = [0, 0, 0],
    bindQ = [], iF = -1, iI1 = -1;
  let pose = null;          // { e: [[x,y,z] …], root: [x,y,z] }  — Blender numbers
  let on = false;

  function bind() {
    const J = typeof jadrija !== 'undefined' && jadrija && jadrija.poser;
    const f = J ? J.fig() : null;
    if (!f || !f.bindRest) return false;
    if (f === fig) return true;
    fig = f; nb = f.bones.length;
    names = f.bones.map((b) => b.name);
    parent = f.bones.map((b) => b.parent);
    const R = f.bindRest();
    restQ = []; bindQ = [];
    for (let i = 0; i < nb; i++) {
      restQ.push(Array.from(R.q.subarray(i * 4, i * 4 + 4)));
      bindQ.push(Array.from(R.bindQ.subarray(i * 4, i * 4 + 4)));
    }
    restT0 = Array.from(R.t.subarray(0, 3));
    iF = names.indexOf('fingersR'); iI1 = names.indexOf('idx1R');
    return true;
  }

  /** Local quaternions for a pose, in blob order. */
  function locals(p) {
    const L = [];
    for (let i = 0; i < nb; i++) {
      let q = qm(restQ[i], eulQ(p.e[i]));
      // The index copies the fingers' clip keys, and its own turn is on top.
      if (i === iI1 && iF >= 0) q = qm(qm(restQ[iF], eulQ(p.e[iF])), eulQ(p.e[i]));
      L.push(q);
    }
    return L;
  }
  function worlds(L) {
    const W = [];
    for (let i = 0; i < nb; i++) W.push(parent[i] < 0 ? L[i] : qm(W[parent[i]], L[i]));
    return W;
  }
  /** And back: a local pose off the figure → Eulers, near the ones we had. */
  function fromLocals(L, t, near) {
    const e = [];
    for (let i = 0; i < nb; i++) {
      let d = qm(qi(restQ[i]), L[i]);
      if (i === iI1 && iF >= 0) d = qm(qi(qm(restQ[iF], eulQ(e[iF]))), L[i]);
      e.push(qEul(d, near ? near.e[i] : null));
    }
    // Figure (x, y, z) − rest → Blender armature (x, −z, y).
    const d = [t[0] - restT0[0], t[1] - restT0[1], t[2] - restT0[2]];
    const root = [d[0], -d[2], d[1]].map((v) => Math.round(v * 1e5) / 1e5);
    return { e, root };
  }

  function apply() {
    if (!fig || !pose) return;
    const L = locals(pose);
    const q = new Float32Array(nb * 4);
    L.forEach((v, i) => q.set(v, i * 4));
    const r = pose.root;
    fig.manual({ q, t: new Float32Array([restT0[0] + r[0], restT0[1] + r[2], restT0[2] - r[1]]) });
  }

  function capture() {
    if (!bind()) return false;
    const J = jadrija.poser;
    fig.manual(null);
    J.hold(true);
    fig.update(0);
    const l = fig.local();
    const L = [];
    for (let i = 0; i < nb; i++) L.push(Array.from(l.q.subarray(i * 4, i * 4 + 4)));
    pose = fromLocals(L, Array.from(l.t), null);
    apply();
    return true;
  }

  // ── mirror ────────────────────────────────────────────────────────────────
  const side = (n) => (/[LR]$/.test(n) ? n.slice(-1) : '');
  const partner = (n) => n.slice(0, -1) + (n.endsWith('L') ? 'R' : 'L');
  /** Copy `from`'s side (L or R) on to the other, as its mirror image. */
  function mirrorSide(from, only = null) {
    // The source side's worlds do not depend on anything on the other side,
    // so they are read once; the other side is recomposed after every bone,
    // because a mirrored clavicle moves everything hanging off it.
    const L0 = locals(pose), W = worlds(L0);
    const L = L0.slice();
    const skin = (WW, i) => qm(WW[i], qi(bindQ[i]));
    for (let i = 0; i < nb; i++) {
      const n = names[i];
      if (side(n) !== from || (only && !only.has(n))) continue;
      const j = names.indexOf(partner(n));
      if (j < 0) continue;
      const p = parent[i], pj = parent[j];
      const rel = p < 0 ? skin(W, i) : qm(qi(skin(W, p)), skin(W, i));
      const W2 = worlds(L);
      const Sj = qm(pj < 0 ? [0, 0, 0, 1] : skin(W2, pj), qrefl(rel));
      const Wj = qm(Sj, bindQ[j]);
      L[j] = pj < 0 ? Wj : qm(qi(W2[pj]), Wj);
      pose.e[j] = qEul(qm(qi(restQ[j]), L[j]), pose.e[j]);
    }
  }

  // ── keys and playback ─────────────────────────────────────────────────────
  const clone = (p) => ({ e: p.e.map((v) => v.slice()), root: p.root.slice() });
  let keys = [];            // [{ t, p }]
  let head = 0, playing = false, loop = true;
  const dur = () => (keys.length ? keys[keys.length - 1].t : 0);
  /** What `_bake_clip` does: smoothstep between keys, Eulers lerped. */
  function sampleKeys(t) {
    if (!keys.length) return null;
    if (keys.length === 1 || t <= keys[0].t) return clone(keys[0].p);
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
    const a = keys[i], b = keys[i + 1];
    let u = b.t <= a.t ? 0 : Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
    u = u * u * (3 - 2 * u);
    return {
      e: a.p.e.map((v, k) => v.map((x, c) => x + (b.p.e[k][c] - x) * u)),
      root: a.p.root.map((x, c) => x + (b.p.root[c] - x) * u),
    };
  }

  // ── undo ──────────────────────────────────────────────────────────────────
  const undo = [];
  let undoAt = 0;
  function remember() {
    const now = performance.now();
    if (now - undoAt < 400 && undo.length) return;   // one drag, one step
    undoAt = now;
    undo.push(clone(pose));
    if (undo.length > 200) undo.shift();
  }

  // ── export ────────────────────────────────────────────────────────────────
  const r1 = (v) => (Math.abs(v) < 0.05 ? 0 : Math.round(v * 10) / 10);
  const fmt = (v) => { const s = r1(v).toFixed(1); return s === '-0.0' ? '0.0' : s; };
  function pyDict(p) {
    const out = [];
    p.e.forEach((v, i) => {
      if (RUNTIME.includes(names[i])) return;
      if (!v.some((x) => r1(x) !== 0)) return;
      out.push(`"${names[i]}": (${v.map(fmt).join(', ')})`);
    });
    if (p.root.some((x) => Math.abs(x) > 5e-4)) {
      out.push(`"@root": (${p.root.map((x) => x.toFixed(4)).join(', ')})`);
    }
    return '{' + out.join(', ') + '}';
  }
  function runtimeDict(p) {
    const out = [];
    p.e.forEach((v, i) => {
      if (!RUNTIME.includes(names[i]) || !v.some((x) => r1(x) !== 0)) return;
      out.push(`${names[i]}: [${v.map(fmt).join(', ')}]`);
    });
    return out.length ? '{ ' + out.join(', ') + ' }' : null;
  }
  function exportPy(name) {
    const N = (name || 'posed').replace(/[^A-Za-z0-9_]/g, '_');
    const U = N.toUpperCase();
    const list = keys.length ? keys : [{ t: 0, p: pose }];
    const lines = [`# ?pose export, ${new Date().toISOString().slice(0, 19)} — Blender XYZ Euler, degrees`];
    list.forEach((k, i) => lines.push(`${U}_${i} = ${pyDict(k.p)}`));
    if (keys.length > 1) {
      lines.push(`{"name": "${N}", "loop": ${loop ? 'True' : 'False'}, "keys": [`
        + list.map((k, i) => `(${k.t.toFixed(2)}, ${U}_${i})`).join(', ') + ']},');
    }
    const rt = list.map((k) => runtimeDict(k.p));
    if (rt.some(Boolean)) {
      lines.push('# game-only hand bones (src/41-hands.js), same convention:');
      rt.forEach((d, i) => { if (d) lines.push(`#   ${U}_${i}: ${d}`); });
    }
    return lines.join('\n');
  }
  function exportJSON(name) {
    const enc = (p) => {
      const bones = {};
      p.e.forEach((v, i) => { if (v.some((x) => x !== 0)) bones[names[i]] = v.map((x) => +x.toFixed(3)); });
      return { bones, root: p.root };
    };
    return JSON.stringify({
      poser: 1, name: name || 'posed', loop,
      keys: (keys.length ? keys : [{ t: 0, p: pose }]).map((k) => ({ t: k.t, ...enc(k.p) })),
    }, null, 1);
  }
  function importJSON(txt) {
    const d = JSON.parse(txt);
    const dec = (k) => ({
      e: names.map((n) => (k.bones && k.bones[n] ? k.bones[n].slice() : [0, 0, 0])),
      root: (k.root || [0, 0, 0]).slice(),
    });
    keys = (d.keys || []).map((k) => ({ t: +k.t || 0, p: dec(k) })).sort((a, b) => a.t - b.t);
    loop = d.loop !== false;
    if (keys.length) { pose = clone(keys[0].p); head = 0; }
    return d.name || 'posed';
  }

  // ── the camera ────────────────────────────────────────────────────────────
  const cam = { yaw: 0, pitch: 0.25, dist: 2.2, at: new THREE.Vector3(), set: false };
  const _v = new THREE.Vector3();
  function carrier() {
    // v2.0 is the one drawn, and on the cot she is lifted by the room; she
    // wears v1.0's bones, so her mesh's matrix is the one to put them through.
    if (typeof appr !== 'undefined' && appr && appr.mesh && appr.mesh.visible) return appr.mesh;
    return fig ? fig.mesh : null;
  }
  function boneWorld(i, out) {
    const m = carrier();
    m.updateMatrixWorld();
    return fig.boneAt(i, out).applyMatrix4(m.matrixWorld);
  }
  function aimCamera(camera) {
    if (!cam.set) {
      boneWorld(Math.max(0, names.indexOf('spine02')), cam.at);
      _v.copy(camera.position).sub(cam.at);
      cam.dist = Math.min(2.4, Math.max(0.6, _v.length()));
      cam.yaw = Math.atan2(_v.x, _v.z);
      cam.pitch = Math.asin(Math.max(-0.95, Math.min(0.95, _v.y / (_v.length() || 1))));
      cam.set = true;
    }
    const cp = Math.cos(cam.pitch);
    camera.position.set(cam.at.x + Math.sin(cam.yaw) * cp * cam.dist,
      cam.at.y + Math.sin(cam.pitch) * cam.dist, cam.at.z + Math.cos(cam.yaw) * cp * cam.dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.at);
    camera.updateMatrixWorld();
    // The game's near plane is the game's: it is pushed out as far as 1.2 m
    // off whatever body is nearest YOU, and an orbit a metre from her is
    // inside that — she came out sliced in half. Ours, every frame, after it.
    const near = Math.min(0.1, cam.dist * 0.08);
    if (Math.abs(camera.near - near) > 1e-4) { camera.near = near; camera.updateProjectionMatrix(); }
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  let ui = null, sel = -1, sym = false, clipName = 'posed';
  const GROUPS = [
    ['body', /^(pelvis|spine|chest|neck|head|jaw|eye)/],
    ['left arm', /^(clavicle|arm|hand|thumb|fingers)[A-Z]*L$/],
    ['right arm', /^(clavicle|arm|hand|thumb|fingers)[A-Z]*R$/],
    ['right hand, game-only', /^(idx|thb)/],
    ['left leg', /^(leg|foot|toe)[A-Z]*L$/],
    ['right leg', /^(leg|foot|toe)[A-Z]*R$/],
  ];
  const CSS = `
#poser{position:fixed;top:0;right:0;bottom:0;width:340px;z-index:60;overflow:auto;
 background:rgba(7,13,17,.86);color:#e8f2f4;font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;
 border-left:1px solid rgba(180,226,236,.22);padding:10px 12px 40px;box-sizing:border-box}
#poser h3{margin:12px 0 5px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#4fd2e8}
#poser button{font:inherit;color:#e8f2f4;background:#16252c;border:1px solid rgba(180,226,236,.3);
 border-radius:4px;padding:3px 7px;margin:2px 2px 2px 0;cursor:pointer}
#poser button:hover{background:#21414c}#poser button.on{background:#2b7f92}
#poser .row{display:flex;align-items:center;gap:6px;margin:3px 0}
#poser input[type=range]{flex:1;accent-color:#4fd2e8}
#poser input[type=number],#poser input[type=text],#poser select{width:64px;font:inherit;color:#e8f2f4;
 background:#0d181d;border:1px solid rgba(180,226,236,.3);border-radius:3px;padding:2px 3px}
#poser input[type=text]{width:110px}#poser select{width:auto;max-width:170px}
#poser .bones span{display:inline-block;padding:1px 5px;margin:1px;border-radius:3px;cursor:pointer;
 background:#0f1c22}#poser .bones span:hover{background:#21414c}#poser .bones span.sel{background:#ff8b3d;color:#070b0e}
#poser .bones span.mod{box-shadow:inset 0 -2px 0 #4fd2e8}
#poser .ax{width:12px;font-weight:bold}#poser .ax.x{color:#ff6b6b}#poser .ax.y{color:#7ee081}#poser .ax.z{color:#6fa8ff}
#poser textarea{width:100%;height:120px;font:11px ui-monospace,monospace;color:#e8f2f4;background:#0d181d;
 border:1px solid rgba(180,226,236,.3);box-sizing:border-box}
#poser .keys div{display:flex;gap:4px;align-items:center;margin:2px 0}
#poser .keys div.cur{outline:1px solid #ff8b3d}
#poser .dim{color:#8aa3ab}
#poser-dots{position:fixed;inset:0;z-index:59;cursor:grab}`;

  function el(tag, attrs = {}, kids = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const k of [].concat(kids)) if (k) e.append(k);
    return e;
  }

  function buildUI() {
    document.head.append(el('style', { text: CSS }));
    const dots = el('canvas', { id: 'poser-dots' });
    const panel = el('div', { id: 'poser' });
    document.body.append(dots, panel);
    ui = { dots, panel, ctx: dots.getContext('2d') };

    const btn = (label, fn, title = '') => el('button', { text: label, title, on: { click: fn } });
    ui.status = el('div', { class: 'dim' });
    ui.bones = el('div', { class: 'bones' });
    ui.selName = el('div', { text: 'click a joint dot, or a name below' });
    ui.axes = el('div');
    ui.clipSel = el('select');
    ui.clipAt = el('input', { type: 'number', step: '0.05', value: '0' });
    ui.keys = el('div', { class: 'keys' });
    ui.scrub = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '0' });
    ui.headOut = el('span', { class: 'dim', text: '0.00 s' });
    ui.name = el('input', { type: 'text', value: clipName });
    ui.out = el('textarea', { spellcheck: 'false' });
    ui.playB = btn('▶ play', () => { playing = !playing; if (playing && head >= dur()) head = 0; refresh(); }, 'space');
    ui.loopB = btn('loop', () => { loop = !loop; refresh(); });
    ui.symB = btn('mirror-edit', () => { sym = !sym; refresh(); },
      'edit one side and the other follows as its mirror image');

    panel.append(
      el('div', {}, [el('b', { text: '?pose ' }), el('span', { class: 'dim', text: 'F8 / Esc: back to the game (she stays held until release) · drag = orbit · right-drag = pan · wheel = zoom · F = frame joint · Q/A W/S E/D = ±x ±y ±z (shift ×5) · K = key · space = play' })]),
      ui.status,
      el('h3', { text: 'start from' }),
      el('div', { class: 'row' }, [btn('her, now', () => { capture(); keysSelect(-1); refresh(); }, 'freeze whatever she is doing and take it'),
        btn('release', release, 'hand her back to the game')]),
      el('div', { class: 'row' }, [ui.clipSel, el('span', { class: 'dim', text: 'at' }), ui.clipAt,
        btn('take', () => {
          const J = jadrija.poser;
          fig.manual(null);
          if (J.frame(ui.clipSel.value, +ui.clipAt.value || 0)) { remember(); capture(); refresh(); }
        })]),
      el('h3', { text: 'joint' }), ui.selName, ui.axes,
      el('div', { class: 'row' }, [btn('zero joint', () => { if (sel < 0) return; remember(); pose.e[sel] = [0, 0, 0]; changed(); }),
        btn('→ other side', () => {
          if (sel < 0 || !side(names[sel])) return;
          remember(); mirrorSide(side(names[sel]), new Set([names[sel]])); changed(false);
        }, 'mirror this joint on to its partner'),
        ui.symB]),
      el('div', { class: 'row' }, [btn('L arm+leg → R', () => { remember(); mirrorSide('L'); changed(false); }),
        btn('R → L', () => { remember(); mirrorSide('R'); changed(false); }),
        btn('undo', doUndo, 'ctrl+z')]),
      el('h3', { text: 'bones' }), ui.bones,
      el('h3', { text: 'keyframes' }),
      el('div', { class: 'row' }, [btn('+ key here', addKey, 'K'), ui.playB, ui.loopB]),
      el('div', { class: 'row' }, [ui.scrub, ui.headOut]),
      ui.keys,
      el('h3', { text: 'export' }),
      el('div', { class: 'row' }, [el('span', { class: 'dim', text: 'name' }), ui.name]),
      el('div', { class: 'row' }, [btn('python', () => show(exportPy(ui.name.value))),
        btn('json', () => show(exportJSON(ui.name.value))),
        btn('copy', () => { ui.out.select(); navigator.clipboard && navigator.clipboard.writeText(ui.out.value); }),
        btn('save file', saveFile), btn('load', () => ui.file.click())]),
      ui.out,
    );
    ui.file = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none',
      on: { change: async () => {
        const f = ui.file.files[0]; if (!f) return;
        try { remember(); clipName = importJSON(await f.text()); ui.name.value = clipName; changed(false); } catch (e) { ui.status.textContent = 'load failed: ' + e.message; }
        ui.file.value = '';
      } } });
    panel.append(ui.file);
    ui.name.addEventListener('input', () => { clipName = ui.name.value; stash(); });
    ui.scrub.addEventListener('input', () => {
      head = (+ui.scrub.value) * dur(); playing = false;
      const p = sampleKeys(head); if (p) { pose = p; apply(); }
      refresh();
    });

    for (const [label, re] of GROUPS) {
      const members = names.map((n, i) => [n, i]).filter(([n]) => re.test(n));
      if (!members.length) continue;
      ui.bones.append(el('div', { class: 'dim', text: label }));
      const box = el('div');
      for (const [n, i] of members) {
        box.append(el('span', { 'data-i': i, text: n, on: { click: () => select(i) } }));
      }
      ui.bones.append(box);
    }
    // Any bone no group claimed, so nothing is unreachable.
    const claimed = new Set();
    GROUPS.forEach(([, re]) => names.forEach((n) => { if (re.test(n)) claimed.add(n); }));
    const rest = names.map((n, i) => [n, i]).filter(([n]) => !claimed.has(n));
    if (rest.length) {
      ui.bones.append(el('div', { class: 'dim', text: 'other' }));
      const box = el('div');
      for (const [n, i] of rest) box.append(el('span', { 'data-i': i, text: n, on: { click: () => select(i) } }));
      ui.bones.append(box);
    }

    ui.sl = [];
    ['x', 'y', 'z'].forEach((a, c) => {
      const r = el('input', { type: 'range', min: '-180', max: '180', step: '0.5', value: '0' });
      const n = el('input', { type: 'number', min: '-180', max: '180', step: '0.5', value: '0' });
      const set = (v) => {
        if (sel < 0 || !pose) return;
        remember();
        pose.e[sel][c] = wrap(+v || 0);
        changed();
      };
      r.addEventListener('input', () => set(r.value));
      n.addEventListener('change', () => set(n.value));
      ui.sl.push([r, n]);
      ui.axes.append(el('div', { class: 'row' }, [el('span', { class: 'ax ' + a, text: a }), r, n]));
    });

    for (const c of jadrija.poser.clips()) ui.clipSel.append(el('option', { value: c, text: c }));

    // Mouse on the dots canvas: pick, orbit, pan, zoom.
    let drag = null;
    dots.addEventListener('contextmenu', (e) => e.preventDefault());
    dots.addEventListener('pointerdown', (e) => {
      const hit = e.button === 0 ? pick(e.clientX, e.clientY) : -1;
      if (hit >= 0) { select(hit); return; }
      drag = { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey };
      dots.setPointerCapture(e.pointerId);
      dots.style.cursor = 'grabbing';
    });
    dots.addEventListener('pointermove', (e) => {
      if (!drag) { ui.hover = pick(e.clientX, e.clientY); return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.pan) {
        const s = cam.dist * 0.0016;
        const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
        cam.at.addScaledVector(right, -dx * s);
        cam.at.y += dy * s;
      } else {
        cam.yaw -= dx * 0.008;
        cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + dy * 0.008));
      }
    });
    const up = () => { drag = null; dots.style.cursor = 'grab'; };
    dots.addEventListener('pointerup', up);
    dots.addEventListener('pointercancel', up);
    dots.addEventListener('wheel', (e) => {
      e.preventDefault();
      cam.dist = Math.max(0.15, Math.min(8, cam.dist * Math.exp(e.deltaY * 0.0012)));
    }, { passive: false });
  }

  function show(txt) { ui.out.value = txt; }
  function saveFile() {
    const blob = new Blob([exportJSON(ui.name.value)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: (ui.name.value || 'posed') + '.pose.json' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  let keySel = -1;
  function keysSelect(i) { keySel = i; }
  function addKey() {
    if (!pose) return;
    const t = keys.length ? +(Math.max(head, dur() + (head >= dur() ? 1 : 0))).toFixed(2) : 0;
    const at = keys.findIndex((k) => Math.abs(k.t - t) < 1e-3);
    if (at >= 0) keys[at].p = clone(pose);
    else keys.push({ t, p: clone(pose) });
    keys.sort((a, b) => a.t - b.t);
    head = t; keySel = keys.findIndex((k) => Math.abs(k.t - t) < 1e-3);
    stash(); refresh();
  }
  function renderKeys() {
    ui.keys.textContent = '';
    keys.forEach((k, i) => {
      const t = el('input', { type: 'number', step: '0.05', value: k.t.toFixed(2) });
      t.addEventListener('change', () => { k.t = Math.max(0, +t.value || 0); keys.sort((a, b) => a.t - b.t); stash(); refresh(); });
      ui.keys.append(el('div', { class: i === keySel ? 'cur' : '' }, [
        el('span', { class: 'dim', text: '#' + i }), t,
        el('button', { text: 'go', on: { click: () => { keySel = i; head = k.t; playing = false; pose = clone(k.p); apply(); refresh(); } } }),
        el('button', { text: 'set', title: 'overwrite this key with the pose on screen', on: { click: () => { k.p = clone(pose); keySel = i; stash(); refresh(); } } }),
        el('button', { text: '✕', on: { click: () => { keys.splice(i, 1); keySel = -1; stash(); refresh(); } } }),
      ]));
    });
    if (!keys.length) ui.keys.append(el('div', { class: 'dim', text: 'no keys yet — pose her, then + key. Keys go 1 s apart; edit the times.' }));
  }

  function select(i) {
    // Touching a joint takes her, if nothing has yet.
    if (!pose) capture();
    sel = i;
    if (ui) refresh();
  }
  function frameSel() {
    if (sel < 0) return;
    boneWorld(sel, cam.at);
  }
  function changed(mirror = true) {
    if (sym && mirror && sel >= 0 && side(names[sel])) mirrorSide(side(names[sel]));
    apply(); stash(); refresh();
  }
  function doUndo() {
    if (!undo.length) return;
    pose = undo.pop(); apply(); refresh();
  }

  function refresh() {
    if (!ui) return;
    const modified = new Set(pose ? pose.e.map((v, i) => (v.some((x) => Math.abs(x) > 0.05) ? i : -1)) : []);
    for (const s of ui.bones.querySelectorAll('span')) {
      const i = +s.dataset.i;
      s.classList.toggle('sel', i === sel);
      s.classList.toggle('mod', modified.has(i));
    }
    if (sel >= 0 && pose) {
      const rt = RUNTIME.includes(names[sel]);
      ui.selName.textContent = names[sel] + (rt ? '  (game-only bone)' : '')
        + '  — the lines on her are the axes each slider turns about';
      ui.sl.forEach(([r, n], c) => { r.value = pose.e[sel][c]; n.value = pose.e[sel][c].toFixed(1); });
    }
    ui.playB.textContent = playing ? '❚❚ stop' : '▶ play';
    ui.playB.classList.toggle('on', playing);
    ui.loopB.classList.toggle('on', loop);
    ui.symB.classList.toggle('on', sym);
    ui.scrub.value = dur() ? head / dur() : 0;
    ui.headOut.textContent = head.toFixed(2) + ' / ' + dur().toFixed(2) + ' s';
    renderKeys();
    const J = jadrija.poser;
    ui.status.textContent = pose
      ? `holding ${J.held() ? 'her' : '—'} · ${nb} bones · ${keys.length} keys`
      : 'press "her, now" to take her pose';
  }

  // ── dots ──────────────────────────────────────────────────────────────────
  const scr = [];           // [x, y, visible] per bone, this frame
  function pick(x, y) {
    let best = -1, bd = 14 * 14;
    for (let i = 0; i < scr.length; i++) {
      const s = scr[i]; if (!s || !s[2]) continue;
      const d = (s[0] - x) ** 2 + (s[1] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  const _p = new THREE.Vector3();
  function drawDots(camera) {
    const c = ui.dots, dpr = Math.min(2, devicePixelRatio || 1);
    const w = innerWidth, h = innerHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    }
    const g = ui.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < nb; i++) {
      boneWorld(i, _p).project(camera);
      scr[i] = [(_p.x + 1) / 2 * w, (1 - _p.y) / 2 * h, _p.z < 1];
    }
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(232,242,244,0.35)';
    g.beginPath();
    for (let i = 0; i < nb; i++) {
      const p = parent[i];
      if (p < 0 || !scr[i][2] || !scr[p][2]) continue;
      g.moveTo(scr[p][0], scr[p][1]); g.lineTo(scr[i][0], scr[i][1]);
    }
    g.stroke();
    // The selected joint's three turning axes, in the slider colours: the
    // frame the Euler turns in is the parent's world times the bone's rest,
    // and Blender's x, y, z are figure +x, −z, +y in it.
    if (sel >= 0 && scr[sel] && scr[sel][2] && pose) {
      const L = locals(pose), W = worlds(L);
      const F = parent[sel] < 0 ? restQ[sel] : qm(W[parent[sel]], restQ[sel]);
      const m = carrier();
      const o = boneWorld(sel, new THREE.Vector3());
      const Fq = new THREE.Quaternion(F[0], F[1], F[2], F[3]);
      const mq = new THREE.Quaternion(); m.getWorldQuaternion(mq);
      const ms = new THREE.Vector3(); m.getWorldScale(ms);
      const len = 0.09 * Math.max(0.3, Math.min(3, cam.dist / 1.5)) * ms.x;
      [[1, 0, 0, '#ff6b6b'], [0, 0, -1, '#7ee081'], [0, 1, 0, '#6fa8ff']].forEach(([x, y, z, col]) => {
        const a = new THREE.Vector3(x, y, z).applyQuaternion(Fq).applyQuaternion(mq);
        const p0 = o.clone().addScaledVector(a, -len).project(camera);
        const p1 = o.clone().addScaledVector(a, len).project(camera);
        if (p0.z >= 1 || p1.z >= 1) return;
        g.strokeStyle = col; g.lineWidth = 2;
        g.beginPath();
        g.moveTo((p0.x + 1) / 2 * w, (1 - p0.y) / 2 * h);
        g.lineTo((p1.x + 1) / 2 * w, (1 - p1.y) / 2 * h);
        g.stroke();
      });
      g.lineWidth = 1;
    }
    for (let i = 0; i < nb; i++) {
      const s = scr[i]; if (!s[2]) continue;
      const n = names[i];
      const col = i === sel ? '#ff8b3d' : RUNTIME.includes(n) ? '#c792ea'
        : n.endsWith('L') ? '#ff6b6b' : n.endsWith('R') ? '#6fa8ff' : '#e8f2f4';
      g.fillStyle = col;
      g.beginPath(); g.arc(s[0], s[1], i === sel ? 5 : 3.2, 0, Math.PI * 2); g.fill();
      if (i === sel || i === ui.hover) {
        g.font = '11px ui-monospace, monospace';
        g.fillStyle = '#070b0e'; g.fillText(n, s[0] + 8, s[1] - 5);
        g.fillStyle = col; g.fillText(n, s[0] + 7, s[1] - 6);
      }
    }
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────
  function open() {
    if (!bind()) return false;
    if (!ui) buildUI();
    on = true; cam.set = false;
    if (document.pointerLockElement) document.exitPointerLock();
    // Opening does not take her: she goes on living until "her, now", so the
    // panel can be closed (F8), the scene set up in the game, and opened again.
    if (!pose) restoreStash(); else { jadrija.poser.hold(true); apply(); }
    ui.dots.style.display = ''; ui.panel.style.display = '';
    refresh();
    return true;
  }
  function release() {
    if (fig) fig.manual(null);
    if (typeof jadrija !== 'undefined' && jadrija && jadrija.poser) jadrija.poser.hold(false);
    pose = null; playing = false;
    refresh();
  }
  function close() {
    on = false;
    if (ui) { ui.dots.style.display = 'none'; ui.panel.style.display = 'none'; }
  }

  // Keys and the last session survive a reload — a convenience, never the
  // record: the export is the record.
  const STASH = 'fr.poser.v1';
  function stash() {
    try { localStorage.setItem(STASH, exportJSON(clipName)); } catch { /* private window */ }
  }
  function restoreStash() {
    try {
      const s = localStorage.getItem(STASH);
      if (!s) return;
      const d = JSON.parse(s);
      if (!d.keys || d.keys.length < 2) return;   // one key is just the last pose
      const cur = pose ? clone(pose) : null;
      clipName = importJSON(s);
      if (ui) ui.name.value = clipName;
      pose = cur; if (pose) apply();               // but keep her as she is now
    } catch { /* nothing to restore */ }
  }

  // Keyboard while posing: ours, and nobody else's.
  addEventListener('keydown', (e) => {
    if (!ENABLED) return;
    if (e.code === 'F8') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (on) close(); else open();
      return;
    }
    if (!on) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
      if (e.code === 'Escape') t.blur();
      e.stopImmediatePropagation();
      return;
    }
    e.stopImmediatePropagation();
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); doUndo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    const step = e.shiftKey ? 5 : 1;
    const nudge = (c, s) => { if (sel < 0 || !pose) return; remember(); pose.e[sel][c] = wrap(pose.e[sel][c] + s); changed(); };
    switch (e.code) {
      case 'KeyQ': nudge(0, step); break; case 'KeyA': nudge(0, -step); break;
      case 'KeyW': nudge(1, step); break; case 'KeyS': nudge(1, -step); break;
      case 'KeyE': nudge(2, step); break; case 'KeyD': nudge(2, -step); break;
      case 'KeyK': addKey(); break;
      case 'KeyF': frameSel(); break;
      case 'Space': playing = !playing; if (playing && head >= dur()) head = 0; refresh(); break;
      case 'Escape': close(); break;
      default:
    }
  }, true);
  addEventListener('keyup', (e) => { if (on) e.stopImmediatePropagation(); }, true);

  // Open on its own once she exists — the back door drops you at Jadrija.
  if (ENABLED) {
    const wait = setInterval(() => {
      const J = typeof jadrija !== 'undefined' && jadrija && jadrija.poser;
      if (J && J.fig() && typeof state !== 'undefined' && state.phase === 'ground') {
        clearInterval(wait);
        setTimeout(open, 1500);
      }
    }, 500);
  }

  /** Every baked key of `clip`, against what this file would make of it. */
  function verify(clip, times) {
    if (!bind()) return null;
    const J = jadrija.poser;
    const keep = pose;
    fig.manual(null);
    let worst = 0, at = null;
    for (const t of times) {
      J.frame(clip, t);
      const l = fig.local();
      const L = [];
      for (let i = 0; i < nb; i++) L.push(Array.from(l.q.subarray(i * 4, i * 4 + 4)));
      const p = fromLocals(L, Array.from(l.t), null);
      const L2 = locals(p);
      for (let i = 0; i < nb; i++) {
        const d = qang(L[i], L2[i]);
        if (d > worst) { worst = d; at = [t, names[i]]; }
      }
    }
    pose = keep;
    if (pose) apply();
    return { worstDeg: +worst.toFixed(4), at };
  }

  return {
    get on() { return on; },
    frame(dt, camera) {
      if (!on || !fig) return;
      if (playing && keys.length > 1) {
        head += dt;
        if (head > dur()) head = loop ? head % dur() : dur();
        if (!loop && head >= dur()) playing = false;
        pose = sampleKeys(head); apply();
        if (ui) { ui.scrub.value = head / dur(); ui.headOut.textContent = head.toFixed(2) + ' / ' + dur().toFixed(2) + ' s'; }
      }
      aimCamera(camera);
      if (ui) drawDots(camera);
    },
    open, close, release, capture, verify,
    // For probes and the console.
    get pose() { return pose; },
    set pose(p) { pose = p; apply(); if (ui) refresh(); },
    names: () => names.slice(),
    set(bone, e) { const i = names.indexOf(bone); if (i < 0 || !pose) return false; pose.e[i] = e.slice(); apply(); if (ui) refresh(); return true; },
    get: (bone) => (pose ? pose.e[names.indexOf(bone)] : null),
    mirror: (from, only) => { mirrorSide(from, only ? new Set(only) : null); apply(); },
    keys: () => keys,
    addKey, exportPy, exportJSON, importJSON,
    play: (v = true) => { playing = v; },
    locals: () => (pose ? locals(pose) : null),
    eulQ, qEul, cam,
    focus: (bone) => { const i = names.indexOf(bone); if (i < 0 || !fig) return false; boneWorld(i, cam.at); return true; },
    select: (bone) => select(names.indexOf(bone)),
  };
})();

if (typeof window !== 'undefined' && window.__fr) window.__fr.poser = poser;
