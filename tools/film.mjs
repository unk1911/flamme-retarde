#!/usr/bin/env node
// Film the game as a numbered PNG sequence, one world-step per frame.
//
//   node tools/film.mjs --plan tools/lab/demo60.json --out ~/fr-video/demo60/ctl
//
// ── why this is not tools/record.mjs ──────────────────────────────────────────
//
// `record.mjs` films *one cutscene*: it freezes that sequence's own clock and
// scrubs it to n/fps before each capture, which works beautifully and only for
// a shot that has a scrubbable clock. There is exactly one of those in the game.
//
// What a demo reel needs is the opposite — the whole simulation running, the
// aeroplane flying, the fire spreading, the sea moving, people walking — filmed
// at a rate that has nothing to do with how fast any of it draws. That is what
// `__fr.filmDt` and `__fr.filmStep` are for, and this is the driver for them:
//
//   * `filmDt(1/16)` makes one animation frame worth exactly a sixteenth of a
//     second of world, whatever the renderer manages.
//   * the world is PAUSED, and `filmStep()` runs one frame and resolves when it
//     is drawn. Left running, an unknown number of animation frames fire while
//     a PNG is being encoded, and the footage comes out evenly lit and unevenly
//     timed — the aeroplane crawling over the fire and sprinting over the water
//     because that is where the frame rate went.
//
// The result is reproducible: the same plan on a different machine is the same
// footage, only slower to take.
//
// ── the plan file ─────────────────────────────────────────────────────────────
//
//   {
//     "fps": 16, "hour": 15.6, "size": "1280x720",
//     "shots": [
//       { "name": "runin", "frames": 243,
//         "setup": "__fr.place(-3400, 300, 900, 1.2); __fr.cam(0); __fr.free()",
//         "per":   "__fr.look(...)"        // optional, sees `i` and `T`
//       }
//     ]
//   }
//
// `setup` runs once, before the shot's first frame; `per` runs before every
// frame with `i` (frame index within the shot) and `T` (seconds into the shot)
// in scope. A shot with no `per` is the game's own camera doing the work, which
// for anything involving the aeroplane is the right answer — the chase camera
// is a spring and hand-animating one looks like hand-animating one.
//
// Frames are numbered CONTINUOUSLY across shots, because the thing downstream
// is a 4k+1 chunker that knows nothing about shots. Shot boundaries are aligned
// by making every shot's `frames` a multiple of the chunk length; the plan is
// checked for that on load and refuses if it is not.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { gpuLaunch, RENDERER_JS } from './gpu.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
};
const flag = (name) => args.includes('--' + name);

const PLAN = JSON.parse(readFileSync(opt('plan', 'tools/lab/demo60.json'), 'utf8'));
const OUT = opt('out', '/tmp/fr-film');
const FPS = Number(opt('fps', PLAN.fps || 16));
const CHUNK = Number(opt('chunk', PLAN.chunk || 81));
const [W, H] = (opt('size', PLAN.size || '1280x720')).split('x').map(Number);
const PORT = 9333 + (Number(opt('port', 5)) | 0);
const URL_BASE = opt('url', 'http://127.0.0.1:8794/flamme-retarde.html');
const quality = opt('q', 'high');
const maxWait = Number(opt('wait', 240)) * 1000;
const ONLY = opt('only', null);          // film one named shot, for a look
const FROM = Number(opt('from', 0));     // resume: skip this many frames

// Every shot has to be a whole number of chunks or the chunker's boundaries
// drift off the cuts — and a cut is the one place a seam between two
// independently generated chunks is invisible, so throwing that away is
// throwing away the only free continuity this pipeline has.
for (const s of PLAN.shots) {
  if (s.frames % CHUNK !== 0) {
    console.error(`shot "${s.name}" is ${s.frames} frames, not a multiple of `
      + `${CHUNK} — cuts must land on chunk boundaries`);
    process.exit(2);
  }
}

const shots = ONLY ? PLAN.shots.filter((s) => s.name === ONLY) : PLAN.shots;
const total = shots.reduce((a, s) => a + s.frames, 0);
mkdirSync(OUT, { recursive: true });

const GL = gpuLaunch(flag('fallback') ? 'swiftshader' : null);
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  ...GL.args,
  '--hide-scrollbars', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  `--window-size=${W},${H}`,
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/claude-chrome-profile-' + PORT,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], env: GL.env });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome never opened its debugging port');
}

