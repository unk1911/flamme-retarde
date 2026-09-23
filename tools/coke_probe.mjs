// The line beat, sampled every frame at a fixed step and graded.
//
//   node tools/coke_probe.mjs <url> <out-dir> [--shots 12,30,...] [--frames 150]
//
// WHY THIS EXISTS. The beat was redone ten times off screenshots and every
// round was "better but not quite". A screenshot is one frame and an opinion;
// this is every frame and a number. It pauses the world, pins its step to
// 1/30 s with `__fr.filmDt`, puts her on the line mark in phase `line`, and
// walks the beat one `__fr.filmStep` at a time, reading `__fr.jad.cokeProbe`
// after each — straw ends against the nostril skinned off the mesh, the grip
// against the straw's axis, the far end against the powder, the elbow — and
// writes the lot to <out-dir>/probe.json. At the frames named in --shots it
// also photographs the face and the hand from two sides, re-rendering the same
// world instant for the second view with a one-microsecond step.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { gpuLaunch } from './gpu.mjs';

const url = process.argv[2];
const out = process.argv[3];
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const SHOTS = new Set((arg('--shots', '') || '').split(',').filter(Boolean).map(Number));
const FRAMES = +arg('--frames', 150);
const PORT = +arg('--port', 8932);
const W = +arg('--w', 900), H = +arg('--h', 700);
const DIST = +arg('--dist', 0.62);
// How many lines to take in a row — asked again each time she finishes one,
// the way Misha would ask. Each line has its own solved mark.
const LINES = +arg('--lines', 1);
// What to ask for first: 'line' (the beat this is for) or 'coke', to check the
// cutting — which shares the arm — is untouched by it.
const ASK = arg('--ask', 'line');
const FOV = +arg('--fov', 22);
mkdirSync(out, { recursive: true });

const GL = gpuLaunch(null);
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox',
  '--disable-dev-shm-usage', ...GL.args, '--hide-scrollbars', '--mute-audio',
  '--window-size=' + W + ',' + H, '--remote-debugging-port=' + PORT,
  '--user-data-dir=/tmp/claude-chrome-coke-' + PORT, 'about:blank'],
{ stdio: ['ignore', 'ignore', 'pipe'], env: GL.env });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const waiting = new Map();
const errs = [];
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
    const t = (await r.json()).find((x) => x.type === 'page');
    if (t) {
      ws = new WebSocket(t.webSocketDebuggerUrl);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      ws.onmessage = (m) => {
        const d = JSON.parse(m.data);
        if (d.method === 'Runtime.exceptionThrown') {
          errs.push((d.params.exceptionDetails.text + ' '
            + (d.params.exceptionDetails.exception?.description || '')).slice(0, 300));
        }
        if (waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); }
      };
      break;
    }
  } catch { /* not up yet */ }
  await sleep(500);
}
const send = (m, p = {}) => new Promise((res) => {
  const i = ++id;
  waiting.set(i, res);
  ws.send(JSON.stringify({ id: i, method: m, params: p }));
});
const ev = async (e) => {
  const r = await send('Runtime.evaluate',
    { expression: e, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) {
    throw new Error(e.slice(0, 80) + ': '
      + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  }
  return r.result?.result?.value;
};
const shot = async (f) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(f, Buffer.from(r.result.data, 'base64'));
};
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url });
// The build first — `enter` is shown when it is done — and then in through
// it, because the world does not start stepping until somebody does. A paused
// world that never started resolves no `filmStep`, which is a hang and not an
// error.
for (let i = 0; i < 360; i++) {
  const ok = await ev("!document.getElementById('enter').hidden").catch(() => false);
  if (ok) break;
  await sleep(500);
}
await ev("document.getElementById('enter').click()");
await sleep(600);
for (let i = 0; i < 180; i++) {
  const ok = await ev('!!(window.__fr && __fr.jad && __fr.jad.kabina && __fr.jad.kabina())')
    .catch(() => false);
  if (ok) break;
  await sleep(500);
}
console.log('ready');
// In the room, by the door, so she is in range and you are out of her way.
await ev('(() => { const k = __fr.jad.kabina(); __fr.jad.stand(k.dc, k.face + 0.55, 0); return 1; })()');
await sleep(6000);
const M = JSON.parse(await ev('JSON.stringify(__fr.jad.cokeMarks())'));
const LM = M.line || M.coke;
console.log('marks', JSON.stringify(M));
// On to the mark in a phase that holds still, then ASKED — the way Misha asks
// for it — so the room's own routine does not take her back off it the next
// frame. `put` straight into 'line' lasted one frame before 'come' had her.
await ev('(() => { __fr.jad.coke(0); __fr.jad.coke(1); __fr.jad.put('
  + LM[0] + ',' + LM[1] + ", 'dwell', null, " + LM[2] + '); return 1; })()');
