// -----------------------------------------------------------------------------
// Your hand on the toy she is wearing — the roles as they are (1.582.0).
//
// Misha, 2 Oct 2026: *"should be able to pull in/out not just in role-reverse
// mode but in any mode"*; asked who, with the roles normal: Chloe — which,
// with the roles normal, is you. So this is 1.567.0's draw (src/49-revtoys.js)
// with your own right hand in it instead of Chloe-the-NPC's: the same words
// (`rvtWords` — "pull it out a bit", "tease her", "in and out", "twist it",
// "push it back in", and the Croatian and French), the same toys (the plug,
// the Lovense, the wand), the same clock (`rvtCycles`, RVT's depths) and the
// same toy half (`jadrija.draw`, `jadrija.grip` — the toy slides out along its
// own line inside its mount and back to its seat).
//
// THE HAND is the first-person arm rig's (60-arms.js), a fist (`pull`, the
// belt's and the hair's) round the wand's handle or on the plug's base, and it
// follows the grip every frame as the toy moves under it. To get there you
// step in to her and, when it is low on her — on the cot, on all fours — you
// kneel first, as the spank does (SPANK_HAND `kneelIf`), and get up again a
// little after.
//
// What she feels of it is her own: a gasp in her voice on each draw out and
// each push back in (`herGasp`, Baye's), and her voice knows it is drawn
// (`toy_drawn` in the scene, as Chloe's is with the roles reversed).
//
// THE SAFEWORD reseats it: "red" while your hand is on it and the toy goes
// back to its seat in 0.3 s and your hand comes away.
//
// Never while the roles are reversed — there the toy is Chloe's to handle
// and it is you wearing it (49-revtoys.js). Nothing here plays in the third
// person but the toy: the third person has no arm for it, as for every reach.
// -----------------------------------------------------------------------------

const TH = {
  stand: 0.42,       // m off the grip you stop at, level
  walk: 1.4,         // m/s stepping in
  far: 2.2,          // m: further than this and it is "go to her" instead
  kneelIf: 0.80,     // m under your eye: kneel first (the spank's)
  low: 0.85,         // how far down you are before the hand goes out
  rise: 2.5,         // s after it you get up again, if you knelt for it
  reach: 0.45, close: 0.18, let: 0.22, away: 0.40,   // s
  reseat: 0.3,       // s the safeword takes to seat it
  stall: 3.0,        // s the step may take
};

// idle | step | reach | close | work | let | away
const th = { ph: 'idle', t: 0, key: null, kind: 'draw', cyc: null, i: 0, ct: 0, d: 0, tw: 0, part: null,
  push: false, knelt: null, reseat: null, log: [] };
let thK = 0, thG = 0;
const thAt = new THREE.Vector3(), thFrom = new THREE.Vector3();
const thHair = [0, -1, 0];
const _thA = new THREE.Vector3(), _thB = new THREE.Vector3();

/**
 * YOUR WORDS FOR IT, the whole line: 'toy.hand:draw' | ':tease' | ':twist' |
 * ':push', or null. 1.567.0's (`rvtWords`), so the same sentences as with
 * the roles reversed, and "her" for "me" ("tease her"). Only with the roles
 * as they are and a toy on her: otherwise the line goes on as it always did.
 */