let nextId = 1;
function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  const send = (method, p = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: p, sessionId }));
  });
  return { ws, send, ready };
}

const consoleLines = [];

async function main() {
  const browser = connect(await endpoint());
  await browser.ready;
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => browser.send(m, p, sessionId);

  browser.ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      consoleLines.push('[' + msg.params.type + '] '
        + msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleLines.push(`[EXCEPTION] ${d.text} ${d.exception?.description || ''}`);
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  const sep = URL_BASE.includes('?') ? '&' : '?';
  await send('Page.navigate',
    { url: `${URL_BASE}${sep}q=${quality}&nointro&cb=${process.pid}` });

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate',
      { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.text + ' '
        + (r.exceptionDetails.exception?.description || ''));
    }
    return r.result.value;
  };

  const t0 = Date.now();
  let status = null;
  while (Date.now() - t0 < maxWait) {
    await sleep(500);
    try {
      status = await evalJs(`(() => {
        const s = document.getElementById('stage');
        return { stage: s ? s.textContent : null,
                 ready: !document.getElementById('enter').hidden };
      })()`);
    } catch (e) { status = { err: String(e) }; }
    if (status && status.ready) break;
  }
  if (!status?.ready) {
    console.log('BUILD DID NOT FINISH:', JSON.stringify(status));
    console.log(consoleLines.slice(0, 40).join('\n'));
    process.exit(2);
  }
  await evalJs(`document.getElementById('enter').click()`);
  await sleep(600);
  const renderer = await evalJs(RENDERER_JS).catch(() => '?');
  console.log(`build ${((Date.now() - t0) / 1000).toFixed(1)}s · ${renderer}`);

  await evalJs(`__fr.filmDt(${1 / FPS}); __fr.pause(true)`);
  // Every piece of screen furniture, hidden AFTER the pause — `setPaused` puts
  // the pause card up itself, so hiding it first hides it for one frame and
  // then it comes back over the whole film.
  //
  // The HUD is the game talking to a player and this is a camera. Nothing
  // downstream can do anything sensible with a litre counter painted over
  // Šibenik, and a model asked to make the picture photoreal will happily turn
  // one into architecture.
  await evalJs(`for (const id of ['hud','ground-hud','chute-hud','touch','gtouch',
    'pause','cine','radio','toast'])
    { const e = document.getElementById(id); if (e) e.hidden = true; }`);

  let n = 0;
  const started = Date.now();
  for (const shot of shots) {
    if (shot.setup) {
      await evalJs(`(() => { ${shot.setup}; return 1; })()`);
      // Let a spring camera settle into the pose before the shot starts, or
      // every cut opens on the camera sliding into place from wherever the
      // last one left it. Stepped, not slept: a paused world does not settle
      // on its own.
      const warm = shot.warm ?? 24;
      for (let k = 0; k < warm; k++) await evalJs('__fr.filmStep()');
    }
    for (let i = 0; i < shot.frames; i++, n++) {
      if (shot.per) {
        await evalJs(`(() => { const i = ${i}, T = ${(i / FPS).toFixed(5)};
          ${shot.per}; return 1; })()`);
      }
      await evalJs('__fr.filmStep()');
      if (n < FROM) continue;
      const shotPng = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${OUT}/f${String(n).padStart(5, '0')}.png`,
        Buffer.from(shotPng.data, 'base64'));
      if (n % 40 === 0) {
        const el = (Date.now() - started) / 1000;
        const rate = n ? el / n : 0;
        console.log(`  ${n}/${total}  ${shot.name}  ${el.toFixed(0)}s`
          + (rate ? `  eta ${((total - n) * rate / 60).toFixed(1)} min` : ''));
      }
    }
  }
  await evalJs('__fr.filmDt(0); __fr.pause(false)').catch(() => {});
  console.log(`${n} frames -> ${OUT}  (${(n / FPS).toFixed(2)} s at ${FPS} fps)`);

  const noise = /Autofill|DaemonVersion|UPower|external_pref|sandbox_linux|GetAndBlock|Fontconfig/;
  const interesting = consoleLines.filter((l) => !noise.test(l));
  if (interesting.length) console.log('console:\n' + interesting.slice(0, 20).join('\n'));

  chrome.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  console.log(consoleLines.slice(0, 30).join('\n'));
  chrome.kill();
  process.exit(1);
});