await sleep(300);
console.log('ask', ASK, JSON.stringify(await ev("JSON.stringify(__fr.jad.ask('" + ASK + "'))")));
await ev('__fr.pause(true)');
await ev('__fr.filmDt(1 / 30)');
// The screen furniture, AFTER the pause — see film.mjs: `setPaused` puts the
// pause card up itself, over every close-up this takes.
await ev("for (const id of ['hud','ground-hud','chute-hud','touch','gtouch',"
  + "'pause','cine','radio','toast']) { const e = document.getElementById(id); if (e) e.hidden = true; }");
console.log('paused, stepping');

// Two views of the face and hand: from her right and in front, and from her
// right and a little behind. Placed off this frame's probe.
const views = (p) => {
  if (!p || !p.nostrilR || !p.pinch) return null;
  // On her pinch: that is where the straw is, whether it is at the plate or
  // at her nose.
  const c = p.pinch;
  const hx = p.nostrilR[0] - p.head[0], hz = p.nostrilR[2] - p.head[2];
  const hl = Math.hypot(hx, hz) || 1;
  const fx = hx / hl, fz = hz / hl;
  const rx = p.shoulder[0] - p.head[0], rz = p.shoulder[2] - p.head[2];
  const rl = Math.hypot(rx, rz) || 1;
  const sx = rx / rl, sz = rz / rl;
  // Angles round her from her own forward, positive towards her right. The
  // kabina is 1.45 m wide and she works close to its wall, so the preferred
  // pair — in front and to her right — is often inside the plaster; each view
  // takes the first candidate the room says is inside it.
  const at = (deg, up) => {
    const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    return [c[0] + (fx * ca + sx * sa) * DIST, c[1] + up,
      c[2] + (fz * ca + sz * sa) * DIST, ...c];
  };
  // One across the table, looking her in the face — which is also looking
  // down the straw — and one from her left. A 7 mm straw needs a long lens,
  // so these go with `--fov` (22 degrees by default).
  return [[0, 15, -15, 30, -30, 45], [-60, -75, -45, -90, -30, -105]]
    .map((list) => list.map((d) => at(d, 0.08)));
};
const rows = [];
let taken = 0, wasLine = false;
for (let i = 0; i < FRAMES; i++) {
  const p = JSON.parse(await ev(
    '__fr.filmStep().then(() => JSON.stringify(Object.assign(__fr.jad.cokeProbe(),'
    + ' { hand: __fr.jad.cokeHand() })))'));
  p.i = i;
  if (p.phase === 'line') wasLine = true;
  else if (wasLine) {
    wasLine = false;
    taken++;
    if (taken < LINES) {
      console.log('line', taken, 'done at frame', i, '- asking for the next');
      console.log('  ask ->', JSON.stringify(await ev("JSON.stringify(__fr.jad.ask('line'))")));

    }
  }
  p.take = taken;
  rows.push(p);
  if (i % 10 === 0) {
    console.log('frame', i, p.phase, 'clipT', p.clipT, 'dTop', p.dTopNostril, 'grip', p.gripOff);
    writeFileSync(out + '/probe.json', JSON.stringify(rows));
  }
  if (SHOTS.has(i)) {
    const vs = views(p);
    if (vs) {
      await ev('__fr.filmDt(1e-6)');
      await ev('__fr.fov(' + FOV + ')');
      for (let v = 0; v < vs.length; v++) {
        let pick = vs[v][0];
        for (const cand of vs[v]) {
          const inside = await ev('__fr.jad.kabina().inside(' + cand[0] + ',' + cand[2] + ')');
          if (inside > 0.9) { pick = cand; break; }
        }
        await ev('__fr.look(' + pick.join(',') + ')');
        await ev('__fr.filmStep().then(() => 1)');
        await shot(out + '/f' + String(i).padStart(3, '0') + '_v' + v + '.png');
      }
      await ev('__fr.free()');
      await ev('__fr.filmDt(1 / 30)');
    }
  }
}
writeFileSync(out + '/probe.json', JSON.stringify(rows));
console.log('frames', rows.length, 'errors', errs.length);
if (errs.length) console.log(errs.slice(0, 5).join('\n'));
chrome.kill();
process.exit(0);