function toyHandWords(text) {
  if (typeof revActive === 'function' && revActive()) return null;
  if (typeof rvtWords !== 'function' || typeof _revNorm !== 'function') return null;
  let t = _revNorm(text);
  if (!t) return null;
  t = t.replace(/^(ok(ay)?|yes|da|dobro|oui|d'accord)( |$)/, '').trim()
    .replace(/^(baye|chloe),? /, '').replace(/\b(her|baye)\b/g, 'me');
  const w = rvtWords(t);
  if (!w || !/^rev\.toy:(draw|tease|twist|push)$/.test(w)) return null;
  if (!toyHandWorn().length) return null;
  // "Put the plug in" is a fetch for her (`wear:plug`), not your hand pushing
  // one back: push is only yours while your hand is on one.
  if (w === 'rev.toy:push' && !toyHandActive()) return null;
  // And "take the wand out" is hers to take it out (`doff:wand`): a draw is
  // only a draw with a little in it — "a bit", "slowly", "halfway", "malo".
  if (w === 'rev.toy:draw' && !/\b(bit|little|slowly|partway|part way|halfway|half way|malo|polako|pola|peu|doucement)\b/.test(t)) return null;
  return 'toy.hand:' + w.slice(8);
}

/** Whether your hand is on her toy, or on its way. */
function toyHandActive() { return th.ph !== 'idle'; }

/** The toys on her a hand can draw: worn, with a grip. */
function toyHandWorn() {
  if (!jadrija || !jadrija.worn || !jadrija.grip) return [];
  return jadrija.worn().filter((k) => (k === 'plug' || k === 'lovense' || k === 'wand') && jadrija.grip(k));
}

/** Where on it the hand goes this frame, world — the wand's handle, the others' base. */
function toyHandPoint(key, out) {
  const g = jadrija.grip(key);
  if (!g) return null;
  out.copy(g.p);
  if (!g.wand) out.addScaledVector(g.out, RVT.palmOff[key] + 0.012);
  // The fist's tunnel along the handle (the wand) or the toy's line.
  const L = g.wand ? g.long : _thB.copy(g.out).negate();
  thHair[0] = L.x; thHair[1] = L.y; thHair[2] = L.z;
  return g;
}

/** Why not, for `key` where she is: true, or a reason. */
function toyHandReach(key) {
  const P = toyHandPoint(key, _thA);
  if (!P) return 'not worn';
  const v = jadrija.autoView ? jadrija.autoView() : null;
  const G = typeof rvmCotGeom === 'function' ? rvmCotGeom() : null;
  if (v && v.onBed && G && _thA.y < G.top + 0.04) return 'against the mattress';
  const Y = ground && ground.you;
  if (Y && !(v && v.onBed) && _thA.y < Y.y + 0.08) return 'against the floor';
  // The Lovense rides her pelvis and stands off her with her hips folded.
  if (key === 'lovense' && jadrija.drawSeat) {
    const s = jadrija.drawSeat('lovense');
    if (s != null && s < -0.010) return 'off her skin here';
  }
  if (Y && Math.hypot(_thA.x - Y.x, _thA.z - Y.z) > TH.far) return 'too far — go to her';
  return true;
}

/**
 * Asked: 'draw' | 'tease' | 'twist' | 'push', and the line it came in (for
 * which toy, if it names one). Answers { ok, label }.
 */
function toyHandAsk(act, text = '') {
  if (typeof revActive === 'function' && revActive()) return { ok: false, label: 'toy: Chloe’s, with the roles reversed' };
  if (state.phase !== 'ground' || !ground || !ground.ok) return { ok: false, label: 'toy: only on foot' };
  if (act === 'push') {
    if (th.ph === 'work' && th.d > 0.002) { th.push = true; return { ok: true, label: 'you: push it back in' }; }
    if (th.ph === 'step' || th.ph === 'reach' || th.ph === 'close') { th.ph = 'away'; th.t = 0; return { ok: true, label: 'you: leave it where it is' }; }
    return { ok: false, label: 'toy: it is all the way in' };
  }
  if (th.ph !== 'idle') return { ok: false, label: 'toy: your hand is on it already' };
  if (beltInHand() || (typeof collarState === 'function' && collarState() && collarState().clipped)) return { ok: false, label: 'toy: your right hand is full' };
  let ks = toyHandWorn();
  if (!ks.length) return { ok: false, label: 'toy: she is not wearing one' };
  const named = /\b(wand|g ?spot|big one|pink one|stapic|baguette)\b/.test(text) ? 'wand'
    : /\b(plug|cep)\b/.test(text) ? 'plug' : /\b(lovense|lovens|lovesense|egg)\b/.test(text) ? 'lovense' : null;
  if (named) {
    if (!ks.includes(named)) return { ok: false, label: 'toy: she is not wearing the ' + named };
    ks = [named];
  }
  const why = {};
  const ok = ks.filter((k) => (why[k] = toyHandReach(k)) === true);
  if (!ok.length) return { ok: false, label: 'toy: you cannot get at it there (' + ks.map((k) => k + ': ' + why[k]).join(', ') + ')' };
  // The wand first: it is the one with a handle.
  const key = ok.includes('wand') ? 'wand' : ok[Math.floor(Math.random() * ok.length)];
  // On her feet, her knees or all fours she keeps facing you, so a toy in
  // her back is on the side you can never walk round to: she turns round
  // for it — her own "turn around" (`show.turnBack`), which keeps her back
  // to you as you move — and for one in front, turned away, back again.
  const v = jadrija.autoView ? jadrija.autoView() : null;
  const holes = jadrija.toyHoles ? jadrija.toyHoles() || {} : {};
  const hole = holes.back === key ? 'back' : 'front';
  let turned = false;
  if (v && !v.onBed && !v.lying && jadrija.askShow && (!!v.turnBack) !== (hole === 'back')) {
    jadrija.askShow('turn');
    turned = true;
  }
  let kind = act === 'tease' ? 'tease' : act === 'twist' ? 'twist' : 'draw';
  if (kind === 'twist' && key === 'lovense') kind = 'draw';
  Object.assign(th, { key, kind, cyc: rvtCycles(key, kind), i: 0, ct: 0, d: 0, tw: 0, part: null, push: false,
    felt: 0, t: 0, ph: 'step', stuck: 0, moved: false, maxD: 0, fail: null, wait: turned ? 1.4 : 0 });
  th.log.push({ act, key, kind, at: +(typeof sceneNow === 'function' ? sceneNow() : 0).toFixed(1) });
  if (th.log.length > 40) th.log.shift();
  return { ok: true, label: 'you: ' + (kind === 'tease' ? 'tease her with the ' : kind === 'twist' ? 'twist the ' : 'draw out the ') + key + (turned ? ' (she turns round for it)' : '') };
}

/** "red": it goes back to its seat, and your hand comes away. */
function toyHandSafe() {
  if (th.key && th.d > 0.0005) th.reseat = { key: th.key, d0: th.d, tw0: th.tw, t: 0 };
  else if (th.key && jadrija && jadrija.draw) jadrija.draw(th.key, 0, 0);
  th.d = 0; th.tw = 0;
  if (th.ph !== 'idle') { th.ph = thK > 0.01 ? 'away' : 'idle'; th.t = 0; }
  return true;
}

/** Her voice's part (`sceneTalk`): which toy your hand has drawn partway out. */
function toyHandScene(o) {
  if (th.key && th.d > 0.003 && th.ph === 'work') o.toy_drawn = th.key;
}

/** The draw's clock — `rvtDrawAt`'s, without Chloe's body in it. */
function toyHandDrawAt(dt) {
  const c = th.cyc[th.i];
  if (!c) return null;
  th.ct += dt;
  const t = th.ct;
  let d = 0, tw = 0, part = 'out';
  if (th.push && t < c.tOut + c.tHold) { th.ct = c.tOut + c.tHold; return toyHandDrawAt(0); }
  if (t < c.tOut) d = c.D * _sm(t / c.tOut);
  else if (t < c.tOut + c.tHold) {
    d = c.D; part = 'hold';
    if (c.tw) tw = c.tw * Math.sin(((t - c.tOut) / c.tHold) * Math.PI * 4) * Math.min(1, (t - c.tOut) / 0.3, (c.tOut + c.tHold - t) / 0.3);
  } else if (t < c.tOut + c.tHold + c.tIn) { d = c.D * (1 - _sm((t - c.tOut - c.tHold) / c.tIn)); part = 'in'; }
  else if (t < c.tOut + c.tHold + c.tIn + c.gap) { d = 0; part = 'gap'; }
  else { th.i++; th.ct = 0; if (th.push) th.i = th.cyc.length; return toyHandDrawAt(0); }
  if (part !== th.part) {
    if (part === 'out' || part === 'in') toyHandFelt(part, c.D);
    th.part = part;
  }
  return { d, tw, part };
}

/** Hers: a gasp on each draw out and each push back in — harder on the wand. */
function toyHandFelt(how, D) {
  const x = th.key === 'wand' ? RVT.wandX : 1;
  const k = Math.min(1, D / 0.03) * x;
  const A = typeof audio !== 'undefined' && audio ? audio : null;
  if (A && A.herGasp && (how === 'in' || Math.random() < 0.6)) A.herGasp(Math.min(0.9, 0.25 + 0.35 * k), true, 0.2 + Math.random() * 0.3);
  else if (A && A.herMoan && how === 'in' && Math.random() < 0.3) A.herMoan();
  th.felt = (th.felt || 0) + 1;
}

function toyHandTick(dt) {
  if (th.reseat) {
    const R = th.reseat;
    R.t += dt;
    const k = 1 - _sm(R.t / TH.reseat);
    if (jadrija && jadrija.draw) jadrija.draw(R.key, R.d0 * k, R.tw0 * k);
    if (R.t >= TH.reseat) { if (jadrija && jadrija.draw) jadrija.draw(R.key, 0, 0); th.reseat = null; }
  }
  const Y = ground && ground.you;
  if (th.ph === 'idle') {
    thK = thK < 0.01 ? 0 : damp(thK, 0, 10, dt);
    thG = 0;
    if (th.knelt) {
      th.knelt.idle += dt;
      if (!Y || !Y.crouch || state.phase !== 'ground') th.knelt = null;
      else if (th.knelt.idle > TH.rise) { if (!th.knelt.was) Y.crouch = false; th.knelt = null; }
    }
    return;
  }
  if (th.knelt) th.knelt.idle = 0;
  // Gone from her, or it came off her: seat it and let go.
  const g = state.phase === 'ground' && Y && th.key ? toyHandPoint(th.key, thAt) : null;
  if (!g || (typeof revActive === 'function' && revActive())) {
    if (th.key && th.d > 0 && jadrija && jadrija.draw && jadrija.grip(th.key)) jadrija.draw(th.key, 0, 0);
    th.d = 0; th.ph = 'idle'; th.key = null;
    return;
  }
  th.t += dt;
  const T = thAt;
  // Your view on it while you step in and reach — not once the hand is on it.
  if ((th.ph === 'step' || th.ph === 'reach') && !bodyCam && !camOverride) {
    const O = camera.position, ch = Math.hypot(T.x - O.x, T.z - O.z);
    let dy = Math.atan2(O.x - T.x, O.z - T.z) - Y.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    Y.yaw += dy * (1 - Math.exp(-10 * dt));
    Y.pitch += (Math.atan2(T.y - O.y, Math.max(ch, 0.05)) - Y.pitch) * (1 - Math.exp(-10 * dt));
  }
  if (th.ph === 'step') {
    // She is turning round for it first.
    if (th.wait > 0) { th.wait -= dt; th.t = 0; thK = damp(thK, 0, 10, dt); return; }
    const kneel = !Y.crouch && Y.y + (Y.eye || GROUND.eye) - T.y > TH.kneelIf;
    if (kneel) { Y.crouch = true; if (!th.knelt) th.knelt = { was: false, idle: 0 }; }
    // To the side it faces out of — behind her for the back, in front for
    // the front — `stand` off it, level: a straight line to it from wherever
    // you are reached through her for a toy on her far side.
    const o = _thB.set(g.out.x, 0, g.out.z);
    if (o.lengthSq() < 0.04) o.set(Y.x - T.x, 0, Y.z - T.z);
    o.normalize();
    const sx = T.x + o.x * TH.stand, sz = T.z + o.z * TH.stand;
    const dx = sx - Y.x, dz = sz - Y.z, md = Math.hypot(dx, dz);
    let moved = 0;
    if (md > 0.005 && ground.confine) {
      const st = Math.min(md, TH.walk * dt);
      const [nx, nz] = ground.confine(Y.x + dx / md * st, Y.z + dz / md * st);
      moved = Math.hypot(nx - Y.x, nz - Y.z);
      Y.x = nx; Y.z = nz;
    }
    th.stuck = moved < 0.2 * TH.walk * dt ? (th.stuck || 0) + dt : 0;
    const there = md <= 0.03 || th.stuck > 0.25 || th.t >= TH.stall;
    const down = !Y.crouch || (Y.low || 0) > TH.low || th.t >= TH.stall + 0.6;
    if (there && down) {
      // Not round to it: on its far side, or still too far for an arm.
      const side = (Y.x - T.x) * o.x + (Y.z - T.z) * o.z;
      if (side < 0.05 || Math.hypot(T.x - Y.x, T.z - Y.z) > 0.80) {
        th.fail = (side < 0.05 ? 'cannot get round to it' : 'cannot get near enough')
          + ' (' + Math.hypot(T.x - Y.x, T.z - Y.z).toFixed(2) + ' m, side ' + side.toFixed(2) + ')';
        th.ph = 'idle'; th.key = null;
        return;
      }
      th.ph = 'reach'; th.t = 0; thFrom.copy(T);
    }
    thK = damp(thK, 0, 10, dt);
    return;
  }
  if (th.ph === 'reach') {
    thK = Math.max(thK, _sm(th.t / TH.reach));
    thG = 0;
    if (th.t >= TH.reach) { th.ph = 'close'; th.t = 0; }
    return;
  }
  if (th.ph === 'close') {
    thK = 1; thG = _sm(th.t / TH.close);
    if (th.t >= TH.close) { th.ph = 'work'; th.t = 0; }
    return;
  }
  if (th.ph === 'work') {
    thK = 1; thG = 1;
    const r = toyHandDrawAt(dt);
    if (!r) {
      jadrija.draw(th.key, 0, 0); th.d = 0; th.tw = 0;
      th.ph = 'let'; th.t = 0;
      return;
    }
    // The toy first, then the hand to where its grip is now.
    jadrija.draw(th.key, r.d, r.tw);
    th.d = r.d; th.tw = r.tw;
    th.maxD = Math.max(th.maxD || 0, r.d);
    toyHandPoint(th.key, thAt);
    return;
  }
  if (th.ph === 'let') {
    thK = 1; thG = 1 - _sm(th.t / TH.let);
    if (th.t >= TH.let) { th.ph = 'away'; th.t = 0; }
    return;
  }
  if (th.ph === 'away') {
    thG = 0;
    // Back off it toward you first, then down out of the picture.
    thAt.addScaledVector(_thB.set(camera.position.x - T.x, 0, camera.position.z - T.z).normalize(), 0.08 * _sm(th.t / TH.away));
    thK = 1 - _sm(th.t / TH.away);
    if (th.t >= TH.away) { th.ph = 'idle'; thK = 0; th.key = null; }
  }
}

/** Debug: where it is. */
function toyHandState() {
  return { ph: th.ph, key: th.key, kind: th.kind, i: th.i, d: +(th.d * 1000).toFixed(1), tw: +(th.tw * 57.3).toFixed(0),
    k: +thK.toFixed(2), grip: +thG.toFixed(2), fail: th.fail || null, maxD: +((th.maxD || 0) * 1000).toFixed(1), felt: th.felt || 0,
    at: thAt.toArray().map((v) => +v.toFixed(3)), knelt: !!th.knelt, reseat: !!th.reseat, log: th.log.slice(-6) };
}
